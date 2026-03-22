# Clash of Solana — On-Chain Backend

Backend для гри Clash of Solana (Godot 4.6), побудований на **Solana + MagicBlock Private Ephemeral Rollup (PER)**.

## 📁 Структура проєкту

```
clash-of-solana-backend/
│
├── GAME_MECHANICS_REPORT.md        ← Аналіз Godot проєкту (Фаза 0)
├── Anchor.toml                     ← Anchor конфігурація
├── Cargo.toml                      ← Rust workspace root
├── package.json                    ← NPM workspace root
├── .env.example
│
├── programs/                       ← Rust on-chain programs
│   ├── components/                 ← Дані (акаунти)
│   │   ├── village_info/           ← Інфо про село гравця
│   │   ├── resources/              ← Ресурси (wood/gold/ore)
│   │   ├── building_data/          ← Дані будівлі (6 типів)
│   │   ├── troop_stats/            ← Статистики військ (5 типів)
│   │   └── battle_state/           ← Стан бою (PER-delegated)
│   │
│   └── systems/                    ← Бізнес-логіка
│       ├── village_init/           ← Ініціалізація села
│       ├── battle_start/           ← Початок бою + PER delegation
│       ├── battle_action/          ← Дії в бою (в PER/TEE)
│       └── battle_settle/          ← Settlement на L1
│
├── packages/
│   ├── sdk/                        ← TypeScript SDK
│   │   └── src/
│   │       ├── constants.ts        ← Всі Program IDs, endpoints
│   │       ├── per/auth.ts         ← PER авторизація
│   │       ├── managers/
│   │       │   └── BattleManager.ts ← PER-enabled бої
│   │       └── index.ts            ← Експорт SDK
│   │
│   └── game-data/                  ← JSON конфіги балансу (з Godot)
│       ├── buildings.json          ← 6 типів будівель
│       └── troops.json             ← 5 типів військ
│
├── backend/                        ← Fastify off-chain API
│   └── src/
│       ├── server.ts               ← Fastify сервер
│       ├── config.ts               ← Конфігурація
│       ├── routes/                 ← REST API
│       │   ├── auth.ts             ← Wallet connect
│       │   ├── player.ts           ← Профіль гравця
│       │   ├── battle.ts           ← Matchmaking, бої
│       │   ├── leaderboard.ts      ← Рейтинг
│       │   └── shop.ts             ← Магазин
│       ├── services/
│       │   └── matchmaking.ts      ← Пошук суперника
│       └── db/
│           └── schema.sql          ← PostgreSQL схема
│
└── scripts/
    └── deploy.sh                   ← Деплой всіх програм
```

## 🎮 Ігрові дані (з Godot сканування)

### Будівлі (6 типів)
| Тип | Розмір | HP (L1/L2/L3) | Вартість |
|-----|--------|----------------|----------|
| Town Hall | 4×4 | 3500/6000/10000 | Безкоштовно |
| Mine | 3×3 | 1200/2200/3800 | Gold:400, Wood:150 |
| Barn | 2×3 | 2000/3500/6000 | Gold:200, Wood:200, Ore:100 |
| Port | 3×3 | 1800/3200/5500 | Gold:800, Wood:300, Ore:200 |
| Sawmill | 3×3 | 1200/2200/3800 | Gold:300 (Barracks) |
| Turret | 2×2 | 900/1600/2800 | Gold:600, Wood:350, Ore:200 |

### Війська (5 типів)
| Тип | Клас | HP (L1/L2/L3) | DMG (L1/L2/L3) |
|-----|------|---------------|-----------------|
| Knight | Tank, Melee | 1100/1450/1850 | 75/100/130 |
| Mage | Burst, Ranged | 420/560/720 | 185/245/320 |
| Barbarian | Brawler, Melee | 520/690/880 | 90/120/158 |
| Archer | Sniper, Ranged | 580/760/970 | 130/175/228 |
| Ranger | DPS, Ranged | 680/900/1150 | 110/148/192 |

### Ресурси
- **Wood** (дерево) — soft currency
- **Gold** (золото) — soft currency
- **Ore** (руда) — soft currency

## ⚔️ PER Battle Flow

```
① ATTACKER → battle_start::initialize_battle() [L1]
② ATTACKER → battle_start::delegate_battle_to_per() [L1 → TEE]
③ PER Auth → challenge/response → JWT authToken
④ ATTACKER → battle_action::deploy_ship() × 5 [PER/TEE]
⑤ ATTACKER → battle_action::finalize_battle() [PER → commit → L1]
⑥ ANYONE  → battle_settle::settle_battle_result() [L1]
```

## 🚀 Початок роботи

```bash
# 1. Перевірити версії
solana --version    # 2.3.13
rustc --version     # 1.85.0
anchor --version    # 0.32.1
node --version      # 24.10.0

# 2. Налаштувати .env
cp .env.example .env

# 3. Build
anchor build

# 4. Deploy (devnet)
bash scripts/deploy.sh

# 5. Запустити backend
cd backend && npm install && npm run dev
```
