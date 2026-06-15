// Hand-written DB types mirroring supabase/migrations/0001_init.sql.
// Regenerate later with: npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts

export type PlatformRole = 'user' | 'super_admin';
export type BoardRole = 'admin' | 'member' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  platform_role: PlatformRole;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: BoardRole;
  division: string | null;
  job_title: string | null;
  added_by: string | null;
  created_at: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  background: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Shared shape for a member row joined with their profile.
export type MemberWithProfile = {
  user_id: string;
  role: BoardRole;
  division: string | null;
  job_title: string | null;
  profile: Pick<Profile, 'id' | 'email' | 'full_name' | 'avatar_url'>;
};

export interface List {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  list_id: string;
  board_id: string;
  title: string;
  description: string | null;
  position: number;
  due_date: string | null;
  assignee_id: string | null;
  cover_url: string | null;
  labels: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BoardLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CardAttachment {
  id: string;
  card_id: string;
  board_id: string;
  name: string;
  url: string;
  mime: string | null;
  size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  card_id: string;
  board_id: string;
  text: string;
  done: boolean;
  position: number;
  created_at: string;
}

type Insertable<T, Required extends keyof T> = Pick<T, Required> & Partial<T>;
type NoArgs = Record<PropertyKey, never>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Insertable<Profile, 'id' | 'email'>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      workspaces: {
        Row: Workspace;
        Insert: Insertable<Workspace, 'name' | 'owner_id'>;
        Update: Partial<Workspace>;
        Relationships: [];
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: Insertable<WorkspaceMember, 'workspace_id' | 'user_id'>;
        Update: Partial<WorkspaceMember>;
        Relationships: [];
      };
      boards: {
        Row: Board;
        Insert: Insertable<Board, 'workspace_id' | 'title' | 'created_by'>;
        Update: Partial<Board>;
        Relationships: [];
      };
      lists: {
        Row: List;
        Insert: Insertable<List, 'board_id' | 'title' | 'position'>;
        Update: Partial<List>;
        Relationships: [];
      };
      cards: {
        Row: Card;
        Insert: Insertable<Card, 'list_id' | 'title' | 'position' | 'created_by'>;
        Update: Partial<Card>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_super_admin: { Args: NoArgs; Returns: boolean };
      is_workspace_member: { Args: { p_ws_id: string }; Returns: boolean };
      workspace_role: { Args: { p_ws_id: string }; Returns: BoardRole };
      can_edit_workspace: { Args: { p_ws_id: string }; Returns: boolean };
      is_workspace_admin: { Args: { p_ws_id: string }; Returns: boolean };
      board_role: { Args: { p_board_id: string }; Returns: BoardRole };
      is_board_member: { Args: { p_board_id: string }; Returns: boolean };
      can_edit_board: { Args: { p_board_id: string }; Returns: boolean };
      is_board_admin: { Args: { p_board_id: string }; Returns: boolean };
      add_workspace_member_by_email: {
        Args: { p_ws_id: string; p_email: string; p_role: BoardRole; p_division?: string; p_job_title?: string };
        Returns: WorkspaceMember;
      };
    };
    Enums: {
      platform_role: PlatformRole;
      board_role: BoardRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
