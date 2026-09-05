import {
  PERMIT_WITNESS_TYPES,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  X402_PERMIT2_PROXY,
  permit2Domain,
} from './constants.js';
import { randomHex32 } from './encoding.js';
import type { PaymentPayload, PaymentRequirements, TypedDataSigner } from './types.js';

function chainIdOf(requirements: PaymentRequirements): number {
  const [namespace, reference] = requirements.network.split(':');
  const chainId = Number(reference);
  if (namespace !== 'eip155' || !Number.isInteger(chainId)) {
    throw new Error(`Unsupported network: ${requirements.network}`);
  }
  return chainId;
}

/** Sign a permit2 payment (USDG on Robinhood Chain) for the given accepts entry. */
export async function buildPermit2Payment(
  signer: TypedDataSigner,
  requirements: PaymentRequirements,
): Promise<PaymentPayload> {
  const chainId = chainIdOf(requirements);
  const spender = (requirements.extra?.spender as string | undefined) ?? X402_PERMIT2_PROXY;
  const nonce = BigInt(randomHex32());
  const timeout = requirements.maxTimeoutSeconds ?? 300;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.max(timeout - 20, 60));

  const signature = await signer.signTypedData({
    domain: permit2Domain(chainId),
    types: PERMIT_WITNESS_TYPES as unknown as Record<string, { name: string; type: string }[]>,
    primaryType: 'PermitWitnessTransferFrom',
    message: {
      permitted: { token: requirements.asset, amount: BigInt(requirements.amount) },
      spender,
      nonce,
      deadline,
      witness: { to: requirements.payTo, validAfter: 0n },
    },
  });

  return {
    x402Version: 2,
    accepted: requirements,
    payload: {
      signature,
      permit2Authorization: {
        permitted: { token: requirements.asset, amount: requirements.amount },
        from: signer.address,
        spender,
        nonce: nonce.toString(),
        deadline: deadline.toString(),
        witness: { to: requirements.payTo, validAfter: '0' },
      },
    },
  };
}

/** Sign an EIP-3009 payment (USDC on Base or Base Sepolia) for the given accepts entry. */
export async function buildEip3009Payment(
  signer: TypedDataSigner,
  requirements: PaymentRequirements,
): Promise<PaymentPayload> {
  const chainId = chainIdOf(requirements);
  const name = (requirements.extra?.name as string | undefined) ?? 'USD Coin';
  const version = (requirements.extra?.version as string | undefined) ?? '2';
  const timeout = requirements.maxTimeoutSeconds ?? 300;
  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0n;
  const validBefore = BigInt(now + Math.max(timeout - 20, 60));
  const nonce = randomHex32();

  const signature = await signer.signTypedData({
    domain: {
      name,
      version,
      chainId,
      verifyingContract: requirements.asset as `0x${string}`,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES as unknown as Record<string, { name: string; type: string }[]>,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: signer.address,
      to: requirements.payTo,
      value: BigInt(requirements.amount),
      validAfter,
      validBefore,
      nonce,
    },
  });

  return {
    x402Version: 2,
    accepted: requirements,
    payload: {
      signature,
      authorization: {
        from: signer.address,
        to: requirements.payTo,
        value: requirements.amount,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };
}

/** Sign whichever scheme the accepts entry asks for. */
export async function buildPayment(
  signer: TypedDataSigner,
  requirements: PaymentRequirements,
): Promise<PaymentPayload> {
  const method = requirements.extra?.assetTransferMethod;
  if (method === 'permit2') return buildPermit2Payment(signer, requirements);
  return buildEip3009Payment(signer, requirements);
}
