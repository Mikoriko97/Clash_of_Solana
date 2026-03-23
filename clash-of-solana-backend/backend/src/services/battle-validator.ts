import { getFullOnChainState } from "./solana-state";
import { PublicKey } from "@solana/web3.js";

/**
 * Anti-cheat: validates battle results before accepting them.
 * Checks that reported destruction/stars/loot are plausible
 * based on attacker troops and defender buildings.
 */

interface BattleValidation {
  valid: boolean;
  reason?: string;
  adjustedStars?: number;
  adjustedDestruction?: number;
  maxLootGold?: number;
  maxLootWood?: number;
  maxLootOre?: number;
}

// Troop DPS values (damage per second at level 1-3)
const TROOP_DPS: Record<number, number[]> = {
  0: [45, 65, 91],    // Knight: dmg/atkSpeed
  1: [148, 220, 320],  // Mage
  2: [144, 210, 300],  // Barbarian
  3: [117, 175, 251],  // Archer
  4: [110, 163, 230],  // Ranger
};

export async function validateBattleResult(
  attackerPubkey: string,
  defenderPubkey: string,
  reportedStars: number,
  reportedDestruction: number,
  shipsDeployed: number,
  battleDurationSecs: number
): Promise<BattleValidation> {
  // Basic sanity checks
  if (reportedStars < 0 || reportedStars > 3) {
    return { valid: false, reason: "Stars must be 0-3" };
  }
  if (reportedDestruction < 0 || reportedDestruction > 100) {
    return { valid: false, reason: "Destruction must be 0-100" };
  }
  if (shipsDeployed < 0 || shipsDeployed > 5) {
    return { valid: false, reason: "Ships must be 0-5" };
  }
  if (battleDurationSecs < 1 || battleDurationSecs > 200) {
    return { valid: false, reason: "Duration out of range" };
  }

  // Stars vs destruction consistency
  if (reportedStars === 3 && reportedDestruction < 100) {
    return { valid: false, reason: "3 stars requires 100% destruction" };
  }
  if (reportedStars === 0 && reportedDestruction >= 50) {
    // Can't have 0 stars with 50%+ destruction
    return { valid: false, reason: "0 stars inconsistent with 50%+ destruction" };
  }

  // Check attacker has troops
  try {
    const attackerState = await getFullOnChainState(new PublicKey(attackerPubkey));
    if (!attackerState) {
      return { valid: false, reason: "Attacker state not found" };
    }

    // Max total DPS from all troops (3 troops per ship × shipsDeployed ships)
    const troopCount = shipsDeployed * 3;
    let maxDps = 0;
    const troopTypes = Object.values(attackerState.troops);
    for (const t of troopTypes) {
      const level = (t as any).level || 1;
      // Approximate: use average DPS across troop types
      maxDps += 150 * level; // rough estimate
    }
    maxDps = maxDps * troopCount / 5; // scale by actual deployed

    // Max possible destruction given troops and time
    // Very rough: each building has ~2000 HP avg, need maxDps * time > totalBuildingHP * destruction%
    const defenderState = await getFullOnChainState(new PublicKey(defenderPubkey));
    if (defenderState) {
      const totalBuildingHP = defenderState.buildings.reduce((sum: number, b: any) => sum + b.hpMax, 0);
      const maxDamage = maxDps * battleDurationSecs;
      const maxPossibleDestruction = totalBuildingHP > 0 ? Math.min(100, Math.floor((maxDamage / totalBuildingHP) * 100)) : 100;

      if (reportedDestruction > maxPossibleDestruction + 20) {
        // Allow 20% tolerance for game mechanics variance
        return {
          valid: false,
          reason: `Reported ${reportedDestruction}% but max possible ~${maxPossibleDestruction}%`,
        };
      }

      // Calculate max loot (30% of defender resources × destruction%)
      const lootFactor = Math.min(reportedDestruction, 100) / 100 * 0.3;
      const res = defenderState.resources;

      return {
        valid: true,
        adjustedStars: reportedStars,
        adjustedDestruction: reportedDestruction,
        maxLootGold: Math.floor(res.gold * lootFactor),
        maxLootWood: Math.floor(res.wood * lootFactor),
        maxLootOre: Math.floor(res.ore * lootFactor),
      };
    }
  } catch (e) {
    console.error("Battle validation error:", e);
  }

  // If we can't validate on-chain, accept with reduced loot
  return {
    valid: true,
    adjustedStars: Math.min(reportedStars, 2), // cap at 2★ if unverified
    adjustedDestruction: Math.min(reportedDestruction, 75), // cap at 75%
    maxLootGold: 50,
    maxLootWood: 50,
    maxLootOre: 50,
  };
}
