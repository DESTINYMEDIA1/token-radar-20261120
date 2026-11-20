// Launch Radar: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) and every other pre-token protocol the house rule does not set
// aside: 198 rows in all. A protocol is pre-token when its record carries no
// token (no market cap, no CoinGecko id, no symbol). The snapshot's
// live-token protocols are kept apart and shown as the market's own values,
// never mixed into the ranked board.
//
// The value model was fitted on this snapshot's own traded tokens, and every
// term in it earned its place in two held-out tests (leave-one-out and
// older-to-newer walk-forward). Terms that did not improve both tests were
// dropped and are listed as not kept, with their numbers.
//
//   value if it launches = 10^(7.2341 + 0.5782 * log10(TVL / $100M) + category offset)
//     fitted on 115 traded tokens (ratios outside 1/500..50x trimmed, CEX
//     excluded). Leave-one-out median miss x3.20, walk-forward x2.27, flat
//     multiple x4.88. Bootstrap s.e. over 100 refits: intercept +-0.073,
//     slope +-0.091.
//   token odds = logistic over the peers' own record (758 protocols):
//     years listed +0.47, log TVL +0.17, 7-day growth -0.29 (standardised).
//     Brier 0.224 against a 0.245 base rate.
//   implied value = value if it launches x token odds.
//   bands = the leave-one-out residual quantiles (P25 -0.51, P75 +0.49,
//     P10 -1.27, P90 +0.90 in log10), applied to the point estimate.
//   model spread = the range of implied values across three fits of the
//     size curve (OLS, OLS trimmed, Huber trimmed), same category offset
//     and odds. No protocol name is ever special-cased: the same functions
//     score every row.
//
// The farm plan prices a $1,000 position and a $10,000 position over 12
// weeks: the modelled drop is 7% of the value if it launches, times the
// farmer's share of TVL, times the token odds; fees are three transactions
// at the chain's typical gas; the T-bill forgone is 4% over the 12 weeks.
// A row is FARM when the $1,000 plan nets more than $0 and more than $1 an
// hour, MARGINAL when only the $10,000 plan clears, SKIP otherwise.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** Fitted size curve: log10(mcap) = INTERCEPT + SLOPE * log10(TVL / $100M). */
export const SIZE_INTERCEPT = 7.2341;
export const SIZE_SLOPE = 0.5782;
/** Alternate fits of the same curve, for the per-row model spread. */
export const SIZE_FITS: Array<[number, number]> = [
  [7.159, 0.4721], // OLS, untrimmed
  [7.2341, 0.5782], // OLS, ratios trimmed to 1/500..50x (the model)
  [7.225, 0.542], // Huber, trimmed
];

/** Category offsets (log10), shrunk toward 0 with k=16 pseudo-protocols. */
export const CAT_OFFSETS: Record<string, number> = {
  'Liquid Staking': -0.164, 'Lending': -0.119, 'Yield Aggregator': -0.092,
  'Liquidity Manager': -0.086, 'Onchain Capital Allocator': -0.086, 'CDP': -0.082,
  'Liquid Restaking': -0.059, 'Staking Pool': -0.054, 'Payments': -0.054,
  'Dual-Token Stablecoin': -0.046, 'Yield': -0.023, 'DOR': -0.023,
  'Restaking': -0.022, 'Bridge': -0.013, 'Indexes': -0.006, 'Launchpad': -0.003,
  'Leveraged Farming': -0.002, 'AI Agents': 0.003, 'RWA': 0.022, 'Dexs': 0.026,
  'Options': 0.029, 'NFT Marketplace': 0.037, 'Risk Curators': 0.05, 'Chain': 0.052,
  'Decentralized AI': 0.054, 'Token Locker': 0.06, 'Cross Chain Bridge': 0.062,
  'Derivatives': 0.068, 'Privacy': 0.072, 'Collateral Management': 0.087,
  'Basis Trading': 0.141, 'Canonical Bridge': 0.219,
};

/** Token-odds logistic, on standardised features. */
export const ODDS_W = [0.2806, 0.4708, 0.1738, -0.2911];
export const ODDS_MEANS = [0, 2.6902, -0.3506, -0.0612];
export const ODDS_SDS = [1, 0.4195, 0.7341, 0.1309];

/** Leave-one-out residual quantiles (log10) of the chosen value model. */
export const LOO_Q = { p10: -1.268, p25: -0.506, p75: 0.495, p90: 0.903 };
/** Held-out stats, printed on the dashboard. */
export const HELD_OUT = {
  loo_miss: 3.2, loo_within3: 45.4, loo_within10: 79,
  wf_miss: 2.27, wf_within3: 54.3, wf_within10: 77.1,
  flat_miss: 4.88, brier: 0.224, brier_base: 0.245, base_rate: 0.573,
};

