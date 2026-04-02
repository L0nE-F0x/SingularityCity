/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   UNIVERSITY CAMPUS (v1.0.0)
   Zone for rumored/baby/kid models — lecture halls, dorms, library, graduation ceremonies
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const UniversityData = {

    BLDS: [
        { id: 'uni_main',    name: 'AI Academy',      w: 200, fl: 4, emoji: '🎓', type: 'university', desc: 'Where pre-release models learn the fundamentals. Lectures on attention, loss functions, and gradient descent.' },
        { id: 'uni_library', name: 'Data Library',     w: 140, fl: 3, emoji: '📚', type: 'university', desc: 'Vast archives of training corpora. Models come here to absorb knowledge before release.' },
        { id: 'uni_dorm',    name: 'Model Dormitory',  w: 150, fl: 5, emoji: '🏠', type: 'university', desc: 'Housing for models still in training. Bunk beds and whiteboards everywhere.' },
        { id: 'uni_lab',     name: 'Research Lab',     w: 140, fl: 3, emoji: '🔬', type: 'university', desc: 'Experimental architecture testing ground. Where novel techniques get prototyped.' },
    ],

    _graduations: [],      // queue of {model, tick} for active ceremonies
    _confetti: [],         // confetti particles
    _zoneStartX: 0,
    _zoneEndX: 0,

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
    },

    positionZone(startX) {
        let cx = startX + 40; // small gap before campus
        this._zoneStartX = cx;
        this.BLDS.forEach(b => {
            const bld = G.bldById[b.id];
            if (bld) { bld.x = cx; cx += bld.w + 35; }
        });
        this._zoneEndX = cx;
        return cx;
    },

    getStudents() {
        if (!G.models) return [];
        return G.models.filter(m => {
            const stg = getStage(m.rel, m.ret, m.phase);
            return stg === 'baby' || stg === 'kid' || stg === 'rumored';
        });
    },

    checkGraduations() {
        if (!G.models) return;
        G.models.forEach(m => {
            if (m._graduated || m._graduating) return;
            const stg = getStage(m.rel, m.ret, m.phase);
            // Check if model JUST became an adult (released within last 24 hours)
            if (stg === 'adult' && m.rel) {
                const rel = new Date(m.rel);
                const now = new Date();
                const hoursSince = (now - rel) / (1000 * 60 * 60);
                if (hoursSince >= 0 && hoursSince < 24 && !m._graduated) {
                    this.triggerGraduation(m);
                }
            }
        });

        // Update active ceremonies
        this._updateGraduations();
    },

    triggerGraduation(model) {
        model._graduating = true;
        this._graduations.push({
            model: model,
            startTick: G.tick,
            phase: 'walking', // walking → stage → diploma → confetti → done
            stageX: G.bldById['uni_main'] ? G.bldById['uni_main'].x + 100 : 0,
        });

        if (typeof UI !== 'undefined') UI.addToast('🎓 ' + model.name + ' is graduating from AI Academy!');
        if (typeof SND !== 'undefined') SND.uiClick();
    },

    _updateGraduations() {
        for (let i = this._graduations.length - 1; i >= 0; i--) {
            const g = this._graduations[i];
            const elapsed = G.tick - g.startTick;

            if (g.phase === 'walking' && elapsed > 120) {
                g.phase = 'stage';
                g.startTick = G.tick;
            } else if (g.phase === 'stage' && elapsed > 90) {
                g.phase = 'diploma';
                g.startTick = G.tick;
                // Burst confetti
                for (let c = 0; c < 40; c++) {
                    this._confetti.push({
                        x: g.stageX,
                        y: G.groundY - 60,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -2 - Math.random() * 3,
                        color: [0xff4444, 0x44ff44, 0x4488ff, 0xffdd44, 0xff44ff, 0x44ffff][Math.floor(Math.random() * 6)],
                        life: 80 + Math.floor(Math.random() * 50),
                        size: 2 + Math.random() * 2,
                        rot: Math.random() * Math.PI * 2,
                    });
                }
            } else if (g.phase === 'diploma' && elapsed > 120) {
                g.phase = 'done';
                g.model._graduating = false;
                g.model._graduated = true;
                this._graduations.splice(i, 1);
                if (typeof G !== 'undefined') G.unlockAchieve('graduation_day');
            }
        }

        // Update confetti
        for (let i = this._confetti.length - 1; i >= 0; i--) {
            const c = this._confetti[i];
            c.x += c.vx;
            c.y += c.vy;
            c.vy += 0.06; // gravity
            c.vx *= 0.99;
            c.rot += 0.1;
            c.life--;
            if (c.life <= 0) this._confetti.splice(i, 1);
        }
    },

    update() {
        if (G.tick % 300 === 0) this.checkGraduations();
        else this._updateGraduations(); // keep confetti moving every frame
    },

    drawConfetti(fxGfx) {
        this._confetti.forEach(c => {
            const alpha = Math.max(0, c.life / 130);
            fxGfx.beginFill(c.color, alpha);
            fxGfx.drawRect(c.x - c.size / 2, c.y - c.size / 2, c.size, c.size * 0.6);
            fxGfx.endFill();
        });
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   UNIVERSITY ENVIRONMENT — Campus Exterior Rendering
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const UniversityEnv = {

    buildTerrain(g, gy, startX, endX) {
        // Campus green lawn
        g.beginFill(0x2d5a1e, 0.8);
        g.drawRect(startX, gy - 2, endX - startX, 20);
        g.endFill();
        g.beginFill(0x3a7028, 0.5);
        g.drawRect(startX, gy - 2, endX - startX, 8);
        g.endFill();

        // Brick pathway
        const pathY = gy + 2;
        g.beginFill(0x8b6e4e);
        g.drawRect(startX + 20, pathY, endX - startX - 40, 6);
        g.endFill();
        // Brick lines
        for (let bx = startX + 22; bx < endX - 22; bx += 12) {
            g.beginFill(0x7a5e3e);
            g.drawRect(bx, pathY, 1, 6);
            g.endFill();
        }

        // Campus benches
        for (let bx = startX + 60; bx < endX - 60; bx += 120) {
            g.beginFill(0x5a4030);
            g.drawRect(bx, gy - 6, 20, 3);   // seat
            g.drawRect(bx + 2, gy - 3, 2, 5); // left leg
            g.drawRect(bx + 16, gy - 3, 2, 5); // right leg
            g.endFill();
        }

        // Small trees / bushes
        for (let tx = startX + 30; tx < endX - 30; tx += 80 + Math.floor(Math.random() * 40)) {
            // Trunk
            g.beginFill(0x5a3a1e);
            g.drawRect(tx, gy - 18, 4, 16);
            g.endFill();
            // Canopy
            g.beginFill(0x3d8b2e);
            g.drawCircle(tx + 2, gy - 22, 10);
            g.endFill();
            g.beginFill(0x4da03a, 0.7);
            g.drawCircle(tx + 5, gy - 20, 7);
            g.endFill();
        }
    },

    // NOTE: g=local graphics (0=top, h=ground), bw=bld.w, h=container height
    buildBuilding(g, bld, h) {
        const bw = bld.w;

        if (bld.id === 'uni_main') {
            // ── AI ACADEMY: Classical academic building with clock tower ──
            g.beginFill(0x8b7355);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            for (let ci = 0; ci < 5; ci++) {
                const cx = 15 + ci * (bw - 30) / 4;
                g.beginFill(0xa08b6e);
                g.drawRect(cx - 3, 10, 6, h - 20);
                g.endFill();
                g.beginFill(0xbaa88a);
                g.drawRect(cx - 5, 8, 10, 4);
                g.endFill();
            }
            // Pediment
            g.beginFill(0x9a845f);
            g.moveTo(5, 0); g.lineTo(bw / 2, -18); g.lineTo(bw - 5, 0); g.closePath();
            g.endFill();
            // Clock tower
            g.beginFill(0x7a6545);
            g.drawRect(bw / 2 - 12, -38, 24, 22);
            g.endFill();
            g.beginFill(0xffeedd);
            g.drawCircle(bw / 2, -27, 7);
            g.endFill();
            g.beginFill(0x333333);
            g.drawCircle(bw / 2, -27, 1);
            g.endFill();
            const hr = new Date().getHours() % 12, mn = new Date().getMinutes();
            const hrAngle = (hr / 12) * Math.PI * 2 - Math.PI / 2;
            const mnAngle = (mn / 60) * Math.PI * 2 - Math.PI / 2;
            g.lineStyle(1.5, 0x333333);
            g.moveTo(bw / 2, -27); g.lineTo(bw / 2 + Math.cos(hrAngle) * 4, -27 + Math.sin(hrAngle) * 4);
            g.moveTo(bw / 2, -27); g.lineTo(bw / 2 + Math.cos(mnAngle) * 5.5, -27 + Math.sin(mnAngle) * 5.5);
            g.lineStyle(0);
            // Arched entrance
            g.beginFill(0x3a2a1a);
            g.drawRect(bw / 2 - 14, h - 24, 28, 24);
            g.endFill();
            g.beginFill(0x3a2a1a);
            g.drawEllipse(bw / 2, h - 24, 14, 10);
            g.endFill();
            // Windows
            for (let row = 0; row < bld.fl - 1; row++) {
                for (let wi = 0; wi < 4; wi++) {
                    const wx = 20 + wi * (bw - 40) / 3;
                    const wy = 15 + row * 22;
                    g.beginFill(0xffeecc, 0.4);
                    g.drawRect(wx - 5, wy, 10, 14);
                    g.endFill();
                }
            }

        } else if (bld.id === 'uni_library') {
            g.beginFill(0x6a5a4a);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            const bookColors = [0xcc4444, 0x4488cc, 0x44aa44, 0xddaa33, 0x884488, 0xcc8844];
            for (let row = 0; row < bld.fl; row++) {
                for (let bi = 0; bi < 10; bi++) {
                    const bbx = 8 + bi * (bw - 16) / 10;
                    const bby = 6 + row * 22;
                    g.beginFill(bookColors[(bi + row) % bookColors.length], 0.6);
                    g.drawRect(bbx, bby, 6, 16);
                    g.endFill();
                }
            }
            g.beginFill(0x3a2a1a);
            g.drawRect(bw / 2 - 12, h - 22, 24, 22);
            g.endFill();

        } else if (bld.id === 'uni_dorm') {
            g.beginFill(0x7a6a5a);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            for (let row = 0; row < bld.fl; row++) {
                for (let wi = 0; wi < 6; wi++) {
                    const wx = 10 + wi * (bw - 20) / 6;
                    const wy = 8 + row * 22;
                    const lit = Math.random() > 0.4;
                    g.beginFill(lit ? 0xffeeaa : 0x2a2a3a, lit ? 0.6 : 0.4);
                    g.drawRect(wx, wy, 10, 12);
                    g.endFill();
                }
            }
            g.beginFill(0x444466);
            g.drawRect(bw / 2 - 10, h - 18, 20, 18);
            g.endFill();

        } else if (bld.id === 'uni_lab') {
            g.beginFill(0x2a3a4a);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            for (let row = 0; row < bld.fl; row++) {
                for (let pi = 0; pi < 4; pi++) {
                    const px = 6 + pi * (bw - 12) / 4;
                    const py = 4 + row * 22;
                    g.beginFill(0x4488aa, 0.3);
                    g.drawRect(px, py, (bw - 20) / 4, 18);
                    g.endFill();
                    if (Math.random() > 0.5) {
                        g.beginFill(0x44ffaa, 0.15);
                        g.drawCircle(px + 10, py + 10, 4);
                        g.endFill();
                    }
                }
            }
            g.beginFill(0x226688);
            g.drawRect(bw / 2 - 12, h - 20, 24, 20);
            g.endFill();
        }
        // Shadow
        g.beginFill(0x000000, 0.15); g.drawRect(0, h - 2, bw, 4); g.endFill();
    },

    update() {
        // Draw confetti from graduation ceremonies
        if (typeof UniversityData !== 'undefined' && UniversityData._confetti.length > 0) {
            UniversityData.drawConfetti(G.fxGfx);
        }
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   UNIVERSITY INTERIOR — Lecture halls, library, dorms, and research labs
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const UniversityInterior = {

    isDragging: false,

    build(bld, layer) {
        layer.removeChildren();
        const W = G.vpW, H = G.vpH;

        const scene = new PIXI.Container();
        layer.addChild(scene);
        const g = new PIXI.Graphics();
        scene.addChild(g);

        if (bld.id === 'uni_main') this._buildLectureHall(g, scene, W, H);
        else if (bld.id === 'uni_library') this._buildLibrary(g, scene, W, H);
        else if (bld.id === 'uni_dorm') this._buildDorm(g, scene, W, H, bld);
        else if (bld.id === 'uni_lab') this._buildResearchLab(g, scene, W, H);

        // Drag scroll
        const totalH = H * 2.5;
        const minY = -(totalH - H);
        scene.interactive = true;
        scene.hitArea = new PIXI.Rectangle(0, minY, W, totalH + H);
        let dragStartY = 0, sceneStartY = 0, dragging = false;
        scene.on('pointerdown', e => { dragging = true; dragStartY = e.global.y; sceneStartY = scene.y; });
        scene.on('pointermove', e => { if (!dragging) return; scene.y = Math.max(minY, Math.min(0, sceneStartY + (e.global.y - dragStartY))); });
        scene.on('pointerup', () => { dragging = false; });
        scene.on('pointerupoutside', () => { dragging = false; });
    },

    _buildLectureHall(g, scene, W, H) {
        // ── TIERED LECTURE HALL ──
        g.beginFill(0x1a1428);
        g.drawRect(0, 0, W, H * 2.5);
        g.endFill();

        // Title
        const title = new PIXI.Text('🎓 AI ACADEMY — MAIN LECTURE HALL', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0xfbbf24
        });
        title.x = 20; title.y = 15;
        scene.addChild(title);

        // Chalkboard
        const cbX = W * 0.15, cbY = 50, cbW = W * 0.7, cbH = 120;
        g.beginFill(0x2a4a2a);
        g.drawRoundedRect(cbX, cbY, cbW, cbH, 4);
        g.endFill();
        // Frame
        g.lineStyle(3, 0x8b6e4e);
        g.drawRoundedRect(cbX, cbY, cbW, cbH, 4);
        g.lineStyle(0);
        // Chalk equations
        const equations = ['L = -Σ y·log(ŷ)', '∇θ J(θ) = E[∇log π(a|s)·R]', 'Attention(Q,K,V) = softmax(QKᵀ/√d)V', 'f(x) = max(0, Wx + b)'];
        equations.forEach((eq, i) => {
            const eqTxt = new PIXI.Text(eq, { fontFamily: 'JetBrains Mono', fontSize: 8, fill: 0xccddcc });
            eqTxt.x = cbX + 15; eqTxt.y = cbY + 12 + i * 25;
            scene.addChild(eqTxt);
        });

        // Professor at podium
        const profX = W / 2, profY = cbY + cbH + 25;
        g.beginFill(0x5a3a1e);
        g.drawRect(profX - 12, profY, 24, 30); // podium
        g.endFill();
        g.beginFill(0x2255aa);
        g.drawRect(profX - 5, profY - 14, 10, 14); // body
        g.endFill();
        g.beginFill(0xfdd8b5);
        g.drawCircle(profX, profY - 18, 5); // head
        g.endFill();
        const profLabel = new PIXI.Text('Professor', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x888888 });
        profLabel.anchor.set(0.5, 0); profLabel.x = profX; profLabel.y = profY + 32;
        scene.addChild(profLabel);

        // Tiered seating with student models
        const students = (typeof UniversityData !== 'undefined') ? UniversityData.getStudents().slice(0, 24) : [];
        for (let row = 0; row < 4; row++) {
            const ry = profY + 60 + row * 40;
            const rw = W * (0.5 + row * 0.1);
            const rx = (W - rw) / 2;
            // Desk tier
            g.beginFill(0x4a3a2a);
            g.drawRect(rx, ry + 16, rw, 4);
            g.endFill();
            // Chairs
            const seats = 5 + row;
            for (let s = 0; s < seats; s++) {
                const sx = rx + 10 + s * (rw - 20) / seats;
                g.beginFill(0x333350);
                g.drawRect(sx, ry + 8, 12, 10);
                g.endFill();
                // Student
                const si = row * 7 + s;
                if (si < students.length) {
                    const stu = students[si];
                    const labCol = (LABS[stu.lab] && LABS[stu.lab].color) ? parseInt(LABS[stu.lab].color.replace('#', ''), 16) : 0x888888;
                    g.beginFill(labCol);
                    g.drawRect(sx + 2, ry - 2, 8, 10);
                    g.endFill();
                    g.beginFill(0xfdd8b5);
                    g.drawCircle(sx + 6, ry - 6, 3.5);
                    g.endFill();
                }
            }
        }
    },

    _buildLibrary(g, scene, W, H) {
        g.beginFill(0x14110e);
        g.drawRect(0, 0, W, H * 2.5);
        g.endFill();

        const title = new PIXI.Text('📚 DATA LIBRARY', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0x22d3ee
        });
        title.x = 20; title.y = 15;
        scene.addChild(title);

        // Bookshelf rows
        const shelfColors = [0xcc4444, 0x4488cc, 0x44aa44, 0xddaa33, 0x884488, 0xcc8844, 0x44ccaa];
        for (let row = 0; row < 5; row++) {
            const sy = 50 + row * 90;
            // Shelf frame
            g.beginFill(0x5a4030);
            g.drawRect(30, sy, W - 60, 60);
            g.endFill();
            // Books
            for (let bi = 0; bi < 20; bi++) {
                const bx = 35 + bi * ((W - 70) / 20);
                const bh = 30 + Math.floor(Math.random() * 24);
                g.beginFill(shelfColors[Math.floor(Math.random() * shelfColors.length)]);
                g.drawRect(bx, sy + 56 - bh, 8, bh);
                g.endFill();
            }
            // Shelf planks
            g.beginFill(0x6a5040);
            g.drawRect(30, sy + 58, W - 60, 3);
            g.endFill();
        }

        // Study desks at bottom
        const students = (typeof UniversityData !== 'undefined') ? UniversityData.getStudents().slice(0, 6) : [];
        for (let di = 0; di < 3; di++) {
            const dx = 60 + di * (W - 120) / 3, dy = 520;
            g.beginFill(0x4a3a2a);
            g.drawRect(dx, dy, 60, 25);
            g.endFill();
            // Lamp
            g.beginFill(0x44aa44, 0.6);
            g.drawCircle(dx + 30, dy - 5, 8);
            g.endFill();
            // Student
            if (di < students.length) {
                const s = students[di];
                const labCol = (LABS[s.lab] && LABS[s.lab].color) ? parseInt(LABS[s.lab].color.replace('#', ''), 16) : 0x888888;
                g.beginFill(labCol);
                g.drawRect(dx + 22, dy - 16, 10, 12);
                g.endFill();
                g.beginFill(0xfdd8b5);
                g.drawCircle(dx + 27, dy - 20, 4);
                g.endFill();
                const name = new PIXI.Text(s.name, { fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0x888888 });
                name.x = dx + 15; name.y = dy + 28;
                scene.addChild(name);
            }
        }
    },

    _buildDorm(g, scene, W, H, bld) {
        g.beginFill(0x141018);
        g.drawRect(0, 0, W, H * 2.5);
        g.endFill();

        const title = new PIXI.Text('🏠 MODEL DORMITORY', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0xf472b6
        });
        title.x = 20; title.y = 15;
        scene.addChild(title);

        const students = (typeof UniversityData !== 'undefined') ? UniversityData.getStudents().slice(0, 12) : [];
        const roomW = 120, roomH = 80;
        const roomsPerRow = Math.floor((W - 40) / (roomW + 10));

        for (let ri = 0; ri < 12; ri++) {
            const row = Math.floor(ri / roomsPerRow);
            const col = ri % roomsPerRow;
            const rx = 20 + col * (roomW + 10);
            const ry = 50 + row * (roomH + 15);

            // Room walls
            g.beginFill(0x1e1a28);
            g.drawRect(rx, ry, roomW, roomH);
            g.endFill();
            g.lineStyle(1, 0x333355);
            g.drawRect(rx, ry, roomW, roomH);
            g.lineStyle(0);

            // Bed
            g.beginFill(0x444466);
            g.drawRect(rx + 5, ry + roomH - 22, 40, 16);
            g.endFill();
            g.beginFill(0x6666aa);
            g.drawRect(rx + 5, ry + roomH - 22, 40, 4); // pillow
            g.endFill();

            // Desk
            g.beginFill(0x4a3a2a);
            g.drawRect(rx + 55, ry + roomH - 18, 35, 12);
            g.endFill();
            // Monitor
            g.beginFill(0x222244);
            g.drawRect(rx + 62, ry + roomH - 30, 20, 12);
            g.endFill();
            g.beginFill(0x336688, 0.5);
            g.drawRect(rx + 64, ry + roomH - 28, 16, 8);
            g.endFill();

            // Occupant
            if (ri < students.length) {
                const s = students[ri];
                const labCol = (LABS[s.lab] && LABS[s.lab].color) ? parseInt(LABS[s.lab].color.replace('#', ''), 16) : 0x888888;
                const stg = getStage(s.rel, s.ret, s.phase);
                const dp = (typeof G !== 'undefined') ? G.getDayPhase() : 0.5;
                const sleeping = dp < 0.25 || dp > 0.85;

                if (sleeping) {
                    // In bed
                    g.beginFill(0xfdd8b5);
                    g.drawCircle(rx + 12, ry + roomH - 18, 3.5);
                    g.endFill();
                    const zzz = new PIXI.Text('💤', { fontSize: 8 });
                    zzz.x = rx + 20; zzz.y = ry + roomH - 28;
                    scene.addChild(zzz);
                } else {
                    // At desk
                    g.beginFill(labCol);
                    g.drawRect(rx + 67, ry + roomH - 42, 8, 12);
                    g.endFill();
                    g.beginFill(0xfdd8b5);
                    g.drawCircle(rx + 71, ry + roomH - 46, 3.5);
                    g.endFill();
                }

                // Name + stage tag
                const stageEmoji = stg === 'baby' ? '👶' : stg === 'kid' ? '🧒' : stg === 'rumored' ? '❓' : '';
                const roomLabel = new PIXI.Text(stageEmoji + ' ' + s.name, {
                    fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0x888888
                });
                roomLabel.x = rx + 3; roomLabel.y = ry + 3;
                scene.addChild(roomLabel);
            } else {
                // Empty room
                const empty = new PIXI.Text('VACANT', { fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0x444455 });
                empty.x = rx + 40; empty.y = ry + 35;
                scene.addChild(empty);
            }
        }
    },

    _buildResearchLab(g, scene, W, H) {
        g.beginFill(0x0e1420);
        g.drawRect(0, 0, W, H * 2.5);
        g.endFill();

        const title = new PIXI.Text('🔬 EXPERIMENTAL RESEARCH LAB', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0x4ade80
        });
        title.x = 20; title.y = 15;
        scene.addChild(title);

        // Workbenches with equipment
        for (let row = 0; row < 3; row++) {
            const by = 50 + row * 130;

            // Bench
            g.beginFill(0x2a3a4a);
            g.drawRect(30, by + 50, W - 60, 6);
            g.endFill();
            // Bench legs
            g.beginFill(0x3a4a5a);
            g.drawRect(35, by + 56, 4, 20);
            g.drawRect(W - 39, by + 56, 4, 20);
            g.endFill();

            // Equipment on bench
            // Beakers
            for (let bi = 0; bi < 3; bi++) {
                const ex = 50 + bi * 60;
                g.beginFill(0x88ccff, 0.3);
                g.drawRect(ex, by + 30, 12, 20);
                g.endFill();
                g.lineStyle(1, 0xaaddff, 0.5);
                g.drawRect(ex, by + 30, 12, 20);
                g.lineStyle(0);
                // Liquid
                const lh = 6 + Math.floor(Math.random() * 10);
                const liqColors = [0x44ff88, 0xff4488, 0x4488ff, 0xffaa44];
                g.beginFill(liqColors[bi % liqColors.length], 0.5);
                g.drawRect(ex + 1, by + 50 - lh, 10, lh);
                g.endFill();
            }

            // Microscope
            g.beginFill(0x555555);
            g.drawRect(250, by + 35, 8, 15); // body
            g.drawRect(246, by + 50, 16, 3); // base
            g.endFill();
            g.beginFill(0x333333);
            g.drawRect(252, by + 28, 4, 8); // eyepiece
            g.endFill();

            // Circuit board / chip diagram
            g.beginFill(0x1a4422);
            g.drawRect(350, by + 20, 60, 35);
            g.endFill();
            // Traces
            for (let ti = 0; ti < 6; ti++) {
                g.beginFill(0x44cc66, 0.4);
                g.drawRect(355, by + 24 + ti * 5, 50, 1);
                g.endFill();
            }
            // Chip
            g.beginFill(0x222222);
            g.drawRect(370, by + 30, 16, 12);
            g.endFill();
            g.beginFill(0x88ff88, 0.3);
            g.drawRect(372, by + 32, 12, 8);
            g.endFill();
        }

        // Neural network visualization on wall
        const nnX = W / 2 - 80, nnY = 440;
        g.beginFill(0x111125);
        g.drawRect(nnX, nnY, 160, 100);
        g.endFill();
        // Nodes in layers
        const layers = [3, 5, 5, 3];
        layers.forEach((count, li) => {
            const lx = nnX + 20 + li * 40;
            for (let ni = 0; ni < count; ni++) {
                const ny = nnY + 15 + ni * (80 / count);
                g.beginFill(0x4488ff, 0.5);
                g.drawCircle(lx, ny, 4);
                g.endFill();
                // Connections to next layer
                if (li < layers.length - 1) {
                    const nlx = nnX + 20 + (li + 1) * 40;
                    for (let nj = 0; nj < layers[li + 1]; nj++) {
                        const njy = nnY + 15 + nj * (80 / layers[li + 1]);
                        g.lineStyle(0.5, 0x4488ff, 0.15);
                        g.moveTo(lx, ny); g.lineTo(nlx, njy);
                    }
                }
            }
        });
        g.lineStyle(0);

        const nnLabel = new PIXI.Text('ARCHITECTURE EXPLORER', {
            fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x4488ff
        });
        nnLabel.x = nnX + 20; nnLabel.y = nnY + 85;
        scene.addChild(nnLabel);
    },

    update() {
        // Could animate experiments, flickering screens, etc.
    }
};
