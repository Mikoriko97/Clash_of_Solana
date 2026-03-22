import { Pool } from "pg";

export interface MatchmakingCriteria {
  attackerPubkey: string;
  attackerTrophies: number;
  attackerThLevel: number;
}

export interface MatchResult {
  villagePda: string;
  playerPubkey: string;
}

/**
 * Matchmaking service
 * Критерії з Godot (адаптовані):
 * - Trophy range: ±200 від attacker
 * - TH level: ±1 від attacker (макс 3 рівні)
 * - is_available = true (не під атакою, не під щитом)
 * - last_active < 24 години тому
 */
export async function findOpponent(
  criteria: MatchmakingCriteria,
  db: Pool
): Promise<MatchResult | null> {
  const client = await db.connect();
  try {
    const result = await client.query(
      `
      SELECT village_pda, player_pubkey
      FROM matchmaking_pool
      WHERE player_pubkey != $1
        AND trophy_count BETWEEN $2 AND $3
        AND th_level BETWEEN $4 AND $5
        AND is_available = true
        AND last_active > NOW() - INTERVAL '24 hours'
      ORDER BY RANDOM()
      LIMIT 1
    `,
      [
        criteria.attackerPubkey,
        criteria.attackerTrophies - 200,
        criteria.attackerTrophies + 200,
        criteria.attackerThLevel - 1,
        criteria.attackerThLevel + 1,
      ]
    );

    if (result.rows.length === 0) return null;

    return {
      villagePda: result.rows[0].village_pda,
      playerPubkey: result.rows[0].player_pubkey,
    };
  } finally {
    client.release();
  }
}
