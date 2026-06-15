export function diffMs(from: string | null, to: string | null): number | null {
  if (from === null || to === null) return null;
  return new Date(to).getTime() - new Date(from).getTime();
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "--:--:--";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
