use anchor_lang::prelude::*;

declare_id!("FyqN3SMjAJuDrog4AzByYBEJ46uRkqmmTNbsLftCWCDA");

/// Ресурси гравця.
/// Адаптовано з Godot: building_system.gd resources dict
/// Гра має: wood, gold, ore (НЕ elixir/dark_elixir/gems!)
#[account]
#[derive(Default)]
pub struct Resources {
    // ── Soft currency (in-game, не SPL токени) ───────────────
    pub gold: u64,
    pub gold_max: u64,

    pub wood: u64,
    pub wood_max: u64,

    pub ore: u64,
    pub ore_max: u64,

    // ── Production tracking ───────────────────────────────────
    /// Timestamp останнього збору (для пасивного накопичення)
    pub last_collected_at: i64,

    /// Кеш: поточна швидкість виробництва gold/год
    pub gold_per_hour_cache: u64,

    /// Кеш: поточна швидкість виробництва wood/год
    pub wood_per_hour_cache: u64,

    /// Кеш: поточна швидкість виробництва ore/год
    pub ore_per_hour_cache: u64,
}

impl Resources {
    pub const SPACE: usize = 8  // discriminator
        + 8 * 6    // 6 u64 полів (gold, gold_max, wood, wood_max, ore, ore_max)
        + 8        // last_collected_at i64
        + 8 * 3    // 3 cache u64 полів
        + 64;      // резерв
}
