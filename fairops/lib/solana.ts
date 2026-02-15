/**
 * Solana connection, escrow keypair, and transaction verification for FairOps.
 * Server-side only for keypair and verification; connection config is env-driven.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import bs58 from "bs58";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.testnet.solana.com";

/** Solana connection using configured RPC URL. Safe for client or server. */
export function getConnection(): Connection {
  return new Connection(RPC_URL);
}

let escrowKeypair: Keypair | null = null;

/**
 * Load escrow keypair from env (server-only).
 * Supports ESCROW_WALLET_SECRET_KEY as JSON array of numbers or base58 string.
 */
export function getEscrowKeypair(): Keypair {
  if (escrowKeypair) return escrowKeypair;
  const raw = process.env.ESCROW_WALLET_SECRET_KEY;
  if (!raw?.trim()) {
    throw new Error(
      "ESCROW_WALLET_SECRET_KEY is not set. Add the escrow wallet secret (JSON array or base58) to .env.local."
    );
  }
  let secret: Uint8Array;
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) {
      throw new Error(
        "ESCROW_WALLET_SECRET_KEY must be a JSON array of 64 numbers."
      );
    }
    secret = new Uint8Array(arr);
  } else {
    const decoded = bs58.decode(trimmed);
    if (decoded.length !== 64) {
      throw new Error(
        "ESCROW_WALLET_SECRET_KEY base58 must decode to 64 bytes."
      );
    }
    secret = new Uint8Array(decoded);
  }
  escrowKeypair = Keypair.fromSecretKey(secret);
  return escrowKeypair;
}

/** Escrow wallet public key (derived from keypair). Use for verification and display. */
export function getEscrowPublicKey(): PublicKey {
  return getEscrowKeypair().publicKey;
}

export type VerifyEscrowTransferParams = {
  signature: string;
  expectedLamports: number;
  escrowWallet: PublicKey | string;
};

/**
 * Verify that a transaction is confirmed and sent the expected lamports to the escrow wallet.
 * Retries a few times to handle the delay between client confirmation and server visibility.
 * Returns the parsed tx meta on success; throws on missing, failed, or invalid tx.
 */
export async function verifyEscrowTransfer(
  connection: Connection,
  params: VerifyEscrowTransferParams
): Promise<ParsedTransactionWithMeta> {
  const { signature, expectedLamports, escrowWallet } = params;
  const escrowPubkey =
    typeof escrowWallet === "string"
      ? new PublicKey(escrowWallet)
      : escrowWallet;

  // Retry up to 5 times (total ~15s) — the transaction may be confirmed on the
  // client side but not yet visible to a different RPC node the server connects to.
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 3000;
  let tx: ParsedTransactionWithMeta | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    tx = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (tx) break;
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  if (!tx) {
    throw new Error(
      "Transaction not found after multiple attempts. It may not have been confirmed yet — please try again."
    );
  }

  const meta = tx.meta;
  if (!meta) {
    throw new Error("Transaction has no metadata.");
  }
  if (meta.err !== null && meta.err !== undefined) {
    throw new Error(
      `Transaction failed on-chain: ${JSON.stringify(meta.err)}`
    );
  }

  const accountKeys = tx.transaction.message.accountKeys;
  if (!accountKeys?.length || !meta.preBalances || !meta.postBalances) {
    throw new Error("Transaction missing account or balance data.");
  }
  if (meta.preBalances.length !== accountKeys.length || meta.postBalances.length !== accountKeys.length) {
    throw new Error("Account and balance array length mismatch.");
  }

  const escrowIndex = accountKeys.findIndex((acc) => {
    const pk = typeof acc.pubkey === "string" ? acc.pubkey : acc.pubkey?.toBase58?.() ?? "";
    return pk === escrowPubkey.toBase58();
  });

  if (escrowIndex === -1) {
    throw new Error(
      "Escrow wallet is not an account in this transaction."
    );
  }

  const preBalance = meta.preBalances[escrowIndex] ?? 0;
  const postBalance = meta.postBalances[escrowIndex] ?? 0;
  const receivedLamports = postBalance - preBalance;

  if (receivedLamports < expectedLamports) {
    throw new Error(
      `Escrow received ${receivedLamports} lamports, expected ${expectedLamports}.`
    );
  }

  return tx;
}
