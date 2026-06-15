import { getRace, getParticipants, getSplits } from "@/server/data";
import { buildLeaderboard } from "@/lib/leaderboard";
import { LeaderboardClient } from "./leaderboard-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [race, participants, splits] = await Promise.all([
    getRace(),
    getParticipants(),
    getSplits(),
  ]);
  const initial = buildLeaderboard(race, participants, splits);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <LeaderboardClient initialEntries={initial} race={race} participants={participants} />
    </main>
  );
}
