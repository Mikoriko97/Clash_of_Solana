use anchor_lang::prelude::*;
use village_info::VillageInfo;

declare_id!("6mVjkn6Fi1eqjujLQqiuDDTE457JytY62N4atxMziMWM");

/// Управління щитом гравця.
/// Гравець може зняти щит достроково (щоб атакувати).
#[program]
pub mod shield_manage {
    use super::*;

    /// Зняти щит достроково (гравець хоче атакувати, але має активний щит)
    pub fn drop_shield(ctx: Context<ManageShield>) -> Result<()> {
        let village = &mut ctx.accounts.village_info;
        let now = Clock::get()?.unix_timestamp;

        require!(village.shield_expiry > now, ShieldError::NoActiveShield);

        village.shield_expiry = 0;
        village.last_active_at = now;

        msg!("Shield dropped for {}", village.owner);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ManageShield<'info> {
    #[account(
        mut,
        constraint = village_info.owner == owner.key() @ ShieldError::NotVillageOwner,
    )]
    pub village_info: Account<'info, VillageInfo>,

    pub owner: Signer<'info>,
}

#[error_code]
pub enum ShieldError {
    #[msg("No active shield to drop")]
    NoActiveShield,
    #[msg("Signer does not own the village")]
    NotVillageOwner,
}
