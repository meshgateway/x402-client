import {
  PAYMENT_HEADER,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_RESPONSE_HEADER_ALT,
  PAYMENT_SIGNATURE_HEADER,
  resolveNetwork,
} from './constants.js';
import { decodeBase64Json, encodeBase64Json } from './encoding.js';
import { buildPayment } from './sign.js';
import type {
  PaymentChallenge,
  PaymentRequirements,
  SettlementInfo,
  TypedDataSigner,
} from './types.js';

export interface X402ClientOptions {
  /** A viem local account, or anything with an address and signTypedData. */
  account: TypedDataSigner;
  /**
   * Refuse to pay more than this many atomic token units per request.
   * Both USDG and USDC use 6 decimals, so the default of 1000000 is one dollar.
   */
  maxAmount?: bigint;
  /**
   * Preferred networks in order, as short ids ("robinhood", "base",
   * "base-sepolia") or CAIP-2 ids ("eip155:4663"). When omitted the first
   * supported accepts entry wins.
   */
  networks?: string[];
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Custom selector over the 402 accepts array. Overrides networks. */
  paymentSelector?: (accepts: PaymentRequirements[]) => PaymentRequirements | undefined;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly challenge?: PaymentChallenge,
    readonly response?: Response,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** Decode a 402 challenge from the payment-required header or the JSON body. */
export async function decodeChallenge(response: Response): Promise<PaymentChallenge> {
  const header = response.headers.get(PAYMENT_REQUIRED_HEADER);
  if (header) return decodeBase64Json<PaymentChallenge>(header);
  const body = (await response.clone().json()) as PaymentChallenge;
  if (!Array.isArray(body?.accepts)) {
    throw new PaymentError('402 response carries no payment-required header or accepts body', undefined, response);
  }
  return body;
}

/** Decode the settlement info a merchant attaches to the paid response. */
export function decodePaymentResponse(response: Response): SettlementInfo | null {
  const header =
    response.headers.get(PAYMENT_RESPONSE_HEADER) ?? response.headers.get(PAYMENT_RESPONSE_HEADER_ALT);
  if (!header) return null;
  try {
    return decodeBase64Json<SettlementInfo>(header);
  } catch {
    return null;
  }
}

function defaultSelector(
  accepts: PaymentRequirements[],
  networks: string[] | undefined,
): PaymentRequirements | undefined {
  const supported = accepts.filter((entry) => {
    if (entry.scheme !== 'exact') return false;
    const method = entry.extra?.assetTransferMethod ?? 'eip3009';
    return method === 'permit2' || method === 'eip3009';
  });
  if (!networks || networks.length === 0) return supported[0];
  for (const id of networks) {
    const caip2 = resolveNetwork(id)?.caip2 ?? id;
    const match = supported.find((entry) => entry.network === caip2);
    if (match) return match;
  }
  return undefined;
}

/** Sign a payment for a challenge and return the payment-signature header value. */
export async function buildPaymentHeader(
  challenge: PaymentChallenge,
  options: X402ClientOptions,
): Promise<string> {
  const accepts = challenge.accepts ?? [];
  const chosen = options.paymentSelector
    ? options.paymentSelector(accepts)
    : defaultSelector(accepts, options.networks);
  if (!chosen) {
    throw new PaymentError('No supported payment option in the 402 challenge', challenge);
  }
  const maxAmount = options.maxAmount ?? 1_000_000n;
  if (BigInt(chosen.amount) > maxAmount) {
    throw new PaymentError(
      `Price ${chosen.amount} exceeds maxAmount ${maxAmount} atomic units`,
      challenge,
    );
  }
  const payload = await buildPayment(options.account, chosen);
  if (challenge.resource) payload.resource = challenge.resource;
  return encodeBase64Json(payload);
}

/**
 * Wrap fetch with automatic x402 payment. On a 402 the wrapper signs the
 * payment and retries once with the payment-signature header attached.
 */
export function wrapFetch(options: X402ClientOptions, baseFetch?: typeof fetch): typeof fetch {
  const doFetch = baseFetch ?? options.fetch ?? globalThis.fetch;

  return async function fetchWithPayment(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const first = await doFetch(input, init);
    if (first.status !== 402) return first;

    const challenge = await decodeChallenge(first);
    const paymentHeader = await buildPaymentHeader(challenge, options);

    const headers = new Headers(init?.headers);
    headers.set(PAYMENT_SIGNATURE_HEADER, paymentHeader);
    headers.set(PAYMENT_HEADER, paymentHeader);

    const second = await doFetch(input, { ...init, headers });
    if (second.status === 402) {
      const retry = await decodeChallenge(second).catch(() => undefined);
      throw new PaymentError(
        `Payment was rejected: ${retry?.error ?? second.statusText}`,
        retry,
        second,
      );
    }
    return second;
  };
}

/** One-shot helper: fetch a paid resource and return the response plus settlement info. */
export async function payAndFetch(
  input: RequestInfo | URL,
  options: X402ClientOptions,
  init?: RequestInit,
): Promise<{ response: Response; settlement: SettlementInfo | null }> {
  const response = await wrapFetch(options)(input, init);
  return { response, settlement: decodePaymentResponse(response) };
}
