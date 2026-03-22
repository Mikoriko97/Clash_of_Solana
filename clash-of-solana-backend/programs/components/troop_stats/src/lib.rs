use anchor_lang::prelude::*;

declare_id!("2dkHPjGHDQrC5gNrmPR4ucQ4UsFppveJbVMxzq9uEpAJ");

/// Стан та статистики трупа.
/// Типи та stats — з Godot base_troop.gd + knight.gd/mage.gd/barbarian.gd/archer.gd/ranger.gd
#[account]
#[derive(Default)]
pub struct TroopStats {
    pub troop_type: TroopType,
    pub level: u8,              // 1–3 (max level з Godot)
    pub hp: u32,
    pub damage: u32,
    /// Attack speed × 1000 (fixed-point, з Godot float)
    pub atk_speed_millis: u32,
    /// Move speed × 1000 (fixed-point)
    pub move_speed_millis: u32,
    /// Attack range × 1000 (fixed-point)
    pub attack_range_millis: u32,
}

/// Типи troops — ТОЧНО з Godot attack_system.gd SHIP_TROOPS + building_system.gd troop_defs
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, PartialEq, Eq)]
pub enum TroopType {
    #[default]
    Knight,     // Tank, Melee — sword, HP: [1100, 1450, 1850]
    Mage,       // Burst, Ranged — staff+magic sphere, HP: [420, 560, 720]
    Barbarian,  // Fast Brawler, Melee — axe, HP: [520, 690, 880]
    Archer,     // Sniper, Ranged — bow+arrows, HP: [580, 760, 970]
    Ranger,     // Balanced DPS, Ranged — crossbow+bolts, HP: [680, 900, 1150]
}

impl TroopStats {
    pub const SPACE: usize = 8
        + 1   // troop_type
        + 1   // level
        + 4   // hp
        + 4   // damage
        + 4   // atk_speed_millis
        + 4   // move_speed_millis
        + 4   // attack_range_millis
        + 32; // резерв
}
