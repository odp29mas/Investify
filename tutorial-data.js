// ═════════════════════════════════════════════════ SELF-GUIDED TUTORIAL ═══════════════════════════════════════════════════
// Tutorial step structure:
// - `el`: the target element's `id` in `index.html` under `<body>`: This tells the tutorial engine which element to highlight. 
// - `type: 'auto'`: shows information and advances on Next
// - `type: 'action'`: waits for the required user action before advancing
//
// Used by the tutorial engine in `marketsim.js` (showTutStep, nextTutorial, checkTutorialAction).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════


const tutSteps = [
  { type:'auto',   el:'headerPanel',   title:'👋 Welcome to the Gamified Investment Platform!', 
    text:'You start with <b>$10,000 cash</b> and receive <b>$10,000 every year</b>.<br><br><b>Your goal</b>: build wealth over 20 years through investing.' },

  { type:'auto',   el:'marketPanel',   title:'🏪 The Marketplace',
    text:'Browse assets across <b>4 categories</b>: Shares, Sector ETFs, Bonds, and Index Funds.' },

  { type:'auto',   el:'card-ORI',      title:'🏪 Asset Card',
    text: 'Each asset card shows:<br><br>' +
      '• <b>Asset details</b>: its sector, name, and short code.<br>' +
      '• <b>Asset Performance</b>: its current price, 1-year price change and 1-year sparkline.<br>' +
      '• <b>Your holdings</b>: how many units you own.<br>' +
      '• <b>Actions</b>: use Buy or Sell to place trades.'},

  { type:'action', el:'card-ORI',      title:'🔍 Explore an Asset',
    text:'Click on the <b>asset name</b> (e.g. Orange Inc.) to view more details.',
    action:'open-detail', hint:'👆 Click the asset name to open details...' },

  { type:'auto',   el:'marketPanel',   title:'💰 Buy & Sell',
    text:'Set a quantity to <b>Buy / Sell</b>. Try to <br><br>diversify across <b>Asset Class</b> (e.g., Shares and Bonds) and <b>Sectors</b> (e.g., F&B, Energy).</br></br>' },

  { type:'action', el:'marketPanel',   title:'🛒 Try Buying Now!',
    text:'Buy 1 unit of any asset.',
    action:'buy', hint:'👆 Click a green Buy button...' },

  { type:'auto', el:'sectorstrategy', title:'📊 Portfolio & Diversification',
    text: 'The bar and donut chart shows how well-spread your portfolio is — aim for a balanced mix.<br><br>' +
          '<div style="margin-top:10px;font-size:11px;line-height:1.6;">' +
            '<div style="display:flex;justify-content:space-between;"><span>Single Type</span><span style="color:#e74c3c;font-weight:700;">15</span></div>' +
            '<div style="background:#eee;height:6px;border-radius:3px;margin-bottom:6px;overflow:hidden;"><div style="width:15%;height:100%;background:#e74c3c;"></div></div>' +
            '<div style="display:flex;justify-content:space-between;"><span>Concentrated</span><span style="color:#e74c3c;font-weight:700;">30</span></div>' +
            '<div style="background:#eee;height:6px;border-radius:3px;margin-bottom:6px;overflow:hidden;"><div style="width:30%;height:100%;background:#e74c3c;"></div></div>' +
            '<div style="display:flex;justify-content:space-between;"><span>Moderate</span><span style="color:#f39c12;font-weight:700;">55</span></div>' +
            '<div style="background:#eee;height:6px;border-radius:3px;margin-bottom:6px;overflow:hidden;"><div style="width:55%;height:100%;background:#f39c12;"></div></div>' +
            '<div style="display:flex;justify-content:space-between;"><span>Well Spread</span><span style="color:#27ae60;font-weight:700;">100</span></div>' +
            '<div style="background:#eee;height:6px;border-radius:3px;overflow:hidden;"><div style="width:100%;height:100%;background:#27ae60;"></div></div>' +
          '</div>'},

  { type: 'action', el:'sectorstrategy', title: '🔍 View Asset Class and Sector Diversification',
    text: 'Toggle between <b>Asset Class</b> and <b>Sector</b> views',
    action: 'portfolio-tab', hint: '👆 Switch between Asset Class and Sectors...'},

  { type:'auto',   el:'scorecard',      title:'📈 Two Performance Scores',
    text:'<b>Discipline</b> — resist fake news. <br><b>Diversity</b> — balanced types & sectors over time.</br><br>These determine your final grade!</br>' },

  { type:'auto',   el:'newsPanel',      title:'📰 Market New',
  text:'News comes from <b>official reports</b>, <b>analysts</b>, and <b>social media</b>.<br><br><b>Past News</b> to revisit news from prior years.</br></br>'},

  { type:'action',   el:'newsPanel',      title:'📰 Read News Critically!',
    text:'Click any news headline to read the full article.',
    action:'open-news', hint:'👆 Click a headline in Market News...' },

  { type:'auto',   el:'holdingsPanel',  title:'📋 Holdings & History',
    text:'Click here to see all your owned assets and full transaction log.' },

  { type:'auto',   el:'pendingPanel',   title:"🔄 This Year's Trades",
    text:'After buying assets, the assets will be "pending" in your portfolio for the current year. Feel free to explore and try different strategies.<br><br> Holdings are only finalised once you click <b>Advance Year</b>.' },

  { type:'auto',   el:null,             title:"🎉 You're Ready!",
    text:'Now, let`s try to beat the <b>Mattress Method</b> ($210k). Good luck! 🚀',
    center:true }
];
