import { query } from "../db";

// ── Building definitions (from Godot) ─────────────────────────
const BUILDING_DEFS: Record<string, {
  cost: Record<string, number>;
  hp: number[];
  size: [number, number];
  maxCount?: number;
  goldPerHour?: number;
  woodPerHour?: number;
  orePerHour?: number;
}> = {
  town_hall: { cost: {}, hp: [3500, 6000, 10000], size: [4, 4], maxCount: 1 },
  mine:      { cost: { gold: 400, wood: 150 }, hp: [1200, 2200, 3800], size: [3, 3], goldPerHour: 50, orePerHour: 30 },
  barn:      { cost: { gold: 200, wood: 200, ore: 100 }, hp: [2000, 3500, 6000], size: [2, 3] },
  port:      { cost: { gold: 800, wood: 300, ore: 200 }, hp: [1800, 3200, 5500], size: [3, 3] },
  sawmill:   { cost: { gold: 300 }, hp: [1200, 2200, 3800], size: [3, 3], woodPerHour: 50 },
  turret:    { cost: { gold: 600, wood: 350, ore: 200 }, hp: [900, 1600, 2800], size: [2, 2] },
};

// ── Troop definitions (from Godot) ─────────────────────────────
const TROOP_DEFS: Record<string, {
  costs: Record<number, Record<string, number>>;
  stats: Record<number, { hp: number; damage: number }>;
}> = {
  knight:    { costs: { 1: { gold: 150, ore: 80 }, 2: { gold: 400, ore: 250 }, 3: { gold: 900, ore: 600 } }, stats: { 1: { hp: 1100, damage: 75 }, 2: { hp: 1450, damage: 100 }, 3: { hp: 1850, damage: 130 } } },
  mage:      { costs: { 1: { gold: 250, ore: 150 }, 2: { gold: 600, ore: 400 }, 3: { gold: 1400, ore: 900 } }, stats: { 1: { hp: 420, damage: 185 }, 2: { hp: 560, damage: 245 }, 3: { hp: 720, damage: 320 } } },
  barbarian: { costs: { 1: { gold: 200, ore: 120 }, 2: { gold: 500, ore: 350 }, 3: { gold: 1100, ore: 750 } }, stats: { 1: { hp: 520, damage: 90 }, 2: { hp: 690, damage: 120 }, 3: { hp: 880, damage: 158 } } },
  archer:    { costs: { 1: { gold: 180, wood: 100 }, 2: { gold: 450, wood: 300 }, 3: { gold: 1000, wood: 700 } }, stats: { 1: { hp: 580, damage: 130 }, 2: { hp: 760, damage: 175 }, 3: { hp: 970, damage: 228 } } },
  ranger:    { costs: { 1: { gold: 120, wood: 60 }, 2: { gold: 350, wood: 200 }, 3: { gold: 800, wood: 500 } }, stats: { 1: { hp: 680, damage: 110 }, 2: { hp: 900, damage: 148 }, 3: { hp: 1150, damage: 192 } } },
};

// ══════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════

export async function initializePlayer(pubkey: string, secretKey: string, displayName = "Player") {
  await query(
    `INSERT INTO players (pubkey, secret_key, display_name, last_active)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (pubkey) DO UPDATE SET last_active = NOW()`,
    [pubkey, secretKey, displayName]
  );
  await query(
    `INSERT INTO player_resources (player_pubkey) VALUES ($1) ON CONFLICT DO NOTHING`,
    [pubkey]
  );
  await query(
    `INSERT INTO matchmaking_pool (player_pubkey, trophy_count, th_level) VALUES ($1, 0, 1)
     ON CONFLICT (player_pubkey) DO UPDATE SET last_active = NOW()`,
    [pubkey]
  );
}

