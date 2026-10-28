/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CAMERA LAYER (v9.5.5 - Horizontal Scroll Panning & Y-Axis Expanded Deep Strata)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */
const Camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    zoom: 0.8,
    targetZoom: 0.8,
    defaultZoom: 0.8, // the pixel-art skin raises all three to 1 (js/pixel/pixel_art.js)
    isDragging: false,
    lastX: 0,
    lastY: 0,
    // Inertia/momentum state
    _velX: 0,
    _velY: 0,
    _lastMoveTime: 0,
    _momentumX: 0,
    _momentumY: 0,
    _friction: 0.9,
    // Double-tap zoom detection
    _lastTapTime: 0,
    _lastTapX: 0,
    _lastTapY: 0,
    // Phone held upright (see _fitOrientation)
    _portrait: false,
    _landscapeZoom: null,
    _cx: null, // world x at the screen centre last frame — kept across a rotation
    _sheetOpen: false,
    _sheetPrevY: null,
    _dragSinceSheet: false,

    init() {
        const vp = document.getElementById('viewport');
        vp.addEventListener('pointerdown', this.onDown.bind(this));
        window.addEventListener('pointermove', this.onMove.bind(this));
        window.addEventListener('pointerup', this.onUp.bind(this));
        vp.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        // Desktop-only zoom buttons (pill to the left of minimap)
        this._buildZoomButtons();

        // Mobile pinch-to-zoom
        this._pinchDist = 0;
        vp.addEventListener(
            'touchstart',
            (e) => {
                if (e.touches.length === 2) {
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    this._pinchDist = Math.sqrt(dx * dx + dy * dy);
                }
            },
            { passive: true }
        );
        vp.addEventListener(
            'touchmove',
            (e) => {
                if (e.touches.length === 2) {
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (this._pinchDist > 0) {
                        const scale = dist / this._pinchDist;
                        this.targetZoom = Math.max(0.5, Math.min(3, this.targetZoom * scale));
                    }
                    this._pinchDist = dist;
                    e.preventDefault();
                }
            },
            { passive: false }
        );
        vp.addEventListener(
            'touchend',
            () => {
                this._pinchDist = 0;
            },
            { passive: true }
        );

        // ─── Default underground view ─────────────────────────────────────
        // Show the underground metro tunnel, water pipes, and the orange
        // electric/sewer pipes beneath the city when the app first loads.
        // Users can pan up to see the city/sky normally — this just makes
        // the underground infrastructure visible by default instead of
        // hidden off-screen.
        //
        // Anchor the orange electric pipe (its bottom edge sits at gy+247)
        // just above the news ticker so the pipes are the lowest visible
        // feature. Solving for screen_y(gy+247) = vpH - tickerH:
        //   targetY = (vpH - tickerH) / zoom - (groundY + 247)
        // The ~31 world-px between the pipe and the canvas bottom gets
        // hidden by the ticker overlay, so there's no visible black void.
        if (typeof G !== 'undefined' && G.groundY) {
            const z = this.targetZoom;
            const tickerH = 25; // approx news ticker height in screen px
            const orangePipeBottom = G.groundY + 247;
            const undergroundY = (G.vpH - tickerH) / z - orangePipeBottom;
            this.targetY = undergroundY;
            this.y = undergroundY;
        }

        // A phone held upright gets its own zoom and framing; turning it swaps.
        this._fitOrientation(true);
        window.addEventListener('resize', () => this._fitOrientation(false));
    },

    // ─── Phones held upright ──────────────────────────────────────────
    // Portrait shows ~390 world px across. At the landscape zoom that is two
    // HQs and 20-px robots, with the underground filling the bottom half.
    // Upright, zoom in to ~280 world px across and stand the street a little
    // below the middle, so a 3-floor HQ, its robots and the tunnel all read.
    // Landscape keeps the original zoom and the underground opening view.
    _isPortraitPhone() {
        return !!window.isMobile && window.innerHeight > window.innerWidth;
    },

    // Whole canvas pixels per art pixel. The renderer runs at min(dpr, 1.5)
    // (engine.js), so on a phone the pixel-exact zoom step is 1/3, not 1/2.
    _portraitZoom() {
        const res = (G.app && G.app.renderer && G.app.renderer.resolution) || 1;
        const art = (typeof PL !== 'undefined' && PL.ART) || 2;
        const step = 1 / (art * res);
        const want = window.innerWidth / 280;
        return Math.min(2, Math.max(1, Math.round(want / step) * step));
    },

    // Screen offset the world is drawn with after a viewport-height change
    // (groundY is fixed at init; see update()).
    _vpComp(vpH) {
        return vpH - 56 - G.groundY;
    },

    // Camera y that puts the ground line at `frac` of the screen height.
    _groundAtY(frac, z, vpH) {
        return (frac * vpH - this._vpComp(vpH)) / z - G.groundY;
    },

    // Camera y of the opening view: the orange pipe (gy+247) just above the ticker.
    _undergroundY(z, vpH) {
        return (vpH - 25 - this._vpComp(vpH)) / z - (G.groundY + 247);
    },

    _fitOrientation(initial) {
        if (typeof G === 'undefined' || !G.groundY) return;
        const portrait = this._isPortraitPhone();
        if (this._landscapeZoom === null) this._landscapeZoom = this.defaultZoom;
        if (!initial && portrait === this._portrait) return;
        this._portrait = portrait;
        if (initial && !portrait) return; // landscape opening view is already set
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        const z = portrait ? this._portraitZoom() : this._landscapeZoom;
        // Keep the same street under the middle of the screen across a turn.
        const cx = initial || this._cx === null ? -this.x + vpW / (2 * this.zoom) : this._cx;
        this.defaultZoom = z;
        this.zoom = this.targetZoom = z;
        this.x = this.targetX = -cx + vpW / (2 * z);
        this.y = this.targetY = portrait ? this._groundAtY(0.6, z, vpH) : this._undergroundY(z, vpH);
        this._momentumX = this._momentumY = 0;
        this._sheetOpen = false;
        this._sheetPrevY = null;
    },

    // Where the info panel's top edge comes to rest. It slides in on `bottom`,
    // so read its height rather than its (still moving) top.
    _sheetTop() {
        if (!this._panelEl) this._panelEl = document.getElementById('infoPanel');
        const p = this._panelEl;
        if (!p || !p.classList.contains('open')) return null;
        const h = p.getBoundingClientRect().height;
        return h > 40 ? window.innerHeight - h : null;
    },

    // Upright, the info panel is a bottom sheet over the lower half. Lift the
    // street to just above it while it is open (the tapped robot stays in
    // view) and put it back on close unless the view was dragged meanwhile.
    _followSheet() {
        if (!this._portrait || G.activeInterior || G.trainFocus) return;
        const top = this._sheetTop();
        if (top !== null && !this._sheetOpen) {
            this._sheetOpen = true;
            this._dragSinceSheet = false;
            this._sheetPrevY = this.targetY;
            if (!G.tracking) {
                const frac = Math.max(0.3, (top - 34) / G.vpH);
                this.targetY = this._groundAtY(frac, this.targetZoom, G.vpH);
            }
        } else if (top === null && this._sheetOpen) {
            this._sheetOpen = false;
            if (!this._dragSinceSheet && !G.tracking && this._sheetPrevY !== null)
                this.targetY = this._sheetPrevY;
            this._sheetPrevY = null;
        }
    },

    // Where a followed entity sits vertically: 60% down, or just above the
    // bottom sheet when one is open on a phone held upright.
    _focusFrac() {
        if (this._portrait && this._sheetOpen) {
            const top = this._sheetTop();
            if (top !== null) return Math.max(0.3, (top - 34) / G.vpH);
        }
        return 0.6;
    },

    onDown(e) {
        if (e.target.closest('.ctrls-scroll') || e.target.closest('.ov')) return;
        if (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus)) return;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) return;

        // Double-tap zoom detection
        const now = performance.now();
        if (
            now - this._lastTapTime < 300 &&
            Math.abs(e.clientX - this._lastTapX) < 30 &&
            Math.abs(e.clientY - this._lastTapY) < 30
        ) {
            if (this._portrait) {
                // Upright the default is already ~1.33, so toggle default ↔ 2× default.
                const zIn = Math.min(3, this.defaultZoom * 2);
                this.targetZoom = this.targetZoom < (this.defaultZoom + zIn) / 2 ? zIn : this.defaultZoom;
            } else {
                this.targetZoom = this.targetZoom < 1.5 ? 2.0 : 1.0;
            }
            this._lastTapTime = 0;
            this._momentumX = 0;
            this._momentumY = 0;
            return;
        }
        this._lastTapTime = now;
        this._lastTapX = e.clientX;
        this._lastTapY = e.clientY;

        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this._lastMoveTime = now;
        this._momentumX = 0;
        this._momentumY = 0;
        const vpEl = document.getElementById('viewport');
        if (vpEl) vpEl.classList.add('dragging');
        // Manual camera drag cancels tracking
        if (typeof G !== 'undefined' && G.tracking) {
            G.stopTracking();
        }
    },

    onMove(e) {
        if (!this.isDragging) return;
        if (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus)) return;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) return;

        const now = performance.now();
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.targetX += dx / this.zoom;
        this.targetY += dy / this.zoom;
        if (Math.abs(dx) + Math.abs(dy) > 2) this._dragSinceSheet = true;

        // Track velocity for inertia on release
        const dt = now - this._lastMoveTime;
        if (dt > 0 && dt < 100) {
            const factor = (16.67 / dt) * 0.6;
            this._velX = (dx / this.zoom) * factor;
            this._velY = (dy / this.zoom) * factor;
        }

        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this._lastMoveTime = now;
    },

    onUp() {
        if (this.isDragging && (Math.abs(this._velX) > 0.5 || Math.abs(this._velY) > 0.5)) {
            this._momentumX = this._velX;
            this._momentumY = this._velY;
        }
        this.isDragging = false;
        this._velX = 0;
        this._velY = 0;
        const vpEl = document.getElementById('viewport');
        if (vpEl) vpEl.classList.remove('dragging');
    },

    onWheel(e) {
        if (e.target.closest('.ctrls-scroll') || e.target.closest('.ov')) return;
        if (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus)) return;
        // Block wheel input while in orbit mode
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) {
            e.preventDefault();
            return;
        }

        e.preventDefault();
        this.targetX -= e.deltaY * 0.5;
    },

    update() {
        if (typeof G === 'undefined') return;

        // ─── Zoom pill visibility ───
        if (G.tick % 15 === 0) this._updateZoomPill();

        // ─── INERTIA: apply momentum from drag release ───
        if (!this.isDragging && (Math.abs(this._momentumX) > 0.1 || Math.abs(this._momentumY) > 0.1)) {
            this.targetX += this._momentumX;
            this.targetY += this._momentumY;
            this._momentumX *= this._friction;
            this._momentumY *= this._friction;
            if (Math.abs(this._momentumX) < 0.1) this._momentumX = 0;
            if (Math.abs(this._momentumY) < 0.1) this._momentumY = 0;
        }

        // ─── TRACKING MODE: override camera position to follow entity ───
        // Runs even during interiors so the camera target stays in sync for
        // seamless fade-transitions when the tracked entity enters/exits buildings.
        if (G.tracking) {
            let entityX = null;
            let entityY = null;

            if (G.tracking.type === 'model') {
                const refs = G.charRefs[G.tracking.id];
                if (refs && refs.c) {
                    entityX = refs.c.x;
                    entityY = refs.c.y;
                }
            } else if (G.tracking.type === 'ceo') {
                const ceo = G.ceoRefs ? G.ceoRefs[G.tracking.lab] : null;
                if (ceo) {
                    const heli =
                        typeof Entities !== 'undefined' && Entities.heliRefs
                            ? Entities.heliRefs[G.tracking.lab]
                            : null;
                    const heliActive = heli && heli.state !== 'hidden';

                    if (heliActive && heli.cont && heli.cont.visible) {
                        // Helicopter is flying/landing/taking off — follow it
                        entityX = heli.cont.x;
                        entityY = heli.cont.y;
                    } else if (heliActive && !heli.cont.visible) {
                        // Helicopter grounded (hidden inside building) — follow building position
                        const bld = ceo.bld ? G.bldById[ceo.bld] : null;
                        if (bld) {
                            entityX = bld.x + bld.w / 2;
                            entityY = G.groundY;
                        } else {
                            entityX = heli.logicalX;
                            entityY = heli.logicalY;
                        }
                    } else {
                        // No helicopter — follow car/walking position
                        entityX = ceo.logicalX;
                        entityY = G.groundY + 20;
                    }
                }
            } else if (G.tracking.type === 'npc') {
                const cm =
                    typeof NPCHousing !== 'undefined' &&
                    NPCHousing.commuters.find((c) => c.npc.id === G.tracking.id);
                if (cm) {
                    if (cm.c.visible) {
                        entityX = cm.c.x;
                        entityY = cm.c.y;
                    } else if (cm.bld) {
                        const bld = G.bldById[cm.bld];
                        if (bld) {
                            entityX = bld.x + bld.w / 2;
                            entityY = G.groundY;
                        }
                    }
                }
            } else if (G.tracking.type === 'vendor') {
                const vm =
                    typeof StreetVendors !== 'undefined' &&
                    StreetVendors.vendors.find((v) => v.def.id === G.tracking.id);
                if (vm) {
                    if (vm.c.visible) {
                        entityX = vm.c.x;
                        entityY = vm.c.y;
                    } else if (vm.bld) {
                        const bld = G.bldById[vm.bld];
                        if (bld) {
                            entityX = bld.x + bld.w / 2;
                            entityY = G.groundY;
                        }
                    }
                }
            } else if (G.tracking.type === 'vc_commuter') {
                const cm =
                    typeof VCRow !== 'undefined' &&
                    VCRow.carCommuters.find((c) => c.npc.id === G.tracking.id);
                if (cm) {
                    if (cm.carCont.visible) {
                        entityX = cm.carCont.x;
                        entityY = cm.carCont.y;
                    } else if (cm.bld) {
                        const bld = G.bldById[cm.bld];
                        if (bld) {
                            entityX = bld.x + bld.w / 2;
                            entityY = G.groundY;
                        }
                    }
                }
            }

            if (entityX !== null) {
                this.targetX = -entityX + G.vpW / 2 / this.zoom;
                // Center entity vertically: offset so entityY lands at ~60% down the screen
                // (just above the bottom sheet on a phone held upright)
                this.targetY = -entityY + (G.vpH * this._focusFrac()) / this.zoom;
                this.targetZoom = 1.3;
            }
        }

        if (this._portrait && G.tick % 6 === 0) this._followSheet();

        // ─── TRAIN FOCUS: "boarded" a train — zoom in and follow it through the
        //     real world. Frames the car at ~62% down so the real city above it
        //     (and the tunnel/pipes below) stay in view, going past as it moves. ───
        if (G.trainFocus && typeof Entities !== 'undefined' && Entities[G.trainFocus]) {
            const t = Entities[G.trainFocus];
            this.targetZoom =
                typeof InteriorTrain !== 'undefined' && InteriorTrain.ZOOM ? InteriorTrain.ZOOM : 2.0;
            const fx = t.x;
            const fy = G.groundY + 120; // tunnelY — the train's world centre
            this.targetX = -fx + G.vpW / 2 / this.zoom;
            this.targetY = -fy + (G.vpH * 0.62) / this.zoom;
        }

        // Cache maxBldHeight — only recalculate every 300 frames (~5s)
        if (!this._maxBldH || G.tick % 300 === 0) {
            this._maxBldH = 0;
            if (typeof BLDS !== 'undefined') {
                for (let i = 0; i < BLDS.length; i++) {
                    const h = (BLDS[i].dynamicFl || 3) * 45;
                    if (h > this._maxBldH) this._maxBldH = h;
                }
            }
        }
        let maxBldHeight = this._maxBldH;

        const groundAnchor = G.groundY * (1 / this.targetZoom - 1);

        // ─── CAMERA LOCK UPDATE ───
        // Lower bound (most-negative targetY = camera looking deepest down):
        // hard-clamp to the orange electric pipe (gy+247) sitting just above
        // the news ticker. Anything past that is empty deep earth — no reason
        // to let users drag the camera into a black void.
        // Solving: screen_y(gy+247) = vpH - tickerH
        //   minY = (vpH - tickerH - vpComp) / zoom - (groundY + 247)
        // vpComp (see below) is 0 until the viewport height changes after init —
        // e.g. turning a phone — and must be taken out or the pipes fall off-screen.
        const tickerH = 25;
        let minY = (G.vpH - tickerH - this._vpComp(G.vpH)) / this.targetZoom - (G.groundY + 247);
        // A bottom sheet hides the lower screen: the street may rise above it.
        if (this._sheetOpen) minY = Math.min(minY, this._groundAtY(0.3, this.targetZoom, G.vpH));

        let maxY = groundAnchor;
        const visibleHeight = G.vpH / this.targetZoom;

        if (maxBldHeight > visibleHeight - 100) {
            maxY = groundAnchor + (maxBldHeight - visibleHeight + 150);
        }

        // Clamp camera boundaries (skip during tracking / train focus — the
        // followed entity's position takes priority over city-edge limits)
        if (!G.tracking && !G.trainFocus) {
            this.targetY = Math.max(minY, Math.min(this.targetY, maxY));
        }

        const minX = -G.cityW + G.vpW / this.zoom;
        const maxX = 0;

        if (!G.tracking && !G.trainFocus) {
            this.targetX = Math.max(minX, Math.min(this.targetX, maxX));
        }

        // Very slow, cinematic lerp during Auto-Tour — every transition (scenic pan,
        // zoom-in to tracked entity, zoom-out afterwards) should glide over ~4 seconds
        // so the tour feels like a screensaver drift, not a slideshow.
        const _cinematic = typeof AutoTour !== 'undefined' && AutoTour.active;
        const _zoomLerp = _cinematic ? 0.01 : 0.08;
        // Follow the boarded train tightly so it stays near-centred while the city
        // scrolls past (a looser lerp lets a moving train drift off-screen).
        const _xyLerp = _cinematic ? 0.015 : G.trainFocus ? 0.32 : 0.12;
        this.zoom += (this.targetZoom - this.zoom) * _zoomLerp;
        this.x += (this.targetX - this.x) * _xyLerp;
        this.y += (this.targetY - this.y) * _xyLerp;

        if (!G.tracking && !G.trainFocus) {
            if (this.x < minX) {
                this.x = minX;
            }
            if (this.x > maxX) {
                this.x = maxX;
            }
        }

        if (G.world) {
            G.world.scale.set(this.zoom);
            G.world.x = this.x * this.zoom;
            // Viewport compensation: groundY was set at init and never changes.
            // When viewport height changes, offset world.y to keep ground at bottom.
            const vpCompensation = G.vpH - 56 - G.groundY;
            G.world.y = this.y * this.zoom + vpCompensation;

            // Store for external use (minimap, etc)
            this._vpCompensation = vpCompensation;
        }
        this._cx = -this.x + G.vpW / (2 * this.zoom);
    },

    /* ── Desktop-only horizontal zoom ± pill (left of minimap) ─ */
    _buildZoomButtons() {
        // Skip on mobile / narrow screens — pinch-to-zoom handles it
        if (window.innerWidth < 769) return;

        const pill = document.createElement('div');
        pill.id = 'zoomPill';
        pill.style.cssText = [
            'position:fixed',
            'bottom:44px',
            'right:100px',
            'z-index:100',
            'display:flex',
            'flex-direction:row',
            'align-items:center',
            'border-radius:10px',
            'overflow:hidden',
            'background:rgba(6,6,16,0.92)',
            'border:1px solid var(--bd,#1e293b)',
            'box-shadow:0 2px 12px rgba(0,0,0,0.4)',
            'backdrop-filter:blur(6px)',
            '-webkit-backdrop-filter:blur(6px)',
            'pointer-events:all',
            'user-select:none',
            'transition:right 0.3s ease',
        ].join(';');

        const mkBtn = (label, delta) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.style.cssText = [
                'width:22px',
                'height:20px',
                'background:transparent',
                'border:none',
                'color:#8ba4b8',
                'font-family:"JetBrains Mono",monospace',
                'font-size:13px',
                'font-weight:bold',
                'cursor:pointer',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'transition:color 0.15s,background 0.15s',
                'line-height:1',
                'padding:0',
            ].join(';');
            b.addEventListener('mouseenter', () => {
                b.style.color = '#fff';
                b.style.background = 'rgba(255,255,255,0.08)';
            });
            b.addEventListener('mouseleave', () => {
                b.style.color = '#8ba4b8';
                b.style.background = 'transparent';
            });

            let holdTimer = null;
            const step = () => {
                this.targetZoom = Math.max(0.5, Math.min(3, this.targetZoom + delta));
            };
            const startHold = () => {
                step();
                holdTimer = setInterval(step, 100);
            };
            const stopHold = () => {
                if (holdTimer) {
                    clearInterval(holdTimer);
                    holdTimer = null;
                }
            };
            b.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                startHold();
            });
            b.addEventListener('pointerup', stopHold);
            b.addEventListener('pointerleave', stopHold);
            return b;
        };

        const zoomOut = mkBtn('−', -0.1);
        const sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:12px;background:var(--bd,#1e293b);';
        const zoomIn = mkBtn('+', 0.1);

        pill.appendChild(zoomOut);
        pill.appendChild(sep);
        pill.appendChild(zoomIn);
        document.body.appendChild(pill);

        this._zoomPill = pill;
    },

    /** Called from engine.update() or self — hide pill when inappropriate */
    _updateZoomPill() {
        if (!this._zoomPill) return;
        const hide =
            (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus || G.viewMode === 'macro')) ||
            (typeof OrbitMode !== 'undefined' && OrbitMode.active) ||
            (typeof XRayMode !== 'undefined' && XRayMode.active);
        this._zoomPill.style.display = hide ? 'none' : 'flex';
        if (!hide) {
            // Stick to the left edge of the minimap (gap 6px). Width is measured
            // because the phone map is wider than the desktop 290px panel.
            const mm = document.getElementById('minimap');
            if (!mm) return;
            const rect = mm.getBoundingClientRect();
            this._zoomPill.style.right = Math.round(window.innerWidth - rect.left + 6) + 'px';
            this._zoomPill.style.visibility = rect.left < 72 ? 'hidden' : '';
        }
    },
};
