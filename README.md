# @meshgateway/x402-client

Pay for x402 protected APIs with one wrapped `fetch`. Built for the MeshGateway facilitator and any merchant speaking x402 v2.

The client handles the whole flow: it makes the request, reads the 402 challenge, signs the payment with your wallet key, retries with the `payment-signature` header, and hands you the paid response.

## Supported networks

| Network | Token | Scheme |
| --- | --- | --- |
| Robinhood Chain (`eip155:4663`) | USDG | permit2 |
| Base (`eip155:8453`) | USDC | EIP-3009 |
| Base Sepolia (`eip155:84532`) | USDC | EIP-3009 |

## Install

```bash
npm install @meshgateway/x402-client viem
```

## Quick start

```ts
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetch, decodePaymentResponse } from '@meshgateway/x402-client';

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
const fetchWithPay = wrapFetch({ account });

const res = await fetchWithPay('https://pons.meshgateway.co/price?token=PONS');
const data = await res.json();

const settlement = decodePaymentResponse(res);
console.log(settlement?.transaction); // on-chain tx hash
```

Non 402 responses pass through untouched, so the wrapper is safe as a drop-in `fetch` replacement.

### One-shot helper

```ts
import { payAndFetch } from '@meshgateway/x402-client';

const { response, settlement } = await payAndFetch(url, { account });
```

## Options

```ts
wrapFetch({
  account,                       // viem local account (or any typed data signer)
  maxAmount: 100_000n,           // refuse prices above 0.10 USDC/USDG (default 1000000, one dollar)
  networks: ['robinhood', 'base'], // preference order when a merchant accepts several
  paymentSelector: (accepts) => accepts[0], // full control if you want it
});
```

Amounts are atomic token units. USDG and USDC both use 6 decimals.

## One-time permit2 approval (Robinhood Chain)

Paying with USDG on Robinhood Chain uses permit2, which needs a one-time on-chain approval from your wallet. The wallet needs a small amount of gas for it.

```ts
import { ensurePermit2Approval } from '@meshgateway/x402-client';

await ensurePermit2Approval({ account, network: 'robinhood' });
```

Base USDC uses EIP-3009 and needs no approval and no gas at all.

## Lower level pieces

Every step is exported if you want to compose your own flow:

- `decodeChallenge(response)` reads the 402 challenge from the `payment-required` header or the JSON body.
- `buildPayment(signer, requirements)` signs one accepts entry and returns the payment payload.
- `buildPaymentHeader(challenge, options)` picks an entry, signs it, and returns the base64 header value.
- `decodePaymentResponse(response)` reads the settlement receipt (`payment-response` or `x-payment-response`).
- `NETWORKS`, `PERMIT2_ADDRESS`, `X402_PERMIT2_PROXY`, header name constants.

## Facilitator

Merchants verify and settle these payments through the MeshGateway facilitator at `https://facilitator.meshgateway.co`. If you are building the server side, see [@meshgateway/x402-server](https://github.com/meshgateway/x402-server).

## License

MIT
