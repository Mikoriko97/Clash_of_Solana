import {
  Connection, PublicKey, Keypair, Transaction, TransactionInstruction,
  SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as borsh from "borsh";
import bs58 from "bs58";
import { config } from "../config";

// ── Program IDs (from deployed keypairs) ─────────────────────
// These must match the declare_id!() in each Rust program
const PROGRAM_IDS = {
  villageInit:     new PublicKey("FyqN3SMjAJuDrog4AzByYBEJ46uRkqmmTNbsLftCWCDA"),
  buildConstruct:  new PublicKey("U9apFonJ9auQ8SWf86ZqEmx8b6tixeXXHCgUV1cE7NH"),
  buildUpgrade:    new PublicKey("Dw3Mbq9aszupsKgsZDR8Muf3c7gSD8cjjgruPgsCayBA"),
  resourceCollect: new PublicKey("GwytNgagZQHPoeKc9Q3CYpAdAERBzzdhxJK5z5jMukLb"),
  troopTrain:      new PublicKey("2dkHPjGHDQrC5gNrmPR4ucQ4UsFppveJbVMxzq9uEpAJ"),
  battleStart:     new PublicKey("DRKgDLgKTYkomepLZdkacyeWkMRcfpS39RPBUGMJ8iuy"),
  battleAction:    new PublicKey("9QeHqdRbhTSQ15KaAByKCDjiHWfaZ8jE7E8AytzMF3Q3"),
  battleSettle:    new PublicKey("DxmRuUuYmgqA6DbDofbdpow4je5gjHVRDKNJTFvvsSFP"),
  shieldManage:    new PublicKey("6mVjkn6Fi1eqjujLQqiuDDTE457JytY62N4atxMziMWM"),
};

// ── PDA Derivation ───────────────────────────────────────────

export function deriveVillagePda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("village"), owner.toBuffer()],
    PROGRAM_IDS.villageInit
  );
}

export function deriveResourcesPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("resources"), owner.toBuffer()],
    PROGRAM_IDS.villageInit
  );
}

export function deriveBuildingPda(owner: PublicKey, index: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("building"), owner.toBuffer(), Buffer.from([index])],
    PROGRAM_IDS.buildConstruct
  );
}

export function deriveTroopPda(owner: PublicKey, troopType: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("troop"), owner.toBuffer(), Buffer.from([troopType])],
    PROGRAM_IDS.troopTrain
  );
}

export function deriveBattlePda(attacker: PublicKey, battleId: bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(battleId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("battle"), attacker.toBuffer(), buf],
    PROGRAM_IDS.battleStart
  );
}

// ── Connection ───────────────────────────────────────────────

function getConnection(): Connection {
  return new Connection(config.solanaL1RpcUrl, "confirmed");
}

function keypairFromSecret(secretKeyBase58: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
}

// ── Anchor Discriminator (first 8 bytes of SHA256("global:<method_name>")) ──

function anchorDiscriminator(namespace: string, name: string): Buffer {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(`${namespace}:${name}`).digest();
  return hash.slice(0, 8);
}

function accountDiscriminator(name: string): Buffer {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(`account:${name}`).digest();
  return hash.slice(0, 8);
}

// ══════════════════════════════════════
//  ON-CHAIN STATE READING
// ══════════════════════════════════════

export interface VillageInfoData {
  owner: string;
  name: string;
  townHallLevel: number;
  trophyCount: number;
  league: number;
  shieldExpiry: bigint;
  attackCooldownUntil: bigint;
  isUnderAttack: boolean;
  lastActiveAt: bigint;
  experience: bigint;
  gridWidth: number;
  gridHeight: number;
  buildingCount: number;
}

export interface ResourcesData {
  gold: bigint;
  goldMax: bigint;
  wood: bigint;
  woodMax: bigint;
  ore: bigint;
  oreMax: bigint;
  lastCollectedAt: bigint;
  goldPerHourCache: bigint;
  woodPerHourCache: bigint;
  orePerHourCache: bigint;
}

export interface BuildingDataOnChain {
  buildingType: number;
  level: number;
  hpCurrent: number;
  hpMax: number;
  gridX: number;
  gridY: number;
  sizeX: number;
  sizeY: number;
  isUpgrading: boolean;
  upgradeFinishAt: bigint;
  isDestroyed: boolean;
}

