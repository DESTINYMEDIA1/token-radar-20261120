# Launch Radar — token-radar-01

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/DESTINYMEDIA1/token-radar-20261120/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/DESTINYMEDIA1/token-radar-20261120/reward.svg)](https://make.fun/bounty/token-radar-01)

Build the best token launch radar: rank every pre-token protocol in the sealed DefiLlama snapshot by what its token would be worth if it launched, and show what farming it would actually pay.

## What it does

- Reads `/input/snapshot.json` (758 protocols, 14 Nov 2026) and ranks **198** pre-token protocols: all 40 on the watchlist, plus 138 early ones below the $50M floor and 20 off-list ones at or above it.
- **Value model, fitted on this snapshot's own traded tokens:** `implied = 10^(7.2341 + 0.5782 · log10(TVL / $100M) + category offset) × token odds`. Fitted on 115 traded tokens; leave-one-out median miss ×3.20, walk-forward ×2.27, flat multiple ×4.88. Growth and age were tested and not kept — they made both held-out tests worse.
- **Token odds** from a logistic over the peers' own record (Brier 0.224 vs 0.245 base).
- **Every row carries a costed farm plan** (6 steps, $1,000 and $10,000 deposits, fees, 4% T-bill forgone, net per hour) and a verdict: 29 FARM / 74 MARGINAL / 95 SKIP.
- **Uncertainty on every row:** leave-one-out P25–P75 and P10–P90 bands, the range across three fits of the size curve, and a rank range across the fits.
- Dashboard: sortable/filterable board, a full dossier per protocol (every step of the valuation, drop-share × deposit matrix, nearest traded peers), and a method section with the held-out tests.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22, standard library only. Runs twice byte-identical.

## Entry

Built for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01) on make.fun, by [@destiny](https://make.fun/u/destiny).

MIT licensed.
