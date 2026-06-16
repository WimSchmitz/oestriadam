import { serverSupabase } from "@/server/supabase";
import type { Participant, Race, Split, Point, ParticipantStatus, ParticipantType } from "@/lib/types";
import type { ParticipantInput } from "@/lib/csv";

// --- mappers (snake_case DB -> camelCase domain) ---
type RaceRow = { id: string; event_name: string; gun_time: string | null };
type PartRow = {
  id: string; bib: number; name: string; type: "individual" | "relay";
  team_name: string | null; category: string | null;
  gender: string | null; athlete_names: string | null;
  status: ParticipantStatus;
};
type SplitRow = {
  id: string; participant_id: string; point: Point;
  recorded_at: string; station_key_used: string | null; voided: boolean;
};

const toRace = (r: RaceRow): Race => ({ id: r.id, eventName: r.event_name, gunTime: r.gun_time });
const toPart = (p: PartRow): Participant => ({
  id: p.id, bib: p.bib, name: p.name, type: p.type, teamName: p.team_name,
  category: p.category, gender: p.gender, athleteNames: p.athlete_names,
  status: p.status,
});
const toSplit = (s: SplitRow): Split => ({
  id: s.id, participantId: s.participant_id, point: s.point,
  recordedAt: s.recorded_at, stationKeyUsed: s.station_key_used ?? "", voided: s.voided,
});

export async function getRace(): Promise<Race> {
  const db = serverSupabase();
  const { data, error } = await db.from("race").select("*").limit(1).single();
  if (error) throw error;
  return toRace(data as RaceRow);
}

export async function setGunTime(gunTime: string | null): Promise<void> {
  const db = serverSupabase();
  const race = await getRace();
  const { error } = await db.from("race").update({ gun_time: gunTime }).eq("id", race.id);
  if (error) throw error;
}

export async function getParticipants(): Promise<Participant[]> {
  const db = serverSupabase();
  const { data, error } = await db.from("participants").select("*").order("bib");
  if (error) throw error;
  return (data as PartRow[]).map(toPart);
}

export async function getParticipantByBibAndType(
  bib: number,
  type: ParticipantType,
): Promise<Participant | null> {
  const db = serverSupabase();
  const { data } = await db
    .from("participants").select("*").eq("bib", bib).eq("type", type).maybeSingle();
  return data ? toPart(data as PartRow) : null;
}

export async function getSplits(): Promise<Split[]> {
  const db = serverSupabase();
  const { data, error } = await db.from("splits").select("*").order("recorded_at");
  if (error) throw error;
  return (data as SplitRow[]).map(toSplit);
}

export async function getSplitsForParticipant(participantId: string): Promise<Split[]> {
  const db = serverSupabase();
  const { data, error } = await db
    .from("splits").select("*").eq("participant_id", participantId).order("recorded_at");
  if (error) throw error;
  return (data as SplitRow[]).map(toSplit);
}

// Record a split. Voids any prior non-voided split at the same point first (re-record supersedes).
export async function recordSplit(
  participantId: string, point: Point, stationKey: string,
): Promise<Split> {
  const db = serverSupabase();
  await db.from("splits")
    .update({ voided: true })
    .eq("participant_id", participantId).eq("point", point).eq("voided", false);
  const { data, error } = await db.from("splits")
    .insert({ participant_id: participantId, point, station_key_used: stationKey })
    .select("*").single(); // recorded_at defaults to now() (server clock)
  if (error) throw error;
  return toSplit(data as SplitRow);
}

export async function voidSplit(splitId: string): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("splits").update({ voided: true }).eq("id", splitId);
  if (error) throw error;
}

export async function upsertParticipants(rows: ParticipantInput[]): Promise<void> {
  const db = serverSupabase();
  const payload = rows.map((r) => ({
    bib: r.bib, name: r.name, type: r.type, team_name: r.teamName,
    category: r.category, gender: r.gender, athlete_names: r.athleteNames,
  }));
  const { error } = await db.from("participants").upsert(payload, { onConflict: "type,bib" });
  if (error) throw error;
}

export async function setParticipantStatus(id: string, status: ParticipantStatus): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("participants").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteParticipant(id: string): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("participants").delete().eq("id", id);
  if (error) throw error;
}
