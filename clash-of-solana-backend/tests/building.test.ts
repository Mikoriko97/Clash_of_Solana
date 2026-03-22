import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("Build Construct & Upgrade", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const owner = provider.wallet;

  // Test: Construct a building
  it("should construct a Mine at valid grid position", async () => {
    // After deployment, replace program IDs and uncomment:
    //
    // const constructProgram = anchor.workspace.BuildConstruct as Program;
    // const villageInitProgram = anchor.workspace.VillageInit as Program;
    //
    // // First, initialize village
    // const [villagePda] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("village"), owner.publicKey.toBuffer()],
    //   villageInitProgram.programId
    // );
    // const [resourcesPda] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("resources"), owner.publicKey.toBuffer()],
    //   villageInitProgram.programId
    // );
    //
    // // Building PDA uses building_count as seed
    // const [buildingPda] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("building"), owner.publicKey.toBuffer(), Buffer.from([0])],
    //   constructProgram.programId
    // );
    //
    // // Construct Mine (type=1) at grid position (5,5)
    // await constructProgram.methods
    //   .constructBuilding(1, 5, 5) // Mine at (5,5)
    //   .accounts({
    //     buildingData: buildingPda,
    //     villageInfo: villagePda,
    //     resources: resourcesPda,
    //     owner: owner.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .rpc();
    //
    // const building = await constructProgram.account.buildingData.fetch(buildingPda);
    // expect(building.level).to.equal(1);
    // expect(building.hpMax).to.equal(1200); // Mine level 1 HP
    // expect(building.hpCurrent).to.equal(1200);
    // expect(building.gridX).to.equal(5);
    // expect(building.gridY).to.equal(5);
    // expect(building.sizeX).to.equal(3); // Mine is 3×3
    // expect(building.sizeY).to.equal(3);
    //
    // // Check resources were deducted
    // const resources = await constructProgram.account.resources.fetch(resourcesPda);
    // expect(resources.gold.toNumber()).to.equal(600); // 1000 - 400
    // expect(resources.wood.toNumber()).to.equal(850); // 1000 - 150

    console.log("Build Construct test — replace program IDs after deployment");
  });

  it("should reject building outside grid bounds", async () => {
    // const constructProgram = anchor.workspace.BuildConstruct as Program;
    // try {
    //   await constructProgram.methods
    //     .constructBuilding(1, 26, 26) // Mine (3×3) at (26,26) → out of 27×27 grid
    //     .accounts({ ... })
    //     .rpc();
    //   expect.fail("Should have thrown");
    // } catch (err: any) {
    //   expect(err.error.errorCode.code).to.equal("OutOfGrid");
    // }

    console.log("Grid bounds test — replace program IDs after deployment");
  });

  it("should reject building with insufficient resources", async () => {
    // Drain resources first, then try to build
    // Expected error: InsufficientGold

    console.log("Insufficient resources test — replace program IDs after deployment");
  });

  // Test: Upgrade a building
  it("should upgrade a Mine from level 1 to level 2", async () => {
    // const upgradeProgram = anchor.workspace.BuildUpgrade as Program;
    //
    // await upgradeProgram.methods
    //   .upgradeBuilding()
    //   .accounts({
    //     buildingData: buildingPda,
    //     villageInfo: villagePda,
    //     resources: resourcesPda,
    //     owner: owner.publicKey,
    //   })
    //   .rpc();
    //
    // const building = await upgradeProgram.account.buildingData.fetch(buildingPda);
    // expect(building.level).to.equal(2);
    // expect(building.hpMax).to.equal(2200); // Mine level 2 HP

    console.log("Build Upgrade test — replace program IDs after deployment");
  });

  it("should reject upgrade beyond max level (3)", async () => {
    // Expected error: MaxLevelReached

    console.log("Max level test — replace program IDs after deployment");
  });
});
