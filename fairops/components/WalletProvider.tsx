"use client";

import { useMemo, useEffect, useRef } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC_ENDPOINT =
  typeof process.env.NEXT_PUBLIC_SOLANA_RPC_URL === "string" &&
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL.length > 0
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    : "https://api.testnet.solana.com";

/* ------------------------------------------------------------------ */
/*  Per-user public-key guard                                         */
/*                                                                    */
/*  The Solana wallet adapter stores only the wallet *name* (e.g.     */
/*  "Phantom") in localStorage. Because Phantom keeps a single        */
/*  active account per origin, autoConnect may reconnect to a         */
/*  different user's wallet if they switched Phantom accounts.        */
/*                                                                    */
/*  WalletGuard fixes this by also storing the expected *public key*  */
/*  per Auth0 user. After every connection (manual or auto) it        */
/*  compares the connected key to the stored one:                     */
/*    • First connection for this user → save the key.                */
/*    • Subsequent connections → if the key doesn't match, disconnect */
/*      so the wrong wallet is never shown for the wrong account.     */
/*    • Explicit disconnect by the user → clear the stored key.       */
/* ------------------------------------------------------------------ */

function WalletGuard({ storageKey }: { storageKey: string }) {
  const { publicKey, connected, disconnect } = useWallet();
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  // Track whether the user explicitly disconnected (so we clear the saved key).
  const prevConnected = useRef(connected);

  const pubkeyStr = publicKey?.toBase58() ?? null;

  useEffect(() => {
    // Detect explicit disconnect: was connected → now not connected.
    if (prevConnected.current && !connected) {
      // User (or adapter) disconnected — clear saved key for this account
      // so next login doesn't autoConnect to a stale address.
      try { localStorage.removeItem(storageKey); } catch { /* SSR / incognito */ }
    }
    prevConnected.current = connected;
  }, [connected, storageKey]);

  useEffect(() => {
    if (!connected || !pubkeyStr) return;

    let savedKey: string | null = null;
    try { savedKey = localStorage.getItem(storageKey); } catch { /* SSR */ }

    if (!savedKey) {
      // First time this user connects a wallet — remember the public key.
      try { localStorage.setItem(storageKey, pubkeyStr); } catch { /* SSR */ }
      return;
    }

    if (savedKey !== pubkeyStr) {
      // Connected to a different wallet than expected for this account.
      // Disconnect so we don't show the wrong wallet.
      void disconnectRef.current();
    }
  }, [connected, pubkeyStr, storageKey]);

  return null;
}

/**
 * Per-user wallet isolation.
 *
 * 1) Each Auth0 user gets a separate localStorage key for wallet name
 *    (walletName_<sub>) and for expected public key (walletPubkey_<sub>).
 * 2) We remount the Solana provider when user identity changes (key={userKey})
 *    so the adapter re-reads the correct per-user localStorage key.
 * 3) autoConnect reconnects the saved wallet when a user logs in.
 * 4) WalletGuard verifies the connected public key matches the one this
 *    user originally connected. If someone else's Phantom account is active,
 *    it disconnects automatically.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const endpoint = useMemo(() => RPC_ENDPOINT, []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  // Only derive a real user key after Auth0 has resolved; avoid a shared key during loading.
  const userKey = isLoading ? "__loading__" : (user?.sub ?? "__anon__");
  const walletNameKey = `walletName_${userKey}`;
  const walletPubkeyKey = `walletPubkey_${userKey}`;

  const autoConnect = !isLoading && !!user;

  const connectionConfig = useMemo(() => ({ commitment: "confirmed" as const }), []);

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <SolanaWalletProvider
        key={userKey}
        wallets={wallets}
        autoConnect={autoConnect}
        localStorageKey={walletNameKey}
      >
        <WalletGuard storageKey={walletPubkeyKey} />
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
