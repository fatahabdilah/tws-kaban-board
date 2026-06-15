import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/get-user';
import type { Board, BoardLabel, BoardRole, Card, List, MemberWithProfile, Workspace } from '@/lib/supabase/types';
import { BoardView } from './board-view';

// Re-export so card-item / card-dialog can keep importing from './page'.
export type { MemberWithProfile } from '@/lib/supabase/types';

export type CardMeta = { checkTotal: number; checkDone: number; attach: number };
export type LabelMap = Record<string, { name: string; color: string }>;

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const me = await requireUser();
  const supabase = await createClient();

  const { data: board } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .maybeSingle<Board>();
  if (!board) notFound();

  const [
    { data: workspace },
    { data: role },
    { data: lists },
    { data: cards },
    { data: rawMembers },
    { data: rawCandidates },
    { data: checklistRows },
    { data: attachRows },
    { data: boardLabels },
  ] = await Promise.all([
      supabase.from('workspaces').select('id, name').eq('id', board.workspace_id).maybeSingle<Pick<Workspace, 'id' | 'name'>>(),
      supabase.rpc('board_role', { p_board_id: boardId }),
      supabase
        .from('lists')
        .select('*')
        .eq('board_id', boardId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<List[]>(),
      supabase
        .from('cards')
        .select('*')
        .eq('board_id', boardId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<Card[]>(),
      supabase
        .from('board_members')
        .select('user_id, role, profile:profiles(id, email, full_name, avatar_url)')
        .eq('board_id', boardId)
        .returns<Omit<MemberWithProfile, 'division' | 'job_title'>[]>(),
      supabase
        .from('workspace_members')
        .select('user_id, role, profile:profiles(id, email, full_name, avatar_url)')
        .eq('workspace_id', board.workspace_id)
        .returns<Omit<MemberWithProfile, 'division' | 'job_title'>[]>(),
      supabase
        .from('card_checklist_items')
        .select('card_id, done')
        .eq('board_id', boardId)
        .returns<{ card_id: string; done: boolean }[]>(),
      supabase
        .from('card_attachments')
        .select('card_id')
        .eq('board_id', boardId)
        .returns<{ card_id: string }[]>(),
      supabase
        .from('board_labels')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true })
        .returns<BoardLabel[]>(),
    ]);

  const members: MemberWithProfile[] = (rawMembers ?? [])
    .filter((m) => m.profile)
    .map((m) => ({ ...m, division: null, job_title: null }));
  const candidates: MemberWithProfile[] = (rawCandidates ?? [])
    .filter((m) => m.profile)
    .map((m) => ({ ...m, division: null, job_title: null }));

  const cardMeta: Record<string, CardMeta> = {};
  for (const r of checklistRows ?? []) {
    const m = (cardMeta[r.card_id] ??= { checkTotal: 0, checkDone: 0, attach: 0 });
    m.checkTotal += 1;
    if (r.done) m.checkDone += 1;
  }
  for (const r of attachRows ?? []) {
    const m = (cardMeta[r.card_id] ??= { checkTotal: 0, checkDone: 0, attach: 0 });
    m.attach += 1;
  }

  const labels = boardLabels ?? [];
  const labelMap: LabelMap = {};
  for (const l of labels) labelMap[l.id] = { name: l.name, color: l.color };

  return (
    <BoardView
      board={board}
      workspaceName={workspace?.name ?? 'Workspace'}
      role={(role as BoardRole | null) ?? 'viewer'}
      isSuperAdmin={me.profile.platform_role === 'super_admin'}
      currentUserId={me.userId}
      initialLists={lists ?? []}
      initialCards={cards ?? []}
      members={members}
      candidates={candidates}
      cardMeta={cardMeta}
      boardLabels={labels}
      labelMap={labelMap}
    />
  );
}
