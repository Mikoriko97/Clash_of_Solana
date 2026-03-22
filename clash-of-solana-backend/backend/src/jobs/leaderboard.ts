import { Queue, Worker } from "bullmq";
import { getRedis } from "../redis";
import { query } from "../db";
import { cacheDel } from "../redis";

const QUEUE_NAME = "leaderboard-snapshot";

let queue: Queue | null = null;
let worker: Worker | null = null;

export function getLeaderboardQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedis(),
    });
  }
  return queue;
}

/** Schedule recurring leaderboard snapshot every 24h */
export async function scheduleLeaderboardSnapshot(): Promise<void> {
  const q = getLeaderboardQueue();

  // Remove any existing repeatable job
  const repeatableJobs = await q.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await q.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job (every 24 hours)
  await q.add(
    "snapshot",
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 }, // 24h in ms
    }
  );

  console.log("Leaderboard snapshot scheduled (every 24h)");
}

/** Start the worker that processes leaderboard snapshots */
export function startLeaderboardWorker(): void {
  worker = new Worker(
    QUEUE_NAME,
    async () => {
      console.log("Running leaderboard snapshot...");

      // Insert snapshot from current player data
      await query(`
        INSERT INTO leaderboard_snapshot (player_pubkey, trophy_count, th_level, rank, snapshotted_at)
        SELECT pubkey, trophy_count, th_level,
               ROW_NUMBER() OVER (ORDER BY trophy_count DESC) as rank,
               NOW()
        FROM players
        WHERE trophy_count > 0
        ORDER BY trophy_count DESC
        LIMIT 1000
      `);

      // Clean up old snapshots (keep last 30 days)
      await query(`
        DELETE FROM leaderboard_snapshot
        WHERE snapshotted_at < NOW() - INTERVAL '30 days'
      `);

      // Invalidate cache
      await cacheDel("leaderboard:global");

      console.log("Leaderboard snapshot completed");
    },
    {
      connection: getRedis(),
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`Leaderboard job ${job?.id} failed:`, err);
  });
}

export async function closeLeaderboardJobs(): Promise<void> {
  if (worker) await worker.close();
  if (queue) await queue.close();
}
