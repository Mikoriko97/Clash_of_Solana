use anchor_lang::prelude::*;
use village_info::VillageInfo;
use troop_stats::{TroopStats, TroopType};
use resources::Resources;

declare_id!("2dkHPjGHDQrC5gNrmPR4ucQ4UsFppveJbVMxzq9uEpAJ");

/// Тренування та апгрейд військ.
/// Типи та stats — з Godot base_troop.gd + knight.gd/mage.gd/barbarian.gd/archer.gd/ranger.gd
/// Sawmill виступає як казарма (з Godot building_system.gd)
#[program]
pub mod troop_train {
    use super::*;

    /// Ініціалізація трупа (перший раз — level 1)
    pub fn initialize_troop(
        ctx: Context<InitializeTroop>,
        troop_type: u8,  // 0=Knight, 1=Mage, 2=Barbarian, 3=Archer, 4=Ranger
    ) -> Result<()> {
        let ttype = parse_troop_type(troop_type)?;
        let (hp, damage, atk_speed, move_speed, attack_range) = get_troop_stats(&ttype, 1);
        let (cost_gold, cost_wood, cost_ore) = get_troop_cost(&ttype, 1);

        let res = &mut ctx.accounts.resources;
        require!(res.gold >= cost_gold, TroopError::InsufficientGold);
        require!(res.wood >= cost_wood, TroopError::InsufficientWood);
        require!(res.ore >= cost_ore, TroopError::InsufficientOre);

        res.gold = res.gold.saturating_sub(cost_gold);
        res.wood = res.wood.saturating_sub(cost_wood);
        res.ore = res.ore.saturating_sub(cost_ore);

        let troop = &mut ctx.accounts.troop_stats;
        troop.troop_type = ttype;
        troop.level = 1;
        troop.hp = hp;
        troop.damage = damage;
        troop.atk_speed_millis = atk_speed;
        troop.move_speed_millis = move_speed;
        troop.attack_range_millis = attack_range;

        let village = &mut ctx.accounts.village_info;
        village.last_active_at = Clock::get()?.unix_timestamp;

        msg!("Troop type {} trained at level 1", troop_type);
        Ok(())
    }

    /// Апгрейд трупа (level 1→2→3, max = 3)
    pub fn upgrade_troop(ctx: Context<UpgradeTroop>) -> Result<()> {
        let troop = &ctx.accounts.troop_stats;
        require!(troop.level < 3, TroopError::MaxLevelReached);

        let new_level = troop.level + 1;
        let (cost_gold, cost_wood, cost_ore) = get_troop_cost(&troop.troop_type, new_level);

        let res = &mut ctx.accounts.resources;
        require!(res.gold >= cost_gold, TroopError::InsufficientGold);
        require!(res.wood >= cost_wood, TroopError::InsufficientWood);
        require!(res.ore >= cost_ore, TroopError::InsufficientOre);

        res.gold = res.gold.saturating_sub(cost_gold);
        res.wood = res.wood.saturating_sub(cost_wood);
        res.ore = res.ore.saturating_sub(cost_ore);

        let (hp, damage, atk_speed, move_speed, attack_range) =
            get_troop_stats(&troop.troop_type, new_level);

        let troop = &mut ctx.accounts.troop_stats;
        troop.level = new_level;
        troop.hp = hp;
        troop.damage = damage;
        troop.atk_speed_millis = atk_speed;
        troop.move_speed_millis = move_speed;
        troop.attack_range_millis = attack_range;

        let village = &mut ctx.accounts.village_info;
        village.last_active_at = Clock::get()?.unix_timestamp;

        msg!("Troop upgraded to level {}", new_level);
        Ok(())
    }
}

fn parse_troop_type(t: u8) -> Result<TroopType> {
    match t {
        0 => Ok(TroopType::Knight),
        1 => Ok(TroopType::Mage),
        2 => Ok(TroopType::Barbarian),
        3 => Ok(TroopType::Archer),
        4 => Ok(TroopType::Ranger),
        _ => Err(TroopError::InvalidTroopType.into()),
    }
}

