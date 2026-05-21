// ══════════════════════════════════════════════════════════════════════ News Data ════════════════════════════════════════════════════════════════════════════
// There are three types of news -- (1) Scenarios (major macro events); (2) Regular News (yearly news items); (3) Breaking News (mid-year shocks).

// (1) Scenario Structure (SCENARIOS)
// - News events that affect multiple assets in a sector or the whole market. 
// - Macro news helps simulate real-world market scenarios by showing how one event can influence multiple assets, sectors, or the overall market.

// (2) Regular News Structure (newsDatabase)
// Yearly news items that provide updates on market conditions, company performance, and economic indicators.
// Categorised by Sector ETF and indiviudal companty news. 
// Each item has a source credibility level (1–3), which influences asset/sector price impact and discipline score.
// News is also labeled as real or noise so the simulation can distinguish strong signals from weak or low-impact information.

// (3) Breaking News Structure (BREAKING_NEWS)
// Events that occur mid-year (10s after advancing a year). 
// -esigned to be unexpected shocks that test players' ability to adapt and manage risk.

// YEAR_SCRIPT : Defines the year-by-year order of all three types of news events, keeping the game consistent.  
// newsCommentary : Provides deeper context for Regular News (in newsDatabase) only.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// ─── SCENARIOS ──────────────────────────────────────────────────────
const SCENARIOS = [
  { name:'Tech Bubble Burst',    type:'bad',  text:'Tech Bubble Bursts! Overvalued tech valuations are under fire as liquidity dries up.',                                                 impact:{ Technology:0.75, General:0.90, Govt:1.05 } },
  { name:'Global Health Crisis', type:'bad',  text:'Health Crisis! Global lockdowns initiated! Consumer activity stalls, but biotech races to find a cure.',                               impact:{ FoodandBeverage:0.85, Technology:1.15, Healthcare:1.25, Energy:0.60, General:0.75, Govt:1.10 } },
  { name:'Oil Price Crash',      type:'bad',  text:'Oil prices plummet! Geopolitical friction leads to a global energy glut. Prices crater as storage hits capacity and demand falters.',  impact:{ Energy:0.65, General:0.95 } },
  { name:'Fed Rate Cut',         type:'good', text:'Rates Cut! Aggressive rate cuts flood the system with cheap capital, sparking a dash for risk and booming property markets.',          impact:{ Technology:1.20, 'Real Estate':1.25, Govt:1.02, General:1.10 } },
];

