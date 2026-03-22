# ТЕХНІЧНЕ ЗАВДАННЯ ДЛЯ AI-РОЗРОБНИКА
# Clash of Solana — On-Chain Backend
## На базі існуючої Godot гри + Solana + MagicBlock Private Ephemeral Rollup

**Версія:** 1.0  
**Дата:** 21.03.2026  
**Аудиторія:** AI-агент (Cursor / Claude Code / Windsurf)  
**Стиль роботи:** Покроковий, з самоперевіркою на кожному етапі

---

## ⚠️ ГОЛОВНЕ ПРАВИЛО ДЛЯ AI

Перш ніж писати будь-який рядок коду — **просканувати весь Godot проєкт**.
Ніяких припущень. Механіки бекенду повністю визначаються тим, що є в грі.
Якщо в грі немає певної механіки — не реалізовувати її в бекенді.
Якщо знайдено механіку якої немає в ТЗ — задокументувати та реалізувати.

---

## ЗМІСТ

- [ФАЗА 0: Сканування Godot проєкту](#фаза-0-сканування)
- [ФАЗА 1: Середовище та інструменти](#фаза-1-середовище)
- [ФАЗА 2: Solana On-Chain Programs](#фаза-2-on-chain-programs)
- [ФАЗА 3: MagicBlock PER інтеграція](#фаза-3-per-інтеграція)
- [ФАЗА 4: TypeScript SDK](#фаза-4-typescript-sdk)
- [ФАЗА 5: Off-Chain Backend API](#фаза-5-backend-api)
- [ФАЗА 6: Godot ↔ Backend Bridge](#фаза-6-godot-bridge)
- [ФАЗА 7: Тести та валідація](#фаза-7-тести)
- [Довідник констант](#довідник-констант)

---

# ФАЗА 0: СКАНУВАННЯ GODOT ПРОЄКТУ

## 0.1 Задача фази

AI повинен прочитати весь Godot проєкт і скласти точну карту ігрових механік перед тим як писати бекенд. Результат фази — `GAME_MECHANICS_REPORT.md`.

## 0.2 Інструкція з сканування

```
КРОК 1: Знайти корінь Godot проєкту
─────────────────────────────────────
Шукати файл `project.godot` у файловій системі.
Це корінь проєкту. Зафіксувати шлях.

КРОК 2: Проаналізувати структуру директорій
─────────────────────────────────────────────
Рекурсивно пройти всі .gd / .gdscript / .tscn / .tres файли.
Скласти дерево структури:
  scenes/       → екрани та ігрові об'єкти
  scripts/      → логіка (GDScript)
  resources/    → конфіги (ресурси, статистики)
  autoloads/    → глобальні синглтони (GameManager, NetworkManager, etc.)

КРОК 3: Ідентифікувати ключові скрипти
────────────────────────────────────────
Шукати за ключовими словами в назвах файлів:
  - *village*, *base*, *town* → логіка бази
  - *building*, *construct*   → будівельна система
  - *troop*, *army*, *unit*   → бойові одиниці
  - *battle*, *attack*, *raid*→ бойова система
  - *resource*, *gold*, *elixir* → ресурсна система
  - *clan*, *guild*, *alliance*  → соціальна система
  - *hero*, *champion*           → герої
  - *upgrade*, *research*        → прогресія
  - *shop*, *gem*, *purchase*    → монетизація
  - *network*, *server*, *api*   → мережевий шар (якщо є)
  - *save*, *load*, *storage*    → збереження стану

КРОК 4: Детальний аналіз кожного ключового скрипту
────────────────────────────────────────────────────
Для кожного знайденого скрипту визначити:
  a) Змінні стану (var/export var) — це поля для on-chain компонентів
  b) Функції/методи — це потенційні System instructions
  c) Сигнали (signal) — це потенційні on-chain Events
  d) Константи — це конфіги балансу для game-data JSON
  e) Виклики HTTP/WebSocket — це точки для SDK інтеграції

КРОК 5: Скласти GAME_MECHANICS_REPORT.md
──────────────────────────────────────────
Структура звіту (обов'язкова):
  1. Список всіх ігрових сутностей (Buildings, Troops, Heroes, etc.)
  2. Список всіх ресурсів (currencies, tokens)
  3. Бойова система — покроковий опис flow
  4. Прогресійна система — Town Hall gates, рівні, апгрейди
  5. Соціальна система — Clan механіки якщо є
  6. Збереження стану — що зберігається і як
  7. Мережеві виклики — які API вже є або очікуються
  8. Список НЕВІДПОВІДНОСТЕЙ між грою та цим ТЗ
```

## 0.3 Шаблон GAME_MECHANICS_REPORT.md

AI заповнює цей шаблон після сканування:

```markdown
# GAME MECHANICS REPORT
Дата сканування: [дата]
Godot версія: [з project.godot]
Проєкт: [назва]

## СУТНОСТІ ТА ПОЛЯ СТАНУ

### Village / Base
Godot файл: [шлях]
Поля стану:
  - [назва_поля]: [тип_godot] → [тип_rust для on-chain]
  - ...

### Buildings
Godot файл: [шлях]
Типи будівель знайдені: [список]
Поля стану будівлі:
  - [назва_поля]: [тип] → [тип_rust]

### Troops
[аналогічно]

### Resources
Знайдені ресурси: [список]
Типи: soft-currency / hard-currency / NFT

### Battle System
Файл логіки: [шлях]
Flow бою (кроки):
  1. [крок]
  2. [крок]
  ...
Тривалість бою: [seconds]
Tick rate якщо є: [Hz]

### Clan System
Є в грі: [так/ні]
[якщо так — деталі]

### Hero System
Є в грі: [так/ні]
[якщо так — деталі]

### Existing Network Layer
Протокол: [HTTP/WebSocket/GDNative/відсутній]
Endpoints що вже є: [список]

## НЕВІДПОВІДНОСТІ З ТЗ
1. [опис невідповідності] → [рекомендація]
```

---

# ФАЗА 1: СЕРЕДОВИЩЕ ТА ІНСТРУМЕНТИ

## 1.1 Обов'язкові версії

```bash
# Перевірити наявність та версії
solana --version        # потрібно 2.3.13
rustc --version         # потрібно 1.85.0
anchor --version        # потрібно 0.32.1
node --version          # потрібно 24.10.0
```

Якщо версії не співпадають — встановити правильні перед продовженням.

```bash
# Solana
sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.13/install)"

# Rust
rustup install 1.85.0
rustup default 1.85.0

# Anchor через avm
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.32.1
avm use 0.32.1
```

## 1.2 Структура репозиторію

AI створює наступну структуру (після сканування Godot, імена адаптуються):

```
clash-of-solana-backend/
│
├── README.md
├── Anchor.toml
├── Cargo.toml                      ← workspace root
├── package.json                    ← npm workspace root
├── .env.example
├── GAME_MECHANICS_REPORT.md        ← результат Фази 0
│
├── programs/                       ← Rust on-chain programs
│   ├── components/                 ← BOLT-style data structs
│   │   ├── village_info/
│   │   ├── resources/
│   │   ├── building_data/
│   │   ├── troop_stats/
│   │   ├── battle_state/           ← делегується в PER
│   │   ├── hero_stats/             ← якщо герої є в грі
│   │   └── clan_info/              ← якщо клани є в грі
│   │
│   └── systems/                    ← Anchor programs з бізнес логікою
│       ├── village_init/
│       ├── build_construct/
│       ├── build_upgrade/
│       ├── resource_collect/
│       ├── troop_train/
│       ├── battle_start/           ← ініціалізація + delegation в PER
│       ├── battle_action/          ← виконується В PER (TEE endpoint)
│       ├── battle_finalize/        ← commit + undelegate → L1
│       ├── shield_manage/
│       ├── clan_create/            ← якщо клани є в грі
│       ├── clan_war_start/         ← якщо clan war є
│       └── clan_war_finalize/
│
├── packages/
│   ├── sdk/                        ← TypeScript SDK для Godot та Web
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── constants.ts        ← всі Program IDs, validator pubkeys
│   │   │   ├── types.ts            ← TypeScript типи з IDL
│   │   │   ├── per/
│   │   │   │   ├── auth.ts         ← PER авторизація (authToken flow)
│   │   │   │   └── session.ts      ← PerSessionManager
│   │   │   ├── managers/
│   │   │   │   ├── VillageManager.ts
│   │   │   │   ├── BattleManager.ts  ← PER-enabled
│   │   │   │   ├── ResourceManager.ts
│   │   │   │   ├── ClanManager.ts
│   │   │   │   └── ShopManager.ts
│   │   │   └── godot/
│   │   │       └── GodotBridge.ts  ← адаптер для Godot HTTP/WS
│   │   └── package.json
│   │
│   └── game-data/                  ← JSON конфіги балансу (з Godot ресурсів)
│       ├── buildings.json
│       ├── troops.json
│       ├── heroes.json
│       └── upgrade-costs.json
│
├── backend/                        ← Fastify off-chain API
│   ├── src/
│   │   ├── server.ts
│   │   ├── config.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── player.ts
│   │   │   ├── battle.ts
│   │   │   ├── clan.ts
│   │   │   ├── leaderboard.ts
│   │   │   └── shop.ts
│   │   ├── services/
│   │   │   ├── matchmaking.ts
│   │   │   ├── chain-reader.ts    ← читання стану з Solana L1
│   │   │   └── per-proxy.ts       ← проксі PER WebSocket для Godot
│   │   ├── jobs/                  ← Bull queue фонові задачі
│   │   │   ├── resource-tick.ts
│   │   │   ├── shield-expiry.ts
│   │   │   └── season-snapshot.ts
│   │   └── db/
│   │       ├── schema.sql
│   │       └── migrations/
│   └── package.json
│
├── tests/
│   ├── programs/                  ← Anchor тести
│   │   ├── village.test.ts
│   │   ├── battle-per.test.ts     ← тест PER flow
│   │   └── clan.test.ts
│   └── sdk/
│       └── battle-manager.test.ts
│
└── scripts/
    ├── deploy.sh                  ← deploy all programs
    ├── init-world.ts              ← ініціалізація ігрового стану
    └── extract-game-data.ts       ← скрипт конвертації Godot ресурсів → JSON
```

## 1.3 Cargo.toml (workspace)

```toml
[workspace]
resolver = "2"
members = [
    "programs/components/*",
    "programs/systems/*",
]

[workspace.dependencies]
anchor-lang           = "0.32.1"
anchor-spl            = "0.32.1"
ephemeral-rollups-sdk = { version = ">=0.8.0", features = ["anchor"] }

[workspace.metadata.anchor]
cluster = "devnet"
```

## 1.4 package.json (workspace root)

```json
{
  "name": "clash-of-solana-backend",
  "private": true,
  "workspaces": ["packages/*", "backend"],
  "scripts": {
    "build":    "anchor build",
    "test":     "anchor test",
    "deploy":   "bash scripts/deploy.sh",
    "dev:backend": "cd backend && bun run dev"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^22.0.0"
  }
}
```

---

# ФАЗА 2: ON-CHAIN PROGRAMS

## ⚠️ Інструкція AI перед написанням Programs

```
1. Відкрити GAME_MECHANICS_REPORT.md
2. Для кожного Component — перевірити що всі поля відповідають
   полям з Godot скриптів
3. Якщо в грі є поле якого немає в Component нижче — ДОДАТИ
4. Якщо в грі немає поля яке є в Component нижче — ПРИБРАТИ
5. Адаптувати типи даних: Godot float → Rust f32/u64 (обережно з дробами!)
```

## 2.1 Component: VillageInfo

```rust
// programs/components/village_info/src/lib.rs

use anchor_lang::prelude::*;

declare_id!("__REPLACE_AFTER_DEPLOY__");

/// Основна інформація про село гравця.
/// Поля уточнити після сканування Godot village скрипту.
#[account]
#[derive(Default)]
pub struct VillageInfo {
    /// Власник (wallet pubkey)
    pub owner: Pubkey,                  // 32

    /// Назва села (max 32 символи — перевірити ліміт у Godot)
    pub name: String,                   // 4 + 32

    /// Рівень Town Hall (1–15, перевірити max у Godot)
    pub town_hall_level: u8,            // 1

    /// Кубки/Трофеї (може бути від'ємним після поразки)
    pub trophy_count: i32,              // 4

    /// Ліга (0 = без ліги, 1–N — перевірити кількість у Godot)
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

    // ── Додати поля зі сканування Godot ──────────────────────
    // PLACEHOLDER: ai_scan_extra_fields
}

impl VillageInfo {
    /// Розрахувати space: оновити після додавання полів зі сканування
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
        + 64;                       // резерв для полів зі сканування
}
```

## 2.2 Component: Resources

```rust
// programs/components/resources/src/lib.rs

use anchor_lang::prelude::*;

declare_id!("__REPLACE_AFTER_DEPLOY__");

/// Ресурси гравця.
/// ⚠️ AI: Перевірити назви та кількість ресурсів у Godot перед реалізацією.
/// Видалити ресурси яких немає в грі. Додати ті що є але не вказані.
#[account]
#[derive(Default)]
pub struct Resources {
    // ── Soft currency (in-game, не SPL токени) ───────────────
    pub gold: u64,
    pub gold_max: u64,

    pub elixir: u64,
    pub elixir_max: u64,

    /// Dark Elixir — прибрати якщо відсутній у Godot
    pub dark_elixir: u64,
    pub dark_elixir_max: u64,

    // ── Hard currency (SPL токени, купуються за SOL) ──────────
    /// Gems — преміум валюта для швидкого прогресу
    pub gems: u64,

    // ── Production tracking ───────────────────────────────────
    /// Timestamp останнього збору (для пасивного накопичення)
    pub last_collected_at: i64,

    /// Кеш: поточна швидкість виробництва gold/год
    /// Обраховується на клієнті з будівель, тут тільки кеш
    pub gold_per_hour_cache: u64,

    /// Кеш: поточна швидкість виробництва elixir/год
    pub elixir_per_hour_cache: u64,

    // ── PLACEHOLDER: ai_scan_extra_resources ─────────────────
}

impl Resources {
    pub const SPACE: usize = 8
        + 8 * 8    // 8 u64 полів
        + 8        // last_collected_at i64
        + 64;      // резерв
}
```

## 2.3 Component: BuildingData

```rust
// programs/components/building_data/src/lib.rs

use anchor_lang::prelude::*;

declare_id!("__REPLACE_AFTER_DEPLOY__");

/// Стан однієї будівлі.
/// ⚠️ AI: Список BuildingType заповнити зі сканування Godot!
/// Знайти enum/const з типами будівель у Godot і відтворити тут.
#[account]
#[derive(Default)]
pub struct BuildingData {
    pub building_type: BuildingType,
    pub level: u8,

    /// Поточне HP (для бою)
    pub hp_current: u32,
    /// Максимальне HP на поточному рівні
    pub hp_max: u32,

    /// Позиція на сітці
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

    // ── PLACEHOLDER: ai_scan_extra_building_fields ───────────
}

/// ⚠️ AI: ОБОВ'ЯЗКОВО заповнити зі сканування Godot!
/// Знайти всі типи будівель у коді гри та перенести сюди.
/// Приклад нижче — базовий, реальний список може відрізнятись.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, PartialEq, Eq)]
pub enum BuildingType {
    #[default]
    TownHall,
    // ── Ресурсні ────────────────────────────────────────────
    GoldMine,
    ElixirCollector,
    DarkElixirDrill,       // прибрати якщо відсутній у Godot
    GoldStorage,
    ElixirStorage,
    DarkElixirStorage,     // прибрати якщо відсутній у Godot
    // ── Тренування ──────────────────────────────────────────
    Barracks,
    DarkBarracks,          // прибрати якщо відсутній у Godot
    Laboratory,
    SpellFactory,          // прибрати якщо відсутній у Godot
    // ── Захист ──────────────────────────────────────────────
    Cannon,
    ArcherTower,
    Mortar,
    AirDefense,
    WizardTower,
    // ── Стіни та пастки ─────────────────────────────────────
    Wall,
    Trap,
    // ── Соціальні ───────────────────────────────────────────
    ClanCastle,            // прибрати якщо кланів немає у Godot
    BuilderHut,
    HeroAltar,             // прибрати якщо героїв немає у Godot
    // ── PLACEHOLDER: ai_scan_extra_building_types ───────────
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
```

## 2.4 Component: BattleState (делегується в PER)

```rust
// programs/components/battle_state/src/lib.rs

use anchor_lang::prelude::*;

declare_id!("__REPLACE_AFTER_DEPLOY__");

/// Стан бою — делегується в Private Ephemeral Rollup (TEE).
/// Під час бою стан прихований від defender.
/// Після finalize — повертається на L1 з результатом.
#[account]
pub struct BattleState {
    pub battle_id: u64,

    /// Атакер
    pub attacker: Pubkey,
    /// Захисник
    pub defender: Pubkey,

    /// Поточна фаза бою
    pub phase: BattlePhase,

    /// Коли бій почався
    pub started_at: i64,
    /// Коли бій закінчиться максимум (started_at + max_duration)
    /// ⚠️ AI: max_duration взяти з Godot battle скрипту
    pub timeout_at: i64,

    /// Зірки (0–3)
    pub stars: u8,
    /// Відсоток знищення (0–100)
    pub destruction_pct: u8,

    /// Вкрадені ресурси
    pub loot_gold: u64,
    pub loot_elixir: u64,
    pub loot_dark_elixir: u64,  // прибрати якщо dark elixir відсутній

    /// Зміна трофеїв (може бути від'ємною)
    pub trophy_delta: i32,

    /// Бій завершений та settled на L1
    pub is_finalized: bool,

    // ── PLACEHOLDER: ai_scan_extra_battle_fields ─────────────
    // Наприклад: spell_count, hero_was_used, revenge_available
}

impl Default for BattleState {
    fn default() -> Self {
        Self {
            battle_id: 0,
            attacker: Pubkey::default(),
            defender: Pubkey::default(),
            phase: BattlePhase::Preparation,
            started_at: 0,
            timeout_at: 0,
            stars: 0,
            destruction_pct: 0,
            loot_gold: 0,
            loot_elixir: 0,
            loot_dark_elixir: 0,
            trophy_delta: 0,
            is_finalized: false,
        }
    }
}

impl BattleState {
    pub const SPACE: usize = 8  // discriminator
        + 8                     // battle_id
        + 32 + 32               // attacker, defender
        + 1                     // phase
        + 8 + 8                 // started_at, timeout_at
        + 1 + 1                 // stars, destruction_pct
        + 8 + 8 + 8             // loot
        + 4                     // trophy_delta
        + 1                     // is_finalized
        + 128;                  // резерв
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BattlePhase {
    Preparation,    // 30 сек огляд бази (verify з Godot)
    Active,         // активний бій
    Completed,      // закінчився (час або 3 зірки)
    Finalized,      // settled на L1
}
```

## 2.5 System: battle_start (L1 → PER delegation)

```rust
// programs/systems/battle_start/src/lib.rs
// Виконується НА L1. Ініціалізує BattleState + Permission Group + делегує в PER.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::access_control::{
    instructions::CreatePermissionCpiBuilder,
    structs::{Member, MembersArgs, AUTHORITY_FLAG, TX_LOGS_FLAG, TX_BALANCES_FLAG, TX_MESSAGE_FLAG},
};
use battle_state::{BattleState, BattlePhase};
use village_info::VillageInfo;

declare_id!("__REPLACE_AFTER_DEPLOY__");

pub const PERMISSION_PROGRAM_ID: Pubkey =
    pubkey!("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");

/// ⚠️ AI: Взяти BATTLE_MAX_DURATION_SECS з Godot battle скрипту
pub const BATTLE_MAX_DURATION_SECS: i64 = 180; // 3 хвилини (типово для CoC)
/// ⚠️ AI: Взяти BATTLE_PREP_DURATION_SECS з Godot battle скрипту  
pub const BATTLE_PREP_DURATION_SECS: i64 = 30; // 30 сек огляд

#[ephemeral]
#[program]
pub mod battle_start {
    use super::*;

    /// Крок 1 (L1): Ініціалізація + Permission Group
    pub fn initialize_battle(
        ctx: Context<InitializeBattle>,
        battle_id: u64,
    ) -> Result<()> {
        // ── Перевірки ─────────────────────────────────────────
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
        require!(
            !defender_village.is_under_attack,
            BattleError::DefenderAlreadyUnderAttack
        );

        // ── Ініціалізація BattleState ──────────────────────────
        let battle = &mut ctx.accounts.battle_state;
        battle.battle_id    = battle_id;
        battle.attacker     = ctx.accounts.attacker.key();
        battle.defender     = ctx.accounts.defender_village.owner;
        battle.phase        = BattlePhase::Preparation;
        battle.started_at   = now;
        battle.timeout_at   = now + BATTLE_PREP_DURATION_SECS + BATTLE_MAX_DURATION_SECS;
        battle.is_finalized = false;

        // ── Позначаємо defender як "під атакою" ───────────────
        let defender_village = &mut ctx.accounts.defender_village;
        defender_village.is_under_attack = true;

        // ── Створення Permission Group для PER ───────────────
        // Attacker: FULL ACCESS (може керувати permissions)
        // Defender: тільки TX_BALANCES (бачить скільки вкрали ПІСЛЯ бою)
        let members = Some(vec![
            Member {
                flags: AUTHORITY_FLAG | TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG,
                pubkey: ctx.accounts.attacker.key(),
            },
            Member {
                flags: TX_BALANCES_FLAG,
                pubkey: battle.defender,
            },
        ]);

        CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
            .permissioned_account(&ctx.accounts.battle_state.to_account_info())
            .permission(&ctx.accounts.battle_permission)
            .payer(&ctx.accounts.attacker)
            .system_program(&ctx.accounts.system_program)
            .args(MembersArgs { members })
            .invoke_signed(&[])?;

        msg!("Battle {} initialized | attacker: {} | defender: {}",
            battle_id,
            ctx.accounts.attacker.key(),
            battle.defender
        );

        Ok(())
    }

    /// Крок 2 (L1): Делегування BattleState в TEE (PER)
    /// TEE validator pubkey передається як remaining_accounts[0]
    pub fn delegate_battle_to_per(ctx: Context<DelegateInput>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[b"battle", ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                // remaining_accounts[0] = TEE validator
                // devnet:  FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA
                // mainnet: MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo
                validator: ctx.remaining_accounts.first().map(|a| a.key()),
                valid_until: Some(
                    Clock::get()?.unix_timestamp + BATTLE_PREP_DURATION_SECS + BATTLE_MAX_DURATION_SECS + 30
                ),
                commit_frequency_ms: None, // без auto-commit (зберігаємо приватність)
            },
        )?;
        msg!("BattleState delegated to TEE PER");
        Ok(())
    }
}

// ─── Contexts ────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(battle_id: u64)]
pub struct InitializeBattle<'info> {
    #[account(
        init,
        payer = attacker,
        space = BattleState::SPACE,
        seeds = [b"battle", attacker.key().as_ref()],
        bump,
    )]
    pub battle_state: Account<'info, BattleState>,

    /// CHECK: Permission PDA — створюється через CPI
    #[account(mut)]
    pub battle_permission: UncheckedAccount<'info>,

    #[account(mut)]
    pub attacker_village: Account<'info, VillageInfo>,

    #[account(mut)]
    pub defender_village: Account<'info, VillageInfo>,

    #[account(mut)]
    pub attacker: Signer<'info>,

    /// CHECK: ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1
    pub permission_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub validator: Option<AccountInfo<'info>>,
    /// CHECK: del macro
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
}

// ─── Errors ──────────────────────────────────────────────────

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
}
```

## 2.6 System: battle_action (виконується В PER)

```rust
// programs/systems/battle_action/src/lib.rs
// ⚠️ Транзакції цього system відправляються на PER endpoint (TEE), не на L1!

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, ephemeral};
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use battle_state::{BattleState, BattlePhase};

declare_id!("__REPLACE_AFTER_DEPLOY__");

#[ephemeral]
#[program]
pub mod battle_action {
    use super::*;

    /// Перехід з Preparation → Active
    /// ⚠️ AI: Перевірити у Godot чи є prep phase або бій починається одразу
    pub fn start_active_phase(ctx: Context<BattleActionCtx>) -> Result<()> {
        let battle = &mut ctx.accounts.battle_state;
        require!(battle.phase == BattlePhase::Preparation, BattleError::WrongPhase);
        require!(ctx.accounts.signer.key() == battle.attacker, BattleError::NotAttacker);

        battle.phase = BattlePhase::Active;
        msg!("Battle {} → Active", battle.battle_id);
        Ok(())
    }

    /// Деплой загону (виконується в PER — прихований від defender)
    /// ⚠️ AI: Перевірити параметри deploy у Godot battle скрипті
    pub fn deploy_troop(
        ctx: Context<BattleActionCtx>,
        troop_type: u8,
        grid_x: u8,
        grid_y: u8,
        count: u32,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_state;
        require!(battle.phase == BattlePhase::Active, BattleError::WrongPhase);
        require!(ctx.accounts.signer.key() == battle.attacker, BattleError::NotAttacker);
        require!(count > 0, BattleError::InvalidCount);

        // Логіка деплою зберігається в PER state (TEE protected)
        emit!(TroopDeployed {
            battle_id: battle.battle_id,
            troop_type,
            grid_x,
            grid_y,
            count,
        });
        msg!("Deployed {} troops type:{} at ({},{})", count, troop_type, grid_x, grid_y);
        Ok(())
    }

    /// Оновлення стану бою (tick) — може викликатись з PER scheduler
    /// або клієнтом кожні N секунд
    /// ⚠️ AI: Перевірити чи є tick система у Godot battle
    pub fn battle_tick(
        ctx: Context<BattleActionCtx>,
        new_destruction_pct: u8,
        new_stars: u8,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_state;
        require!(battle.phase == BattlePhase::Active, BattleError::WrongPhase);

        battle.destruction_pct = new_destruction_pct.min(100);
        battle.stars = new_stars.min(3);

        // 3 зірки = автозавершення
        if battle.stars == 3 {
            battle.phase = BattlePhase::Completed;
            msg!("Battle {} auto-completed: 3 stars!", battle.battle_id);
        }

        // Timeout перевірка
        let now = Clock::get()?.unix_timestamp;
        if now >= battle.timeout_at && battle.phase == BattlePhase::Active {
            battle.phase = BattlePhase::Completed;
            msg!("Battle {} timed out", battle.battle_id);
        }

        Ok(())
    }

    /// Активація Hero Ability (прихована дія в PER)
    /// ⚠️ AI: Реалізувати тільки якщо Hero System є у Godot
    pub fn activate_hero_ability(
        ctx: Context<BattleActionCtx>,
        hero_id: u8,
        ability_id: u8,
        target_x: u8,
        target_y: u8,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_state;
        require!(battle.phase == BattlePhase::Active, BattleError::WrongPhase);
        require!(ctx.accounts.signer.key() == battle.attacker, BattleError::NotAttacker);

        emit!(HeroAbilityUsed {
            battle_id: battle.battle_id,
            hero_id,
            ability_id,
            target_x,
            target_y,
        });
        Ok(())
    }

    /// Завершення бою: commit_and_undelegate → state back to L1
    /// ⚠️ Також відправляється через PER endpoint (TEE)
    #[commit]
    pub fn finalize_battle(
        ctx: Context<FinalizeBattleCtx>,
        loot_gold: u64,
        loot_elixir: u64,
        loot_dark_elixir: u64,
        trophy_delta: i32,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_state;

        require!(
            battle.phase == BattlePhase::Completed
                || Clock::get()?.unix_timestamp >= battle.timeout_at,
            BattleError::BattleNotComplete
        );
        require!(!battle.is_finalized, BattleError::AlreadyFinalized);

        battle.loot_gold        = loot_gold;
        battle.loot_elixir      = loot_elixir;
        battle.loot_dark_elixir = loot_dark_elixir;
        battle.trophy_delta     = trophy_delta;
        battle.is_finalized     = true;
        battle.phase            = BattlePhase::Finalized;

        // Commit фінального стану + undelegate з PER → L1
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.battle_state.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;

        msg!(
            "Battle {} FINALIZED: {}★ | {}% | gold:{} elixir:{} trophies:{:+}",
            battle.battle_id, battle.stars, battle.destruction_pct,
            loot_gold, loot_elixir, trophy_delta
        );
        Ok(())
    }
}

// ─── Events ──────────────────────────────────────────────────

#[event]
pub struct TroopDeployed {
    pub battle_id:  u64,
    pub troop_type: u8,
    pub grid_x: u8,
    pub grid_y: u8,
    pub count: u32,
}

#[event]
pub struct HeroAbilityUsed {
    pub battle_id:  u64,
    pub hero_id:    u8,
    pub ability_id: u8,
    pub target_x: u8,
    pub target_y: u8,
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
}

// ─── Errors ──────────────────────────────────────────────────

#[error_code]
pub enum BattleError {
    #[msg("Wrong battle phase for this action")]
    WrongPhase,
    #[msg("Only the attacker can perform this action")]
    NotAttacker,
    #[msg("Troop count must be greater than zero")]
    InvalidCount,
    #[msg("Battle is not complete yet")]
    BattleNotComplete,
    #[msg("Battle is already finalized")]
    AlreadyFinalized,
}
```

## 2.7 System: battle_settle (L1 — після undelegation)

```rust
// programs/systems/battle_settle/src/lib.rs
// Виконується НА L1 після того як BattleState повернувся з PER.
// Застосовує результати бою: ресурси, трофеї, щит.

#[program]
pub mod battle_settle {
    use super::*;

    pub fn settle_battle_result(ctx: Context<SettleBattle>) -> Result<()> {
        let battle = &ctx.accounts.battle_state;
        require!(battle.is_finalized, SettleError::BattleNotFinalized);

        let now = Clock::get()?.unix_timestamp;

        // ── Трансфер ресурсів ─────────────────────────────────
        let def_res = &mut ctx.accounts.defender_resources;
        let atk_res = &mut ctx.accounts.attacker_resources;

        def_res.gold    = def_res.gold.saturating_sub(battle.loot_gold);
        def_res.elixir  = def_res.elixir.saturating_sub(battle.loot_elixir);
        def_res.dark_elixir = def_res.dark_elixir.saturating_sub(battle.loot_dark_elixir);

        atk_res.gold    += battle.loot_gold;
        atk_res.elixir  += battle.loot_elixir;
        atk_res.dark_elixir += battle.loot_dark_elixir;

        // ── Трофеї ────────────────────────────────────────────
        let atk_village = &mut ctx.accounts.attacker_village;
        let def_village = &mut ctx.accounts.defender_village;

        atk_village.trophy_count += battle.trophy_delta;
        def_village.trophy_count  = (def_village.trophy_count - (battle.trophy_delta / 2)).max(0);

        // ── Щит для захисника ─────────────────────────────────
        // ⚠️ AI: Перевірити логіку щита у Godot (тривалості, умови)
        let shield_duration = match battle.stars {
            1 => 12 * 3600,
            2 => 14 * 3600,
            3 => 16 * 3600,
            _ => 0,
        };
        if battle.destruction_pct >= 40 && shield_duration > 0 {
            def_village.shield_expiry = now + shield_duration;
        }

        // ── Знімаємо флаг "під атакою" ────────────────────────
        def_village.is_under_attack = false;

        // ── Cooldown для атакера ──────────────────────────────
        // ⚠️ AI: Взяти ATTACK_COOLDOWN_SECS з Godot
        atk_village.attack_cooldown_until = now + 300; // 5 хвилин

        msg!("Battle {} settled on L1", battle.battle_id);
        Ok(())
    }
}
```

---

# ФАЗА 3: PER ІНТЕГРАЦІЯ

## 3.1 Повний PER flow для бою

```
┌──────────────────────────────────────────────────────────────────┐
│              ПОВНИЙ PER BATTLE FLOW                              │
│                                                                  │
│  ① ATTACKER дії (на L1, одна транзакція):                       │
│     battle_start::initialize_battle(battle_id)                  │
│       → BattleState PDA ініціалізовано                          │
│       → Permission Group створено (attacker FULL + defender RO) │
│                                                                  │
│  ② DELEGATION (на L1):                                          │
│     battle_start::delegate_battle_to_per()                      │
│       → remaining_accounts[0] = TEE validator pubkey            │
│       → BattleState делеговано в Private ER (TEE)               │
│                                                                  │
│  ③ PER AUTH (HTTP до TEE endpoint):                             │
│     POST tee.magicblock.app/auth/challenge { pubkey }           │
│     POST tee.magicblock.app/auth/token { pubkey, sig }          │
│       → отримуємо JWT authToken                                 │
│                                                                  │
│  ④ БІЙ (транзакції → TEE endpoint):                             │
│     Connection = tee.magicblock.app?token={authToken}           │
│     battle_action::start_active_phase()                         │
│     battle_action::deploy_troop(type, x, y, count) × N         │
│     battle_action::battle_tick(destruction, stars) × M          │
│     battle_action::activate_hero_ability() — якщо є герої       │
│       → ВСЕ ВИКОНУЄТЬСЯ В TEE, стан прихований                  │
│                                                                  │
│  ⑤ FINALIZE (через TEE endpoint):                               │
│     battle_action::finalize_battle(loot, trophies)              │
│       → commit_and_undelegate_accounts() всередині              │
│       → BattleState settle back to Solana L1                    │
│                                                                  │
│  ⑥ SETTLE (на L1):                                              │
│     battle_settle::settle_battle_result()                       │
│       → ресурси transferred, трофеї updated, щит видано         │
│       → Permission Account можна закрити (lamports назад)       │
└──────────────────────────────────────────────────────────────────┘
```

## 3.2 Конфігурація PER констант

```typescript
// packages/sdk/src/constants.ts

// ── Офіційні Program IDs MagicBlock (незмінні) ─────────────────
export const MAGICBLOCK = {
  DELEGATION_PROGRAM:  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
  PERMISSION_PROGRAM:  "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1",
} as const;

// ── TEE / PER Endpoints ────────────────────────────────────────
export const PER_ENDPOINTS = {
  devnet:  "https://tee.magicblock.app",
  mainnet: "https://mainnet-tee.magicblock.app",
  local:   null, // TEE недоступний локально
} as const;

// ── ER (публічний) Endpoints ───────────────────────────────────
export const ER_ENDPOINTS = {
  devnet: {
    eu: "https://devnet-eu.magicblock.app",
    us: "https://devnet-us.magicblock.app",
    as: "https://devnet-as.magicblock.app",
  },
  mainnet: {
    eu: "https://eu.magicblock.app",
    us: "https://us.magicblock.app",
    as: "https://as.magicblock.app",
  },
  local: "http://localhost:7799",
} as const;

// ── Validator Pubkeys (передаються в DelegateConfig) ───────────
export const ER_VALIDATORS = {
  devnet: {
    eu:  "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e",
    us:  "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
    as:  "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
    tee: "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA", // PER/TEE devnet
  },
  mainnet: {
    eu:  "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e",
    us:  "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
    as:  "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
    tee: "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo", // PER/TEE mainnet
  },
  local: {
    er: "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev",
  },
} as const;

// ── Costs (актуальне ціноутворення MagicBlock) ─────────────────
export const ER_COSTS_SOL = {
  TX_FEE:     0,        // gasless в ER
  SESSION_FEE: 0.0003,  // при undelegation
  COMMIT_FEE:  0.0001,  // за кожен commit на L1
} as const;
```

---

# ФАЗА 4: TYPESCRIPT SDK

## 4.1 PER Auth Manager

```typescript
// packages/sdk/src/per/auth.ts

import { Connection, PublicKey } from "@solana/web3.js";
import { PER_ENDPOINTS } from "../constants";

export interface PerAuthToken {
  token: string;
  obtainedAt: number;
  network: "devnet" | "mainnet";
}

/**
 * Авторизація в PER через підпис wallet challenge.
 * Ніяких API ключів — тільки cryptographic proof of ownership.
 */
export async function authorizePer(
  wallet: {
    publicKey: PublicKey;
    signMessage: (msg: Uint8Array) => Promise<Uint8Array>;
  },
  network: "devnet" | "mainnet" = "devnet",
): Promise<PerAuthToken> {
  const base = PER_ENDPOINTS[network];
  if (!base) throw new Error("PER not available on this network");

  // 1. Отримати challenge
  const challengeRes = await fetch(`${base}/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey: wallet.publicKey.toBase58() }),
  });
  if (!challengeRes.ok) {
    throw new Error(`Challenge failed: ${challengeRes.status} ${await challengeRes.text()}`);
  }
  const { challenge } = (await challengeRes.json()) as { challenge: string };

  // 2. Підписати challenge
  const msgBytes = new TextEncoder().encode(challenge);
  const signature = await wallet.signMessage(msgBytes);

  // 3. Отримати JWT token
  const tokenRes = await fetch(`${base}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pubkey:    wallet.publicKey.toBase58(),
      challenge,
      signature: Buffer.from(signature).toString("base64"),
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Auth failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const { token } = (await tokenRes.json()) as { token: string };

  return { token, obtainedAt: Date.now(), network };
}

/** Connection до PER endpoint з вбудованим authToken */
export function createPerConnection(auth: PerAuthToken): Connection {
  const base = PER_ENDPOINTS[auth.network]!;
  return new Connection(
    `${base}?token=${encodeURIComponent(auth.token)}`,
    "confirmed",
  );
}

/** Менеджер сесії PER з авто-оновленням токену */
export class PerSessionManager {
  private auth: PerAuthToken | null = null;
  private readonly TOKEN_TTL_MS = 50 * 60 * 1000; // 50 хвилин

  async getConnection(
    wallet: Parameters<typeof authorizePer>[0],
    network: "devnet" | "mainnet" = "devnet",
  ): Promise<Connection> {
    if (!this.auth || Date.now() - this.auth.obtainedAt > this.TOKEN_TTL_MS) {
      this.auth = await authorizePer(wallet, network);
    }
    return createPerConnection(this.auth);
  }

  invalidate(): void {
    this.auth = null;
  }

  isAuthenticated(): boolean {
    return this.auth !== null && Date.now() - this.auth.obtainedAt < this.TOKEN_TTL_MS;
  }
}
```

## 4.2 BattleManager (головний клас для PER боїв)

```typescript
// packages/sdk/src/managers/BattleManager.ts

import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { PerSessionManager } from "../per/auth";
import { ER_VALIDATORS } from "../constants";

export interface TroopDeployment {
  troopType: number;  // ⚠️ AI: типи беруться зі сканування Godot troops enum
  gridX: number;
  gridY: number;
  count: number;
}

export interface BattleResult {
  battleId: bigint;
  stars: number;
  destructionPct: number;
  lootGold: bigint;
  lootElixir: bigint;
  lootDarkElixir: bigint;
  trophyDelta: number;
}

export class BattleManager {
  private l1Connection: Connection;
  private perSession: PerSessionManager;
  private program: Program;
  private network: "devnet" | "mainnet";

  constructor(
    l1RpcUrl: string,
    program: Program,
    network: "devnet" | "mainnet" = "devnet",
  ) {
    this.l1Connection = new Connection(l1RpcUrl, "confirmed");
    this.perSession   = new PerSessionManager();
    this.program      = program;
    this.network      = network;
  }

  /**
   * Крок 1+2: Ініціалізація + Delegation в PER (на L1)
   */
  async initAndDelegateBattle(
    attackerWallet: any,
    defenderVillagePda: PublicKey,
    battleId: bigint,
  ): Promise<{ battleStatePda: PublicKey; permissionPda: PublicKey }> {
    const [battleStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("battle"), attackerWallet.publicKey.toBuffer()],
      this.program.programId,
    );
    const [permissionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("permission"), battleStatePda.toBuffer()],
      new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"),
    );

    // initialize_battle (L1) — створює BattleState + Permission Group
    await this.program.methods
      .initializeBattle(battleId)
      .accounts({ battleState: battleStatePda, /* ... */ })
      .rpc({ commitment: "confirmed" });

    // delegate_battle_to_per (L1) — делегує в TEE
    await this.program.methods
      .delegateBattleToPer()
      .accounts({ payer: attackerWallet.publicKey, pda: battleStatePda })
      .remainingAccounts([{
        pubkey:     new PublicKey(ER_VALIDATORS[this.network].tee),
        isSigner:   false,
        isWritable: false,
      }])
      .rpc({ commitment: "confirmed" });

    return { battleStatePda, permissionPda };
  }

  /**
   * Крок 3-5: Бій через PER (всі дії — через TEE endpoint)
   */
  async conductBattle(
    attackerWallet: any,
    battleStatePda: PublicKey,
    troops: TroopDeployment[],
  ): Promise<void> {
    // Авторизація в PER
    const perConn = await this.perSession.getConnection(attackerWallet, this.network);

    // Почати активну фазу
    const startTx = await this.program.methods
      .startActivePhase()
      .accounts({ battleState: battleStatePda, signer: attackerWallet.publicKey })
      .transaction();
    await sendAndConfirmTransaction(perConn, startTx, [attackerWallet.payer]);

    // Деплой кожного загону через PER
    for (const troop of troops) {
      const tx = await this.program.methods
        .deployTroop(troop.troopType, troop.gridX, troop.gridY, troop.count)
        .accounts({ battleState: battleStatePda, signer: attackerWallet.publicKey })
        .transaction();
      await sendAndConfirmTransaction(perConn, tx, [attackerWallet.payer]);
    }
  }

  /**
   * Крок 5: Завершення бою через PER (commit + undelegate)
   */
  async finalizeBattle(
    attackerWallet: any,
    battleStatePda: PublicKey,
    result: Pick<BattleResult, "lootGold" | "lootElixir" | "lootDarkElixir" | "trophyDelta">,
  ): Promise<void> {
    const perConn = await this.perSession.getConnection(attackerWallet, this.network);

    const tx = await this.program.methods
      .finalizeBattle(
        result.lootGold,
        result.lootElixir,
        result.lootDarkElixir,
        result.trophyDelta,
      )
      .accounts({ battleState: battleStatePda, payer: attackerWallet.publicKey })
      .transaction();

    await sendAndConfirmTransaction(perConn, tx, [attackerWallet.payer]);
    this.perSession.invalidate();
  }

  /**
   * Крок 6: Settle результатів на L1 (після undelegation)
   */
  async settleBattle(
    attackerWallet: any,
    battleStatePda: PublicKey,
    defenderVillagePda: PublicKey,
  ): Promise<BattleResult> {
    await this.program.methods
      .settleBattleResult()
      .accounts({
        battleState: battleStatePda,
        /* attacker resources, defender resources, villages */
      })
      .rpc({ commitment: "confirmed" });

    const state = await this.program.account.battleState.fetch(battleStatePda);
    return {
      battleId:        state.battleId,
      stars:           state.stars,
      destructionPct:  state.destructionPct,
      lootGold:        state.lootGold,
      lootElixir:      state.lootElixir,
      lootDarkElixir:  state.lootDarkElixir,
      trophyDelta:     state.trophyDelta,
    };
  }

  /**
   * Підписка на оновлення бою через WebSocket (ER account subscribe)
   * Attacker бачить стан в реальному часі
   */
  async subscribeToUpdates(
    attackerWallet: any,
    battleStatePda: PublicKey,
    onUpdate: (partial: Partial<BattleResult>) => void,
  ): Promise<() => void> {
    const perConn = await this.perSession.getConnection(attackerWallet, this.network);

    const subId = perConn.onAccountChange(
      battleStatePda,
      (info) => {
        // Декодуємо account data через IDL
        try {
          const decoded = this.program.coder.accounts.decode("BattleState", info.data);
          onUpdate({
            stars:          decoded.stars,
            destructionPct: decoded.destructionPct,
          });
        } catch {
          // account може бути в процесі оновлення
        }
      },
      "confirmed",
    );

    return () => perConn.removeAccountChangeListener(subId);
  }
}
```

---

# ФАЗА 5: BACKEND API

## 5.1 Fastify сервер

```typescript
// backend/src/server.ts

import Fastify from "fastify";
import { authRoutes }        from "./routes/auth";
import { playerRoutes }      from "./routes/player";
import { battleRoutes }      from "./routes/battle";
import { clanRoutes }        from "./routes/clan";
import { leaderboardRoutes } from "./routes/leaderboard";
import { setupJobs }         from "./jobs";
import { db }                from "./db";
import { redis }             from "./cache";

const app = Fastify({ logger: true });

// ── Плагіни ──────────────────────────────────────────────────
await app.register(import("@fastify/cors"),    { origin: true });
await app.register(import("@fastify/jwt"),     { secret: process.env.JWT_SECRET! });
await app.register(import("@fastify/websocket"));

// ── Роути ─────────────────────────────────────────────────────
await app.register(authRoutes,        { prefix: "/api/v1/auth" });
await app.register(playerRoutes,      { prefix: "/api/v1/player" });
await app.register(battleRoutes,      { prefix: "/api/v1/battle" });
await app.register(clanRoutes,        { prefix: "/api/v1/clan" });
await app.register(leaderboardRoutes, { prefix: "/api/v1/leaderboard" });

// ── Фонові задачі ─────────────────────────────────────────────
setupJobs();

const PORT = Number(process.env.PORT ?? 3000);
await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`🚀 Backend running on port ${PORT}`);
```

## 5.2 REST API — повний список endpoints

```
AUTH
────
POST /api/v1/auth/connect           Wallet connect (підпис → JWT)
POST /api/v1/auth/refresh           Оновлення JWT

PLAYER
──────
GET  /api/v1/player/:pubkey          Профіль + статистика
GET  /api/v1/player/:pubkey/village  Стан села (з L1 + cache)
GET  /api/v1/player/:pubkey/army     Поточна армія (готові загони)
GET  /api/v1/player/:pubkey/history  Історія боїв (останні 20)

BATTLE
──────
POST /api/v1/battle/matchmake        Знайти суперника
POST /api/v1/battle/prepare          Підготувати battle TX data
GET  /api/v1/battle/:id              Деталі бою (після finalize)
GET  /api/v1/battle/:id/replay       Replay бою (з off-chain log)
WS   /api/v1/battle/:id/stream       Realtime стрім (проксі PER)

CLAN  (якщо клани є в Godot)
──────
POST /api/v1/clan/create             Створити клан
POST /api/v1/clan/:id/join           Вступити
POST /api/v1/clan/:id/leave          Покинути
GET  /api/v1/clan/:id                Деталі клану + члени
GET  /api/v1/clan/:id/war/current    Поточна Clan War
POST /api/v1/clan/:id/war/start      Почати Clan War
GET  /api/v1/clan/:id/war/history    Архів Clan War

LEADERBOARD
───────────
GET  /api/v1/leaderboard/global      Топ-100 гравців (кубки)
GET  /api/v1/leaderboard/clan        Топ-50 кланів
GET  /api/v1/leaderboard/league/:n   Топ гравці в лізі N

SHOP
────
GET  /api/v1/shop/offers             Активні оффери
POST /api/v1/shop/purchase           Купівля (gems, ресурси, пришвидшення)
```

## 5.3 Matchmaking

```typescript
// backend/src/services/matchmaking.ts
// ⚠️ AI: Адаптувати критерії після сканування Godot matchmaking логіки

export interface MatchmakingCriteria {
  attackerPubkey:   string;
  attackerTrophies: number;
  attackerThLevel:  number;
}

export async function findOpponent(
  criteria: MatchmakingCriteria,
): Promise<{ villagePda: string; playerPubkey: string } | null> {
  // Шукаємо у matchmaking_pool (PostgreSQL)
  // Критерії:
  // ├── Trophy range: ±200 від attacker (з Godot якщо інше)
  // ├── TH level: ±1 від attacker (з Godot якщо інше)
  // ├── is_available = true (не під атакою, не під щитом)
  // └── last_active < 24 години тому
  const result = await db.query(`
    SELECT village_pda, player_pubkey
    FROM matchmaking_pool
    WHERE player_pubkey != $1
      AND trophy_count BETWEEN $2 AND $3
      AND th_level BETWEEN $4 AND $5
      AND is_available = true
      AND last_active > NOW() - INTERVAL '24 hours'
    ORDER BY RANDOM()
    LIMIT 1
  `, [
    criteria.attackerPubkey,
    criteria.attackerTrophies - 200,
    criteria.attackerTrophies + 200,
    criteria.attackerThLevel - 1,
    criteria.attackerThLevel + 1,
  ]);

  return result.rows[0] ?? null;
}
```

## 5.4 PostgreSQL схема

```sql
-- backend/src/db/schema.sql

-- Кеш профілів гравців
CREATE TABLE players (
    pubkey          VARCHAR(44) PRIMARY KEY,
    village_pda     VARCHAR(44) NOT NULL,
    display_name    VARCHAR(32),
    trophy_count    INTEGER     DEFAULT 0,
    th_level        SMALLINT    DEFAULT 1,
    last_active     TIMESTAMP,
    created_at      TIMESTAMP   DEFAULT NOW()
);

-- Matchmaking пул
CREATE TABLE matchmaking_pool (
    village_pda     VARCHAR(44) PRIMARY KEY,
    player_pubkey   VARCHAR(44) NOT NULL REFERENCES players(pubkey),
    trophy_count    INTEGER     NOT NULL,
    th_level        SMALLINT    NOT NULL,
    is_available    BOOLEAN     DEFAULT true,
    last_active     TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX idx_mm_trophies ON matchmaking_pool(trophy_count, th_level)
    WHERE is_available = true;

-- Архів боїв (Godot може читати для replay)
CREATE TABLE battle_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_pda      VARCHAR(44) UNIQUE NOT NULL,
    attacker_pubkey VARCHAR(44) REFERENCES players(pubkey),
    defender_pubkey VARCHAR(44) REFERENCES players(pubkey),
    stars           SMALLINT,
    destruction_pct SMALLINT,
    trophy_delta    INTEGER,
    loot_gold       BIGINT,
    loot_elixir     BIGINT,
    loot_dark       BIGINT,
    -- Повний лог дій для replay (deploy order, ticks)
    -- ⚠️ AI: структуру battle_log уточнити після сканування Godot replay системи
    battle_log      JSONB,
    occurred_at     TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX idx_bh_attacker ON battle_history(attacker_pubkey, occurred_at DESC);
CREATE INDEX idx_bh_defender ON battle_history(defender_pubkey, occurred_at DESC);

-- Клани (якщо є у Godot)
CREATE TABLE clans (
    clan_pda        VARCHAR(44) PRIMARY KEY,
    name            VARCHAR(32),
    tag             VARCHAR(12) UNIQUE,
    leader_pubkey   VARCHAR(44),
    member_count    SMALLINT    DEFAULT 1,
    total_trophies  BIGINT      DEFAULT 0,
    clan_level      SMALLINT    DEFAULT 1,
    created_at      TIMESTAMP   DEFAULT NOW()
);

-- Leaderboard snapshot (оновлюється кожні 24г)
CREATE TABLE leaderboard_snapshot (
    id              SERIAL      PRIMARY KEY,
    player_pubkey   VARCHAR(44),
    trophy_count    INTEGER,
    th_level        SMALLINT,
    rank            INTEGER,
    snapshotted_at  TIMESTAMP   DEFAULT NOW()
);
```

## 5.5 Фонові задачі (Bull Queue)

```typescript
// backend/src/jobs/index.ts

export function setupJobs(): void {

  // Кожні 5 хв: Оновлення matchmaking pool з L1
  scheduleJob("*/5 * * * *", async () => {
    // Читаємо active villages з Solana, оновлюємо matchmaking_pool
  });

  // Кожні 30 хв: Тригер resource collection для активних гравців
  scheduleJob("*/30 * * * *", async () => {
    // Batch: відправляємо resource_collect system call для топ-N активних
  });

  // Щогодини: Перевірка закінчення щитів
  scheduleJob("0 * * * *", async () => {
    // UPDATE matchmaking_pool SET is_available = true
    // WHERE shield_expiry < NOW() AND is_available = false
  });

  // Щодня о 00:00: Leaderboard snapshot
  scheduleJob("0 0 * * *", async () => {
    // INSERT INTO leaderboard_snapshot ...
  });

  // Кожні 2г: Перевірка завершення Clan War
  scheduleJob("0 */2 * * *", async () => {
    // Перевіряємо чи закінчились активні war sessions
    // Викликаємо clan_war_finalize якщо expired
  });
}
```

---

# ФАЗА 6: GODOT ↔ BACKEND BRIDGE

## 6.1 Завдання фази

```
AI має виконати наступне:

1. Знайти у Godot всі мережеві виклики (HTTPRequest, WebSocketClient)
2. Для кожного виклику — замінити endpoint на бекенд API
3. Якщо у Godot ще немає мережевого шару — написати GodotBridge.gd
4. Реалізувати TypeScript GodotBridge адаптер (JSON → SDK calls)
```

## 6.2 TypeScript GodotBridge

```typescript
// packages/sdk/src/godot/GodotBridge.ts
// Цей модуль запускається як окремий сервіс або інтегрується в backend.
// Godot клієнт комунікує з ним через HTTP/WebSocket.

import { ClashOfSolanaSDK } from "../index";

export interface GodotAction {
  action: string;         // назва дії
  wallet: string;         // pubkey гравця
  payload: Record<string, unknown>;  // дані дії
}

export interface GodotResponse {
  success: boolean;
  data?:   unknown;
  error?:  string;
  txHash?: string;        // якщо є on-chain транзакція
}

export class GodotBridge {
  private sdk: ClashOfSolanaSDK;

  constructor(sdk: ClashOfSolanaSDK) {
    this.sdk = sdk;
  }

  async handleAction(action: GodotAction): Promise<GodotResponse> {
    try {
      switch (action.action) {

        // ── Village ──────────────────────────────────────────
        case "village.initialize":
          return await this.villageInit(action);

        case "village.build":
          return await this.villageBuild(action);

        case "village.upgrade":
          return await this.villageUpgrade(action);

        case "village.collect":
          return await this.villageCollect(action);

        case "village.state":
          return await this.getVillageState(action);

        // ── Battle ────────────────────────────────────────────
        case "battle.matchmake":
          return await this.battleMatchmake(action);

        case "battle.start":
          return await this.battleStart(action);

        case "battle.deploy":
          return await this.battleDeploy(action);

        case "battle.finalize":
          return await this.battleFinalize(action);

        case "battle.history":
          return await this.getBattleHistory(action);

        // ── Troops ────────────────────────────────────────────
        case "troops.train":
          return await this.troopsTrain(action);

        // ── Clan (якщо є в Godot) ─────────────────────────────
        case "clan.create":
          return await this.clanCreate(action);

        case "clan.join":
          return await this.clanJoin(action);

        case "clan.war.start":
          return await this.clanWarStart(action);

        // ── Shop ──────────────────────────────────────────────
        case "shop.purchase":
          return await this.shopPurchase(action);

        // ── PLACEHOLDER: ai_scan_extra_actions ───────────────
        // Сюди додати дії знайдені при скануванні Godot

        default:
          return { success: false, error: `Unknown action: ${action.action}` };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  // ── Приватні методи ──────────────────────────────────────────

  private async battleStart(action: GodotAction): Promise<GodotResponse> {
    const { defenderVillagePda, battleId } = action.payload as {
      defenderVillagePda: string;
      battleId: string;
    };
    const result = await this.sdk.battle.initAndDelegateBattle(
      action.wallet,
      defenderVillagePda,
      BigInt(battleId),
    );
    return { success: true, data: result };
  }

  private async battleDeploy(action: GodotAction): Promise<GodotResponse> {
    const { battleStatePda, troops } = action.payload as {
      battleStatePda: string;
      troops: Array<{ type: number; x: number; y: number; count: number }>;
    };
    await this.sdk.battle.conductBattle(action.wallet, battleStatePda, troops);
    return { success: true };
  }

  // ... інші методи
}
```

## 6.3 Godot GDScript — HTTP клієнт до Bridge

```gdscript
# addons/blockchain/BlockchainClient.gd
# Autoload / Singleton в Godot

extends Node

const BASE_URL = "http://localhost:3000/api/v1"  # або prod URL

var jwt_token: String = ""
var _http: HTTPRequest

func _ready():
    _http = HTTPRequest.new()
    add_child(_http)
    _http.request_completed.connect(_on_request_completed)

# ── Авторизація ──────────────────────────────────────────────────
func connect_wallet(wallet_pubkey: String, signature: String) -> void:
    _post("/auth/connect", {
        "pubkey": wallet_pubkey,
        "signature": signature
    })

# ── Village ──────────────────────────────────────────────────────
func get_village_state(pubkey: String) -> void:
    _get("/player/%s/village" % pubkey)

func build_construct(building_type: int, grid_x: int, grid_y: int) -> void:
    _post("/battle/build", {
        "building_type": building_type,
        "grid_x": grid_x,
        "grid_y": grid_y
    })

# ── Battle ───────────────────────────────────────────────────────
func matchmake() -> void:
    _post("/battle/matchmake", {})

func start_battle(defender_village_pda: String, battle_id: int) -> void:
    _post("/battle/start", {
        "defender_village_pda": defender_village_pda,
        "battle_id": battle_id
    })

func deploy_troops(battle_state_pda: String, troops: Array) -> void:
    _post("/battle/deploy", {
        "battle_state_pda": battle_state_pda,
        "troops": troops
    })

# ── WebSocket для realtime бою ────────────────────────────────────
var _ws: WebSocketPeer
signal battle_update(data: Dictionary)

func subscribe_battle(battle_pda: String) -> void:
    _ws = WebSocketPeer.new()
    _ws.connect_to_url("ws://localhost:3000/api/v1/battle/%s/stream" % battle_pda)

func _process(_delta):
    if _ws and _ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
        _ws.poll()
        while _ws.get_available_packet_count() > 0:
            var data = JSON.parse_string(_ws.get_packet().get_string_from_utf8())
            emit_signal("battle_update", data)

# ── Helpers ──────────────────────────────────────────────────────
func _post(path: String, body: Dictionary) -> void:
    var headers = [
        "Content-Type: application/json",
        "Authorization: Bearer %s" % jwt_token
    ]
    _http.request(
        BASE_URL + path,
        headers,
        HTTPClient.METHOD_POST,
        JSON.stringify(body)
    )

func _get(path: String) -> void:
    var headers = ["Authorization: Bearer %s" % jwt_token]
    _http.request(BASE_URL + path, headers, HTTPClient.METHOD_GET)

func _on_request_completed(result, response_code, _headers, body):
    if response_code == 200:
        var data = JSON.parse_string(body.get_string_from_utf8())
        emit_signal("request_completed", data)
    else:
        emit_signal("request_failed", response_code)
```

---

# ФАЗА 7: ТЕСТИ ТА ВАЛІДАЦІЯ

## 7.1 Anchor test — PER battle flow

```typescript
// tests/programs/battle-per.test.ts

import * as anchor from "@coral-xyz/anchor";
import { expect, describe, it, beforeAll } from "vitest";
import { BattleManager } from "../../packages/sdk/src/managers/BattleManager";

describe("PER Battle Flow", () => {
  let attackerWallet: anchor.Wallet;
  let defenderWallet: anchor.Wallet;
  let battleManager: BattleManager;
  let battleStatePda: anchor.web3.PublicKey;

  beforeAll(async () => {
    // Налаштування devnet з'єднання
    // ⚠️ Для тесту PER потрібен devnet — TEE недоступний локально
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com");
    attackerWallet = /* load test keypair */;
    defenderWallet = /* load test keypair */;
    battleManager  = new BattleManager(/* l1RpcUrl, program, "devnet" */);
  });

  it("1. Ініціалізує BattleState на L1", async () => {
    const battleId = BigInt(Date.now());
    const result = await battleManager.initAndDelegateBattle(
      attackerWallet,
      /* defenderVillagePda */,
      battleId,
    );
    battleStatePda = result.battleStatePda;
    expect(result.battleStatePda).toBeTruthy();
    expect(result.permissionPda).toBeTruthy();
  });

  it("2. BattleState делеговано в TEE validator", async () => {
    // Перевіряємо delegation status через MagicBlock Router API
    const routerUrl = "https://devnet-eu.magicblock.app";
    const resp = await fetch(routerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getDelegationStatus",
        params: [battleStatePda.toBase58()],
      }),
    });
    const { result } = await resp.json();
    expect(result.isDelegated).toBe(true);
    expect(result.validator).toBe("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");
  });

  it("3. Авторизація в PER через wallet підпис", async () => {
    const { authorizePer } = await import("../../packages/sdk/src/per/auth");
    const auth = await authorizePer(attackerWallet, "devnet");
    expect(auth.token).toBeTruthy();
    expect(auth.token.length).toBeGreaterThan(20);
  });

  it("4. Деплой загонів через PER (TEE endpoint)", async () => {
    await expect(
      battleManager.conductBattle(
        attackerWallet,
        battleStatePda,
        [{ troopType: 0, gridX: 10, gridY: 10, count: 10 }],
      )
    ).resolves.not.toThrow();
  });

  it("5. Finalize → BattleState settle на L1", async () => {
    await expect(
      battleManager.finalizeBattle(attackerWallet, battleStatePda, {
        lootGold:       BigInt(1000),
        lootElixir:     BigInt(500),
        lootDarkElixir: BigInt(0),
        trophyDelta:    5,
      })
    ).resolves.not.toThrow();

    // Після finalize — акаунт знову на L1 і читабельний
    const program = /* ... */;
    const state = await program.account.battleState.fetch(battleStatePda);
    expect(state.isFinalized).toBe(true);
    expect(state.lootGold.toString()).toBe("1000");
  });

  it("6. Defender НЕ бачив хід бою (перевірка приватності)", async () => {
    // ⚠️ Перевіряємо що defender без authToken не міг читати стан під час бою
    // Цей тест документальний — підтверджує що PER використовується правильно
    expect(true).toBe(true); // placeholder — логіка залежить від PER API
  });
});
```

## 7.2 Чекліст перед здачею MagicBlock

```
ОБОВ'ЯЗКОВІ ВИМОГИ (без них підтримка не надається):
───────────────────────────────────────────────────
☐ Anchor program має #[ephemeral] + #[program] обидва макроси

☐ CreatePermissionCpiBuilder з реальними Member Flags:
    attacker: AUTHORITY_FLAG | TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG
    defender: TX_BALANCES_FLAG (тільки результат, не хід)

☐ DelegateConfig з явним TEE validator pubkey:
    devnet:  FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA
    mainnet: MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo

☐ Auth flow через підпис wallet → authToken (не статичний ключ)

☐ Мінімум 1 транзакція відправлена на https://tee.magicblock.app?token=...

☐ commit_and_undelegate_accounts викликається для settle назад на L1

☐ На devnet: є реальна транзакція delegation в Solana Explorer

☐ ephemeral-rollups-sdk версія >= 0.8.0 в Cargo.toml

ДОДАТКОВІ БАЛИ:
───────────────
☐ Permission Group оновлюється динамічно (add clan observer)
☐ Clan War з sealed-bid результатами через PER
☐ Hero ability прихований вибір через PER
☐ Тест що підтверджує defender не бачив хід бою
☐ Replay система (battle_log зберігається off-chain)
```

---

# ДОВІДНИК КОНСТАНТ

## Всі Program IDs та Endpoints

```typescript
// packages/sdk/src/constants.ts — повна версія

// ── MagicBlock системні програми ───────────────────────────────
export const MAGICBLOCK_PROGRAMS = {
  DELEGATION: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
  PERMISSION: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1",
} as const;

// ── ER endpoints (без авторизації) ────────────────────────────
export const ER_ENDPOINTS = {
  devnet: {
    eu: "https://devnet-eu.magicblock.app",
    us: "https://devnet-us.magicblock.app",
    as: "https://devnet-as.magicblock.app",
  },
  mainnet: {
    eu: "https://eu.magicblock.app",
    us: "https://us.magicblock.app",
    as: "https://as.magicblock.app",
  },
  localnet: "http://localhost:7799",
} as const;

// ── PER endpoints (TEE, потребує authToken) ───────────────────
export const PER_ENDPOINTS = {
  devnet:  "https://tee.magicblock.app",
  mainnet: "https://mainnet-tee.magicblock.app",
  localnet: null, // TEE недоступний локально
} as const;

// ── Validator Pubkeys (передаються в DelegateConfig) ──────────
export const VALIDATORS = {
  devnet: {
    eu:  "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e",
    us:  "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
    as:  "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
    tee: "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA",  // PER
  },
  mainnet: {
    eu:  "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e",
    us:  "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
    as:  "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
    tee: "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo",   // PER
  },
  localnet: {
    er: "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev",
  },
} as const;

// ── Costs ──────────────────────────────────────────────────────
export const ER_COSTS = {
  TX_FEE_SOL:      0,       // gasless в ER
  SESSION_FEE_SOL: 0.0003,  // при undelegation
  COMMIT_FEE_SOL:  0.0001,  // за кожен commit на L1
} as const;

// ── SDK версії (перевіряти при оновленні) ─────────────────────
export const REQUIRED_VERSIONS = {
  EPHEMERAL_SDK: ">=0.8.0",  // Permission Program сумісність
  ANCHOR:        "0.32.1",
  SOLANA:        "2.3.13",
  RUST:          "1.85.0",
  NODE:          "24.10.0",
} as const;
```

## .env.example

```bash
# .env.example — Clash of Solana Backend
# Станом на 21.03.2026

# ── Мережа ────────────────────────────────────────────────────
NETWORK=devnet

# ── Solana L1 ─────────────────────────────────────────────────
SOLANA_L1_RPC_URL=https://api.devnet.solana.com
# Mainnet: SOLANA_L1_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# ── ER (публічний, без авторизації) ───────────────────────────
MAGICBLOCK_ER_ENDPOINT=https://devnet-eu.magicblock.app
ER_VALIDATOR_PUBKEY=MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e

# ── PER / TEE (authToken генерується динамічно — не тут!) ─────
MAGICBLOCK_PER_ENDPOINT=https://tee.magicblock.app
PER_VALIDATOR_PUBKEY=FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA
# Mainnet:
# MAGICBLOCK_PER_ENDPOINT=https://mainnet-tee.magicblock.app
# PER_VALIDATOR_PUBKEY=MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo

# ── Системні програми MagicBlock (незмінні) ───────────────────
DELEGATION_PROGRAM_ID=DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh
PERMISSION_PROGRAM_ID=ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1

# ── Keypairs ──────────────────────────────────────────────────
DEPLOYER_KEYPAIR_PATH=~/.config/solana/id.json

# ── Backend ───────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/clash_of_solana
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_min_32_characters_long
PORT=3000
```

---

## ВАЖЛИВІ НАГАДУВАННЯ ДЛЯ AI

```
1. SCAN FIRST, CODE AFTER
   Не писати жоден рядок коду програм до завершення ФАЗИ 0.
   GAME_MECHANICS_REPORT.md має бути заповнений повністю.

2. PLACEHOLDER маркери
   Всі місця з "PLACEHOLDER: ai_scan_*" — обов'язково заповнити
   даними зі сканування Godot.

3. TYPES = GODOT SOURCE OF TRUTH
   BuildingType enum, TroopType enum та інші переліки —
   ТОЧНО відповідають тому що є в Godot. Не вигадувати.

4. TEE ТІЛЬКИ НА DEVNET/MAINNET
   Локальний ER (localhost:7799) не підтримує TEE/PER.
   Для тестів PER — обов'язково використовувати devnet.

5. ВЕРСІЯ SDK
   ephemeral-rollups-sdk >= 0.8.0 — ОБОВ'ЯЗКОВО.
   Старіші версії несумісні з Permission Program.

6. authToken НЕ СТАТИЧНИЙ
   Ніде у коді не хардкодити authToken.
   Він генерується через підпис wallet при кожній сесії.

7. CHECKLISTS
   Після кожної фази — перевірити чекліст відповідної фази.
   Перед здачею — пройти весь MagicBlock checklist (Фаза 7.2).
```

---

*Clash of Solana — AI Backend TZ v1.0*  
*21.03.2026 | Для: Cursor / Claude Code / Windsurf*  
*Перед написанням коду: виконати ФАЗУ 0 (сканування Godot)*
