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

        // Pine Reserve, Silicon Woods, Frontier Pines. One outdoor ground, not a stack of floors.
        _isForest(m) {
            const id = m && m.bld && m.bld.id;
            return id === 'forest_0' || id === 'forest_1' || id === 'forest_space';
        },

        _content(m, layer) {
            const sc = m && m.scene && !m.scene.destroyed ? m.scene : layer;
            const r = sc.getBounds(); // screen space, layer still at identity
            const W = G.vpW;
            const H = G.vpH;
            let x0 = Math.max(r.x, -W * 0.5);
            let x1 = Math.min(r.x + r.width, W * 1.5);
            if (m && m.bldW && typeof m.startX === 'number' && m.scene) {
                const s = m.scene.scale ? m.scene.scale.x : 1;
                if (this._isForest(m)) {
                    // The soil is the whole view. The building pads are empty sky,
                    // and panning into them opened a gap on either side of the ground.
                    x0 = m.scene.x + m.startX * s;
                    x1 = x0 + m.bldW * s;
                } else {
                    x0 = m.scene.x + m.startX * s - 30;
                    x1 = x0 + m.bldW * s + 60;
                }
            }
            const y0 = Math.max(r.y, -H * 4);
            const y1 = Math.min(r.y + r.height, H + 420);
            return { x0: x0, x1: x1, y0: y0, y1: y1 };
        },

        // A diorama frame from the interior manager (js/interior_manager.js): the building's
        // span and its vertical extent in scene px. Returns the layer-space box to fit.
        _frameBox(m, layer) {
            const f = m && m.frame;
            const sc = m && m.scene;
            if (!f || !sc || sc.destroyed) return null;
            const s = sc.scale ? sc.scale.x : 1;
            const X = (v) => sc.x + v * s;
            const Y = (v) => sc.y + v * s;
            // A full-width scene keeps the old horizontal fit; only the vertical comes from the frame.
            let bx0, bx1;
            if (f.wide) {
                const c = this._content(m, layer);
                bx0 = c.x0;
                bx1 = c.x1;
            } else {
                bx0 = X(f.x0);
                bx1 = X(f.x1);
            }
            // Some sky above the roof, so the cutaway stands in the street instead of being
            // cut off at the toolbar.
            const top = Y(f.top - 70);
            const bottom = Y(f.bottom);
            let fy0 = Y(f.top - 30);
            let fy1 = f.ground !== null ? Y(f.ground + 86 + 100) : bottom;
            if (f.focus) {
                fy0 = Y(f.focus.y0);
                fy1 = Y(f.focus.y1);
            }
            return {
                x0: f.wide ? bx0 : bx0 - 40,
                x1: f.wide ? bx1 : bx1 + 40,
                bx0: bx0,
                bx1: bx1,
                y0: top,
                y1: Math.max(bottom, top + 10),
                fy0: fy0,
                fy1: fy1,
                ground: f.ground !== null ? Y(f.ground) : null,
                framed: true,
                wide: !!f.wide,
            };
        },

        begin(m, layer) {
            this.end();
            this._lockY = false;
            this._tyLock = 0;
            if (!layer || !G.app) return;
            this.layer = layer;
            this.mod = m;
            const W = G.vpW;
            const H = G.vpH;
            const fb = this._frameBox(m, layer);
            const b = (this.b = fb || this._content(m, layer));
            const cw = Math.max(200, b.x1 - b.x0);
            // Pixel-exact: art px (PL.ART screen px at zoom 1) × z must be whole.
            const step = 1 / PL.ART;
            const minZ = W < 700 ? 1 : 1.5;
            let z;
            if (fb && !fb.wide) {
                // The building takes about three quarters of the screen width.
                z = Math.floor((W * 0.74) / (fb.bx1 - fb.bx0) / step) * step;
            } else {
                z = Math.floor((W - 24) / cw / step) * step;
            }
            z = PL.clamp(z, minZ, W < 700 ? 2 : 3);
            // A phone held upright fits most interiors at 1, but the module rests them
            // on the street with the sky above. Keep the framing and panning at 1 there.
            if (z <= 1.001 && W >= H) {
                this.layer = null;
                return;
            }
            this.z = z;
            // Street level (where the module rests its ground floor) stays put on screen.
            const anchorX = (b.x0 + b.x1) / 2;
            const anchorY = H - 56;
            this.tx = this.x = Math.round(W / 2 - anchorX * z);
            this.ty = this.y = Math.round(anchorY - anchorY * z + 40);
            if (fb) {
                // Open on the building: roof to basement if that fits, else the street at the
                // lower third with the floors stacked above it.
                const top = 64;
                const bot = H - 24;
                if ((fb.fy1 - fb.fy0) * z <= bot - top) {
                    this.ty = this.y = Math.round((top + bot) / 2 - ((fb.fy0 + fb.fy1) / 2) * z);
                } else if (fb.ground !== null && !(m.frame && m.frame.focus)) {
                    this.ty = this.y = Math.round(H * 0.72 - fb.ground * z);
                } else {
                    this.ty = this.y = Math.round(top + 10 - fb.fy0 * z);
                }
                this._tyOpen = this.ty;
            } else this._tyOpen = null;
            // Forests have no floors above the ground. The building anchor assumes
            // a street at the bottom of a tall stack and the clamp then hauls the
            // tree line up to the toolbar, leaving a black pit under the grass.
            // Hold the ground on the row the forest module already chose.
            if (this._isForest(m) && typeof m._forestGroundScreen === 'number') {
                const gY = m._forestGroundScreen;
                this._lockY = true;
                this._tyLock = Math.round(gY * (1 - z));
                this.ty = this.y = this._tyLock;
            }
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
                if (!this._lockY) this.ty = this.drag.y + (e.clientY - this.drag.cy0);
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
            if (b.framed) {
                // A framed cutaway scrolls from a little sky above its roof down to the end
                // of its strata. When all of that fits on screen it stays where it opened.
                const lo = bot - b.y1 * z;
                const hi = top - b.y0 * z;
                if (lo <= hi) this.ty = PL.clamp(this.ty, lo, hi);
                else this.ty = PL.clamp(typeof this._tyOpen === 'number' ? this._tyOpen : this.ty, hi, lo);
                return;
            }
            // Forests: vertical pan stays locked. The soil is drawn to the bottom
            // of the screen, so there is nothing under the ground to scroll to.
            if (this._lockY) {
                this.ty = this._tyLock;
                return;
            }
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
            this._lockY = false;
            this._tyLock = 0;
        },
    });
    void Z;
})();
