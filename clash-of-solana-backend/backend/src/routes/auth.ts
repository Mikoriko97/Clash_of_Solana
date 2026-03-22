import { FastifyInstance } from "fastify";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { z } from "zod";
import { query } from "../db";
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { config } from "../config";

const connectSchema = z.object({
  pubkey: z.string().min(32).max(44),
  signature: z.string().min(64).max(128),
  message: z.string().min(1).max(256),
});

/**
 * Auth routes — wallet connect via Ed25519 signature verification
 * POST /api/v1/auth/connect  → { pubkey, signature, message }
 * POST /api/v1/auth/refresh  → refresh JWT
 */
export async function authRoutes(app: FastifyInstance) {
  // Wallet connect — verify signature → issue JWT
  app.post("/connect", async (request, reply) => {
    const parsed = connectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { pubkey, signature, message } = parsed.data;

    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const pubkeyBytes = bs58.decode(pubkey);

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        pubkeyBytes
      );

      if (!isValid) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      // Upsert player in cache
      await query(
        `INSERT INTO players (pubkey, village_pda, display_name, last_active)
         VALUES ($1, '', 'Player', NOW())
         ON CONFLICT (pubkey) DO UPDATE SET last_active = NOW()`,
        [pubkey]
      );

      // Upsert matchmaking pool entry (village_pda = pubkey until real PDA is derived on-chain)
      await query(
        `INSERT INTO matchmaking_pool (village_pda, player_pubkey, trophy_count, th_level, last_active)
         VALUES ($1, $1, 0, 1, NOW())
         ON CONFLICT (village_pda) DO UPDATE SET last_active = NOW()`,
        [pubkey]
      );

      const token = app.jwt.sign(
        { pubkey, iat: Math.floor(Date.now() / 1000) },
        { expiresIn: "24h" }
      );

      return { success: true, token, pubkey };
    } catch (err) {
      app.log.error(err, "Signature verification failed");
      return reply.status(401).send({ error: "Signature verification failed" });
    }
  });

  // Create random wallet (MVP — for testing without browser wallet)
  app.post("/create-wallet", async (request, reply) => {
    try {
      // Generate random Solana keypair
      const keypair = Keypair.generate();
      const pubkey = keypair.publicKey.toBase58();
      const secretKey = bs58.encode(keypair.secretKey);

      // Airdrop SOL from localnet/devnet
      const connection = new Connection(config.solanaL1RpcUrl, "confirmed");
      let balance = 0;
      try {
        const sig = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig);
        balance = await connection.getBalance(keypair.publicKey);
      } catch (e) {
        // Airdrop may fail on devnet rate limit — wallet still created
        app.log.warn("Airdrop failed (rate limit?), wallet created without SOL");
      }

      // Register player in DB
      await query(
        `INSERT INTO players (pubkey, village_pda, display_name, last_active)
         VALUES ($1, $1, 'Player', NOW())
         ON CONFLICT (pubkey) DO UPDATE SET last_active = NOW()`,
        [pubkey]
      );
      await query(
        `INSERT INTO matchmaking_pool (village_pda, player_pubkey, trophy_count, th_level, last_active)
         VALUES ($1, $1, 0, 1, NOW())
         ON CONFLICT (village_pda) DO UPDATE SET last_active = NOW()`,
        [pubkey]
      );

      // Issue JWT
      const token = app.jwt.sign(
        { pubkey, iat: Math.floor(Date.now() / 1000) },
        { expiresIn: "24h" }
      );

      return {
        success: true,
        pubkey,
        secretKey,
        token,
        balanceSOL: balance / LAMPORTS_PER_SOL,
      };
    } catch (err) {
      app.log.error(err, "Wallet creation failed");
      return reply.status(500).send({ error: "Failed to create wallet" });
    }
  });

  // Refresh JWT
  app.post("/refresh", async (request, reply) => {
    try {
      await request.jwtVerify();
      const { pubkey } = request.user as { pubkey: string };
      const token = app.jwt.sign(
        { pubkey, iat: Math.floor(Date.now() / 1000) },
        { expiresIn: "24h" }
      );
      return { success: true, token };
    } catch (err) {
      app.log.error(err, "Token refresh failed");
      return reply.status(401).send({ error: "Invalid or expired token" });
    }
  });
}
