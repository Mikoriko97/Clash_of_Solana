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
  network: "devnet" | "mainnet" = "devnet"
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
    throw new Error(
      `Challenge failed: ${challengeRes.status} ${await challengeRes.text()}`
    );
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
      pubkey: wallet.publicKey.toBase58(),
      challenge,
      signature: Buffer.from(signature).toString("base64"),
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(
      `Auth failed: ${tokenRes.status} ${await tokenRes.text()}`
    );
  }
  const { token } = (await tokenRes.json()) as { token: string };

  return { token, obtainedAt: Date.now(), network };
}

/** Connection до PER endpoint з вбудованим authToken */
export function createPerConnection(auth: PerAuthToken): Connection {
  const base = PER_ENDPOINTS[auth.network]!;
  return new Connection(
    `${base}?token=${encodeURIComponent(auth.token)}`,
    "confirmed"
  );
}

/** Менеджер сесії PER з авто-оновленням токену */
export class PerSessionManager {
  private auth: PerAuthToken | null = null;
  private readonly TOKEN_TTL_MS = 50 * 60 * 1000; // 50 хвилин

  async getConnection(
    wallet: Parameters<typeof authorizePer>[0],
    network: "devnet" | "mainnet" = "devnet"
  ): Promise<Connection> {
    if (
      !this.auth ||
      Date.now() - this.auth.obtainedAt > this.TOKEN_TTL_MS
    ) {
      this.auth = await authorizePer(wallet, network);
    }
    return createPerConnection(this.auth);
  }

  invalidate(): void {
    this.auth = null;
  }

  isAuthenticated(): boolean {
    return (
      this.auth !== null &&
      Date.now() - this.auth.obtainedAt < this.TOKEN_TTL_MS
    );
  }
}
