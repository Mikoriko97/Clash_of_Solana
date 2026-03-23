import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { query } from "../db";
import {
  getFullOnChainState,
  txConstructBuilding,
  txUpgradeBuilding,
  txTrainTroop,
  txCollectResources,
  keypairFromSecret,
  readTroops,
  executeFullBattleOnChain,
  readBattleState,
} from "../services/solana-state";
import { findOpponent } from "../services/matchmaking";
import { findOpponentRedis } from "../services/matchmaking-redis";
import { decrypt } from "../services/crypto";
import { getPool } from "../db";

const BUILDING_TYPE_MAP: Record<string, number> = {
  town_hall: 0, mine: 1, barn: 2, port: 3, sawmill: 4, turret: 5,
};

const TROOP_TYPE_MAP: Record<string, number> = {
  knight: 0, mage: 1, barbarian: 2, archer: 3, ranger: 4,
};

const buildSchema = z.object({
  buildingType: z.string().min(1).max(20),
  gridX: z.number().int().min(0).max(26),
  gridY: z.number().int().min(0).max(26),
});

const upgradeSchema = z.object({
  buildingIndex: z.number().int().min(0),
});

const troopSchema = z.object({
  troopType: z.string().min(1).max(20),
});

const attackSchema = z.object({
  defenderPubkey: z.string().min(32).max(44),
});

// settleSchema removed — battle is fully executed on-chain in /attack

/**
 * Game routes — ALL state on Solana blockchain.
 * Backend is a thin relay: builds TX → signs → sends to Solana.
 * Reads state from Solana PDAs, not PostgreSQL.
 */
