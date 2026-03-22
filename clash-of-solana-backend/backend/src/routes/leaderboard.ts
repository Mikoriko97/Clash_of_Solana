import { FastifyInstance } from "fastify";
import { query } from "../db";
import { cacheGet, cacheSet } from "../redis";

/**
 * Leaderboard routes
 * GET /api/v1/leaderboard/global   Топ-100 гравців (кубки)
 * GET /api/v1/leaderboard/league/:n Топ гравці в лізі N
 */
export async function leaderboardRoutes(app: FastifyInstance) {
  // Global leaderboard — top 100 by trophies
  app.get("/global", async () => {
    const cacheKey = "leaderboard:global";
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    // Try snapshot first, fall back to live query
    let result = await query(
      `SELECT player_pubkey, trophy_count, th_level, rank, snapshotted_at
       FROM leaderboard_snapshot
       WHERE snapshotted_at = (SELECT MAX(snapshotted_at) FROM leaderboard_snapshot)
       ORDER BY rank ASC
       LIMIT 100`
    );

    if (result.rows.length === 0) {
      // Fallback: live query from players table
      result = await query(
        `SELECT pubkey as player_pubkey, trophy_count, th_level,
                ROW_NUMBER() OVER (ORDER BY trophy_count DESC) as rank
         FROM players
         ORDER BY trophy_count DESC
         LIMIT 100`
      );
    }

    const response = {
      leaderboard: result.rows.map((row) => ({
        pubkey: row.player_pubkey,
        trophyCount: row.trophy_count,
        thLevel: row.th_level,
        rank: Number(row.rank),
      })),
      updatedAt: result.rows[0]?.snapshotted_at ?? new Date().toISOString(),
    };

    await cacheSet(cacheKey, response, 300); // 5 min cache
    return response;
  });

  // League leaderboard
  app.get<{ Params: { n: string } }>("/league/:n", async (request, reply) => {
    const league = parseInt(request.params.n, 10);
    if (isNaN(league) || league < 0 || league > 10) {
      return reply.status(400).send({ error: "Invalid league number (0-10)" });
    }

    const cacheKey = `leaderboard:league:${league}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return cached;

    // League boundaries based on trophy ranges
    const leagueBoundaries: Record<number, [number, number]> = {
      0: [0, 199],
      1: [200, 499],
      2: [500, 999],
      3: [1000, 1999],
      4: [2000, 2999],
      5: [3000, 3999],
      6: [4000, 4999],
      7: [5000, 5999],
      8: [6000, 6999],
      9: [7000, 7999],
      10: [8000, 999999],
    };

    const [minTrophies, maxTrophies] = leagueBoundaries[league] ?? [0, 999999];

    const result = await query(
      `SELECT pubkey, display_name, trophy_count, th_level,
              ROW_NUMBER() OVER (ORDER BY trophy_count DESC) as rank
       FROM players
       WHERE trophy_count BETWEEN $1 AND $2
       ORDER BY trophy_count DESC
       LIMIT 100`,
      [minTrophies, maxTrophies]
    );

    const response = {
      league,
      leaderboard: result.rows.map((row) => ({
        pubkey: row.pubkey,
        displayName: row.display_name,
        trophyCount: row.trophy_count,
        thLevel: row.th_level,
        rank: Number(row.rank),
      })),
    };

    await cacheSet(cacheKey, response, 300);
    return response;
  });
}
