# Clash of Solana — Інструкція з розгортання

**Дата:** 22.03.2026
**Версія:** 1.0

---

## Зміст

- [1. Системні вимоги](#1-системні-вимоги)
- [2. Встановлення інструментів](#2-встановлення-інструментів)
- [3. Solana Wallet](#3-solana-wallet)
- [4. On-Chain Programs (Anchor/Rust)](#4-on-chain-programs-anchorrust)
- [5. Backend API (Fastify/TypeScript)](#5-backend-api-fastifytypescript)
- [6. Godot клієнт](#6-godot-клієнт)
- [7. Перевірка роботи](#7-перевірка-роботи)
- [8. Вирішення проблем](#8-вирішення-проблем)

---

## 1. Системні вимоги

| Інструмент | Версія | Призначення |
|------------|--------|-------------|
| **Rust** | >= 1.85.0 | Компіляція Anchor програм |
| **Solana CLI** | 2.3.13 | Деплой, управління wallet |
| **Anchor CLI** | 0.32.1 | Build/deploy Solana програм |
| **Node.js** | >= 24.x | Backend API, SDK |
| **PostgreSQL** | >= 16 | База даних backend |
| **Redis** | >= 7 | Кешування, BullMQ |
| **Docker** (опціонально) | >= 24 | Швидкий запуск PostgreSQL/Redis |
| **Godot** | 4.6 | Ігровий клієнт |
| **WSL2** (Windows) | Ubuntu | Solana CLI працює тільки в Linux |

---

## 2. Встановлення інструментів

### 2.1 Rust

```bash
# Встановити rustup (якщо ще не встановлений)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Оновити до стабільної версії >= 1.85
rustup update stable
rustup default stable

# Перевірити
rustc --version    # >= 1.85.0
cargo --version    # >= 1.85.0
```

### 2.2 Solana CLI

```bash
# Встановити Solana 2.3.13
sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.13/install)"

# Додати в PATH (додати в ~/.bashrc або ~/.zshrc)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Перевірити
solana --version   # solana-cli 2.3.13
```

### 2.3 Anchor CLI

```bash
# Встановити avm (Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/anchor avm --force

# Встановити Anchor 0.32.1
avm install 0.32.1
avm use 0.32.1

# Перевірити
anchor --version   # anchor-cli 0.32.1
```

### 2.4 Node.js

```bash
# Через nvm (рекомендовано)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 24
nvm use 24

# Перевірити
node --version     # v24.x
npm --version
```

---

## 3. Solana Wallet

### 3.1 Створити wallet

```bash
# Генерація нового wallet
solana-keygen new -o ~/.config/solana/id.json

# ЗБЕРЕЖИ seed phrase у безпечне місце!

# Налаштувати на devnet
solana config set --url devnet
```

### 3.2 Отримати SOL (devnet)

Для деплою всіх 9 програм потрібно ~15 SOL.

**Спосіб 1 — Faucet (рекомендовано):**
1. Дізнатись свою адресу: `solana address`
2. Відкрити https://faucet.solana.com
3. Вставити адресу, запросити SOL (кілька разів по 2-5 SOL)

**Спосіб 2 — CLI:**
```bash
solana airdrop 2 --url devnet
# Повторити кілька разів з паузою 30-60 сек
```

**Перевірити баланс:**
```bash
solana balance
```

---

## 4. On-Chain Programs (Anchor/Rust)

### 4.1 Клонування та підготовка

```bash
cd /path/to/project
cd clash-of-solana-backend

# Встановити npm залежності (workspace)
npm install
```

### 4.2 Генерація keypairs для програм

```bash
# Створити директорію
mkdir -p target/deploy

# Генерація keypair для кожної програми
for name in village_init build_construct build_upgrade resource_collect \
            troop_train battle_start battle_action battle_settle shield_manage; do
  solana-keygen new --no-bip39-passphrase \
    -o "target/deploy/${name}-keypair.json" --force --silent
done
```

### 4.3 Оновлення Program IDs

Дістати pubkey кожної програми:

```bash
for name in village_init build_construct build_upgrade resource_collect \
            troop_train battle_start battle_action battle_settle shield_manage; do
  pubkey=$(solana-keygen pubkey "target/deploy/${name}-keypair.json")
  echo "${name} = ${pubkey}"
done
```

Скопіювати виведені ID та оновити в:

1. **`Anchor.toml`** — секція `[programs.devnet]`
2. **`programs/systems/<name>/src/lib.rs`** — рядок `declare_id!("...")`

Кожна програма повинна мати СВІЙ унікальний ID!

### 4.4 Виправлення залежності blake3 (Anchor 0.32.1)

Anchor 0.32.1 використовує platform-tools з Cargo 1.84, який не підтримує `edition2024`. Потрібно зафіксувати версію blake3:

```bash
# Генеруємо lockfile системним cargo
cargo generate-lockfile

# Фіксуємо версії
cargo update -p blake3 --precise 1.5.5
cargo update -p constant_time_eq --precise 0.3.1
```

### 4.5 Компіляція

```bash
anchor build
```

Очікуваний результат: файли `.so` в `target/deploy/`.
Warnings типу `unexpected cfg condition` — це нормально для Anchor, ігнорувати.

**Перевірка:**
```bash
ls target/deploy/*.so
# Має бути 9+ файлів .so
```

### 4.6 Деплой на Devnet

```bash
# Деплой кожної програми
for name in village_init build_construct build_upgrade resource_collect \
            troop_train battle_start battle_action battle_settle shield_manage; do
  echo "Deploying ${name}..."
  solana program deploy \
    target/deploy/${name}.so \
    --program-id target/deploy/${name}-keypair.json \
    --url devnet
done
```

Якщо закінчились SOL — закрити невдалі буфери для повернення SOL:

```bash
# Подивитись буфери
solana program show --buffers --url devnet

# Закрити конкретний буфер
solana program close <BUFFER_ADDRESS> --url devnet

# Поповнити SOL та повторити деплой
```

### 4.7 Перевірка деплою

```bash
for name in village_init build_construct build_upgrade resource_collect \
            troop_train battle_start battle_action battle_settle shield_manage; do
  pubkey=$(solana-keygen pubkey "target/deploy/${name}-keypair.json")
  echo -n "${name}: "
  solana program show ${pubkey} --url devnet 2>/dev/null | head -1 || echo "NOT DEPLOYED"
done
```

---

## 5. Backend API (Fastify/TypeScript)

### 5.1 PostgreSQL та Redis

**Варіант A — Docker (рекомендовано):**

```bash
# PostgreSQL
docker run -d --name cos-postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=pass \
  -e POSTGRES_DB=clash_of_solana \
  -p 5432:5432 \
  postgres:16

# Redis
docker run -d --name cos-redis \
  -p 6379:6379 \
  redis:7
```

**Варіант B — Локальна інсталяція:**
- PostgreSQL: https://www.postgresql.org/download/
- Redis: https://redis.io/download/

### 5.2 Ініціалізація бази даних

```bash
# Через Docker
docker exec -i cos-postgres psql -U user -d clash_of_solana \
  < backend/src/db/schema.sql

# Або через psql напряму
psql -U user -d clash_of_solana -f backend/src/db/schema.sql
```

### 5.3 Налаштування .env

```bash
cd backend
cp ../.env.example .env
```

Відредагувати `.env`:

```env
NETWORK=devnet
SOLANA_L1_RPC_URL=https://api.devnet.solana.com
DATABASE_URL=postgresql://user:pass@localhost:5432/clash_of_solana
REDIS_URL=redis://localhost:6379
JWT_SECRET=замініть_на_рядок_мінімум_32_символи_довжиною
PORT=3000
```

**ВАЖЛИВО:** Змініть `JWT_SECRET` на унікальне значення!

### 5.4 Встановлення залежностей

```bash
cd backend
npm install
```

### 5.5 Запуск

```bash
# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

### 5.6 Перевірка

```bash
curl http://localhost:3000/health
```

Очікуваний результат:
```json
{
  "status": "ok",
  "network": "devnet",
  "services": {
    "database": "ok",
    "redis": "ok",
    "solana": "ok"
  }
}
```

---

## 6. Godot клієнт

### 6.1 Відкрити проект

1. Відкрити **Godot 4.6**
2. **Import** → вибрати `Clash/project.godot`

### 6.2 Налаштувати NetworkManager

1. **Project → Project Settings → Autoload**
2. Додати:
   - **Path:** `res://scripts/network_manager.gd`
   - **Name:** `NetworkManager`
   - **Enable:** true

### 6.3 Налаштувати Backend URL

За замовчуванням: `http://localhost:3000`

Щоб змінити, в будь-якому скрипті (або `_ready()` головної сцени):
```gdscript
NetworkManager.base_url = "http://your-server:3000"
```

### 6.4 Запуск

Натиснути **F5** (Play) у Godot Editor.

---

## 7. Перевірка роботи

### 7.1 API тести (без авторизації)

```bash
# Health check
curl http://localhost:3000/health

# Leaderboard
curl http://localhost:3000/api/v1/leaderboard/global

# Shop offers
curl http://localhost:3000/api/v1/shop/offers
```

### 7.2 Структура програм

| Програма | Тип | Призначення |
|----------|-----|-------------|
| `village_init` | System | Створення села нового гравця |
| `build_construct` | System | Побудова будівель |
| `build_upgrade` | System | Апгрейд будівель (1→2→3) |
| `resource_collect` | System | Збір пасивних ресурсів |
| `troop_train` | System | Тренування та апгрейд військ |
| `battle_start` | System | Ініціалізація бою + делегування в PER |
| `battle_action` | System | Дії в бою (deploy ship, tick, finalize) |
| `battle_settle` | System | Settlement результатів на L1 |
| `shield_manage` | System | Управління щитом гравця |

### 7.3 Flow повного тесту

1. Гравець підключає wallet → `POST /api/v1/auth/connect`
2. Ініціалізація села → on-chain `village_init.initialize_village()`
3. Побудова будівель → on-chain `build_construct.construct_building()`
4. Тренування військ → on-chain `troop_train.initialize_troop()`
5. Пошук супротивника → `POST /api/v1/battle/matchmake`
6. Бій → `battle_start` → `battle_action` (PER) → `battle_settle`

---

## 8. Вирішення проблем

### `Error: Invalid Base58 string`

**Причина:** `declare_id!()` містить невалідний рядок.
**Рішення:** Оновіть всі `declare_id!()` реальними pubkeys з keypair файлів.

### `constant_time_eq edition2024`

**Причина:** Anchor platform-tools має Cargo 1.84, який не підтримує edition 2024.
**Рішення:**
```bash
cargo update -p blake3 --precise 1.5.5
cargo update -p constant_time_eq --precise 0.3.1
```

### `Error reading manifest from path: programs/components/Cargo.toml`

**Причина:** Anchor намагається знайти component крейти як програми.
**Рішення:** В `Anchor.toml` секція `[programs.devnet]` має містити ТІЛЬКИ system програми (з `#[program]` макросом), не component бібліотеки.

### `insufficient funds for spend`

**Причина:** Недостатньо SOL для деплою.
**Рішення:**
1. Закрити невдалі буфери: `solana program close <ADDRESS> --url devnet`
2. Поповнити SOL: https://faucet.solana.com
3. Повторити деплой

### `anchor deploy` не працює

**Причина:** Баг Anchor з workspace сканування.
**Рішення:** Використовувати `solana program deploy` напряму (див. розділ 4.6).

### Backend не підключається до DB

**Перевірити:**
```bash
# Docker
docker ps | grep postgres

# Підключення
psql -U user -h localhost -d clash_of_solana -c "SELECT 1"
```

### Backend не підключається до Redis

**Перевірити:**
```bash
# Docker
docker ps | grep redis

# Підключення
redis-cli ping   # Має відповісти PONG
```

### Devnet airdrop rate limit

**Рішення:** Використовувати веб-фаусет https://faucet.solana.com замість CLI команди `solana airdrop`.

---

## Архітектура проекту

```
clash-of-solana-backend/
├── programs/
│   ├── components/          ← Дата-структури (PDA акаунти)
│   │   ├── village_info/    ← Інфо про село
│   │   ├── resources/       ← Ресурси (gold/wood/ore)
│   │   ├── building_data/   ← Стан будівлі
│   │   ├── troop_stats/     ← Стати юнітів
│   │   └── battle_state/    ← Стан бою
│   └── systems/             ← Бізнес-логіка (інструкції)
│       ├── village_init/
│       ├── build_construct/
│       ├── build_upgrade/
│       ├── resource_collect/
│       ├── troop_train/
│       ├── battle_start/
│       ├── battle_action/
│       ├── battle_settle/
│       └── shield_manage/
├── backend/                  ← Fastify API сервер
│   └── src/
│       ├── server.ts
│       ├── config.ts
│       ├── db/              ← PostgreSQL
│       ├── redis.ts
│       ├── solana.ts
│       ├── routes/          ← API endpoints
│       ├── services/        ← Matchmaking
│       └── jobs/            ← BullMQ (leaderboard)
├── packages/
│   ├── sdk/                 ← TypeScript SDK
│   └── game-data/           ← Баланс з Godot (JSON)
├── tests/                   ← Anchor тести
├── Anchor.toml
├── Cargo.toml
└── package.json

Clash/                        ← Godot 4.6 клієнт
├── scripts/
│   ├── network_manager.gd   ← Network bridge
│   ├── game_manager.gd
│   ├── building_system.gd
│   ├── attack_system.gd
│   └── ...
├── scenes/
├── shaders/
└── project.godot
```
