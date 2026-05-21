/* ════════════════════════════════════════════════════════════════════════════════════════════════
  Investify
   ════════════════════════════════════════════════════════════════════════════════════════════════

   WHAT THIS FILE DOES
   -------------------
   This file contains the main simulation logic for the game. It manages the player's money, prices, trades,
   scoring, news, the tutorial, and the end-of-game results submission. It is loaded by `index.html` AFTER
   the static-data files below have been parsed.

   REQUIRED LOAD ORDER (set in index.html, do not change):
     1.  Chart.js                (external library, used for all charts)
     2.  assets-data.js          → defines `ASSETS` (the investable instruments)
     3.  news-data.js            → defines `newsDatabase`, `newsCommentary`, `BREAKING_NEWS`,
                                   `SCENARIOS`, `YEAR_SCRIPT` (everything news/scenario-related)
     4.  tutorial-data.js        → defines `tutSteps` (the on-boarding script)
     5.  marketsim.js            → the main simulation engine (this file)
     6.  index.html              → the HTML structure, which `marketsim.js` manipulates to show the game interface
     7.  marketsim.css           → styles for the simulation 


   GAME FLOW
   ----------------------
   ┌──────────────┐   ┌──────────┐   ┌────────────────────────────────────────┐   ┌──────────┐
   │ participant  │ → │ tutorial │ → │ 20 yearly rounds:                      │ → │ endGame  │
   │ enters ID    │   │ overlay  │   │  • buy/sell from market                │   │ + submit │
   └──────────────┘   └──────────┘   │  • read news                           │   └──────────┘
                                     │  • click "Advance Year" → nextYear()   │
                                     │    – applies news price impact         │
                                     │    – simulates new prices              │
                                     │    – updates Discipline & Diversity    │
                                     │    – shows year-news modal             │
                                     └────────────────────────────────────────┘

   TWO PLAYER SCORES
   ------------------------------------------------
     • Discipline (`state.metrics.emotionalDiscipline`)   — starts at 100, drops by 8 each time
                                                            the player reacts to a fake/uncredible
                                                            headline. Never goes up.
     • Diversity  (`state.metrics.diversityConsistency`)  — rolling average of per-year scores
                                                            based on how spread-out the portfolio
                                                            is across asset classes AND sectors.
                                                            Pure index-fund portfolios get full
                                                            marks because index funds are
                                                            already diversified internally.

   FILE LAYOUT (search for the headers to jump around)
   ---------------------------------------------------
     1) STATE & CONSTANTS
     2) HISTORICAL PRICE SEEDING
     3) HELPERS
     4) CHART INSTANCES
     5) ASSET DETAIL CHART DATA (mock long-history)
     6) SPARKLINE DRAWING
     7) MARKET PANEL RENDERING
     8) MODAL UTILITIES + YEAR-NEWS MODAL
     9) BREAKING NEWS (mid-year pop-ups)
    10) ASSET DETAIL MODAL
    11) SCORECARD SIDEBAR
    12) NEWS FEED & ARTICLE READER
    13) MAIN UI UPDATE + PORTFOLIO DONUT
    14) BUY / SELL ORDERS
    15) SIDEBAR (donut tab, holdings, pending orders, transactions)
    16) YEAR ADVANCE + END GAME
    17) TUTORIAL ENGINE
    18) PARTICIPANT START FLOW
    19) INIT (window.onload)
    20) RESULTS EXPORT TO GOOGLE SHEETS
   ════════════════════════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   1) STATE & CONSTANTS
   ════════════════════════════════════════════════════════════════════════════════════════════════
   `state` is the single source of truth for the simulation. Every other function reads/writes here.
   Anything you add should go in this object so save/restore stays possible later if needed. */

let state = {
  // Money
  cash: 10000,                    // Liquid cash currently available
  totalInvestedInput: 10000,      // Cumulative cash put in (starting + yearly income). Used to
                                  // compute the % gain shown in the header.
  income: 10000,                  // Cash added each year on "Advance Year"

  // Time
  step: 0,                        // Current year (0 = start, 20 = game over)
  maxSteps: 20,                   // Total years the game runs for

  // Portfolio
  holdings: {},                   // { assetId: numberOfUnits } — live positions
  displayHoldings: {},            // Snapshot of `holdings` committed on year-advance.
                                  // Used by the sidebar so intra-year trades don't flash.
  initialPrices: {},              // { assetId: startingPrice } — kept so we can show gain %
  priceHistory: {},               // { assetId: [price, price, ...] } — monthly points used by sparklines

  // Net-worth tracking (used only for the end-of-game comparison chart)
  historyLabels: ['Year 0'],
  netWorthHistory: [10000],

  // Scoring metrics
  metrics: {
    emotionalDiscipline: 100,    // Starts at 100, −8 each time player reacts to fake news
    diversityConsistency: 100,   // Rolling-average diversity score, displayed 0-100
    diversityRoundScores: []     // Per-year 0-10 diversity score, averaged for the display
  },

  // Per-year buffers (reset each year inside nextYear)
  tradedAssets: {},               // { assetId: true } — which assets were traded THIS year
  pendingOrders: [],              // Trades made this year (for the "This Year's Trades" panel)
  transactions: [],               // Full trade log across the whole game (for the history modal)

  // Crash aftershocks
  _aftershocks: {}                // { sector: { yearsLeft, drag } } — lingering drag from scenarios
};

// Timing + Sheets-export config (used by Section 20 below; declared here so simStartTime is in
// scope when startSimulation() writes to it).
let simStartTime = null;
const APPS_SCRIPT_URL   = ''; // to fill with App Script URL. It should end with /exec 
const SURVEY_REDIRECT_URL = 'https://www.moneysense.gov.sg/'; 
const STUDY_TOKEN       = ''; // a secret token to prevent unauthorized submissions to the Google Sheet. Must match the token in the Apps Script.


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   2) HISTORICAL PRICE SEEDING
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Each asset card shows a 1-year sparkline. To make those sparklines look realistic AT GAME
   START (when no real time has passed), we manufacture a fake 20-year history per sector,
   modelled on real-world counterparts (AAPL, KO, JNJ, XOM, SGS, XLRE, SPY).

   This data is ONLY used for visuals. The live simulation drives prices via nextYear()'s
   price engine — these arrays are never consulted again after seeding. */

const SECTOR_PROFILES = {
  // Numbers are 20 yearly returns; `noise` is the per-month random kick.
  Technology:           { yearlyReturns:[-0.10,0.08,0.32,0.20,-0.15,0.18,0.40,0.15,0.26,-0.05,-0.02,0.12,0.48,-0.05,0.30,0.82,0.35,-0.27,0.48,0.30], noise:0.04 },
  'Food and Beverage':  { yearlyReturns:[ 0.06,0.04,0.08,-0.02,0.10,0.07,0.05,0.09,0.02,0.08,0.05,0.01,0.10,0.08,0.16,-0.04,0.25,0.07,-0.02,0.06], noise:0.02 },
  Healthcare:           { yearlyReturns:[ 0.08,0.05,0.12,-0.03,0.10,0.18,0.06,-0.05,0.14,0.09,-0.02,0.15,0.22,0.05,0.08,0.10,0.24,0.02,-0.05,0.04], noise:0.025 },
  Energy:               { yearlyReturns:[ 0.12,0.08,-0.05,0.20,-0.30,-0.10,0.15,0.05,-0.18,0.22,-0.15,0.17,-0.05,0.08,-0.10,-0.35,0.55,0.65,-0.08,0.10], noise:0.05 },
  Govt:                 { yearlyReturns:[ 0.02,0.03,0.02,0.02,0.03,0.02,0.02,0.03,0.02,0.02,0.02,0.02,0.03,0.02,0.02,0.03,0.02,0.01,0.02,0.02], noise:0.003 },
  'Real Estate':        { yearlyReturns:[ 0.06,0.10,-0.20,-0.15,0.18,0.12,0.08,0.05,0.10,0.07,0.04,0.08,-0.02,0.06,0.24,-0.06,0.42,-0.25,0.12,0.03], noise:0.03 },
  Global:               { yearlyReturns:[ 0.10,0.05,-0.37,0.26,0.15,0.02,0.16,0.32,-0.04,0.21,0.01,0.12,0.22,-0.04,0.31,0.18,0.28,-0.18,0.26,0.24], noise:0.025 }
};

// Seed initial state for every asset.
ASSETS.forEach(a => {
  state.holdings[a.id]      = 0;
  state.initialPrices[a.id] = a.price;

  // Generate 20 years × 12 months = 240 historical points that end exactly at the current price.
  const profile     = SECTOR_PROFILES[a.sector] || SECTOR_PROFILES.Global;
  const totalReturn = profile.yearlyReturns.reduce((acc, r) => acc * (1 + r), 1);
  let p             = a.price / totalReturn;   // back-solve a starting price
  const hist        = [];

  profile.yearlyReturns.forEach(yearReturn => {
    const endPrice = p * (1 + yearReturn);
    // Random walk with a weak monthly pull toward the year-end target. 8% of months get an
    // extra random spike to break up the smoothness.
    for (let m = 0; m < 12; m++) {
      const drift = (endPrice - p) * 0.06;
      const noise = (Math.random() - 0.5) * 2 * profile.noise * p * 2.5;
      const spike = (Math.random() < 0.08) ? (Math.random() - 0.5) * profile.noise * p * 4 : 0;
      p = Math.max(p + drift + noise + spike, p * 0.85);
      hist.push(Math.round(p * 100) / 100);
    }
    // Pull part-way toward the expected year-end so the curve stays loosely on-track.
    p = p * 0.3 + endPrice * 0.7;
  });

  hist.push(a.price);            // anchor the final point exactly at today's price
  state.priceHistory[a.id] = hist;
});


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   3) HELPERS
   ════════════════════════════════════════════════════════════════════════════════════════════════ */

