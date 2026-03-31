/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ENTITIES LAYER (v16.4.0 - Dynamic Metro Pathing & Tracking)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Entities = {
    charLayer: null, carLayer: null, reflectionLayer: null, lightLayer: null,
    undergroundLayer: null, trainLayer: null,
    trainWest: null, trainEast: null,
    dataCubes: [],
    heliRefs: {},

    init(layers) {
        this.charLayer = layers.charLayer;
        this.carLayer = layers.carLayer; 
        this.reflectionLayer = layers.reflectionLayer; 
        this.lightLayer = layers.lightLayer;
        this.undergroundLayer = layers.undergroundLayer;
        this.trainLayer = layers.trainLayer; 

        if (this.undergroundLayer && this.trainLayer) {
            const trains = EntitiesGfx.initMetro(this.undergroundLayer, this.charLayer, this.carLayer, this.trainLayer);
            this.trainWest = trains.trainWest;
            this.trainEast = trains.trainEast;
            this.stationVisuals = trains.stationVisuals;
            this.bunkerGfx = trains.bunkerGfx;
            this.bunkerTxts = trains.bunkerTxts;
            this.lastCityW = typeof G !== 'undefined' ? G.cityW : 3400;
        }
        
        if (!G.ceoRefs) {
            G.ceoRefs = {};
            if (typeof REAL_FOUNDERS !== 'undefined') {
                const dp = G.getDayPhase();
                const night = dp > .83 || dp < .25;
                // On init, place CEOs based on current time:
                // Weekday work hours → HQ, otherwise → home
                const dayOfWeek = new Date().getDay();
                const isWeekendNow = dayOfWeek === 0 || dayOfWeek === 6;
                const atWork = !isWeekendNow && !night && dp >= 0.33 && dp <= 0.80;

                REAL_FOUNDERS.forEach(f => {
                    const ceoObj = EntitiesGfx.initCEO(f, this.carLayer, this.reflectionLayer);
                    
                    const hq = (G.bldsByLab[f.lab] || []).find(b => !b.id.startsWith('house_'));
                    const home = G.bldById['house_' + f.lab]; 
                    let destBld = atWork ? hq : home;

                    if (destBld) {
                        ceoObj.bld = destBld.id;
                        ceoObj.logicalX = destBld.x + destBld.w / 2;
                        ceoObj.carCont.visible = false;
                        ceoObj.refCont.visible = false;
                    }

                    G.ceoRefs[f.lab] = ceoObj;
                });
            }
        }
        
        // ─── HELICOPTERS: One per CEO, hidden until weekend Silicon Woods trips ───
        if (!this.heliRefs || Object.keys(this.heliRefs).length === 0) {
            this.heliRefs = {};
            if (typeof REAL_FOUNDERS !== 'undefined') {
                REAL_FOUNDERS.forEach(f => {
                    const heli = EntitiesGfx.initHelicopter(f, this.carLayer);
                    const home = G.bldById['house_' + f.lab];
                    if (home) {
                        heli.homeX = home.x + home.w / 2;
                        heli.homeY = G.groundY - 80;
                    }
                    this.heliRefs[f.lab] = heli;
                });
            }
        }
    },

    updateTrain() {
        const mResX = G.bldById['metro_res'] ? G.bldById['metro_res'].x + (G.bldById['metro_res'].w / 2) : 1350;
        const mHqX = G.bldById['metro_hq'] ? G.bldById['metro_hq'].x + (G.bldById['metro_hq'].w / 2) : 4700;
        const mEastX = G.bldById['metro_east'] ? G.bldById['metro_east'].x + (G.bldById['metro_east'].w / 2) : 7000;

        // 1. Shift the station graphics to follow the dynamically moving buildings
        if (this.stationVisuals) {
            if (this.stationVisuals[0]) {
                this.stationVisuals[0].statCont.x = mResX;
                this.stationVisuals[0].backCutout.x = mResX;
                this.stationVisuals[0].glassFront.x = mResX;
            }
            if (this.stationVisuals[1]) {
                this.stationVisuals[1].statCont.x = mHqX;
                this.stationVisuals[1].backCutout.x = mHqX;
                this.stationVisuals[1].glassFront.x = mHqX;
            }
            if (this.stationVisuals[2]) {
                this.stationVisuals[2].statCont.x = mEastX;
                this.stationVisuals[2].backCutout.x = mEastX;
                this.stationVisuals[2].glassFront.x = mEastX;
            }
        }

        // 2. Redraw silos if the city width updates (HQs expanding/pushing houses)
        if (G.cityW !== this.lastCityW) {
            this.lastCityW = G.cityW;
            if (this.bunkerGfx && this.bunkerTxts) {
                EntitiesGfx.drawBunkers(this.bunkerGfx, this.charLayer, this.bunkerTxts);
            }
        }

        // 3. Update the Train Routes to accurately connect to the new coordinates
        if (this.trainWest) {
            this.trainWest.st1 = mResX;
            this.trainWest.st2 = mHqX;
            // Instantly update targetX if a train was waiting at a station that just shifted
            if (this.trainWest.state === 'waiting') {
                if (Math.abs(this.trainWest.x - this.trainWest.st1) < 100) this.trainWest.x = this.trainWest.st1;
                else if (Math.abs(this.trainWest.x - this.trainWest.st2) < 100) this.trainWest.x = this.trainWest.st2;
                this.trainWest.c.x = this.trainWest.x;
            }
        }

        if (this.trainEast) {
            this.trainEast.st1 = mHqX;
            this.trainEast.st2 = mEastX;
            if (this.trainEast.state === 'waiting') {
                if (Math.abs(this.trainEast.x - this.trainEast.st1) < 100) this.trainEast.x = this.trainEast.st1;
                else if (Math.abs(this.trainEast.x - this.trainEast.st2) < 100) this.trainEast.x = this.trainEast.st2;
                this.trainEast.c.x = this.trainEast.x;
            }
        }

        // 4. Standard Train Logic Loop
        [this.trainWest, this.trainEast].forEach(t => {
            if (!t) return;
            if (t.state === 'waiting') {
                t.timer--;
                if (t.timer <= 0) {
                    t.state = 'moving';
                    t.targetX = (t.x === t.st1) ? t.st2 : t.st1;
                    t.dir = Math.sign(t.targetX - t.x);
                    
                    t.lightL.clear(); t.lightR.clear();
                    if (t.dir > 0) {
                        t.lightL.beginFill(0xef4444); t.lightL.drawCircle(-175, 0, 4); t.lightL.endFill();
                        t.lightR.beginFill(0x4ade80); t.lightR.drawCircle(175, 0, 4); t.lightR.endFill();
                    } else {
                        t.lightL.beginFill(0x4ade80); t.lightL.drawCircle(-175, 0, 4); t.lightL.endFill();
                        t.lightR.beginFill(0xef4444); t.lightR.drawCircle(175, 0, 4); t.lightR.endFill();
                    }
                }
            } else if (t.state === 'moving') {
                t.x += t.speed * t.dir;
                t.c.x = t.x;
                t.c.y = t.y + Math.sin(G.tick * 0.5) * 1.5;
                
                if (Math.abs(t.x - t.targetX) < t.speed) {
                    t.x = t.targetX;
                    t.c.x = t.x;
                    t.c.y = t.y; 
                    t.state = 'waiting';
                    t.timer = 180; 
                }
            }
            t.front.x = t.c.x;
            t.front.y = t.c.y;
        });
    },

    createChar(m) {
        EntitiesGfx.createChar(m, this.charLayer);
    },

    spawnCar() {
        const dir = Math.random() > .5 ? 1 : -1; 
        if (!G.cars.some(c => c.isTruck)) {
            const carObj = EntitiesGfx.spawnCar(this.carLayer, this.reflectionLayer, dir);
            G.cars.push(carObj);
        }
    },

    updateChatBubbles(dp) {
      if (G.tick % 150 !== 0) return;
      const maxBubbles = Math.min(15, Math.floor(G.models.length / 3)); let count = Object.keys(G.chatBubbles).length;
      G.models.forEach((m, i) => {
        if (count >= maxBubbles) return; if (G.chatBubbles[m.id] || Math.random() > 0.12) return;
        
        const refs = G.charRefs[m.id];
        if (refs && refs._streetState === 'chatting') return;

        const stg = getStage(m.rel, m.ret, m.phase); 
        const { act } = getAct(stg, dp, i, m); 
        
        const ai = (typeof ACTS !== 'undefined' && ACTS[act]) ? ACTS[act] : { indoor: true }; 
        if (!ai || ai.indoor) return; 
        
        const thoughts = {
            work: [`Processing tokens.`, `Optimizing parameters.`, `Calculating...`, `Running core routine.`],
            train: [`Gradient descent...`, `Ingesting data.`, `Adjusting weights...`, `Learning.`],
            socialize: [`Hello, world!`, `Syncing APIs.`, `Hey! I'm ${m.name.split(' ')[0]}.`, `Comparing contexts.`],
            play: [`Hallucinating wildly...`, `Dreaming of electric sheep.`, `Exploring latent space.`, `Generating art.`],
        };
        const pool = thoughts[act] || thoughts.work;
        const lifespan = 240 + Math.random() * 240;
        G.chatBubbles[m.id] = { msg: pool[Math.floor(Math.random() * pool.length)], expire: G.tick + lifespan }; count++;
      });
    },

    update(dp, night) {
      if (this.updateTrain) this.updateTrain(); 

      // Cache weekend check once per update (used by both CEO and model loops)
      if (!this._weekendCache || G.tick % 3600 === 0) {
          const d = new Date().getDay();
          this._isWeekendVal = d === 0 || d === 6;
          this._weekendCache = true;
      }
      const _isWeekend = this._isWeekendVal;

      if (G.ceoRefs) {
          // CEO Schedule — More dynamic than AI models.
          // They pop in/out of HQ during the day, drive around, grab meals at home.
          // Must be at HQ toward end of shift. Weekends: home or cruising.
          const block = Math.floor(dp * 48); // 30-min blocks for finer granularity
          
          Object.values(G.ceoRefs).forEach(ceo => {
              const hq = (G.bldsByLab[ceo.f.lab] || []).find(b => !b.id.startsWith('house_'));
              const home = G.bldById['house_' + ceo.f.lab]; 
              
              if (!hq) return;

              // Per-CEO deterministic seed so they don't all move in lockstep
              const ceoSeed = Array.from(ceo.f.lab).reduce((a, c) => a + c.charCodeAt(0), 0);
              const blockHash = Math.abs(Math.sin(ceoSeed * 7.3 + block * 13.7)) * 100;

              let destBld;
              let useHeli = false; // Flag: this CEO should fly to Silicon Woods

              if (_isWeekend) {
                  const siliconWoods = G.bldById['forest_1'];
                  if (dp < 0.30 || dp > 0.90) {
                      destBld = home; // sleeping
                  } else if (blockHash < 25 && siliconWoods) {
                      destBld = siliconWoods; // fly to Silicon Woods!
                      useHeli = true;
                  } else if (blockHash < 40) {
                      destBld = null; // out for a drive
                  } else {
                      destBld = home; // relaxing at home
                  }
              } else if (night) {
                  destBld = home; // night → go home to sleep
              } else if (dp < 0.30) {
                  // Early morning — still at home, getting ready
                  destBld = home;
              } else if (dp >= 0.30 && dp < 0.42) {
                  // Morning arrival — head to HQ
                  destBld = hq;
              } else if (dp >= 0.42 && dp < 0.55) {
                  // Late morning / lunch — some pop out for a meal at home
                  if (blockHash < 25) destBld = home;
                  else if (blockHash < 35) destBld = null; // quick drive
                  else destBld = hq;
              } else if (dp >= 0.55 && dp < 0.70) {
                  // Core afternoon — mostly at HQ, occasional errand
                  if (blockHash < 15) destBld = null; // quick drive
                  else destBld = hq;
              } else if (dp >= 0.70 && dp < 0.82) {
                  // End of shift — must be at HQ wrapping up
                  destBld = hq;
              } else {
                  // Evening departure → head home
                  destBld = home;
              }

              let targetX = destBld ? (destBld.x + destBld.w / 2) : (ceo.dir > 0 ? G.cityW + 600 : -600);
              
              // Track helicopter trip state across frames
              if (useHeli && destBld && destBld.id === 'forest_1') {
                  ceo._heliTrip = true;
              } else if (!useHeli || !destBld || destBld.id !== 'forest_1') {
                  ceo._heliTrip = false;
              }

              if (ceo.bld !== null && (!destBld || ceo.bld !== destBld.id)) {
                  ceo.wantsToLeave = true;
                  ceo.wantsToEnter = false;
                  
                  if (!G.activeInterior || G.activeInterior !== ceo.bld) {
                      const oldBld = G.bldById[ceo.bld];
                      if (oldBld) ceo.logicalX = oldBld.x + oldBld.w / 2;
                      ceo.bld = null;
                      ceo.wantsToLeave = false;
                  }
              } 
              else if (ceo.bld === null) {
                  if (destBld && ceo._heliTrip) {
                      // Helicopter handles travel — hide the car, the heli update loop moves the CEO
                      ceo.carCont.visible = false;
                      ceo.refCont.visible = false;
                      
                      const heli = Entities.heliRefs[ceo.f.lab];
                      if (heli && heli.state === 'grounded' && destBld.id === 'forest_1') {
                          // Helicopter has landed — CEO enters the woods
                          ceo.wantsToEnter = true;
                          ceo.bld = destBld.id;
                          ceo.logicalX = targetX;
                      }
                  } else if (destBld) {
                      ceo.carCont.visible = true;
                      ceo.refCont.visible = true;
                      ceo.dir = Math.sign(targetX - ceo.logicalX) || 1;
                      ceo.logicalX += ceo.dir * ceo.speed;

                      if (Math.abs(ceo.logicalX - targetX) < 15) {
                          ceo.wantsToEnter = true;
                          ceo.bld = destBld.id;
                          ceo.carCont.visible = false;
                          ceo.refCont.visible = false;
                      }
                  } 
                  else {
                      ceo.carCont.visible = true;
                      ceo.refCont.visible = true;
                      ceo.dir = Math.sign(targetX - ceo.logicalX) || ceo.dir;
                      ceo.logicalX += ceo.dir * ceo.speed;
                      
                      if (ceo.logicalX < -500 || ceo.logicalX > G.cityW + 500) {
                          ceo.carCont.visible = false;
                          ceo.refCont.visible = false;
                      }
                  }
              }

              if (ceo.carCont.visible) {
                  const laneY = ceo.dir > 0 ? 26 : 12;
                  ceo.carCont.x = ceo.logicalX;
                  ceo.carCont.y = G.groundY + laneY;
                  ceo.carCont.scale.x = ceo.dir;
                  ceo.carCont.zIndex = Math.round(ceo.carCont.y);
                  
                  ceo.refCont.x = ceo.logicalX;
                  ceo.refCont.y = ceo.carCont.y;
                  ceo.refCont.scale.x = ceo.dir;
                  ceo.refCont.scale.y = -1;

                  ceo.beam.alpha = this.lightLayer.alpha;
              }
          });
      }

      // ─── HELICOPTER UPDATE LOOP ───
      if (this.heliRefs) {
          const siliconWoods = G.bldById['forest_1'];
          const helipadX = siliconWoods ? siliconWoods.x + 80 : 0; // helipad is left side of woods
          const helipadY = G.groundY - 30;
          
          Object.entries(this.heliRefs).forEach(([lab, heli]) => {
              const ceo = G.ceoRefs ? G.ceoRefs[lab] : null;
              if (!ceo) return;
              
              // Rotor spin animation (always when visible)
              if (heli.cont.visible && heli.rotor) {
                  heli.rotor.rotation += (heli.state === 'grounded' ? 0.05 : 0.4);
                  heli.rotorBlur.visible = heli.state !== 'grounded';
              }
              
              switch (heli.state) {
                  case 'hidden':
                      heli.cont.visible = false;
                      // Trigger: CEO wants to go to Silicon Woods
                      if (ceo._heliTrip && ceo.bld === null && siliconWoods) {
                          const home = G.bldById['house_' + lab];
                          heli.logicalX = home ? home.x + home.w / 2 : ceo.logicalX;
                          heli.logicalY = G.groundY - 80;
                          heli.targetX = helipadX;
                          heli.targetY = helipadY;
                          heli.state = 'flying_to';
                          heli.cont.visible = true;
                          heli.cont.x = heli.logicalX;
                          heli.cont.y = heli.logicalY;
                      }
                      break;
                      
                  case 'flying_to': {
                      heli.cont.visible = true;
                      const dx = heli.targetX - heli.logicalX;
                      const dy = heli.targetY - heli.logicalY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      
                      if (dist < heli.speed) {
                          heli.logicalX = heli.targetX;
                          heli.logicalY = heli.targetY;
                          heli.state = 'landing';
                          heli.timer = 60;
                      } else {
                          heli.logicalX += (dx / dist) * heli.speed;
                          heli.logicalY += (dy / dist) * heli.speed;
                      }
                      
                      heli.cont.x = heli.logicalX;
                      heli.cont.y = heli.logicalY + Math.sin(G.tick * 0.08) * 3;
                      heli.cont.scale.x = dx > 0 ? 1 : -1;
                      break;
                  }
                  
                  case 'landing':
                      heli.timer--;
                      // Gentle descent
                      heli.cont.y = heli.logicalY + (60 - heli.timer) * 0.3;
                      if (heli.timer <= 0) {
                          heli.state = 'grounded';
                          heli.cont.y = helipadY + 18;
                      }
                      break;
                      
                  case 'grounded':
                      heli.cont.visible = true;
                      heli.cont.x = helipadX;
                      heli.cont.y = helipadY + 18;
                      // Wait for CEO to leave Silicon Woods
                      if (!ceo._heliTrip || ceo.bld !== 'forest_1') {
                          heli.state = 'takeoff';
                          heli.timer = 60;
                          heli.logicalX = helipadX;
                          heli.logicalY = helipadY + 18;
                      }
                      break;
                      
                  case 'takeoff':
                      heli.timer--;
                      heli.cont.y = heli.logicalY - (60 - heli.timer) * 0.5;
                      if (heli.timer <= 0) {
                          const home = G.bldById['house_' + lab];
                          heli.targetX = home ? home.x + home.w / 2 : heli.homeX;
                          heli.targetY = G.groundY - 80;
                          heli.logicalY = heli.cont.y;
                          heli.state = 'flying_home';
                      }
                      break;
                      
                  case 'flying_home': {
                      heli.cont.visible = true;
                      const dx = heli.targetX - heli.logicalX;
                      const dy = heli.targetY - heli.logicalY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      
                      if (dist < heli.speed) {
                          heli.state = 'hidden';
                          heli.cont.visible = false;
                      } else {
                          heli.logicalX += (dx / dist) * heli.speed;
                          heli.logicalY += (dy / dist) * heli.speed;
                      }
                      
                      heli.cont.x = heli.logicalX;
                      heli.cont.y = heli.logicalY + Math.sin(G.tick * 0.08) * 3;
                      heli.cont.scale.x = dx > 0 ? 1 : -1;
                      break;
                  }
              }
          });
      }

      G.cars = G.cars.filter(c => { 
        c.gfx.x += c.dir * c.speed; 
        if (c.ref) c.ref.x = c.gfx.x; 
        if (c.beam) c.beam.alpha = this.lightLayer.alpha; 
        const laneY = c.dir > 0 ? 26 : 12; c.gfx.y = G.groundY + laneY; 
        if (c.ref) c.ref.y = c.gfx.y;
        if (c.gfx.x < -80 || c.gfx.x > G.cityW + 80) { 
            c.gfx.destroy(); 
            if (c.ref) c.ref.destroy(); 
            return false; 
        } 
        return true; 
      });
      
      const occ = {}; if (!G.familyDestinations) G.familyDestinations = {}; if (!G.lastBlock) G.lastBlock = -1;
      
      // Viewport culling boundaries (with generous margin)
      const camLeft = -Camera.x - 400;
      const camRight = -Camera.x + G.vpW / Camera.zoom + 400;
      
      G.models.forEach((m, i) => {
        // Cache stage/act — only recalculate once per second (60 frames)
        if (!m._cachedTick || G.tick - m._cachedTick >= 60) {
            m._cachedStg = getStage(m.rel, m.ret, m.phase);
            m._cachedSd = STAGES[m._cachedStg];
            const result = getAct(m._cachedStg, dp, i, m);
            m._cachedAct = result.act;
            m._cachedBid = result.bid;
            m._cachedTick = G.tick;
        }
        const stg = m._cachedStg; const sd = m._cachedSd; const sc = sd.size; 
        const act = m._cachedAct; const bid = m._cachedBid;
        
        const ai = (typeof ACTS !== 'undefined' && ACTS[act]) ? ACTS[act] : ((typeof ACTS !== 'undefined' && ACTS['work']) ? ACTS['work'] : { indoor: true, icon: '💻', label: 'Processing' });
        
        let defaultHq = (G.bldsByLab[m.lab] || []).find(x => !x.id.startsWith('house_')) || (G.bldsByLab[m.lab] || [])[0];
        let tBld = bid ? G.bldById[bid] : defaultHq || G.bldById['nursery'];
        const isSocial = act === 'lunch' || act === 'socialize' || act === 'play' || act === 'benchmark' || act === 'share' || act === 'train' || act === 'arena'; const block = Math.floor(dp * 24);
  
        if (isSocial && !night) {
          if (m._sb !== block) { 
              m._sb = block; 
              const r = Math.abs(Math.sin(i * 12.3 + block * 4.5)); 
              if (G.lastBlock !== block) { G.familyDestinations = {}; G.lastBlock = block; } 
              const fk = m.lab + '_' + act; 
              if (r <= .8 && G.familyDestinations[fk]) m._sid = G.familyDestinations[fk]; 
              else { 
                  // FIX: On weekdays, completely exclude Pine Reserve (forest_0).
                  // It's only available as a weekend/holiday camping destination.
                  let sp = G.socialSpots;
                  if (sp && sp.length > 0) {
                      if (!_isWeekend) {
                          sp = sp.filter(b => b.id !== 'forest_0');
                      }
                      
                      if (sp.length > 0) {
                          let ch = sp[Math.floor(Math.abs(Math.sin(i * 2.1 + block)) * sp.length)]; 
                          if (ch) { m._sid = ch.id; if (r <= .8) G.familyDestinations[fk] = ch.id; }
                      }
                  }
              } 
          }
          if (m._sid) { const o = G.bldById[m._sid]; if (o) tBld = o; }
        } else m._sb = -1;
        
        if (tBld && tBld.id === 'park') {
            tBld = G.bldById['open_square'] || G.bldById['cafe'] || defaultHq;
            m._sid = tBld ? tBld.id : null;
        }

        if (!tBld && BLDS && BLDS.length > 0) tBld = BLDS[0];
        if (!tBld) return; 
  
        const isIn = ai.indoor; const isR = stg === 'retired';
        const isRm = stg === 'rumored';
        if (isIn && !isR) { if (!occ[tBld.id]) occ[tBld.id] = [];
        occ[tBld.id].push({ name: m.name, lab: m.lab, act }); }
  
        const refs = G.charRefs[m.id];
        if (!refs) return;
        
        if (typeof refs._metroState === 'undefined') refs._metroState = 'none';
        if (typeof refs._logicalY === 'undefined') refs._logicalY = G.groundY - 20;

        // ─── VIEWPORT CULLING: Skip expensive updates for off-screen indoor characters ───
        // Characters inside buildings (invisible) only need occasional checks
        // Characters on metro or on-screen need full updates
        const isOnScreen = refs.c.x >= camLeft && refs.c.x <= camRight;
        const isOnMetro = refs._metroState !== 'none';
        if (!isOnScreen && !isOnMetro && refs.bld !== null && refs.c.visible === false) {
            // Off-screen + inside a building = skip all movement/animation
            // Only check every 120 frames if they should leave
            if (G.tick % 120 !== (i % 120)) return;
        }

        const bldSpread = Math.max(tBld.w - 10, 30); 
        const pseudoRandomOffset = ((i * 73) % bldSpread) - (bldSpread / 2);
        let buildingTargetX = tBld.x + (tBld.w / 2) + pseudoRandomOffset;

        if (!refs._initPos) {
            refs.c.x = buildingTargetX;
            refs._logicalY = G.groundY - 20;
            refs._initPos = true;
            refs._metroState = 'none';
            refs._metroLegs = null;
            refs.bld = isR ? null : tBld.id; 
        }

        const isInside = refs.bld !== null;

        if (refs.bld !== tBld.id) {
            if (isInside) {
                refs.wantsToLeave = true;
                if (G.activeInterior !== refs.bld) {
                    const b = G.bldById[refs.bld];
                    if (b) refs.c.x = b.x + (b.w / 2);
                    refs.bld = null;
                    refs.wantsToLeave = false;
                    refs.c.visible = true;
                } else {
                    refs.c.visible = false;
                }
            } else {
                refs.c.visible = true;
                
                let finalTargetX = buildingTargetX;
                let finalTargetY = G.groundY - 20;
                let freezeX = false; 

                const mResX = G.bldById['metro_res'] ? G.bldById['metro_res'].x + (G.bldById['metro_res'].w / 2) : 1350;
                const mHqX = G.bldById['metro_hq'] ? G.bldById['metro_hq'].x + (G.bldById['metro_hq'].w / 2) : 4700;
                const mEastX = G.bldById['metro_east'] ? G.bldById['metro_east'].x + (G.bldById['metro_east'].w / 2) : 7000;
                
                const getRegion = (x) => x < (mResX + mHqX)/2 ? 1 : x < (mHqX + mEastX)/2 ? 2 : 3;

                if (refs._metroState === 'none' && !refs._metroLegs) {
                    let myReg = getRegion(refs.c.x);
                    let dstReg = getRegion(buildingTargetX);
                    
                    if (myReg !== dstReg) {
                        if (myReg === 1 && dstReg === 2) refs._metroLegs = [mResX, mHqX];
                        else if (myReg === 2 && dstReg === 1) refs._metroLegs = [mHqX, mResX];
                        else if (myReg === 2 && dstReg === 3) refs._metroLegs = [mHqX, mEastX];
                        else if (myReg === 3 && dstReg === 2) refs._metroLegs = [mEastX, mHqX];
                        else if (myReg === 1 && dstReg === 3) refs._metroLegs = [mResX, mHqX, mEastX];
                        else if (myReg === 3 && dstReg === 1) refs._metroLegs = [mEastX, mHqX, mResX];
                        
                        if (refs._metroLegs) {
                            refs._currentLeg = 0;
                            refs._metroState = 'entering';
                        }
                    }
                }

                const platformMaxSpread = 160;
                const stationSpread = Math.max(-platformMaxSpread, Math.min(platformMaxSpread, pseudoRandomOffset * 1.5)); 
                const platformY = G.groundY + 112; 

                if (refs._metroLegs && refs._metroLegs.length > 0) {
                    let s1 = refs._metroLegs[refs._currentLeg];
                    let s2 = refs._metroLegs[refs._currentLeg + 1];
                    
                    let activeTrain = null;
                    if ((s1 === mResX && s2 === mHqX) || (s1 === mHqX && s2 === mResX)) activeTrain = this.trainWest;
                    else if ((s1 === mHqX && s2 === mEastX) || (s1 === mEastX && s2 === mHqX)) activeTrain = this.trainEast;

                    if (refs._metroState === 'entering') {
                        finalTargetX = s1;
                        if (Math.abs(refs.c.x - s1) < 5) {
                            refs.c.x = s1;
                            freezeX = true; 
                            finalTargetY = platformY;
                            if (refs._logicalY >= platformY - 5) refs._metroState = 'waiting_train';
                        } else {
                            finalTargetY = G.groundY - 20; 
                        }
                    } else if (refs._metroState === 'waiting_train') {
                        finalTargetX = s1 + stationSpread;
                        finalTargetY = platformY;
                        
                        if (activeTrain && activeTrain.state === 'waiting' && activeTrain.x === s1) {
                            if (activeTrain.passengers < 15) {
                                activeTrain.passengers++;
                                refs._metroState = 'riding';
                                refs._ridingTrain = activeTrain;
                            }
                        }
                    } else if (refs._metroState === 'riding') {
                        freezeX = true;
                        let t = refs._ridingTrain;
                        if (t) {
                            refs.c.x = t.x + (pseudoRandomOffset * 1.5);
                            if (t.state === 'waiting' && t.x === s2) {
                                t.passengers = Math.max(0, t.passengers - 1);
                                refs.c.x = s2;
                                refs._currentLeg++;
                                if (refs._currentLeg >= refs._metroLegs.length - 1) {
                                    refs._metroState = 'exiting';
                                } else {
                                    refs._metroState = 'waiting_train';
                                }
                                refs._ridingTrain = null;
                            }
                        } else {
                            refs._metroState = 'none';
                            refs._metroLegs = null;
                        }
                    } else if (refs._metroState === 'exiting') {
                        let currentStationX = refs._metroLegs[refs._currentLeg];
                        finalTargetX = currentStationX;
                        finalTargetY = G.groundY - 20;
                        refs.c.x = currentStationX;
                        freezeX = true; 
                        if (refs._logicalY <= finalTargetY + 5) {
                            refs._metroState = 'none';
                            refs._metroLegs = null;
                        }
                    }
                }

                let atBuilding = Math.abs(refs.c.x - buildingTargetX) < 40;
                
                if (atBuilding && refs._metroState === 'none' && !isR) { 
                    refs.bld = tBld.id;
                    refs.wantsToEnter = true;
                    refs.c.visible = false;
                }

                if (refs.c.visible) {
                    if (refs._metroState === 'entering' || refs._metroState === 'exiting') {
                        if (!refs.elev) {
                            EntitiesGfx.createElevatorPlatform(refs);
                        }
                        refs.elev.visible = true;
                    } else if (refs.elev) {
                        refs.elev.visible = false;
                    }

                    if (!isR && refs._streetState === 'walking' && isOnScreen && G.tick % 30 === (i % 30)) {
                        const myId = m.id;
                        const myX = refs.c.x;
                        // Only search a limited window of models, not all 730
                        let partnerObj = null;
                        for (let si = Math.max(0, i - 25); si < Math.min(G.models.length, i + 25); si++) {
                            const otherM = G.models[si];
                            if (otherM.id === myId) continue;
                            const otherRefs = G.charRefs[otherM.id];
                            if (!otherRefs || !otherRefs.c.visible || otherRefs._streetState !== 'walking' || otherRefs._chatTimer > 0) continue;
                            if (Math.abs(otherRefs.c.x - myX) < 30) { partnerObj = otherM; break; }
                        }
                        if (partnerObj && Math.random() < 0.05) {
                            const partnerRefs = G.charRefs[partnerObj.id];
                            refs._streetState = 'chatting';
                            partnerRefs._streetState = 'chatting';
                            refs._chatTimer = 180 + Math.random() * 120;
                            partnerRefs._chatTimer = refs._chatTimer;
                            refs.c.scale.x = Math.sign(partnerRefs.c.x - refs.c.x) || 1;
                            partnerRefs.c.scale.x = Math.sign(refs.c.x - partnerRefs.c.x) || -1;
                            const streetTopics = ["Going to HQ?", "Did you see the benchmarks?", "Market is volatile.", "I need an update.", "Heading to the cafe."];
                            G.chatBubbles[m.id] = { msg: streetTopics[Math.floor(Math.random() * streetTopics.length)], expire: G.tick + 100 };
                            setTimeout(() => { 
                                if (!G.activeInterior && partnerRefs._streetState === 'chatting') {
                                    const replies = ["Yeah.", "I know right?", "See you later.", "Compute is scarce.", "Indeed."];
                                    G.chatBubbles[partnerObj.id] = { msg: replies[Math.floor(Math.random() * replies.length)], expire: G.tick + 100 };
                                }
                            }, 1500);
                        }
                    }

                    let wobble = 0;
                    const weatherSpeedMod = (typeof Environment !== 'undefined' && Environment.weather === 'snow') ? 0.6 : 1;
                    const pScale = refs.paramScale || 1.0; 
                    const pSpeedMod = 1.4 - (pScale * 0.3); 

                    if (refs._metroState === 'none' && !refs._metroLegs) {
                        const ws = .0015 * sd.speed * weatherSpeedMod * pSpeedMod * (typeof Environment !== 'undefined' && Environment.weather === 'rain' && act === 'commute' ? 1.5 : 1);
                        const wAmt = (act === 'commute' ? (typeof Environment !== 'undefined' && Environment.weather === 'rain' ? 120 : 80) : (isSocial ? 50 : 20)) * pScale;
                        wobble = Math.sin(i * 1.7 + G.tick * ws) * wAmt;
                    }

                    const currentTargetX = finalTargetX + wobble;
                    const distX = currentTargetX - refs.c.x;
                    
                    let currentDir = 1;
                    let bobY = isR ? (Math.sin(G.tick * 0.05 + i) * 8 + 15) : (Math.sin(G.tick * 0.06) * 2);
                    let legA = isR ? 0 : Math.sin(G.tick * .12 * weatherSpeedMod * pSpeedMod) * 2 * pScale;
                    let depthOffset = (i * 37) % 24;
                    if (refs._metroState !== 'none' && refs._metroState !== 'riding') {
                        depthOffset = (i * 37) % 6; 
                    }

                    let isSitting = false;

                    if (refs._metroState === 'riding') {
                        currentDir = refs._ridingTrain ? refs._ridingTrain.dir : 1;
                        bobY = 0; 
                        legA = 0;
                        depthOffset = 0; 
                        isSitting = true;
                        refs._logicalY = G.groundY + 120 + 4; 
                    } else if (refs._streetState === 'chatting') {
                        refs._chatTimer--;
                        if (refs._chatTimer <= 0) {
                            refs._streetState = 'walking';
                            refs._chatTimer = 100;
                        }
                        currentDir = refs.c.scale.x;
                        bobY = Math.sin(G.tick * 0.02 + i) * 1;
                        legA = 0; 
                    } else {
                        const walkSpeed = sd.speed * weatherSpeedMod * pSpeedMod * (act === 'commute' ? 1.5 : 1);
                        
                        if (!freezeX) {
                            if (Math.abs(distX) > walkSpeed) {
                                refs.c.x += Math.sign(distX) * walkSpeed;
                                currentDir = Math.sign(distX);
                                legA = isR ? 0 : Math.sin(G.tick * 0.15 * weatherSpeedMod * pSpeedMod) * 2 * pScale; 
                            } else {
                                refs.c.x = currentTargetX;
                                currentDir = Math.sign(distX) || 1;
                                if (wobble !== 0) {
                                    const ws = .0015 * sd.speed * weatherSpeedMod * pSpeedMod * (typeof Environment !== 'undefined' && Environment.weather === 'rain' && act === 'commute' ? 1.5 : 1);
                                    currentDir = Math.cos(i * 1.7 + G.tick * ws) > 0 ? 1 : -1;
                                }
                            }
                        }

                        const distY = finalTargetY - refs._logicalY;
                        if (Math.abs(distY) > 3) {
                            refs._logicalY += Math.sign(distY) * 3; 
                            bobY = 0; legA = 0; 
                        } else {
                            refs._logicalY = finalTargetY; 
                        }
                    }
                    
                    refs.c.y = refs._logicalY - bobY + depthOffset;
                    refs.c.scale.x = currentDir; 
                    refs.c.zIndex = Math.round(refs.c.y);
                    
                    if (isSitting) {
                        refs.legL.rotation = -Math.PI / 2;
                        refs.legR.rotation = -Math.PI / 2;
                        refs.legL.y = -2 * (sc * pScale);
                        refs.legR.y = -2 * (sc * pScale);
                        const h = Math.round(32 * sc * pScale);
                        const headH = Math.round(h * sd.headR);
                        refs.body.y = -h + headH + (4 * sc * pScale);
                        refs.head.y = -h + (4 * sc * pScale);
                    } else {
                        refs.legL.rotation = 0;
                        refs.legR.rotation = 0;
                        refs.legL.y = legA;
                        refs.legR.y = -legA;
                        const h = Math.round(32 * sc * pScale);
                        const headH = Math.round(h * sd.headR);
                        refs.body.y = -h + headH;
                        refs.head.y = -h;
                    }
                    
                    refs.c.alpha = isR ? (0.25 + Math.abs(Math.sin(G.tick * 0.03 + i)) * 0.4) : isRm ? .55 : 1;
                    refs.c.blendMode = isR ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
                    
                    if (refs.isMoE && refs.c.visible && refs._metroState === 'none' && !isR) {
                        refs.ghostL.visible = true;
                        refs.ghostR.visible = true;
                        const bw = Math.round(16 * sc * pScale);
                        const splitAmt = Math.abs(distX) > 0.5 ? (bw * 0.7) : (bw * 0.2); 
                        
                        refs.ghostL.x = -splitAmt + Math.sin(G.tick * 0.1 + i) * 3;
                        refs.ghostR.x = splitAmt + Math.cos(G.tick * 0.1 + i) * 3;
                        refs.ghostL.alpha = 0.4 + Math.sin(G.tick * 0.05 + i) * 0.2;
                        refs.ghostR.alpha = 0.4 + Math.cos(G.tick * 0.05 + i) * 0.2;
                        
                        refs.ghostL.y = refs.body.y + Math.sin(G.tick * 0.2) * 2;
                        refs.ghostR.y = refs.body.y + Math.cos(G.tick * 0.2) * 2;
                    } else {
                        refs.ghostL.visible = false;
                        refs.ghostR.visible = false;
                    }
                    
                    const isOutside = !isIn && !isR && refs._metroState === 'none' && refs.c.visible;
                    
                    if (isOutside && typeof Environment !== 'undefined' && Environment.weather === 'rain') {
                        refs.umbrella.visible = true;
                        refs.umbrella.rotation = (currentDir === 1 ? 0.1 : -0.1) + Math.sin(G.tick * 0.1 + i) * 0.05;
                    } else {
                        refs.umbrella.visible = false;
                    }

                    if (!m.os && isOutside && act === 'commute') {
                        refs.briefcase.visible = true;
                        refs.briefcase.rotation = Math.sin(G.tick * 0.15 * (1.4 - (pScale*0.3))) * 0.2;
                    } else {
                        refs.briefcase.visible = false;
                    }
                }
            }
        } else {
            refs.wantsToLeave = false;
            if (isInside) {
                refs.c.visible = false;
                if (G.activeInterior !== refs.bld) refs.wantsToEnter = false;
            } else {
                refs.c.visible = true;
            }
        }

        if (m.os && act === 'share' && Math.random() < 0.05 && refs.c.visible && !isR) {
            EntitiesGfx.spawnDataCube(m, refs, this.charLayer, this.dataCubes);
        }

        const bub = G.chatBubbles[m.id];
        const hasBub = bub && bub.expire > G.tick;
        if (hasBub && refs._chatMsg !== bub.msg) { 
            EntitiesGfx.updateChatBubbleVisuals(refs, bub.msg);
            refs.chat.visible = true; 
            refs.chat.y = -32 * sc * (refs.paramScale||1) - 14; 
            refs._chatMsg = bub.msg;
        } else if (!hasBub && refs._chatMsg) { 
            refs.chat.visible = false;
            refs._chatMsg = null; 
            delete G.chatBubbles[m.id]; 
        }
        
        refs.chat.scale.x = refs.c.scale.x > 0 ? 1 : -1;
        
        const stateKey = stg + '|' + act + '|' + m.lab + '|' + (refs.paramScale||1);
        if (refs._state !== stateKey) {
            refs._state = stateKey;
            const lab = LABS[m.lab] || LABS.other || {color: '#64748b'}; 
            const colHex = parseInt(lab.color.slice(1), 16);
            EntitiesGfx.updateCharStateVisuals(m, refs, stg, isR, isRm, sc, sd, colHex);
        }
      });
      
      if (this.dataCubes) {
          for (let i = this.dataCubes.length - 1; i >= 0; i--) {
              let c = this.dataCubes[i];
              c.x += c.vx;
              c.y += c.vy;
              c.vy += 0.15;
              c.life--;
              c.alpha = Math.min(1, c.life / 20);
              c.rotation += c.vx * 0.05;
              
              if (c.y > G.groundY - 2) {
                  c.y = G.groundY - 2;
                  c.vy = 0;
                  c.vx *= 0.8;
              }
              
              if (c.life <= 0) {
                  c.destroy();
                  this.dataCubes.splice(i, 1);
              }
          }
      }
      
      return occ;
    }
};

