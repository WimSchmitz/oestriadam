"use client";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Live" },
  { href: "/station/t1", label: "T1" },
  { href: "/station/t2", label: "T2" },
  { href: "/station/finish", label: "Finish" },
  { href: "/admin", label: "Admin" },
];

// Shared organizer footer, shown on every page (leaderboard, stations, admin).
// The current page is rendered as plain text rather than a link.
export function OrganizerNav() {
  const pathname = usePathname();
  return (
    <footer className="px-4 py-3 text-center text-xs text-[var(--muted)] border-t border-[var(--line)] bg-white">
      <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        <span className="font-semibold text-[var(--muted)]">Organizers:</span>
        {LINKS.map((l) =>
          pathname === l.href ? (
            <span key={l.href} className="font-bold text-[var(--sea-800)]">
              {l.label}
            </span>
          ) : (
            <a
              key={l.href}
              className="text-[var(--sea-600)] font-semibold hover:underline"
              href={l.href}
            >
              {l.label}
            </a>
          ),
        )}
      </nav>
    </footer>
  );
}
