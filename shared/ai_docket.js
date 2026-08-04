/* ════════════════════════════════════════════════════════════════════════════
   SHARED — the real AI legal docket and regulation themes.

   THIS IS THE SOURCE OF TRUTH for what the AI Court is hearing in both views.

   A note on randomness, because it matters here: the 2D app *does* pick which
   model is summoned and which theme is argued at random. That is fine — it is
   choosing among REAL cases. What First Person did wrong was inventing the
   cases themselves ('alignment audit', 'compute export license', 'agent
   liability' — none of which are real proceedings) and trying them against a
   random citizen. Random selection from a real pool: correct. Random
   generation of the pool: the bug.

   Keep DOCKET entries sourced and dated. They are real proceedings and they
   move — Bartz v. Anthropic went from "pending final approval" to "settled"
   when the judge entered judgment, and the copy here changed with it.

   ESM so First Person imports it natively. The 2D app is classic scripts and
   still carries its own copy in js/court.js; switching it over is a follow-up.
   ════════════════════════════════════════════════════════════════════════════ */

/** Real 2026 AI legal docket — landmark cases and laws. */
export const DOCKET = [
    {
        case: 'NYT v. OpenAI & Microsoft',
        status: 'in discovery',
        color: '#ef4444',
        parties: ['openai', 'microsoft'],
        note: 'Jun 25, 2026: NYT moved for a 3rd amended complaint, narrowing claims against OpenAI but escalating against Microsoft — alleges MS built a custom supercomputer to enable the infringing training.'
    },
    {
        case: 'Bartz v. Anthropic',
        status: 'settled — $1.5B approved',
        color: '#22c55e',
        parties: ['anthropic'],
        note: 'Jul 20, 2026: Judge Martínez-Olguín granted final approval, entered judgment and dismissed with prejudice — the largest copyright settlement in US history for pirated training books, ~$3,000 per work.'
    },
    {
        case: 'Getty Images v. Stability AI',
        status: 'appeal pending',
        color: '#a855f7',
        parties: ['stability'],
        note: 'UK High Court ruled model weights aren\'t "infringing copies"; Getty granted leave to appeal; US case refiled in N.D. Cal.'
    },
    {
        case: 'California SB 53 (TFAIA)',
        status: 'in force Jan 1, 2026',
        color: '#22c55e',
        parties: [],
        note: 'First US frontier-AI law: mandatory safety disclosures + incident reporting within 15 days; up to $1M/violation.'
    },
    {
        case: 'EU AI Act — Digital Omnibus',
        status: 'adopted Jun 29, 2026',
        color: '#3b82f6',
        parties: [],
        note: 'Council formally adopted the Digital Omnibus easing AI Act burdens — high-risk deadlines pushed to Dec 2027/Aug 2028; a new EU-wide ban on AI "nudification"/CSAM tools takes effect Dec 2026.'
    },
    {
        case: 'Concord/UMG v. Suno & Udio',
        status: 'ongoing',
        color: '#ec4899',
        parties: [],
        note: "The music industry's copyright fight against generative-audio models."
    }
];

/** Real regulatory subjects, used when no live headline is available. */
export const REGULATION_THEMES = [
    'SB 53 Frontier-AI Transparency',
    'Copyright & Training-Data Consent',
    'The 20M ChatGPT-Log Discovery Order',
    'EU AI Act GPAI Compliance',
    'Deepfake & NO FAKES Act',
    'Safety-Incident Disclosure (15-day)',
    'Compute Export Controls',
    'Autonomous Weapons Ban',
    'Election Integrity Safeguards',
    'Open-Weight Model Licensing',
    'Child Safety Compliance',
    'Chatbot Liability & Duty of Care'
];

const REG_RE = /\b(regulat|senate|congress|lawsuit|court|sue[sd]?|copyright|antitrust|ban|act|bill|ruling|settle|judge|compliance|probe|investigat)/i;

/** Headlines that are actually about regulation, for use as a hearing subject. */
export function regulationHeadlines(news) {
    if (!Array.isArray(news)) return [];
    return news.filter(n => n && REG_RE.test(n.headline || n.title || ''));
}

/**
 * Pick what the chamber is arguing.
 * Prefers a live regulation headline (same preference order as the 2D app),
 * falling back to a real theme. Never invents a subject.
 */
export function pickHearingTheme(news, rand = Math.random) {
    const live = regulationHeadlines(news);
    if (live.length) {
        const n = live[Math.floor(rand() * live.length)];
        return { theme: n.headline || n.title, url: n.url || null, live: true };
    }
    return {
        theme: REGULATION_THEMES[Math.floor(rand() * REGULATION_THEMES.length)],
        url: null,
        live: false
    };
}

/**
 * Pick a real case from the docket. `preferLab` biases toward a case the given
 * lab is actually a party to, so a summoned model is tried for something it is
 * genuinely involved in rather than an unrelated proceeding.
 */
export function pickCase(preferLab, rand = Math.random) {
    if (preferLab) {
        const own = DOCKET.filter(d => d.parties && d.parties.includes(preferLab));
        if (own.length) return own[Math.floor(rand() * own.length)];
    }
    return DOCKET[Math.floor(rand() * DOCKET.length)];
}
