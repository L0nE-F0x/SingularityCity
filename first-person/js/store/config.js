/* ============================================================================
   INTEGRATION CONFIG — First Person, served at /first-person/
   The 2D Pixi city is the site root, in the same deploy. Public keys below
   mirror the root index/engine (the publishable Supabase key already ships on
   singularitycity.net). No private secrets here.
   ============================================================================ */

/** @typedef {'fp' | 'map'} ViewId */

export const INTEGRATION = {
    version: 1,
    SAVE_KEY: 'sc_city_save_v1',
    LEGACY_FP_SAVE_KEY: 'sc_fp_save_v1',
    COTD_PICK_KEY: 'sc_cotd_pick_v1',
    LEGACY_COTD_PICK_KEY: 'sc_fp_cotd_pick_v1',
    NEWS_EVENTS_KEY: 'sc_news_events_v1',
    CORE_CACHE_KEY: 'sc_core_cache_v1',
    LIVE_CACHE_KEY: 'sc_fp_live_cache_v1',
    supabaseUrl: 'https://uojpqygjbxranpdvkwwz.supabase.co',
    supabaseKey: 'sb_publishable_Dm4KFmAqRuSSXkKWT04ATw_Ki8QFdZj',
    flags: {
        liveData: true,
        viewToggle: true,
        classic2dLink: true,
        hardSwapPixi: true
    },
    // Root-absolute, not relative: embed.html redirects to index.html?embed=1,
    // so the document base FP is loaded under is not always /first-person/.
    classic2dUrl: '/index.html',
    resumeKey: 'sc_view_resume_v1',
    productionSiteUrl: 'https://singularitycity.net/',
    newsFeeds: [
        { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch' },
        { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge' },
        { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat' },
        { url: 'https://arstechnica.com/tag/ai/feed/', source: 'Ars Technica' }
    ],
    labKeywords: {
        openai: ['openai', 'chatgpt', 'gpt-', 'sora', 'o1', 'o3'],
        anthropic: ['anthropic', 'claude'],
        google: ['google', 'deepmind', 'gemini', 'gemma', 'alphafold'],
        meta: ['meta', 'llama', 'pytorch'],
        mistral: ['mistral', 'mixtral', 'codestral'],
        xai: ['xai', 'grok', 'x.ai'],
        deepseek: ['deepseek']
    }
};

export function flagEnabled(name) {
    try {
        const ls = localStorage.getItem('sc_flag_' + name);
        if (ls === '0' || ls === 'false') return false;
        if (ls === '1' || ls === 'true') return true;
    } catch (_) { /* ignore */ }
    const params = typeof location !== 'undefined'
        ? new URLSearchParams(location.search)
        : null;
    if (params) {
        const v = params.get(name) ?? params.get('flag_' + name);
        if (v === '0' || v === 'false') return false;
        if (v === '1' || v === 'true') return true;
    }
    return !!INTEGRATION.flags[name];
}

