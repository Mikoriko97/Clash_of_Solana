use anchor_lang::prelude::*;

declare_id!("Ho5ETZPYBcMb5cY3gH3XC3xaWw9JvmDzEpZxrfe1ETzZ");

/// Основна інформація про село гравця.
/// Адаптовано з Godot: game_manager.gd + building_system.gd
#[account]
#[derive(Default)]
pub struct VillageInfo {
    /// Власник (wallet pubkey)
    pub owner: Pubkey,                  // 32

    /// Назва села (max 32 символи)
    pub name: String,                   // 4 + 32

    /// Рівень Town Hall (1–3, max level з Godot building_system.gd)
    pub town_hall_level: u8,            // 1

    /// Кубки/Трофеї
    pub trophy_count: i32,              // 4

    /// Ліга (0 = без ліги)
    pub league: u8,                     // 1

    /// Час закінчення щита (unix timestamp, 0 = немає щита)
    pub shield_expiry: i64,             // 8

    /// Cooldown до наступної атаки (unix timestamp)
    pub attack_cooldown_until: i64,     // 8

    /// Гравець зараз під атакою
    pub is_under_attack: bool,          // 1

    /// Час останньої активності
    pub last_active_at: i64,            // 8

    /// Загальний XP гравця
    pub experience: u64,                // 8

    /// Grid розмір (з Godot: 27×27)
    pub grid_width: u8,                 // 1
    pub grid_height: u8,                // 1

    /// Кількість побудованих будівель
    pub building_count: u8,             // 1
}

impl VillageInfo {
    pub const SPACE: usize = 8      // discriminator
        + 32                        // owner
        + (4 + 32)                  // name
        + 1                         // town_hall_level
        + 4                         // trophy_count
        + 1                         // league
        + 8                         // shield_expiry
        + 8                         // attack_cooldown_until
        + 1                         // is_under_attack
        + 8                         // last_active_at
        + 8                         // experience
        + 1                         // grid_width
        + 1                         // grid_height
        + 1                         // building_count
        + 64;                       // резерв
}