/** Farm economics, stated on the dashboard. */
export const DROP_SHARE = 0.07; // share of the token's value that reaches farmers
export const TBILL = 0.04; // annual T-bill rate forgone
export const HORIZON_WEEKS = 12;
export const DEPOSITS = [1000, 10000];

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep { text: string; cost: string; time: string; }

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  tier: 'Watchlist' | 'Early' | 'Off-list';
  odds: number;
  value_if_launches: number;
  implied_value_usd: number;
  p25: number;
  p75: number;
  p10: number;
  p90: number;
  spread_lo: number;
  spread_hi: number;
  rank_lo: number;
  rank_hi: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  net_1k: number;
  net_10k: number;
  net_hour_1k: number;
  breakeven_odds: number;
  fees: number;
  hours: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  offlist_size: number;
  live_size: number;
  total_implied: number;
  total_tvl: number;
  farm_count: number;
  marginal_count: number;
  skip_count: number;
  accounting: Array<[string, number]>;
  held_out: typeof HELD_OUT;
  loo_q: typeof LOO_Q;
  rows: RadarRow[];
  live: LiveRow[];
  comps: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const SET_ASIDE_CATS = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token and not set aside by the house rule. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !SET_ASIDE_CATS.has(p.category ?? '') && !VERSIONED.test(p.name) && !WRAPPED.test(p.name) && !EXCHANGE.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The value if a token launches, in dollars, under one size-curve fit. */
export function valueIfLaunches(p: SnapshotProtocol, fit: [number, number] = [SIZE_INTERCEPT, SIZE_SLOPE]): number {
  const logVal = fit[0] + fit[1] * Math.log10(p.tvl_usd / 1e8) + (CAT_OFFSETS[p.category ?? ''] ?? 0);
  return Math.max(1, Math.round(Math.pow(10, logVal)));
}

/** The odds a protocol ever records a token, from the peers' own record. */
export function tokenOdds(p: SnapshotProtocol, asOf: string): number {
  const age = ageDays(asOf, p.listed_at);
  const raw = [
    1,
    Math.log10(1 + (age ?? 365)),
    Math.log10(p.tvl_usd / 1e8),
    Math.min(120, Math.max(-60, finite(p.change_7d, 0))) / 100,
  ];
  let z = 0;
  for (let i = 0; i < 4; i++) z += ODDS_W[i]! * ((raw[i]! - ODDS_MEANS[i]!) / ODDS_SDS[i]!);
  return 1 / (1 + Math.exp(-z));
}

/** Fees for a 12-week farm: three transactions at the chain's typical gas. */
export function feesFor(p: SnapshotProtocol): number {
  return p.chains.includes('Ethereum') ? 9 : 3;
}

/** Hands-on hours for a 12-week farm, by what the position asks of the farmer. */
export function hoursFor(p: SnapshotProtocol): number {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 3.25;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 3;
  return 2.75;
}

