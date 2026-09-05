import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  maxUint256,
  type Account,
} from 'viem';
import { NETWORKS, PERMIT2_ADDRESS, resolveNetwork } from './constants.js';

function chainFor(networkId: string, rpcUrl?: string) {
  const info = resolveNetwork(networkId);
  if (!info) {
    throw new Error(`Unknown network: ${networkId}. Known: ${Object.keys(NETWORKS).join(', ')}`);
  }
  const url = rpcUrl ?? info.rpcUrl;
  return {
    info,
    chain: defineChain({
      id: info.chainId,
      name: info.id,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [url] } },
    }),
    url,
  };
}

export interface EnsureApprovalOptions {
  /** A viem local account that can sign transactions. */
  account: Account;
  /** Short id ("robinhood") or CAIP-2 id ("eip155:4663"). Defaults to robinhood. */
  network?: string;
  /** Override the default public RPC endpoint. */
  rpcUrl?: string;
}

/**
 * Permit2 transfers need a one-time on-chain approval of the Permit2 contract
 * for the payment token. This checks the allowance and sends the approval
 * transaction when it is missing. The wallet needs a little gas.
 *
 * EIP-3009 networks (Base USDC) need no approval; calling this for one of
 * them is a no-op.
 */
export async function ensurePermit2Approval(
  options: EnsureApprovalOptions,
): Promise<{ approved: boolean; txHash?: string }> {
  const { info, chain, url } = chainFor(options.network ?? 'robinhood', options.rpcUrl);
  if (info.transferMethod !== 'permit2') return { approved: true };

  const publicClient = createPublicClient({ chain, transport: http(url) });
  const allowance = await publicClient.readContract({
    address: info.token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [options.account.address, PERMIT2_ADDRESS as `0x${string}`],
  });
  if (allowance > 0n) return { approved: true };

  const walletClient = createWalletClient({ account: options.account, chain, transport: http(url) });
  const txHash = await walletClient.writeContract({
    address: info.token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'approve',
    args: [PERMIT2_ADDRESS as `0x${string}`, maxUint256],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  return { approved: true, txHash };
}
