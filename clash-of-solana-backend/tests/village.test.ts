import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("Village Init", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const owner = provider.wallet;

  let villagePda: PublicKey;
  let villageBump: number;
  let resourcesPda: PublicKey;
  let resourcesBump: number;

  before(() => {
    [villagePda, villageBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("village"), owner.publicKey.toBuffer()],
      new PublicKey("__REPLACE_AFTER_DEPLOY__") // village_init program ID
    );
    [resourcesPda, resourcesBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("resources"), owner.publicKey.toBuffer()],
      new PublicKey("__REPLACE_AFTER_DEPLOY__")
    );
  });

  it("should initialize a village with valid name", async () => {
    // This test verifies the village_init instruction
    // After deployment, replace program IDs and uncomment:
    //
    // const program = anchor.workspace.VillageInit as Program;
    // await program.methods
    //   .initializeVillage("MyVillage")
    //   .accounts({
    //     villageInfo: villagePda,
    //     resources: resourcesPda,
    //     owner: owner.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .rpc();
    //
    // const village = await program.account.villageInfo.fetch(villagePda);
    // expect(village.name).to.equal("MyVillage");
    // expect(village.townHallLevel).to.equal(1);
    // expect(village.trophyCount).to.equal(0);
    // expect(village.gridWidth).to.equal(27);
    // expect(village.gridHeight).to.equal(27);
    // expect(village.buildingCount).to.equal(0);
    //
    // const resources = await program.account.resources.fetch(resourcesPda);
    // expect(resources.gold.toNumber()).to.equal(1000);
    // expect(resources.wood.toNumber()).to.equal(1000);
    // expect(resources.ore.toNumber()).to.equal(1000);
    // expect(resources.goldMax.toNumber()).to.equal(10000);

    console.log("Village Init test — replace program IDs after deployment");
  });

  it("should reject village name longer than 32 chars", async () => {
    // const program = anchor.workspace.VillageInit as Program;
    // const longName = "a".repeat(33);
    // try {
    //   await program.methods
    //     .initializeVillage(longName)
    //     .accounts({ ... })
    //     .rpc();
    //   expect.fail("Should have thrown");
    // } catch (err: any) {
    //   expect(err.error.errorCode.code).to.equal("NameTooLong");
    // }

    console.log("Name validation test — replace program IDs after deployment");
  });
});
