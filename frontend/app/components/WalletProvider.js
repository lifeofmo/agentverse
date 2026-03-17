"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { connectEthereumWallet } from "@/app/lib/x402";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account,      setAccount]      = useState(null);
  const [walletClient, setWalletClient] = useState(null);
  const [connecting,   setConnecting]   = useState(false);
  const [error,        setError]        = useState("");

  // Reconnect silently if already authorised (no prompt)
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      if (accounts[0]) {
        connectEthereumWallet().then(({ account, walletClient }) => {
          setAccount(account);
          setWalletClient(walletClient);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Track external account changes (user switches wallet)
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts) => {
      if (!accounts.length) { setAccount(null); setWalletClient(null); }
      else {
        connectEthereumWallet().then(({ account, walletClient }) => {
          setAccount(account);
          setWalletClient(walletClient);
        }).catch(() => {});
      }
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum.removeListener("accountsChanged", handler);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError("");
    try {
      const { account, walletClient } = await connectEthereumWallet();
      setAccount(account);
      setWalletClient(walletClient);
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setWalletClient(null);
  }, []);

  return (
    <WalletContext.Provider value={{ account, walletClient, connect, disconnect, connecting, error }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