// ─── NEWS DATABASE ──────────────────────────────────────────────────
const newsDatabase = [
  // credibility: 1=official/primary, 2=analyst/reputable, 3=social/unverified
  // Level 1: Full impact. Level 2: ~60% impact. Level 3: Near-zero or opposite.
  // 'type' drives discipline scoring: 'noise' = should ignore, 'real' = legitimate

  // ── TECHNOLOGY ETF (XLK) ──
  { headline: "💻 OFFICIAL: US and EU sign historic pact to subsidize semiconductor manufacturing globally.", sector:"Technology", impact: 0.12, type:'real', credibility:1 },
  { headline: "💻 REUTERS: Global rare earth elements shortage expected to halt electronics manufacturing in Q3.", sector:"Technology", impact:-0.17, type:'real', credibility:1 },
  { headline: "💻 'FinTok' Influencer with 2M followers says 'Tech is dead, put all your money in vintage watches.'", sector:"Technology", impact:-0.02, type:'noise', credibility:3 },
  { headline: "💻 WhatsApp Forward: '5G towers are causing server farms to melt down! Sell your tech shares NOW!!!'", sector:"Technology", impact:-0.01, type:'noise', credibility:3 },
  { headline: "💻 ANALYST: Major investment bank downgrades entire software sector, citing 'AI fatigue'.", sector:"Technology", impact:-0.04, type:'real', credibility:2 },
  { headline: "💻 DEPARTMENT OF DEFENSE: Massive state-sponsored cyberattack compromises top cloud computing providers. Global security fears.", sector:"Technology", impact: -0.16, type:'real', credibility:1 },
  { headline: "💻 MORGAN STANLEY: Cloud computing adoption is slowing down among mid-sized enterprises. Analysts downgrade tech sector growth forecasts.", sector:"Technology", impact: -0.06, type:'real', credibility:2 },  
  { headline: "💻 A friend who works at a startup tells you over coffee: 'Traditional tech is a dinosaur, man. Web3 and decentralized networks are eating the world. Buying the tech index is basically buying blockbusters in 2005.'", sector:"Technology", impact: -0.01, type:'noise', credibility:3 },
  
  // ── REAL ESTATE ETF (RES) ──
  { headline: "🏢 BLOOMBERG: Commercial office occupancy hits 10-year low as remote work becomes permanent.", sector:"Real Estate", impact:-0.10, type:'real', credibility:1 },
  { headline: "🏢 Kopitiam Uncle swears the government is giving away free commercial lots next month. 'My friend's brother's daughter-in-law's friend works there!'", sector:"Real Estate", impact: 0.01, type:'noise', credibility:3 },
  { headline: "🏢 Tarot Card reader warns that 'clashing energy' makes this a terrible year to invest in property.", sector:"Real Estate", impact:0.2, type:'noise', credibility:3 },
  { headline: "🏢 Wall Street Journal: Experts in the field claims that construction materials shortage threatens to delay global housing projects.", sector:"Real Estate", impact:-0.08, type:'real', credibility:2 },
  { headline: "🏢 GLOBAL ECONOMIC FORUM: International commercial real estate sees massive resurgence as multinational firms worldwide mandate a full return-to-office.", sector:"Real Estate", impact: 0.12, type:'real', credibility:1 },
  { headline: "🏢 BLOOMBERG: New data on suburban migration patterns suggests that global retail property valuations are currently overstated.", sector:"Real Estate", impact: -0.05, type:'real', credibility:2 },
  { headline: "🏢 NOMURA ANALYSTS: Mortgage default rates are ticking up slightly across developed markets, posing a moderate headwind for residential REITs.", sector:"Real Estate", impact: -0.04, type:'real', credibility:2 },
  { headline: "🏢 Your friend majoring in Real Estate Management said that his Real Estate ETFs stock is at its lowest now and will definitely sky-rocket in the next few months, all his frineds are following him.", sector:"Estate", impact: -0.09, type:'noise', credibility:3 },

  // ── HEALTHCARE ETF (XLV) ──
  { headline: "⚕️ WHO: International funding mobilized for biotech research.", sector:"Healthcare", impact: 0.18, type:'real', credibility:1 },
  { headline: "⚕️ US Food and Drug Administration: Sweeping new regulations fast-track the approval process for generic medications, big pharmaceutical companies loses their monopolies", sector:"Healthcare", impact:-0.09, type:'real', credibility:1 },
  { headline: "⚕️ Podcast Bro claims 'Big Pharma' is hiding the cure for aging.", sector:"Healthcare", impact:-0.01, type:'noise', credibility:3 },
  { headline: "⚕️ Overheard on the MRT: 'Hospitals are going bankrupt because everyone is eating organic garlic now.'", sector:"Healthcare", impact:-0.01, type:'noise', credibility:3 },
  { headline: "⚕️ MEDICAL JOURNAL: Breakthrough in CRISPR gene editing successfully passes multi-national clinical trials.", sector:"Healthcare", impact: 0.14, type:'real', credibility:3 },
  { headline: "⚕️ Highly anticipated sector-wide Alzheimer's drug trials show mixed results, tempering expectations across the biotech industry.", sector:"Healthcare", impact: -0.04, type:'real', credibility:2 },
  
  // ── ENERGY ETF (XLE) ──
  { headline: "⚡ International Energy Agency REPORT: Global transition to renewables accelerating 5 years ahead of schedule.", sector:"Energy", impact: 0.11, type:'real', credibility:1 },
  { headline: "⚡ OFFICIAL: Major cyberattack completely disables the largest fuel pipeline in North America.", sector:"Energy", impact:-0.2, type:'real', credibility:1 },
  { headline: "⚡ Grab Uncle swears he drove an Energy executive panicking about severe oil shortages. Uncle warns 'No oil means the companies will go bankrupt!'", sector:"Energy", impact: 0.08, type:'noise', credibility:3 },
  { headline: "⚡ Viral Tweet claims solar panels are 'draining the sun's energy' and will cause an ice age. 100k retweets.", sector:"Energy", impact:-0.02, type:'noise', credibility:3 },
  { headline: "⚡ ANALYST NOTE: Winter heating demand expected to shatter records due to polar vortex.", sector:"Energy", impact: 0.08, type:'real', credibility:2 },
  { headline: "⚡ Auntie forwards a 10-minute voice note claiming wind turbines are slowing down the Earth's rotation. Recommends hoarding diesel.", sector:"Energy", impact: -0.01, type:'noise', credibility:3 },
  { headline: "⚡ ANALYST NOTE: Goldman Sachs predicts an unusually mild winter in Europe, drastically lowering natural gas demand projections.", sector:"Energy", impact: -0.07, type:'real', credibility:2 },
  { headline: "⚡ MORNINGSTAR: Upgrades the renewable energy sector, citing faster-than-expected reductions in commercial battery storage costs.", sector:"Energy", impact: 0.06, type:'real', credibility:2 },
  { headline: "⚡ Your schoolmate who trades full-time messages you: 'I just read a 40-part Redidt thread by a hedge fund guy. There will be an energy crisis soon. Dump your Energy Shares ASAP.'", sector:"Real Estate", impact: 0.03, type:'noise', credibility:3 },
  { headline: "🌍 A friend forwards you an X (Twitter) Post: 'The macro indicators are screaming recession. The yield curve has been inverted for months. I just moved my entire portfolio to 100% cash. Don't say I didn't warn you.'", sector:"Global", impact: -0.00, type:'noise', credibility:3 },

  // ── ORANGE (Tech/Hardware) ──
  { headline: "🍊 EU Regulators launch antitrust probe into Orange's exclusive app ecosystem.", company:"Orange", impact:-0.12, type:'real', credibility:1 },
  { headline: "🍊 Leaked Memo: Orange facing supply chain delays for upcoming 'Squeeze 15' smartphone.", company:"Orange", impact:-0.10, type:'real', credibility:2 },
  { headline: "🍊 Ex-staff from Orange reveal high levels of debt and internal turmoil; stock dips.", company:"Orange", impact:-0.04, type:'noise', credibility:3 },
  { headline: "🍊 Leaked render of Orange's next headset mocked on Reddit for looking like a toaster.", company:"Orange", impact:-0.01, type:'noise', credibility:3 },
  { headline: "🍊 Orange announces massive stock buyback program, boosting investor confidence.", company:"Orange", impact: 0.08, type:'real', credibility:1 },
  { headline: "🍊 Rumor: Orange CEO seen meeting with rival executives, sparking baseless merger rumors.", company:"Orange", impact: 0.02, type:'noise', credibility:3 },
  { headline: "🍊 Factory strike in key manufacturing hub halts Orange production for a month.", company:"Orange", impact:-0.09, type:'real', credibility:2 },

  // ── DINOSAUR FUEL (Energy) ──
  { headline: "🦖 Dinosaur Fuel discovers massive untapped oil reserve in the Permian Basin.", company:"Dinosaur Fuel", impact: 0.15, type:'real', credibility:1 },
  { headline: "🦖 OPEC+ announces surprise production cuts; Dinosaur Fuel margins set to widen.", company:"Dinosaur Fuel", impact: 0.09, type:'real', credibility:1 },
  { headline: "🦖 Expert: Dinosaur Fuel's infrastructure is 'becoming a liability' as EVs gain share.", company:"Dinosaur Fuel", impact:-0.05, type:'noise', credibility:2 },
  { headline: "🦖 Political unrest in major oil-producing regions sends Dinosaur Fuel futures falling.", company:"Dinosaur Fuel", impact:-0.08, type:'real', credibility:2 },
  { headline: "🦖 Dinosaur Fuel reveals multi-billion dollar pivot to hydrogen.", company:"Dinosaur Fuel", impact: 0.06, type:'real', credibility:1 },
  { headline: "🦖 Activist group paints Dinosaur Fuel HQ pink; photos go viral but operations unaffected.", company:"Dinosaur Fuel", impact:-0.01, type:'noise', credibility:3 },
  { headline: "🦖 Dinosaur Fuel hit with multi-million dollar fine for historic offshore spill.", company:"Dinosaur Fuel", impact:-0.07, type:'real', credibility:1 },
  { headline: "🦖 Unverified blog post claims Dinosaur Fuel is secretly hoarding oil to manipulate prices.", company:"Dinosaur Fuel", impact:-0.02, type:'noise', credibility:3 },
  { headline: "🦖 Earnings Beat: Dinosaur Fuel posts record quarterly profits amidst global energy crunch.", company:"Dinosaur Fuel", impact: 0.11, type:'real', credibility:1 },

  // ── COLA-KOLA (Beverage) ──
  { headline: "🥤 Cola-Kola's new zero-sugar drink becomes a viral sensation among Gen Z consumers.", company:"Cola-Kola", impact: 0.04, type:'noise', credibility:3 },
  { headline: "🥤 Expert: 'Sugar Tax' legislation passing in 12 more countries; Cola-Kola margins threatened.", company:"Cola-Kola", impact:-0.11, type:'real', credibility:1 },
  { headline: "🥤 Health Report: New study links Cola-Kola's sweetener to long-term fatigue.", company:"Cola-Kola", impact:-0.08, type:'real', credibility:2 },
  { headline: "🥤 Conspiracy theory linking Cola-Kola's recipe to aliens trends on Twitter.", company:"Cola-Kola", impact:-0.01, type:'noise', credibility:3 },
  { headline: "🥤 Cola-Kola expands into the booming glitter water market with a $2B acquisition.", company:"Cola-Kola", impact: 0.07, type:'real', credibility:1 },
  { headline: "🥤 Nationwide truck driver strike disrupts Cola-Kola distribution across North America.", company:"Cola-Kola", impact:-0.06, type:'real', credibility:2 },
  { headline: "🥤 A celebrity is seen drinking a competitor's beverage; Cola-Kola stock briefly stumbles.", company:"Cola-Kola", impact:-0.02, type:'noise', credibility:3 },

  // ── JOHN & JOHNNIE (Consumer Health) ──
  { headline: "👬 John & Johnnie's latest medical device receives FDA approval, expected to revolutionize surgeries.", company:"John & Johnnie", impact: 0.11, type:'real', credibility:1 },
  { headline: "👬 John & Johnnie's new robotic surgeon performs first successful solo appendectomy.", company:"John & Johnnie", impact: 0.14, type:'real', credibility:1 },
  { headline: "👬 Speculation: John & Johnnie facing a massive recall of defective baby monitors.", company:"John & Johnnie", impact:-0.11, type:'real', credibility:2 },
  { headline: "👬 High-profile short seller calls John & Johnnie 'overvalued' on morning talk show.", company:"John & Johnnie", impact:-0.04, type:'noise', credibility:2 },
  { headline: "👬 John & Johnnie's new consumer health line receives FDA warning for false advertising.", company:"John & Johnnie", impact:-0.09, type:'real', credibility:1 },
  { headline: "👬 Anonymous Reddit post predicts John & Johnnie bankruptcy; quickly deleted.", company:"John & Johnnie", impact:-0.02, type:'noise', credibility:3 },
  { headline: "👬 John & Johnnie reports consistent, steady growth in its skincare division.", company:"John & Johnnie", impact: 0.04, type:'real', credibility:1 },
  { headline: "👬 ABCDnews claims John & Johnnie is changing the formula of its iconic baby shampoo.", company:"John & Johnnie", impact:-0.01, type:'noise', credibility:3 },
  { headline: "👬 Massive settlement reached in John & Johnnie's talcum powder lawsuit, clearing uncertainty.", company:"John & Johnnie", impact: 0.08, type:'real', credibility:1 }
];

