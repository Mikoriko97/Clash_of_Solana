use anchor_lang::prelude::*;
use village_info::VillageInfo;
use building_data::{BuildingData, BuildingType};
use resources::Resources;

declare_id!("Dw3Mbq9aszupsKgsZDR8Muf3c7gSD8cjjgruPgsCayBA");

/// Апгрейд існуючої будівлі (1→2→3, max level = 3 з Godot).
/// Вартість апгрейду та HP — з Godot building_system.gd building_defs.
#[program]
pub mod build_upgrade {
    use super::*;

    pub fn upgrade_building(ctx: Context<UpgradeBuilding>) -> Result<()> {
        let building = &ctx.accounts.building_data;
        let res = &mut ctx.accounts.resources;

        require!(!building.is_upgrading, UpgradeError::AlreadyUpgrading);
        require!(!building.is_destroyed, UpgradeError::BuildingDestroyed);
        require!(building.level < 3, UpgradeError::MaxLevelReached);

        let new_level = building.level + 1;

        // Вартість апгрейду (з Godot building_defs, вартість = level * base_cost)
        let (cost_gold, cost_wood, cost_ore) = get_upgrade_cost(&building.building_type, new_level);

        require!(res.gold >= cost_gold, UpgradeError::InsufficientGold);
        require!(res.wood >= cost_wood, UpgradeError::InsufficientWood);
        require!(res.ore >= cost_ore, UpgradeError::InsufficientOre);

        // Знімаємо ресурси
        res.gold = res.gold.saturating_sub(cost_gold);
        res.wood = res.wood.saturating_sub(cost_wood);
        res.ore = res.ore.saturating_sub(cost_ore);

        // Апгрейдимо будівлю
        let building = &mut ctx.accounts.building_data;
        let new_hp = get_hp_for_level(&building.building_type, new_level);
        building.level = new_level;
        building.hp_max = new_hp;
        building.hp_current = new_hp;

        // Якщо TownHall — оновити village
        if building.building_type == BuildingType::TownHall {
            let village = &mut ctx.accounts.village_info;
            village.town_hall_level = new_level;
        }

        let village = &mut ctx.accounts.village_info;
        village.last_active_at = Clock::get()?.unix_timestamp;

        msg!("Building upgraded to level {}", new_level);
        Ok(())
    }
}

/// Вартість апгрейду (множник від базової ціни)
fn get_upgrade_cost(btype: &BuildingType, to_level: u8) -> (u64, u64, u64) {
    let multiplier = to_level as u64;
    match btype {
        BuildingType::TownHall => (500 * multiplier, 300 * multiplier, 200 * multiplier),
        BuildingType::Mine     => (400 * multiplier, 150 * multiplier, 0),
        BuildingType::Barn     => (200 * multiplier, 200 * multiplier, 100 * multiplier),
        BuildingType::Port     => (800 * multiplier, 300 * multiplier, 200 * multiplier),
        BuildingType::Sawmill  => (300 * multiplier, 0, 0),
        BuildingType::Turret   => (600 * multiplier, 350 * multiplier, 200 * multiplier),
    }
}

/// HP за рівнем (з Godot building_defs)
fn get_hp_for_level(btype: &BuildingType, level: u8) -> u32 {
    match (btype, level) {
        (BuildingType::TownHall, 1) => 3500,
        (BuildingType::TownHall, 2) => 6000,
        (BuildingType::TownHall, 3) => 10000,
        (BuildingType::Mine, 1) => 1200,
        (BuildingType::Mine, 2) => 2200,
        (BuildingType::Mine, 3) => 3800,
        (BuildingType::Barn, 1) => 2000,
        (BuildingType::Barn, 2) => 3500,
        (BuildingType::Barn, 3) => 6000,
        (BuildingType::Port, 1) => 1800,
        (BuildingType::Port, 2) => 3200,
        (BuildingType::Port, 3) => 5500,
        (BuildingType::Sawmill, 1) => 1200,
        (BuildingType::Sawmill, 2) => 2200,
        (BuildingType::Sawmill, 3) => 3800,
        (BuildingType::Turret, 1) => 900,
        (BuildingType::Turret, 2) => 1600,
        (BuildingType::Turret, 3) => 2800,
        _ => 1000,
    }
}

#[derive(Accounts)]
pub struct UpgradeBuilding<'info> {
    #[account(
        mut,
        constraint = !building_data.is_destroyed @ UpgradeError::BuildingDestroyed,
    )]
    pub building_data: Account<'info, BuildingData>,

    #[account(
        mut,
        constraint = village_info.owner == owner.key() @ UpgradeError::NotVillageOwner,
    )]
    pub village_info: Account<'info, VillageInfo>,

    #[account(
        mut,
        seeds = [b"resources", owner.key().as_ref()],
        bump,
    )]
    pub resources: Account<'info, Resources>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[error_code]
pub enum UpgradeError {
    #[msg("Building is already upgrading")]
    AlreadyUpgrading,
    #[msg("Building is destroyed")]
    BuildingDestroyed,
    #[msg("Building is already at max level (3)")]
    MaxLevelReached,
    #[msg("Not enough gold")]
    InsufficientGold,
    #[msg("Not enough wood")]
    InsufficientWood,
    #[msg("Not enough ore")]
    InsufficientOre,
    #[msg("Signer does not own the village")]
    NotVillageOwner,
}
