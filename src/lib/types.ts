export type Point = "t1" | "t2" | "finish";
export const POINTS: Point[] = ["t1", "t2", "finish"];

export type ParticipantType = "individual" | "relay";
export type ParticipantStatus = "active" | "dnf" | "dns";

export interface Participant {
  id: string;
  bib: number;
  name: string;
  type: ParticipantType;
  teamName: string | null;
  category: string | null;
  gender: string | null; // individuals: 'M' | 'V'; null for teams
  athleteNames: string | null; // teams: free-text list of athletes; null for individuals
  status: ParticipantStatus;
}

export interface Split {
  id: string;
  participantId: string;
  point: Point;
  recordedAt: string; // ISO 8601
  stationKeyUsed: string;
  voided: boolean;
}

export interface Race {
  id: string;
  eventName: string;
  gunTime: string | null; // ISO 8601, null until started
}

export type RaceState =
  | "dns"
  | "dnf"
  | "not_started"
  | "swimming"
  | "cycling"
  | "running"
  | "finished";

export interface Progress {
  state: RaceState;
  swimMs: number | null;
  bikeMs: number | null;
  runMs: number | null;
  totalMs: number | null;
  furthest: 0 | 1 | 2 | 3; // 0 none, 1 t1, 2 t2, 3 finish
  furthestAt: string | null; // ISO of the furthest checkpoint
}

export interface LeaderboardEntry {
  participant: Participant;
  progress: Progress;
  rank: number | null; // null for DNF/DNS/not-started
  categoryRank: number | null;
}
