import { POINTS, type Point } from "@/lib/types";

// "Needs-check" flags for a split recording. Advisory only — recording still
// succeeds; the operator sees yellow so they know to re-check it later.
export type SplitWarning = "duplicate" | "out_of_order";

export function splitWarnings(args: {
  point: Point;
  // The participant's OTHER non-voided checkpoints (excluding the one being judged).
  otherPoints: Point[];
  // True when this recording supersedes an earlier split at the same checkpoint.
  isRerecord: boolean;
}): SplitWarning[] {
  const warnings: SplitWarning[] = [];
  if (args.isRerecord) warnings.push("duplicate");

  // Out of order: an earlier checkpoint in the sequence has no recording yet.
  const idx = POINTS.indexOf(args.point);
  const earlierMissing = POINTS.slice(0, idx).some((p) => !args.otherPoints.includes(p));
  if (earlierMissing) warnings.push("out_of_order");

  return warnings;
}