/// Stats з Godot: hp, damage, atk_speed_millis, move_speed_millis, attack_range_millis
fn get_troop_stats(ttype: &TroopType, level: u8) -> (u32, u32, u32, u32, u32) {
    match (ttype, level) {
        // Knight — Tank, Melee
        (TroopType::Knight, 1) => (1100, 75, 1667, 500, 240),
        (TroopType::Knight, 2) => (1450, 100, 1538, 500, 240),
        (TroopType::Knight, 3) => (1850, 130, 1429, 500, 240),
        // Mage — Burst, Ranged
        (TroopType::Mage, 1) => (420, 185, 1250, 400, 370),
        (TroopType::Mage, 2) => (560, 245, 1111, 400, 370),
        (TroopType::Mage, 3) => (720, 320, 1000, 400, 370),
        // Barbarian — Fast Brawler, Melee
        (TroopType::Barbarian, 1) => (520, 90, 625, 400, 240),
        (TroopType::Barbarian, 2) => (690, 120, 571, 400, 240),
        (TroopType::Barbarian, 3) => (880, 158, 526, 400, 240),
        // Archer — Sniper, Ranged
        (TroopType::Archer, 1) => (580, 130, 1111, 450, 490),
        (TroopType::Archer, 2) => (760, 175, 1000, 450, 490),
        (TroopType::Archer, 3) => (970, 228, 909, 450, 490),
        // Ranger — Balanced DPS, Ranged
        (TroopType::Ranger, 1) => (680, 110, 1000, 550, 400),
        (TroopType::Ranger, 2) => (900, 148, 909, 550, 400),
        (TroopType::Ranger, 3) => (1150, 192, 833, 550, 400),
        _ => (500, 50, 1000, 400, 240),
    }
}

/// Вартість тренування/апгрейду (з Godot troop_defs)
fn get_troop_cost(ttype: &TroopType, level: u8) -> (u64, u64, u64) {
    // (gold, wood, ore)
    match (ttype, level) {
        (TroopType::Knight, 1) => (150, 0, 80),
        (TroopType::Knight, 2) => (400, 0, 250),
        (TroopType::Knight, 3) => (900, 0, 600),
        (TroopType::Mage, 1) => (250, 0, 150),
        (TroopType::Mage, 2) => (600, 0, 400),
        (TroopType::Mage, 3) => (1400, 0, 900),
        (TroopType::Barbarian, 1) => (200, 0, 120),
        (TroopType::Barbarian, 2) => (500, 0, 350),
        (TroopType::Barbarian, 3) => (1100, 0, 750),
        (TroopType::Archer, 1) => (180, 100, 0),
        (TroopType::Archer, 2) => (450, 300, 0),
        (TroopType::Archer, 3) => (1000, 700, 0),
        (TroopType::Ranger, 1) => (120, 60, 0),
        (TroopType::Ranger, 2) => (350, 200, 0),
        (TroopType::Ranger, 3) => (800, 500, 0),
        _ => (100, 0, 0),
    }
}

#[derive(Accounts)]
#[instruction(troop_type: u8)]
pub struct InitializeTroop<'info> {
    #[account(
        init,
        payer = owner,
        space = TroopStats::SPACE,
        seeds = [b"troop", owner.key().as_ref(), &[troop_type]],
        bump,
    )]
    pub troop_stats: Account<'info, TroopStats>,

    #[account(
        mut,
        constraint = village_info.owner == owner.key() @ TroopError::NotVillageOwner,
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

#[derive(Accounts)]
pub struct UpgradeTroop<'info> {
    #[account(mut)]
    pub troop_stats: Account<'info, TroopStats>,

    #[account(
        mut,
        constraint = village_info.owner == owner.key() @ TroopError::NotVillageOwner,
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
pub enum TroopError {
    #[msg("Invalid troop type")]
    InvalidTroopType,
    #[msg("Troop is already at max level (3)")]
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
