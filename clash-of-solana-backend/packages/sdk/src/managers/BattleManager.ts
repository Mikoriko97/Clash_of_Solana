import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { PerSessionManager } from "../per/auth";
import { VALIDATORS, GAME_CONSTANTS, TroopType } from "../constants";

export interface ShipDeployment {
  troopType: TroopType; // Knight, Mage, Barbarian, Archer, Ranger
  targetX: number; // позиція на shipPlane
  targetY: number;
}

export interface BattleResult {
  battleId: bigint;
  stars: number;
  destructionPct: number;
  lootGold: bigint;
  lootWood: bigint;
  lootOre: bigint;
  trophyDelta: number;
  shipsDeployed: number;
  troopsDeployed: number;
}

/**
 * BattleManager — PER-enabled battle flow.
 * Адаптований під Godot Boom Beach стиль:
 * - Ship-based deployment (не прямий deploy troops)
 * - Без prep phase
 * - Ресурси: wood/gold/ore
 */
export class BattleManager {
  private l1Connection: Connection;
  private perSession: PerSessionManager;
  private program: Program;
  private network: "devnet" | "mainnet";

  constructor(
    l1RpcUrl: string,
    program: Program,
    network: "devnet" | "mainnet" = "devnet"
  ) {
    this.l1Connection = new Connection(l1RpcUrl, "confirmed");
    this.perSession = new PerSessionManager();
    this.program = program;
    this.network = network;
  }

  /**
   * Derive battle PDA з 3-ма seeds: "battle" + attacker + battleId
   * Відповідає on-chain: seeds = [b"battle", attacker.key().as_ref(), &battle_id.to_le_bytes()]
   */
  static deriveBattlePda(
    attackerPubkey: PublicKey,
    battleId: bigint,
    programId: PublicKey
  ): [PublicKey, number] {
    const battleIdBuf = Buffer.alloc(8);
    battleIdBuf.writeBigUInt64LE(battleId);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("battle"), attackerPubkey.toBuffer(), battleIdBuf],
      programId
    );
  }

  /**
   * Derive village PDA
   */
  static deriveVillagePda(
    ownerPubkey: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("village"), ownerPubkey.toBuffer()],
      programId
    );
  }

  /**
   * Derive resources PDA
   */
  static deriveResourcesPda(
    ownerPubkey: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("resources"), ownerPubkey.toBuffer()],
      programId
    );
  }

  /**
   * Крок 1+2: Ініціалізація + Delegation в PER (на L1)
   */
  async initAndDelegateBattle(
    attackerWallet: any,
    defenderVillagePda: PublicKey,
    attackerVillagePda: PublicKey,
    battleId: bigint
  ): Promise<{ battleStatePda: PublicKey }> {
    const [battleStatePda] = BattleManager.deriveBattlePda(
      attackerWallet.publicKey,
      battleId,
      this.program.programId
    );

    // initialize_battle (L1)
    await this.program.methods
      .initializeBattle(battleId)
      .accounts({
        battleState: battleStatePda,
        attackerVillage: attackerVillagePda,
        defenderVillage: defenderVillagePda,
        attacker: attackerWallet.publicKey,
      })
      .rpc({ commitment: "confirmed" });

    // delegate_battle_to_per (L1) — делегує в TEE
    await this.program.methods
      .delegateBattleToPer()
      .accounts({ payer: attackerWallet.publicKey, pda: battleStatePda })
      .remainingAccounts([
        {
          pubkey: new PublicKey(VALIDATORS[this.network].tee),
          isSigner: false,
          isWritable: false,
        },
      ])
      .rpc({ commitment: "confirmed" });

    return { battleStatePda };
  }

  /**
   * Крок 3-4: Бій через PER — деплой кораблів з загонами
   * Відповідає Godot attack_system.gd: ships → troops
   */
  async conductBattle(
    attackerWallet: any,
    battleStatePda: PublicKey,
    ships: ShipDeployment[]
  ): Promise<void> {
    const perConn = await this.perSession.getConnection(
      attackerWallet,
      this.network
    );

    // Деплой кожного корабля через PER
    for (const ship of ships.slice(0, GAME_CONSTANTS.MAX_SHIPS_PER_BATTLE)) {
      const tx = await this.program.methods
        .deployShip(ship.troopType, ship.targetX, ship.targetY)
        .accounts({
          battleState: battleStatePda,
          signer: attackerWallet.publicKey,
        })
        .transaction();
      await sendAndConfirmTransaction(perConn, tx, [attackerWallet.payer]);
    }
  }

  /**
   * Крок 5: Завершення бою через PER (commit + undelegate)
   */
  async finalizeBattle(
    attackerWallet: any,
    battleStatePda: PublicKey,
    result: Pick<
      BattleResult,
      "lootGold" | "lootWood" | "lootOre" | "trophyDelta"
    >
  ): Promise<void> {
    const perConn = await this.perSession.getConnection(
      attackerWallet,
      this.network
    );

    const tx = await this.program.methods
      .finalizeBattle(
        result.lootGold,
        result.lootWood,
        result.lootOre,
        result.trophyDelta
      )
      .accounts({
        battleState: battleStatePda,
        payer: attackerWallet.publicKey,
      })
      .transaction();

    await sendAndConfirmTransaction(perConn, tx, [attackerWallet.payer]);
    this.perSession.invalidate();
  }

  /**
   * Крок 6: Settle результатів на L1 (після undelegation)
   * Передає всі 6 акаунтів, які вимагає SettleBattle context.
   */
  async settleBattle(
    attackerWallet: any,
    battleStatePda: PublicKey,
    attackerVillagePda: PublicKey,
    defenderVillagePda: PublicKey,
    attackerResourcesPda: PublicKey,
    defenderResourcesPda: PublicKey
  ): Promise<BattleResult> {
    await this.program.methods
      .settleBattleResult()
      .accounts({
        battleState: battleStatePda,
        attackerVillage: attackerVillagePda,
        defenderVillage: defenderVillagePda,
        attackerResources: attackerResourcesPda,
        defenderResources: defenderResourcesPda,
        payer: attackerWallet.publicKey,
      })
      .rpc({ commitment: "confirmed" });

    const state = await this.program.account.battleState.fetch(battleStatePda);
    return {
      battleId: state.battleId,
      stars: state.stars,
      destructionPct: state.destructionPct,
      lootGold: state.lootGold,
      lootWood: state.lootWood,
      lootOre: state.lootOre,
      trophyDelta: state.trophyDelta,
      shipsDeployed: state.shipsDeployed,
      troopsDeployed: state.troopsDeployed,
    };
  }

  /**
   * Підписка на оновлення бою через WebSocket
   */
  async subscribeToUpdates(
    attackerWallet: any,
    battleStatePda: PublicKey,
    onUpdate: (partial: Partial<BattleResult>) => void
  ): Promise<() => void> {
    const perConn = await this.perSession.getConnection(
      attackerWallet,
      this.network
    );

    const subId = perConn.onAccountChange(
      battleStatePda,
      (info) => {
        try {
          const decoded = this.program.coder.accounts.decode(
            "BattleState",
            info.data
          );
          onUpdate({
            stars: decoded.stars,
            destructionPct: decoded.destructionPct,
            shipsDeployed: decoded.shipsDeployed,
            troopsDeployed: decoded.troopsDeployed,
          });
        } catch {
          // account може бути в процесі оновлення
        }
      },
      "confirmed"
    );

    return () => perConn.removeAccountChangeListener(subId);
  }
}
