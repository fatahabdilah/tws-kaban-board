// Board background presets + card label colors (shared client/server).

export type BoardBackground = {
  id: string;
  name: string;
  css: string; // CSS background value
};

export const BOARD_BACKGROUNDS: BoardBackground[] = [
  { id: 'default', name: 'Default', css: 'var(--background)' },
  { id: 'midnight', name: 'Midnight', css: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(135deg, #082f49 0%, #0369a1 100%)' },
  { id: 'royal', name: 'Royal', css: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(135deg, #052e16 0%, #047857 100%)' },
  { id: 'plum', name: 'Plum', css: 'linear-gradient(135deg, #2e1065 0%, #7e22ce 100%)' },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(135deg, #7c2d12 0%, #b91c1c 60%, #be185d 100%)' },
  { id: 'graphite', name: 'Graphite', css: 'linear-gradient(135deg, #09090b 0%, #27272a 100%)' },
];

export function backgroundCss(id: string | null | undefined): string {
  if (!id) return 'var(--background)';
  // Allow storing a raw url() or custom CSS too.
  if (id.startsWith('http')) return `center / cover no-repeat url("${id}")`;
  if (id.startsWith('linear-gradient') || id.startsWith('#') || id.startsWith('url(')) return id;
  return (BOARD_BACKGROUNDS.find((b) => b.id === id) ?? BOARD_BACKGROUNDS[0]).css;
}

export type CardLabel = { id: string; name: string; color: string };

export const CARD_LABELS: CardLabel[] = [
  { id: 'green', name: 'Hijau', color: '#22c55e' },
  { id: 'yellow', name: 'Kuning', color: '#eab308' },
  { id: 'orange', name: 'Oranye', color: '#f97316' },
  { id: 'red', name: 'Merah', color: '#ef4444' },
  { id: 'purple', name: 'Ungu', color: '#a855f7' },
  { id: 'blue', name: 'Biru', color: '#3b82f6' },
  { id: 'sky', name: 'Langit', color: '#0ea5e9' },
  { id: 'pink', name: 'Pink', color: '#ec4899' },
];

export function labelColor(id: string): string {
  return CARD_LABELS.find((l) => l.id === id)?.color ?? '#71717a';
}