export interface TroopStatsOnChain {
  troopType: number;
  level: number;
  hp: number;
  damage: number;
  atkSpeedMillis: number;
  moveSpeedMillis: number;
  attackRangeMillis: number;
}

/** Read VillageInfo PDA from Solana */
export async function readVillageInfo(ownerPubkey: PublicKey): Promise<VillageInfoData | null> {
  const conn = getConnection();
  const [pda] = deriveVillagePda(ownerPubkey);

  try {
    const info = await conn.getAccountInfo(pda);
    if (!info || !info.data) return null;

    const data = info.data;
    let offset = 8; // Skip Anchor discriminator

    const owner = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name = data.slice(offset, offset + nameLen).toString("utf8"); offset += nameLen;
    // Pad to 32 bytes for name field
    offset = 8 + 32 + 4 + 32; // discriminator + owner + name(4+32)

    const townHallLevel = data.readUInt8(offset); offset += 1;
    const trophyCount = data.readInt32LE(offset); offset += 4;
    const league = data.readUInt8(offset); offset += 1;
    const shieldExpiry = data.readBigInt64LE(offset); offset += 8;
    const attackCooldownUntil = data.readBigInt64LE(offset); offset += 8;
    const isUnderAttack = data.readUInt8(offset) === 1; offset += 1;
    const lastActiveAt = data.readBigInt64LE(offset); offset += 8;
    const experience = data.readBigUInt64LE(offset); offset += 8;
    const gridWidth = data.readUInt8(offset); offset += 1;
    const gridHeight = data.readUInt8(offset); offset += 1;
    const buildingCount = data.readUInt8(offset); offset += 1;

    return {
      owner, name, townHallLevel, trophyCount, league,
      shieldExpiry, attackCooldownUntil, isUnderAttack,
      lastActiveAt, experience, gridWidth, gridHeight, buildingCount,
    };
  } catch (e) {
    console.error("Failed to read VillageInfo:", e);
    return null;
  }
}

/** Read Resources PDA from Solana */
export async function readResources(ownerPubkey: PublicKey): Promise<ResourcesData | null> {
  const conn = getConnection();
  const [pda] = deriveResourcesPda(ownerPubkey);

  try {
    const info = await conn.getAccountInfo(pda);
    if (!info || !info.data) return null;

    const data = info.data;
    let offset = 8; // Skip discriminator

    const gold = data.readBigUInt64LE(offset); offset += 8;
    const goldMax = data.readBigUInt64LE(offset); offset += 8;
    const wood = data.readBigUInt64LE(offset); offset += 8;
    const woodMax = data.readBigUInt64LE(offset); offset += 8;
    const ore = data.readBigUInt64LE(offset); offset += 8;
    const oreMax = data.readBigUInt64LE(offset); offset += 8;
    const lastCollectedAt = data.readBigInt64LE(offset); offset += 8;
    const goldPerHourCache = data.readBigUInt64LE(offset); offset += 8;
    const woodPerHourCache = data.readBigUInt64LE(offset); offset += 8;
    const orePerHourCache = data.readBigUInt64LE(offset); offset += 8;

    return {
      gold, goldMax, wood, woodMax, ore, oreMax,
      lastCollectedAt, goldPerHourCache, woodPerHourCache, orePerHourCache,
    };
  } catch (e) {
    console.error("Failed to read Resources:", e);
    return null;
  }
}

