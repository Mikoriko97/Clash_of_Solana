use anchor_lang::prelude::*;
use village_info::VillageInfo;
use resources::Resources;

declare_id!("FyqN3SMjAJuDrog4AzByYBEJ46uRkqmmTNbsLftCWCDA");

/// Ініціалізація села нового гравця.
/// Створює VillageInfo + Resources PDA акаунти.
#[program]
pub mod village_init {
    use super::*;

    pub fn initialize_village(
        ctx: Context<InitializeVillage>,
        name: String,
    ) -> Result<()> {
        require!(name.len() <= 32, VillageError::NameTooLong);

        let village = &mut ctx.accounts.village_info;
        village.owner = ctx.accounts.owner.key();
        village.name = name;
        village.town_hall_level = 1;
        village.trophy_count = 0;
        village.league = 0;
        village.shield_expiry = 0;
        village.attack_cooldown_until = 0;
        village.is_under_attack = false;
        village.last_active_at = Clock::get()?.unix_timestamp;
        village.experience = 0;
        village.grid_width = 27;   // з Godot building_system.gd
        village.grid_height = 27;  // з Godot building_system.gd
        village.building_count = 0;

        let res = &mut ctx.accounts.resources;
        res.gold = 1000;      // з Godot building_system.gd starting resources
        res.gold_max = 10000;
        res.wood = 1000;      // з Godot
        res.wood_max = 10000;
        res.ore = 1000;       // з Godot
        res.ore_max = 10000;
        res.last_collected_at = Clock::get()?.unix_timestamp;

        msg!("Village '{}' initialized for {}", village.name, village.owner);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVillage<'info> {
    #[account(
        init,
        payer = owner,
        space = VillageInfo::SPACE,
        seeds = [b"village", owner.key().as_ref()],
        bump,
    )]
    pub village_info: Account<'info, VillageInfo>,

    #[account(
        init,
        payer = owner,
        space = Resources::SPACE,
        seeds = [b"resources", owner.key().as_ref()],
        bump,
    )]
    pub resources: Account<'info, Resources>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum VillageError {
    #[msg("Village name too long (max 32 characters)")]
    NameTooLong,
}
