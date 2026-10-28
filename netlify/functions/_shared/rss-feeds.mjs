// The only feeds /api/rss will fetch. Every URL js/api.js reads through the
// RSS proxy must be listed here, exactly as the client sends it — the function
// is an allowlisted fetcher, never an open proxy.
//
// serve.py reads this file too (it pulls the quoted https URLs out with a regex),
// so local playtests and production share one list.
export const RSS_FEEDS = [
    // Live news ticker (API.fetchLiveNews) + AI events calendar (API.fetchAIEvents)
    'https://techcrunch.com/category/artificial-intelligence/feed/',
    'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    'https://venturebeat.com/category/ai/feed/',
    'https://arstechnica.com/tag/ai/feed/',
    // VC deal flow (API.fetchVCDealsRSS)
    'https://techcrunch.com/category/venture/feed/',
    'https://venturebeat.com/category/business/feed/',
    // Supply-chain news (API.fetchSupplyChainNews)
    'https://www.tomshardware.com/feeds/all',
    'https://wccftech.com/feed/',
    // Backbone cloud status (API.fetchNetworkStatus)
    'https://status.aws.amazon.com/rss/all.rss',
    'https://status.cloud.google.com/feed.atom',
];
