use anchor_lang::prelude::*;
use village_info::VillageInfo;
use building_data::{BuildingData, BuildingType};
use resources::Resources;

declare_id!("U9apFonJ9auQ8SWf86ZqEmx8b6tixeXXHCgUV1cE7NH");

/// Будівництво нової будівлі.
/// Типи та вартість — з Godot building_system.gd building_defs.
#[program]
pub mod build_construct {
    use super::*;

    pub fn construct_building(
        ctx: Context<ConstructBuilding>,
        building_type: u8,  // 0=TownHall, 1=Mine, 2=Barn, 3=Port, 4=Sawmill, 5=Turret
        grid_x: u8,
        grid_y: u8,
    ) -> Result<()> {
        let village = &ctx.accounts.village_info;
        let res = &mut ctx.accounts.resources;

        // Парсимо тип будівлі
        let btype = match building_type {
            0 => BuildingType::TownHall,
            1 => BuildingType::Mine,
            2 => BuildingType::Barn,
            3 => BuildingType::Port,
            4 => BuildingType::Sawmill,
            5 => BuildingType::Turret,
            _ => return Err(ConstructError::InvalidBuildingType.into()),
        };

        // Перевірка TownHall: max 1
        if btype == BuildingType::TownHall {
            require!(
                village.building_count == 0,
                ConstructError::TownHallAlreadyExists
            );
        }

        // Отримуємо вартість та параметри (з Godot building_defs)
        let (cost_gold, cost_wood, cost_ore, size_x, size_y, hp_max) = get_building_params(&btype);

        // Перевірка grid позиції
        require!(
            grid_x + size_x <= village.grid_width && grid_y + size_y <= village.grid_height,
            ConstructError::OutOfGrid
        );

        // Перевірка ресурсів
        require!(res.gold >= cost_gold, ConstructError::InsufficientGold);
        require!(res.wood >= cost_wood, ConstructError::InsufficientWood);
        require!(res.ore >= cost_ore, ConstructError::InsufficientOre);

        // Знімаємо ресурси
        res.gold = res.gold.saturating_sub(cost_gold);
        res.wood = res.wood.saturating_sub(cost_wood);
        res.ore = res.ore.saturating_sub(cost_ore);

        // Ініціалізуємо будівлю
        let building = &mut ctx.accounts.building_data;
        building.building_type = btype;
        building.level = 1;
        building.hp_current = hp_max;
        building.hp_max = hp_max;
        building.grid_x = grid_x;
        building.grid_y = grid_y;
        building.size_x = size_x;
        building.size_y = size_y;
        building.is_upgrading = false;
        building.upgrade_finish_at = 0;
        building.is_destroyed = false;

        // Оновлюємо village
        let village = &mut ctx.accounts.village_info;
        village.building_count += 1;
        village.last_active_at = Clock::get()?.unix_timestamp;

        msg!("Building {:?} constructed at ({},{}) for player {}",
            building.building_type, grid_x, grid_y, village.owner);
        Ok(())
    }
}

/// Параметри будівель з Godot building_system.gd building_defs (level 1)
/// Returns: (cost_gold, cost_wood, cost_ore, size_x, size_y, hp_max)
fn get_building_params(btype: &BuildingType) -> (u64, u64, u64, u8, u8, u32) {
    match btype {
        BuildingType::TownHall => (0, 0, 0, 4, 4, 3500),
        BuildingType::Mine     => (400, 150, 0, 3, 3, 1200),
        BuildingType::Barn     => (200, 200, 100, 2, 3, 2000),
        BuildingType::Port     => (800, 300, 200, 3, 3, 1800),
        BuildingType::Sawmill  => (300, 0, 0, 3, 3, 1200),
        BuildingType::Turret   => (600, 350, 200, 2, 2, 900),
    }
}

#[derive(Accounts)]
#[instruction(building_type: u8, grid_x: u8, grid_y: u8)]
pub struct ConstructBuilding<'info> {
    #[account(
        init,
        payer = owner,
        space = BuildingData::SPACE,
        seeds = [
            b"building",
            owner.key().as_ref(),
            &[village_info.building_count],
        ],
        bump,
    )]
    pub building_data: Account<'info, BuildingData>,

    #[account(
        mut,
        constraint = village_info.owner == owner.key() @ ConstructError::NotVillageOwner,
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

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ConstructError {
    #[msg("Invalid building type")]
    InvalidBuildingType,
    #[msg("Town Hall already exists")]
    TownHallAlreadyExists,
    #[msg("Building position is outside the grid")]
    OutOfGrid,
    #[msg("Not enough gold")]
    InsufficientGold,
    #[msg("Not enough wood")]
    InsufficientWood,
    #[msg("Not enough ore")]
    InsufficientOre,
    #[msg("Signer does not own the village")]
    NotVillageOwner,
}