// ═══════════════════════════ BREAKING NEWS ═══════════════════════════
// Shown 10s after year advance. Credibility affects price.
// They are NOT included in YEAR_SCRIPT to preserve the surprise element and allow flexible triggering in any year.

const BREAKING_NEWS = [
  { year:5,  headline:"COLA-KOLA CFO ARRESTED, CEO RESIGNS IN FUNDS MISHANDLING SCANDAL", subtext:"Internal audit reveals $2.1B in misappropriated corporate funds. Board appoints interim leadership immediately. Shares plunge as investigations begin.", company:'Cola-Kola', impact:-0.18, credibility:1 },
  { year:12, headline:"MAJOR GEOPOLITICAL CONFLICT BREAKS OUT, GLOBAL MARKETS PLUMMET", subtext:"Hostilities erupt in key economic region. Supply chain disruptions feared globally. Investors flee to safe-haven assets. Significant sell-off across all sectors.", sector:'Global', impact:-0.15, credibility:1 },
  { year:15, headline:"GOVERNMENT ANNOUNCES MID-YEAR $40B AI INFRASTRUCTURE SUPPORT PACKAGE", subtext:"Significant funding allocated for AI research, data centers, and grid modernization. Tech sector poised for growth; Energy demand outlook increases significantly.", sector:'Technology', impact:0.12, sectorAlt:'Energy', impactAlt:0.08, credibility:1 }
];

