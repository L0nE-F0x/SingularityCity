/* Pixel art — interiors open zoomed in. Every interior module still builds its scene exactly
   as before (same layout, same floors, same logic); this scales the whole interior layer by
   a pixel-exact factor (one art pixel = a whole number of screen pixels), keeps the street
   level where the module put it, and owns scrolling: drag or wheel pans up through the
   floors and sideways across wide buildings, within the building's bounds. The module's
   own vertical drag is pinned (minY = maxY) so the two don't fight. Tracking an avatar
   (Interior._updateInteriorCamera) eases the zoom back to 1 and lets the module's follow
   camera work as before. Only with the pixel skin. */
(function () {
    'use strict';
    const PL = window.PL;

    const Z = (PL.InteriorZoom = {
        layer: null,
        mod: null,
        z: 1,
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        drag: null,
        b: null,

        _content(m, layer) {
            const sc = m && m.scene && !m.scene.destroyed ? m.scene : layer;
            const r = sc.getBounds(); // screen space, layer still at identity
            const W = G.vpW;
            const H = G.vpH;
            let x0 = Math.max(r.x, -W * 0.5);
            let x1 = Math.min(r.x + r.width, W * 1.5);
            if (m && m.bldW && typeof m.startX === 'number' && m.scene) {
                const s = m.scene.scale ? m.scene.scale.x : 1;
                x0 = m.scene.x + m.startX * s - 30;
                x1 = x0 + m.bldW * s + 60;
            }
            const y0 = Math.max(r.y, -H * 4);
            const y1 = Math.min(r.y + r.height, H + 420);
            return { x0: x0, x1: x1, y0: y0, y1: y1 };
        },

        begin(m, layer) {
            this.end();
            if (!layer || !G.app) return;
            this.layer = layer;
            this.mod = m;
            const W = G.vpW;
            const H = G.vpH;
            const b = (this.b = this._content(m, layer));
            const cw = Math.max(200, b.x1 - b.x0);
            // Pixel-exact: art px (PL.ART screen px at zoom 1) × z must be whole.
            const step = 1 / PL.ART;
            const fit = (W - 24) / cw;
            let z = Math.floor(fit / step) * step;
            const minZ = W < 700 ? 1 : 1.5;
            z = PL.clamp(z, minZ, W < 700 ? 2 : 3);
            if (z <= 1.001) {
                this.layer = null;
                return;
            }
            this.z = z;
            // Street level (where the module rests its ground floor) stays put on screen.
            const anchorX = (b.x0 + b.x1) / 2;
            const anchorY = H - 56;
            this.tx = this.x = Math.round(W / 2 - anchorX * z);
            this.ty = this.y = Math.round(anchorY - anchorY * z + 40);
            this._clamp();
            this.x = this.tx;
            this.y = this.ty;
            layer.scale.set(z);
            layer.position.set(this.x, this.y);
            // Pin the module's own vertical drag.
            if (m && typeof m.minY === 'number' && m.scene) {
                m.minY = m.maxY = m.scene.y;
            }
            this._down = (e) => {
                if (!this.layer) return;
                this.drag = { sx: e.global.x, sy: e.global.y, x: this.tx, y: this.ty };
                this.layer.cursor = 'grabbing';
            };
            this._move = (e) => {
                if (!this.drag) return;
                this.tx = this.drag.x + (e.clientX - this.drag.cx0);
                this.ty = this.drag.y + (e.clientY - this.drag.cy0);
                this._clamp();
            };
            this._wmove = (e) => {
                if (!this.drag) return;
                if (this.drag.cx0 === undefined) {
                    this.drag.cx0 = e.clientX;
                    this.drag.cy0 = e.clientY;
                }
                this._move(e);
            };
            this._up = () => {
                this.drag = null;
                if (this.layer) this.layer.cursor = 'grab';
            };
            this._wheel = (e) => {
                if (!this.layer || !this.layer.visible) return;
                if (e.target && e.target.tagName !== 'CANVAS') return;
                this.ty -= e.deltaY * 0.9;
                this.tx -= e.deltaX * 0.9;
                this._clamp();
                e.preventDefault();
            };
            layer.eventMode = 'static';
            layer.cursor = 'grab';
            layer.on('pointerdown', this._down);
            window.addEventListener('pointermove', this._wmove);
            window.addEventListener('pointerup', this._up);
            window.addEventListener('wheel', this._wheel, { passive: false });
        },

        _clamp() {
            const b = this.b;
            const z = this.z;
            const W = G.vpW;
            const H = G.vpH;
            const top = 64; // below the toolbar
            const bot = H - 24;
            const cw = (b.x1 - b.x0) * z;
            const ch = (b.y1 - b.y0) * z;
            if (cw <= W) this.tx = Math.round((W - cw) / 2 - b.x0 * z);
            else this.tx = PL.clamp(this.tx, W - 12 - b.x1 * z, 12 - b.x0 * z);
            if (ch <= bot - top) this.ty = Math.round((top + bot - ch) / 2 - b.y0 * z);
            else this.ty = PL.clamp(this.ty, bot - b.y1 * z, top - b.y0 * z);
        },

        update() {
            const L = this.layer;
            if (!L || L.destroyed) return;
            // Following an avatar: ease back to 1 and let the module's camera work.
            const want = G.tracking ? 1 : this.z;
            const s = L.scale.x + (want - L.scale.x) * 0.15;
            L.scale.set(Math.abs(s - want) < 0.002 ? want : s);
            if (G.tracking) {
                L.x += (0 - L.x) * 0.15;
                L.y += (0 - L.y) * 0.15;
                return;
            }
            this.x += (this.tx - this.x) * 0.25;
            this.y += (this.ty - this.y) * 0.25;
            // Whole screen pixels, so the art grid never shimmers.
            L.x = Math.round(this.x);
            L.y = Math.round(this.y);
        },

        end() {
            if (this._wmove) window.removeEventListener('pointermove', this._wmove);
            if (this._up) window.removeEventListener('pointerup', this._up);
            if (this._wheel) window.removeEventListener('wheel', this._wheel);
            this._wmove = this._up = this._wheel = null;
            const L = this.layer;
            if (L && !L.destroyed) {
                if (this._down) L.off('pointerdown', this._down);
                L.scale.set(1);
                L.position.set(0, 0);
            }
            this.layer = null;
            this.mod = null;
            this.drag = null;
        },
    });
    void Z;
})();
