use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use battle_state::{BattleState, BattlePhase};
use village_info::VillageInfo;

declare_id!("DRKgDLgKTYkomepLZdkacyeWkMRcfpS39RPBUGMJ8iuy");

/// Max battle duration (з Godot: рекомендовано 180 сек)
pub const BATTLE_MAX_DURATION_SECS: i64 = 180;

#[ephemeral]
#[program]
pub mod battle_start {
    use super::*;

    /// Ініціалізація бою + Permission Group (на L1)
    /// Адаптовано: без prep phase (бій починається зразу Active)
    pub fn initialize_battle(
        ctx: Context<InitializeBattle>,
        battle_id: u64,
    ) -> Result<()> {
        let attacker_village = &ctx.accounts.attacker_village;
        let now = Clock::get()?.unix_timestamp;

        require!(
            !attacker_village.is_under_attack,
            BattleError::AttackerUnderAttack
        );
        require!(
            now >= attacker_village.attack_cooldown_until,
            BattleError::AttackerOnCooldown
        );

        let defender_village = &ctx.accounts.defender_village;
        require!(
            now >= defender_village.shield_expiry,
            BattleError::DefenderShielded
        );
        // is_under_attack перевіряється в Anchor constraint (атомарно)

        // ── Ініціалізація BattleState ──────────────────────────
        let battle = &mut ctx.accounts.battle_state;
        battle.battle_id = battle_id;
        battle.attacker = ctx.accounts.attacker.key();
        battle.defender = ctx.accounts.defender_village.owner;
        battle.phase = BattlePhase::Active; // Зразу Active, без Preparation
        battle.started_at = now;
        battle.timeout_at = now + BATTLE_MAX_DURATION_SECS;
        battle.is_finalized = false;
        battle.ships_deployed = 0;
        battle.troops_deployed = 0;

        // ── Позначаємо defender як "під атакою" ───────────────
        let defender_village = &mut ctx.accounts.defender_village;
        defender_village.is_under_attack = true;

        msg!("Battle {} initialized (Active) | attacker: {} | defender: {}",
            battle_id,
            ctx.accounts.attacker.key(),
            battle.defender
        );

        Ok(())
    }

    /// Делегування BattleState в TEE (PER)
    /// TEE validator pubkey передається як remaining_accounts[0]
    pub fn delegate_battle_to_per(ctx: Context<DelegateInput>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[b"battle", ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                commit_frequency_ms: 0,
                validator: ctx.remaining_accounts.first().map(|a| a.key()),
            },
        )?;
        msg!("BattleState delegated to TEE PER");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(battle_id: u64)]
pub struct InitializeBattle<'info> {
    #[account(
        init,
        payer = attacker,
        space = BattleState::SPACE,
        seeds = [b"battle", attacker.key().as_ref(), &battle_id.to_le_bytes()],
        bump,
    )]
    pub battle_state: Account<'info, BattleState>,

    #[account(
        mut,
        constraint = attacker_village.owner == attacker.key() @ BattleError::NotVillageOwner,
    )]
    pub attacker_village: Account<'info, VillageInfo>,

    #[account(
        mut,
        constraint = !defender_village.is_under_attack @ BattleError::DefenderAlreadyUnderAttack,
    )]
    pub defender_village: Account<'info, VillageInfo>,

    #[account(mut)]
    pub attacker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: del macro
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
}

#[error_code]
pub enum BattleError {
    #[msg("Attacker is currently under attack")]
    AttackerUnderAttack,
    #[msg("Attacker is on attack cooldown")]
    AttackerOnCooldown,
    #[msg("Defender is protected by a shield")]
    DefenderShielded,
    #[msg("Defender is already under attack")]
    DefenderAlreadyUnderAttack,
    #[msg("Signer does not own the village")]
    NotVillageOwner,
}
