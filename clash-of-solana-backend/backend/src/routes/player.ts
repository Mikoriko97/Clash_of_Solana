import { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db";
import { cacheGet, cacheSet } from "../redis";

const pubkeySchema = z.object({
  pubkey: z.string().min(32).max(44),
});

/**
 * Player routes
 * GET  /api/v1/player/:pubkey          Профіль + статистика
 * GET  /api/v1/player/:pubkey/village  Стан села (з cache)
 * GET  /api/v1/player/:pubkey/army     Поточна армія
 * GET  /api/v1/player/:pubkey/history  Історія боїв
 */
export async function playerRoutes(app: FastifyInstance) {
  // Get player profile
  app.get<{ Params: { pubkey: string } }>("/:pubkey", async (request, reply) => {
    const parsed = pubkeySchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid pubkey format" });
    }
    const { pubkey } = parsed.data;

    // Try cache first
    const cacheKey = `player:${pubkey}`;
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const result = await query(
      `SELECT pubkey, village_pda, display_name, trophy_count, th_level, last_active, created_at
       FROM players WHERE pubkey = $1`,
      [pubkey]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Player not found" });
    }

    const row = result.rows[0];
    const profile = {
      pubkey: row.pubkey,
      villagePda: row.village_pda,
      displayName: row.display_name,
      trophyCount: row.trophy_count,
      thLevel: row.th_level,
      league: 0,
      experience: 0,
      lastActive: row.last_active,
      createdAt: row.created_at,
    };

    await cacheSet(cacheKey, profile, 60);
    return profile;
  });

  // Get village state
  app.get<{ Params: { pubkey: string } }>("/:pubkey/village", async (request, reply) => {
    const parsed = pubkeySchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid pubkey format" });
    }
    const { pubkey } = parsed.data;

    const cacheKey = `village:${pubkey}`;
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    // Get player info from DB
    const playerResult = await query(
      `SELECT pubkey, trophy_count, th_level FROM players WHERE pubkey = $1`,
      [pubkey]
    );

    if (playerResult.rows.length === 0) {
      return reply.status(404).send({ error: "Player not found" });
    }

    const player = playerResult.rows[0];
    const village = {
      pubkey,
      townHallLevel: player.th_level,
      trophyCount: player.trophy_count,
      gridWidth: 27,
      gridHeight: 27,
      buildings: [],
      resources: {
        gold: 1000,
        wood: 1000,
        ore: 1000,
      },
    };

    await cacheSet(cacheKey, village, 30);
    return village;
  });

  // Get army (trained troops)
  app.get<{ Params: { pubkey: string } }>("/:pubkey/army", async (request, reply) => {
    const parsed = pubkeySchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid pubkey format" });
    }
    const { pubkey } = parsed.data;

    const cacheKey = `army:${pubkey}`;
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    // Default troop levels (will be updated from on-chain data)
    const army = {
      pubkey,
      troops: {
        knight: { level: 1 },
        mage: { level: 1 },
        barbarian: { level: 1 },
        archer: { level: 1 },
        ranger: { level: 1 },
      },
    };

    await cacheSet(cacheKey, army, 60);
    return army;
  });

  // Get battle history (last 20)
  app.get<{ Params: { pubkey: string } }>("/:pubkey/history", async (request, reply) => {
    const parsed = pubkeySchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid pubkey format" });
    }
    const { pubkey } = parsed.data;

    const result = await query(
      `SELECT id, battle_pda, attacker_pubkey, defender_pubkey,
              stars, destruction_pct, trophy_delta,
              loot_gold, loot_wood, loot_ore,
              ships_deployed, troops_deployed, occurred_at
       FROM battle_history
       WHERE attacker_pubkey = $1 OR defender_pubkey = $1
       ORDER BY occurred_at DESC
       LIMIT 20`,
      [pubkey]
    );

    return {
      pubkey,
      battles: result.rows.map((row) => ({
        id: row.id,
        battlePda: row.battle_pda,
        attackerPubkey: row.attacker_pubkey,
        defenderPubkey: row.defender_pubkey,
        stars: row.stars,
        destructionPct: row.destruction_pct,
        trophyDelta: row.trophy_delta,
        lootGold: row.loot_gold,
        lootWood: row.loot_wood,
        lootOre: row.loot_ore,
        shipsDeployed: row.ships_deployed,
        troopsDeployed: row.troops_deployed,
        occurredAt: row.occurred_at,
        isAttacker: row.attacker_pubkey === pubkey,
      })),
    };
  });
}
