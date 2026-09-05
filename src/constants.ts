export const FACILITATOR_URL = 'https://facilitator.meshgateway.co';

export const PAYMENT_REQUIRED_HEADER = 'payment-required';
export const PAYMENT_SIGNATURE_HEADER = 'payment-signature';
export const PAYMENT_HEADER = 'x-payment';
export const PAYMENT_RESPONSE_HEADER = 'payment-response';
export const PAYMENT_RESPONSE_HEADER_ALT = 'x-payment-response';

export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
export const X402_PERMIT2_PROXY = '0x402085c248EeA27D92E8b30b2C58ed07f9E20001';

export interface NetworkInfo {
  id: string;
  caip2: string;
  chainId: number;
  token: string;
  symbol: string;
  decimals: number;
  transferMethod: 'permit2' | 'eip3009';
  rpcUrl: string;
}

/** Networks supported by the MeshGateway facilitator. */
export const NETWORKS: Record<string, NetworkInfo> = {
  robinhood: {
    id: 'robinhood',
    caip2: 'eip155:4663',
    chainId: 4663,
    token: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    symbol: 'USDG',
    decimals: 6,
    transferMethod: 'permit2',
    rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  },
  base: {
    id: 'base',
    caip2: 'eip155:8453',
    chainId: 8453,
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    decimals: 6,
    transferMethod: 'eip3009',
    rpcUrl: 'https://mainnet.base.org',
  },
  'base-sepolia': {
    id: 'base-sepolia',
    caip2: 'eip155:84532',
    chainId: 84532,
    token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    symbol: 'USDC',
    decimals: 6,
    transferMethod: 'eip3009',
    rpcUrl: 'https://sepolia.base.org',
  },
};

/** Resolve a short id ("robinhood") or CAIP-2 id ("eip155:4663") to network info. */
export function resolveNetwork(id: string): NetworkInfo | undefined {
  if (NETWORKS[id]) return NETWORKS[id];
  return Object.values(NETWORKS).find((n) => n.caip2 === id);
}

export const PERMIT_WITNESS_TYPES = {
  PermitWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'Witness' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  Witness: [
    { name: 'to', type: 'address' },
    { name: 'validAfter', type: 'uint256' },
  ],
} as const;

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export function permit2Domain(chainId: number) {
  return {
    name: 'Permit2',
    chainId,
    verifyingContract: PERMIT2_ADDRESS as `0x${string}`,
  };
}
