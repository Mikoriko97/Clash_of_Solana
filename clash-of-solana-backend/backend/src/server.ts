import Fastify from "fastify";
import { config } from "./config";
import { authRoutes } from "./routes/auth";
import { playerRoutes } from "./routes/player";
import { battleRoutes } from "./routes/battle";
import { leaderboardRoutes } from "./routes/leaderboard";
import { shopRoutes } from "./routes/shop";
import { healthCheck as dbHealthCheck, closePool } from "./db";
import { redisHealthCheck, closeRedis } from "./redis";
import { getConnection } from "./solana";
import { scheduleLeaderboardSnapshot, startLeaderboardWorker, closeLeaderboardJobs } from "./jobs/leaderboard";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8080",
  "https://clashofsolana.com",
  "https://app.clashofsolana.com",
];

const app = Fastify({ logger: true });

async function main() {
  // ── Плагіни ──────────────────────────────────────────────────
  await app.register(import("@fastify/cors"), {
    origin: config.network === "devnet" ? true : ALLOWED_ORIGINS,
    credentials: true,
  });
  await app.register(import("@fastify/jwt"), { secret: config.jwtSecret });
  await app.register(import("@fastify/websocket"));
  await app.register(import("@fastify/rate-limit"), {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return request.ip;
    },
  });

  // ── Auth decorator для захищених роутів ──────────────────────
  app.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });

  // ── Роути ─────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(playerRoutes, { prefix: "/api/v1/player" });
  await app.register(battleRoutes, { prefix: "/api/v1/battle" });
  await app.register(leaderboardRoutes, { prefix: "/api/v1/leaderboard" });
  await app.register(shopRoutes, { prefix: "/api/v1/shop" });

  // ── Health check з DB + Redis + Solana ──────────────────────
  app.get("/health", async () => {
    const [dbOk, redisOk] = await Promise.all([
      dbHealthCheck(),
      redisHealthCheck(),
    ]);

    let solanaOk = false;
    try {
      const slot = await getConnection().getSlot();
      solanaOk = slot > 0;
    } catch {}

    const status = dbOk && redisOk ? "ok" : "degraded";
    return {
      status,
      network: config.network,
      services: {
        database: dbOk ? "ok" : "down",
        redis: redisOk ? "ok" : "down",
        solana: solanaOk ? "ok" : "down",
      },
    };
  });

  // ── Graceful shutdown ──────────────────────────────────────────
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await app.close();
    await closeLeaderboardJobs();
    await closePool();
    await closeRedis();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // ── Background Jobs ─────────────────────────────────────────
  startLeaderboardWorker();
  await scheduleLeaderboardSnapshot();

  // ── Start ────────────────────────────────────────────────────
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`Clash of Solana Backend running on port ${config.port}`);
  app.log.info(`Network: ${config.network}`);
  app.log.info(`Solana L1: ${config.solanaL1RpcUrl}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
