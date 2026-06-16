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

export const MOCK_CSV_HEADER = "bib,name,type,gender,athlete_names,category";

export function generateMockRoster(count = 24): string {
  const rows: string[] = [];
  // Athlete and team number lists are independent and overlap — each counts from 1.
  let indivBib = 0;
  let relayBib = 0;
  for (let i = 0; i < count; i++) {
    const isRelay = i % 6 === 5; // every sixth entry is a relay team
    if (isRelay) {
      const bib = ++relayBib;
      const team = TEAMS[(relayBib - 1) % TEAMS.length];
      // Names are " / "-separated: the simple CSV parser splits on commas only.
      const athletes = [
        FIRST[i % FIRST.length],
        FIRST[(i + 1) % FIRST.length],
        FIRST[(i + 2) % FIRST.length],
      ].join(" / ");
      rows.push(`${bib},${team},relay,,${athletes},Relay`);
    } else {
      const bib = ++indivBib;
      const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
      const cat = CATS[i % CATS.length];
      const gender = cat.startsWith("V") ? "V" : "M";
      rows.push(`${bib},${name},individual,${gender},,${cat}`);
    }
  }
  return [MOCK_CSV_HEADER, ...rows].join("\n") + "\n";
}
