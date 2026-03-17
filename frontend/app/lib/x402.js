// ── x402 HTTP Payment Protocol client ────────────────────────────────────────
// Spec: https://github.com/coinbase/x402
// Handles EIP-3009 transferWithAuthorization signing for USDC on Base Sepolia.

import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

// USDC contract on Base Sepolia (EIP-3009 compliant)
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const USDC_DOMAIN = {
  name:              "USD Coin",
  version:           "2",
  chainId:           84532,           // Base Sepolia
  verifyingContract: USDC,
};

const TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
  ],
};

function randomBytes32() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create an x402 payment proof for a given set of payment requirements.
 * Requirements come from a 402 response body.
 * Returns a base64-encoded payment header string.
 */
export async function createX402Payment(requirements, walletClient, account) {
  const accept = requirements.accepts?.[0];
  if (!accept) throw new Error("No payment requirements in 402 response");

  const amount      = BigInt(accept.maxAmountRequired);
  const payTo       = accept.payTo;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300); // valid 5 min
  const nonce       = randomBytes32();

  const authorization = {
    from:        account,
    to:          payTo,
    value:       amount,
    validAfter:  0n,
    validBefore: validBefore,
    nonce:       nonce,
  };

  const signature = await walletClient.signTypedData({
    account,
    domain:      USDC_DOMAIN,
    types:       TRANSFER_WITH_AUTH_TYPES,
    primaryType: "TransferWithAuthorization",
    message:     authorization,
  });

  const payment = {
    x402Version: 1,
    scheme:      "exact",
    network:     "base-sepolia",
    payload: {
      signature,
      authorization: {
        from:        account,
        to:          payTo,
        value:       amount.toString(),
        validAfter:  "0",
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  return btoa(JSON.stringify(payment));
}

/**
 * fetch() wrapper that handles 402 Payment Required automatically.
 * If the server returns 402 and a wallet is connected, signs and retries.
 * If no wallet is connected, returns the 402 response so callers can prompt.
 */
export async function fetchWithX402(url, options = {}, walletClient, account) {
  const res = await fetch(url, options);

  if (res.status !== 402) return res;

  // No wallet — return raw 402 so callers can prompt the user to connect
  if (!walletClient || !account) return res;

  let requirements;
  try {
    requirements = await res.json();
  } catch {
    return res;
  }

  // Check this is an x402 response (not some other 402)
  if (!requirements?.accepts?.length) return res;

  let paymentHeader;
  try {
    paymentHeader = await createX402Payment(requirements, walletClient, account);
  } catch (e) {
    // User rejected wallet signing — re-throw so UI can show message
    throw new Error("Payment cancelled: " + (e.message || "wallet rejected"));
  }

  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), "X-Payment": paymentHeader },
  });
}

/**
 * Connect window.ethereum (MetaMask / Coinbase Wallet) and switch to Base Sepolia.
 * Returns { account, walletClient } or throws.
 */
export async function connectEthereumWallet() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Install MetaMask or Coinbase Wallet.");
  }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const account  = accounts[0];

  // Switch / add Base Sepolia
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x14A34" }], // 84532
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId:         "0x14A34",
          chainName:       "Base Sepolia",
          nativeCurrency:  { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls:         ["https://sepolia.base.org"],
          blockExplorerUrls: ["https://sepolia.basescan.org"],
        }],
      });
    } else {
      throw e;
    }
  }

  const walletClient = createWalletClient({
    account,
    chain:     baseSepolia,
    transport: custom(window.ethereum),
  });

  return { account, walletClient };
}
