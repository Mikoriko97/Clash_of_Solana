import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { config } from "./config";

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(config.solanaL1RpcUrl, "confirmed");
  }
  return connection;
}

/** Derive VillageInfo PDA */
export function deriveVillagePda(ownerPubkey: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("village"), ownerPubkey.toBuffer()],
    programId
  );
}

/** Derive Resources PDA */
export function deriveResourcesPda(ownerPubkey: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("resources"), ownerPubkey.toBuffer()],
    programId
  );
}

/** Derive Building PDA */
export function deriveBuildingPda(
  ownerPubkey: PublicKey,
  buildingIndex: number,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("building"), ownerPubkey.toBuffer(), Buffer.from([buildingIndex])],
    programId
  );
}

/** Derive Troop PDA */
export function deriveTroopPda(
  ownerPubkey: PublicKey,
  troopType: number,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("troop"), ownerPubkey.toBuffer(), Buffer.from([troopType])],
    programId
  );
}

/** Derive Battle PDA */
export function deriveBattlePda(
  attackerPubkey: PublicKey,
  battleId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(battleId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("battle"), attackerPubkey.toBuffer(), buf],
    programId
  );
}

/** Verify that a Solana TX signature exists and is confirmed */
export async function verifyTransaction(signature: string): Promise<boolean> {
  try {
    const result = await getConnection().getSignatureStatus(signature);
    return result?.value?.confirmationStatus === "confirmed"
      || result?.value?.confirmationStatus === "finalized";
  } catch {
    return false;
  }
}
