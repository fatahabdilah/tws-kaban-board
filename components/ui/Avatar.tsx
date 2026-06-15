import { cn } from './cn';

function initials(name: string | null | undefined, email: string): string {
  const src = (name && name.trim()) || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Deterministic blue-ish tint per user so avatars are distinguishable.
function tint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = 200 + (h % 60); // 200–260 = blue/indigo range
  return `hsl(${hue} 55% 35%)`;
}

export function Avatar({
  name,
  email,
  url,
  size = 28,
  className,
}: {
  name?: string | null;
  email: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name || email}
        width={size}
        height={size}
        className={cn('inline-block shrink-0 rounded-full object-cover', className)}
        style={{ width: size, height: size }}
        title={name || email}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white',
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4, background: tint(email) }}
      title={name || email}
    >
      {initials(name, email)}
    </span>
  );
}
