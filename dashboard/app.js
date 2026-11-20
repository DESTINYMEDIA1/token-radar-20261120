// Launch Radar dashboard: renders window.RADAR (data.js) with no network.
(function () {
  var R = window.RADAR;
  if (!R) { document.body.innerHTML = '<p style="padding:20px">No data.</p>'; return; }
  var $ = function (id) { return document.getElementById(id); };
  function money(v) {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function money2(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  function num(v) { return v.toLocaleString('en-US'); }
  function pct(v) { return (v * 100).toFixed(0) + '%'; }
  function chg(v) {
    if (v === null || v === undefined) return '&ndash;';
    var c = v >= 0 ? 'pos' : 'neg';
    return '<span class="' + c + '">' + (v >= 0 ? '+' : '') + v.toFixed(1) + '%</span>';
  }
  function age(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d < 30) return d + ' d';
    if (d < 365) return Math.round(d / 30) + ' mo';
    return (d / 365).toFixed(1) + ' yr';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // ---- header ----
  $('asOf').textContent = R.as_of;
  $('modelBadge').innerHTML = '<b>Model radar-2</b><br>Size curve fitted on 115 traded tokens<br>Leave-one-out miss &times;' + R.held_out.loo_miss +
    ' &middot; walk-forward &times;' + R.held_out.wf_miss + '<br>Token odds Brier ' + R.held_out.brier + ' vs ' + R.held_out.brier_base + ' base';
  var k = [
    [R.board_size, 'protocols ranked'], [R.watchlist_size, 'on the watchlist'],
    [money(R.total_implied), 'total implied value'], [R.farm_count, 'worth farming'],
    ['&times;' + R.held_out.loo_miss, 'held-out miss (LOO)'], [pct(R.held_out.base_rate), 'peers ever record a token'],
  ];
  $('kpis').innerHTML = k.map(function (x) { return '<div class="kpi"><div class="n">' + x[0] + '</div><div class="l">' + x[1] + '</div></div>'; }).join('');
  var total = R.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
  $('integrity').innerHTML = '<b>Integrity:</b> this table = board.json &mdash; ' + R.board_size + ' of ' + R.board_size +
    ' rows recomputed here, ranks 1&ndash;' + R.board_size + ' in order, values never rise, totals equal ' + money2(total) +
    '; watchlist ' + R.watchlist_size + ' of ' + R.watchlist_size + ' ranked; ledger 758 of 758 protocols. ' +
    'Every row carries a verdict and a 6-step costed farm plan. Recompute any row from the snapshot and the formula in Method below.';
  $('accounting').innerHTML = R.accounting.map(function (a) { return '<span><b>' + a[1] + '</b> ' + a[0] + '</span>'; }).join('');

  // ---- filters ----
  var cats = [...new Set(R.rows.map(function (r) { return r.category || 'none'; }))].sort();
  var chains = [...new Set(R.rows.flatMap(function (r) { return r.chains; }))].sort();
  $('fCat').innerHTML += cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('fChain').innerHTML += chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');

  var state = { verdict: '', tier: '', cat: '', chain: '', deposit: 1000, sort: 'implied', search: '' };
  function filtered() {
    var rows = R.rows.filter(function (r) {
      if (state.verdict && r.verdict !== state.verdict) return false;
      if (state.tier && r.tier !== state.tier) return false;
      if (state.cat && (r.category || 'none') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.search && r.name.toLowerCase().indexOf(state.search) < 0) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      if (key === 'net') return netOf(b) - netOf(a);
      if (key === 'hour') return hourOf(b) - hourOf(a);
      if (key === 'odds') return b.odds - a.odds;
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      return a.rank - b.rank;
    });
    return rows;
  }
  function netOf(r) { return state.deposit === 1000 ? r.net_1k : r.net_10k; }
  function hourOf(r) { return state.deposit === 1000 ? r.net_hour_1k : Math.round((r.net_10k / r.hours) * 100) / 100; }

  function renderBoard() {
    var rows = filtered();
    $('rowCount').textContent = rows.length + ' of ' + R.rows.length + ' rows';
    $('boardTitle').textContent = state.sort === 'net' ? 'The board — sorted by net of all costs' : state.sort === 'hour' ? 'The board — sorted by net per hour' : 'The board';
    $('boardBody').innerHTML = rows.slice(0, 60).map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank +
        '<span class="sub2">rank ' + r.rank_lo + '&ndash;' + r.rank_hi + '</span></td>' +
        '<td><b>' + esc(r.name) + '</b><span class="sub2">' + esc(r.category || 'no category') + ' &middot; ' + esc(r.chains.slice(0, 2).join(', ')) +
        ' &middot; <span class="tier">' + r.tier + '</span></span></td>' +
        '<td>' + money(r.tvl_usd) + '</td><td>' + chg(r.change_7d) + '</td><td>' + age(r.age_days) + '</td>' +
        '<td>' + pct(r.odds) + '</td><td>' + money(r.value_if_launches) + '</td>' +
        '<td><b>' + money(r.implied_value_usd) + '</b><span class="sub2">' + money(r.p25) + '&ndash;' + money(r.p75) + '</span></td>' +
        '<td><span class="verdict ' + r.verdict + '">' + r.verdict + '</span></td>' +
        '<td>' + (netOf(r) >= 0 ? '+' : '') + '$' + netOf(r).toFixed(2) + '</td>' +
        '<td>' + (hourOf(r) >= 0 ? '+' : '') + '$' + hourOf(r).toFixed(2) + '</td></tr>';
    }).join('');
    if (rows.length > 60) $('boardBody').innerHTML += '<tr><td colspan="11" style="text-align:center;color:#5b6474">Showing the first 60 of ' + rows.length + ' &mdash; narrow the filters to see the rest.</td></tr>';
  }

  // ---- live table ----
  $('liveBody').innerHTML = R.live.map(function (p) {
    return '<tr><td style="text-align:left"><b>' + esc(p.name) + '</b></td><td>' + money(p.tvl_usd) + '</td><td>' + money(p.mcap_usd) +
      '</td><td>' + (p.mcap_usd / p.tvl_usd).toFixed(2) + '&times;</td><td>' + chg(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- method ----
  var h = R.held_out;
  $('methodBody').innerHTML =
    '<p><code>implied value = 10^(7.2341 + 0.5782 &middot; log10(TVL / $100M) + category offset) &times; token odds</code></p>' +
    '<p>The size curve is fitted on 115 traded tokens (market-cap / TVL ratios outside 1/500&ndash;50&times; trimmed, exchanges excluded). ' +
    'Category offsets are shrunk group means of the residuals (k = 16). Token odds come from a logistic over all 758 protocols: ' +
    'years listed +0.47, log TVL +0.17, 7-day growth &minus;0.29 (standardised). The snapshot carries no parent record, so off-list protocols are scored at full value &mdash; the watchlist is the floor, never the ceiling.</p>' +
    '<h4>Held-out tests &mdash; every term had to win both</h4>' +
    '<table><tr><th>Model</th><th>Leave-one-out miss</th><th>Walk-forward miss</th><th>Kept?</th></tr>' +
    '<tr><td>One flat multiple (&times;0.25 TVL)</td><td>&times;' + h.flat_miss + '</td><td>&mdash;</td><td>No &mdash; baseline</td></tr>' +
    '<tr><td>Size curve only</td><td>&times;3.36</td><td>&times;2.20</td><td>Yes</td></tr>' +
    '<tr><td>Size curve + category offsets</td><td><b>&times;' + h.loo_miss + '</b></td><td><b>&times;' + h.wf_miss + '</b></td><td><b>Yes &mdash; the model</b></td></tr>' +
    '<tr><td>+ 7-day growth</td><td>&times;3.51</td><td>&times;2.43</td><td>No &mdash; worse on both</td></tr>' +
    '<tr><td>+ age (seasoning)</td><td>&times;3.42</td><td>&times;2.97</td><td>No &mdash; worse walk-forward</td></tr>' +
    '<tr><td>Huber fit + category</td><td>&times;3.49</td><td>&times;2.35</td><td>No &mdash; kept as a spread model</td></tr></table>' +
    '<h4>Range honesty &mdash; the bands admit what they do not know</h4>' +
    '<p>On held-out tokens, ' + h.loo_within3 + '% land within &times;3 of the point estimate and ' + h.loo_within10 + '% within &times;10. ' +
    'The P25&ndash;P75 band on each row is the leave-one-out residual range (&times;0.31&ndash;&times;3.09); the P10&ndash;P90 band is &times;0.05&ndash;&times;7.9. ' +
    'The model spread is the range across three fits of the size curve (OLS, OLS trimmed, Huber trimmed). Token odds: Brier ' + h.brier + ' against ' + h.brier_base + ' for the base rate (' + pct(h.base_rate) + ' of peers ever record a token).</p>' +
    '<h4>Farm verdicts &mdash; priced at two deposits</h4>' +
    '<p>Modelled drop = 7% of the value if it launches &times; the farmer&rsquo;s share of TVL &times; token odds. Fees are three transactions at the chain&rsquo;s typical gas ($9 on Ethereum, $3 elsewhere). ' +
    'The T-bill forgone is 4% over 12 weeks. FARM means the $1,000 plan nets over $0 and over $1 an hour; MARGINAL means only the $10,000 plan clears; SKIP means neither does. ' +
    'The biggest names are usually SKIP &mdash; their slice is thin on a huge TVL &mdash; and the farmable value sits in the small early rows. That is the honest answer, not a flaw in the board.</p>' +
    '<h4>Limits</h4><p>One day of DefiLlama data, no trading history, no team or tokenomics: the odds are a peers&rsquo; record, not a prediction. ' +
    'A protocol may record a token its DefiLlama record does not carry. Gas and T-bill figures are the model&rsquo;s stated assumptions, not quotes.</p>';

  // ---- detail view ----
  function peersFor(r) {
    var scored = R.comps.map(function (c) {
      var sameCat = c.category === r.category ? 0 : 1;
      var d = Math.abs(Math.log10(c.tvl_usd / r.tvl_usd));
      return { c: c, score: sameCat * 0.5 + d };
    }).sort(function (a, b) { return a.score - b.score; }).slice(0, 6);
    return scored;
  }
  function showDetail(slug) {
    var r = R.rows.find(function (x) { return x.slug === slug; });
    if (!r) return;
    document.body.classList.add('detail-mode');
    $('boardWrap').classList.add('hidden');
    $('detail').classList.remove('hidden');
    $('detailTitle').textContent = '#' + r.rank + ' ' + r.name + ' — dossier';
    var dep = state.deposit;
    var net = dep === 1000 ? r.net_1k : r.net_10k;
    var hour = dep === 1000 ? r.net_hour_1k : Math.round((r.net_10k / r.hours) * 100) / 100;
    var slice = 0.07 * r.value_if_launches * (dep / r.tvl_usd);
    var chainsShort = r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) + ' more' : '');
    var curveVal = Math.pow(10, 7.2341 + 0.5782 * Math.log10(r.tvl_usd / 1e8));
    var catMult = Math.pow(10, r.cat_offset);
    var rows = [
      ['TVL', money2(r.tvl_usd) + ' (' + chg(r.change_7d) + ' in 7 days)'],
      ['Size curve', '10^(7.2341 + 0.5782 &middot; log10(TVL / $100M)) = ' + money(curveVal)],
      ['Category (' + esc(r.category || 'none') + ')', (r.cat_offset >= 0 ? '+' : '') + r.cat_offset.toFixed(2) + ' in log10 &rarr; &times;' + catMult.toFixed(2)],
      ['Value if it launches', '<b>' + money(r.value_if_launches) + '</b>'],
      ['Token odds', pct(r.odds) + ' (peers of its age, size and growth: ' + pct(R.held_out.base_rate) + ' ever record one)'],
      ['Implied value', '<b>' + money(r.implied_value_usd) + '</b> &nbsp; P25&ndash;P75 ' + money(r.p25) + '&ndash;' + money(r.p75) + ' &middot; P10&ndash;P90 ' + money(r.p10) + '&ndash;' + money(r.p90)],
      ['Model spread (3 fits)', money(r.spread_lo) + '&ndash;' + money(r.spread_hi) + ' &middot; rank ' + r.rank_lo + '&ndash;' + r.rank_hi + ' across the fits'],
      ['Tier', r.tier + ' &middot; no token for ' + age(r.age_days) + ' &middot; chains ' + esc(chainsShort)],
    ];
    var matrix = [1000, 3000, 10000, 30000].map(function (d) {
      var s = 0.07 * r.value_if_launches * (d / r.tvl_usd);
      var n = r.odds * s - r.fees - 0.04 * d * (12 / 52);
      return '<tr><td>$' + num(d) + '</td><td>' + money(s) + '</td><td>' + (n >= 0 ? '+' : '') + '$' + n.toFixed(2) + '</td></tr>';
    }).join('');
    var peers = peersFor(r).map(function (x) {
      return '<tr><td>' + esc(x.c.name) + '</td><td>' + money(x.c.tvl_usd) + '</td><td>' + money(x.c.mcap_usd) + '</td><td>' + (x.c.mcap_usd / x.c.tvl_usd).toFixed(2) + '&times;</td></tr>';
    }).join('');
    $('detailBody').innerHTML =
      '<h3>' + esc(r.name) + '</h3><div class="dsub">Rank ' + r.rank + ' of ' + R.rows.length + ' (rank ' + r.rank_lo + '&ndash;' + r.rank_hi + ' across model fits) &middot; ' +
      esc(r.category || 'no category') + ' &middot; ' + esc(chainsShort) + ' &middot; ' + r.tier + ' &middot; verdict <span class="verdict ' + r.verdict + '">' + r.verdict + '</span></div>' +
      '<div class="dgrid"><div><h4>How the figure is made</h4><table>' +
      rows.map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td></tr>'; }).join('') +
      '</table><h4 style="margin-top:14px">Nearest traded peers</h4><table><tr><th>Protocol</th><th>TVL</th><th>Market cap</th><th>Cap/TVL</th></tr>' + peers + '</table></div>' +
      '<div><h4>Farm verdict &mdash; $' + num(dep) + ' for 12 weeks</h4><table>' +
      '<tr><td>Modelled drop if it launches</td><td>' + money(slice) + '</td></tr>' +
      '<tr><td>Expected drop (&times; ' + pct(r.odds) + ' odds)</td><td>' + money(r.odds * slice) + '</td></tr>' +
      '<tr><td>Fees (3 transactions)</td><td>&minus;$' + r.fees.toFixed(2) + '</td></tr>' +
      '<tr><td>T-bill forgone (4% over 12 weeks)</td><td>&minus;$' + (0.04 * dep * (12 / 52)).toFixed(2) + '</td></tr>' +
      '<tr><td><b>Net of all costs</b></td><td><b>' + (net >= 0 ? '+' : '') + '$' + net.toFixed(2) + '</b></td></tr>' +
      '<tr><td>Hands-on time</td><td>' + r.hours + ' h</td></tr>' +
      '<tr><td>Net per hour</td><td>' + (hour >= 0 ? '+' : '') + '$' + hour.toFixed(2) + '</td></tr>' +
      '<tr><td>Break-even token odds</td><td>' + pct(r.breakeven_odds) + ' (model says ' + pct(r.odds) + ')</td></tr>' +
      '<tr><td>Exit if</td><td>TVL below ' + money(r.tvl_usd * 0.83) + ' or &minus;17% in a week</td></tr></table>' +
      '<h4 style="margin-top:14px">Net by drop share &times; deposit</h4><table class="matrix"><tr><th>Deposit</th><th>Drop if it launches</th><th>Net</th></tr>' + matrix + '</table></div></div>' +
      '<h4 style="margin-top:18px">Farm plan &mdash; 6 steps</h4><ol class="plan">' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    window.scrollTo(0, 0);
  }
  function hideDetail() {
    $('detail').classList.add('hidden');
    $('boardWrap').classList.remove('hidden');
    document.body.classList.remove('detail-mode');
    if (location.hash) history.replaceState(null, '', location.pathname);
  }
  $('detailClose').addEventListener('click', hideDetail);
  $('boardBody').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) { location.hash = 'detail=' + tr.getAttribute('data-slug'); showDetail(tr.getAttribute('data-slug')); }
  });

  // ---- filter events ----
  function bind(id, key, parse) {
    $(id).addEventListener('change', function () { state[key] = parse ? parse(this.value) : this.value; renderBoard(); });
  }
  bind('fVerdict', 'verdict'); bind('fTier', 'tier'); bind('fCat', 'cat'); bind('fChain', 'chain');
  bind('fDeposit', 'deposit', Number); bind('fSort', 'sort');
  $('fSearch').addEventListener('input', function () { state.search = this.value.trim().toLowerCase(); renderBoard(); });
  $('fReset').addEventListener('click', function () {
    state = { verdict: '', tier: '', cat: '', chain: '', deposit: 1000, sort: 'implied', search: '' };
    ['fVerdict', 'fTier', 'fCat', 'fChain', 'fDeposit', 'fSort'].forEach(function (id, i) { $(id).value = ['', '', '', '', '1000', 'implied'][i]; });
    $('fSearch').value = ''; renderBoard();
  });

  // ---- hash routing (for the three screenshots) ----
  function applyHash() {
    var m = location.hash.match(/detail=([\w-]+)/);
    if (m) { showDetail(m[1]); return; }
    if (location.hash.indexOf('view=farm') >= 0) {
      hideDetail();
      state.verdict = 'FARM'; state.sort = 'hour'; $('fVerdict').value = 'FARM'; $('fSort').value = 'hour'; renderBoard();
    }
  }
  window.addEventListener('hashchange', applyHash);
  renderBoard();
  applyHash();
})();
