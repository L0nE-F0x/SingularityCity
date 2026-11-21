/* ══════════════════════════════════════════════════════════════════════════
   FIRST-PERSON CONTROLLER — pointer lock, WASD, sprint, jump, AABB collision
   with axis-separated sliding, accel/friction, head-bob, land dip, coyote jump.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, EYE_H, WALK_SPEED, SPRINT_SPEED, PLAYER_RADIUS, GRAVITY, JUMP_VEL, SEA_X, CITY_W, CITY_D } from './state.js';
import { City, KERB_H } from './city.js';
import { Interior } from './interior.js';
import { Touch } from './touch.js';

// Feel constants (units/s and 1/s rates). Tuned for ~150 walk / ~320 sprint.
const ACCEL_GROUND = 18;       // approach wish-speed
const ACCEL_AIR = 4.5;         // limited air strafe
const FRICTION = 14;           // stop rate when no input on ground
const STOP_SPEED = 12;         // snap-to-zero under this horizontal speed
const COYOTE_T = 0.11;         // jump shortly after leaving ledge
const JUMP_BUFFER_T = 0.12;    // press jump slightly early
const LAND_DIP_MAX = 2.4;      // max spring compression on heavy landing
const BOB_WALK = 9.2;          // phase speed multiplier at walk
const BOB_AMP_Y = 0.55;
const BOB_AMP_X = 0.32;
const BOB_PITCH = 0.012;
const GRID_CELL = 128;         // spatial hash bucket size for O(1) AABB lookup

export const Player = {
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    grounded: true,
    keys: {},
    locked: false,
    bobPhase: 0, bobAmp: 0,
    stepAcc: 0,
    enabled: false,
    spawn: { x: 200, z: 300 },   // Public Square, near the Visitor Monument side
    // Logical eye position (no bob / land cosmetics) — physics source of truth
    eyeY: EYE_H,
    // Analog move axes, -1..1. The touch stick writes these; the keyboard adds
    // into them each frame. Keeping one axis pair means walk speed, sprint and
    // collision never have to ask which device is driving.
    moveX: 0, moveZ: 0,
    touchSprint: false,
    _coyote: 0,
    _jumpBuf: 0,
    _landDip: 0,
    _dipPos: 0,
    _dipVel: 0,
    _jumpPitch: 0,
    _fovAdd: 0,
    _roll: 0,
    _lastYaw: 0,
    _kerbOffset: 0,
    _grid: null,
    _gridSrc: null,
    _gridLen: -1,
    _seen: new Set(),
    _colRes: { x: 0, z: 0 },

    /* Is the controller live? Desktop answers "is the pointer locked"; touch
       has no pointer lock at all, and gating on it is exactly why the city
       stood still on a phone. */
    get inputActive() { return this.locked || G.touchMode === true; },

    init() {
        const p = G.bldById['visitor_monument'];
        if (p) this.spawn = { x: p.worldX + 120, z: p.worldZ + 140 };

        document.addEventListener('keydown', e => {
            if (G.panelOpen) return;
            this.keys[e.code] = true;
            if (e.code === 'Space' && this.inputActive) {
                e.preventDefault();
                this._jumpBuf = JUMP_BUFFER_T;
            }
        });
        document.addEventListener('keyup', e => { this.keys[e.code] = false; });
        window.addEventListener('blur', () => { this.keys = {}; });

        document.addEventListener('mousemove', e => {
            // Look stays live in the lift / metro even though walk is locked
            if (!this.locked) return;
            if (!this.enabled && !G.flyMode && !G.ridingMetro && !Interior.riding()) return;
            this.look(e.movementX, e.movementY);
        });

        // Click the world to recapture the mouse — the convention every FPS
        // has. Without it the only way back from a lost lock was the pause
        // menu, and a stray click on the canvas did nothing at all.
        G.canvas.addEventListener('mousedown', () => {
            if (G.touchMode) return;   // a tap must never try to grab a cursor
            // Free-fly keeps pointer lock for mouse look; allow re-capture after ESC
            if (G.started && !G.panelOpen && !G.paused && !G.tourMode && !this.locked) this.lock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === G.canvas;
            if (G.touchMode) return;   // never had a lock to lose
            if (!this.locked && G.started && !G.panelOpen && !G.tourMode && !G.flyMode) {
                if (G._suppressPauseOnUnlock) {
                    G._suppressPauseOnUnlock = false;
                    return;
                }
                // released without a panel — treat as pause (ESC frees the mouse)
                G.ui.showPause();
            }
        });
    },

    /* One place that turns a look delta into yaw/pitch, whatever produced it:
       mouse movementX/Y, a touch drag, or a gamepad stick later. Callers scale
       their own device gain before calling in. */
    look(dx, dy) {
        const s = 0.0021 * (G.settings.sensitivity || 1);
        this.yaw -= dx * s;
        this.pitch -= dy * s * (G.settings.invertY ? -1 : 1);
        // freecam can look almost straight down/up for aerial framing
        const maxPitch = G.flyMode ? 1.55 : 1.45;
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    },

    /* Buffered jump request — the touch button and the Space key both land
       here rather than poking `_jumpBuf`, so the coyote/buffer window stays
       one implementation. */
    jump() {
        if (!this.inputActive) return;
        this._jumpBuf = JUMP_BUFFER_T;
    },

    lock() {
        try { G.audio?.resume?.(); } catch (_) {}
        // Touch devices have no pointer lock. Calling it anyway logs a
        // NotAllowedError on every panel close.
        if (G.touchMode) return;
        if (!G.canvas || document.pointerLockElement === G.canvas) return;
        // Autostart / no-gesture paths must never throw NotAllowedError into the console.
        const tryLock = (opts) => {
            try {
                const req = G.canvas.requestPointerLock;
                if (typeof req !== 'function') return null;
                const p = opts ? req.call(G.canvas, opts) : req.call(G.canvas);
                if (p && typeof p.then === 'function') {
                    p.then(() => {}).catch(() => {});
                }
                return p;
            } catch (_) {
                return null;
            }
        };
        // Prefer raw mouse input; fall back if the browser rejects the option bag.
        const p = tryLock({ unadjustedMovement: true });
        if (p && typeof p.then === 'function') {
            p.catch(() => { tryLock(); });
        } else if (p == null) {
            tryLock();
        }
    },
    unlock() {
        try { G.audio?.resume?.(); } catch (_) {}
        try {
            if (document.pointerLockElement) document.exitPointerLock();
        } catch (_) { /* ignore */ }
    },

    teleport(x, z, yaw) {
        this.eyeY = G.floorY + EYE_H;
        G.camera.position.set(x, this.eyeY, z);
        if (yaw !== undefined) this.yaw = yaw;
        this._lastYaw = this.yaw;
        this.vel.set(0, 0, 0);
        this._landDip = 0;
        this._dipPos = 0;
        this._dipVel = 0;
        this._jumpPitch = 0;
        this._roll = 0;
        this._kerbOffset = this._targetKerb(x, z);
        this._coyote = 0;
        this._jumpBuf = 0;
        this.bobAmp = 0;
        this.grounded = true;
    },

    placeAtSpawn() { this.teleport(this.spawn.x, this.spawn.z, Math.PI * 0.75); },

    update(dt) {
        if (G.tourMode || G.orbitMode || G.terminalOpen) return;
        // Free-fly owns position; still apply mouse-look rotation each frame
        if (G.flyMode) {
            G.camera.rotation.order = 'YXZ';
            G.camera.rotation.y = this.yaw;
            G.camera.rotation.x = this.pitch;
            G.camera.rotation.z = 0;
            return;
        }
        // Metro / lift ride: look only — the ride owns position each frame
        if (G.ridingMetro || Interior.riding()) {
            G.camera.rotation.order = 'YXZ';
            G.camera.rotation.y = this.yaw;
            G.camera.rotation.x = this.pitch;
            G.camera.rotation.z = 0;
            return;
        }
        if (!this.enabled) return;
        const cam = G.camera;
        // Cap huge hitches so accel integrators don't fling the player
        if (dt > 0.05) dt = 0.05;

        // Touch stick writes moveX/moveZ; on desktop they stay zero.
        if (G.touchMode) Touch.apply(this);
        else { this.moveX = 0; this.moveZ = 0; }

        const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchSprint;
        const maxSpeed = sprint ? SPRINT_SPEED : WALK_SPEED;

        let fx = this.moveX, fz = this.moveZ;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) fz += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) fz -= 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) fx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) fx += 1;

        /* Clamp rather than normalise. Normalising forced every input to full
           speed, which is right for a key (diagonals must not be faster) and
           wrong for a stick (a half push must be a half walk). Clamping does
           both: keyboard diagonals come in at √2 and get scaled back to 1,
           a stick at 0.4 stays at 0.4. */
        let mag = Math.hypot(fx, fz);
        if (mag > 1) { fx /= mag; fz /= mag; mag = 1; }

        const hasInput = mag > 0.001 && this.inputActive;
        let wishX = 0, wishZ = 0;
        if (hasInput) {
            const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
            wishX = (fx * cos - fz * sin) * maxSpeed;
            wishZ = (-fz * cos - fx * sin) * maxSpeed;
        }

        // Accelerate toward wish velocity (smooth start/stop — not instant set)
        const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;
        if (hasInput) {
            this.vel.x += (wishX - this.vel.x) * Math.min(1, accel * dt);
            this.vel.z += (wishZ - this.vel.z) * Math.min(1, accel * dt);
        } else if (this.grounded) {
            const fr = Math.max(0, 1 - FRICTION * dt);
            this.vel.x *= fr;
            this.vel.z *= fr;
            if (Math.hypot(this.vel.x, this.vel.z) < STOP_SPEED) {
                this.vel.x = 0;
                this.vel.z = 0;
            }
        } else {
            // light air drag so you don't slide forever after a sprint-jump
            this.vel.x *= Math.max(0, 1 - dt * 0.6);
            this.vel.z *= Math.max(0, 1 - dt * 0.6);
        }

        // gravity on logical eye height (bob never feeds back into physics)
        this.vel.y -= GRAVITY * dt;

        // coyote + buffered jump
        if (this.grounded) this._coyote = COYOTE_T;
        else this._coyote = Math.max(0, this._coyote - dt);
        this._jumpBuf = Math.max(0, this._jumpBuf - dt);

        const wantJump = this._jumpBuf > 0 || this.keys['Space'];
        if (wantJump && this._coyote > 0 && this.inputActive) {
            // Indoor rooms are 3.2 m; the outdoor jump is 5.7 m and went
            // through the ceiling into the hidden-city void.
            this.vel.y = G.inside ? 120 : JUMP_VEL;
            this.grounded = false;
            this._coyote = 0;
            this._jumpBuf = 0;
            this._jumpPitch = 0.024;
            G.audio?.sfx('jump');
        }

        // integrate + circle-vs-AABB spatial-hash sliding collision
        let nx = cam.position.x + this.vel.x * dt;
        let nz = cam.position.z + this.vel.z * dt;
        let ny = this.eyeY + this.vel.y * dt;
        const floor = G.floorY + EYE_H;

        const resolved = this._resolveCollisions(nx, nz);
        nx = resolved.x;
        nz = resolved.z;

        if (G.inside && G.ceilY != null && ny > G.ceilY) {
            ny = G.ceilY;
            if (this.vel.y > 0) this.vel.y = 0;
        }

        const surface = this._surfaceAt(nx, nz);
        const targetKerb = this._targetKerb(nx, nz);
        this._kerbOffset += (targetKerb - this._kerbOffset) * Math.min(1, dt * 16);

        // feet on the floor -> zero fall velocity, critically-damped landing spring
        if (ny <= floor) {
            if (!this.grounded && this.vel.y < -40) {
                const impact = Math.min(1, (-this.vel.y - 40) / 420);
                this._dipVel += (18 + impact * 34);
                G.audio?.sfx('land', { intensity: impact, surface });
            }
            ny = floor;
            this.vel.y = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
        this.eyeY = ny;

        // world bounds (sea to the west, hills elsewhere) — indoors the walls
        // are the bounds, so skip the city clamp
        if (!G.inside) {
            nx = Math.max(SEA_X - 60, Math.min(CITY_W / 2 + 480, nx));
            nz = Math.max(-CITY_D / 2 - 480, Math.min(CITY_D / 2 + 480, nz));
        }

        // Keep horizontal speed bounded after collision deflection
        const maxPlanar = sprint ? SPRINT_SPEED : WALK_SPEED;
        const pMag = Math.hypot(this.vel.x, this.vel.z);
        if (pMag > maxPlanar * 1.05 && this.grounded) {
            const k = maxPlanar / pMag;
            this.vel.x *= k;
            this.vel.z *= k;
        }

        // head bob + spring land settle + idle breath (pure cosmetics on top of eyeY)
        const hSpeed = Math.hypot(this.vel.x, this.vel.z);
        if (this.grounded && hSpeed > 18 && this.inputActive) {
            const pace = hSpeed / WALK_SPEED;
            this.bobPhase += dt * pace * BOB_WALK * (sprint ? 1.22 : 1);
            this.bobAmp = Math.min(1, this.bobAmp + dt * 7);
            this.stepAcc += hSpeed * dt;
            const stepLen = sprint ? 52 : 40;
            if (this.stepAcc > stepLen) {
                this.stepAcc = 0;
                G.audio?.sfx(sprint ? 'step_run' : 'step', { surface });
            }
        } else {
            this.bobAmp = Math.max(0, this.bobAmp - dt * 8);
            if (this.grounded) this.stepAcc = 0;
        }

        // Critically damped spring (omega = 18 rad/s)
        const omega = 18;
        const springF = -omega * omega * this._dipPos - 2 * omega * this._dipVel;
        this._dipVel += springF * dt;
        this._dipPos = Math.max(-0.4, Math.min(LAND_DIP_MAX, this._dipPos + this._dipVel * dt));
        this._landDip = Math.max(0, this._dipPos);

        this._jumpPitch *= Math.exp(-dt * 11);

        // Sprint FOV punch (subtle & responsive, respects user base FOV setting)
        const speedNorm = Math.max(0, Math.min(1, (hSpeed - WALK_SPEED) / (SPRINT_SPEED - WALK_SPEED)));
        const targetFovAdd = (sprint && hSpeed > WALK_SPEED * 1.1 && this.inputActive) ? 5.5 * speedNorm : 0;
        this._fovAdd += (targetFovAdd - this._fovAdd) * Math.min(1, dt * 8.5);
        const wantFov = (G.settings?.fov || 70) + this._fovAdd;
        if (Math.abs(cam.fov - wantFov) > 0.03) {
            cam.fov = wantFov;
            cam.updateProjectionMatrix();
        }

        // Strafe & turn camera roll banking
        const cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw);
        const latSpeed = this.vel.x * cosY - this.vel.z * sinY;
        let dyaw = this.yaw - this._lastYaw;
        if (dyaw > Math.PI) dyaw -= Math.PI * 2;
        if (dyaw < -Math.PI) dyaw += Math.PI * 2;
        this._lastYaw = this.yaw;
        const yawRate = Math.max(-3, Math.min(3, dyaw / Math.max(0.001, dt)));
        const targetRoll = -(latSpeed / SPRINT_SPEED) * 0.015 + yawRate * 0.003;
        this._roll += (targetRoll - this._roll) * Math.min(1, dt * 10);

        // Idle subtle breathing when still on foot
        const stillFactor = (this.grounded && hSpeed < 10) ? Math.max(0, 1 - hSpeed / 10) : 0;
        const breathY = Math.sin((G.time || 0) * 1.45) * 0.14 * stillFactor;
        const breathPitch = Math.cos((G.time || 0) * 1.45) * 0.0016 * stillFactor;

        const bobY = Math.sin(this.bobPhase * 2) * BOB_AMP_Y * this.bobAmp;
        const bobX = Math.cos(this.bobPhase) * BOB_AMP_X * this.bobAmp;
        const bobPitch = Math.sin(this.bobPhase * 2) * BOB_PITCH * this.bobAmp;

        cam.position.set(nx, this.eyeY + this._kerbOffset + bobY * 0.4 + breathY - this._landDip, nz);

        cam.rotation.order = 'YXZ';
        cam.rotation.y = this.yaw;
        cam.rotation.x = this.pitch + bobPitch + this._jumpPitch + breathPitch;
        cam.rotation.z = this._roll + bobX * 0.012;
    },

    _targetKerb(x, z) {
        if (G.inside) return 0;
        return (!City.onCarriageway(x, z) && City.onSidewalk(x, z)) ? KERB_H : 0;
    },

    _surfaceAt(x, z) {
        if (G.inside) return 'indoor';
        if (x < SEA_X + 60) return 'sand';
        const road = City.onCarriageway(x, z);
        const walk = !road && City.onSidewalk(x, z);
        if ((G.wetness?.wetness || 0) > 0.35 && (road || walk)) return 'wet';
        if (road) return 'asphalt';
        if (walk) return 'pavement';
        const d = G.districtAt?.(x, z);
        const dn = (d?.name || d?.id || '').toLowerCase();
        if (/park|woods|pine|garden|green|rural/.test(dn)) return 'grass';
        return 'pavement';
    },

    _ensureGrid() {
        const list = G.colliders || [];
        if (this._grid && this._gridSrc === list && this._gridLen === list.length) return;
        const grid = new Map();
        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            const gx0 = Math.floor(c.x0 / GRID_CELL);
            const gx1 = Math.floor(c.x1 / GRID_CELL);
            const gz0 = Math.floor(c.z0 / GRID_CELL);
            const gz1 = Math.floor(c.z1 / GRID_CELL);
            for (let gx = gx0; gx <= gx1; gx++) {
                for (let gz = gz0; gz <= gz1; gz++) {
                    const key = (gx + 2048) * 4096 + (gz + 2048);
                    let bucket = grid.get(key);
                    if (!bucket) { bucket = []; grid.set(key, bucket); }
                    bucket.push(c);
                }
            }
        }
        this._grid = grid;
        this._gridSrc = list;
        this._gridLen = list.length;
    },

    _resolveCollisions(x, z) {
        this._ensureGrid();
        const r = PLAYER_RADIUS;
        const r2 = r * r;
        const seen = this._seen;

        for (let pass = 0; pass < 2; pass++) {
            seen.clear();
            const gx0 = Math.floor((x - r) / GRID_CELL);
            const gx1 = Math.floor((x + r) / GRID_CELL);
            const gz0 = Math.floor((z - r) / GRID_CELL);
            const gz1 = Math.floor((z + r) / GRID_CELL);

            for (let gx = gx0; gx <= gx1; gx++) {
                for (let gz = gz0; gz <= gz1; gz++) {
                    const bucket = this._grid.get((gx + 2048) * 4096 + (gz + 2048));
                    if (!bucket) continue;
                    for (let i = 0; i < bucket.length; i++) {
                        const c = bucket[i];
                        if (seen.has(c)) continue;
                        seen.add(c);
                        if (x + r < c.x0 || x - r > c.x1 || z + r < c.z0 || z - r > c.z1) continue;

                        const cx = Math.max(c.x0, Math.min(x, c.x1));
                        const cz = Math.max(c.z0, Math.min(z, c.z1));
                        const dx = x - cx;
                        const dz = z - cz;
                        const d2 = dx * dx + dz * dz;
                        if (d2 >= r2) continue;

                        let nx = 0, nz = 0, push = 0;
                        if (d2 > 1e-8) {
                            const d = Math.sqrt(d2);
                            nx = dx / d;
                            nz = dz / d;
                            push = r - d;
                        } else {
                            // Deeply inside box: push out along nearest face
                            const dL = x - c.x0, dR = c.x1 - x;
                            const dT = z - c.z0, dB = c.z1 - z;
                            const m = Math.min(dL, dR, dT, dB);
                            if (m === dL) { nx = -1; push = dL + r; }
                            else if (m === dR) { nx = 1; push = dR + r; }
                            else if (m === dT) { nz = -1; push = dT + r; }
                            else { nz = 1; push = dB + r; }
                        }
                        x += nx * push;
                        z += nz * push;
                        const vn = this.vel.x * nx + this.vel.z * nz;
                        if (vn < 0) {
                            this.vel.x -= vn * nx;
                            this.vel.z -= vn * nz;
                        }
                    }
                }
            }
        }
        this._colRes.x = x;
        this._colRes.z = z;
        return this._colRes;
    },

    // circle-vs-AABB in XZ; kept for callers/tests expecting bool check
    _collideAxis(nx, nz, isX) {
        this._ensureGrid();
        const r = PLAYER_RADIUS;
        const gx0 = Math.floor((nx - r) / GRID_CELL);
        const gx1 = Math.floor((nx + r) / GRID_CELL);
        const gz0 = Math.floor((nz - r) / GRID_CELL);
        const gz1 = Math.floor((nz + r) / GRID_CELL);
        for (let gx = gx0; gx <= gx1; gx++) {
            for (let gz = gz0; gz <= gz1; gz++) {
                const bucket = this._grid.get((gx + 2048) * 4096 + (gz + 2048));
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const c = bucket[i];
                    if (nx + r < c.x0 || nx - r > c.x1 || nz + r < c.z0 || nz - r > c.z1) continue;
                    return true;
                }
            }
        }
        return false;
    }
};
