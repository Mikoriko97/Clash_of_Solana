use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, ephemeral};
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use battle_state::{BattleState, BattlePhase};

declare_id!("9QeHqdRbhTSQ15KaAByKCDjiHWfaZ8jE7E8AytzMF3Q3");

#[ephemeral]
#[program]
pub mod battle_action {
    use super::*;

    /// Деплой корабля з загоном (виконується в PER)
    pub fn deploy_ship(
        ctx: Context<BattleActionCtx>,
        troop_type: u8,
        target_x: u8,
        target_y: u8,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_state;
        require!(battle.phase == BattlePhase::Active, BattleActionError::WrongPhase);
        require!(ctx.accounts.signer.key() == battle.attacker, BattleActionError::NotAttacker);
        require!(
            battle.ships_deployed < BattleState::MAX_SHIPS,
            BattleActionError::MaxShipsReached
        );

        battle.ships_deployed += 1;
        battle.troops_deployed += BattleState::TROOPS_PER_SHIP;

        emit!(ShipDeployed {
            battle_id: battle.battle_id,
            ship_number: battle.ships_deployed,
            troop_type,
            target_x,
            target_y,
            troops_count: BattleState::TROOPS_PER_SHIP,
        });

        msg!("Ship {}/{} deployed: troop type {} at ({},{})",
            battle.ships_deployed, BattleState::MAX_SHIPS,
            troop_type, target_x, target_y
        );
        Ok(())
    }

    /// Оновлення стану бою (tick)
    pub fn battle_tick(
        ctx: Context<BattleActionCtx>,
        new_destruction_pct: u8,
        new_stars: u8,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_state;
        require!(battle.phase == BattlePhase::Active, BattleActionError::WrongPhase);

        battle.destruction_pct = new_destruction_pct.min(100);
        battle.stars = new_stars.min(3);

        if battle.stars == 3 || battle.destruction_pct >= 100 {
            battle.phase = BattlePhase::Completed;
            msg!("Battle {} auto-completed: {}★ {}%!",
                battle.battle_id, battle.stars, battle.destruction_pct);
        }

        let now = Clock::get()?.unix_timestamp;
        if now >= battle.timeout_at && battle.phase == BattlePhase::Active {
            battle.phase = BattlePhase::Completed;
            msg!("Battle {} timed out", battle.battle_id);
        }

        Ok(())
    }

    /// Завершення бою: commit_and_undelegate → state back to L1
    pub fn finalize_battle(
        ctx: Context<FinalizeBattleCtx>,
        loot_gold: u64,
        loot_wood: u64,
        loot_ore: u64,
        trophy_delta: i32,
    ) -> Result<()> {
        // Читаємо та оновлюємо battle в блоці, щоб mutable ref не конфліктував
        let battle_id: u64;
        let stars: u8;
        let destruction_pct: u8;
        {
            let battle = &mut ctx.accounts.battle_state;
            require!(
                battle.phase == BattlePhase::Completed
                    || Clock::get()?.unix_timestamp >= battle.timeout_at,
                BattleActionError::BattleNotComplete
            );
            require!(!battle.is_finalized, BattleActionError::AlreadyFinalized);

            battle.loot_gold = loot_gold;
            battle.loot_wood = loot_wood;
            battle.loot_ore = loot_ore;
            battle.trophy_delta = trophy_delta;
            battle.is_finalized = true;
            battle.phase = BattlePhase::Finalized;

            battle_id = battle.battle_id;
            stars = battle.stars;
            destruction_pct = battle.destruction_pct;
        }

        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.battle_state.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
            None,
        )?;

        msg!(
            "Battle {} FINALIZED: {}★ | {}% | gold:{} wood:{} ore:{} trophies:{:+}",
            battle_id, stars, destruction_pct,
            loot_gold, loot_wood, loot_ore, trophy_delta
        );
        Ok(())
    }
}

// ─── Events ──────────────────────────────────────────────────

#[event]
pub struct ShipDeployed {
    pub battle_id: u64,
    pub ship_number: u8,
    pub troop_type: u8,
    pub target_x: u8,
    pub target_y: u8,
    pub troops_count: u8,
}

// ─── Contexts ────────────────────────────────────────────────

#[derive(Accounts)]
pub struct BattleActionCtx<'info> {
    #[account(mut)]
    pub battle_state: Account<'info, BattleState>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct FinalizeBattleCtx<'info> {
    #[account(mut)]
    pub battle_state: Account<'info, BattleState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    // magic_context and magic_program auto-injected by #[commit]
}

// ─── Errors ──────────────────────────────────────────────────

#[error_code]
pub enum BattleActionError {
    #[msg("Wrong battle phase for this action")]
    WrongPhase,
    #[msg("Only the attacker can perform this action")]
    NotAttacker,
    #[msg("Maximum ships deployed (5)")]
    MaxShipsReached,
    #[msg("Battle is not complete yet")]
    BattleNotComplete,
    #[msg("Battle is already finalized")]
    AlreadyFinalized,
}
