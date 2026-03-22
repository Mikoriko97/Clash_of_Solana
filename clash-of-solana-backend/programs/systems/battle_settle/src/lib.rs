use anchor_lang::prelude::*;
use battle_state::BattleState;
use village_info::VillageInfo;
use resources::Resources;

declare_id!("DxmRuUuYmgqA6DbDofbdpow4je5gjHVRDKNJTFvvsSFP");

/// Мінімальний cooldown захисника після бою (5 хвилин)
pub const DEFENDER_COOLDOWN_SECS: i64 = 300;
/// Мінімальний щит після бою (навіть при 0 зірок), 30 хвилин
pub const MIN_SHIELD_AFTER_BATTLE_SECS: i64 = 30 * 60;

/// Виконується НА L1 після того як BattleState повернувся з PER.
/// Застосовує результати бою: ресурси (wood/gold/ore), трофеї, щит.
#[program]
pub mod battle_settle {
    use super::*;

    pub fn settle_battle_result(ctx: Context<SettleBattle>) -> Result<()> {
        // ── Читаємо всі дані з battle в локальні змінні ──────
        // (уникаємо будь-яких проблем з borrow checker)
        let battle_id: u64;
        let loot_gold: u64;
        let loot_wood: u64;
        let loot_ore: u64;
        let trophy_delta: i32;
        let stars: u8;
        let destruction_pct: u8;

        {
            let battle = &ctx.accounts.battle_state;
            require!(battle.is_finalized, SettleError::BattleNotFinalized);
            require!(!battle.is_settled, SettleError::AlreadySettled);

            battle_id = battle.battle_id;
            loot_gold = battle.loot_gold;
            loot_wood = battle.loot_wood;
            loot_ore = battle.loot_ore;
            trophy_delta = battle.trophy_delta;
            stars = battle.stars;
            destruction_pct = battle.destruction_pct;
        }
        // immutable borrow на battle_state тут вже не живе

        let now = Clock::get()?.unix_timestamp;

        // ── Валідація лутів: не більше ніж є у захисника ─────
        let def_res = &mut ctx.accounts.defender_resources;
        let actual_loot_gold = loot_gold.min(def_res.gold);
        let actual_loot_wood = loot_wood.min(def_res.wood);
        let actual_loot_ore = loot_ore.min(def_res.ore);

        def_res.gold = def_res.gold.saturating_sub(actual_loot_gold);
        def_res.wood = def_res.wood.saturating_sub(actual_loot_wood);
        def_res.ore = def_res.ore.saturating_sub(actual_loot_ore);

        let atk_res = &mut ctx.accounts.attacker_resources;
        atk_res.gold = atk_res.gold.saturating_add(actual_loot_gold).min(atk_res.gold_max);
        atk_res.wood = atk_res.wood.saturating_add(actual_loot_wood).min(atk_res.wood_max);
        atk_res.ore = atk_res.ore.saturating_add(actual_loot_ore).min(atk_res.ore_max);

        // ── Трофеї (saturating для запобігання overflow) ──────
        let atk_village = &mut ctx.accounts.attacker_village;
        atk_village.trophy_count = atk_village.trophy_count.saturating_add(trophy_delta);
        atk_village.attack_cooldown_until = now + 300;
        atk_village.last_active_at = now;

        let def_village = &mut ctx.accounts.defender_village;
        def_village.trophy_count = def_village.trophy_count
            .saturating_sub(trophy_delta / 2)
            .max(0);

        // ── Щит для захисника ─────────────────────────────────
        let shield_duration: i64 = match stars {
            1 => 12 * 3600,  // 12 годин
            2 => 14 * 3600,  // 14 годин
            3 => 16 * 3600,  // 16 годин
            _ => 0,
        };
        if destruction_pct >= 40 && shield_duration > 0 {
            def_village.shield_expiry = now + shield_duration;
        } else {
            // Мінімальний щит навіть при малому destruction (sybil-attack захист)
            def_village.shield_expiry = now + MIN_SHIELD_AFTER_BATTLE_SECS;
        }

        // ── Знімаємо флаг "під атакою" ────────────────────────
        def_village.is_under_attack = false;

        // ── Defender cooldown (sybil-attack захист) ───────────
        def_village.attack_cooldown_until = def_village.attack_cooldown_until
            .max(now + DEFENDER_COOLDOWN_SECS);
        def_village.last_active_at = now;

        // ── Позначаємо battle як settled ──────────────────────
        let battle_mut = &mut ctx.accounts.battle_state;
        battle_mut.is_settled = true;

        msg!("Battle {} settled on L1 | loot: g{}/w{}/o{} | trophies: {:+}",
            battle_id, actual_loot_gold, actual_loot_wood, actual_loot_ore, trophy_delta);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SettleBattle<'info> {
    #[account(mut)]
    pub battle_state: Account<'info, BattleState>,

    #[account(
        mut,
        constraint = attacker_village.owner == battle_state.attacker @ SettleError::AttackerMismatch,
    )]
    pub attacker_village: Account<'info, VillageInfo>,
    #[account(
        mut,
        constraint = defender_village.owner == battle_state.defender @ SettleError::DefenderMismatch,
    )]
    pub defender_village: Account<'info, VillageInfo>,

    #[account(mut)]
    pub attacker_resources: Account<'info, Resources>,
    #[account(mut)]
    pub defender_resources: Account<'info, Resources>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

#[error_code]
pub enum SettleError {
    #[msg("Battle has not been finalized yet")]
    BattleNotFinalized,
    #[msg("Battle has already been settled")]
    AlreadySettled,
    #[msg("Attacker village does not match battle attacker")]
    AttackerMismatch,
    #[msg("Defender village does not match battle defender")]
    DefenderMismatch,
}
