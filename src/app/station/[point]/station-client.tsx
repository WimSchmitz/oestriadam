"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Point } from "@/lib/types";

const KEY_STORAGE = "oestriadam-station-key";

interface RecentSplit {
  id: string;
  recordedAt: string;
  bib: number | null;
  name: string | null;
}

interface Toast {
  kind: "ok" | "warn" | "err";
  text: string;
}

export function StationClient({ point, label }: { point: Point; label: string }) {
  const [key, setKey] = useState<string | null>(null); // null = still resolving
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [checking, setChecking] = useState(false);
  const [bib, setBib] = useState("");
  const [recent, setRecent] = useState<RecentSplit[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);

  // Validate a candidate key against the server, then accept or reject it.
  const verifyAndSet = useCallback(async (candidate: string) => {
    setChecking(true);
    setKeyError("");
    try {
      const res = await fetch(`/api/auth?scope=station&key=${encodeURIComponent(candidate)}`);
      if (res.ok) {
        localStorage.setItem(KEY_STORAGE, candidate);
        setKey(candidate);
      } else {
        localStorage.removeItem(KEY_STORAGE);
        setKey("");
        setKeyError("Wrong station key — try again.");
      }
    } catch {
      setKey("");
      setKeyError("Could not reach the server. Check your connection.");
    } finally {
      setChecking(false);
    }
  }, []);

  // On mount: prefer a ?key= link, then a remembered key; validate before use.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key");
    const stored = localStorage.getItem(KEY_STORAGE);
    const candidate = fromUrl ?? stored;
    if (candidate) verifyAndSet(candidate);
    else setKey("");
  }, [verifyAndSet]);

  const loadRecent = useCallback(async () => {
    if (!key) return;
    const res = await fetch(`/api/splits?point=${point}`, { headers: { "x-station-key": key } });
    if (res.ok) {
      const data = await res.json();
      setRecent(
        (data.splits ?? []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          recordedAt: s.recordedAt as string,
          bib: (s.bib as number | null) ?? null,
          name: (s.name as string | null) ?? null,
        })),
      );
    }
  }, [point, key]);

  useEffect(() => {
    if (key) loadRecent();
  }, [key, loadRecent]);

  function flash(t: Toast) {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  }

  async function record() {
    if (!bib || busy || !key) return;
    setBusy(true);
    try {
      const res = await fetch("/api/splits", {
        method: "POST",
        headers: { "content-type": "application/json", "x-station-key": key },
        body: JSON.stringify({ action: "record", bib: Number(bib), point }),
      });
      const data = await res.json();
      if (res.ok) {
        flash({ kind: "ok", text: `✅ #${data.participant.bib} ${data.participant.name}` });
        setBib("");
        loadRecent();
      } else if (data.error === "unknown_bib") {
        flash({ kind: "warn", text: `⚠️ Unknown bib #${bib} — tell admin` });
      } else if (res.status === 401) {
        flash({ kind: "err", text: "🔒 Wrong station key" });
      } else {
        flash({ kind: "err", text: `Error: ${data.error}` });
      }
    } finally {
      setBusy(false);
    }
  }

  // Enter always records, no matter what's focused (e.g. an on-screen keypad
  // button after tapping it) — without this, Enter re-fires that button.
  const recordRef = useRef(record);
  recordRef.current = record;
  useEffect(() => {
    if (!key) return; // only while the recording view is shown
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        recordRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [key]);

  async function undo(splitId: string) {
    if (!key) return;
    await fetch("/api/splits", {
      method: "POST",
      headers: { "content-type": "application/json", "x-station-key": key },
      body: JSON.stringify({ action: "undo", splitId }),
    });
    loadRecent();
  }

  function press(d: string) {
    if (d === "C") setBib("");
    else if (d === "<") setBib((b) => b.slice(0, -1));
    else setBib((b) => (b.length < 5 ? b + d : b));
  }

  // --- key entry gate ---
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
          className="w-full max-w-sm bg-white rounded-2xl shadow p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (keyInput) verifyAndSet(keyInput);
          }}
        >
          <h1 className="text-xl font-extrabold text-[var(--sea-800)] mb-1">{label}</h1>
          <p className="text-sm text-[var(--muted)] mb-4">Enter the station password to begin.</p>
          <input
            type="password"
            autoFocus
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Station password"
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

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"];

  return (
    <main className="flex-1 flex flex-col">
      <header className="text-white px-4 py-3 bg-gradient-to-br from-[var(--sea-700)] to-[var(--aqua)]">
        <div className="font-extrabold tracking-wider text-sm flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white" /> STATION
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

      <div className="flex-1 flex flex-col p-4 max-w-sm w-full mx-auto">
        <h1 className="text-lg font-extrabold text-[var(--sea-800)]">{label}</h1>

        {/* Bib entry: type with a keyboard OR use the on-screen keypad below. */}
        <input
          inputMode="numeric"
          autoFocus
          value={bib}
          onChange={(e) => setBib(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="Bib #"
          aria-label="Bib number"
          className="mt-3 border-2 border-[var(--line)] focus:border-[var(--aqua)] outline-none rounded-2xl text-center text-5xl font-extrabold py-4 tnum bg-[#fbfdfd] w-full placeholder:text-[var(--line)]"
        />

        <button
          onClick={record}
          disabled={!bib || busy}
          className="mt-3 w-full text-white text-2xl font-extrabold tracking-wider py-5 rounded-2xl bg-gradient-to-br from-[var(--aqua)] to-[var(--sea-600)] shadow-lg active:scale-[0.99] disabled:opacity-40"
        >
          RECORD
        </button>

        {toast && (
          <p
            className={`mt-3 text-center text-base font-semibold rounded-lg py-2 px-3 ${
              toast.kind === "ok"
                ? "bg-[#eafaf0] text-[#157a45]"
                : toast.kind === "warn"
                  ? "bg-[#fff6e6] text-[#a15c00]"
                  : "bg-[#fdecec] text-[#b42318]"
            }`}
          >
            {toast.text}
          </p>
        )}

        {recent.length > 0 && (
          <>
            <h2 className="mt-6 mb-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              Recent at this station
            </h2>
            <ul className="text-sm">
              {recent.slice(0, 4).map((s) => (
                <li key={s.id} className="flex justify-between items-center gap-2 py-2 border-b border-[var(--line)]">
                  <span className="min-w-0 truncate">
                    {s.bib != null && <span className="text-[var(--muted)] mr-1.5">#{s.bib}</span>}
                    <span className="font-medium">{s.name ?? "—"}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="tnum text-[var(--muted)]">{new Date(s.recordedAt).toLocaleTimeString()}</span>
                    <button className="text-[#c2410c] font-bold text-[13px]" onClick={() => undo(s.id)}>
                      undo
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-auto pt-4 grid grid-cols-3 gap-2.5">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className={`rounded-xl py-4 text-2xl font-bold active:scale-95 ${
                k === "C" || k === "<"
                  ? "bg-[#e3ebec] text-[var(--muted)] text-lg"
                  : "bg-[#eef3f3] text-[var(--sea-800)]"
              }`}
            >
              {k === "<" ? "⌫" : k === "C" ? "Clear" : k}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