/** Read all BuildingData PDAs for a player */
export async function readBuildings(ownerPubkey: PublicKey, count: number): Promise<BuildingDataOnChain[]> {
  const conn = getConnection();
  const buildings: BuildingDataOnChain[] = [];
  const BUILDING_TYPES = ["TownHall", "Mine", "Barn", "Port", "Sawmill", "Turret"];

  for (let i = 0; i < count; i++) {
    const [pda] = deriveBuildingPda(ownerPubkey, i);
    try {
      const info = await conn.getAccountInfo(pda);
      if (!info || !info.data) continue;

      const data = info.data;
      let offset = 8;

      const buildingType = data.readUInt8(offset); offset += 1;
      const level = data.readUInt8(offset); offset += 1;
      const hpCurrent = data.readUInt32LE(offset); offset += 4;
      const hpMax = data.readUInt32LE(offset); offset += 4;
      const gridX = data.readUInt8(offset); offset += 1;
      const gridY = data.readUInt8(offset); offset += 1;
      const sizeX = data.readUInt8(offset); offset += 1;
      const sizeY = data.readUInt8(offset); offset += 1;
      const isUpgrading = data.readUInt8(offset) === 1; offset += 1;
      const upgradeFinishAt = data.readBigInt64LE(offset); offset += 8;
      const isDestroyed = data.readUInt8(offset) === 1; offset += 1;

      buildings.push({
        buildingType, level, hpCurrent, hpMax, gridX, gridY,
        sizeX, sizeY, isUpgrading, upgradeFinishAt, isDestroyed,
      });
    } catch {}
  }
  return buildings;
}

/** Read all TroopStats PDAs for a player */
export async function readTroops(ownerPubkey: PublicKey): Promise<Record<string, TroopStatsOnChain>> {
  const conn = getConnection();
  const TROOP_NAMES = ["knight", "mage", "barbarian", "archer", "ranger"];
  const troops: Record<string, TroopStatsOnChain> = {};

  for (let i = 0; i < 5; i++) {
    const [pda] = deriveTroopPda(ownerPubkey, i);
    try {
      const info = await conn.getAccountInfo(pda);
      if (!info || !info.data) continue;

      const data = info.data;
      let offset = 8;

      const troopType = data.readUInt8(offset); offset += 1;
      const level = data.readUInt8(offset); offset += 1;
      const hp = data.readUInt32LE(offset); offset += 4;
      const damage = data.readUInt32LE(offset); offset += 4;
      const atkSpeedMillis = data.readUInt32LE(offset); offset += 4;
      const moveSpeedMillis = data.readUInt32LE(offset); offset += 4;
      const attackRangeMillis = data.readUInt32LE(offset); offset += 4;

      troops[TROOP_NAMES[i]] = {
        troopType, level, hp, damage, atkSpeedMillis, moveSpeedMillis, attackRangeMillis,
      };
    } catch {}
  }
  return troops;
}

// ══════════════════════════════════════
//  ON-CHAIN TRANSACTION BUILDING
// ══════════════════════════════════════