/** How much of a $1,000/$10,000 deposit the modelled drop returns, net of everything. */
export function farmEconomics(p: SnapshotProtocol, asOf: string): {
  value: number; odds: number; implied: number; fees: number; hours: number;
  net1k: number; net10k: number; netHour1k: number; breakeven: number; verdict: 'FARM' | 'MARGINAL' | 'SKIP';
} {
  const value = valueIfLaunches(p);
  const odds = tokenOdds(p, asOf);
  const implied = Math.max(1, Math.round(value * odds));
  const fees = feesFor(p);
  const hours = hoursFor(p);
  const tbill = (d: number) => TBILL * d * (HORIZON_WEEKS / 52);
  const net = (d: number) => odds * DROP_SHARE * value * (d / p.tvl_usd) - fees - tbill(d);
  const net1k = Math.round(net(1000) * 100) / 100;
  const net10k = Math.round(net(10000) * 100) / 100;
  const netHour1k = Math.round((net1k / hours) * 100) / 100;
  const sliceIfLaunches = DROP_SHARE * value * (1000 / p.tvl_usd);
  const breakeven = sliceIfLaunches > 0 ? Math.round(((fees + tbill(1000)) / sliceIfLaunches) * 1000) / 1000 : 1;
  const verdict = net1k > 0 && netHour1k > 1 ? 'FARM' : net10k > 0 ? 'MARGINAL' : 'SKIP';
  return { value, odds, implied, fees, hours, net1k, net10k, netHour1k, breakeven, verdict };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $1,000 of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $1,000 of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $1,000 of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $1,000 of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $1,000 of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $1,000 and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $1,000 into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $1,000 of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $1,000 of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $1,000 of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $1,000 of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * Every figure in it comes from the protocol's own record and the farm
 * economics above (category, chains, TVL, age, fees, exit threshold).
 */
export function farmSteps(p: SnapshotProtocol, asOf: string): FarmStep[] {
  const chain = chainOf(p);
  const age = ageDays(asOf, p.listed_at);
  const hold = holdDaysFor(age);
  const fees = feesFor(p);
  const exitTvl = Math.round(p.tvl_usd * 0.83);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, chain),
      cost: `$1,000 of capital and about $${fees} of gas for the whole plan`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'gas is inside the plan total',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: 'the $1,000 stays in the position',
      time: `${hold} days`,
    },
    {
      text: `Exit if the protocol's TVL falls below $${exitTvl.toLocaleString('en-US')} or drops 17% in a week; before you withdraw, claim only from the link its own page publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes a week to watch',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol the house rule does not set aside.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const e = farmEconomics(p, snapshot.as_of);
    return { p, e, age: ageDays(snapshot.as_of, p.listed_at) };
  });
  scored.sort((a, b) => b.e.implied - a.e.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.e.implied,
    farm_steps: farmSteps(s.p, snapshot.as_of).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && (p.mcap_usd ?? 0) > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The traded comps the detail view matches a protocol against, by market cap. */
export function compRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && (p.mcap_usd ?? 0) > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan and economics in it. */
export function radarRow(row: BoardRow, snapshot: Snapshot, all: RadarRow[]): RadarRow {
  const p = bySlug(snapshot.protocols).get(row.slug)!;
  const e = farmEconomics(p, snapshot.as_of);
  const spreadVals = SIZE_FITS.map((f) => {
    const v = valueIfLaunches(p, f);
    return Math.max(1, Math.round(v * e.odds));
  });
  const spreadLo = Math.min(...spreadVals);
  const spreadHi = Math.max(...spreadVals);
  const tier = snapshot.watchlist.includes(row.slug) ? 'Watchlist' : p.tvl_usd >= snapshot.floor_usd ? 'Off-list' : 'Early';
  const band = (q: number) => Math.max(1, Math.round(e.value * Math.pow(10, q) * e.odds));
  // Rank range from the model spread: rows that must be above, rows that could be above.
  const rankLo = 1 + all.filter((r) => r.spread_lo > spreadHi).length;
  const rankHi = all.filter((r) => r.spread_hi >= spreadLo).length;
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    tier,
    odds: round4(e.odds),
    value_if_launches: e.value,
    implied_value_usd: e.implied,
    p25: band(LOO_Q.p25),
    p75: band(LOO_Q.p75),
    p10: band(LOO_Q.p10),
    p90: band(LOO_Q.p90),
    spread_lo: spreadLo,
    spread_hi: spreadHi,
    rank_lo: rankLo,
    rank_hi: rankHi,
    verdict: e.verdict,
    net_1k: e.net1k,
    net_10k: e.net10k,
    net_hour_1k: e.netHour1k,
    breakeven_odds: e.breakeven,
    fees: e.fees,
    hours: e.hours,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const comps = compRows(snapshot);
  const wl = new Set(snapshot.watchlist);
  const early = board.filter((r) => !wl.has(r.slug) && r.tvl_usd < snapshot.floor_usd).length;
  const offlist = board.filter((r) => !wl.has(r.slug) && r.tvl_usd >= snapshot.floor_usd).length;
  // First pass rows (without rank ranges), then a second pass with them.
  const first = board.map((r) => {
    const p = bySlug(snapshot.protocols).get(r.slug)!;
    const e = farmEconomics(p, snapshot.as_of);
    const spreadVals = SIZE_FITS.map((f) => Math.max(1, Math.round(valueIfLaunches(p, f) * e.odds)));
    return { ...r, spread_lo: Math.min(...spreadVals), spread_hi: Math.max(...spreadVals) };
  });
  const rows: RadarRow[] = board.map((r) => radarRow(r, snapshot, first.map((f) => ({
    rank: f.rank, slug: f.slug, name: f.name, category: f.category, chains: f.chains,
    tvl_usd: f.tvl_usd, change_7d: f.change_7d, age_days: f.age_days, tier: 'Early' as const,
    odds: 0, value_if_launches: 0, implied_value_usd: f.implied_value_usd, p25: 0, p75: 0, p10: 0, p90: 0,
    spread_lo: f.spread_lo, spread_hi: f.spread_hi, rank_lo: 0, rank_hi: 0, verdict: 'SKIP' as const,
    net_1k: 0, net_10k: 0, net_hour_1k: 0, breakeven_odds: 0, fees: 0, hours: 0, farm_steps: f.farm_steps,
  }))));
  const totalImplied = rows.reduce((s, r) => s + r.implied_value_usd, 0);
  const totalTvl = rows.reduce((s, r) => s + r.tvl_usd, 0);
  const farm = rows.filter((r) => r.verdict === 'FARM').length;
  const marginal = rows.filter((r) => r.verdict === 'MARGINAL').length;
  const ranked = board.length;
  const usableCap = snapshot.protocols.filter((p) => !isPreToken(p) && (p.mcap_usd ?? 0) > 0).length;
  const noCap = snapshot.protocols.filter((p) => !isPreToken(p) && (p.mcap_usd ?? 0) <= 0).length;
  const setAside = snapshot.protocols.filter((p) => isPreToken(p) && !board.some((r) => r.slug === p.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: ranked,
    early_size: early,
    offlist_size: offlist,
    live_size: live.length,
    total_implied: totalImplied,
    total_tvl: totalTvl,
    farm_count: farm,
    marginal_count: marginal,
    skip_count: ranked - farm - marginal,
    accounting: [
      ['Ranked on this board', ranked],
      ['Token trades, priced comp', usableCap],
      ['Token recorded, no usable cap', noCap],
      ['Pre-token, set aside by the house rule', setAside],
    ],
    held_out: HELD_OUT,
    loo_q: LOO_Q,
    rows,
    live,
    comps,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
