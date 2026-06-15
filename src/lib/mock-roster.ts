// Deterministic demo-roster generator (no randomness, so it's stable + testable).
// Produces CSV in the same shape the admin importer expects.

const FIRST = [
  "Jan", "Lotte", "Piet", "Sara", "Wout", "Ann", "Bram", "Lies",
  "Tom", "Eva", "Karel", "Mila", "Daan", "Noor", "Stijn", "Fleur",
];
const LAST = [
  "de Vries", "Maes", "Janssens", "Peeters", "De Wit", "Claes",
  "Aerts", "Willems", "Mertens", "Hermans",
];
const CATS = ["M 18-29", "M 30-39", "M 40-49", "V 18-29", "V 30-39", "V 40-49"];
const TEAMS = [
  "Team Zeester", "De Krabben", "Dijkduivels",
  "Oester Express", "Polder Power", "Get Wet",
];

export const MOCK_CSV_HEADER =
  "bib,name,type,team_name,category,relay_swimmer,relay_cyclist,relay_runner";

export function generateMockRoster(count = 24): string {
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const bib = i + 1;
    const isRelay = i % 6 === 5; // every sixth entry is a relay team
    if (isRelay) {
      const team = TEAMS[Math.floor(i / 6) % TEAMS.length];
      const swimmer = FIRST[i % FIRST.length];
      const cyclist = FIRST[(i + 1) % FIRST.length];
      const runner = FIRST[(i + 2) % FIRST.length];
      rows.push(`${bib},${team},relay,${team},Relay,${swimmer},${cyclist},${runner}`);
    } else {
      const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
      const cat = CATS[i % CATS.length];
      rows.push(`${bib},${name},individual,,${cat},,,`);
    }
  }
  return [MOCK_CSV_HEADER, ...rows].join("\n") + "\n";
}
