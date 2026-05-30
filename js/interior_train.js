/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO TRAIN "INTERIOR" (v2.0.0 — real-world camera cutaway)

   There is NO separate interior scene. The exterior IS the source of truth: the
   train, its real riders, the tunnel, the buildings above and every other entity
   are already rendered in G.world at their true world positions. "Boarding" a
   train (G.enterTrainFocus) simply:

     • keeps G.world visible and zooms the camera onto the chosen train (Camera
       reads InteriorTrain.ZOOM and follows Entities[key].x — see camera.js), and
     • slices the near wall off that train: the front panel is hidden so you see
       straight into the car at the REAL models riding it, with a light interior
       cutaway (floor / ceiling / seats / poles) drawn on the body so it reads as
       an opened car.

   Everything outside — the city skyline, the stations it pulls into, NPCs getting
   on and off, other trains — is the actual world, in its actual place, going past
   exactly as it does outside. Tracking a model who boards this train also "just
   works", because the camera is on the same real world.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorTrain = {
    ZOOM: 2.0,            // camera zoom while boarded (camera.js reads this)
    _key: null,
    _train: null,         // the train object we cut open (to detect rebuilds)
    _cut: null,           // cutaway interior overlay, child of train.c

    // Exterior train geometry (buildTrainSprite): body spans x:-180..180, y:-35..30.
    _BODY_L: -180, _BODY_R: 180, _BODY_T: -35, _BODY_B: 30,

    enter(key) {
        // Restore any train we previously opened (e.g. user tapped a different car).
        if (this._key && this._key !== key) this.exit();
        this._key = key;
        const t = (typeof Entities !== 'undefined') ? Entities[key] : null;
        if (!t) return;
        this._openCar(t);
    },

    /* Hide the near wall and add the interior cutaway so the real riders show. */
    _openCar(t) {
        this._train = t;
        if (t.front) {
            if (t._frontWasVisible === undefined) t._frontWasVisible = t.front.visible;
            t.front.visible = false;
        }
        if (this._cut && !this._cut.destroyed) {
            if (this._cut.parent) this._cut.parent.removeChild(this._cut);
            this._cut.destroy();
        }
        this._cut = this._buildCutaway();
        if (t.c && this._cut) t.c.addChild(this._cut);   // sits over the body, behind riders
    },

    /* Light interior detailing in the train's local coords. Drawn on the body
       container (t.c), so it moves with the train and renders behind the riders
       (which live in the separate riderCont layered above the bodies). */
    _buildCutaway() {
        const g = new PIXI.Graphics();
        const L = this._BODY_L, R = this._BODY_R, W = R - L;

        // Interior shell — slightly lit so the opened car doesn't read as a void.
        g.beginFill(0x334155, 0.55); g.drawRect(L + 4, this._BODY_T + 4, W - 8, 22); g.endFill();   // upper wall
        // Ceiling rail + warm light strip
        g.beginFill(0x1e293b); g.drawRect(L + 4, this._BODY_T + 2, W - 8, 4); g.endFill();
        g.beginFill(0xfde68a, 0.5); g.drawRect(L + 20, this._BODY_T + 3, W - 40, 1.5); g.endFill();
        // Floor
        g.beginFill(0x0f172a); g.drawRect(L + 2, 16, W - 4, 14); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(L + 2, 16, W - 4, 2); g.endFill();
        g.beginFill(0xfacc15, 0.5); g.drawRect(L + 2, 28, W - 4, 1.5); g.endFill();   // safety line
        // Bench seat the riders sit on (behind them)
        g.beginFill(0x1e293b); g.drawRect(L + 8, 6, W - 16, 12); g.endFill();
        g.beginFill(0x0284c7, 0.7); g.drawRect(L + 8, 6, W - 16, 3); g.endFill();     // cushion trim
        // Grab poles
        g.beginFill(0x64748b);
        for (let px = L + 40; px < R - 30; px += 70) g.drawRect(px - 1, this._BODY_T + 6, 2, 28);
        g.endFill();
        g.beginFill(0xcbd5e1, 0.7);
        for (let px = L + 40; px < R - 30; px += 70) g.drawRect(px - 1, this._BODY_T + 6, 0.8, 28);
        g.endFill();
        return g;
    },

    /* Re-assert the cutaway each frame; rebuild it if the city recreated the train. */
    update() {
        const t = (this._key && typeof Entities !== 'undefined') ? Entities[this._key] : null;
        if (!t) return;
        if (t !== this._train) { this._openCar(t); return; }      // train object was rebuilt
        if (t.front && t.front.visible) t.front.visible = false;  // keep the wall sliced open
    },

    /* Restore the train to its normal exterior look. */
    exit() {
        const t = this._train;
        if (t) {
            if (t.front) t.front.visible = (t._frontWasVisible !== false);
            t._frontWasVisible = undefined;
        }
        if (this._cut && !this._cut.destroyed) {
            if (this._cut.parent) this._cut.parent.removeChild(this._cut);
            this._cut.destroy();
        }
        this._cut = null;
        this._train = null;
        this._key = null;
    }
};