export async function getPlayerState(pubkey: string) {
  const player = await query(`SELECT * FROM players WHERE pubkey = $1`, [pubkey]);
  if (player.rows.length === 0) return null;

  const resources = await query(`SELECT * FROM player_resources WHERE player_pubkey = $1`, [pubkey]);
  const buildings = await query(`SELECT * FROM buildings WHERE player_pubkey = $1 ORDER BY id`, [pubkey]);
  const troops = await query(`SELECT * FROM troops WHERE player_pubkey = $1`, [pubkey]);

  // Collect passive resources
  if (resources.rows.length > 0) {
    const res = resources.rows[0];
    const elapsed = (Date.now() - new Date(res.last_collected).getTime()) / 1000;
    if (elapsed > 60) {
      const goldGain = Math.floor((res.gold_per_hour * elapsed) / 3600);
      const woodGain = Math.floor((res.wood_per_hour * elapsed) / 3600);
      const oreGain = Math.floor((res.ore_per_hour * elapsed) / 3600);
      const newGold = Math.min(Number(res.gold) + goldGain, Number(res.gold_max));
      const newWood = Math.min(Number(res.wood) + woodGain, Number(res.wood_max));
      const newOre = Math.min(Number(res.ore) + oreGain, Number(res.ore_max));
      await query(
        `UPDATE player_resources SET gold=$1, wood=$2, ore=$3, last_collected=NOW() WHERE player_pubkey=$4`,
        [newGold, newWood, newOre, pubkey]
      );
      res.gold = newGold;
      res.wood = newWood;
      res.ore = newOre;
    }
  }

  return {
    pubkey: player.rows[0].pubkey,
    displayName: player.rows[0].display_name,
    trophyCount: player.rows[0].trophy_count,
    thLevel: player.rows[0].th_level,
    isUnderAttack: player.rows[0].is_under_attack,
    shieldExpiry: player.rows[0].shield_expiry,
    resources: resources.rows[0] ? {
      gold: Number(resources.rows[0].gold),
      wood: Number(resources.rows[0].wood),
      ore: Number(resources.rows[0].ore),
      goldMax: Number(resources.rows[0].gold_max),
      woodMax: Number(resources.rows[0].wood_max),
      oreMax: Number(resources.rows[0].ore_max),
    } : { gold: 1000, wood: 1000, ore: 1000, goldMax: 10000, woodMax: 10000, oreMax: 10000 },
    buildings: buildings.rows.map((b: any) => ({
      id: b.id,
      type: b.building_type,
      level: b.level,
      gridX: b.grid_x,
      gridY: b.grid_y,
      hp: b.hp_current,
      hpMax: b.hp_max,
      isDestroyed: b.is_destroyed,
    })),
    troops: troops.rows.reduce((acc: any, t: any) => {
      acc[t.troop_type] = { level: t.level };
      return acc;
    }, {}),
  };
}

// ══════════════════════════════════════
//  BUILDINGS
// ══════════════════════════════════════

export async function constructBuilding(pubkey: string, buildingType: string, gridX: number, gridY: number) {
  const def = BUILDING_DEFS[buildingType];
  if (!def) throw new Error(`Unknown building type: ${buildingType}`);

  // Check max count
  if (def.maxCount) {
    const count = await query(
      `SELECT COUNT(*) as cnt FROM buildings WHERE player_pubkey=$1 AND building_type=$2`,
      [pubkey, buildingType]
    );
    if (Number(count.rows[0].cnt) >= def.maxCount) throw new Error(`Max ${buildingType} limit reached`);
  }

  // Check grid bounds
  if (gridX + def.size[0] > 27 || gridY + def.size[1] > 27 || gridX < 0 || gridY < 0)
    throw new Error("Building outside grid bounds");

  // Check collision
  const collision = await query(
    `SELECT id FROM buildings WHERE player_pubkey=$1
     AND grid_x < $2 + $4 AND grid_x + $4 > $2
     AND grid_y < $3 + $5 AND grid_y + $5 > $3 LIMIT 1`,
    [pubkey, gridX, gridY, def.size[0], def.size[1]]
  );
  if (collision.rows.length > 0) throw new Error("Position occupied");

  // Check and deduct resources
  const res = await query(`SELECT * FROM player_resources WHERE player_pubkey=$1`, [pubkey]);
  if (res.rows.length === 0) throw new Error("Player resources not found");
  const r = res.rows[0];

  for (const [resource, amount] of Object.entries(def.cost)) {
    if (Number(r[resource]) < amount) throw new Error(`Not enough ${resource}: need ${amount}, have ${r[resource]}`);
  }

  const newGold = Number(r.gold) - (def.cost.gold || 0);
  const newWood = Number(r.wood) - (def.cost.wood || 0);
  const newOre = Number(r.ore) - (def.cost.ore || 0);

  await query(`UPDATE player_resources SET gold=$1, wood=$2, ore=$3 WHERE player_pubkey=$4`,
    [newGold, newWood, newOre, pubkey]);

  const hp = def.hp[0];
  await query(
    `INSERT INTO buildings (player_pubkey, building_type, level, grid_x, grid_y, hp_current, hp_max)
     VALUES ($1, $2, 1, $3, $4, $5, $5)`,
    [pubkey, buildingType, gridX, gridY, hp]
  );

  // Update production rates
  await recalculateProduction(pubkey);

  return { success: true, type: buildingType, gridX, gridY, level: 1, hp, cost: def.cost };
}

