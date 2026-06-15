import type { Point, Progress, ParticipantStatus, Split } from "@/lib/types";
import { diffMs } from "@/lib/time";

export function effectiveSplits(splits: Split[]): Partial<Record<Point, Split>> {
  const out: Partial<Record<Point, Split>> = {};
  for (const s of splits) {
    if (s.voided) continue;
    const cur = out[s.point];
    if (!cur || s.recordedAt > cur.recordedAt) out[s.point] = s;
  }
  return out;
}

export function computeProgress(
  gunTime: string | null,
  splits: Split[],
  status: ParticipantStatus,
): Progress {
  const eff = effectiveSplits(splits);
  const t1 = eff.t1?.recordedAt ?? null;
  const t2 = eff.t2?.recordedAt ?? null;
  const finish = eff.finish?.recordedAt ?? null;

  const swimMs = diffMs(gunTime, t1);
  const bikeMs = diffMs(t1, t2);
  const runMs = diffMs(t2, finish);
  const totalMs = diffMs(gunTime, finish);

  const furthest = finish ? 3 : t2 ? 2 : t1 ? 1 : 0;
  const furthestAt = finish ?? t2 ?? t1 ?? null;

  let state: Progress["state"];
  if (status === "dns") state = "dns";
  else if (status === "dnf") state = "dnf";
  else if (!gunTime) state = "not_started";
  else if (finish) state = "finished";
  else if (t2) state = "running";
  else if (t1) state = "cycling";
  else state = "swimming";

  return { state, swimMs, bikeMs, runMs, totalMs, furthest, furthestAt };
}
