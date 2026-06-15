"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { browserSupabase } from "@/lib/browser-supabase";
import { buildLeaderboard } from "@/lib/leaderboard";
import { formatDuration, diffMs } from "@/lib/time";
import type { LeaderboardEntry, Participant, Race, RaceState, Split } from "@/lib/types";

const STATUS: Record<RaceState, { icon: string; bg: string; label: string }> = {
  not_started: { icon: "⏳", bg: "bg-[#eef3f3]", label: "not started" },
  swimming: { icon: "🏊", bg: "bg-[#e6f7f9]", label: "swimming" },
  cycling: { icon: "🚴", bg: "bg-[#fff1e8]", label: "cycling" },
  running: { icon: "🏃", bg: "bg-[#eafaf0]", label: "running" },
  finished: { icon: "🏅", bg: "bg-[var(--sea-700)]", label: "finished" },
  dnf: { icon: "✕", bg: "bg-[#f1e3e3]", label: "DNF" },
  dns: { icon: "–", bg: "bg-[#eef3f3]", label: "DNS" },
};

type Filter = "all" | "individual" | "relay" | string;

function mapSplitRow(s: Record<string, unknown>): Split {
  return {
    id: s.id as string,
    participantId: s.participant_id as string,
    point: s.point as Split["point"],
    recordedAt: s.recorded_at as string,
    stationKeyUsed: (s.station_key_used as string) ?? "",
    voided: s.voided as boolean,
  };
}

export function LeaderboardClient({
  initialEntries,
  race,
  participants,
}: {
  initialEntries: LeaderboardEntry[];
  race: Race;
  participants: Participant[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const { data } = await browserSupabase.from("splits").select("*").order("recorded_at");
    const splits = (data ?? []).map(mapSplitRow);
    setEntries(buildLeaderboard(race, participants, splits));
  }, [race, participants]);

  // Realtime push; on any change, refresh.
  useEffect(() => {
    const ch = browserSupabase
      .channel("oestriadam-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "splits" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "race" }, refresh)
      .subscribe();
    return () => {
      browserSupabase.removeChannel(ch);
    };
  }, [refresh]);

  // Polling fallback (10s) + 1s ticking clock for live elapsed times.
  useEffect(() => {
    const poll = setInterval(refresh, 10_000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [refresh]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.participant.category) set.add(e.participant.category);
    return [...set].sort();
  }, [entries]);

  const shown = entries.filter((e) => {
    if (filter === "all") return true;
    if (filter === "individual" || filter === "relay") return e.participant.type === filter;
    return e.participant.category === filter;
  });

  const finishers = entries.filter((e) => e.progress.state === "finished").length;
  const nowIso = new Date().toISOString();

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "individual", label: "Individuals" },
    { key: "relay", label: "Relays" },
    ...categories.map((c) => ({ key: c, label: c })),
  ];

  return (
    <div className="bg-white min-h-full flex flex-col shadow-sm">
      {/* header */}
      <header className="text-white px-4 pt-5 pb-4 bg-gradient-to-br from-[var(--sea-800)] to-[var(--sea-600)]">
        <div className="flex items-center gap-2 font-extrabold tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--aqua)] shadow-[0_0_0_4px_rgba(19,179,196,0.25)]" />
          OESTRIADAM
          <span className="ml-auto text-[11px] bg-white/15 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <span className="live-dot" /> LIVE
          </span>
        </div>
        <div className="text-[13px] text-[#bfe6ea] mt-1">
          {race.eventName} · quarter triathlon · 20 June 2026
        </div>
      </header>

      {/* filter tabs */}
      <div className="flex gap-2 p-3 overflow-x-auto border-b border-[var(--line)] bg-white">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`shrink-0 text-[13px] px-3 py-1.5 rounded-full font-semibold transition-colors ${
              filter === t.key
                ? "bg-[var(--sea-700)] text-white"
                : "bg-[#eef3f3] text-[var(--muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* rows */}
      <ul className="flex-1 overflow-auto">
        {shown.length === 0 && (
          <li className="p-10 text-center text-[var(--muted)]">No participants yet.</li>
        )}
        {shown.map((e) => {
          const s = STATUS[e.progress.state];
          const isFinished = e.progress.state === "finished";
          const live = isFinished ? e.progress.totalMs : diffMs(race.gunTime, nowIso);
          const displayName =
            e.participant.type === "relay"
              ? e.participant.teamName ?? e.participant.name
              : e.participant.name;
          const open = openId === e.participant.id;
          return (
            <li key={e.participant.id} className="border-b border-[var(--line)]">
              <button
                onClick={() => setOpenId(open ? null : e.participant.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="w-7 text-center font-extrabold text-base tnum shrink-0 text-[var(--sea-600)]">
                  {e.rank ?? "–"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="block text-xs text-[var(--muted)] truncate">
                    #{e.participant.bib}
                    {e.participant.category ? ` · ${e.participant.category}` : ""}
                    {e.categoryRank ? ` · cat ${e.categoryRank}` : ""}
                  </span>
                </span>
                <span
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center text-lg shrink-0 ${s.bg}`}
                  title={s.label}
                >
                  {s.icon}
                </span>
                <span className="w-[92px] text-right shrink-0">
                  <span className="block font-extrabold text-base tnum">{formatDuration(live)}</span>
                  <span className="block text-[11px] text-[var(--muted)]">
                    {isFinished ? "total" : s.label}
                  </span>
                </span>
              </button>
              {open && (
                <div className="px-4 pb-3 pt-1 grid grid-cols-3 gap-2 bg-[#fbfdfd] text-center">
                  {(
                    [
                      ["🏊 Swim", e.progress.swimMs],
                      ["🚴 Bike", e.progress.bikeMs],
                      ["🏃 Run", e.progress.runMs],
                    ] as const
                  ).map(([label, ms]) => (
                    <div key={label} className="rounded-lg border border-[var(--line)] py-2">
                      <div className="text-[11px] text-[var(--muted)]">{label}</div>
                      <div className="font-bold tnum text-sm">{formatDuration(ms)}</div>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="px-4 py-3 text-center text-xs text-[var(--muted)] border-t border-[var(--line)] bg-white">
        <div>Tap a row for splits · updates live · {finishers} finisher{finishers === 1 ? "" : "s"}</div>
        <nav className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          <span className="font-semibold text-[var(--muted)]">Organizers:</span>
          <a className="text-[var(--sea-600)] font-semibold hover:underline" href="/station/t1">T1</a>
          <a className="text-[var(--sea-600)] font-semibold hover:underline" href="/station/t2">T2</a>
          <a className="text-[var(--sea-600)] font-semibold hover:underline" href="/station/finish">Finish</a>
          <a className="text-[var(--sea-600)] font-semibold hover:underline" href="/admin">Admin</a>
        </nav>
      </footer>
    </div>
  );
}