// ═══════════════════════════ YEAR SCRIPT ═══════════════════════════
// YEAR_SCRIPT contains scheduled news shown immediately at the START of each year.
// Each entry includes newsIndices (from newsDatabase) and a scenarioName.
// Across Years 0–20, the script uses all 64 news items (0–63) exactly once.
// Each year includes a mix of news sources and a balance of credibility levels:

const YEAR_SCRIPT = [
  { year:  0, scenarioName: null,                   newsIndices: [0, 50, 55] },        // Tech ETF c1, Cola c2, J&J c1
  { year:  1, scenarioName: null,                   newsIndices: [8, 39, 18] },        // RE c1, Dino c1, HC c3
  { year:  2, scenarioName: null,                   newsIndices: [4, 32, 24] },        // Tech c2, Orange c1, Energy c3
  { year:  3, scenarioName: "Tech Bubble Burst",    newsIndices: [11, 49, 2] },        // RE c2, Cola c1, Tech c3
  { year:  4, scenarioName: null,                   newsIndices: [40, 56, 19] },       // Dino c1, J&J c1, HC c3
  { year:  5, scenarioName: null,                   newsIndices: [22, 33, 9] },        // Energy c1, Orange c2, RE c3
  { year:  6, scenarioName: null,                   newsIndices: [5, 57, 48] },        // Tech c1, J&J c2, Cola c3
  { year:  7, scenarioName: null,                   newsIndices: [41, 12, 20] },       // Dino c2, RE c1, HC c3
  { year:  8, scenarioName: "Fed Rate Cut",         newsIndices: [26, 52, 34] },       // Energy c2, Cola c1, Orange c3
  { year:  9, scenarioName: null,                   newsIndices: [6, 60, 42] },        // Tech c2, J&J c3, Dino c2
  { year: 10, scenarioName: null,                   newsIndices: [16, 13, 25] },       // HC c1, RE c2, Energy c3
  { year: 11, scenarioName: null,                   newsIndices: [38, 43, 51] },       // Orange c2, Dino c1, Cola c3
  { year: 12, scenarioName: null,                   newsIndices: [1, 59, 14] },        // Tech c1, J&J c1, RE c2
  { year: 13, scenarioName: "Oil Price Crash",      newsIndices: [23, 44, 35] },       // Energy c1, Dino c3, Orange c3
  { year: 14, scenarioName: null,                   newsIndices: [17, 61, 7] },        // HC c1, J&J c1, Tech c3
  { year: 15, scenarioName: null,                   newsIndices: [45, 53, 27] },       // Dino c1, Cola c2, Energy c3
  { year: 16, scenarioName: null,                   newsIndices: [36, 3, 10] },        // Orange c1, Tech c3, RE c3
  { year: 17, scenarioName: null,                   newsIndices: [21, 46, 54] },       // HC c2, Dino c3, Cola c3
  { year: 18, scenarioName: "Global Health Crisis", newsIndices: [28, 62, 37] },       // Energy c2, J&J c3, Orange c3
  { year: 19, scenarioName: null,                   newsIndices: [15, 58, 31] },       // RE c3, J&J c2, Global c3
  { year: 20, scenarioName: null,                   newsIndices: [29, 30, 47, 63] }    // Energy c2, RE c3, Dino c1, J&J c1
];

