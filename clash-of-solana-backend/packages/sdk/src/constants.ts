// ── Офіційні Program IDs MagicBlock (незмінні) ─────────────────
export const MAGICBLOCK_PROGRAMS = {
  DELEGATION: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
  PERMISSION: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1",
} as const;

// ── ER endpoints (без авторизації) ────────────────────────────
export const ER_ENDPOINTS = {
  devnet: {
    eu: "https://devnet-eu.magicblock.app",
    us: "https://devnet-us.magicblock.app",
    as: "https://devnet-as.magicblock.app",
  },
  mainnet: {
    eu: "https://eu.magicblock.app",
    us: "https://us.magicblock.app",
    as: "https://as.magicblock.app",
  },
  localnet: "http://localhost:7799",
} as const;

// ── PER endpoints (TEE, потребує authToken) ───────────────────
export const PER_ENDPOINTS = {
  devnet: "https://tee.magicblock.app",
  mainnet: "https://mainnet-tee.magicblock.app",
  localnet: null, // TEE недоступний локально
} as const;

// ── Validator Pubkeys (передаються в DelegateConfig) ──────────
export const VALIDATORS = {
  devnet: {
    eu: "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e",
    us: "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
    as: "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
    tee: "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA", // PER
  },
  mainnet: {
    eu: "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e",
    us: "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
    as: "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
    tee: "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo", // PER
  },
  localnet: {
    er: "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev",
  },
} as const;

// ── Costs ──────────────────────────────────────────────────────
export const ER_COSTS = {
  TX_FEE_SOL: 0, // gasless в ER
  SESSION_FEE_SOL: 0.0003, // при undelegation
  COMMIT_FEE_SOL: 0.0001, // за кожен commit на L1
} as const;

// ── Game Constants (з Godot сканування) ──────────────────────
export const GAME_CONSTANTS = {
  GRID_WIDTH: 27,
  GRID_HEIGHT: 27,
  MAX_SHIPS_PER_BATTLE: 5,
  TROOPS_PER_SHIP: 3,
  MAX_TROOPS_PER_BATTLE: 15,
  BATTLE_MAX_DURATION_SECS: 180,
  ATTACK_COOLDOWN_SECS: 300,
  MAX_BUILDING_LEVEL: 3,
  MAX_TROOP_LEVEL: 3,
  STARTING_GOLD: 1000,
  STARTING_WOOD: 1000,
  STARTING_ORE: 1000,
} as const;

// ── Building Types (з Godot building_system.gd) ──────────────
export enum BuildingType {
  TownHall = 0,
  Mine = 1,
  Barn = 2,
  Port = 3,
  Sawmill = 4,  // also acts as Barracks
  Turret = 5,
}

// ── Troop Types (з Godot SHIP_TROOPS + troop_defs) ───────────
export enum TroopType {
  Knight = 0,     // Tank, Melee
  Mage = 1,       // Burst, Ranged
  Barbarian = 2,  // Fast Brawler, Melee
  Archer = 3,     // Sniper, Ranged
  Ranger = 4,     // Balanced DPS, Ranged
}

// ── SDK версії ───────────────────────────────────────────────
export const REQUIRED_VERSIONS = {
  EPHEMERAL_SDK: ">=0.8.0",
  ANCHOR: "0.32.1",
  SOLANA: "2.3.13",
  RUST: "1.85.0",
  NODE: "24.10.0",
} as const;
