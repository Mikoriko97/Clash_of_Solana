import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("Resource Collect", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const owner = provider.wallet;

  it("should collect accumulated resources based on production rates", async () => {
    // const program = anchor.workspace.ResourceCollect as Program;
    //
    // // First, update production rates
    // await program.methods
    //   .updateProductionRates(
    //     new anchor.BN(100),  // 100 gold/hour
    //     new anchor.BN(80),   // 80 wood/hour
    //     new anchor.BN(50),   // 50 ore/hour
    //   )
    //   .accounts({
    //     resources: resourcesPda,
    //     villageInfo: villagePda,
    //     owner: owner.publicKey,
    //   })
    //   .rpc();
    //
    // // Wait some time, then collect
    // // In test: manually advance clock or verify rate caching
    //
    // await program.methods
    //   .collectResources()
    //   .accounts({
    //     resources: resourcesPda,
    //     villageInfo: villagePda,
    //     owner: owner.publicKey,
    //   })
    //   .rpc();
    //
    // const resources = await program.account.resources.fetch(resourcesPda);
    // // Resources should include base + accumulated
    // expect(resources.goldPerHourCache.toNumber()).to.equal(100);

    console.log("Resource Collect test — replace program IDs after deployment");
  });

  it("should cap resources at max capacity", async () => {
    // Set gold close to gold_max, produce more
    // Verify gold doesn't exceed gold_max

    console.log("Resource cap test — replace program IDs after deployment");
  });

  it("should not collect if no time has passed", async () => {
    // Call collect immediately after collect
    // Should return Ok without modifying resources

    console.log("Zero elapsed test — replace program IDs after deployment");
  });
});

describe("Shield Manage", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("should allow player to drop their own shield", async () => {
    // const program = anchor.workspace.ShieldManage as Program;
    //
    // // Set shield first (via battle settle or direct)
    // await program.methods
    //   .dropShield()
    //   .accounts({
    //     villageInfo: villagePda,
    //     owner: owner.publicKey,
    //   })
    //   .rpc();
    //
    // const village = await program.account.villageInfo.fetch(villagePda);
    // expect(village.shieldExpiry).to.equal(0);

    console.log("Drop shield test — replace program IDs after deployment");
  });

  it("should reject drop if no active shield", async () => {
    // Expected error: NoActiveShield

    console.log("No shield test — replace program IDs after deployment");
  });
});