// News items refer to companies by display name (e.g. "Orange"), but ASSETS have full names
// (e.g. "Orange Inc."). This bridges the two. Only assets whose display name differs from
// their `name` field need an entry here.
function getCompanyName(asset) {
  const overrides = { ORI: 'Orange' };
  return overrides[asset.id] || asset.name;
}


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   4) CHART INSTANCES
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Three Chart.js instances live for the entire session:
     • allocChart      — the portfolio donut in the sidebar (re-rendered on every change)
     • detailChart     — the line chart inside the asset-detail modal (rebuilt each open)
     • comparisonChart — the "you vs mattress" chart on the end-game modal (built once) */

const allocChart = new Chart(document.getElementById('allocationChart'), {
  type: 'doughnut',
  data: { labels:['Cash'], datasets:[{ data:[10000], backgroundColor:['#3498db'] }] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend:  { display:true, position:'bottom', labels:{ boxWidth:10, font:{ size:11 }, padding:8 } },
      tooltip: { callbacks: { label: ctx => {
        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
        const pct   = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
        return `${ctx.label}: $${Math.floor(ctx.raw).toLocaleString()} (${pct}%)`;
      }}}
    }
  }
});

let detailChart       = null;
let comparisonChart   = null;
let currentDetailData = null;   // cached data for the asset-detail modal (so timeframe buttons can switch quickly)


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   5) ASSET DETAIL CHART DATA (mock long-history)
   ════════════════════════════════════════════════════════════════════════════════════════════════
   The asset-detail modal shows three timeframes: Day / Month / Year. These are NOT the real
   simulation history — they are mock data generated on-the-fly per asset so each chart looks
   distinct (Tech is wild, bonds are flat, etc.). Only used inside `showAssetDetail`. */

function getMockHistory(assetId, category, sector) {
  // Per-asset volatility profiles. Default catches assets not listed here.
  const profiles = {
    ORI:{ drift:0.18, vol:0.28 }, KOL:{ drift:0.07, vol:0.12 },
    JNJ:{ drift:0.09, vol:0.15 }, DIF:{ drift:0.05, vol:0.24 },
    SGS:{ drift:0.02, vol:0.05 }, default:{ drift:0.05, vol:0.20 }
  };
  const s         = profiles[assetId] || profiles.default;
  const basePrice = ASSETS.find(a => a.id === assetId).price;

  const labels = { D:[], M:[], Y:[] };
  const data   = { D:[], M:[], Y:[] };

  // Day view: 1440 minute-resolution points
  let dPrice = basePrice;
  for (let i = 0; i < 1440; i++) {
    dPrice *= 1 + (Math.random() - 0.5) * (s.vol / 60);
    labels.D.push(i % 120 === 0 ? `${Math.floor(i/60)}:00` : '');
    data.D.push(dPrice);
  }
  // Month view: 252 daily points (≈ 1 year of trading days)
  let mPrice = basePrice * 0.9;
  for (let i = 0; i < 252; i++) {
    mPrice *= 1 + (Math.random() - 0.495) * (s.vol / 8);
    labels.M.push(i % 21 === 0 ? `M${Math.floor(i/21) + 1}` : '');
    data.M.push(mPrice);
  }
  // Year view: 20 years monthly, with special drift in 2008 (GFC) and 2020 (COVID)
  let yPrice = basePrice * 0.15;
  for (let i = 0; i < 240; i++) {
    const yr = 2006 + Math.floor(i / 12);
    let drift = 0.008;
    if (yr === 2008) drift = -0.04;
    if (yr === 2020) drift = sector === 'Technology' ? 0.06 : -0.02;
    yPrice *= 1 + (Math.random() - 0.5) * (s.vol / 3) + drift;
    labels.Y.push(i % 12 === 0 ? yr.toString() : '');
    data.Y.push(yPrice);
  }
  return { labels, data };
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   6) SPARKLINE DRAWING
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Each asset card has a tiny <canvas> showing the 1-year price line. We draw it manually with
   raw canvas (no Chart.js) because sparklines need to render very fast and on many canvases
   at once after every renderMarket() call. */

function drawSparkline(canvasId, dataPoints) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ×2 backing buffer for crisp retina rendering
  const W = canvas.width  = canvas.offsetWidth  * 2;
  const H = canvas.height = canvas.offsetHeight * 2;
  ctx.clearRect(0, 0, W, H);
  if (dataPoints.length < 2) return;

  // Scaling helpers: map array index → x, array value → y
  const min   = Math.min(...dataPoints);
  const max   = Math.max(...dataPoints);
  const range = max - min || 1;
  const pad   = 4;
  const toX   = i => pad + (i / (dataPoints.length - 1)) * (W - pad * 2);
  const toY   = v => H - pad - ((v - min) / range) * (H - pad * 2);

  // Green if year ended up; red if down. Used for both the line and the fill gradient.
  const isUp      = dataPoints[dataPoints.length - 1] >= dataPoints[0];
  const lineColor = isUp ? '#27ae60' : '#e74c3c';
  const grad      = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, isUp ? 'rgba(39,174,96,0.25)' : 'rgba(231,76,60,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  // Helper: trace the smooth curve from left to right (shared by fill + stroke)
  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(dataPoints[0]));
    for (let i = 1; i < dataPoints.length; i++) {
      const cx = (toX(i - 1) + toX(i)) / 2;
      ctx.bezierCurveTo(cx, toY(dataPoints[i - 1]), cx, toY(dataPoints[i]), toX(i), toY(dataPoints[i]));
    }
  };

  // 1) Filled area under the curve
  tracePath();
  ctx.lineTo(toX(dataPoints.length - 1), H);
  ctx.lineTo(toX(0), H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 2) Line on top
  tracePath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // 3) Dot on the latest price
  ctx.beginPath();
  ctx.arc(toX(dataPoints.length - 1), toY(dataPoints[dataPoints.length - 1]), 4, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();
}


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   7) MARKET PANEL RENDERING
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Builds the grid of asset cards in the middle of the screen. Cards are grouped by category:
     • Shares           (category === 'stock')
     • Sector ETFs
     • Bonds            (category === 'bond')
     • Index Funds
   Bonds and Index Funds share a side-by-side row at the bottom. */

function renderMarket() {
  // Group ASSETS by category in one pass
  const grouped = {};
  ASSETS.forEach(a => {
    (grouped[a.category] = grouped[a.category] || []).push(a);
  });

  let html = '';

  // -- Top: Shares + Sector ETFs, one row each --
  ['stock', 'Sector ETFs'].forEach(cat => {
    const assets = grouped[cat];
    if (!assets || assets.length === 0) return;
    const label = cat === 'stock' ? 'Shares' : 'Sector ETFs';
    html += `<div class="market-category">
      <div class="market-category__label">${label}</div>
      <div class="market-category__grid">`;
    assets.forEach(a => { html += buildAssetCard(a); });
    html += `</div></div>`;
  });

  // -- Bottom: Bonds | Index Funds in two columns --
  const bonds = grouped['bond']        || [];
  const index = grouped['Index Funds'] || [];
  if (bonds.length > 0 || index.length > 0) {
    html += `<div class="market-category">
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;">`;
    html += `<div><div class="market-category__label" style="margin-bottom:6px;">Bonds</div>`;
    bonds.forEach(a => { html += buildAssetCard(a); });
    html += `</div>`;
    html += `<div style="width:1px;background:#e0e0e0;min-height:100%;margin:0 4px;"></div>`;
    html += `<div><div class="market-category__label" style="margin-bottom:6px;">Index Funds</div>`;
    index.forEach(a => { html += buildAssetCard(a); });
    html += `</div></div></div>`;
  }

  document.getElementById('marketGrid').innerHTML = html;

  // Make the "Advance Year" button pulse if there are unsubmitted trades (visual nudge).
  const advBtn = document.getElementById('advanceBtn');
  if (advBtn) {
    const hasTraded = state.pendingOrders.length > 0;
    advBtn.className = 'btn-advance' + (hasTraded ? ' btn-pulse-active' : '');
  }

  // Draw sparklines AFTER the DOM is in place (canvases need a layout to size themselves).
  requestAnimationFrame(() => {
    ASSETS.forEach(a => {
      const hist          = state.priceHistory[a.id] || [];
      const oneYearSlice  = hist.slice(Math.max(0, hist.length - 13)); // last 13 monthly points = ~1 year
      drawSparkline('spark-' + a.id, oneYearSlice);
    });
    // Re-apply the tutorial highlight if the step is targeting a market card (renderMarket()
    // wipes the DOM, so the highlight class needs to be re-added).
    if (tutorialActive) {
      const step = tutSteps[tutStep];
      if (step && step.el) document.getElementById(step.el)?.classList.add('tut-highlight');
    }
  });
}