export async function gameRoutes(app: FastifyInstance) {

  // Auth guard — returns pubkey or null
  const auth = async (request: any, reply: any): Promise<string | null> => {
    try {
      await request.jwtVerify();
      return (request.user as { pubkey: string }).pubkey;
    } catch {
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }
  };

  // Get player keypair from DB (stored at wallet creation)
  const getKeypair = async (pubkey: string) => {
    const result = await query(`SELECT secret_key FROM players WHERE pubkey=$1`, [pubkey]);
    if (result.rows.length === 0 || !result.rows[0].secret_key) return null;
    return keypairFromSecret(decrypt(result.rows[0].secret_key));
  };

  // ══════════════════════════════════════
  //  GET STATE — reads from Solana L1
  // ══════════════════════════════════════

  app.get("/state", async (request, reply) => {
    const pubkey = await auth(request, reply);
    if (!pubkey) return;

    try {
      const ownerPk = new PublicKey(pubkey);
      const state = await getFullOnChainState(ownerPk);
      if (!state) {
        return reply.status(404).send({
          error: "Village not found on-chain. Create wallet first.",
          source: "solana_l1",
        });
      }
      app.log.info({ pubkey, buildings: state.buildings.length, source: "solana" }, "State read from chain");
      return state;
    } catch (err: any) {
      app.log.error(err, "Failed to read on-chain state");
      return reply.status(500).send({ error: "Failed to read on-chain state: " + err.message });
    }
  });

  // ══════════════════════════════════════
  //  BUILD — Solana TX: build_construct
  // ══════════════════════════════════════

  app.post("/build", async (request, reply) => {
    const pubkey = await auth(request, reply);
    if (!pubkey) return;

    const parsed = buildSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

    const typeId = BUILDING_TYPE_MAP[parsed.data.buildingType];
    if (typeId === undefined) return reply.status(400).send({ error: "Unknown building type" });

    const keypair = await getKeypair(pubkey);
    if (!keypair) return reply.status(400).send({ error: "Keypair not found" });

    try {
      // Get current building count from chain
      const state = await getFullOnChainState(keypair.publicKey);
      const buildingIndex = state?.buildingCount ?? 0;

      const sig = await txConstructBuilding(keypair, typeId, parsed.data.gridX, parsed.data.gridY, buildingIndex);

      app.log.info({ pubkey, type: parsed.data.buildingType, sig }, "Building TX confirmed on Solana");

      // Notify via WebSocket
      broadcastToPlayer(pubkey, {
        type: "tx_confirmed",
        action: "build",
        signature: sig,
        buildingType: parsed.data.buildingType,
        gridX: parsed.data.gridX,
        gridY: parsed.data.gridY,
      });

      return {
        success: true,
        type: parsed.data.buildingType,
        gridX: parsed.data.gridX,
        gridY: parsed.data.gridY,
        level: 1,
        signature: sig,
        source: "solana_l1",
      };
    } catch (err: any) {
      app.log.error(err, "Build TX failed");
      return reply.status(400).send({ error: "On-chain build failed: " + err.message });
    }
  });

  // ══════════════════════════════════════
  //  UPGRADE — Solana TX: build_upgrade
  // ══════════════════════════════════════

  app.post("/upgrade", async (request, reply) => {
    const pubkey = await auth(request, reply);
    if (!pubkey) return;

    const parsed = upgradeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

    const keypair = await getKeypair(pubkey);
    if (!keypair) return reply.status(400).send({ error: "Keypair not found" });

    try {
      const sig = await txUpgradeBuilding(keypair, parsed.data.buildingIndex);

      return {
        success: true,
        buildingIndex: parsed.data.buildingIndex,
        signature: sig,
        source: "solana_l1",
      };
    } catch (err: any) {
      return reply.status(400).send({ error: "On-chain upgrade failed: " + err.message });
    }
  });

  // ══════════════════════════════════════
  //  TRAIN — Solana TX: troop_train
  // ══════════════════════════════════════

  app.post("/train", async (request, reply) => {
    const pubkey = await auth(request, reply);
    if (!pubkey) return;

    const parsed = troopSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

    const typeId = TROOP_TYPE_MAP[parsed.data.troopType.toLowerCase()];
    if (typeId === undefined) return reply.status(400).send({ error: "Unknown troop type" });

    const keypair = await getKeypair(pubkey);
    if (!keypair) return reply.status(400).send({ error: "Keypair not found" });

    try {
      // Check if troop already exists on-chain
      const existingTroops = await readTroops(keypair.publicKey);
      const isNew = !existingTroops[parsed.data.troopType.toLowerCase()];

      const sig = await txTrainTroop(keypair, typeId, isNew);

      return {
        success: true,
        troopType: parsed.data.troopType,
        isNew,
        signature: sig,
        source: "solana_l1",
      };
    } catch (err: any) {
      return reply.status(400).send({ error: "On-chain train failed: " + err.message });
    }
  });

  // ══════════════════════════════════════
  //  COLLECT — Solana TX: resource_collect
  // ══════════════════════════════════════

  app.post("/collect", async (request, reply) => {
    const pubkey = await auth(request, reply);
    if (!pubkey) return;

    const keypair = await getKeypair(pubkey);
    if (!keypair) return reply.status(400).send({ error: "Keypair not found" });

    try {
      const sig = await txCollectResources(keypair);
      return { success: true, signature: sig, source: "solana_l1" };
    } catch (err: any) {
      return reply.status(400).send({ error: "Collect failed: " + err.message });
    }
  });

  // ══════════════════════════════════════
  //  MATCHMAKING — off-chain (Redis index)
  // ══════════════════════════════════════

  app.post("/find-opponent", async (request, reply) => {
    const pubkey = await auth(request, reply);
    if (!pubkey) return;

    try {
      const state = await getFullOnChainState(new PublicKey(pubkey));
      const trophies = state?.trophyCount ?? 0;
      const thLevel = state?.thLevel ?? 1;

      // Try Redis matchmaking first, fallback to PostgreSQL
      let opponentPubkey: string | null = await findOpponentRedis(pubkey, trophies, thLevel);

      if (!opponentPubkey) {
        const pgOpponent = await findOpponent(
          { attackerPubkey: pubkey, attackerTrophies: trophies, attackerThLevel: thLevel },
          getPool()
        );
        opponentPubkey = pgOpponent?.playerPubkey ?? null;
      }

      if (!opponentPubkey) return reply.status(404).send({ success: false, error: "No opponent found" });

      // Read opponent state from chain
      const oppState = await getFullOnChainState(new PublicKey(opponentPubkey));

      return {
        success: true,
        opponent: {
          pubkey: opponentPubkey,
          displayName: oppState?.displayName ?? "Opponent",
          trophyCount: oppState?.trophyCount ?? 0,
          thLevel: oppState?.thLevel ?? 1,
          buildings: oppState?.buildings ?? [],
        },
        source: "solana_l1",
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ══════════════════════════════════════
  //  BATTLE — server-managed (PER in future)
  // ══════════════════════════════════════

  /**
   * Full on-chain battle:
   * L1: battle_start.initialize_battle → PDA created
   * PER (localnet: L1): battle_action.deploy_ship × N
   * PER (localnet: L1): battle_action.battle_tick
   * L1: battle_settle.settle_battle_result
   */
  app.post("/attack", async (request, reply) => {
    const pubkey = await auth(request, reply);
    if (!pubkey) return;

    const parsed = attackSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request" });

    const keypair = await getKeypair(pubkey);
    if (!keypair) return reply.status(400).send({ error: "Keypair not found" });

    try {
      const defenderPk = new PublicKey(parsed.data.defenderPubkey);

      // Default battle: 3 ships, 60% destruction, 2 stars (for MVP auto-battle)
      const ships = [
        { troopType: 0, targetX: 10, targetY: 10 }, // Knight
        { troopType: 1, targetX: 12, targetY: 8 },  // Mage
        { troopType: 2, targetX: 8, targetY: 12 },   // Barbarian
      ];

      const result = await executeFullBattleOnChain(
        keypair, defenderPk,
        ships,
        60, // destructionPct
        2,  // stars
        100, 80, 50, // loot
        20  // trophyDelta
      );

      // Notify defender
      broadcastToPlayer(parsed.data.defenderPubkey, {
        type: "under_attack",
        battleId: result.battleId.toString(),
        attackerPubkey: pubkey,
      });

      app.log.info({
        pubkey,
        battleId: result.battleId.toString(),
        initSig: result.initSig,
        shipCount: result.shipSigs.length,
      }, "On-chain battle executed");

      return {
        success: true,
        battleId: result.battleId.toString(),
        signatures: {
          init: result.initSig,
          ships: result.shipSigs,
          tick: result.tickSig,
        },
        result: { stars: 2, destructionPct: 60, loot: { gold: 100, wood: 80, ore: 50 } },
        source: "solana_l1",
        note: "Battle executed on L1 (localnet). In production → MagicBlock PER/TEE.",
      };
    } catch (err: any) {
      app.log.error(err, "On-chain battle failed");
      return reply.status(400).send({ error: "On-chain battle failed: " + err.message });
    }
  });
}

// ── WebSocket broadcast ──────────────────────────────────────
const wsClients = new Map<string, Set<any>>();

export function registerWsClient(pubkey: string, socket: any) {
  if (!wsClients.has(pubkey)) wsClients.set(pubkey, new Set());
  wsClients.get(pubkey)!.add(socket);
}

export function unregisterWsClient(pubkey: string, socket: any) {
  wsClients.get(pubkey)?.delete(socket);
}

function broadcastToPlayer(pubkey: string, data: any) {
  const clients = wsClients.get(pubkey);
  if (!clients) return;
  const msg = JSON.stringify(data);
  for (const socket of clients) {
    try { socket.send(msg); } catch {}
  }
}
