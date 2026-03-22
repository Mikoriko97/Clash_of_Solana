-- backend/src/db/schema.sql
-- Clash of Solana — PostgreSQL Schema (Full Online PvP)

-- Гравці
CREATE TABLE IF NOT EXISTS players (
    pubkey          VARCHAR(44) PRIMARY KEY,
    secret_key      TEXT,
    village_pda     VARCHAR(44) NOT NULL DEFAULT '',
    display_name    VARCHAR(32) DEFAULT 'Player',
    trophy_count    INTEGER     NOT NULL DEFAULT 0 CHECK (trophy_count >= 0),
    th_level        SMALLINT    NOT NULL DEFAULT 1 CHECK (th_level BETWEEN 1 AND 3),
    shield_expiry   TIMESTAMP,
    attack_cooldown TIMESTAMP,
    is_under_attack BOOLEAN     DEFAULT false,
    last_active     TIMESTAMP   DEFAULT NOW(),
    created_at      TIMESTAMP   DEFAULT NOW()
);

-- Будівлі гравця
CREATE TABLE IF NOT EXISTS buildings (
    id              SERIAL PRIMARY KEY,
    player_pubkey   VARCHAR(44) NOT NULL REFERENCES players(pubkey) ON DELETE CASCADE,
    building_type   VARCHAR(20) NOT NULL,
    level           SMALLINT    NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
    grid_x          SMALLINT    NOT NULL,
    grid_y          SMALLINT    NOT NULL,
    hp_current      INTEGER     NOT NULL,
    hp_max          INTEGER     NOT NULL,
    is_destroyed    BOOLEAN     DEFAULT false,
    created_at      TIMESTAMP   DEFAULT NOW(),
    UNIQUE(player_pubkey, grid_x, grid_y)
);
CREATE INDEX IF NOT EXISTS idx_buildings_player ON buildings(player_pubkey);

-- Ресурси гравця
CREATE TABLE IF NOT EXISTS player_resources (
    player_pubkey   VARCHAR(44) PRIMARY KEY REFERENCES players(pubkey) ON DELETE CASCADE,
    gold            BIGINT      NOT NULL DEFAULT 1000 CHECK (gold >= 0),
    gold_max        BIGINT      NOT NULL DEFAULT 10000,
    wood            BIGINT      NOT NULL DEFAULT 1000 CHECK (wood >= 0),
    wood_max        BIGINT      NOT NULL DEFAULT 10000,
    ore             BIGINT      NOT NULL DEFAULT 1000 CHECK (ore >= 0),
    ore_max         BIGINT      NOT NULL DEFAULT 10000,
    gold_per_hour   INTEGER     NOT NULL DEFAULT 0,
    wood_per_hour   INTEGER     NOT NULL DEFAULT 0,
    ore_per_hour    INTEGER     NOT NULL DEFAULT 0,
    last_collected  TIMESTAMP   DEFAULT NOW()
);

-- Війська гравця
CREATE TABLE IF NOT EXISTS troops (
    id              SERIAL PRIMARY KEY,
    player_pubkey   VARCHAR(44) NOT NULL REFERENCES players(pubkey) ON DELETE CASCADE,
    troop_type      VARCHAR(20) NOT NULL,
    level           SMALLINT    NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
    UNIQUE(player_pubkey, troop_type)
);
CREATE INDEX IF NOT EXISTS idx_troops_player ON troops(player_pubkey);

-- Matchmaking пул
CREATE TABLE IF NOT EXISTS matchmaking_pool (
    player_pubkey   VARCHAR(44) PRIMARY KEY REFERENCES players(pubkey) ON DELETE CASCADE,
    trophy_count    INTEGER     NOT NULL DEFAULT 0,
    th_level        SMALLINT    NOT NULL DEFAULT 1,
    is_available    BOOLEAN     DEFAULT true,
    last_active     TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mm_trophies ON matchmaking_pool(trophy_count, th_level)
    WHERE is_available = true;

-- Активні бої
CREATE TABLE IF NOT EXISTS active_battles (
    id              VARCHAR(36) PRIMARY KEY,
    attacker_pubkey VARCHAR(44) NOT NULL REFERENCES players(pubkey),
    defender_pubkey VARCHAR(44) NOT NULL REFERENCES players(pubkey),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    stars           SMALLINT    DEFAULT 0,
    destruction_pct SMALLINT    DEFAULT 0,
    loot_gold       BIGINT      DEFAULT 0,
    loot_wood       BIGINT      DEFAULT 0,
    loot_ore        BIGINT      DEFAULT 0,
    trophy_delta    INTEGER     DEFAULT 0,
    ships_deployed  SMALLINT    DEFAULT 0,
    troops_deployed SMALLINT    DEFAULT 0,
    started_at      TIMESTAMP   DEFAULT NOW(),
    timeout_at      TIMESTAMP,
    finished_at     TIMESTAMP
);

-- Архів боїв
CREATE TABLE IF NOT EXISTS battle_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id       VARCHAR(36),
    attacker_pubkey VARCHAR(44) REFERENCES players(pubkey) ON DELETE SET NULL,
    defender_pubkey VARCHAR(44) REFERENCES players(pubkey) ON DELETE SET NULL,
    stars           SMALLINT    CHECK (stars BETWEEN 0 AND 3),
    destruction_pct SMALLINT    CHECK (destruction_pct BETWEEN 0 AND 100),
    trophy_delta    INTEGER,
    loot_gold       BIGINT      DEFAULT 0,
    loot_wood       BIGINT      DEFAULT 0,
    loot_ore        BIGINT      DEFAULT 0,
    ships_deployed  SMALLINT,
    troops_deployed SMALLINT,
    battle_log      JSONB,
    occurred_at     TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bh_attacker ON battle_history(attacker_pubkey, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_bh_defender ON battle_history(defender_pubkey, occurred_at DESC);

-- Leaderboard snapshot
CREATE TABLE IF NOT EXISTS leaderboard_snapshot (
    id              SERIAL      PRIMARY KEY,
    player_pubkey   VARCHAR(44) REFERENCES players(pubkey) ON DELETE CASCADE,
    trophy_count    INTEGER     NOT NULL DEFAULT 0,
    th_level        SMALLINT    NOT NULL DEFAULT 1,
    rank            INTEGER     NOT NULL,
    snapshotted_at  TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ls_snapshot ON leaderboard_snapshot(snapshotted_at DESC, rank ASC);
