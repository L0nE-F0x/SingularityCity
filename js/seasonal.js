/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SEASONAL EVENTS (v1.0.0)
   Date-driven event system for holidays, festivals, and seasonal overlays
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Seasonal = {

    _eventsVisited: {},   // persisted set of event IDs the player has witnessed

    EVENTS: [
        { id: 'winter_holiday', name: 'Winter Holidays',   icon: '🎄', startMonth: 12, startDay: 15, endMonth: 1,  endDay: 2,  chat: ['Happy holidays!', 'Who wants hot cocoa? ☕', 'Jingle bells, jingle bells!', 'Best time of year 🎅', 'Love the fairy lights!', 'Secret Santa time!', 'New year, new weights!'] },
        { id: 'halloween',      name: 'Halloween',         icon: '🎃', startMonth: 10, startDay: 25, endMonth: 10, endDay: 31, chat: ['Trick or treat! 🍬', 'Boo! Scared ya!', 'Nice costume!', 'Spooky vibes 👻', 'My loss function is TERRIFYING', 'Who\'s that ghost model?', 'Pumpkin spice everything'] },
        { id: 'cherry_blossom', name: 'Cherry Blossom',    icon: '🌸', startMonth: 4,  startDay: 1,  endMonth: 4,  endDay: 30, chat: ['The blossoms are beautiful!', 'Spring training season 🌱', 'Fresh gradients in the air', 'Hanami picnic anyone?', 'New season, new parameters'] },
        { id: 'new_year',       name: 'New Year',          icon: '🎆', startMonth: 12, startDay: 31, endMonth: 1,  endDay: 1,  chat: ['Happy New Year! 🎉', '3... 2... 1... LAUNCH!', 'New year, new benchmarks!', 'Resolution: beat GPT-5', 'What a year for AI!'] },
        { id: 'july_4',         name: 'Independence Day',  icon: '🎇', startMonth: 7,  startDay: 4,  endMonth: 7,  endDay: 4,  chat: ['Happy 4th! 🇺🇸', 'Fireworks time!', 'Freedom to compute!', 'Stars and stripes and GPUs'] },
        { id: 'easter',         name: 'Easter',            icon: '🐣', startMonth: 0,  startDay: 0,  endMonth: 0,  endDay: 0,  chat: ['Happy Easter! 🐰', 'Found an Easter egg!', 'Egg hunt in Pine Reserve!', 'Spring is here!', 'Chocolate inference 🍫'] },
        { id: 'lunar_new_year', name: 'Lunar New Year',    icon: '🧧', startMonth: 0,  startDay: 0,  endMonth: 0,  endDay: 0,  chat: ['Happy Lunar New Year! 🐉', 'Gong xi fa cai!', 'Red envelopes for everyone!', 'Dragon dance time!', 'Year of the AI 🧧'] },
    ],

    init() {
        // Compute Easter date for current year (Anonymous Gregorian algorithm)
        this._computeEaster();
        this._computeLunarNewYear();
    },

    _computeEaster() {
        const y = new Date().getFullYear();
        const a = y % 19, b = Math.floor(y / 100), c = y % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        const ev = this.EVENTS.find(e => e.id === 'easter');
        if (ev) {
            ev.startMonth = month; ev.startDay = day - 1;  // Sat before
            ev.endMonth = month;   ev.endDay = day + 1;    // Mon after
        }
    },

    _computeLunarNewYear() {
        // Approximate Lunar New Year dates for upcoming years
        const lny = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3] };
        const y = new Date().getFullYear();
        const dates = lny[y] || [2, 1]; // fallback Feb 1
        const ev = this.EVENTS.find(e => e.id === 'lunar_new_year');
        if (ev) {
            ev.startMonth = dates[0]; ev.startDay = dates[1];
            ev.endMonth = dates[0];   ev.endDay = dates[1] + 2; // 3 day festival
        }
    },

    getActiveEvents() {
        const now = new Date();
        const m = now.getMonth() + 1, d = now.getDate();
        const active = [];
        for (const ev of this.EVENTS) {
            if (ev.startMonth === 0) continue; // uncomputed
            if (this._isDateInRange(m, d, ev.startMonth, ev.startDay, ev.endMonth, ev.endDay)) {
                active.push(ev);
                // Track for achievement
                if (!this._eventsVisited[ev.id]) {
                    this._eventsVisited[ev.id] = true;
                    const count = Object.keys(this._eventsVisited).length;
                    if (count >= 3 && typeof G !== 'undefined') G.unlockAchieve('holiday_spirit');
                }
            }
        }
        return active;
    },

    getActiveEvent() {
        const evts = this.getActiveEvents();
        return evts.length > 0 ? evts[0] : null;
    },

    isActive(eventId) {
        return this.getActiveEvents().some(e => e.id === eventId);
    },

    hasFireworks() {
        return this.isActive('new_year') || this.isActive('july_4');
    },

    isWinter() {
        return this.isActive('winter_holiday');
    },

    isHalloween() {
        return this.isActive('halloween');
    },

    getSeasonalChat() {
        const evts = this.getActiveEvents();
        if (evts.length === 0) return null;
        const ev = evts[Math.floor(Math.random() * evts.length)];
        return ev.chat[Math.floor(Math.random() * ev.chat.length)];
    },

    _isDateInRange(m, d, sm, sd, em, ed) {
        // Handle wrap-around (e.g., Dec 15 → Jan 2)
        if (sm <= em) {
            // Same year range
            if (m < sm || m > em) return false;
            if (m === sm && d < sd) return false;
            if (m === em && d > ed) return false;
            return true;
        } else {
            // Wraps around year boundary
            if (m > em && m < sm) return false;
            if (m === sm && d < sd) return false;
            if (m === em && d > ed) return false;
            return true;
        }
    }
};