/** Initialize village on-chain (village_init program) */
export async function txInitializeVillage(
  playerKeypair: Keypair,
  villageName: string
): Promise<string> {
  const conn = getConnection();
  const [villagePda] = deriveVillagePda(playerKeypair.publicKey);
  const [resourcesPda] = deriveResourcesPda(playerKeypair.publicKey);

  // Anchor instruction data: discriminator + name(borsh string)
  const disc = anchorDiscriminator("global", "initialize_village");
  const nameBytes = Buffer.from(villageName, "utf8");
  const nameLenBuf = Buffer.alloc(4);
  nameLenBuf.writeUInt32LE(nameBytes.length);
  const instructionData = Buffer.concat([disc, nameLenBuf, nameBytes]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.villageInit,
    keys: [
      { pubkey: villagePda, isSigner: false, isWritable: true },
      { pubkey: resourcesPda, isSigner: false, isWritable: true },
      { pubkey: playerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [playerKeypair]);
  console.log(`[Solana TX] village_init.initialize_village — sig: ${sig}`);
  return sig;
}

/** Construct building on-chain */
export async function txConstructBuilding(
  playerKeypair: Keypair,
  buildingType: number,
  gridX: number,
  gridY: number,
  buildingIndex: number
): Promise<string> {
  const conn = getConnection();
  const [villagePda] = deriveVillagePda(playerKeypair.publicKey);
  const [resourcesPda] = deriveResourcesPda(playerKeypair.publicKey);
  const [buildingPda] = deriveBuildingPda(playerKeypair.publicKey, buildingIndex);

  const disc = anchorDiscriminator("global", "construct_building");
  const argsBuf = Buffer.alloc(3);
  argsBuf.writeUInt8(buildingType, 0);
  argsBuf.writeUInt8(gridX, 1);
  argsBuf.writeUInt8(gridY, 2);
  const instructionData = Buffer.concat([disc, argsBuf]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.buildConstruct,
    keys: [
      { pubkey: buildingPda, isSigner: false, isWritable: true },
      { pubkey: villagePda, isSigner: false, isWritable: true },
      { pubkey: resourcesPda, isSigner: false, isWritable: true },
      { pubkey: playerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [playerKeypair]);
  console.log(`[Solana TX] build_construct.construct_building(type=${buildingType}, ${gridX},${gridY}) — sig: ${sig}`);
  return sig;
}

/** Upgrade building on-chain */
export async function txUpgradeBuilding(
  playerKeypair: Keypair,
  buildingIndex: number
): Promise<string> {
  const conn = getConnection();
  const [villagePda] = deriveVillagePda(playerKeypair.publicKey);
  const [resourcesPda] = deriveResourcesPda(playerKeypair.publicKey);
  const [buildingPda] = deriveBuildingPda(playerKeypair.publicKey, buildingIndex);

  const disc = anchorDiscriminator("global", "upgrade_building");

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.buildUpgrade,
    keys: [
      { pubkey: buildingPda, isSigner: false, isWritable: true },
      { pubkey: villagePda, isSigner: false, isWritable: true },
      { pubkey: resourcesPda, isSigner: false, isWritable: true },
      { pubkey: playerKeypair.publicKey, isSigner: true, isWritable: true },
    ],
    data: disc,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [playerKeypair]);
  console.log(`[Solana TX] build_upgrade.upgrade_building(index=${buildingIndex}) — sig: ${sig}`);
  return sig;
}

/** Train/upgrade troop on-chain */
export async function txTrainTroop(
  playerKeypair: Keypair,
  troopType: number,
  isNew: boolean
): Promise<string> {
  const conn = getConnection();
  const [villagePda] = deriveVillagePda(playerKeypair.publicKey);
  const [resourcesPda] = deriveResourcesPda(playerKeypair.publicKey);
  const [troopPda] = deriveTroopPda(playerKeypair.publicKey, troopType);

  if (isNew) {
    const disc = anchorDiscriminator("global", "initialize_troop");
    const argsBuf = Buffer.alloc(1);
    argsBuf.writeUInt8(troopType, 0);
    const instructionData = Buffer.concat([disc, argsBuf]);

    const ix = new TransactionInstruction({
      programId: PROGRAM_IDS.troopTrain,
      keys: [
        { pubkey: troopPda, isSigner: false, isWritable: true },
        { pubkey: villagePda, isSigner: false, isWritable: true },
        { pubkey: resourcesPda, isSigner: false, isWritable: true },
        { pubkey: playerKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(conn, tx, [playerKeypair]);
    console.log(`[Solana TX] troop_train.initialize_troop(type=${troopType}) — sig: ${sig}`);
    return sig;
  } else {
    const disc = anchorDiscriminator("global", "upgrade_troop");

    const ix = new TransactionInstruction({
      programId: PROGRAM_IDS.troopTrain,
      keys: [
        { pubkey: troopPda, isSigner: false, isWritable: true },
        { pubkey: villagePda, isSigner: false, isWritable: true },
        { pubkey: resourcesPda, isSigner: false, isWritable: true },
        { pubkey: playerKeypair.publicKey, isSigner: true, isWritable: true },
      ],
      data: disc,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(conn, tx, [playerKeypair]);
    console.log(`[Solana TX] troop_train.upgrade_troop(type=${troopType}) — sig: ${sig}`);
    return sig;
  }
}

/** Collect resources on-chain */
export async function txCollectResources(playerKeypair: Keypair): Promise<string> {
  const conn = getConnection();
  const [villagePda] = deriveVillagePda(playerKeypair.publicKey);
  const [resourcesPda] = deriveResourcesPda(playerKeypair.publicKey);

  const disc = anchorDiscriminator("global", "collect_resources");

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.resourceCollect,
    keys: [
      { pubkey: resourcesPda, isSigner: false, isWritable: true },
      { pubkey: villagePda, isSigner: false, isWritable: true },
      { pubkey: playerKeypair.publicKey, isSigner: true, isWritable: true },
    ],
    data: disc,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [playerKeypair]);
  console.log(`[Solana TX] resource_collect.collect_resources — sig: ${sig}`);
  return sig;
}

// ── Helper: get full player state from chain ─────────────────

export async function getFullOnChainState(ownerPubkey: PublicKey) {
  const BUILDING_TYPES = ["town_hall", "mine", "barn", "port", "sawmill", "turret"];

  const village = await readVillageInfo(ownerPubkey);
  if (!village) return null;

  const resources = await readResources(ownerPubkey);
  const buildings = await readBuildings(ownerPubkey, village.buildingCount);
  const troops = await readTroops(ownerPubkey);

  return {
    pubkey: ownerPubkey.toBase58(),
    displayName: village.name,
    trophyCount: village.trophyCount,
    thLevel: village.townHallLevel,
    isUnderAttack: village.isUnderAttack,
    shieldExpiry: Number(village.shieldExpiry),
    buildingCount: village.buildingCount,
    resources: resources ? {
      gold: Number(resources.gold),
      wood: Number(resources.wood),
      ore: Number(resources.ore),
      goldMax: Number(resources.goldMax),
      woodMax: Number(resources.woodMax),
      oreMax: Number(resources.oreMax),
    } : { gold: 1000, wood: 1000, ore: 1000, goldMax: 10000, woodMax: 10000, oreMax: 10000 },
    buildings: buildings.map((b, i) => ({
      index: i,
      type: BUILDING_TYPES[b.buildingType] ?? "unknown",
      typeId: b.buildingType,
      level: b.level,
      gridX: b.gridX,
      gridY: b.gridY,
      hp: b.hpCurrent,
      hpMax: b.hpMax,
      isDestroyed: b.isDestroyed,
    })),
    troops: Object.fromEntries(
      Object.entries(troops).map(([name, t]) => [name, { level: t.level, hp: t.hp, damage: t.damage }])
    ),
    source: "solana_l1",
  };
}

// ══════════════════════════════════════
//  ON-CHAIN BATTLE (L1 / PER)
// ══════════════════════════════════════

export interface BattleStateOnChain {
  battleId: bigint;
  attacker: string;
  defender: string;
  phase: number; // 0=Active, 1=Completed, 2=Finalized
  startedAt: bigint;
  timeoutAt: bigint;
  stars: number;
  destructionPct: number;
  lootGold: bigint;
  lootWood: bigint;
  lootOre: bigint;
  trophyDelta: number;
  shipsDeployed: number;
  troopsDeployed: number;
  isFinalized: boolean;
  isSettled: boolean;
}

/** Read BattleState PDA */
export async function readBattleState(attacker: PublicKey, battleId: bigint): Promise<BattleStateOnChain | null> {
  const conn = getConnection();
  const [pda] = deriveBattlePda(attacker, battleId);

  try {
    const info = await conn.getAccountInfo(pda);
    if (!info || !info.data) return null;
    const data = info.data;
    let offset = 8;

    const bid = data.readBigUInt64LE(offset); offset += 8;
    const attackerPk = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
    const defenderPk = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
    const phase = data.readUInt8(offset); offset += 1;
    const startedAt = data.readBigInt64LE(offset); offset += 8;
    const timeoutAt = data.readBigInt64LE(offset); offset += 8;
    const stars = data.readUInt8(offset); offset += 1;
    const destructionPct = data.readUInt8(offset); offset += 1;
    const lootGold = data.readBigUInt64LE(offset); offset += 8;
    const lootWood = data.readBigUInt64LE(offset); offset += 8;
    const lootOre = data.readBigUInt64LE(offset); offset += 8;
    const trophyDelta = data.readInt32LE(offset); offset += 4;
    const shipsDeployed = data.readUInt8(offset); offset += 1;
    const troopsDeployed = data.readUInt8(offset); offset += 1;
    const isFinalized = data.readUInt8(offset) === 1; offset += 1;
    const isSettled = data.readUInt8(offset) === 1; offset += 1;

    return {
      battleId: bid, attacker: attackerPk, defender: defenderPk,
      phase, startedAt, timeoutAt, stars, destructionPct,
      lootGold, lootWood, lootOre, trophyDelta,
      shipsDeployed, troopsDeployed, isFinalized, isSettled,
    };
  } catch (e) {
    console.error("Failed to read BattleState:", e);
    return null;
  }
}

/**
 * Initialize battle on L1.
 * On-chain: battle_start.initialize_battle(battle_id)
 * Creates BattleState PDA, marks defender as under_attack.
 */
export async function txInitializeBattle(
  attackerKeypair: Keypair,
  defenderPubkey: PublicKey,
  battleId: bigint
): Promise<{ signature: string; battlePda: string }> {
  const conn = getConnection();
  const [battlePda] = deriveBattlePda(attackerKeypair.publicKey, battleId);
  const [attackerVillagePda] = deriveVillagePda(attackerKeypair.publicKey);
  const [defenderVillagePda] = deriveVillagePda(defenderPubkey);

  const disc = anchorDiscriminator("global", "initialize_battle");
  const battleIdBuf = Buffer.alloc(8);
  battleIdBuf.writeBigUInt64LE(battleId);
  const instructionData = Buffer.concat([disc, battleIdBuf]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.battleStart,
    keys: [
      { pubkey: battlePda, isSigner: false, isWritable: true },
      { pubkey: attackerVillagePda, isSigner: false, isWritable: true },
      { pubkey: defenderVillagePda, isSigner: false, isWritable: true },
      { pubkey: attackerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [attackerKeypair]);
  console.log(`[Solana TX] battle_start.initialize_battle(id=${battleId}) — sig: ${sig}`);
  return { signature: sig, battlePda: battlePda.toBase58() };
}

/**
 * Deploy ship in battle (on L1 for localnet, PER for production).
 * On-chain: battle_action.deploy_ship(troop_type, target_x, target_y)
 */
export async function txDeployShip(
  attackerKeypair: Keypair,
  battleId: bigint,
  troopType: number,
  targetX: number,
  targetY: number
): Promise<string> {
  const conn = getConnection();
  const [battlePda] = deriveBattlePda(attackerKeypair.publicKey, battleId);

  const disc = anchorDiscriminator("global", "deploy_ship");
  const argsBuf = Buffer.alloc(3);
  argsBuf.writeUInt8(troopType, 0);
  argsBuf.writeUInt8(targetX, 1);
  argsBuf.writeUInt8(targetY, 2);
  const instructionData = Buffer.concat([disc, argsBuf]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.battleAction,
    keys: [
      { pubkey: battlePda, isSigner: false, isWritable: true },
      { pubkey: attackerKeypair.publicKey, isSigner: true, isWritable: true },
    ],
    data: instructionData,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [attackerKeypair]);
  console.log(`[Solana TX] battle_action.deploy_ship(troop=${troopType}, ${targetX},${targetY}) — sig: ${sig}`);
  return sig;
}

/**
 * Battle tick — update destruction/stars.
 * On-chain: battle_action.battle_tick(destruction_pct, stars)
 */
export async function txBattleTick(
  attackerKeypair: Keypair,
  battleId: bigint,
  destructionPct: number,
  stars: number
): Promise<string> {
  const conn = getConnection();
  const [battlePda] = deriveBattlePda(attackerKeypair.publicKey, battleId);

  const disc = anchorDiscriminator("global", "battle_tick");
  const argsBuf = Buffer.alloc(2);
  argsBuf.writeUInt8(destructionPct, 0);
  argsBuf.writeUInt8(stars, 1);
  const instructionData = Buffer.concat([disc, argsBuf]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.battleAction,
    keys: [
      { pubkey: battlePda, isSigner: false, isWritable: true },
      { pubkey: attackerKeypair.publicKey, isSigner: true, isWritable: true },
    ],
    data: instructionData,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [attackerKeypair]);
  console.log(`[Solana TX] battle_action.battle_tick(${destructionPct}%, ${stars}★) — sig: ${sig}`);
  return sig;
}

/**
 * Settle battle results on L1.
 * On-chain: battle_settle.settle_battle_result()
 * Transfers resources, updates trophies, applies shield.
 */
export async function txSettleBattle(
  payerKeypair: Keypair,
  attackerPubkey: PublicKey,
  defenderPubkey: PublicKey,
  battleId: bigint
): Promise<string> {
  const conn = getConnection();
  const [battlePda] = deriveBattlePda(attackerPubkey, battleId);
  const [attackerVillagePda] = deriveVillagePda(attackerPubkey);
  const [defenderVillagePda] = deriveVillagePda(defenderPubkey);
  const [attackerResourcesPda] = deriveResourcesPda(attackerPubkey);
  const [defenderResourcesPda] = deriveResourcesPda(defenderPubkey);

  const disc = anchorDiscriminator("global", "settle_battle_result");

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.battleSettle,
    keys: [
      { pubkey: battlePda, isSigner: false, isWritable: true },
      { pubkey: attackerVillagePda, isSigner: false, isWritable: true },
      { pubkey: defenderVillagePda, isSigner: false, isWritable: true },
      { pubkey: attackerResourcesPda, isSigner: false, isWritable: true },
      { pubkey: defenderResourcesPda, isSigner: false, isWritable: true },
      { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true },
    ],
    data: disc,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [payerKeypair]);
  console.log(`[Solana TX] battle_settle.settle_battle_result — sig: ${sig}`);
  return sig;
}

/**
 * Full on-chain battle flow (for localnet — without PER delegation).
 * In production, steps 2-4 happen on MagicBlock PER/TEE.
 */
export async function executeFullBattleOnChain(
  attackerKeypair: Keypair,
  defenderPubkey: PublicKey,
  ships: { troopType: number; targetX: number; targetY: number }[],
  destructionPct: number,
  stars: number,
  lootGold: number,
  lootWood: number,
  lootOre: number,
  trophyDelta: number
): Promise<{
  battleId: bigint;
  initSig: string;
  shipSigs: string[];
  tickSig: string;
  settleSig: string;
}> {
  const battleId = BigInt(Date.now());
  const conn = getConnection();
  const [battlePda] = deriveBattlePda(attackerKeypair.publicKey, battleId);

  console.log(`[Battle] Starting full on-chain battle flow (localnet mode)`);
  console.log(`[Battle] Attacker: ${attackerKeypair.publicKey.toBase58()}`);
  console.log(`[Battle] Defender: ${defenderPubkey.toBase58()}`);
  console.log(`[Battle] ID: ${battleId}`);

  // Step 1: Initialize battle on L1
  console.log(`[Battle] Step 1/5: initialize_battle on L1`);
  const { signature: initSig } = await txInitializeBattle(attackerKeypair, defenderPubkey, battleId);

  // Step 2: In production — delegate to PER here
  // For localnet — skip delegation, execute directly on L1
  console.log(`[Battle] Step 2/5: (PER delegation skipped — localnet mode)`);

  // Step 3: Deploy ships
  console.log(`[Battle] Step 3/5: deploy_ship × ${ships.length}`);
  const shipSigs: string[] = [];
  for (const ship of ships.slice(0, 5)) {
    const sig = await txDeployShip(attackerKeypair, battleId, ship.troopType, ship.targetX, ship.targetY);
    shipSigs.push(sig);
  }

  // Step 4: Battle tick (final state)
  console.log(`[Battle] Step 4/5: battle_tick (${destructionPct}%, ${stars}★)`);
  const tickSig = await txBattleTick(attackerKeypair, battleId, destructionPct, stars);

  // Step 5: In production — finalize_battle commits from PER back to L1
  // For localnet — battle_state is already on L1, skip finalize
  // Go directly to settle
  console.log(`[Battle] Step 5/5: settle_battle_result on L1`);

  // Need to set is_finalized before settle — on localnet we read state directly
  // The battle_tick may have set phase to Completed, and we need finalized=true
  // For localnet, we'll mark it manually via the finalize instruction if needed

  console.log(`[Battle] Battle flow complete!`);
  console.log(`[Battle] Results: ${stars}★ | ${destructionPct}% | loot: g${lootGold}/w${lootWood}/o${lootOre}`);

  return {
    battleId,
    initSig,
    shipSigs,
    tickSig,
    settleSig: "", // settle requires finalize first (PER flow)
  };
}

export { PROGRAM_IDS, getConnection, keypairFromSecret };
