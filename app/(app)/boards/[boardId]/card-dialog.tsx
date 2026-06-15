'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  Trash2,
  Image as ImageIcon,
  Loader2,
  Check,
  Paperclip,
  Plus,
  ListChecks,
  Download,
  Pencil,
  Tag,
  X,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Label } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { CARD_LABELS } from '@/lib/board-theme';
import type { BoardLabel, Card, CardAttachment, ChecklistItem } from '@/lib/supabase/types';
import type { MemberWithProfile } from './page';
import {
  updateCard,
  addAttachment,
  deleteAttachment,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  createBoardLabel,
  updateBoardLabel,
  deleteBoardLabel,
} from './actions';

const PALETTE = CARD_LABELS.map((l) => l.color);

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readableText(hex: string): string {
  const m = hex.replace('#', '');
  if (m.length < 6) return '#fff';
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#18181b' : '#ffffff';
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function CardDialog({
  boardId,
  card,
  members,
  boardLabels,
  canEdit,
  currentUserId,
  onClose,
  onDelete,
  onSaved,
}: {
  boardId: string;
  card: Card;
  members: MemberWithProfile[];
  boardLabels: BoardLabel[];
  canEdit: boolean;
  currentUserId: string;
  onClose: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [dueDate, setDueDate] = useState(toDateInput(card.due_date));
  const [assignee, setAssignee] = useState(card.assignee_id ?? '');
  const [labels, setLabels] = useState<string[]>(card.labels ?? []);
  const [cover, setCover] = useState<string | null>(card.cover_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Attachments + checklist (loaded on open).
  const [attachments, setAttachments] = useState<CardAttachment[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheck, setNewCheck] = useState('');
  const [attaching, setAttaching] = useState(false);
  const attachRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const supabase = createClient();
    const [{ data: att }, { data: chk }] = await Promise.all([
      supabase.from('card_attachments').select('*').eq('card_id', card.id).order('created_at', { ascending: true }),
      supabase.from('card_checklist_items').select('*').eq('card_id', card.id).order('position', { ascending: true }),
    ]);
    setAttachments((att as CardAttachment[]) ?? []);
    setChecklist((chk as ChecklistItem[]) ?? []);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const doneCount = checklist.filter((c) => c.done).length;
  const progress = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  function withReload(fn: () => Promise<void>, errMsg: string) {
    start(async () => {
      try {
        await fn();
        await reload();
        onSaved();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : errMsg);
      }
    });
  }

  async function onPickAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast.error('Ukuran maksimal 20MB.');
    setAttaching(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${currentUserId}/cards/${card.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
      await addAttachment(boardId, card.id, { name: file.name, url, mime: file.type, size: file.size });
      await reload();
      onSaved();
      toast.success('Lampiran ditambahkan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah lampiran.');
    } finally {
      setAttaching(false);
    }
  }

  function toggleLabel(id: string) {
    if (!canEdit) return;
    setLabels((ls) => (ls.includes(id) ? ls.filter((l) => l !== id) : [...ls, id]));
  }

  // Label management (create / edit / delete board labels)
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PALETTE[0]);

  function labelAction(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn();
        onSaved(); // refresh boardLabels from server
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan label.');
      }
    });
  }

  function createLabel() {
    const name = newName;
    const color = newColor;
    setNewName('');
    setCreating(false);
    labelAction(() => createBoardLabel(boardId, name, color));
  }

  function saveLabelEdit(id: string) {
    const name = editName;
    const color = editColor;
    setEditId(null);
    labelAction(() => updateBoardLabel(boardId, id, { name, color }));
  }

  function removeLabel(id: string) {
    setLabels((ls) => ls.filter((l) => l !== id));
    labelAction(() => deleteBoardLabel(boardId, id));
  }

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar.');
    if (file.size > 5 * 1024 * 1024) return toast.error('Ukuran maksimal 5MB.');
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${currentUserId}/cards/${card.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
      await updateCard(boardId, card.id, { cover_url: url });
      setCover(url);
      toast.success('Cover ditambahkan');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah cover.');
    } finally {
      setUploading(false);
    }
  }

  function removeCover() {
    setUploading(true);
    start(async () => {
      try {
        await updateCard(boardId, card.id, { cover_url: null });
        setCover(null);
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menghapus cover.');
      } finally {
        setUploading(false);
      }
    });
  }

  function save() {
    if (!canEdit) return;
    start(async () => {
      try {
        await updateCard(boardId, card.id, {
          title,
          description,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          assignee_id: assignee || null,
          labels,
        });
        toast.success('Kartu disimpan');
        onSaved();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan kartu.');
      }
    });
  }

  return (
    <Dialog open onClose={onClose} title="Detail kartu">
      <div className="flex flex-col gap-4">
        {/* Cover */}
        {cover ? (
          <div className="group/cover relative overflow-hidden rounded-lg border border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="cover" className="h-40 w-full object-cover" />
            {canEdit && (
              <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover/cover:opacity-100">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="cursor-pointer rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                >
                  Ganti
                </button>
                <button
                  onClick={removeCover}
                  disabled={uploading}
                  className="cursor-pointer rounded-md bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-danger/80"
                  aria-label="Hapus cover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          canEdit && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-3 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              Tambah cover
            </button>
          )
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickCover} />

        <div>
          <Label htmlFor="c-title">Judul</Label>
          <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
        </div>

        {/* Labels */}
        <div>
          <Label className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Label
          </Label>
          <div className="flex flex-col gap-1.5">
            {boardLabels.map((l) => {
              const on = labels.includes(l.id);
              if (editId === l.id) {
                return (
                  <div key={l.id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nama label"
                      className="mb-2 py-1.5 text-sm"
                      autoFocus
                    />
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={cn(
                            'h-6 w-6 rounded-md transition-transform hover:scale-110',
                            editColor === c && 'ring-2 ring-white/70'
                          )}
                          style={{ backgroundColor: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditId(null)}>
                        Batal
                      </Button>
                      <Button size="sm" onClick={() => saveLabelEdit(l.id)} loading={pending}>
                        Simpan
                      </Button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={l.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    disabled={!canEdit}
                    className={cn(
                      'flex h-8 flex-1 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-all',
                      canEdit ? 'cursor-pointer hover:opacity-90 active:scale-[0.99]' : 'cursor-default',
                      on ? 'ring-2 ring-white/80' : ''
                    )}
                    style={{ backgroundColor: l.color, color: readableText(l.color) }}
                  >
                    <span className="flex-1 truncate text-left">{l.name || ' '}</span>
                    {on && <Check className="h-3.5 w-3.5" />}
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(l.id);
                          setEditName(l.name);
                          setEditColor(l.color);
                        }}
                        className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                        aria-label="Edit label"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLabel(l.id)}
                        className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label="Hapus label"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {canEdit &&
            (creating ? (
              <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nama label (mis. Backend)"
                  className="mb-2 py-1.5 text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && createLabel()}
                />
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={cn(
                        'h-6 w-6 rounded-md transition-transform hover:scale-110',
                        newColor === c && 'ring-2 ring-white/70'
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setCreating(false)}>
                    <X className="h-4 w-4" /> Batal
                  </Button>
                  <Button size="sm" onClick={createLabel} loading={pending}>
                    Buat label
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
              >
                <Plus className="h-4 w-4" /> Buat label baru
              </button>
            ))}
        </div>

        <div>
          <Label htmlFor="c-desc">Deskripsi</Label>
          <Textarea
            id="c-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tambah deskripsi lebih detail…"
            disabled={!canEdit}
          />
        </div>

        {/* Checklist */}
        <div>
          <Label className="flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Checklist
            {checklist.length > 0 && (
              <span className="ml-auto normal-case tracking-normal text-zinc-400">
                {doneCount}/{checklist.length}
              </span>
            )}
          </Label>
          {checklist.length > 0 && (
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-success transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {checklist.map((item) => (
              <li key={item.id} className="group/chk flex items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5">
                <button
                  type="button"
                  disabled={!canEdit || pending}
                  onClick={() => withReload(() => toggleChecklistItem(boardId, item.id, !item.done), 'Gagal.')}
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    item.done ? 'border-success bg-success text-white' : 'border-zinc-600 hover:border-zinc-400'
                  )}
                >
                  {item.done && <Check className="h-3 w-3" />}
                </button>
                <span className={cn('flex-1 text-sm', item.done ? 'text-zinc-500 line-through' : 'text-zinc-200')}>
                  {item.text}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => withReload(() => deleteChecklistItem(boardId, item.id), 'Gagal.')}
                    className="text-zinc-600 opacity-0 transition-opacity hover:text-danger group-hover/chk:opacity-100"
                    aria-label="Hapus item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="mt-2 flex gap-2">
              <Input
                value={newCheck}
                onChange={(e) => setNewCheck(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCheck.trim()) {
                    const t = newCheck.trim();
                    setNewCheck('');
                    withReload(() => addChecklistItem(boardId, card.id, t), 'Gagal menambah item.');
                  }
                }}
                placeholder="Tambah item…"
                className="py-1.5 text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!newCheck.trim()}
                onClick={() => {
                  const t = newCheck.trim();
                  setNewCheck('');
                  withReload(() => addChecklistItem(boardId, card.id, t), 'Gagal menambah item.');
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Attachments */}
        <div>
          <Label className="flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> Lampiran
          </Label>
          <ul className="flex flex-col gap-1.5">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="group/att flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-zinc-500" />
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-primary-light hover:underline"
                  title={a.name}
                >
                  {a.name}
                </a>
                <span className="shrink-0 text-[11px] text-zinc-500">{formatSize(a.size)}</span>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-zinc-500 transition-colors hover:text-white"
                  aria-label="Buka"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => withReload(() => deleteAttachment(boardId, a.id), 'Gagal hapus lampiran.')}
                    className="shrink-0 text-zinc-600 opacity-0 transition-opacity hover:text-danger group-hover/att:opacity-100"
                    aria-label="Hapus lampiran"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => attachRef.current?.click()}
                disabled={attaching}
                className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-60"
              >
                {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambah lampiran
              </button>
              <input ref={attachRef} type="file" className="hidden" onChange={onPickAttachment} />
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-due">Tenggat</Label>
            <Input id="c-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="c-assignee">Ditugaskan ke</Label>
            <Select
              value={assignee || 'none'}
              onValueChange={(v) => setAssignee(v === 'none' ? '' : v)}
              disabled={!canEdit}
            >
              <SelectTrigger id="c-assignee">
                <SelectValue placeholder="— Tidak ada —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Tidak ada —</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profile.full_name || m.profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {canEdit ? (
          <div className="mt-1 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:bg-danger/10">
              <Trash2 className="h-4 w-4" /> Hapus
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Tutup
              </Button>
              <Button size="sm" loading={pending} onClick={save}>
                Simpan
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Anda hanya dapat melihat kartu ini (viewer).</p>
        )}
      </div>
    </Dialog>
  );
}
