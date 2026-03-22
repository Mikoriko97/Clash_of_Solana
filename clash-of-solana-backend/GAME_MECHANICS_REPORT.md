# GAME MECHANICS REPORT
Дата сканування: 21.03.2026
Godot версія: 4.6 (Forward Plus)
Проєкт: Work (Clash of Solana)

## СУТНОСТІ ТА ПОЛЯ СТАНУ

### Village / Base
Godot файл: `scripts/game_manager.gd`
Структура: Island View (3D) + World Map (2D) з Cloud Transition
Поля стану:
  - current_view: enum View { ISLAND, WORLD_MAP } → u8

### Building System
Godot файл: `scripts/building_system.gd`
Grid: 27×27 cells, вирівняно по gridPlane
Поля стану:
  - grid_width: int = 27 → u8
  - grid_height: int = 27 → u8
  - grid: Array[bool] → on-chain bitmap
  - placed_buildings: Array[Dictionary] → Vec<BuildingData>
    - id: String → BuildingType enum
    - grid_pos: Vector2i → (grid_x: u8, grid_y: u8)
    - level: int (1-3) → u8
    - hp: int → u32
    - max_hp: int → u32

### Building Definitions (з building_system.gd)
Типи будівель знайдені:
  1. **mine** — Mine, 3×3, HP: [1200, 2200, 3800], cost: {gold: 400, wood: 150}
  2. **barn** — Barn (Storage), 2×3, HP: [2000, 3500, 6000], cost: {gold: 200, wood: 200, ore: 100}
  3. **port** — Port, 3×3, HP: [1800, 3200, 5500], cost: {gold: 800, wood: 300, ore: 200}
  4. **sawmill** — Sawmill (acts as Barracks), 3×3, HP: [1200, 2200, 3800], cost: {gold: 300}
  5. **town_hall** — Town Hall (main, max_count: 1), 4×4, HP: [3500, 6000, 10000], cost: {}
  6. **turret** — Turret (defensive), 2×2, HP: [900, 1600, 2800], cost: {gold: 600, wood: 350, ore: 200}

### Resources
Godot файл: `scripts/building_system.gd` (line 85-89)
Знайдені ресурси:
  - **wood**: int = 1000 → u64 (soft-currency)
  - **gold**: int = 1000 → u64 (soft-currency)
  - **ore**: int = 1000 → u64 (soft-currency)

Типи: soft-currency (in-game)
**ВАЖЛИВО:** У грі НЕМАЄ elixir, dark_elixir, gems! Є wood, gold, ore.

HUD (hud.gd) показує цих ресурсів у World Map:
  - gold, wood, metal(ore) — відображаються на панелі ресурсів

### Troops
Godot файл: `scripts/base_troop.gd` + індивідуальні скрипти

Базовий клас BaseTroop поля:
  - level: int (1-3) → u8
  - hp: int → u32
  - damage: int → u32
  - atk_speed: float → u32 (×1000 для fixed-point)
  - move_speed: float → u32
  - attack_range: float → u32
  - state: enum { INACTIVE, IDLE, RUNNING, ATTACKING, VICTORY } → u8

Troops definitions (з building_system.gd troop_defs + individual scripts):

1. **Knight** (Tank, Melee) — `scripts/knight.gd`
   - Levels: {1: {hp:1100, dmg:75, atkSpd:1.667}, 2: {hp:1450, dmg:100, atkSpd:1.538}, 3: {hp:1850, dmg:130, atkSpd:1.429}}
   - move_speed: 0.5, attack_range: 0.24
   - Upgrade costs: {1: {gold:150, ore:80}, 2: {gold:400, ore:250}, 3: {gold:900, ore:600}}

2. **Mage** (Burst, Ranged) — `scripts/mage.gd`
   - Levels: {1: {hp:420, dmg:185, atkSpd:1.25}, 2: {hp:560, dmg:245, atkSpd:1.111}, 3: {hp:720, dmg:320, atkSpd:1.0}}
   - move_speed: 0.4, attack_range: 0.37
   - Upgrade costs: {1: {gold:250, ore:150}, 2: {gold:600, ore:400}, 3: {gold:1400, ore:900}}

3. **Barbarian** (Fast Brawler, Melee) — `scripts/barbarian.gd`
   - Levels: {1: {hp:520, dmg:90, atkSpd:0.625}, 2: {hp:690, dmg:120, atkSpd:0.571}, 3: {hp:880, dmg:158, atkSpd:0.526}}
   - move_speed: 0.4, attack_range: 0.24
   - Upgrade costs: {1: {gold:200, ore:120}, 2: {gold:500, ore:350}, 3: {gold:1100, ore:750}}

4. **Archer** (Sniper, Ranged) — `scripts/archer.gd`
   - Levels: {1: {hp:580, dmg:130, atkSpd:1.111}, 2: {hp:760, dmg:175, atkSpd:1.0}, 3: {hp:970, dmg:228, atkSpd:0.909}}
   - move_speed: 0.45, attack_range: 0.49
   - Upgrade costs: {1: {gold:180, wood:100}, 2: {gold:450, wood:300}, 3: {gold:1000, wood:700}}