// Builds the HTML for one asset card. Pure function — no side-effects.
function buildAssetCard(a) {
  const hist            = state.priceHistory[a.id] || [];
  const oneYearAgoIdx   = Math.max(0, hist.length - 13);
  const oneYearAgoPrice = hist[oneYearAgoIdx] || a.price;
  const pctChange       = ((a.price - oneYearAgoPrice) / oneYearAgoPrice * 100);
  const changeColor     = pctChange >= 0 ? '#27ae60' : '#e74c3c';
  const changeSign      = pctChange >= 0 ? '+' : '';

  return `
  <div class="asset-card" id="card-${a.id}" onclick="selectAssetCard('${a.id}')">
    <div class="asset-card__header">
      <span class="tag tag-${a.sector.toLowerCase().replace(/\s/g,'')} tag--static">${a.sector}</span>
      <small class="asset-card__ticker">${a.id}</small>
    </div>
    <div class="asset-card__row">
      <div>
        <div class="asset-card__name asset-card__name--clickable"
             onclick="event.stopPropagation();showAssetDetail('${a.id}')">${a.name}</div>
        <div class="asset-card__price">$${a.price.toFixed(2)}</div>
      </div>
      <div style="text-align:right;">
        <div class="asset-card__change" style="color:${changeColor};">${changeSign}${pctChange.toFixed(1)}%</div>
        <div class="asset-card__year">1Y</div>
      </div>
    </div>
    <div class="sparkline-wrap"><canvas id="spark-${a.id}" class="sparkline-canvas"></canvas></div>
    <div class="asset-card__owned" id="owned-${a.id}">Owned: ${state.holdings[a.id] || 0}</div>
    <div class="asset-card__controls">
      <label class="asset-card__qty-label">Qty:</label>
      <input type="number" id="qty-${a.id}" value="1" min="1" class="asset-card__qty-input"
             onclick="event.stopPropagation()">
      <button class="btn-buy"  onclick="event.stopPropagation();buy('${a.id}')">Buy</button>
      <button class="btn-sell" onclick="event.stopPropagation();sell('${a.id}')">Sell</button>
    </div>
  </div>`;
}

// Pure visual: clicking a card highlights it; clicking again clears the highlight.
function selectAssetCard(id) {
  const card = document.getElementById('card-' + id);
  if (!card) return;
  const wasSelected = card.classList.contains('asset-card--selected');
  document.querySelectorAll('.asset-card--selected').forEach(el => el.classList.remove('asset-card--selected'));
  if (!wasSelected) card.classList.add('asset-card--selected');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   8) MODAL UTILITIES + YEAR-NEWS MODAL
   ════════════════════════════════════════════════════════════════════════════════════════════════ */

// Generic modal show/hide. Used by many places.
function toggleModal(id, show) {
  document.getElementById(id).style.display = show ? 'flex' : 'none';
}

function closeEduModal() {
  toggleModal('eduModal', false);
  checkTutorialAction('close-detail');
}

function closeShockModal() {
  document.getElementById('shockModal').style.display = 'none';
}

// Shown after every Advance Year (and once at Year 0 from `populateYear0News`).
// Renders the macro scenario blurb + the company-level headlines for that year.
function showYearNewsModal(year, scenario, newsHeadlines) {
  // Pick the visual style of the scenario card
  let macroClass;
  if      (!scenario)                  macroClass = 'macro-event--none';
  else if (scenario.type === 'good')   macroClass = 'macro-event--good';
  else                                 macroClass = 'macro-event--bad';

  document.getElementById('shockTitle').innerText = `Year ${year} Events`;

  const macroHTML = scenario
    ? `<div class="macro-event ${macroClass}">
         <strong>⚠️ World News:</strong> ${scenario.text}
       </div>`
    : `<p class="macro-event__no-news">No major world news this year.</p>`;

  let newsHTML;
  if (newsHeadlines && newsHeadlines.length > 0) {
    newsHTML = `<div class="company-updates">
      <strong class="company-updates__title">📰 Market Headlines</strong>
      <ul class="company-updates__list">`;
    newsHeadlines.forEach(n => {
      const label = n.company ? `<b>${n.company}:</b> ` : (n.sector ? `<b>${n.sector}:</b> ` : '');
      newsHTML += `<li>${label}${n.headline}</li>`;
    });
    newsHTML += `</ul></div>`;
  } else {
    newsHTML = `<p class="company-updates__empty">No major company news this year.</p>`;
  }

  document.getElementById('shockBody').innerHTML = `
    ${macroHTML}
    <hr class="shock-modal__divider">
    ${newsHTML}
  `;
  document.getElementById('shockModal').style.display = 'flex';
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   9) BREAKING NEWS (mid-year pop-ups)
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Some years have an extra "breaking news" event defined in BREAKING_NEWS. When triggered, we
   immediately apply its price impact, then pop up a dramatic modal 10 seconds later. The year that 
   pop-ups appear can be adjusted in news-data.js file.  */

function scheduleBreakingNews(year) {
  const scheduled = BREAKING_NEWS.find(n => n.year === year);
  if (!scheduled) return;
  setTimeout(() => showBreakingNews(scheduled, year), 10000);
}

function showBreakingNews(news, year) {
  document.getElementById('breakingYear').innerText     = `Year ${year}`;
  document.getElementById('breakingHeadline').innerText = news.headline;
  document.getElementById('breakingSubtext').innerText  = news.subtext;
  document.getElementById('breakingModal').style.display = 'flex';
}

function closeBreakingNews() {
  document.getElementById('breakingModal').style.display = 'none';
}

// Apply the price impact of a breaking-news item. Credibility scales the impact:
//   credibility 1 → 100% impact
//   credibility 2 →  60% impact
//   credibility 3 →   0% (or rare small negative reversal — pure noise)
function applyBreakingNewsImpact(news) {
  let effectiveImpact = news.impact;
  if      (news.credibility === 2) effectiveImpact *= 0.6;
  else if (news.credibility === 3) effectiveImpact  = Math.random() < 0.1 ? -news.impact * 0.15 : 0;

  if (effectiveImpact === 0) return;

  ASSETS.forEach(asset => {
    // Does this news apply to this asset?
    let applies = false;
    if (news.company && getCompanyName(asset) === news.company) applies = true;
    if (news.sector  && asset.sector === news.sector)           applies = true;
    if (!news.sector && !news.company)                          applies = true; // broad market

    if (applies) asset.price = Math.max(0.01, asset.price * (1 + effectiveImpact));

    // Some breaking news has a counter-impact (e.g. green-energy boom hurts fossil fuels).
    if (news.sectorAlt && asset.sector === news.sectorAlt) {
      asset.price = Math.max(0.01, asset.price * (1 + (news.impactAlt || 0)));
    }
  });
  // Re-render so updated prices show immediately
  renderMarket();
  updateUI();
  renderSidebar();
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   10) ASSET DETAIL MODAL
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Opens when the player clicks an asset's name. Shows the description and a chart with
   Day / Month / Year tabs (using the mock data from getMockHistory). */

function showAssetDetail(id) {
  const asset = ASSETS.find(a => a.id === id);
  if (!asset) return;
  document.getElementById('modalTitle').innerText = asset.name;
  document.getElementById('modalDesc').innerText  = asset.desc;
  currentDetailData = getMockHistory(id, asset.category, asset.sector);
  updateDetailTimeframe('Y');               // default to Year view
  toggleModal('eduModal', true);
  checkTutorialAction('open-detail');
}

