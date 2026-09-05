/** x402 v2 wire types as spoken by the MeshGateway facilitator and merchants. */

export interface PaymentRequirements {
  scheme: 'exact';
  /** CAIP-2 network id, for example "eip155:4663". */
  network: string;
  /** Amount in atomic token units, as a decimal string. */
  amount: string;
  /** ERC-20 token address. */
  asset: string;
  /** Merchant receiving address. */
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: {
    /** "permit2" or "eip3009". Defaults to eip3009 when absent. */
    assetTransferMethod?: string;
    /** Permit2 proxy contract that executes the transfer (permit2 only). */
    spender?: string;
    /** EIP-712 domain name of the token (eip3009) or token symbol (permit2). */
    name?: string;
    /** EIP-712 domain version of the token (eip3009). */
    version?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PaymentChallenge {
  x402Version: number;
  error?: string;
  accepts: PaymentRequirements[];
  resource?: { url: string };
  extensions?: Record<string, unknown>;
}

export interface Permit2Authorization {
  permitted: { token: string; amount: string };
  from: string;
  spender: string;
  nonce: string;
  deadline: string;
  witness: { to: string; validAfter: string };
}

export interface Eip3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

export type SchemePayload =
  | { signature: string; permit2Authorization: Permit2Authorization }
  | { signature: string; authorization: Eip3009Authorization };

export interface PaymentPayload {
  x402Version: 2;
  /** The accepts entry the client chose, echoed verbatim. */
  accepted: PaymentRequirements;
  payload: SchemePayload;
  resource?: { url: string };
  extensions?: Record<string, unknown>;
}

export interface SettlementInfo {
  success: boolean;
  transaction: string;
  network: string;
  payer?: string;
  errorReason?: string;
  errorMessage?: string;
}

/** Minimal signer surface. Any viem local account satisfies this. */
export interface TypedDataSigner {
  address: string;
  signTypedData(parameters: {
    domain: Record<string, unknown>;
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;
}
