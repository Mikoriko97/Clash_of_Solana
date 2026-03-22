use anchor_lang::prelude::*;

declare_id!("U9apFonJ9auQ8SWf86ZqEmx8b6tixeXXHCgUV1cE7NH");

/// Стан однієї будівлі.
/// Типи будівель — з Godot building_system.gd building_defs
#[account]
#[derive(Default)]
pub struct BuildingData {
    pub building_type: BuildingType,
    pub level: u8,

    /// Поточне HP (для бою)
    pub hp_current: u32,
    /// Максимальне HP на поточному рівні
    pub hp_max: u32,

    /// Позиція на сітці (27×27 grid з Godot)
    pub grid_x: u8,
    pub grid_y: u8,

    /// Розмір (footprint) на сітці
    pub size_x: u8,
    pub size_y: u8,

    /// Будівля зараз апгрейдиться
    pub is_upgrading: bool,
    /// Час завершення апгрейду (0 якщо не апгрейдиться)
    pub upgrade_finish_at: i64,

    /// Будівля пошкоджена/зруйнована (під час активного бою в PER)
    pub is_destroyed: bool,
}

/// Типи будівель — ТОЧНО з Godot building_system.gd building_defs
/// mine, barn, port, sawmill, town_hall, turret
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, PartialEq, Eq, Debug)]
pub enum BuildingType {
    #[default]
    TownHall,       // 4×4, HP: [3500, 6000, 10000], main building, max_count: 1
    Mine,           // 3×3, HP: [1200, 2200, 3800], resource production
    Barn,           // 2×3, HP: [2000, 3500, 6000], storage
    Port,           // 3×3, HP: [1800, 3200, 5500], special building
    Sawmill,        // 3×3, HP: [1200, 2200, 3800], also acts as Barracks
    Turret,         // 2×2, HP: [900, 1600, 2800], defensive
}

impl BuildingData {
    pub const SPACE: usize = 8
        + 1   // building_type enum
        + 1   // level
        + 4   // hp_current
        + 4   // hp_max
        + 1 + 1 // grid_x, grid_y
        + 1 + 1 // size_x, size_y
        + 1   // is_upgrading
        + 8   // upgrade_finish_at
        + 1   // is_destroyed
        + 32; // резерв
}