export async function upgradeBuilding(pubkey: string, buildingId: number) {
  const bld = await query(`SELECT * FROM buildings WHERE id=$1 AND player_pubkey=$2`, [buildingId, pubkey]);
  if (bld.rows.length === 0) throw new Error("Building not found");

  const b = bld.rows[0];
  const def = BUILDING_DEFS[b.building_type];
  if (!def) throw new Error("Unknown building type");
  if (b.level >= 3) throw new Error("Already max level");

  const newLevel = b.level + 1;
  const multiplier = newLevel;

  // Check and deduct resources
  const res = await query(`SELECT * FROM player_resources WHERE player_pubkey=$1`, [pubkey]);
  const r = res.rows[0];

  for (const [resource, amount] of Object.entries(def.cost)) {
    const needed = amount * multiplier;
    if (Number(r[resource]) < needed) throw new Error(`Not enough ${resource}`);
  }

  const newGold = Number(r.gold) - (def.cost.gold || 0) * multiplier;
  const newWood = Number(r.wood) - (def.cost.wood || 0) * multiplier;
  const newOre = Number(r.ore) - (def.cost.ore || 0) * multiplier;

  await query(`UPDATE player_resources SET gold=$1, wood=$2, ore=$3 WHERE player_pubkey=$4`,
    [newGold, newWood, newOre, pubkey]);

  const newHp = def.hp[newLevel - 1];
  await query(`UPDATE buildings SET level=$1, hp_current=$2, hp_max=$2 WHERE id=$3`,
    [newLevel, newHp, buildingId]);

  // Update TH level if town_hall
  if (b.building_type === "town_hall") {
    await query(`UPDATE players SET th_level=$1 WHERE pubkey=$2`, [newLevel, pubkey]);
    await query(`UPDATE matchmaking_pool SET th_level=$1 WHERE player_pubkey=$2`, [newLevel, pubkey]);
  }

  await recalculateProduction(pubkey);

  return { success: true, buildingId, newLevel, newHp };
}

async function recalculateProduction(pubkey: string) {
  const buildings = await query(`SELECT building_type, level FROM buildings WHERE player_pubkey=$1`, [pubkey]);
  let goldPerHour = 0, woodPerHour = 0, orePerHour = 0;
  for (const b of buildings.rows) {
    const def = BUILDING_DEFS[b.building_type];
    if (def) {
      const multiplier = b.level;
      goldPerHour += (def.goldPerHour || 0) * multiplier;
      woodPerHour += (def.woodPerHour || 0) * multiplier;
      orePerHour += (def.orePerHour || 0) * multiplier;
    }
  }
  await query(`UPDATE player_resources SET gold_per_hour=$1, wood_per_hour=$2, ore_per_hour=$3 WHERE player_pubkey=$4`,
    [goldPerHour, woodPerHour, orePerHour, pubkey]);
}

// ══════════════════════════════════════
//  TROOPS
// ══════════════════════════════════════

