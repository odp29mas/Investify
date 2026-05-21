# Investify

A gamified 20-year investment simulation built for financial-literacy workshops. Each participant starts with $10,000 cash, receives $10,000 of income every simulated year, and decides how to build a portfolio across shares, ETFs, bonds, and index funds while reacting (or not reacting) to a scripted stream of news, scenarios, and breaking events. At the end of 20 years, they receive a composite score and their results are submitted to a central record for follow-up analysis.

---

## Quick Start

Investify is a static web app — there is no build step, no install, no server required.

1. Place all six project files in a single folder
2. Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox)
3. Enter a participant ID on the splash screen to begin

For local development, opening `index.html` directly from disk works for most things. The Google Sheets submission at the end requires an internet connection.

---

## Project Structure

| File | Purpose |
|---|---|
| `index.html` | The game interface — layout, panels, modals, and buttons |
| `marketsim.css` | Visual styling — colours, fonts, spacing, animations |
| `marketsim.js` | All game logic — buying, selling, scoring, year advance, end-of-game results, results export |
| `assets-data.js` | Investable assets shown in the marketplace (name, ticker, sector, starting price, volatility, description) |
| `news-data.js` | News database, per-year news scripts, breaking-news events, and macro scenarios |
| `tutorial-data.js` | Step-by-step tutorial content shown to first-time participants |

The scripts must be loaded in the order listed in `index.html`: data files first (`assets-data.js`, `news-data.js`, `tutorial-data.js`), then `marketsim.js`. 
---

## How the Game Works

The participant enters their ID, is walked through a short tutorial, and then plays 20 rounds — each round representing one calendar year. In every round they can:

- Browse the marketplace (cards grouped by Shares, Sector ETFs, Bonds, Index Funds)
- Click an asset's name to see its description and historical chart
- Read news headlines for the current year and click any headline for the full article and editorial commentary
- Buy and sell assets at their current price
- Click **Advance Year** when ready

Advancing the year triggers the price engine: every asset moves based on its drift, volatility, and any active scenario or aftershock. The next year's news is then revealed, and the cycle repeats until year 20.

At year 20, an end-of-game modal shows the participant's final net worth, breakdown scores, and a chart comparing their performance against the "Mattress Method" (keeping all $210,000 of income as cash). A submit button posts their results to Google Sheets and redirects them to a follow-up survey.

---

## Scoring System

The final score is a composite out of 100, weighted as:

- **35% Discipline** — starts at 100 and drops by 8 every time the participant trades an asset in response to an uncredible (credibility 3) headline. Never goes up.
- **35% Diversity** — a per-year score from 0–10 based on how spread out the portfolio is across asset classes and sectors. Averaged across all years. Pure index-fund portfolios automatically get full marks because index funds are internally diversified.
- **30% Profit** — how much the participant beat the Mattress Method ($210,000) by, capped between 0 and 100.

The composite then maps to a grade tier:

| Score  | Tier |
| 85–100 | 🏆 Master Investor |
| 70–84  | ⭐ Solid Planner |
| 50–69  | 📊 Developing Investor |
| 0–49   | ⚠️ Room for Improvement |

---

## Common Edits for Facilitators

These are the changes a facilitator is most likely to want before running a session. All of them can be found in `marketsim.js` unless noted otherwise.

| What to change | Where to find it |
|---|---|
| Redirect link shown after the participant finishes | `SURVEY_REDIRECT_URL` constant near the top of `marketsim.js` |
| Point deduction for reacting to fake news | Inside `nextYear()`, the line that subtracts `8` from `emotionalDiscipline` |
| Final score weighting (currently 30/35/35) | Inside `endGame()`, the `finalScore` calculation |
| Message and colour shown for each grade tier | Inside `endGame()`, the `gradeText` / `gradeColor` block |
| Starting cash or yearly income | The `state` object at the top of `marketsim.js` (`cash`, `income`) |
| Number of years in the simulation | The `state` object at the top of `marketsim.js` (`maxSteps`) |
| Mattress-method comparison value | Inside `endGame()`, the `mattressValue` constant |

