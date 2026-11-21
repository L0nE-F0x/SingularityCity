/* ══════════════════════════════════════════════════════════════════════════
   FREE-FLY / BIRDS-EYE CAMERA — unlock from street FP and soar over the city.
   Toggle with C. WASD strafe, Space/Q up, Ctrl/E down, Shift boost, mouse look.
   Restores exact street position on exit (same contract as Orbit mode).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, EYE_H, CITY_W, CITY_D, SEA_X } from './state.js';
import { Touch } from './touch.js';

const FLY_SPEED = 520;       // base cruise (u/s)
const FLY_BOOST = 1600;      // Shift
const FLY_SLOW = 180;        // Alt — precision
const MIN_Y = 8;
const MAX_Y = 4200;
const FAR_FLY = 14000;
const NEAR_FLY = 2;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export const FlyMode = {
    active: false,
    _saved: null,
    _farSave: 8000,
    _nearSave: 4,
    _vel: new THREE.Vector3(),
    _speedMult: 1.0,
    _fovAdd: 0,
    _roll: 0,
    _lastYaw: 0,

    init() {
        document.addEventListener('keydown', e => {
            if (!G.started || G.panelOpen || G.terminalOpen) return;
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.code === 'KeyC' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.toggle();
            }
        });
        document.addEventListener('wheel', e => {
            if (!this.active || G.panelOpen || G.terminalOpen) return;
            const factor = e.deltaY < 0 ? 1.15 : 0.87;
            this._speedMult = Math.max(0.25, Math.min(3.5, this._speedMult * factor));
        }, { passive: true });
    },

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    enter() {
        if (this.active) return;
        if (G.tourMode || G.orbitMode || G.xrayMode || G.holomapMode || (G.ridingMetro || G.onPlatform) || G.inside) {
            G.ui?.addToast?.('Free-fly unavailable in this mode', 'info');
            return;
        }
        const cam = G.camera;
        const p = G.player;
        this._saved = {
            x: cam.position.x, y: cam.position.y, z: cam.position.z,
            yaw: p.yaw, pitch: p.pitch,
            fov: cam.fov, far: cam.far, near: cam.near,
            eyeY: p.eyeY
        };
        this._farSave = cam.far;
        this._nearSave = cam.near;
        this.active = true;
        G.flyMode = true;
        this._vel.set(0, 0, 0);
        this._fovAdd = 0;
        this._roll = 0;
        this._lastYaw = p.yaw;

        // Lift off a little so the first frame isn't ground-clipped
        cam.position.y = Math.max(cam.position.y + 40, 80);
        cam.near = NEAR_FLY;
        cam.far = FAR_FLY;
        cam.updateProjectionMatrix();

        // Keep pointer lock for mouse look; suppress the pause-on-unlock path
        // only if lock is lost mid-flight (handled via G.flyMode in player.js).
        if (!p.locked) p.lock();

        if (G.touchMode) {
            Touch.setFlyLabels(true);
            G.ui?.banner('🦅 FREE FLY', 'stick to fly · ▲ up · ▼ down · » boost · 🦅 to land');
        } else {
            G.ui?.banner('🦅 FREE FLY', 'WASD · Space/Q up · Ctrl/E down · Shift boost · C to land');
        }
        G.ui?.addToast?.('Free-fly — bird\'s-eye tour of the city', 'info');
    },

    exit() {
        if (!this.active) return;
        this.active = false;
        G.flyMode = false;
        if (G.touchMode) Touch.setFlyLabels(false);
        const cam = G.camera;
        const p = G.player;
        if (this._saved) {
            // Land under the camera, clamped to the walkable city pad
            let x = cam.position.x;
            let z = cam.position.z;
            x = Math.max(SEA_X + 40, Math.min(CITY_W / 2 + 400, x));
            z = Math.max(-CITY_D / 2 - 400, Math.min(CITY_D / 2 + 400, z));
            p.yaw = this._saved.yaw;
            p.pitch = Math.max(-0.4, Math.min(0.15, this._saved.pitch));
            p.eyeY = G.floorY + EYE_H;
            p.vel.set(0, 0, 0);
            p.grounded = true;
            cam.position.set(x, p.eyeY, z);
            cam.fov = this._saved.fov;
            cam.near = this._saved.near;
            cam.far = this._saved.far;
            cam.updateProjectionMatrix();
            cam.rotation.order = 'YXZ';
            cam.rotation.y = p.yaw;
            cam.rotation.x = p.pitch;
            cam.rotation.z = 0;
        }
        this._saved = null;
        // Reset idle timer so landing doesn't immediately trigger screensaver
        if (G.tour?._lastInputAt != null) G.tour._lastInputAt = performance.now();
        if (G.ui) G.ui.banner('🏙️ Street level', 'first-person restored');
    },

    update(dt) {
        if (!this.active) return;
        /* Safety net. enter() refuses to start a flight from inside a building
           or a train, but nothing used to stop the reverse — boarding or
           entering WHILE already flying. FlyMode owns the camera and
           Player.update returns early whenever G.flyMode is set, so that state
           left you inside a room with walking dead and WASD flying you out
           through the walls. Land rather than fight over the camera. */
        if (G.inside || (G.ridingMetro || G.onPlatform)) { this.exit(); return; }
        if (dt > 0.05) dt = 0.05;
        const cam = G.camera;
        const p = G.player;
        const keys = p.keys || {};

        // Mouse look is owned by Player while locked; keep rotation synced with gentle roll bank.
        let dyaw = p.yaw - this._lastYaw;
        if (dyaw > Math.PI) dyaw -= Math.PI * 2;
        if (dyaw < -Math.PI) dyaw += Math.PI * 2;
        this._lastYaw = p.yaw;
        const yawRate = Math.max(-3, Math.min(3, dyaw / Math.max(0.001, dt)));

        cam.rotation.order = 'YXZ';
        cam.rotation.y = p.yaw;
        cam.rotation.x = p.pitch;
        cam.rotation.z = 0;

        /* Touch flies from the same stick that walks, with the pad's two big
           buttons rebound to climb / descend (Touch.setFlyLabels). Player.update
           returns early while G.flyMode is set, so nothing else reads the stick
           here — this module has to ask for it. */
        const tc = G.touchMode ? Touch.axes() : null;
        const sprint = keys['ShiftLeft'] || keys['ShiftRight'] || (tc && tc.sprint);
        const slow = keys['AltLeft'] || keys['AltRight'];
        const speed = (sprint ? FLY_BOOST : (slow ? FLY_SLOW : FLY_SPEED)) * this._speedMult;

        let mx = 0, my = 0, mz = 0;
        if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
        if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
        if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
        if (keys['Space'] || keys['KeyQ']) my += 1;
        if (keys['ControlLeft'] || keys['ControlRight'] || keys['KeyE']) my -= 1;
        if (tc) {
            mx += tc.x; mz += tc.z;
            if (Touch.held.jump) my += 1;
            if (Touch.held.interact) my -= 1;
        }

        // Full 6DOF relative to look direction (pitch affects forward climb).
        _fwd.set(0, 0, -1).applyEuler(cam.rotation);
        _right.set(1, 0, 0).applyEuler(cam.rotation);
        // Clamp, don't normalise: a half-pushed stick must be a slow cruise.
        const len = Math.max(1, Math.hypot(mx, my, mz));
        mx /= len; my /= len; mz /= len;

        const hasInput = Math.hypot(mx, my, mz) > 0.001;
        const tx = (_right.x * mx + _fwd.x * mz) * speed;
        const ty = my * speed + _fwd.y * mz * speed;
        const tz = (_right.z * mx + _fwd.z * mz) * speed;

        if (hasInput) {
            const k = Math.min(1, dt * 8.5);
            this._vel.x += (tx - this._vel.x) * k;
            this._vel.y += (ty - this._vel.y) * k;
            this._vel.z += (tz - this._vel.z) * k;
        } else {
            this._vel.multiplyScalar(Math.exp(-dt * 6.5));
            if (this._vel.lengthSq() < 1) this._vel.set(0, 0, 0);
        }

        cam.position.addScaledVector(this._vel, dt);

        // Soft world bounds — larger than street clamp so you can overfly sea/hills
        const halfW = CITY_W / 2 + 2800;
        const halfD = CITY_D / 2 + 2800;
        cam.position.x = Math.max(SEA_X - 3500, Math.min(halfW, cam.position.x));
        cam.position.z = Math.max(-halfD, Math.min(halfD, cam.position.z));
        cam.position.y = Math.max(MIN_Y, Math.min(MAX_Y, cam.position.y));

        // Bank angle & boost FOV punch
        const spd = this._vel.length();
        const boostRatio = Math.max(0, Math.min(1, (spd - FLY_SPEED) / (FLY_BOOST - FLY_SPEED)));
        const targetFovAdd = (sprint && spd > FLY_SPEED * 0.8) ? 7.5 * boostRatio : 0;
        this._fovAdd += (targetFovAdd - this._fovAdd) * Math.min(1, dt * 6);
        const baseFov = (this._saved && this._saved.fov) || G.settings?.fov || 70;
        const wantFov = baseFov + this._fovAdd;
        if (Math.abs(cam.fov - wantFov) > 0.03) {
            cam.fov = wantFov;
            cam.updateProjectionMatrix();
        }

        const latVel = this._vel.dot(_right);
        const targetRoll = -(latVel / FLY_BOOST) * 0.04 + yawRate * 0.015;
        this._roll += (targetRoll - this._roll) * Math.min(1, dt * 8);
        cam.rotation.z = this._roll;
    },

    snapshot() {
        return { active: this.active };
    }
};
