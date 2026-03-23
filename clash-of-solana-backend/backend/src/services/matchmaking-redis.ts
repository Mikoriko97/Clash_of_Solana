import { getRedis } from "../redis";

const POOL_KEY = "matchmaking:pool";
const PLAYER_DATA_PREFIX = "matchmaking:player:";

export async function addToMatchPool(pubkey: string, trophies: number, thLevel: number) {
  const redis = getRedis();
  await redis.zadd(POOL_KEY, trophies, pubkey);
  await redis.set(`${PLAYER_DATA_PREFIX}${pubkey}`, JSON.stringify({ trophies, thLevel }), "EX", 86400);
}

export async function removeFromMatchPool(pubkey: string) {
  const redis = getRedis();
  await redis.zrem(POOL_KEY, pubkey);
  await redis.del(`${PLAYER_DATA_PREFIX}${pubkey}`);
}

export async function findOpponentRedis(attackerPubkey: string, attackerTrophies: number, attackerThLevel: number): Promise<string | null> {
  const redis = getRedis();
  const minTrophies = attackerTrophies - 200;
  const maxTrophies = attackerTrophies + 200;

  const candidates = await redis.zrangebyscore(POOL_KEY, minTrophies, maxTrophies, "LIMIT", 0, 20);

  for (const pubkey of candidates) {
    if (pubkey === attackerPubkey) continue;
    const dataStr = await redis.get(`${PLAYER_DATA_PREFIX}${pubkey}`);
    if (!dataStr) continue;
    const data = JSON.parse(dataStr);
    if (Math.abs(data.thLevel - attackerThLevel) <= 1) {
      return pubkey;
    }
  }
  return null;
}
