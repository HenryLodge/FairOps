"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const VENDOR_TYPES = ["food", "game", "merch", "ride"] as const;

const AREA_UNITS = [
  { value: "sq_ft", label: "sq ft" },
  { value: "sq_m", label: "m²" },
] as const;
const SQ_M_TO_SQ_FT = 10.7639;

/** Default booth fee in SOL when event has none set */
const DEFAULT_BOOTH_FEE_SOL = 0.1;

const ESCROW_WALLET_ADDRESS =
  process.env.NEXT_PUBLIC_ESCROW_WALLET_ADDRESS ?? "";

type ApplyFormProps = {
  eventId: string;
  eventName: string;
  /** Booth fee in lamports (from event.default_booth_fee). Falls back to DEFAULT_BOOTH_FEE_SOL. */
  boothFeeLamports?: number | null;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ApplyForm({
  eventId,
  eventName,
  boothFeeLamports,
  onSuccess,
  onCancel,
}: ApplyFormProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [boothName, setBoothName] = useState("");
  const [vendorType, setVendorType] = useState<(typeof VENDOR_TYPES)[number]>(
    "food"
  );
  const [description, setDescription] = useState("");
  const [areaValue, setAreaValue] = useState("150");
  const [areaUnit, setAreaUnit] = useState<"sq_ft" | "sq_m">("sq_ft");
  const [powerNeeded, setPowerNeeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feeLamports =
    boothFeeLamports && boothFeeLamports > 0
      ? boothFeeLamports
      : Math.round(DEFAULT_BOOTH_FEE_SOL * LAMPORTS_PER_SOL);
  const feeSol = feeLamports / LAMPORTS_PER_SOL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!boothName.trim()) {
      setError("Booth name is required.");
      return;
    }
    if (!connected || !publicKey) {
      setError("Please connect your Phantom wallet first.");
      return;
    }
    if (!ESCROW_WALLET_ADDRESS) {
      setError("Escrow wallet address is not configured.");
      return;
    }
    setLoading(true);
    try {
      // 0. Pre-flight: check the vendor has enough SOL
      const balanceLamports = await connection.getBalance(publicKey, "confirmed");
      // Need fee lamports + ~5000 lamports for the tx fee
      const estimatedTxFee = 5000;
      if (balanceLamports < feeLamports + estimatedTxFee) {
        const required = (feeLamports + estimatedTxFee) / LAMPORTS_PER_SOL;
        const available = balanceLamports / LAMPORTS_PER_SOL;
        setError(
          `Insufficient SOL. You need ~${required} SOL but only have ${available} SOL. ` +
          `Request testnet SOL from https://faucet.solana.com (select Testnet)`
        );
        setLoading(false);
        return;
      }

      // 1. Build the SOL transfer to escrow
      const escrowPubkey = new PublicKey(ESCROW_WALLET_ADDRESS);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: escrowPubkey,
          lamports: feeLamports,
        })
      );

      // Fetch a recent blockhash with "confirmed" commitment (not "finalized")
      // to avoid stale-blockhash rejections on devnet, where "finalized"
      // blockhashes can already be too old by the time Phantom signs.
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // 2. Send via wallet adapter → Phantom signAndSendTransaction
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      // Wait for on-chain confirmation
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      // 3. Submit the application with the tx signature
      const raw = parseFloat(areaValue);
      const spaceSqFt =
        Number.isNaN(raw) || raw <= 0
          ? 1
          : areaUnit === "sq_m"
            ? Math.max(1, Math.round(raw * SQ_M_TO_SQ_FT))
            : Math.max(1, Math.round(raw));
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          boothName: boothName.trim(),
          vendorType,
          description: description.trim() || undefined,
          spaceNeeded: spaceSqFt,
          powerNeeded,
          txSignature: signature,
          walletAddress: publicKey.toBase58(),
          boothFee: feeLamports,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to apply.");
        return;
      }
      onSuccess();
    } catch (err: unknown) {
      // Extract a useful message from Phantom / wallet-adapter errors.
      // WalletSendTransactionError often wraps the real cause in `error` property.
      let msg = "Transaction failed.";
      if (err && typeof err === "object") {
        const e = err as Record<string, unknown>;
        // Phantom internal error codes (e.g. -32003 = rejected, -32603 = internal)
        if (typeof e.code === "number") {
          if (e.code === 4001) msg = "Transaction was rejected by the user.";
          else if (e.code === -32003) msg = "Transaction rejected by the wallet.";
          else if (e.code === -32002) msg = "Another transaction is already pending in Phantom. Close it and try again.";
          else if (e.code === -32603) msg = "Phantom internal error. Make sure Phantom is set to Testnet (Settings → Developer Settings → Testnet Mode → Solana Testnet).";
          else msg = (e.message as string) || `Wallet error (code ${e.code}).`;
        } else if (e.message && typeof e.message === "string") {
          msg = e.message === "Unexpected error"
            ? "Phantom returned \"Unexpected error\". Ensure Phantom is set to Testnet and your wallet has enough SOL."
            : e.message;
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-bg-elevated)" }}
    >
      <h3 className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
        Apply to: {eventName}
      </h3>
      {/* Booth fee info */}
      <div
        className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
      >
        <span className="font-medium">Booth fee:</span>
        <span>{feeSol} SOL</span>
        <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          (escrowed until organizer approves/rejects)
        </span>
      </div>
      {/* Wallet warning */}
      {!connected && (
        <p className="mt-1 text-sm text-[#F87171]">
          Connect your Phantom wallet above before applying.
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label htmlFor="boothName" className="block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Booth name *
          </label>
          <input
            id="boothName"
            type="text"
            value={boothName}
            onChange={(e) => setBoothName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Taco Truck"
            required
          />
        </div>
        <div>
          <label htmlFor="vendorType" className="block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Vendor type *
          </label>
          <select
            id="vendorType"
            value={vendorType}
            onChange={(e) =>
              setVendorType(e.target.value as (typeof VENDOR_TYPES)[number])
            }
            className={inputClass}
          >
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="description" className="block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Short description of your booth"
          />
        </div>
        <div className="flex gap-4">
          <div>
            <label htmlFor="areaNeeded" className="block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              Area needed (optional)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="areaNeeded"
                type="number"
                min={areaUnit === "sq_m" ? 0.1 : 1}
                step={areaUnit === "sq_m" ? 0.1 : 1}
                value={areaValue}
                onChange={(e) => setAreaValue(e.target.value)}
                placeholder={areaUnit === "sq_m" ? "e.g. 14" : "e.g. 150"}
                className={inputClass.replace("w-full", "w-24")}
              />
              <select
                id="areaUnit"
                value={areaUnit}
                onChange={(e) => setAreaUnit(e.target.value as "sq_ft" | "sq_m")}
                aria-label="Area unit"
                className={inputClass.replace("w-full", "w-auto min-w-[5rem]")}
              >
                {AREA_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <input
              id="powerNeeded"
              type="checkbox"
              checked={powerNeeded}
              onChange={(e) => setPowerNeeded(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
            />
            <label htmlFor="powerNeeded" className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Power needed
            </label>
          </div>
        </div>
        {error && <p className="text-sm text-[#F87171]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Sending SOL & submitting…" : `Stake ${feeSol} SOL & Apply`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-elevated)]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
