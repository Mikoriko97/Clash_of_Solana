use anchor_lang::prelude::*;
use village_info::VillageInfo;
use resources::Resources;

declare_id!("GwytNgagZQHPoeKc9Q3CYpAdAERBzzdhxJK5z5jMukLb");

/// Збір пасивно накопичених ресурсів.
/// Розраховує кількість ресурсів на основі часу з останнього збору
/// та кешованих rate-ів (gold_per_hour_cache, wood_per_hour_cache, ore_per_hour_cache).
#[program]
pub mod resource_collect {
    use super::*;

    /// Збір ресурсів. Викликається гравцем коли заходить у гру.
    pub fn collect_resources(ctx: Context<CollectResources>) -> Result<()> {
        let res = &mut ctx.accounts.resources;
        let now = Clock::get()?.unix_timestamp;

        let elapsed_secs = (now - res.last_collected_at).max(0) as u64;
        if elapsed_secs == 0 {
            return Ok(());
        }

        // Розрахунок накопиченого (per_hour / 3600 * elapsed_secs)
        let gold_produced = res.gold_per_hour_cache
            .saturating_mul(elapsed_secs) / 3600;
        let wood_produced = res.wood_per_hour_cache
            .saturating_mul(elapsed_secs) / 3600;
        let ore_produced = res.ore_per_hour_cache
            .saturating_mul(elapsed_secs) / 3600;

        // Додаємо до балансу з урахуванням max
        res.gold = res.gold.saturating_add(gold_produced).min(res.gold_max);
        res.wood = res.wood.saturating_add(wood_produced).min(res.wood_max);
        res.ore = res.ore.saturating_add(ore_produced).min(res.ore_max);

        res.last_collected_at = now;

        let village = &mut ctx.accounts.village_info;
        village.last_active_at = now;

        msg!("Collected: +{}g +{}w +{}o ({}s elapsed)",
            gold_produced, wood_produced, ore_produced, elapsed_secs);
        Ok(())
    }

    /// Оновлення rate виробництва (викликається після побудови/апгрейду Mine/Sawmill)
    pub fn update_production_rates(
        ctx: Context<CollectResources>,
        gold_per_hour: u64,
        wood_per_hour: u64,
        ore_per_hour: u64,
    ) -> Result<()> {
        let res = &mut ctx.accounts.resources;
        res.gold_per_hour_cache = gold_per_hour;
        res.wood_per_hour_cache = wood_per_hour;
        res.ore_per_hour_cache = ore_per_hour;

        msg!("Production rates updated: {}g/h {}w/h {}o/h",
            gold_per_hour, wood_per_hour, ore_per_hour);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CollectResources<'info> {
    #[account(
        mut,
        seeds = [b"resources", owner.key().as_ref()],
        bump,
    )]
    pub resources: Account<'info, Resources>,

    #[account(
        mut,
        constraint = village_info.owner == owner.key() @ CollectError::NotVillageOwner,
    )]
    pub village_info: Account<'info, VillageInfo>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[error_code]
pub enum CollectError {
    #[msg("Signer does not own the village")]
    NotVillageOwner,
}
