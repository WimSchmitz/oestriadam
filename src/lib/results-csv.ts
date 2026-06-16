import type { LeaderboardEntry } from "@/lib/types";
import { formatDuration } from "@/lib/time";

const HEADER = "rank,bib,type,name,gender,athletes,group_rank,status,swim,bike,run,total";

function cell(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toResultsCsv(entries: LeaderboardEntry[]): string {
  const rows = entries.map((e) => {
    const p = e.participant;
    const name = p.type === "relay" ? p.teamName ?? p.name : p.name;
    return [
      e.rank, p.bib, p.type, name, p.gender, p.athleteNames, e.categoryRank, e.progress.state,
      formatDuration(e.progress.swimMs), formatDuration(e.progress.bikeMs),
      formatDuration(e.progress.runMs), formatDuration(e.progress.totalMs),
    ].map(cell).join(",");
  });
  return [HEADER, ...rows].join("\n") + "\n";
}
