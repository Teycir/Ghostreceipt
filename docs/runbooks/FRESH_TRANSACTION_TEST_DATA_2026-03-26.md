# Fresh Transaction Test Data (2026-03-26)

This document captures a fresh cross-chain sample table for manual testing.

- Capture date: `2026-03-26`
- Hash discovery source: Exa search + explorer URLs
- Amount/time verification source: live chain endpoints (mempool.space, Ethereum public RPC, Solana mainnet RPC)

## Table

| Chain | Amount | Transaction Hash | Block Time (UTC) | Source |
| --- | --- | --- | --- | --- |
| BTC | `3.12864037 BTC` (total outputs) | `e35832f21a165077c3e8e94a97e57916558d7e3a66e56febbfa15eb8a6f638e1` | `2026-03-26T14:04:58.000Z` | [mempool.space](https://mempool.space/tx/e35832f21a165077c3e8e94a97e57916558d7e3a66e56febbfa15eb8a6f638e1) |
| BTC | `2.87538534 BTC` (total outputs) | `855489dc042cd645b809ffc0db6cc9b348c6664c96b98a435566019746696aa9` | `2026-03-26T14:04:58.000Z` | [mempool.space](https://mempool.space/tx/855489dc042cd645b809ffc0db6cc9b348c6664c96b98a435566019746696aa9) |
| ETH | `0.000561 ETH` (`tx.value`) | `0x444eb92ceb169453c8bacf066cf8377f5a269afcc2a3bd95128a403afce97ece` | `2026-03-26T14:11:47.000Z` | [Etherscan](https://etherscan.io/tx/0x444eb92ceb169453c8bacf066cf8377f5a269afcc2a3bd95128a403afce97ece) |
| ETH | `0.174139 ETH` (`tx.value`) | `0x74623b29ab3578b7ed3ab7de893a73494d8acac432bded68d5d5c6af0e93a839` | `2026-03-26T14:11:47.000Z` | [Etherscan](https://etherscan.io/tx/0x74623b29ab3578b7ed3ab7de893a73494d8acac432bded68d5d5c6af0e93a839) |
| SOL | `0.000000017 SOL` (system transfer lamports sum) | `2XAy2BnNxvM8867u6C4ni8r3LbMUsgLQGGfYRRC9pU4hVigC1kpZZE3r5ymGKEEreAMg16GRyEQLjFV8rBvRNuHp` | `2026-03-19T14:42:34.000Z` | [Solscan](https://solscan.io/tx/2XAy2BnNxvM8867u6C4ni8r3LbMUsgLQGGfYRRC9pU4hVigC1kpZZE3r5ymGKEEreAMg16GRyEQLjFV8rBvRNuHp?cluster=mainnet-beta) |
| SOL | `0.048200000 SOL` (system transfer lamports sum) | `4FtjApyT6roXE7nU8UTYJp8Fix7GYowrZXPPyRGuP6QJMzCJ4WrdSowSK2vdFMHuG8vZfwJAKYkpUz5DVH4vZMEP` | `2026-03-21T19:58:54.000Z` | [Solscan](https://solscan.io/tx/4FtjApyT6roXE7nU8UTYJp8Fix7GYowrZXPPyRGuP6QJMzCJ4WrdSowSK2vdFMHuG8vZfwJAKYkpUz5DVH4vZMEP?cluster=mainnet-beta) |

## Notes

- BTC values are reported as **total outputs** from each transaction payload.
- ETH values are reported from transaction **`tx.value`**.
- SOL values are computed from parsed **System Program transfer lamports** in transaction instructions.
- Because chain activity changes continuously, refresh this document when any hash becomes invalid or unsupported by provider APIs.

## Production Validation Snapshot (2026-03-27)

Endpoint checked: `https://ghostreceipt.pages.dev/api/oracle/fetch-tx`

### Result summary

- BTC documented hash: pass, `consensus_verified`.
- ETH documented hash: pass, `consensus_verified`.
- SOL documented hash: pass, `consensus_verified`.
- ETH USDC documented hash (`0x09180...31755`): stale (`TRANSACTION_NOT_FOUND`), replaced with fresh hash below.

### Fresh production-verified set

| Chain | Fresh Hash | Amount (`valueAtomic`) | Block Time (UTC) | Validation |
| --- | --- | --- | --- | --- |
| BTC | `d07422d13247b8f59bddd9ea53f8ccbd0f6a14e6f666eb3dde703c7db4fd1f58` | `109538` | `2025-12-06 10:37:39 UTC` | `consensus_verified` |
| ETH | `0x07f38e681d32e36213e575b25a5f6367ac2fee9eb3c3976d9651ec0786c8ca42` | `0` | `2021-04-28 18:54:23 UTC` | `consensus_verified` |
| ETH (USDC) | `0x49f81b3603bda9461ce92925666c215442ed48f53e62ea8b066f3e46d828213c` | `400000000000` | `2026-01-07 18:32:23 UTC` | `consensus_verified` |
| SOL | `4AotthQtPNPMenWxNHr9QGaPh8moLAwX4bRMdbi8sezPW5N3vesV9HUDFYo9kH3anGgLNZTtPYDxpKfq7e58o5zs` | `2926410` | `2025-01-06 17:30:01 UTC` | `consensus_verified` |

### Bound checks used

For each chain above:

- Positive amount check: `claim = valueAtomic` -> expected `PASS`.
- Negative amount check: `claim = valueAtomic + 1` -> expected `FAIL` (out of bound).
- Positive date check: `minDate = tx date` -> expected `PASS`.
- Negative date check: `minDate = tx date + 1 day` -> expected `FAIL` (out of bound).