function updateDetailTimeframe(tf) {
  if (!currentDetailData) return;

  // Toggle active class on the timeframe buttons (D/M/Y)
  document.querySelectorAll('#eduModal .btn-tf').forEach(btn => {
    btn.className = btn.dataset.tf === tf ? 'btn-tf btn-tf--active' : 'btn-tf btn-tf--inactive';
  });

  const d        = currentDetailData.data[tf];
  const avg      = d.reduce((a, b) => a + b, 0) / d.length;
  const color    = d[d.length - 1] >= avg ? '#27ae60' : '#e74c3c';
  const avgLine  = Array(d.length).fill(avg);

  // Rebuild the chart from scratch each time the timeframe changes
  if (detailChart) detailChart.destroy();
  const ctx  = document.getElementById('detailChart').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 250);
  grad.addColorStop(0, 'rgba(0,123,255,0.2)');
  grad.addColorStop(1, 'rgba(0,123,255,0)');
  detailChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: currentDetailData.labels[tf],
      datasets: [
        { data:d,       borderColor:color,    borderWidth:2,   pointRadius:0, fill:true,  backgroundColor:grad, tension:0.2 },
        { data:avgLine, borderColor:'#007bff', borderWidth:1.5, borderDash:[5,5], pointRadius:0, fill:false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales:  { x:{ grid:{ display:false } }, y:{ position:'right', grid:{ color:'#f5f5f5' } } },
      plugins: { legend:{ display:false } }
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   11) SCORECARD SIDEBAR
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Renders the two-row scorecard (Discipline + Diversity) in the sidebar. Both rows have a
   colour that reflects how the player is doing. */

function ScoreCard() {
  const disciplineColor = state.metrics.emotionalDiscipline  > 70 ? '#27ae60' : '#e67e22';
  const divConColor     = state.metrics.diversityConsistency > 70 ? '#27ae60'
                        : state.metrics.diversityConsistency > 40 ? '#f39c12' : '#e74c3c';

  document.getElementById('score-container').innerHTML = `
    <div class="scorecard">
      <div class="scorecard__row">
        <div class="scorecard__label-block">
          <span class="scorecard__label">Discipline <a href="#" onclick="event.preventDefault();" style="text-decoration:none;color:#999;font-size:10px;">ⓘ</a></span>
          <span class="scorecard__desc">Resist reacting to fake or uncredible news.</span>
        </div>
        <span class="scorecard__value" style="color:${disciplineColor};">${state.metrics.emotionalDiscipline}</span>
      </div>
      <div class="scorecard__row">
        <div class="scorecard__label-block">
          <span class="scorecard__label">Diversity <a href="#" onclick="event.preventDefault();" style="text-decoration:none;color:#999;font-size:10px;">ⓘ</a></span>
          <span class="scorecard__desc">Keep your porfolio well-spread across asset classes and sectors.</span>
        </div>
        <span class="scorecard__value" style="color:${divConColor};">${state.metrics.diversityConsistency}</span>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   12) NEWS FEED & ARTICLE READER
   ════════════════════════════════════════════════════════════════════════════════════════════════
   `allNewsHistory` accumulates every year's news so the "Past News" modal can show the full
   history. The sidebar panel only shows the latest year. */

let allNewsHistory = [];

function updateNewsHistory(year, scenario, newsItems) {
  const container = document.getElementById('news-history-container');
  const existingIdx = allNewsHistory.findIndex(e => e.year === year);
  if (existingIdx >= 0) allNewsHistory[existingIdx] = { year, scenario, newsItems };
  else allNewsHistory.push({ year, scenario, newsItems });

  // Build the compact panel content — only the latest year is visible at any time.
  let html = '';
  if (scenario) {
    const sClass = scenario.type === 'good' ? 'news-year__scenario--good' : 'news-year__scenario--bad';
    html += `<div class="news-year__scenario ${sClass}" style="font-size:10px;margin:2px 0;">⚠️ ${scenario.name}</div>`;
  }
  if (newsItems && newsItems.length > 0) {
    newsItems.forEach((n, i) => {
      const prefix = n.company ? `<b>${n.company}:</b> ` : '';
      html += `<div class="news-item-clickable" onclick="openNewsArticle(${year}, ${i})"
                    style="font-size:10px;padding:3px 2px;border-bottom:1px solid #f5f5f5;">
        📰 ${prefix}${n.headline.substring(0, 60)}${n.headline.length > 60 ? '...' : ''}
      </div>`;
    });
  } else if (!scenario) {
    html += `<div style="color:#999;font-size:10px;font-style:italic;">No major events.</div>`;
  }
  container.innerHTML = `<div><strong style="font-size:10px;color:var(--primary);">Year ${year}</strong>${html}</div>`;
}

// Looks up the editorial commentary for a news item by its index in newsDatabase.
function getSourceCommentaryByIndex(idx) {
  const fallback = "Before reacting, consider who published this story, whether they have a track record of accuracy, and whether you can cross-check the claim against primary documents.";
  return (typeof newsCommentary !== 'undefined' && Object.prototype.hasOwnProperty.call(newsCommentary, idx))
    ? newsCommentary[idx]
    : fallback;
}

// Opens the full-article modal for one headline.
function openNewsArticle(year, index) {
  const entry = allNewsHistory.find(e => e.year === year);
  if (!entry || !entry.newsItems || !entry.newsItems[index]) return;
  const n = entry.newsItems[index];

  // Show whichever subject the news is tagged with — company OR sector.
  const subjectLabel = n.company ? `<b>Company:</b> ${n.company}`
                     : n.sector  ? `<b>Sector:</b> ${n.sector}`
                     : '';

  // The commentary lives in newsDatabase by index. Look it up by matching the headline.
  let dbIdx = -1;
  if (typeof newsDatabase !== 'undefined') {
    dbIdx = newsDatabase.findIndex(d => d.headline === n.headline);
  }

  const commentary = getSourceCommentaryByIndex(dbIdx);

  document.getElementById('newsArticleTitle').innerText = n.headline;
  document.getElementById('newsArticleBody').innerHTML  = `
    ${subjectLabel ? `<div style="font-size:13px;color:#555;margin-bottom:6px;">${subjectLabel}</div>` : ''}
    <div style="font-size:12px;color:#888;margin-bottom:14px;">Published in Year ${year}</div>
    <div style="font-size:13px;color:#444;line-height:1.7;margin-bottom:14px;">${commentary}</div>`;

  // Optional per-article image: drop a file named news_Y{year}_{index}.png next to index.html
  // to make it appear. If the file doesn't exist, the <img> simply fails to load.
  const img = document.getElementById('newsArticleImage');
  img.src = `news_Y${year}_${index}.png`;
  img.style.display = 'block';

  toggleModal('newsArticleModal', true);
  checkTutorialAction('open-news');
}

// Shows ALL news from every prior year, in reverse-chronological order.
function showPastNewsModal() {
  const container = document.getElementById('past-news-content');
  if (allNewsHistory.length === 0) {
    container.innerHTML = '<p style="color:#999;font-style:italic;">No news yet — past headlines will appear here as years pass.</p>';
    toggleModal('pastNewsModal', true);
    return;
  }
  let html = '';
  allNewsHistory.slice().reverse().forEach(entry => {
    html += `<div style="padding:6px 0;border-bottom:1px solid #eee;">`;
    html += `<strong style="color:var(--primary);">Year ${entry.year}</strong>`;
    if (entry.scenario) {
      const sClass = entry.scenario.type === 'good' ? 'color:#27ae60' : 'color:#e74c3c';
      html += `<div style="font-weight:700;${sClass};font-size:11px;">⚠️ ${entry.scenario.name}</div>`;
    }
    if (entry.newsItems && entry.newsItems.length > 0) {
      entry.newsItems.forEach((n, i) => {
        const prefix = n.company ? `<b>${n.company}:</b> ` : '';
        html += `<div class="news-item-clickable"
                      onclick="openNewsArticle(${entry.year},${i});toggleModal('pastNewsModal',false);">
          📰 ${prefix}${n.headline.substring(0, 70)}${n.headline.length > 70 ? '...' : ''}
        </div>`;
      });
    } else if (!entry.scenario) {
      html += `<div style="color:#999;font-size:10px;font-style:italic;">No major events.</div>`;
    }
    html += `</div>`;
  });
  container.innerHTML = html;
  toggleModal('pastNewsModal', true);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   13) MAIN UI UPDATE + PORTFOLIO DONUT
   ════════════════════════════════════════════════════════════════════════════════════════════════
   `updateUI` refreshes the header numbers + the per-card "Owned" counters + the diversity meter.
   The donut chart is its own function because it's also called from `switchDonutTab`. */

function updateUI() {
  const portVal       = ASSETS.reduce((sum, a) => sum + state.holdings[a.id] * a.price, 0);
  const totalNetWorth = state.cash + portVal;

  // Header numbers
  document.getElementById('cashDisplay').innerText     = '$' + Math.floor(state.cash).toLocaleString();
  document.getElementById('netWorthDisplay').innerText = '$' + Math.floor(totalNetWorth).toLocaleString();

  // Gain % vs total money put in (initial $10k + yearly income)
  const gainNet = state.totalInvestedInput > 0
    ? (totalNetWorth - state.totalInvestedInput) / state.totalInvestedInput * 100
    : 0;
  const gainEl     = document.getElementById('gainDisplay');
  gainEl.innerText = gainNet.toFixed(1) + '%';
  gainEl.className = 'stat-value ' + (gainNet > 0 ? 'gain--positive' : gainNet < 0 ? 'gain--negative' : 'gain--neutral');

  // Year counter
  document.getElementById('timeDisplay').innerText = state.step + ' / ' + state.maxSteps;

  // Diversity meter (depends on which donut tab is active)
  updateDiversityForTab();

  // Per-card "Owned: N"
  ASSETS.forEach(a => {
    const el = document.getElementById(`owned-${a.id}`);
    if (el) el.innerText = `Owned: ${state.holdings[a.id] || 0}`;
  });
}

// Compute the diversity meter value + label depending on which donut tab is selected.
// This is the LIVE meter shown in the sidebar — separate from the per-year diversity score
// that feeds `state.metrics.diversityConsistency` (which is computed inside nextYear()).
function updateDiversityForTab() {
  const totalPortVal = ASSETS.reduce((sum, a) => sum + state.holdings[a.id] * a.price, 0);
  if (totalPortVal === 0) {
    updateDivMeter(0, 'None', '#ccc');
    return;
  }

  if (currentDonutTab === 'asset') {
    // Asset-class view: how concentrated are you in one of Shares/ETFs/Bonds/Funds?
    const catTotals = {};
    ASSETS.forEach(a => {
      if (state.holdings[a.id] > 0)
        catTotals[a.category] = (catTotals[a.category] || 0) + state.holdings[a.id] * a.price;
    });
    const numCats  = Object.keys(catTotals).length;
    const maxShare = Math.max(...Object.values(catTotals).map(v => v / totalPortVal));

    let score, msg, color;
    if      (numCats <= 1)      { score = 15;  msg = 'Single Type';   color = '#e74c3c'; }
    else if (maxShare > 0.7)    { score = 30;  msg = 'Concentrated';  color = '#e74c3c'; }
    else if (maxShare > 0.5)    { score = 55;  msg = 'Moderate';      color = '#f39c12'; }
    else if (numCats >= 3)      { score = 100; msg = 'Well Spread';   color = '#27ae60'; }
    else                        { score = 75;  msg = 'Good';          color = '#27ae60'; }
    updateDivMeter(score, msg, color);
  } else {
    // Sector view: how concentrated are you in one sector (Tech, Energy, Healthcare, ...)?
    const sectorVal = {};
    ASSETS.forEach(a => {
      if (state.holdings[a.id] > 0)
        sectorVal[a.sector] = (sectorVal[a.sector] || 0) + state.holdings[a.id] * a.price;
    });
    const maxShare = Math.max(...Object.values(sectorVal).map(v => v / totalPortVal));

    let score, msg, color;
    if      (maxShare > 0.6)  { score = 20;  msg = 'High Risk'; color = '#e74c3c'; }
    else if (maxShare > 0.35) { score = 60;  msg = 'Balanced';  color = '#f39c12'; }
    else                      { score = 100; msg = 'Excellent'; color = '#27ae60'; }
    updateDivMeter(score, msg, color);
  }
}

// Updates the donut chart in the sidebar based on which tab is selected (asset class or sector).
function renderPortfolioDonut() {
  if (!allocChart) return;

  const values = {};
  const labels = [];
  const data   = [];
  const colors = [];

  if (currentDonutTab === 'asset') {
    // Group holdings by asset class
    ASSETS.forEach(a => {
      if (state.holdings[a.id] > 0) {
        values[a.category] = (values[a.category] || 0) + state.holdings[a.id] * a.price;
      }
    });
    const palette       = { stock:'#3498db', 'Sector ETFs':'#1abc9c', bond:'#566d7e', 'Index Funds':'#2c3e50' };
    const displayLabels = { stock:'Shares',  'Sector ETFs':'Sector ETFs', bond:'Bonds', 'Index Funds':'Index Funds' };
    Object.entries(values).forEach(([key, amount]) => {
      labels.push(displayLabels[key] || key);
      data.push(amount);
      colors.push(palette[key] || '#95a5a6');
    });
    // Cash gets its own slice in the asset-class view (it's an asset class of its own)
    if (state.cash > 0) {
      labels.push('Cash');
      data.push(state.cash);
      colors.push('#f1c40f');
    }
  } else {
    // Group holdings by sector. Cash is NOT a sector → not shown in this view.
    ASSETS.forEach(a => {
      if (state.holdings[a.id] > 0) {
        values[a.sector] = (values[a.sector] || 0) + state.holdings[a.id] * a.price;
      }
    });
    const sectorPalette = {
      Technology:'#3498db', Healthcare:'#e74c3c', Energy:'#9b59b6',
      'Food and Beverage':'#1abc9c', Govt:'#2c3e50', 'Real Estate':'#0B6623', Global:'#34495e'
    };
    Object.entries(values).forEach(([label, amount]) => {
      labels.push(label);
      data.push(amount);
      colors.push(sectorPalette[label] || '#95a5a6');
    });
  }

  // Asset-class view falls back to showing cash if there's nothing else.
  if (data.length === 0 && currentDonutTab === 'asset') {
    labels.push('Cash');
    data.push(state.cash);
    colors.push('#f1c40f');
  }

  allocChart.data.labels                       = labels;
  allocChart.data.datasets[0].data             = data;
  allocChart.data.datasets[0].backgroundColor  = colors;
  allocChart.update();
}

// Helper used by updateDiversityForTab — pushes a score/message/color into the meter DOM.
function updateDivMeter(score, msg, color) {
  const t = document.getElementById('diversityText');
  const b = document.getElementById('diversityBar');
  const l = document.getElementById('diversityLabel');
  if (t) { t.innerText = msg;            t.style.color = color; }
  if (b) { b.style.width = score + '%';  b.style.background = color; }
  if (l)   l.innerText = currentDonutTab === 'asset' ? 'Asset Class Diversity:' : 'Sector Diversity:';
}


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   14) BUY / SELL ORDERS
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Trades are SETTLED IMMEDIATELY (cash and holdings change right away), but they also feed the
   "This Year's Trades" panel via addYearOrder() so the player can see what they did this round.
   The pending list is cleared at the start of every nextYear() call. */

function buy(id) {
  const asset = ASSETS.find(a => a.id === id);
  const qty   = parseInt(document.getElementById(`qty-${id}`).value, 10) || 1;
  const cost  = asset.price * qty;

  if (state.cash < cost) {
    alert(`Not enough cash! Need $${cost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}, have $${state.cash.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    return;
  }
  state.cash         -= cost;
  state.holdings[id]  = (state.holdings[id] || 0) + qty;
  state.tradedAssets[id] = true;

  addYearOrder('buy', id, asset.name, qty, asset.price);
  state.transactions.push({ action:'Bought', id, name:asset.name, qty, price:asset.price, year:state.step || 0 });

  renderMarket();
  updateUI();
  renderPortfolioDonut();
  renderPendingOrders();
  checkTutorialAction('buy');
}

function sell(id) {
  const asset = ASSETS.find(a => a.id === id);
  const qty   = parseInt(document.getElementById(`qty-${id}`).value, 10) || 1;

  if (state.holdings[id] < qty) {
    alert(`You only own ${state.holdings[id]} unit(s) of ${asset.name}.`);
    return;
  }
  state.cash         += asset.price * qty;
  state.holdings[id] -= qty;
  state.tradedAssets[id] = true;

  addYearOrder('sell', id, asset.name, qty, asset.price);
  state.transactions.push({ action:'Sold', id, name:asset.name, qty, price:asset.price, year:state.step || 0 });

  renderMarket();
  updateUI();
  renderPortfolioDonut();
  renderPendingOrders();
}

// Appends to / merges into state.pendingOrders so multiple buys of the same asset show as one row.
function addYearOrder(action, id, name, qty, price) {
  const existing = state.pendingOrders.find(o => o.action === action && o.id === id);
  if (existing) {
    existing.qty  += qty;
    existing.cost += price * qty;
  } else {
    state.pendingOrders.push({ action, id, name, qty, price, cost: price * qty });
  }
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   15) SIDEBAR (donut tab, holdings, pending orders, transactions)
   ════════════════════════════════════════════════════════════════════════════════════════════════ */

function renderSidebar() {
  renderPortfolioDonut();
  renderHoldings();
  renderPendingOrders();
}

// Which donut tab is active. 'sector' is the default tab.
let currentDonutTab = 'sector';

function switchDonutTab(tab) {
  currentDonutTab = tab;
  document.getElementById('tabAssetClass').className = tab === 'asset'  ? 'portfolio-tab portfolio-tab--active' : 'portfolio-tab';
  document.getElementById('tabSectors').className    = tab === 'sector' ? 'portfolio-tab portfolio-tab--active' : 'portfolio-tab';
  renderPortfolioDonut();
  updateDiversityForTab();
  checkTutorialAction('portfolio-tab');
}

// Refresh the compact "X assets / $Y" pill at the top of the holdings panel.
function renderHoldings() {
  const dh       = state.displayHoldings || state.holdings;
  const owned    = ASSETS.filter(a => (dh[a.id] || 0) > 0);
  const totalVal = owned.reduce((sum, a) => sum + (dh[a.id] || 0) * a.price, 0);

  const countEl = document.getElementById('holdingsCount');
  const valEl   = document.getElementById('holdingsValue');
  if (countEl) countEl.innerText = owned.length > 0 ? `${owned.length} assets`              : '0 assets';
  if (valEl)   valEl.innerText   = totalVal > 0     ? `$${Math.floor(totalVal).toLocaleString()}` : '$0';
}

// Detailed list of holdings (opened by clicking the pill).
function showHoldingsModal() {
  const dh        = state.displayHoldings || state.holdings;
  const owned     = ASSETS.filter(a => (dh[a.id] || 0) > 0);
  const container = document.getElementById('holdings-modal-content');

  if (owned.length === 0) {
    container.innerHTML = '<p style="color:#999;font-style:italic;">No assets owned yet. Buy assets and advance the year to see them here.</p>';
  } else {
    let html     = '';
    let totalVal = 0;
    owned.forEach(a => {
      const qty      = dh[a.id];
      const val      = qty * a.price;
      totalVal      += val;
      const pct      = ((a.price - state.initialPrices[a.id]) / state.initialPrices[a.id] * 100);
      const pctColor = pct >= 0 ? '#27ae60' : '#e74c3c';
      html += `<div class="holding-row" style="margin-bottom:4px;">
        <div class="holding-row__left">
          <span class="holding-row__name" style="font-size:12px;">${a.name}</span>
          <span class="holding-row__detail">${qty} shares × $${a.price.toFixed(2)}</span>
        </div>
        <div class="holding-row__right">
          <span class="holding-row__price" style="font-size:12px;">$${Math.floor(val).toLocaleString()}</span>
          <span class="holding-row__pct" style="color:${pctColor};">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>
        </div>
      </div>`;
    });
    html += `<div style="border-top:2px solid #eee;padding-top:6px;margin-top:6px;display:flex;justify-content:space-between;font-weight:700;font-size:13px;">
      <span>Total Portfolio Value</span>
      <span style="color:var(--primary);">$${Math.floor(totalVal).toLocaleString()}</span>
    </div>`;
    html += `<div style="margin-top:8px;text-align:right;"><button class="btn-tx-history" onclick="showTransactionsModal();toggleModal('holdingsModal',false);">Full History</button></div>`;
    container.innerHTML = html;
  }
  toggleModal('holdingsModal', true);
}

// Snapshot live holdings into displayHoldings. Called from nextYear so the sidebar shows the
// state AS OF the start of the year (so intra-year tweaks don't flicker the meter values).
function commitHoldings() {
  state.displayHoldings = { ...state.holdings };
}

// Render the "This Year's Trades" panel.
function renderPendingOrders() {
  const container = document.getElementById('pending-container');
  const netEl     = document.getElementById('pending-net');
  if (!container) return;

  if (state.pendingOrders.length === 0) {
    container.innerHTML = '<div class="holdings-empty">No trades this year yet.</div>';
    if (netEl) netEl.innerText = '';
    return;
  }

  let totalBuy  = 0;
  let totalSell = 0;
  let html      = '';
  state.pendingOrders.forEach(order => {
    const isBuy = order.action === 'buy';
    if (isBuy) totalBuy += order.cost; else totalSell += order.cost;
    html += `<div class="pending-item">
      <span class="pending-item__action ${isBuy ? 'pending-item__action--buy' : 'pending-item__action--sell'}">${isBuy ? 'BUY' : 'SELL'}</span>
      <span class="pending-item__desc">${order.qty} ${order.name}</span>
      <span class="pending-item__cost">$${Math.floor(order.cost).toLocaleString()}</span>
    </div>`;
  });
  container.innerHTML = html;

  // Net = SELL income − BUY spending (so positive net means the player took money off the table)
  const net = totalSell - totalBuy;
  if (netEl) {
    netEl.innerText     = `Net: $${Math.floor(net).toLocaleString()}`;
    netEl.style.color   = net >= 0 ? '#27ae60' : '#e74c3c';
  }
}

// Modal: complete transaction log + a current-holdings summary grouped by category.
function showTransactionsModal() {
  // ── Top: holdings grouped by category ──
  const owned      = ASSETS.filter(a => state.holdings[a.id] > 0);
  const holdingsEl = document.getElementById('tx-modal-holdings');
  if (holdingsEl) {
    if (owned.length === 0) {
      holdingsEl.innerHTML = '<p style="color:#999;font-size:13px;">No holdings.</p>';
    } else {
      const categoryOrder  = ['stock', 'Sector ETFs', 'bond', 'Index Funds'];
      const categoryLabels = { stock:'Shares', 'Sector ETFs':'ETFs', bond:'Bonds', 'Index Funds':'Funds' };
      const grouped        = {};
      owned.forEach(a => { (grouped[a.category] = grouped[a.category] || []).push(a); });

      const totalNW = state.cash + ASSETS.reduce((s, a) => s + state.holdings[a.id] * a.price, 0);
      let h = '';
      categoryOrder.forEach(cat => {
        const items = grouped[cat];
        if (!items) return;
        const catVal = items.reduce((s, a) => s + state.holdings[a.id] * a.price, 0);
        h += `<div style="margin-bottom:8px;">
          <div style="font-size:11px;font-weight:700;color:#3498db;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
            ${categoryLabels[cat] || cat}
            <span style="color:#e74c3c;">${((catVal / totalNW) * 100).toFixed(1)}%</span>
          </div>`;
        items.forEach(a => {
          h += `<div style="display:flex;justify-content:space-between;padding:4px 8px;background:#f8f9fa;border-radius:6px;margin-bottom:3px;font-size:12px;">
            <span style="font-weight:600;">${a.name}</span>
            <span style="color:#555;">$${a.price.toFixed(2)} <span style="color:#888;">× ${state.holdings[a.id]}</span></span>
          </div>`;
        });
        h += '</div>';
      });
      holdingsEl.innerHTML = h;
    }
  }

  // ── Bottom: full chronological transaction log (most recent first) ──
  const listEl = document.getElementById('tx-modal-list');
  if (listEl) {
    if (state.transactions.length === 0) {
      listEl.innerHTML = '<p style="color:#999;font-size:13px;">No trades yet.</p>';
    } else {
      let h = '';
      state.transactions.slice().reverse().forEach(t => {
        const isBuy = t.action === 'Bought';
        h += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:12px;">
          <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;
                       background:${isBuy ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.12)'};
                       color:${isBuy ? '#27ae60' : '#c0392b'};">${t.action}</span>
          <span>${t.qty} ${t.id} @ $${t.price.toFixed(2)}</span>
          <span style="margin-left:auto;color:#aaa;font-size:10px;">Year ${t.year}</span>
        </div>`;
      });
      listEl.innerHTML = h;
    }
  }

  toggleModal('txModal', true);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════
   16) YEAR ADVANCE + END GAME
   ════════════════════════════════════════════════════════════════════════════════════════════════
   `nextYear()` is the core game loop. Roughly, in order:
     1. Score discipline based on this year's trades vs the news the player saw.
     2. Score per-year diversity and update the rolling display value.
     3. Find the next year's scenario + news, apply company-level news impacts to prices.
     4. Run the price engine for every asset (drift + volatility + scenario + aftershock).
     5. Generate sparkline points for the new year.
     6. Re-render everything. Pop up the year-news modal. Schedule any breaking news.
     7. If we just hit year `maxSteps`, call endGame(). */

function nextYear() {
  // 0) Reset the per-year pending-orders panel
  state.pendingOrders = [];

  // 1) DISCIPLINE: penalise trades made in response to uncredible news.
  //    Rule: −8 per noise/credibility-3 headline the player reacted to. Capped at 0.
  const previousScript = YEAR_SCRIPT.find(y => y.year === state.step);
  if (previousScript && previousScript.newsIndices) {
    previousScript.newsIndices.forEach(idx => {
      const news = newsDatabase[idx];
      if (!news) return;

      // Did the player trade ANY asset tied to this headline (by company OR sector)?
      const reacted = ASSETS.some(a => {
        if (!state.tradedAssets[a.id]) return false;
        if (news.company && getCompanyName(a) === news.company) return true;
        if (news.sector  && a.sector === news.sector)            return true;
        return false;
      });
      const isNoise = (news.type === 'noise') || (news.credibility === 3);

      if (reacted && isNoise) {
        state.metrics.emotionalDiscipline = Math.max(0, state.metrics.emotionalDiscipline - 8);
      }
    });
  }

  // Reset the per-year traded-assets log
  state.tradedAssets = {};

  // Guard: don't try to advance past the final year
  if (state.step >= state.maxSteps) return;
  const nextStep = state.step + 1;

  // Income arrives at the start of the new year
  state.cash               += state.income;
  state.totalInvestedInput += state.income;

  // 2) DIVERSITY: score the portfolio shape for THIS year, then update the rolling average.
  //
  //    Method:
  //      • If you hold nothing, you get 0.
  //      • If your entire portfolio is in index funds, you get a perfect 10 (index funds are
  //        internally diversified).
  //      • Otherwise we look at the NON-index portion of your portfolio and ask:
  //          – Do you span multiple categories?
  //          – Do you span multiple sectors?
  //          – What's the worst (largest) single share?
  //        Then we map those answers to a 2/4/6/8/10 score.
  //    The 0-10 round score is averaged across all completed years, then multiplied by 10
  //    so the display value sits naturally on a 0-100 scale.
  const divPortVal = ASSETS.reduce((sum, a) => sum + state.holdings[a.id] * a.price, 0);
  let roundScore;

  if (divPortVal === 0) {
    roundScore = 0;
  } else {
    const indexFundVal = ASSETS.reduce((sum, a) =>
      a.category === 'Index Funds' ? sum + state.holdings[a.id] * a.price : sum, 0);
    const nonIndexVal = divPortVal - indexFundVal;

    if (nonIndexVal === 0) {
      roundScore = 10;                                  // pure index-fund portfolio
    } else {
      const catTotals = {};
      const secTotals = {};
      ASSETS.forEach(a => {
        if (a.category === 'Index Funds') return;
        if (state.holdings[a.id] > 0) {
          catTotals[a.category] = (catTotals[a.category] || 0) + state.holdings[a.id] * a.price;
          secTotals[a.sector]   = (secTotals[a.sector]   || 0) + state.holdings[a.id] * a.price;
        }
      });
      const numCats     = Object.keys(catTotals).length;
      const numSecs     = Object.keys(secTotals).length;
      const maxCatShare = Math.max(...Object.values(catTotals).map(v => v / nonIndexVal));
      const maxSecShare = Math.max(...Object.values(secTotals).map(v => v / nonIndexVal));
      const worstShare  = Math.max(maxCatShare, maxSecShare);

      if      (numCats <= 1 || numSecs <= 1 || worstShare > 0.85)   roundScore = 2;
      else if (worstShare > 0.70 || numCats === 2 || numSecs === 2) roundScore = 4;
      else if (worstShare > 0.55)                                   roundScore = 6;
      else if (worstShare > 0.40 && numCats >= 3 && numSecs >= 3)   roundScore = 8;
      else                                                          roundScore = 10;
    }
  }

  state.metrics.diversityRoundScores.push(roundScore);
  const arr = state.metrics.diversityRoundScores;
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  state.metrics.diversityConsistency = Math.round(avg * 10);

  // 3) NEWS for the upcoming year + apply company-level impact to prices.
  const scriptEntry      = YEAR_SCRIPT.find(y => y.year === nextStep) || null;
  const scenario         = scriptEntry?.scenarioName
                         ? SCENARIOS.find(s => s.name === scriptEntry.scenarioName) || null
                         : null;
  const newsItemsForYear = [];

  if (scriptEntry?.newsIndices) {
    scriptEntry.newsIndices.forEach(idx => {
      const newsItem = newsDatabase[idx];
      if (!newsItem) return;
      newsItemsForYear.push(newsItem);

      // Credibility scales how much the headline actually moves the price.
      let effectiveImpact = newsItem.impact;
      if      (newsItem.credibility === 2) effectiveImpact *= 0.6;
      else if (newsItem.credibility === 3) effectiveImpact  = Math.random() < 0.1 ? -newsItem.impact * 0.2 : 0;

      // Apply to all matching companies (only companies — sector-only news is left alone here,
      // since the scenario block below handles sector-wide moves).
      ASSETS.forEach(asset => {
        if (getCompanyName(asset) === newsItem.company) {
          asset.price = Math.max(0.01, asset.price * (1 + effectiveImpact));
        }
      });
    });
  }

  // Push the news into the sidebar's news panel + history
  updateNewsHistory(nextStep, scenario, newsItemsForYear);

  // 4) PRICE ENGINE for every asset:
  //      base change = drift + random volatility
  //      then apply scenario impact (dampened for ETFs and Index Funds — they're diversified)
  //      then apply any leftover aftershock from a recent crash
  ASSETS.forEach(asset => {
    const DRIFT = { stock:0.08, 'Sector ETFs':0.06, bond:0.02, 'Index Funds':0.06 };
    const drift = DRIFT[asset.category] || 0.05;

    // Base random move with positive drift. Bonds are deliberately ultra-stable.
    let change;
    if (asset.category === 'bond') {
      change = 1 + 0.02 + (Math.random() - 0.5) * 0.008;
    } else {
      change = 1 + drift + (Math.random() - 0.5) * 2 * asset.volatility;
    }

    // Scenario impact, with diversification dampening:
    //   Stocks take the full hit; ETFs absorb ~40% of the shock; Index Funds absorb ~70%.
    //   Big crashes also set up a 1-2 year aftershock drag on the affected sector's stocks.
    if (scenario && asset.category !== 'bond') {
      const rawImpact = scenario.impact[asset.sector] ?? scenario.impact.General ?? 1;
      if (asset.category === 'stock') {
        change *= rawImpact;
        if (rawImpact < 0.85) {
          state._aftershocks[asset.sector] = {
            yearsLeft: rawImpact < 0.7 ? 2 : 1,
            drag:      (1 - rawImpact) * 0.3
          };
        }
      } else if (asset.category === 'Sector ETFs') {
        change *= 1 + (rawImpact - 1) * 0.6;            // 60% of the shock
      } else if (asset.category === 'Index Funds') {
        change *= 1 + (rawImpact - 1) * 0.3;            // 30% of the shock
      }
    }

    // Aftershock drag: only applies in YEARS WITHOUT a new scenario (so two back-to-back
    // crashes don't double-stack their drag onto the same year).
    if (asset.category === 'stock' && state._aftershocks[asset.sector] && !scenario) {
      const as = state._aftershocks[asset.sector];
      if (as.yearsLeft > 0) {
        change -= as.drag;
        as.yearsLeft--;
        if (as.yearsLeft <= 0) delete state._aftershocks[asset.sector];
      }
    }

    // Floor on per-year move and per-asset price so we never hit zero / blow up.
    asset.price = Math.max(0.5, asset.price * Math.max(0.4, change));

    // 5) Sparkline: add 12 fresh monthly points ending exactly at this year's price.
    const prevPrice = state.priceHistory[asset.id][state.priceHistory[asset.id].length - 1] || asset.price;
    let currentP   = prevPrice;
    const yearVol  = asset.category === 'bond' ? 0.003 : asset.volatility;

    for (let m = 1; m <= 12; m++) {
      if (m === 12) {
        state.priceHistory[asset.id].push(asset.price);          // anchor the year-end exactly
      } else {
        const mDrift = (asset.price - currentP) * 0.08;          // gentle pull toward target
        const shock  = (Math.random() - 0.5) * yearVol * currentP * 0.4;
        const spike  = Math.random() < 0.10 ? (Math.random() - 0.5) * yearVol * currentP * 0.6 : 0;
        currentP     = Math.max(currentP * 0.85, currentP + mDrift + shock + spike);
        state.priceHistory[asset.id].push(Math.round(Math.max(0.1, currentP) * 100) / 100);
      }
    }
  });

  // 6) Commit the year forward and redraw everything.
  state.step = nextStep;
  state.historyLabels.push(`Year ${state.step}`);
  state.netWorthHistory.push(
    state.cash + ASSETS.reduce((sum, a) => sum + state.holdings[a.id] * a.price, 0)
  );

  ScoreCard();
  renderMarket();
  updateUI();
  commitHoldings();
  renderSidebar();

  // Year-news modal (this is what was broken before — fixed in showYearNewsModal)
  showYearNewsModal(state.step, scenario, newsItemsForYear);
  checkTutorialAction('next-year');

  // Breaking news: apply price impact immediately, then pop up 10 s later for dramatic effect.
  const breakingNews = BREAKING_NEWS.find(n => n.year === state.step);
  if (breakingNews) {
    applyBreakingNewsImpact(breakingNews);
    scheduleBreakingNews(state.step);
  }

  // 7) End the game if we've hit the final year.
  if (state.step >= state.maxSteps) endGame();
}

// Computes the final score, fills the game-over modal, and draws the "you vs mattress" chart.
function endGame() {
  // Disable the Advance Year button so the game can't be ticked further.
  const advBtn = document.getElementById('btnNext');
  if (advBtn) advBtn.disabled = true;

  // ── Pull the three components of the final score ──
  const finalWealthNumber = state.cash + ASSETS.reduce((sum, a) => sum + state.holdings[a.id] * a.price, 0);
  const mattressValue     = 210000;   // what you'd have if you just kept the $10k/yr income in cash

  // Profit score = how much you beat the mattress strategy by, clamped to 0-100.
  let profitScore = ((finalWealthNumber - mattressValue) / mattressValue) * 100;
  profitScore     = Math.max(0, Math.min(100, Math.round(profitScore)));

  const discipline  = state.metrics.emotionalDiscipline  || 0;
  const consistency = state.metrics.diversityConsistency || 0;

  // Combined score: 35% Discipline + 35% Diversity + 30% Profit
  const finalScore = Math.round(
    (discipline  * 0.35) +
    (consistency * 0.35) +
    (profitScore * 0.30)
  );

  // ── Pick the grade tier ──
  let gradeText, gradeColor;
  if      (finalScore >= 85) { gradeText = "🏆 Master Investor: You maintained high standards across all disciplines."; gradeColor = "#27ae60"; }
  else if (finalScore >= 70) { gradeText = "⭐ Solid Planner: Good habits overall.";                                     gradeColor = "#2980b9"; }
  else if (finalScore >= 50) { gradeText = "📊 Developing Investor: You have room to grow.";                            gradeColor = "#f39c12"; }
  else                       { gradeText = "⚠️ Room for improvement across the board.";                                gradeColor = "#e74c3c"; }

  // ── Fill the game-over modal ──
  document.getElementById('finalNetWorth').innerText      = document.getElementById('netWorthDisplay').innerText;
  document.getElementById('finalPrudenceScore').innerText = finalScore;
  const gradeEl     = document.getElementById('finalPrudenceGrade');
  gradeEl.innerText = gradeText;
  gradeEl.style.color = gradeColor;
  document.getElementById('breakdownDiscipline').innerText = `${discipline}/100`;
  document.getElementById('breakdownDiversity').innerText  = `${consistency}/100`;
  document.getElementById('breakdownProfit').innerText     = document.getElementById('netWorthDisplay').innerText;

  toggleModal('gameOverModal', true);

  // ── Comparison chart: your net-worth curve vs the straight "mattress" line ──
  const mattressData = Array.from({ length: 21 }, (_, i) => 10000 + i * 10000);
  if (comparisonChart) comparisonChart.destroy();
  comparisonChart = new Chart(document.getElementById('comparisonChart'), {
    type: 'line',
    data: {
      labels: state.historyLabels,
      datasets: [
        { label:'Your Strategy',   data: state.netWorthHistory, borderColor:'#27ae60', backgroundColor:'rgba(39,174,96,0.15)', fill:true  },
        { label:'Mattress Method', data: mattressData,          borderColor:'#95a5a6', borderDash:[5,5],                       fill:false }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false }
  });
}


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   17) TUTORIAL ENGINE
   ════════════════════════════════════════════════════════════════════════════════════════════════
   The tutorial walks the player through the UI using `tutSteps` (defined in tutorial-data.js).
   Each step either:
     • type 'auto'   → shows info, "Next" button is always enabled
     • type 'action' → "Next" is disabled until the player performs the step's required action;
                       `checkTutorialAction(actionName)` is called from various places (buy(),
                       openNewsArticle(), etc.) to unlock the Next button.
   The highlight overlay is positioned next to the highlighted element, falling back to centre
   if no good corner fits. */

let tutStep         = 0;
let tutActionDone   = true;
let tutorialActive  = false;
let year0NewsShown  = false;

// Called whenever the player does something that might satisfy a tutorial action step.
function checkTutorialAction(action) {
  if (!tutorialActive) return;
  const step = tutSteps[tutStep];
  if (!step || step.type !== 'action' || step.action !== action || tutActionDone) return;

  tutActionDone = true;
  const hint    = document.getElementById('tutHint');
  const nextBtn = document.getElementById('tutNextBtn');
  hint.innerHTML        = '✅ Done! Click <b>Next</b> to continue.';
  hint.style.display    = 'block';
  nextBtn.disabled      = false;
  nextBtn.className     = 'tut-btn tut-btn--primary tut-next--enabled';

  // renderMarket() may have rebuilt the DOM between steps — re-apply the highlight class.
  if (step.el) {
    requestAnimationFrame(() => {
      document.getElementById(step.el)?.classList.add('tut-highlight');
    });
  }
}

function nextTutorial() {
  if (!tutorialActive) return;
  const step = tutSteps[tutStep];
  if (step && step.type === 'action' && !tutActionDone) return;   // can't skip action steps
  tutStep++;
  if (tutStep >= tutSteps.length) { endTutorial(); return; }
  showTutStep();
}

function prevTutorial() {
  if (!tutorialActive) return;
  if (tutStep > 0) {
    tutStep--;
    showTutStep();
  }
}

function endTutorial() {
  tutorialActive = false;
  const overlay  = document.getElementById('tutOverlay');
  if (overlay) overlay.style.display = 'none';
  document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));

  // Pop up the Year 0 intro news ONCE, the first time the tutorial closes.
  if (!year0NewsShown) {
    year0NewsShown = true;
    populateYear0News({ showPopup: true });
  }
}

// Renders the current step's title/text/buttons and positions the tutorial box next to its
// target element. The position-finding logic tries Right → Left → Below → Above → Centre.
function showTutStep() {
  if (tutStep >= tutSteps.length) { endTutorial(); return; }
  document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));

  const step    = tutSteps[tutStep];
  const box     = document.getElementById('tutBox');
  const nextBtn = document.getElementById('tutNextBtn');
  const prevBtn = document.getElementById('tutPrevBtn');
  const hint    = document.getElementById('tutHint');

  if (step.el) document.getElementById(step.el)?.classList.add('tut-highlight');
  document.getElementById('tutTitle').innerHTML   = step.title;
  document.getElementById('tutText').innerHTML    = step.text;
  document.getElementById('tutCounter').innerText = `${tutStep + 1} / ${tutSteps.length}`;

  // Action steps require the player to do something before they can advance.
  tutActionDone = false;
  if (step.type === 'action') {
    hint.innerHTML     = step.hint;
    hint.style.display = 'block';
    nextBtn.disabled   = true;
    nextBtn.className  = 'tut-btn tut-btn--primary tut-next--disabled';
  } else {
    hint.style.display = 'none';
    nextBtn.disabled   = false;
    nextBtn.className  = 'tut-btn tut-btn--primary tut-next--enabled';
  }
  nextBtn.innerText     = tutStep === tutSteps.length - 1 ? '🎉 Finish' : 'Next →';
  prevBtn.style.display = tutStep === 0 ? 'none' : 'inline-block';

  // ── Positioning ──
  // Reset any previous inline positioning first.
  box.style.top = box.style.left = box.style.right = box.style.bottom = 'auto';
  box.style.transform = '';

  if (step.center) {
    // Force-centred steps (e.g. the welcome / finish screens)
    box.style.top       = '50%';
    box.style.left      = '50%';
    box.style.transform = 'translate(-50%,-50%)';
    return;
  }
  if (!step.el) {
    // No target — fall back to the bottom-right corner
    box.style.bottom = '100px';
    box.style.right  = '40px';
    return;
  }

  const target = document.getElementById(step.el);
  if (!target) return;

  const r    = target.getBoundingClientRect();
  const br   = box.getBoundingClientRect();
  const bw   = br.width  || 320;
  const bh   = br.height || 280;
  const gap  = 14;
  const edge = 12;

  // Vertically centre the box against the target (then clamp to the viewport).
  const targetMidY = r.top + r.height / 2;
  let   topPx      = targetMidY - bh / 2;
  topPx            = Math.max(edge, Math.min(window.innerHeight - bh - edge, topPx));

  // Prefer right → left → below → above
  const fitsRight = r.right + gap + bw + edge < window.innerWidth;
  const fitsLeft  = r.left  - gap - bw - edge > 0;
  const fitsBelow = r.bottom + gap + bh + edge < window.innerHeight;
  const fitsAbove = r.top    - gap - bh - edge > 0;

  if (fitsRight) {
    box.style.top  = topPx + 'px';
    box.style.left = (r.right + gap) + 'px';
  } else if (fitsLeft) {
    box.style.top  = topPx + 'px';
    box.style.left = (r.left - gap - bw) + 'px';
  } else if (fitsBelow || fitsAbove) {
    // Horizontally centre against target instead
    const targetMidX = r.left + r.width / 2;
    const leftPx     = Math.max(edge, Math.min(window.innerWidth - bw - edge, targetMidX - bw / 2));
    box.style.left   = leftPx + 'px';
    box.style.top    = fitsBelow ? (r.bottom + gap) + 'px' : (r.top - gap - bh) + 'px';
  } else {
    // Nothing fits — last-resort centre on screen
    box.style.top       = '50%';
    box.style.left      = '50%';
    box.style.transform = 'translate(-50%,-50%)';
  }
}


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   18) PARTICIPANT START FLOW
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Before the simulation begins, the player enters a participant ID on a splash screen. That ID
   is logged on submission so we can match the results back to the survey response.
   beginSimulation() reads the ID → startSimulation() hides the splash → startTutorial() begins. */

function beginSimulation() {
  const input = document.getElementById('participantIdInput');
  const error = document.getElementById('participantError');
  const participantId = (input?.value || '').trim();

  if (!participantId) {
    if (error) error.style.display = 'block';
    if (input) input.focus();
    return;
  }
  if (error) error.style.display = 'none';
  startSimulation(participantId);
}

function startSimulation(participantId) {
  state.started       = true;
  state.participantId = participantId;
  simStartTime        = new Date().toISOString();

  const startScreen = document.getElementById('participantScreen');
  if (startScreen) startScreen.style.display = 'none';

  startTutorial();
}

// Used by startTutorial (pre-fills the news panel) and by endTutorial (shows the popup).
function populateYear0News({ showPopup }) {
  if (typeof YEAR_SCRIPT === 'undefined' || typeof newsDatabase === 'undefined') return;

  const scriptEntry   = YEAR_SCRIPT.find(y => y.year === 0);
  const introScenario = {
    name: 'Year 0 — Welcome',
    type: 'good',
    text: 'Welcome, investor! You start with $10,000 cash. Markets are stable today — review the headlines below and consider your first moves.'
  };
  const introHeadlines = (scriptEntry?.newsIndices || [])
    .map(idx => newsDatabase[idx])
    .filter(Boolean);

  updateNewsHistory(0, introScenario, introHeadlines);
  if (showPopup) showYearNewsModal(0, introScenario, introHeadlines);
}

function startTutorial() {
  tutStep        = 0;
  tutorialActive = true;
  // Make sure the news panel has the Year 0 headlines BEFORE the "Read News Critically!" step
  // highlights it (otherwise the panel would look empty).
  populateYear0News({ showPopup: false });
  document.getElementById('tutOverlay').style.display = 'block';
  showTutStep();
}

// Wire up the start screen's button + the participant-ID input (Enter to submit, clears the
// error banner on any keystroke).
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('participantStartBtn');
  const input    = document.getElementById('participantIdInput');
  const error    = document.getElementById('participantError');

  if (startBtn) startBtn.addEventListener('click', beginSimulation);

  if (input) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') beginSimulation(); });
    input.addEventListener('input',   () => { if (error) error.style.display = 'none'; });
    input.focus();
  }
});


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   19) INIT
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Runs once when the page finishes loading. The simulation itself doesn't start here — that
   waits for the participant to enter their ID. This just paints the initial UI underneath the
   splash screen so it looks normal once the splash is dismissed. */

function init() {
  commitHoldings();
  renderMarket();
  ScoreCard();
  updateUI();
  renderSidebar();
}

window.onload = init;


/* ════════════════════════════════════════════════════════════════════════════════════════════════
   20) RESULTS EXPORT TO GOOGLE SHEETS
   ════════════════════════════════════════════════════════════════════════════════════════════════
   Called from the "Submit your results" button on the game-over modal. Posts the final
   numbers to a Google Apps Script web app, then redirects to the survey on success. On
   failure, the user can retry — we never redirect with unsaved data. */

async function submitParticipantResult() {
  const portVal       = ASSETS.reduce((sum, a) => sum + state.holdings[a.id] * a.price, 0);
  const finalNetWorth = Math.floor(state.cash + portVal);
  const finalCash     = Math.floor(state.cash);
  const endTime       = new Date().toISOString();

  const payload = {
    api_token:        STUDY_TOKEN,
    participant_id:   state.participantId,
    date:             new Date().toLocaleDateString(),
    timestamp:        endTime,
    start_time:       simStartTime,
    end_time:         endTime,
    final_cash:       finalCash,
    final_networth:   finalNetWorth,
    discipline_score: state.metrics.emotionalDiscipline,
    diversity_score:  state.metrics.diversityConsistency
  };

  console.log('[submit] sending payload:', payload);

  // 15-second timeout so a hung Apps Script doesn't lock the player up.
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method:    'POST',
      headers:   { 'Content-Type': 'text/plain;charset=utf-8' },   // text/plain avoids a CORS preflight
      body:      JSON.stringify(payload),
      keepalive: true,                                              // request finishes even if the page navigates
      redirect:  'follow',
      signal:    controller.signal
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    console.log('[submit] raw response text:', text);

    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      throw new Error('Apps Script returned non-JSON. First 200 chars: ' + text.substring(0, 200));
    }

    console.log('[submit] response:', result);
    if (!result.ok) throw new Error(result.error || 'Failed to submit');
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Wired to the "Submit your results" button. Saves first, redirects on success only.
async function finishAndSubmit(btn) {
  if (btn) {
    btn.disabled  = true;
    btn.innerText = '⏳ Submitting your results...';
  }

  try {
    await submitParticipantResult();
    console.log('[submit] ✓ recorded to Sheets');
  } catch (err) {
    console.error('[submit] ✗ failed:', err);
    if (btn) {
      btn.disabled  = false;
      btn.innerText = '⚠️ Submission failed. Click to retry.';
    }
    alert(
      'We could not save your results to the database.\n\n' +
      'Error: ' + (err.message || err) + '\n\n' +
      'Please click the button again to retry. ' +
      'If it still fails, take a screenshot of this page and your participant ID before continuing.'
    );
    return;   // do NOT redirect on failure — otherwise the data is lost forever
  }

  if (btn) btn.innerText = '✅ Saved! Redirecting...';
  // Small delay so the success state is visible and the keepalive request flushes.
  setTimeout(() => { window.location.href = SURVEY_REDIRECT_URL; }, 400);
}
