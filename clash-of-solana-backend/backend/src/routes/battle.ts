import { FastifyInstance } from "fastify";
import { z } from "zod";
import { query, getPool } from "../db";
import { findOpponent } from "../services/matchmaking";

const prepareSchema = z.object({
  defenderPubkey: z.string().min(32).max(44),
});

/**
 * Battle routes
 * POST /api/v1/battle/matchmake   Знайти суперника
 * POST /api/v1/battle/prepare     Підготувати battle TX data
 * GET  /api/v1/battle/:id         Деталі бою
 * GET  /api/v1/battle/:id/replay  Replay бою
 */
export async function battleRoutes(app: FastifyInstance) {
  // Matchmaking — find opponent
  app.post("/matchmake", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const { pubkey } = request.user as { pubkey: string };

    // Get attacker stats from DB
    const playerResult = await query(
      `SELECT trophy_count, th_level FROM players WHERE pubkey = $1`,
      [pubkey]
    );

    if (playerResult.rows.length === 0) {
      return reply.status(404).send({ error: "Player not found" });
    }

    const player = playerResult.rows[0];
    const opponent = await findOpponent(
      {
        attackerPubkey: pubkey,
        attackerTrophies: player.trophy_count ?? 0,
        attackerThLevel: player.th_level ?? 1,
      },
      getPool()
    );

    if (!opponent) {
      return reply.status(404).send({
        success: false,
        error: "No suitable opponent found. Try again later.",
      });
    }

    // Get opponent details
    const opponentResult = await query(
      `SELECT pubkey, display_name, trophy_count, th_level FROM players WHERE pubkey = $1`,
      [opponent.playerPubkey]
    );

    const opponentData = opponentResult.rows[0];

    return {
      success: true,
      opponent: {
        villagePda: opponent.villagePda,
        playerPubkey: opponent.playerPubkey,
        trophyCount: opponentData?.trophy_count ?? 0,
        thLevel: opponentData?.th_level ?? 1,
        displayName: opponentData?.display_name ?? "Opponent",
      },
    };
  });

  // Prepare battle TX data
  app.post("/prepare", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parsed = prepareSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { pubkey } = request.user as { pubkey: string };
    const { defenderPubkey } = parsed.data;

    // Generate battle ID (timestamp-based, unique enough for PDA derivation)
    const battleId = BigInt(Date.now());

    return {
      success: true,
      battleId: battleId.toString(),
      attackerPubkey: pubkey,
      defenderPubkey,
      maxDurationSecs: 180,
      maxShips: 5,
      troopsPerShip: 3,
    };
  });

  // Get battle details (after finalize)
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;

    const result = await query(
      `SELECT id, battle_pda, attacker_pubkey, defender_pubkey,
              stars, destruction_pct, trophy_delta,
              loot_gold, loot_wood, loot_ore,
              ships_deployed, troops_deployed, occurred_at
       FROM battle_history WHERE id = $1 OR battle_pda = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Battle not found" });
    }

    const row = result.rows[0];
    return {
      battleId: row.id,
      battlePda: row.battle_pda,
      attacker: row.attacker_pubkey,
      defender: row.defender_pubkey,
      stars: row.stars,
      destructionPct: row.destruction_pct,
      lootGold: Number(row.loot_gold),
      lootWood: Number(row.loot_wood),
      lootOre: Number(row.loot_ore),
      trophyDelta: row.trophy_delta,
      shipsDeployed: row.ships_deployed,
      troopsDeployed: row.troops_deployed,
      occurredAt: row.occurred_at,
    };
  });

  // Battle replay
  app.get<{ Params: { id: string } }>("/:id/replay", async (request, reply) => {
    const { id } = request.params;

    const result = await query(
      `SELECT id, battle_log FROM battle_history WHERE id = $1 OR battle_pda = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Battle not found" });
    }

    return {
      battleId: result.rows[0].id,
      replay: result.rows[0].battle_log ?? [],
    };
  });
}
