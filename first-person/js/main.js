/* ══════════════════════════════════════════════════════════════════════════
   SINGULARITY CITY — FIRST PERSON · main entry
   Boot: data → layout → renderer → world → systems → loop.
   Performance posture (from the 3D-version autopsy): no post-processing, no
   logarithmic depth, DPR capped, instancing everywhere. One sun shadow map
   with a tight player-following frustum (off on the `low` preset) — it is the
   one thing a flat-shaded city cannot fake.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import * as TEX from './textures.js';
import { G, qualityPreset, computeDayPhase } from './state.js';
import { City } from './city.js';
import { World } from './world.js';
import { Citizens } from './citizens.js';
import { Traffic } from './traffic.js';
import { Signals } from './signals.js';
import { Weather } from './weather.js';
import { Player } from './player.js';
import { Interact } from './interact.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Progress } from './progress.js';
import { Tour } from './tour.js';
import { Interior } from './interior.js';
import { ChatBubbles } from './chatbubbles.js';
import { Vendors } from './vendors.js';
import { Birds } from './birds.js';
import { CitizenOfDay } from './citizen_of_day.js';
import { VCDealFlow } from './vc_dealflow.js';
import { ResearchPapers } from './research_papers.js';
import { Metro } from './metro.js';
import { Jail } from './jail.js';
import { Court } from './court.js';
import { OrbitMode } from './orbit_mode.js';
import { FlyMode } from './fly_mode.js';
import { XrayMode } from './xray_mode.js';
import { Holomap } from './holomap.js';
import { Conference } from './conference.js';
import { Seasonal } from './seasonal.js';
import { Kardashev } from './kardashev.js';
import { Wetness } from './wetness.js';
import { Ambience } from './ambience.js';
import { NewsReactivity } from './news_reactivity.js';
import { SupplyChain } from './supply_chain.js';
import { Tutorial } from './tutorial.js';
import { DailyBriefing } from './daily_briefing.js';
import { Terminal } from './terminal.js';
import { CityStore } from './store/city_store.js';
import { Live } from './store/live.js';
import { Roster } from './store/roster.js';
import { Shell } from './shell.js';
import { Touch, detectTouch } from './touch.js';
import { readResumeToken, clearResumeToken } from './store/nav.js';

// expose for inline panel handlers (newspaper button) + debugging
window.G = G;

async function boot() {
    // fonts matter for the sign atlas + billboard canvas text
    try { await document.fonts.ready; } catch (e) { /* fall back to system fonts */ }

    // ── state / quality ──
    G.progress = Progress;
    Progress.init();

    /* Decided FIRST: the quality default, the renderer flags, the controller's
       input gate and the tutorial's wording all branch on it. */
    G.touchMode = detectTouch();

    /* A phone GPU running the `medium` preset — 700 citizens, a 2048 shadow
       map, DPR 1.35 on a 3x screen — is a slideshow, and a slideshow reads as
       "broken" long before anyone blames the preset. Default to `low` on
       touch.

       Only when nothing has been chosen, though. Progress.init() has already
       applied any quality saved in the store, and the settings panel writes
       its own localStorage key; imposing the touch default over either would
       reset a tablet the player had deliberately put on `high` every single
       boot. */
    const chosenQuality = localStorage.getItem('sc_fp_quality') || CityStore.getSnapshot().quality;
    if (chosenQuality) G.quality = chosenQuality;
    else if (G.touchMode) G.quality = 'low';
    G.preset = qualityPreset(G.quality);
    /* What this page ACTUALLY booted with. The ENTER handler compares against
       it to decide whether a reload is needed; comparing against a hardcoded
       'medium' meant the mobile default of `low` always looked like a change
       and every phone bounced through a reload before it could enter. */
    const bootQuality = G.quality;

    /* The start screen is in index.html, so ENTER is on screen and looks live
       from the first paint — but its click handler is not attached until the
       very end of boot, after the world is built and the roster has been
       fetched. On a desktop that gap is a few hundred milliseconds. On a phone
       on mobile data it is several seconds of tapping a button that does
       nothing, which is indistinguishable from a broken page. Say so. */
    const enterBtn = document.getElementById('enterBtn');
    const enterLabel = enterBtn ? enterBtn.textContent : '';
    if (enterBtn) {
        enterBtn.disabled = true;
        enterBtn.textContent = '⏳  BUILDING THE CITY…';
    }

    // sync start-screen controls with saved state
    const qSel = document.getElementById('qualitySel');
    const mChk = document.getElementById('musicChk');
    if (qSel) qSel.value = G.quality;
    if (mChk) mChk.checked = !!G.settings.music;

    // ── renderer ──
    /* MSAA is close to free on a desktop GPU and expensive on a tile-based
       mobile one, where it multiplies the bandwidth of every tile resolve.
       At DPR 1 on a small screen it also buys the least. */
    const renderer = new THREE.WebGLRenderer({
        antialias: !G.touchMode,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, G.preset.dpr));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    /* ACES was reverted once before because it "crushed the midtones". That was
       a real symptom of a different cause: facadeTint was clamping building
       colours in LINEAR space and forcing every wall into a near-white band, so
       the whole frame already sat in a ~0.18-wide sRGB window with no black
       point and nothing to roll off. With the tint clamp fixed and the fill
       lights rebalanced against sun shadows, there is real range to map, and
       ACES is what stops the sunlit faces from clipping flat. */
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    TEX.setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
    // Sun shadows. One directional light with a tight ortho frustum that
    // follows the player (World._updateShadowFrustum). Off on `low`.
    if (G.preset.shadowMap > 0) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.autoUpdate = true;
    }
    document.getElementById('app').appendChild(renderer.domElement);
    G.renderer = renderer;
    G.canvas = renderer.domElement;

    /* Before Player.init and Tutorial.init: the controller binds its gesture
       handlers to this canvas, and the walkthrough picks touch wording. */
    if (G.touchMode) Touch.init();

    G.scene = new THREE.Scene();
    /* near/far drive depth precision, and this scene stacks five near-coplanar
       ground surfaces inside 0.6 units (base −2, tiles 0.02, pavement 0.25,
       road 0.4, markings 0.62). At near=0.5/far=12000 a 24-bit buffer can only
       resolve ~0.48 units at 2000 out, so lane markings and pavement seams
       z-fought and flickered down every long avenue. near=4 is 40 cm — nothing
       gets that close to the eye given PLAYER_RADIUS 7 — and the hills top out
       around 6500, so far=8000 covers everything. ~10x the depth precision for
       two numbers. */
    G.camera = new THREE.PerspectiveCamera(G.settings.fov, innerWidth / innerHeight, 4, 8000);

    /* ── viewport ──────────────────────────────────────────────────────────
       One place that resizes. Mobile browsers fire `resize` for the URL bar
       sliding away, fire `orientationchange` BEFORE innerWidth/innerHeight
       have updated, and (iOS) report a stale innerHeight for a frame or two
       after either. Coalescing into a rAF and re-running after a short delay
       on orientation change is what stops the canvas from sitting there
       letterboxed at the previous aspect ratio. */
    let dynScale = 1;                 // adaptive-resolution multiplier, ≤1
    const applySize = () => {
        const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
        G.camera.aspect = w / h;
        G.camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, G.preset.dpr) * dynScale);
        renderer.setSize(w, h);
    };
    let sizeQueued = false;
    const queueSize = () => {
        if (sizeQueued) return;
        sizeQueued = true;
        requestAnimationFrame(() => { sizeQueued = false; applySize(); });
    };
    window.addEventListener('resize', queueSize);
    window.addEventListener('orientationchange', () => { queueSize(); setTimeout(applySize, 350); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', queueSize);

    // ── wire modules into G (order matters: layout before world) ──
    G.ui = UI;
    G.audio = Audio;
    G.world = World;
    G.citizens = Citizens;
    G.traffic = Traffic;
    G.weatherSys = Weather;
    G.player = Player;
    G.interact = Interact;
    G.tour = Tour;
    G.interior = Interior;

    City.layout();
    World.build();
    Weather.init(G.scene);
    /* The real AI models, BEFORE the citizens are built.

       Citizens.init sizes an InstancedMesh and its per-instance attribute
       buffers from the roster length, so the roster has to be final by the time
       it runs — fetching afterwards would mean tearing all of that down and
       rebuilding it mid-frame. Awaiting here costs one round trip on a cold
       boot (cached for six hours after that) and keeps the whole rebuild
       problem from existing. If it fails, Citizens falls back to the generated
       roster and the city boots exactly as it did before. */
    /* Hard ceiling on how long boot can wait. getAllRows pages sequentially and
       each page has its own 9s abort, so a bad network could otherwise stack up
       to ~18s of blank screen before the city appears. Whatever has arrived by
       then is used; the background refresh still writes the full list to cache
       for the next boot. */
    await Promise.race([Roster.load(), new Promise(r => setTimeout(r, 10000))]);
    G.roster = Roster;
    Citizens.init(G.scene);
    Traffic.init(G.scene);
    Signals.init(G.scene);
    G.signals = Signals;
    Interior.init(G.scene);
    Vendors.build(G.scene);
    ChatBubbles.init(G.scene);
    G.chatBubbles = ChatBubbles;
    Birds.init(G.scene);
    CitizenOfDay.init(G.scene);
    G.cotd = CitizenOfDay;
    G.birds = Birds;
    VCDealFlow.init(G.scene);
    ResearchPapers.init(G.scene);
    Metro.init(G.scene);
    Jail.init(G.scene);
    Court.init(G.scene);
    OrbitMode.init();
    FlyMode.init();
    Tour.init();
    XrayMode.init();
    Holomap.init(G.scene);
    Seasonal.init(G.scene);
    Kardashev.init(G.scene);
    Wetness.init(G.scene);
    Ambience.init(G.scene);
    G.ambience = Ambience;
    // after World.build: it needs the per-building instance handles to brown
    // out a starved datacentre without dimming the whole city
    SupplyChain.init(G.scene);
    G.supplyChain = SupplyChain;
    Terminal.init();
    G.vcDealFlow = VCDealFlow;
    G.researchPapers = ResearchPapers;
    G.metro = Metro;
    G.jail = Jail;
    G.court = Court;
    G.orbitModeSys = OrbitMode;
    G.flyModeSys = FlyMode;
    G.xrayModeSys = XrayMode;
    G.holomap = Holomap;
    G.seasonal = Seasonal;
    G.kardashev = Kardashev;
    G.wetness = Wetness;
    G.terminal = Terminal;
    // UI before Conference — unlock toasts need HUD nodes
    UI.init();
    Conference.init(G.scene);
    G.conference = Conference;
    Player.init();
    Interact.init();
    Player.placeAtSpawn();

    // Every system has now added its meshes — decide once who casts and who
    // receives, instead of each module having to remember.
    World.finalizeShadows(G.scene);

    // After UI + Player: the tutorial spotlights HUD nodes and both of these
    // take over the camera, so they need those to already exist.
    Tutorial.init();
    DailyBriefing.init();
    G.tutorial = Tutorial;
    G.dailyBriefing = DailyBriefing;

    // Integration: live data + view shell (CityStore already init via Progress)
    G.store = CityStore;
    G.live = Live;
    G.shell = Shell;
    Live.start();
    Shell.init();
    // After the store: it seeds from the current headlines so booting doesn't
    // fire a reaction for every story already in the feed.
    NewsReactivity.init(G.scene);
    G.newsReactivity = NewsReactivity;
    // Arriving from Pixi 2D: keep continuity via URL (?dp= etc.) and progress merge.
    // Do NOT auto-enter or toast "resumed" — the player should use the start screen
    // (quality / music / ENTER THE CITY). Consume any leftover resume token so it
    // cannot affect a later navigation.
    {
        const tok = readResumeToken();
        if (tok && tok.from === 'pixi') clearResumeToken();
    }

    // ── start screen ──
    const startGame = () => {
        G.settings.music = mChk ? mChk.checked : true;
        document.getElementById('startScreen').style.display = 'none';
        G.started = true;
        Player.enabled = true;
        Audio.init();
        UI.startHUD();
        UI.setWeather(Weather._label());
        // Idle screensaver clock starts when you actually enter the city
        if (Tour._lastInputAt != null) Tour._lastInputAt = performance.now();
        if (G.touchMode) {
            Touch.show();
            // The ENTER tap is the one user gesture fullscreen will accept
            // without a second prompt; take it.
            if (startGame._gesture) Touch.toggleFullscreen();
        } else if (startGame._gesture) {
            // Pointer lock needs a user gesture (autostart / from=pixi has none)
            Player.lock();
        } else {
            setTimeout(() => UI.addToast?.('Click the city to look around', 'info'), 500);
        }
        Progress.unlock('first_steps');
        setTimeout(() => UI.addToast(G.touchMode
            ? 'Tip: <b>☰</b> opens the menu · <b>⛶</b> goes fullscreen · <b>P</b>anels there too'
            : 'Tip: press <b>ESC</b> to free the mouse, <b>C</b> free-fly, or <b>P</b> for 2D City', 'info'), 2500);
        UI.banner('🏙️ SINGULARITY CITY', 'the entire AI industry, alive around you');
    };
    if (enterBtn) {
        enterBtn.disabled = false;
        enterBtn.textContent = enterLabel;
    }
    document.getElementById('enterBtn').addEventListener('click', () => {
        G.quality = qSel ? qSel.value : G.quality;
        if (G.quality !== bootQuality) {
            localStorage.setItem('sc_fp_quality', G.quality);
            location.reload();
            return;
        }
        startGame._gesture = true;
        startGame();
    });
    // ?autostart=1 — skip the start screen (embeds, kiosks, headless testing)
    const params = new URLSearchParams(location.search);
    if (params.get('autostart') === '1') { startGame._gesture = false; startGame(); }
    // dev/test params: ?dp=0.5 freeze time of day · ?x= &z= &yaw= teleport
    if (params.get('dp') !== null) G.fixedPhase = parseFloat(params.get('dp'));
    if (params.get('x') !== null && params.get('z') !== null) {
        Player.teleport(parseFloat(params.get('x')), parseFloat(params.get('z')),
            params.get('yaw') !== null ? parseFloat(params.get('yaw')) : undefined);
        Player.spawn = { x: parseFloat(params.get('x')), z: parseFloat(params.get('z')) };
    }

    // ?sim=<seconds> — fast-forward citizens and traffic before the first
    // frame, so a screenshot catches a city that has been living for a while
    // instead of one where everybody is still standing on their doorstep
    const sim = parseFloat(params.get('sim') || '0');
    if (sim > 0) {
        for (let t = 0; t < sim; t += 1 / 30) {
            G.time = t;                     // signal phase follows the clock
            Citizens.update(1 / 30);
            ChatBubbles.update(1 / 30);
            Birds.update(1 / 30, t);
            CitizenOfDay.update(1 / 30);
            Traffic.update(1 / 30, t);
            Signals.update(1 / 30);
            VCDealFlow.update(1 / 30);
            ResearchPapers.update(1 / 30);
            Metro.update(1 / 30);
            Ambience.update(1 / 30, t);
            Jail.update(1 / 30);
            Court.update(1 / 30);
        }
    }

    // ?wx=<state> — force a weather state (dev/testing)
    const wx = params.get('wx');
    if (wx) { Weather.set(wx); Weather._timer = 1e9; Weather.intensity = 1; }

    // ?inside=<buildingId> — boot straight into that building's lobby
    const insideId = params.get('inside');
    if (insideId && G.bldById[insideId]) Interior.enter(G.bldById[insideId]);

    // ?debug=1 — report draw calls / triangles after the scene warms up
    if (params.get('debug') === '1') {
        setTimeout(() => {
            const i = renderer.info.render;
            console.log(`[SC-FP DEBUG] drawCalls=${i.calls} triangles=${i.triangles} geometries=${renderer.info.memory.geometries} textures=${renderer.info.memory.textures}`);
        }, 3500);
    }

    // ── main loop ──
    const clock = new THREE.Clock();
    let fpsAcc = 0, fpsN = 0, fpsT = 0;
    const MIN_SCALE = 0.62;   // adaptive-resolution floor
    let scaleCool = 6;        // seconds of grace before the governor may act

    renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), 0.1);
        G.tick++;
        G.time = clock.elapsedTime;
        G.dayPhase = computeDayPhase(dt);
        CityStore.syncSim({
            dayPhase: G.dayPhase,
            timeScale: G.timeScale,
            weatherState: Weather.state,
            weatherIntensity: Weather.intensity,
            climate: Weather.climate
        });

        if (G.started && CityStore.getView() !== 'map') {
            if (!G.orbitMode && !G.terminalOpen) Player.update(dt);
            Tour.update(dt);
            FlyMode.update(dt);
            Interact.update(dt);
            Interior.update(dt);   // lift doors + the ride between floors
            Citizens.update(dt);
            ChatBubbles.update(dt);
            Birds.update(dt, G.time);
            CitizenOfDay.update(dt);
            Traffic.update(dt, G.time);
            Signals.update(dt);
            // Weather before Metro: metro re-locks fog/bg/sky every ride frame after weather writes.
            Weather.update(dt, G.time);
            World.update(dt, G.time);
            VCDealFlow.update(dt);
            ResearchPapers.update(dt);
            Metro.update(dt);
            Jail.update(dt);
            Court.update(dt);
            OrbitMode.update(dt);
            XrayMode.update(dt);
            Holomap.update(dt);
            Conference.update(dt);
            Seasonal.update(dt);
            Kardashev.update(dt);
            Wetness.update(dt);
            Ambience.update(dt, G.time);
            SupplyChain.update(dt);
            // after Weather: the crisis flicker overrides the window emissive ramp
            NewsReactivity.update(dt);
            // last: both take the camera, so they must run after Player/Tour
            Tutorial.update(dt);
            DailyBriefing.update(dt);
            Terminal.update(dt);
            UI.update(dt);
            {
                const snap = CityStore.getSnapshot();
                if (G.ui && typeof snap.aiIndex === 'number') {
                    G.ui.aiIndex = snap.aiIndex;
                    G.ui.aiDelta = snap.aiDelta || 0;
                }
            }
            Audio.setWeatherBeds(Weather.state, Weather.intensity, 1 - Math.max(0, Math.sin((G.dayPhase - 0.25) * Math.PI * 2)));
        }

        renderer.render(G.scene, G.camera);

        // perf tracking + adaptive resolution
        fpsAcc += dt; fpsN++; fpsT += dt;
        if (fpsT >= 2) {
            G.fps = Math.round(fpsN / fpsAcc);
            G.frameMs = (fpsAcc / fpsN) * 1000;
            fpsAcc = 0; fpsN = 0; fpsT = 0;
            /* A device that cannot hold 30 fps here is almost always
               pixel-bound rather than geometry-bound — the city is one
               InstancedMesh per crowd and a handful of merged material groups,
               but it fills every pixel with a shadowed, fogged, tone-mapped
               fragment. Trading resolution is therefore the cheapest recovery,
               and far less visible than the stutter it fixes. Never above the
               preset, three steps down at most, with a long cooldown so one
               hitch (entering a building, a weather change) cannot start an
               oscillation. */
            scaleCool -= 2;
            if (scaleCool <= 0 && G.fps > 0) {
                if (G.fps < 26 && dynScale > MIN_SCALE) {
                    dynScale = Math.max(MIN_SCALE, dynScale - 0.16);
                    applySize(); scaleCool = 8;
                } else if (G.fps > 55 && dynScale < 1) {
                    dynScale = Math.min(1, dynScale + 0.16);
                    applySize(); scaleCool = 20;
                }
                G.renderScale = dynScale;
            }
        }
    });
}

boot().catch(err => {
    console.error(err);
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#0a0e1a;color:#f472b6;font:14px monospace;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;z-index:999';
    el.textContent = 'Failed to boot Singularity City: ' + err.message;
    document.body.appendChild(el);
});



