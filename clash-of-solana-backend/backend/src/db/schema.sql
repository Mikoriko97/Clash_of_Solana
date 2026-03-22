-- backend/src/db/schema.sql
-- Clash of Solana — PostgreSQL Schema
-- Адаптовано: ресурси wood/gold/ore, без кланів

-- Кеш профілів гравців
CREATE TABLE IF NOT EXISTS players (
    pubkey          VARCHAR(44) PRIMARY KEY,
    village_pda     VARCHAR(44) NOT NULL DEFAULT '',
    display_name    VARCHAR(32) DEFAULT 'Player',
    trophy_count    INTEGER     NOT NULL DEFAULT 0 CHECK (trophy_count >= 0),
    th_level        SMALLINT    NOT NULL DEFAULT 1 CHECK (th_level BETWEEN 1 AND 3),
    last_active     TIMESTAMP   DEFAULT NOW(),
    created_at      TIMESTAMP   DEFAULT NOW()
);

-- Matchmaking пул
CREATE TABLE IF NOT EXISTS matchmaking_pool (
    village_pda     VARCHAR(44) PRIMARY KEY,
    player_pubkey   VARCHAR(44) NOT NULL REFERENCES players(pubkey) ON DELETE CASCADE,
    trophy_count    INTEGER     NOT NULL DEFAULT 0 CHECK (trophy_count >= 0),
    th_level        SMALLINT    NOT NULL DEFAULT 1 CHECK (th_level BETWEEN 1 AND 3),
    is_available    BOOLEAN     DEFAULT true,
    shield_expiry   TIMESTAMP,
    last_active     TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mm_trophies ON matchmaking_pool(trophy_count, th_level)
    WHERE is_available = true;

-- Архів боїв (Godot може читати для replay)
CREATE TABLE IF NOT EXISTS battle_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_pda      VARCHAR(44) UNIQUE NOT NULL,
    attacker_pubkey VARCHAR(44) REFERENCES players(pubkey) ON DELETE SET NULL,
    defender_pubkey VARCHAR(44) REFERENCES players(pubkey) ON DELETE SET NULL,
    stars           SMALLINT    CHECK (stars BETWEEN 0 AND 3),
    destruction_pct SMALLINT    CHECK (destruction_pct BETWEEN 0 AND 100),
    trophy_delta    INTEGER,
    -- Ресурси — wood/gold/ore (з Godot, не elixir)
    loot_gold       BIGINT      DEFAULT 0 CHECK (loot_gold >= 0),
    loot_wood       BIGINT      DEFAULT 0 CHECK (loot_wood >= 0),
    loot_ore        BIGINT      DEFAULT 0 CHECK (loot_ore >= 0),
    -- Ship-based deployment log
    ships_deployed  SMALLINT    CHECK (ships_deployed BETWEEN 0 AND 5),
    troops_deployed SMALLINT    CHECK (troops_deployed BETWEEN 0 AND 15),
    -- Повний лог дій для replay (ship deployments, ticks)
    battle_log      JSONB,
    occurred_at     TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bh_attacker ON battle_history(attacker_pubkey, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_bh_defender ON battle_history(defender_pubkey, occurred_at DESC);

-- Leaderboard snapshot (оновлюється кожні 24г)
CREATE TABLE IF NOT EXISTS leaderboard_snapshot (
    id              SERIAL      PRIMARY KEY,
    player_pubkey   VARCHAR(44) REFERENCES players(pubkey) ON DELETE CASCADE,
    trophy_count    INTEGER     NOT NULL DEFAULT 0,
    th_level        SMALLINT    NOT NULL DEFAULT 1,
    rank            INTEGER     NOT NULL,
    snapshotted_at  TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ls_snapshot ON leaderboard_snapshot(snapshotted_at DESC, rank ASC);
