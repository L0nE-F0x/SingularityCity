/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CAMERA LAYER (v9.5.5 - Horizontal Scroll Panning & Y-Axis Expanded Deep Strata)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */
const Camera = {
    x: 0, 
    y: 0, 
    targetX: 0, 
    targetY: 0, 
    zoom: 1, 
    targetZoom: 1,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    // Inertia/momentum state
    _velX: 0, _velY: 0, _lastMoveTime: 0,
    _momentumX: 0, _momentumY: 0, _friction: 0.90,
    // Double-tap zoom detection
    _lastTapTime: 0, _lastTapX: 0, _lastTapY: 0,

    init() {
        const vp = document.getElementById('viewport');
        vp.addEventListener('pointerdown', this.onDown.bind(this));
        window.addEventListener('pointermove', this.onMove.bind(this));
        window.addEventListener('pointerup', this.onUp.bind(this));
        vp.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        
        // Mobile pinch-to-zoom
        this._pinchDist = 0;
        vp.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                this._pinchDist = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: true });
        vp.addEventListener('touchmove', (e) => {
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
        }, { passive: false });
        vp.addEventListener('touchend', () => { this._pinchDist = 0; }, { passive: true });
    },

    onDown(e) {
        if (e.target.closest('.ctrls-scroll') || e.target.closest('.ov')) return;
        if (typeof G !== 'undefined' && G.activeInterior) return;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) return;

        // Double-tap zoom detection
        const now = performance.now();
        if (now - this._lastTapTime < 300 &&
            Math.abs(e.clientX - this._lastTapX) < 30 &&
            Math.abs(e.clientY - this._lastTapY) < 30) {
            this.targetZoom = this.targetZoom < 1.5 ? 2.0 : 1.0;
            this._lastTapTime = 0;
            this._momentumX = 0; this._momentumY = 0;
            return;
        }
        this._lastTapTime = now;
        this._lastTapX = e.clientX;
        this._lastTapY = e.clientY;

        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this._lastMoveTime = now;
        this._momentumX = 0; this._momentumY = 0;
        const vpEl = document.getElementById('viewport');
        if (vpEl) vpEl.classList.add('dragging');
        // Manual camera drag cancels tracking
        if (typeof G !== 'undefined' && G.tracking) {
            G.stopTracking();
        }
    },

    onMove(e) {
        if(!this.isDragging) return;
        if (typeof G !== 'undefined' && G.activeInterior) return;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) return;

        const now = performance.now();
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.targetX += dx / this.zoom;
        this.targetY += dy / this.zoom;

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
        this._velX = 0; this._velY = 0;
        const vpEl = document.getElementById('viewport');
        if (vpEl) vpEl.classList.remove('dragging');
    },

    onWheel(e) {
        if (e.target.closest('.ctrls-scroll') || e.target.closest('.ov')) return;
        if (typeof G !== 'undefined' && G.activeInterior) return;
        // Block wheel input while in orbit mode
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) { e.preventDefault(); return; }

        e.preventDefault();
        this.targetX -= e.deltaY * 0.5;
    },

    update() {
        if (typeof G === 'undefined') return;

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
        if (G.tracking && !G.activeInterior) {
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
                    const heli = (typeof Entities !== 'undefined' && Entities.heliRefs) ? Entities.heliRefs[G.tracking.lab] : null;
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
                const cm = typeof NPCHousing !== 'undefined' && NPCHousing.commuters.find(c => c.npc.id === G.tracking.id);
                if (cm) {
                    if (cm.c.visible) {
                        entityX = cm.c.x;
                        entityY = cm.c.y;
                    } else if (cm.bld) {
                        const bld = G.bldById[cm.bld];
                        if (bld) { entityX = bld.x + bld.w / 2; entityY = G.groundY; }
                    }
                }
            } else if (G.tracking.type === 'vendor') {
                const vm = typeof StreetVendors !== 'undefined' && StreetVendors.vendors.find(v => v.def.id === G.tracking.id);
                if (vm) {
                    if (vm.c.visible) {
                        entityX = vm.c.x;
                        entityY = vm.c.y;
                    } else if (vm.bld) {
                        const bld = G.bldById[vm.bld];
                        if (bld) { entityX = bld.x + bld.w / 2; entityY = G.groundY; }
                    }
                }
            } else if (G.tracking.type === 'vc_commuter') {
                const cm = typeof VCRow !== 'undefined' && VCRow.carCommuters.find(c => c.npc.id === G.tracking.id);
                if (cm) {
                    if (cm.carCont.visible) {
                        entityX = cm.carCont.x;
                        entityY = cm.carCont.y;
                    } else if (cm.bld) {
                        const bld = G.bldById[cm.bld];
                        if (bld) { entityX = bld.x + bld.w / 2; entityY = G.groundY; }
                    }
                }
            }
            
            if (entityX !== null) {
                this.targetX = -(entityX) + (G.vpW / 2) / this.zoom;
                // Center entity vertically: offset so entityY lands at ~60% down the screen
                this.targetY = -(entityY) + (G.vpH * 0.6) / this.zoom;
                this.targetZoom = 1.3;
            }
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
        const minY = groundAnchor - 260; 
        
        let maxY = groundAnchor;
        const visibleHeight = G.vpH / this.targetZoom;
        
        if (maxBldHeight > visibleHeight - 100) { 
            maxY = groundAnchor + (maxBldHeight - visibleHeight + 150);
        }
        
        // Clamp camera boundaries (skip during tracking — entity position takes priority)
        if (!G.tracking || G.activeInterior) {
            // Detect upward pull at sky boundary → trigger Orbit Mode
            // Only register when user is actively dragging upward (not momentum/interpolation)
            if (this.targetY < minY && this.isDragging && this._velY > 2 && typeof OrbitMode !== 'undefined' && !OrbitMode.active && !G.activeInterior) {
                OrbitMode.registerPull();
            }
            this.targetY = Math.max(minY, Math.min(this.targetY, maxY));
        }
        
        const minX = -G.cityW + G.vpW / this.zoom;
        const maxX = 0; 
        
        if (!G.tracking || G.activeInterior) {
            this.targetX = Math.max(minX, Math.min(this.targetX, maxX));
        }
        
        this.zoom += (this.targetZoom - this.zoom) * 0.08;
        this.x += (this.targetX - this.x) * 0.12;
        this.y += (this.targetY - this.y) * 0.12;
        
        if (!G.tracking) {
            if (this.x < minX) { this.x = minX; }
            if (this.x > maxX) { this.x = maxX; }
        }
        
        if (G.world) {
            G.world.scale.set(this.zoom);
            G.world.x = this.x * this.zoom;
            // Viewport compensation: groundY was set at init and never changes.
            // When viewport height changes, offset world.y to keep ground at bottom.
            const vpCompensation = (G.vpH - 56) - G.groundY;
            G.world.y = this.y * this.zoom + vpCompensation;
            
            // Store for external use (minimap, etc)
            this._vpCompensation = vpCompensation;
        }
    }
};
