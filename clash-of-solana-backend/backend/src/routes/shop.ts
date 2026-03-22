import { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyTransaction } from "../solana";

const purchaseSchema = z.object({
  offerId: z.string().min(1).max(64),
  txSignature: z.string().min(64).max(128),
});

// Shop offers (static for now, could move to DB)
const SHOP_OFFERS = [
  {
    id: "gold_pack_small",
    name: "Gold Pack (Small)",
    description: "1000 Gold",
    priceSOL: 0.01,
    resources: { gold: 1000, wood: 0, ore: 0 },
  },
  {
    id: "resource_pack",
    name: "Resource Pack",
    description: "500 Gold + 500 Wood + 500 Ore",
    priceSOL: 0.02,
    resources: { gold: 500, wood: 500, ore: 500 },
  },
  {
    id: "gold_pack_large",
    name: "Gold Pack (Large)",
    description: "5000 Gold",
    priceSOL: 0.04,
    resources: { gold: 5000, wood: 0, ore: 0 },
  },
  {
    id: "speed_up_1h",
    name: "Speed Up (1 hour)",
    description: "Skip 1 hour of upgrade time",
    priceSOL: 0.005,
    speedUpSeconds: 3600,
  },
] as const;

/**
 * Shop routes
 * GET  /api/v1/shop/offers     Активні оффери
 * POST /api/v1/shop/purchase   Купівля (ресурси, пришвидшення)
 */
export async function shopRoutes(app: FastifyInstance) {
  // Available shop offers
  app.get("/offers", async () => {
    return { offers: SHOP_OFFERS };
  });

  // Purchase
  app.post("/purchase", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parsed = purchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { offerId, txSignature } = parsed.data;
    const { pubkey } = request.user as { pubkey: string };

    // Validate offer exists
    const offer = SHOP_OFFERS.find((o) => o.id === offerId);
    if (!offer) {
      return reply.status(404).send({ error: "Offer not found" });
    }

    // Verify SOL payment transaction on-chain
    const txValid = await verifyTransaction(txSignature);
    if (!txValid) {
      return reply.status(400).send({
        error: "Transaction not confirmed. Please wait and try again.",
      });
    }

    app.log.info({ pubkey, offerId, txSignature }, "Shop purchase verified");

    return {
      success: true,
      offerId,
      txSignature,
      message: "Purchase verified on-chain. Resources will be credited.",
    };
  });
}