export async function trainTroop(pubkey: string, troopType: string) {
  const def = TROOP_DEFS[troopType.toLowerCase()];
  if (!def) throw new Error(`Unknown troop: ${troopType}`);

  const existing = await query(`SELECT * FROM troops WHERE player_pubkey=$1 AND troop_type=$2`, [pubkey, troopType.toLowerCase()]);
  const currentLevel = existing.rows.length > 0 ? existing.rows[0].level : 0;
  const newLevel = currentLevel + 1;

  if (newLevel > 3) throw new Error("Already max level");

  const cost = def.costs[newLevel];
  const res = await query(`SELECT * FROM player_resources WHERE player_pubkey=$1`, [pubkey]);
  const r = res.rows[0];

  for (const [resource, amount] of Object.entries(cost)) {
    if (Number(r[resource]) < amount) throw new Error(`Not enough ${resource}`);
  }

  const newGold = Number(r.gold) - (cost.gold || 0);
  const newWood = Number(r.wood) - (cost.wood || 0);
  const newOre = Number(r.ore) - (cost.ore || 0);

  await query(`UPDATE player_resources SET gold=$1, wood=$2, ore=$3 WHERE player_pubkey=$4`,
    [newGold, newWood, newOre, pubkey]);

  if (currentLevel === 0) {
    await query(`INSERT INTO troops (player_pubkey, troop_type, level) VALUES ($1, $2, $3)`,
      [pubkey, troopType.toLowerCase(), newLevel]);
  } else {
    await query(`UPDATE troops SET level=$1 WHERE player_pubkey=$2 AND troop_type=$3`,
      [newLevel, pubkey, troopType.toLowerCase()]);
  }

  return { success: true, troopType, newLevel, stats: def.stats[newLevel] };
}

// ══════════════════════════════════════
//  BATTLE
// ══════════════════════════════════════

export async function startBattle(attackerPubkey: string, defenderPubkey: string) {
  // Validate attacker can fight
  const attacker = await query(`SELECT * FROM players WHERE pubkey=$1`, [attackerPubkey]);
  const defender = await query(`SELECT * FROM players WHERE pubkey=$1`, [defenderPubkey]);

  if (attacker.rows.length === 0 || defender.rows.length === 0) throw new Error("Player not found");

  const atk = attacker.rows[0];
  const def2 = defender.rows[0];

  if (atk.is_under_attack) throw new Error("You are under attack");
  if (atk.attack_cooldown && new Date(atk.attack_cooldown) > new Date()) throw new Error("Attack on cooldown");
  if (def2.is_under_attack) throw new Error("Defender already under attack");
  if (def2.shield_expiry && new Date(def2.shield_expiry) > new Date()) throw new Error("Defender has shield");

  // Mark defender under attack
  await query(`UPDATE players SET is_under_attack=true WHERE pubkey=$1`, [defenderPubkey]);
  await query(`UPDATE matchmaking_pool SET is_available=false WHERE player_pubkey=$1`, [defenderPubkey]);

  // Get defender buildings for battle
  const defBuildings = await query(
    `SELECT * FROM buildings WHERE player_pubkey=$1 AND NOT is_destroyed ORDER BY id`,
    [defenderPubkey]
  );

  // Get attacker troops
  const atkTroops = await query(`SELECT * FROM troops WHERE player_pubkey=$1`, [attackerPubkey]);

  const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

  await query(
    `INSERT INTO active_battles (id, attacker_pubkey, defender_pubkey, status, timeout_at)
     VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '180 seconds')`,
    [battleId, attackerPubkey, defenderPubkey]
  );

  return {
    battleId,
    attackerPubkey,
    defenderPubkey,
    defenderBuildings: defBuildings.rows.map((b: any) => ({
      id: b.id, type: b.building_type, level: b.level,
      gridX: b.grid_x, gridY: b.grid_y, hp: b.hp_current, hpMax: b.hp_max,
    })),
    attackerTroops: atkTroops.rows.reduce((acc: any, t: any) => {
      acc[t.troop_type] = { level: t.level };
      return acc;
    }, {}),
    maxShips: 5,
    troopsPerShip: 3,
    maxDuration: 180,
  };
}