---

## Deeper Customisation

Once you're comfortable with the basics, you can extend the simulation:

- **Edit the news mix** in `news-data.js` — swap in headlines that match your audience (local market events, sector-specific stories, etc.). Each news entry has a `headline`, `company` or `sector`, `impact`, and `credibility` (1 = official, 2 = analyst, 3 = noise/social).
- **Edit the asset list** in `assets-data.js` — add or remove tickers, adjust starting prices, change sectors. If you add a new sector, also add a matching entry in the `SECTOR_PROFILES` and `sectorPalette` objects in `marketsim.js` so the sparklines and donut chart render correctly.
- **Adjust the tutorial** in `tutorial-data.js` — add, reorder, or remove steps. Each step targets an element by its `id` and can be either an info step (`type: 'auto'`) or one that waits for a specific action (`type: 'action'`).
- **Tune the price engine** in `marketsim.js` inside `nextYear()` — the `DRIFT` constants control expected annual return per asset class; per-asset `volatility` lives in `assets-data.js`.
- **Add more grading tiers** in `endGame()` — split the existing thresholds into finer bands for more nuanced feedback.

---

## Results Export

When the participant clicks the submit button at the end of the game, `finishAndSubmit()` posts a payload to a Google Apps Script web app, which appends a row to a Google Sheet. The payload includes:

- Participant ID
- Date, start time, end time
- Final cash and final net worth
- Discipline and Diversity scores

The Apps Script URL and the security token live as constants near the top of `marketsim.js` (`APPS_SCRIPT_URL`, `STUDY_TOKEN`). To point at a different sheet, deploy a new Apps Script and update the URL.

On submission failure the participant is shown a retry button — the page does **not** redirect to the survey unless the save succeeded, so no data is lost silently.

---

## State and Data Flow

Everything the game knows about the current session lives in a single `state` object at the top of `marketsim.js`. The most important fields:

| Field | What it holds |
|---|---|
| `cash` | Liquid cash the participant has right now |
| `step` | Current year (0 = start, 20 = game over) |
| `holdings` | `{ assetId: units }` — live positions |
| `priceHistory` | `{ assetId: [...prices] }` — monthly points for sparklines |
| `pendingOrders` | Trades placed this year (for the "This Year's Trades" panel) |
| `transactions` | Full chronological trade log |
| `metrics.emotionalDiscipline` | Discipline score, 0–100 |
| `metrics.diversityConsistency` | Diversity score, 0–100, rolling average |
| `_aftershocks` | Lingering sector drag from recent crashes |

---


## File-by-File Notes for Developers

`marketsim.js` is organised into 20 numbered sections with banner headers. Use the file's table of contents at the top to jump around. Key entry points:

- `init()` — runs once on page load; paints the initial UI
- `startTutorial()` — kicks off the on-boarding overlay
- `nextYear()` — the core game loop; runs once per year-advance
- `endGame()` — fills the final scorecard and draws the comparison chart
- `finishAndSubmit()` — saves the result and redirects to the survey

Functions called from `index.html` (via `onclick` attributes) must remain at the global scope. These include `nextYear`, `buy`, `sell`, `startTutorial`, `nextTutorial`, `prevTutorial`, `endTutorial`, `toggleModal`, `closeShockModal`, `closeBreakingNews`, `closeEduModal`, `switchDonutTab`, `showHoldingsModal`, `showTransactionsModal`, `showPastNewsModal`, `updateDetailTimeframe`, and `finishAndSubmit`.

---

## Browser Support

Tested on recent versions of Chrome, Edge, Safari, and Firefox. Requires JavaScript and an internet connection for Chart.js (loaded from CDN) and the results submission. No mobile-specific layout — best experienced on a laptop or desktop screen.

---

## Credits

Built for the MoneySense financial-literacy programme. Charts powered by [Chart.js](https://www.chartjs.org/). Results storage handled via a Google Apps Script web app writing to a Google Sheet.
