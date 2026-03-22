use anchor_lang::prelude::*;

declare_id!("F7pjZrQfgcFXdTW51k3kUoGh8TkNw9m84HCH9LA5KxzN");

/// Стан бою — делегується в Private Ephemeral Rollup (TEE).
/// Адаптовано з Godot: attack_system.gd
/// НЕМАЄ prep phase (бій починається одразу).
/// Ресурси — wood/gold/ore (не elixir/dark_elixir).
#[account]
pub struct BattleState {
    pub battle_id: u64,

    /// Атакер
    pub attacker: Pubkey,
    /// Захисник  
    pub defender: Pubkey,

    /// Поточна фаза бою (без Preparation — зразу Active)
    pub phase: BattlePhase,

    /// Коли бій почався
    pub started_at: i64,
    /// Коли бій закінчиться максимум (started_at + 180 сек)
    pub timeout_at: i64,

    /// Зірки (0–3)
    pub stars: u8,
    /// Відсоток знищення (0–100)
    pub destruction_pct: u8,

    /// Вкрадені ресурси (wood/gold/ore з Godot)
    pub loot_gold: u64,
    pub loot_wood: u64,
    pub loot_ore: u64,

    /// Зміна трофеїв (може бути від'ємною)
    pub trophy_delta: i32,

    /// Кількість кораблів деплойнутих (макс 5 з Godot)
    pub ships_deployed: u8,

    /// Кількість troops деплойнутих (макс 15: 5 ships × 3 troops)
    pub troops_deployed: u8,

    /// Бій завершений та settled на L1
    pub is_finalized: bool,

    /// Бій вже settled (ресурси/трофеї застосовані) — запобігає подвійному settle
    pub is_settled: bool,
}

impl Default for BattleState {
    fn default() -> Self {
        Self {
            battle_id: 0,
            attacker: Pubkey::default(),
            defender: Pubkey::default(),
            phase: BattlePhase::Active,  // Немає prep phase — зразу Active
            started_at: 0,
            timeout_at: 0,
            stars: 0,
            destruction_pct: 0,
            loot_gold: 0,
            loot_wood: 0,
            loot_ore: 0,
            trophy_delta: 0,
            ships_deployed: 0,
            troops_deployed: 0,
            is_finalized: false,
            is_settled: false,
        }
    }
}

impl BattleState {
    /// Max battle duration (з Godot: немає явного тайм-ауту, рекомендовано 180 сек)
    pub const MAX_DURATION_SECS: i64 = 180;
    /// Max ships per battle (з Godot attack_system.gd: max_ships = 5)
    pub const MAX_SHIPS: u8 = 5;
    /// Troops per ship (з Godot attack_system.gd: troops_per_ship = 3)
    pub const TROOPS_PER_SHIP: u8 = 3;

    pub const SPACE: usize = 8  // discriminator
        + 8                     // battle_id
        + 32 + 32               // attacker, defender
        + 1                     // phase
        + 8 + 8                 // started_at, timeout_at
        + 1 + 1                 // stars, destruction_pct
        + 8 + 8 + 8             // loot (gold, wood, ore)
        + 4                     // trophy_delta
        + 1                     // ships_deployed
        + 1                     // troops_deployed
        + 1                     // is_finalized
        + 1                     // is_settled
        + 128;                  // резерв
}

/// Фази бою — адаптовано: немає Preparation (Godot не має prep phase)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BattlePhase {
    Active,         // активний бій (зразу після delegation)
    Completed,      // закінчився (час або всі будівлі знищені)
    Finalized,      // settled на L1
}