export async function settleBattle(
  battleId: string,
  stars: number,
  destructionPct: number,
  shipsDeployed: number
) {
  const battle = await query(`SELECT * FROM active_battles WHERE id=$1 AND status='active'`, [battleId]);
  if (battle.rows.length === 0) throw new Error("Battle not found or already finished");

  const b = battle.rows[0];
  const attackerPubkey = b.attacker_pubkey;
  const defenderPubkey = b.defender_pubkey;

  // Calculate loot based on destruction
  const defRes = await query(`SELECT * FROM player_resources WHERE player_pubkey=$1`, [defenderPubkey]);
  const dr = defRes.rows[0];
  const lootFactor = Math.min(destructionPct, 100) / 100 * 0.3; // Max 30% of resources
  const lootGold = Math.floor(Number(dr.gold) * lootFactor);
  const lootWood = Math.floor(Number(dr.wood) * lootFactor);
  const lootOre = Math.floor(Number(dr.ore) * lootFactor);

  // Trophy calculation
  const trophyDelta = stars === 0 ? -5 : stars * 10;

  // Transfer resources
  await query(`UPDATE player_resources SET gold=gold-$1, wood=wood-$2, ore=ore-$3 WHERE player_pubkey=$4`,
    [lootGold, lootWood, lootOre, defenderPubkey]);
  await query(`UPDATE player_resources SET gold=LEAST(gold+$1,gold_max), wood=LEAST(wood+$2,wood_max), ore=LEAST(ore+$3,ore_max) WHERE player_pubkey=$4`,
    [lootGold, lootWood, lootOre, attackerPubkey]);

  // Update trophies
  await query(`UPDATE players SET trophy_count=GREATEST(trophy_count+$1,0) WHERE pubkey=$2`, [trophyDelta, attackerPubkey]);
  await query(`UPDATE players SET trophy_count=GREATEST(trophy_count-$1,0) WHERE pubkey=$2`, [Math.floor(trophyDelta / 2), defenderPubkey]);
  await query(`UPDATE matchmaking_pool SET trophy_count=(SELECT trophy_count FROM players WHERE pubkey=$1) WHERE player_pubkey=$1`, [attackerPubkey]);
  await query(`UPDATE matchmaking_pool SET trophy_count=(SELECT trophy_count FROM players WHERE pubkey=$1) WHERE player_pubkey=$1`, [defenderPubkey]);

  // Shield for defender
  const shieldHours = stars >= 3 ? 16 : stars >= 2 ? 14 : stars >= 1 ? 12 : 0.5;
  await query(`UPDATE players SET is_under_attack=false, shield_expiry=NOW()+INTERVAL '${shieldHours} hours' WHERE pubkey=$1`, [defenderPubkey]);
  await query(`UPDATE players SET attack_cooldown=NOW()+INTERVAL '5 minutes' WHERE pubkey=$1`, [attackerPubkey]);
  await query(`UPDATE matchmaking_pool SET is_available=true WHERE player_pubkey=$1`, [defenderPubkey]);

  // Finalize battle
  await query(
    `UPDATE active_battles SET status='settled', stars=$1, destruction_pct=$2,
     loot_gold=$3, loot_wood=$4, loot_ore=$5, trophy_delta=$6,
     ships_deployed=$7, finished_at=NOW() WHERE id=$8`,
    [stars, destructionPct, lootGold, lootWood, lootOre, trophyDelta, shipsDeployed, battleId]
  );

  // Archive
  await query(
    `INSERT INTO battle_history (battle_id, attacker_pubkey, defender_pubkey, stars, destruction_pct, trophy_delta, loot_gold, loot_wood, loot_ore, ships_deployed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [battleId, attackerPubkey, defenderPubkey, stars, destructionPct, trophyDelta, lootGold, lootWood, lootOre, shipsDeployed]
  );

  return {
    battleId, stars, destructionPct, trophyDelta,
    loot: { gold: lootGold, wood: lootWood, ore: lootOre },
    shieldHours,
  };
}

export { BUILDING_DEFS, TROOP_DEFS };
