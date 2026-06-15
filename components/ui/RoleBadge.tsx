import { Shield, Pencil, Eye } from 'lucide-react';
import type { BoardRole } from '@/lib/supabase/types';
import { Badge } from './badge';

const config: Record<BoardRole, { label: string; variant: 'default' | 'success' | 'muted'; Icon: React.ElementType }> = {
  admin: { label: 'Admin', variant: 'default', Icon: Shield },
  member: { label: 'Member', variant: 'success', Icon: Pencil },
  viewer: { label: 'Viewer', variant: 'muted', Icon: Eye },
};

export function RoleBadge({ role, className }: { role: BoardRole; className?: string }) {
  const { label, variant, Icon } = config[role];
  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
