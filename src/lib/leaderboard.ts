import type { LeaderboardEntry, Participant, Progress, Race, Split } from "@/lib/types";
import { computeProgress } from "@/lib/progress";

function isRankable(prog: Progress): boolean {
  if (prog.state === "dnf" || prog.state === "dns" || prog.state === "not_started") return false;
  return prog.furthest > 0; // must have reached at least t1 to be ranked
}

// Lower sort key = better position.
function sortKey(prog: Progress): [number, number] {
  if (prog.state === "finished" && prog.totalMs !== null) {
    return [0, prog.totalMs]; // finishers first, by total time
  }
  // in progress: further checkpoint is better (negate), then earlier time is better
  const at = prog.furthestAt ? new Date(prog.furthestAt).getTime() : Infinity;
  return [1 - prog.furthest / 10, at];
}

export function buildLeaderboard(
  race: Race,
  participants: Participant[],
  splits: Split[],
): LeaderboardEntry[] {
  const byParticipant = new Map<string, Split[]>();
  for (const s of splits) {
    const arr = byParticipant.get(s.participantId) ?? [];
    arr.push(s);
    byParticipant.set(s.participantId, arr);
  }

  const entries = participants.map((participant) => {
    const progress = computeProgress(
      race.gunTime,
      byParticipant.get(participant.id) ?? [],
      participant.status,
    );
    return { participant, progress, rank: null as number | null, categoryRank: null as number | null };
  });

  entries.sort((a, b) => {
    const ra = isRankable(a.progress), rb = isRankable(b.progress);
    if (ra !== rb) return ra ? -1 : 1; // rankable first
    if (!ra && !rb) return a.participant.bib - b.participant.bib; // stable-ish
    const ka = sortKey(a.progress), kb = sortKey(b.progress);
    return ka[0] - kb[0] || ka[1] - kb[1] || a.participant.bib - b.participant.bib;
  });

  let rank = 0;
  const catCounter = new Map<string, number>();
  for (const e of entries) {
    if (!isRankable(e.progress)) continue;
    e.rank = ++rank;
    const cat = e.participant.category ?? "—";
    const next = (catCounter.get(cat) ?? 0) + 1;
    catCounter.set(cat, next);
    e.categoryRank = next;
  }

  return entries;
}
