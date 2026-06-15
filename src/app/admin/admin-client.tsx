"use client";
import { useEffect, useState, useCallback } from "react";
import type { Participant, ParticipantStatus, Race } from "@/lib/types";
import { formatDuration, diffMs } from "@/lib/time";
import { generateMockRoster } from "@/lib/mock-roster";

const KEY_STORAGE = "oestriadam-admin-key";

export function AdminClient() {
  const [key, setKey] = useState<string | null>(null); // null = still resolving
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [checking, setChecking] = useState(false);
  const [race, setRace] = useState<Race | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");
  const [, setTick] = useState(0);

  // Validate a candidate key against the server, then accept or reject it.
  const verifyAndSet = useCallback(async (candidate: string) => {
    setChecking(true);
    setKeyError("");
    try {
      const res = await fetch(`/api/auth?scope=admin&key=${encodeURIComponent(candidate)}`);
      if (res.ok) {
        localStorage.setItem(KEY_STORAGE, candidate);
        setKey(candidate);
      } else {
        localStorage.removeItem(KEY_STORAGE);
        setKey("");
        setKeyError("Wrong admin password — try again.");
      }
    } catch {
      setKey("");
      setKeyError("Could not reach the server. Check your connection.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key");
    const stored = localStorage.getItem(KEY_STORAGE);
    const candidate = fromUrl ?? stored;
    if (candidate) verifyAndSet(candidate);
    else setKey("");
  }, [verifyAndSet]);

  const headers = useCallback(
    () => ({ "content-type": "application/json", "x-admin-key": key ?? "" }),
    [key],
  );

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      fetch("/api/race").then((x) => x.json()),
      fetch("/api/participants").then((x) => x.json()),
    ]);
    setRace(r.race);
    setParticipants(p.participants ?? []);
  }, []);

  useEffect(() => {
    if (key) load();
  }, [key, load]);

  // tick the running clock once the gun has fired
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function raceAction(action: "start" | "clear") {
    if (action === "clear" && !confirm("Clear the gun time? This resets all elapsed times.")) return;
    const res = await fetch("/api/race", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action }),
    });
    if (res.ok) setRace((await res.json()).race);
    else setMsg("🔒 wrong admin key");
  }

  async function importCsv() {
    const res = await fetch("/api/participants", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action: "import", csv }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`✅ Imported ${data.imported} participant(s)`);
      load();
    } else {
      setMsg((data.errors ?? [data.error]).join(" · "));
    }
  }

  async function setStatus(id: string, status: ParticipantStatus) {
    await fetch("/api/participants", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action: "status", id, status }),
    });
    load();
  }

  if (key === null && !keyError) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-[var(--muted)]">
        Checking access…
      </main>
    );
  }
  if (!key) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <form
          className="w-full max-w-md bg-white rounded-2xl shadow p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (keyInput) verifyAndSet(keyInput);
          }}
        >
          <h1 className="text-xl font-extrabold text-[var(--sea-800)] mb-1">Admin</h1>
          <p className="text-sm text-[var(--muted)] mb-4">Enter the admin password.</p>
          <input
            type="password"
            autoFocus
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin password"
            className="border-2 border-[var(--line)] rounded-lg p-3 w-full text-lg"
          />
          {keyError && <p className="mt-2 text-sm text-[#b42318]">{keyError}</p>}
          <button
            type="submit"
            disabled={!keyInput || checking}
            className="mt-3 w-full bg-[var(--sea-700)] text-white font-bold py-3 rounded-lg disabled:opacity-40"
          >
            {checking ? "Checking…" : "Continue"}
          </button>
        </form>
      </main>
    );
  }

  const started = !!race?.gunTime;
  const elapsed = started ? formatDuration(diffMs(race!.gunTime, new Date().toISOString())) : null;

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto">
      <header className="text-white px-4 py-3 bg-gradient-to-br from-[var(--sea-900)] to-[var(--sea-700)]">
        <div className="font-extrabold tracking-wider text-sm flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" /> ADMIN
          <button
            className="ml-auto text-[11px] underline opacity-80"
            onClick={() => {
              localStorage.removeItem(KEY_STORAGE);
              setKey("");
              setKeyInput("");
            }}
          >
            change key
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {msg && (
          <div className="text-sm bg-[var(--aqua-soft)] text-[var(--sea-800)] rounded-lg px-3 py-2">
            {msg}
          </div>
        )}

        {/* Race control */}
        <section className="bg-white border border-[var(--line)] rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Race</h2>
          <div className="mb-3">
            {started ? (
              <div>
                <span className="text-[var(--muted)] text-sm">Running · </span>
                <span className="font-extrabold text-2xl tnum text-[var(--accent)]">{elapsed}</span>
              </div>
            ) : (
              <span className="text-[var(--muted)]">Not started</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => raceAction("start")}
              disabled={started}
              className="bg-[var(--accent)] text-white font-bold px-4 py-2.5 rounded-lg disabled:opacity-40"
            >
              {started ? "Race started" : "START RACE"}
            </button>
            <button
              onClick={() => raceAction("clear")}
              className="bg-[#eef3f3] text-[var(--sea-800)] font-semibold px-4 py-2.5 rounded-lg"
            >
              Clear
            </button>
            <a
              href={`/api/results?key=${encodeURIComponent(key)}`}
              className="bg-[var(--sea-700)] text-white font-semibold px-4 py-2.5 rounded-lg"
            >
              Export CSV
            </a>
          </div>
        </section>

        {/* CSV import */}
        <section className="bg-white border border-[var(--line)] rounded-xl p-4">
          <div className="flex items-center mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              Import roster (CSV)
            </h2>
            <button
              onClick={() => setCsv(generateMockRoster(24))}
              className="ml-auto text-xs font-semibold text-[var(--sea-700)] border border-[var(--line)] rounded-lg px-2.5 py-1"
            >
              ✨ Generate demo data
            </button>
          </div>
          <p className="text-[11px] text-[var(--muted)] mb-2 font-mono break-all">
            bib,name,type,team_name,category,relay_swimmer,relay_cyclist,relay_runner
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="Paste CSV rows here… or click “Generate demo data”"
            className="border border-[var(--line)] rounded-lg w-full h-32 p-2 font-mono text-sm"
          />
          <button
            onClick={importCsv}
            disabled={!csv.trim()}
            className="mt-2 bg-[var(--sea-800)] text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
          >
            Import
          </button>
        </section>

        {/* Participants */}
        <section className="bg-white border border-[var(--line)] rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">
            Participants · {participants.length}
          </h2>
          {participants.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">None yet — import a roster above.</p>
          ) : (
            <ul className="text-sm">
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 py-2 border-b border-[var(--line)] last:border-0"
                >
                  <span className="w-10 text-[var(--muted)] tnum">#{p.bib}</span>
                  <span className="flex-1 truncate">{p.teamName ?? p.name}</span>
                  <select
                    value={p.status}
                    onChange={(e) => setStatus(p.id, e.target.value as ParticipantStatus)}
                    className="border border-[var(--line)] rounded text-xs py-1"
                  >
                    <option value="active">active</option>
                    <option value="dnf">DNF</option>
                    <option value="dns">DNS</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
