import { notFound } from "next/navigation";
import { POINTS, type Point } from "@/lib/types";
import { StationClient } from "./station-client";

const LABELS: Record<Point, string> = {
  t1: "T1 — Swim → Bike",
  t2: "T2 — Bike → Run",
  finish: "Finish",
};

export default async function StationPage({
  params,
}: {
  params: Promise<{ point: string }>;
}) {
  const { point } = await params;
  if (!POINTS.includes(point as Point)) notFound();
  return <StationClient point={point as Point} label={LABELS[point as Point]} />;
}
