"use client";
import { useEffect, useState, useCallback } from "react";
import type { Point } from "@/lib/types";

const KEY_STORAGE = "oestriadam-station-key";

interface RecentSplit {
  id: string;
  bib?: number;
  name?: string;
  recordedAt: string;
}

interface Toast {
  kind: "ok" | "warn" | "err";
  text: string;
}

export function StationClient({ point, label }: { point: Point; label: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [bib, setBib] = useState("");
  const [recent, setRecent] = useState<RecentSplit[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setKey(localStorage.getItem(KEY_STORAGE) ?? "");
  }, []);

  const loadRecent = useCallback(async () => {
    if (!key) return;
    const res = await fetch(`/api/splits?point=${point}`, { headers: { "x-station-key": key } });
    if (res.ok) {
      const data = await res.json();
      setRecent(
        (data.splits ?? []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          recordedAt: s.recordedAt as string,
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

  // key entry gate
  if (key === null) return null; // hydration guard
  if (key === "") {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-extrabold text-[var(--sea-800)] mb-1">{label}</h1>
          <p className="text-sm text-[var(--muted)] mb-4">Enter the station key to begin.</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Station key"
            className="border-2 border-[var(--line)] rounded-lg p-3 w-full text-lg"
          />
          <button
            onClick={() => {
              localStorage.setItem(KEY_STORAGE, keyInput);
              setKey(keyInput);
            }}
            className="mt-3 w-full bg-[var(--sea-700)] text-white font-bold py-3 rounded-lg"
          >
            Continue
          </button>
        </div>
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
            className="ml-auto text-[11px] underline/30 underline opacity-80"
            onClick={() => {
              localStorage.removeItem(KEY_STORAGE);
              setKey("");
            }}
          >
            change key
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4 max-w-sm w-full mx-auto">
        <h1 className="text-lg font-extrabold text-[var(--sea-800)]">{label}</h1>

        <div className="mt-3 border-2 border-[var(--line)] rounded-2xl text-center text-5xl font-extrabold py-4 tnum bg-[#fbfdfd] min-h-[88px]">
          {bib || <span className="text-[var(--line)]">— —</span>}
        </div>

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
                <li key={s.id} className="flex justify-between items-center py-2 border-b border-[var(--line)]">
                  <span className="tnum">{new Date(s.recordedAt).toLocaleTimeString()}</span>
                  <button className="text-[#c2410c] font-bold text-[13px]" onClick={() => undo(s.id)}>
                    undo
                  </button>
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