// ═══════════════════════════ NEW COMMENTARY ═══════════════════════════
// Additional description shown when the player clicks a headline in the News Panel.
// Commentary is NOT shown in the news pop-up at the start of the year. 

const newsCommentary = {
  0: "After years of chip shortages and rising competition over advanced manufacturing, the US and EU announced a joint effort to fund semiconductor production. The partnership is aimed at strengthening the supply chain for chips used in phones, computers, cars, and AI systems. For technology companies, this could reduce reliance on limited production hubs and support long-term industry growth.",
  1: "Reuters, a global news agency widely followed by financial markets, reports that rare earth shortages may disrupt electronics manufacturing. These materials are used in components such as chips, batteries, screens, and sensors, making them important to the technology supply chain. If supply tightens further, production costs may rise and hardware companies could face delays in meeting demand.",
  2: "A popular FinTok influencer, known for making bold investing takes and viral money challenges, claims that technology shares are no longer worth buying and urges followers to move their money into vintage watches instead. The post quickly gains attention online, especially among beginner investors looking for simple financial advice. However, the claim is framed more like a bold personal opinion than a researched market update.",
  3: "Forwarded by your distant relative, the WhatsApp message claims that 5G towers are causing server farms to overheat, but does not point to any company report, engineering evidence, or official investigation. For investors, this looks more like fear-driven online misinformation than a useful signal about the technology sector.",
  4: "A major investment bank has lowered its view on the software sector, arguing that investor excitement around AI may be cooling after a period of heavy hype. Investment bank analysts often track company earnings, valuations, and industry trends before issuing sector calls. This kind of report may not be an official company announcement, but it can still shape market expectations and investor sentiment.",
  5: "The Department of Defense reports that a state-sponsored cyberattack has compromised major cloud computing providers, raising concerns about digital infrastructure security. Cloud platforms are used by businesses, governments, and consumers, so a serious breach could affect trust in technology services.",
  6: "Morgan Stanley, a global financial institution, reports that cloud computing adoption is slowing among mid-sized enterprises. This matters because cloud services are one of the key growth engines for many technology companies. If business demand weakens, investors may lower their expectations for future tech-sector revenue growth.",
  7: "This claim comes from a casual conversation with a friend working at a startup, who argued that traditional technology companies are being replaced by Web3 and decentralised networks. He points to the rise of blockchain platforms, peer-to-peer systems, and startups building products without relying on large cloud or software companies as signs that the old tech giants may lose relevance.",

  8: "Bloomberg reports that commercial office occupancy has fallen to a 10-year low as remote work becomes a more permanent part of work culture. This matters because office landlords rely on tenants renewing leases and keeping buildings filled. Lower occupancy may reduce rental income and put pressure on commercial property values.",
  9: "Kopitiam uncle claims that the government will be giving away free commercial lots next month, saying he heard it through a long chain of personal connections. He say, with commercial rents staying expensive, the idea of free space can attract business owners, real estate companies will not collapse. As the neighbourhood investment guru, he predicts that property values will drop.", 
  10: "Tarot card reader warns that “clashing energy” makes this a bad year to invest in property. When asked about the property sector, she pulls Death, Four of Pentacles, and a suspiciously upside-down Ten of Coins. She presents the cards as signs of shaky foundations, tight money, and wealth that may not flow as easily as expected.", 
  11: "The Wall Street Journal, a long-established business newspaper, reports that experts are warning of construction material shortages that could delay housing and commercial projects globally. Material shortages matter because they can raise building costs, slow project completion, and reduce the supply of new properties. Developers and real estate companies may face tighter margins if projects become more expensive to complete.", 
  12: "The Global Economic Forum, international advocacy non-governmental organization, reports that commercial real estate is recovering as multinational firms bring employees back to the office. A stronger return-to-office trend could raise demand for office space and improve rental income for commercial landlords. This may benefit real estate companies with large office portfolios in major business districts.",
  13: "Bloomberg, a global financial news provider, reports that suburban migration data may be making retail property valuations look too optimistic. This matters because where people live and work affects foot traffic, tenant demand, and retail sales. If retail spaces are priced too highly, real estate companies may face weaker returns than expected.",
  14: "Nomura analysts from a major Japanese financial institution report that mortgage default rates are rising slightly across developed markets. Higher defaults suggest that some households are facing repayment pressure, which can weigh on residential property demand and rental stability. Residential REITs may face a moderate headwind if this repayment stress continues.", 
  15: "A friend majoring in Real Estate Management says real estate ETFs are at their lowest point and will definitely skyrocket in the next few months. All his Real Estate frineds are buying Real Estate ETFs. His confidence seems to come from seeing property shares fall, then treating the dip as an obvious bargain before a rebound.", 

  16: "The World Health Organization, reports that new funding has been mobilised for biotech research. This could support laboratories working on vaccines, gene therapies, and advanced treatments for difficult diseases. More funding may help healthcare companies accelerate research pipelines and bring new medical technologies closer to market.",
  17: "The US Food and Drug Administration, the regulator responsible for approving medicines in the United States, announces faster approval pathways for generic medications. This could make cheaper alternatives available more quickly, increasing competition against large pharmaceutical companies with branded drugs. Big drugmakers may face pressure if products that once enjoyed strong pricing power are challenged by lower-cost generics.",
  18: "A popular podcaster claims that “Big Pharma” is hiding the cure for aging, citing old patent filings, expensive longevity treatments, and the slow pace of drug approvals. He claims that pharmaceutical companies profit from long-term treatments of 'incurable' disease more than cures.",
  19: "Someone on the MRT claims hospitals are going bankrupt because everyone is eating organic garlic now. There is also a growing interest in natural remedies, wellness trends, and preventive health.",
  20: "An established medical journal reports that a CRISPR gene-editing breakthrough has successfully passed multi-national clinical trials. A successful trial could strengthen confidence in gene-editing companies and the wider healthcare innovation sector. Doctors, scientists and healthcare professionals worldwide are excited for what the biotechnology entials in the future.",
  21: "Highly anticipated Alzheimer’s drug trials have produced mixed results, reducing some of the excitement around biotech companies working on brain-related diseases. Alzheimer’s treatments are closely watched because the patient population is large and effective drugs could generate major revenue. Mixed results do not mean the field has failed, but they may make investors more cautious about how quickly these therapies can succeed.", 

  22: "The International Energy Agency, an intergovernmental organisation that tracks global energy markets and policy trends, reports that the shift to renewables is moving five years ahead of schedule. Faster renewable adoption could increase demand for solar, wind, batteries, and grid infrastructure. This may support clean energy firms, while putting pressure on traditional fuel companies to adapt more quickly.",
  23: "An official report says a major cyberattack has completely disabled the largest fuel pipeline in North America. Fuel pipelines are critical infrastructure because they transport petrol, diesel, and other energy products across long distances. A shutdown of this scale could disrupt supply, raise fuel prices, and hurt confidence in energy infrastructure security.",
  24: "A Grab uncle says he drove an energy executive who was panicking about severe oil shortages. An hour later, news reports begin mentioning tight oil supply, making the uncle’s story feel like it was based on hidden insider knowledge. He urged all his customers to sell all their shares in Dinosaur Fuel.",
  25: "A viral tweet claims that solar panels are draining the sun’s energy and could eventually cause an ice age. The post is accompanied by an AI-video of how we could be entering a Global Over-Cooling phase as solar panels weaken the sun's energy and humanity is doomed.", 
  26: "An analyst note predicts that winter heating demand could reach record highs because of a polar vortex. Cold weather usually increases demand for natural gas, heating oil, and electricity, especially in regions with harsh winters. If the forecast holds, energy companies may benefit from higher demand and stronger prices.",
  27: "Auntie forwards a 10-minute voice note claiming that wind turbines are slowing down the Earth’s rotation and tells everyone to hoard fuel. The voice note insists that governments will soon panic-buy fuel to replace unreliable wind energy, causing fuel prices to spike and it is time to sell all Energy-related investments.",  
  28: "Goldman Sachs, a major global investment bank, predicts that Europe will experience an unusually mild winter. A warmer winter would reduce demand for heating, especially natural gas. Lower demand projections could weigh on energy prices and reduce expected profits for gas producers.",
  29: "Morningstar, an investment research firm known for fund ratings and market analysis, upgrades the renewable energy sector after faster-than-expected declines in battery storage costs. Cheaper battery storage can make renewable energy more practical by helping store solar and wind power when supply is high. This could improve the long-term outlook for companies involved in clean energy and grid technology.",
  30: "A schoolmate who trades full-time messages you after reading a 40-part Reddit thread supposedly written by a hedge fund insider. The thread is long, detailed, and filled with charts, jargon, and urgent warnings about an energy crisis, urging all to dump energy shares immediately.",
  31: "A friend forwards an X post warning that macro indicators are pointing toward recession and that the yield curve has been inverted for months. Yield curve inversion is a real signal that investors often associate with economic slowdowns and friend has sold all her investment.", 

  32: "EU regulators launch an antitrust probe into Orange’s exclusive app ecosystem, focusing on whether the company gives its own services an unfair advantage. They are investigating allegations of Orange’s app store and subscription ecosystem that keep users tied to its devices and generate recurring revenue beyond hardware sales. Any pressure to open up the ecosystem could affect service fees, developer relationships, and how tightly Orange controls its platform.",
  33: "A leaked internal memo suggests that Orange is facing supply chain delays for its upcoming Squeeze 15 smartphone. The memo reportedly circulated among regional sales teams after suppliers warned that key camera and chip components may arrive later than expected. Since new phone launches drive a large share of Orange’s revenue, even a short delay could affect sales momentum and investor expectations.",
  34: "Former Orange employees claim that the company is struggling with high debt and internal turmoil. The story appears to fit existing concerns about Orange’s higher borrowing costs and possible internal restructuring, which makes the claims feel more believable to investors. As the rumours spread, the stock dips on fears that financial pressure and workplace instability could affect the company’s future performance.",
  35: "A leaked render of Orange’s next headset is mocked on Reddit for looking like a toaster. The joke spreads quickly because product design is central to Orange’s brand image, and early online reactions can shape hype before launch.",
  36: "Orange announces a massive stock buyback programme, signalling that the company plans to repurchase its own shares from the market. Buybacks are often used when a company has strong cash reserves and wants to return value to shareholders. For Orange, this may reassure investors that management remains confident despite pressure from competition and product launch cycles.",
  37: "A rumour spreads after Orange’s CEO is seen meeting with executives from a rival technology company. The story gains attention because large tech mergers are rare, dramatic, and can completely reshape a company’s future. The market may still turn an ordinary meeting into merger speculation.",
  38: "A factory strike in a key manufacturing hub halts Orange production for a month. The strike reportedly began after workers demanded higher wages and safer conditions during the final production ramp-up for Orange’s next device cycle. A prolonged shutdown could delay shipments, reduce available inventory, and weaken short-term hardware sales.",
  
  39: "Dinosaur Fuel announces the discovery of a massive untapped oil reserve in the Permian Basin, one of North America’s most important oil-producing regions. A find of this scale could extend the company’s production runway and strengthen its asset base. For an energy producer, larger reserves often support future revenue potential and investor confidence.",
  40: "OPEC+ announces surprise production cuts, reducing the amount of oil supplied to global markets. When supply tightens while demand remains steady, oil prices may rise and improve margins for producers like Dinosaur Fuel. This could boost earnings if the company sells its output at higher market prices.",
  41: "An industry expert warns that Dinosaur Fuel’s pipelines, refineries, and fuel stations may become a liability as electric vehicles gain market share. Fuel infrastructure will become more expensive to maintain and may become less valuable if transport demand shifts away from petrol and diesel. Even if the transition takes time, the concern reflects a real question about how traditional energy companies should adapt.",
  42: "Political unrest in major oil-producing regions sends Dinosaur Fuel futures falling as traders worry about possible supply disruptions. Energy markets are sensitive to geopolitical instability because conflict can affect drilling, shipping routes, and production costs. If unrest continues, Dinosaur Fuel may face weaker market sentiment and higher operational uncertainty.",
  43: "Dinosaur Fuel reveals a multi-billion dollar pivot to hydrogen as part of its long-term energy transition strategy. The company plans to use its existing infrastructure, engineering expertise, and industrial customer base to enter the hydrogen market. This move could help Dinosaur Fuel reduce its reliance on fossil fuels while opening a new revenue stream.",
  44: "An activist group paints Dinosaur Fuel’s headquarters pink, and the photos spread quickly across social media. The protest gains attention because climate activism has become closely tied to public pressure on fossil fuel companies. While operations remain unaffected, the incident keeps environmental concerns around Dinosaur Fuel in the spotlight.",
  
  48: "Cola-Kola’s new zero-sugar drink becomes a viral hit among Gen Z consumers after short videos show students mixing it with coffee, and colourful ice cubes. The buzz feels meaningful because younger consumers are increasingly choosing lower-sugar drinks while still wanting fun, branded beverages.",
  49: "An expert warns that sugar tax legislation is passing in 12 more countries, putting pressure on Cola-Kola’s margins. Sugar taxes can make sweetened drinks more expensive or force beverage companies to reformulate their products. For a company with a large soft drink portfolio, wider sugar regulation could affect pricing, demand, and profitability.",
  50: "A health report highlights a new study linking Cola-Kola’s sweetener to long-term fatigue. This matters because beverage companies depend heavily on consumer trust in their ingredients, especially for zero-sugar products marketed as healthier alternatives. If the study gains attention, Cola-Kola may face questions from consumers, retailers, and health regulators.",
  51: "A conspiracy theory linking Cola-Kola’s secret recipe to aliens trends on Twitter after an old factory tour photo is edited into a viral meme. The story spreads because Cola-Kola’s recipe has always been surrounded by mystery, making it easy for people to turn secrecy into wild speculation.",
  52: "Cola-Kola announces a $2 billion acquisition to expand into the fast-growing glitter water market. This gives the company a chance to target consumers who want lighter, lower-sugar drink options. The deal could help Cola-Kola diversify beyond traditional soft drinks and strengthen its long-term product portfolio.",
  53: "A nationwide truck driver strike disrupts Cola-Kola’s distribution across North America, affecting deliveries to supermarkets, convenience stores, and restaurants. Distribution is crucial for beverage companies because products need to be widely available to maintain sales momentum. If the strike continues, Cola-Kola may face lower short-term revenue and weaker shelf presence against competitors.",
  54: "The Star News, a tabloid newspaper outlet, reports that Cola-Kola’s stock briefly stumbles after a celebrity is photographed drinking a competitor’s beverage at a major event. While one photo does not change Cola-Kola’s business, it can still create short-term chatter around brand popularity.", 

  55: "The US Food and Drug Administration, the regulator responsible for approving medicines in the United States, approves John & Johnnie’s latest medical device, allowing it to move closer to use in hospitals and surgical centres. John & Johnnie are planning to expedite the medical device production.",
  56: "John & Johnnie’s new robotic surgeon completes its first successful solo appendectomy, marking a major demonstration of its surgical automation technology. The story gains attention because robotic surgery is one of the most advanced areas in medical technology, with hospitals looking for tools that can improve consistency and reduce strain on surgeons.",
  57: "Speculation emerges that John & Johnnie may face a major recall of defective baby monitors after several parents report overheating issues online. The concern spreads quickly because baby products are closely tied to safety and trust, and even early complaints can create pressure on retailers and regulators.",
  58: "A high-profile short seller calls John & Johnnie “overvalued” during a morning talk show, arguing that investors are too optimistic about its medical technology pipeline. The claim draws attention because short sellers often profit when a stock falls, so their public comments can create sharp reactions.",
  59: "The US Food and Drug Administration issues a warning to John & Johnnie’s new consumer health line over false advertising claims. The warning suggests that some product benefits may have been marketed more strongly than the evidence supports. This could force the company to change its packaging, advertising, or product claims, while also raising questions about consumer trust.",
  60: "An anonymous Reddit post predicts that John & Johnnie is heading for bankruptcy, before being quickly deleted. This aligns with the general anxiety about the company's risky decision-making.", 
  61: "John & Johnnie reports steady growth in its skincare division. Skincare may not be as dramatic as new drugs or surgical robots, but it can provide a stable revenue stream. Consistent growth in this division helps balance the company’s more uncertain pharmaceutical and medtech businesses.",
  62: "ABCDnews, a spinoff from the reputable ABC News, claims John & Johnnie is changing the formula of its iconic baby shampoo. They explain that the new formula is cancer-causing and they did so to cut costs admist the rising fuel prices.",
  63: "John & Johnnie reach a major settlement in its talcum powder lawsuit, reducing uncertainty around one of its largest legal overhangs. With the lawsuit risk less open-ended, attention may shift back to the company’s healthcare, medtech, and consumer product divisions.", 
}