5. **Ranger** (Balanced DPS, Ranged) — `scripts/ranger.gd`
   - Levels: {1: {hp:680, dmg:110, atkSpd:1.0}, 2: {hp:900, dmg:148, atkSpd:0.909}, 3: {hp:1150, dmg:192, atkSpd:0.833}}
   - move_speed: 0.55, attack_range: 0.40
   - Upgrade costs: {1: {gold:120, wood:60}, 2: {gold:350, wood:200}, 3: {gold:800, wood:500}}

### Turret (Defensive Building)
Godot файл: `scripts/turret.gd`
- Levels: {1: {damage:80, fire_rate:1.0}, 2: {damage:180, fire_rate:0.5}, 3: {damage:320, fire_rate:0.333}}
- detect_range: 1.0, bullet_speed: 4.0

### Battle System
Godot файл: `scripts/attack_system.gd`
Flow бою:
  1. Гравець натискає "Attack" → enter_attack_mode()
  2. Відображається shipPlane (зона деплою корабля)
  3. Клік ЛКМ → спавн корабля, пливе до точки
  4. Корабель прибуває → deploy troops (3 per ship)
  5. Troops знаходять найближчу будівлю → state: RUNNING
  6. Troops атакують будівлю → state: ATTACKING
  7. Building HP <= 0 → building destroyed, remove_building()
  8. Всі будівлі знищено → victory (Cheering animation)
  9. Turrets стріляють по troops → troops can die

Обмеження:
  - max_ships: 5
  - troops_per_ship: 3
  - total max troops: 15
  - troop_spawn_delay: 0.4s
  - sail_duration: 1.0s
  - spawn_distance: 8.0

Troop deployment pattern: ships cycle through SHIP_TROOPS array:
  [Knight, Mage, Barbarian, Archer(arrows), Ranger(crossbow)]

Тривалість бою: Немає явного тайм-ауту → рекомендовано 180 сек (3 хв)
Tick rate: немає tick системи — realtime movement + collision
Prep phase: немає явної prep phase → бій починається одразу

### Clan System
Є в грі: **НІ**
Жодних файлів чи коду пов'язаного з кланами не знайдено.

### Hero System
Є в грі: **НІ**
Жодних файлів чи коду пов'язаного з героями не знайдено.

### Existing Network Layer
Протокол: **ВІДСУТНІЙ**
В грі немає HTTPRequest, WebSocketClient або іншого мережевого коду.
Вся логіка — локальна.

### World Map
Godot файл: `scripts/map_islands.gd`
- 2D карта із островами (Boom Beach стиль)
- Island1 = база гравця (MY_ISLAND = 0)
- Інші острови = fake rival names (Captain Rex, SeaWolf 42, etc.)
- Nameplate з гоїльними ефектами (pulse animation)

### Additional Features Found
- "Find Enemy" button (line 268-282 building_system.gd) — stub, тільки print
- Cloud transition між Island view та World Map
- Camera rig (scripts/camera_rig.gd)
- World map camera (scripts/world_map_camera.gd)


## НЕВІДПОВІДНОСТІ З ТЗ

1. **Ресурси:** ТЗ передбачає gold/elixir/dark_elixir/gems →
   Гра реально має **wood/gold/ore**
   → Рекомендація: Замінити elixir→wood, dark_elixir→ore, gems прибрати

2. **Buildings:** ТЗ має GoldMine/ElixirCollector/DarkElixirDrill/GoldStorage/ElixirStorage/DarkElixirStorage/Barracks/DarkBarracks/Laboratory/SpellFactory/Cannon/ArcherTower/Mortar/AirDefense/WizardTower/Wall/Trap/ClanCastle/BuilderHut/HeroAltar
   Гра має: **mine/barn/port/sawmill/town_hall/turret**
   → Рекомендація: BuildingType enum = {TownHall, Mine, Barn, Port, Sawmill, Turret}

3. **Troops (Godot ≠ CoC):** ТЗ — стандартні CoC troops.
   Гра має: Knight, Mage, Barbarian, Archer, Ranger
   → Рекомендація: TroopType enum = {Knight, Mage, Barbarian, Archer, Ranger}

4. **Клани:** ТЗ — clan system with clan wars → Гра: НЕМАЄ
   → Рекомендація: НЕ реалізовувати clan components/systems

5. **Герої:** ТЗ — hero system → Гра: НЕМАЄ
   → Рекомендація: НЕ реалізовувати hero components

6. **Бойова система:** ТЗ — prep phase 30 сек + active 180 сек.
   Гра: немає prep phase, бій починається одразу.
   → Рекомендація: Прибрати Preparation phase, зразу Active

7. **Deployment system:** ТЗ — click to deploy troops.
   Гра: Ships з troops (Boom Beach стиль, не CoC).
   → Рекомендація: Адаптувати deploy через ship-based system

8. **Max building level:** Всі будівлі мають max 3 рівні.
   ТЗ передбачає більше рівнів (1-15 для TH).
   → Рекомендація: Обмежити max level = 3

9. **Grid:** ТЗ загальне. Гра: 27×27, cell_size = dynamic.
   → Рекомендація: Зберігати grid_x, grid_y як u8 (достатньо 0-26)

10. **Спеціальна механіка Sawmill=Barracks:**
    У грі Sawmill виступає як казарма для тренування/апгрейду військ.
    → Рекомендація: Врахувати це при реалізації TroopTrain system
