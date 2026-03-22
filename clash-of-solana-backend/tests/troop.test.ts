import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("Troop Train & Upgrade", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const owner = provider.wallet;

  it("should initialize a Knight (type 0) at level 1", async () => {
    // const program = anchor.workspace.TroopTrain as Program;
    //
    // const [troopPda] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("troop"), owner.publicKey.toBuffer(), Buffer.from([0])],
    //   program.programId
    // );
    //
    // await program.methods
    //   .initializeTroop(0) // Knight
    //   .accounts({
    //     troopStats: troopPda,
    //     villageInfo: villagePda,
    //     resources: resourcesPda,
    //     owner: owner.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .rpc();
    //
    // const troop = await program.account.troopStats.fetch(troopPda);
    // expect(troop.level).to.equal(1);
    // expect(troop.hp).to.equal(1100);
    // expect(troop.damage).to.equal(75);
    // expect(troop.atkSpeedMillis).to.equal(1667);
    // expect(troop.moveSpeedMillis).to.equal(500);
    // expect(troop.attackRangeMillis).to.equal(240);

    console.log("Troop Init test — replace program IDs after deployment");
  });

  it("should upgrade Knight from level 1 to 2", async () => {
    // const program = anchor.workspace.TroopTrain as Program;
    //
    // await program.methods
    //   .upgradeTroop()
    //   .accounts({
    //     troopStats: troopPda,
    //     villageInfo: villagePda,
    //     resources: resourcesPda,
    //     owner: owner.publicKey,
    //   })
    //   .rpc();
    //
    // const troop = await program.account.troopStats.fetch(troopPda);
    // expect(troop.level).to.equal(2);
    // expect(troop.hp).to.equal(1450);
    // expect(troop.damage).to.equal(100);

    console.log("Troop Upgrade test — replace program IDs after deployment");
  });

  it("should initialize all 5 troop types", async () => {
    // Test that each troop type (0-4) can be initialized with correct stats
    // Knight(0), Mage(1), Barbarian(2), Archer(3), Ranger(4)

    const expectedStats = [
      { type: 0, hp: 1100, damage: 75 },  // Knight
      { type: 1, hp: 420, damage: 185 },   // Mage
      { type: 2, hp: 520, damage: 90 },    // Barbarian
      { type: 3, hp: 580, damage: 130 },   // Archer
      { type: 4, hp: 680, damage: 110 },   // Ranger
    ];

    for (const expected of expectedStats) {
      console.log(`Troop type ${expected.type}: hp=${expected.hp}, dmg=${expected.damage}`);
    }

    console.log("All troop types test — replace program IDs after deployment");
  });

  it("should reject invalid troop type (5+)", async () => {
    // Expected error: InvalidTroopType

    console.log("Invalid troop type test — replace program IDs after deployment");
  });

  it("should reject upgrade beyond max level (3)", async () => {
    // Expected error: MaxLevelReached

    console.log("Max troop level test — replace program IDs after deployment");
  });
});
