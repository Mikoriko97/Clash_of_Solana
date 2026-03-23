import "dotenv/config";

export const config = {
  network: (process.env.NETWORK ?? "testnet") as "devnet" | "testnet" | "mainnet",
  port: Number(process.env.PORT ?? 3000),

  // Solana
  solanaL1RpcUrl: process.env.SOLANA_L1_RPC_URL ?? "https://api.testnet.solana.com",
  erEndpoint: process.env.MAGICBLOCK_ER_ENDPOINT ?? "https://devnet-eu.magicblock.app",
  perEndpoint: process.env.MAGICBLOCK_PER_ENDPOINT ?? "https://tee.magicblock.app",

  // Database
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/clash_of_solana",

  // Redis
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Auth
  jwtSecret: process.env.JWT_SECRET ?? "dev_secret_change_in_production_min_32_chars",

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY ?? "clash_of_solana_encryption_key_change_in_prod",
} as const;
