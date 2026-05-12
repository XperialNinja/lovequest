// ============================================================
//  MINIGAME NETWORK LAYER  (netMG)
//  Host runs all game logic.  Guest sends keys, receives state.
//  How it works:
//   1. When a minigame starts the host sends { type:"mgStart", mode }
//      so the guest opens the same minigame overlay.
//   2. Guest sends { type:"mgKeys", keys:{...} } ~30x/sec.
//   3. Host merges guest keys into its simulation for player 1.
//   4. Host sends { type:"mgState", state } ~20x/sec with full positions.
//   5. Guest renders from received state - no local physics.
//   6. When done host sends { type:"mgEnd", rewards }.
// ============================================================
const netMG = {
  guestKeys: {},

  isHost()      { return typeof netRole==="undefined"||netRole==="host"||netRole===null; },
  isGuest()     { return typeof netRole!=="undefined"&&netRole==="guest"; },
  connected()   { return typeof netConn!=="undefined"&&netConn&&netConn.open; },

  broadcastStart(mode) {
    if(!this.connected()) return;
    try{ netConn.send({type:"mgStart",mode}); }catch(e){}
  },

  _keyTimer:0,
  sendKeys(keys) {
    if(!this.connected()) return;
    if(++this._keyTimer%2!==0) return;
    try{ netConn.send({type:"mgKeys",keys:Object.assign({},keys)}); }catch(e){}
  },

  _stateTimer:0,
  sendState(state) {
    if(!this.connected()) return;
    if(++this._stateTimer%3!==0) return;
    try{ netConn.send({type:"mgState",state}); }catch(e){}
  },

  broadcastEnd(rewards) {
    if(!this.connected()) return;
    try{ netConn.send({type:"mgEnd",rewards}); }catch(e){}
  },

  _onState:null, _onEnd:null,
  onState(cb){ this._onState=cb; },
  onEnd(cb)  { this._onEnd=cb;   },

  handleData(data) {
    if(!data) return;
    if(data.type==="mgKeys")              this.guestKeys=data.keys||{};
    if(data.type==="mgState"&&this._onState) this._onState(data.state);
    if(data.type==="mgEnd"  &&this._onEnd)   this._onEnd(data.rewards);
  },

  // Merge local (host) keys + remote (guest) keys.
  // Guest keys map to virtual p1_ prefixed keys used for player[1] movement.
  mergedKeys(localKeys) {
    const m=Object.assign({},localKeys);
    const g=this.guestKeys;
    if(g["ArrowLeft"] ||g["a"]) m["p1_left"] =true;
    if(g["ArrowRight"]||g["d"]) m["p1_right"]=true;
    if(g["ArrowUp"]   ||g["w"]) m["p1_up"]   =true;
    if(g["ArrowDown"] ||g["s"]) m["p1_down"] =true;
    if(g[" "])                   m["p1_space"]=true;
    return m;
  },

  reset() {
    this.guestKeys={};this._onState=null;this._onEnd=null;
    this._keyTimer=0;this._stateTimer=0;
  },
};

// ============================================================
//  LOVEQUEST – minigames.js  Alpha v2
// ============================================================

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────
// Set MG.forcedMode = "FFA" | "FFA_DIG" | "DUOS" | "DUOS_RACE" | "1v3" | "1V3_TAG"
// before triggering to skip the random roll (for testing).
function triggerMinigame(landingPlayer, onComplete) {
  MG.landingPlayer = landingPlayer;
  MG.onComplete    = onComplete;
  MG.showModeRoll();
}

// ─────────────────────────────────────────────────────────────
//  CORE
// ─────────────────────────────────────────────────────────────
const MG = {
  landingPlayer: null,
  onComplete:    null,
  overlay:       null,
  canvas:        null,
  ctx:           null,
  animId:        null,
  frameTime:     0,
  lastTime:      0,
  forcedMode:    null,   // set externally for testing

  // ── Mode pools: one game per category picked randomly ──────
  FFA_MODES:  ["FFA","FFA_DIG"],
  DUOS_MODES: ["DUOS","DUOS_RACE"],
  V3_MODES:   ["1v3","1V3_TAG"],

  pickMode() {
    if (this.forcedMode) { const m=this.forcedMode; this.forcedMode=null; return m; }
    const cats=[this.FFA_MODES, this.DUOS_MODES, this.V3_MODES];
    const cat=cats[Math.floor(Math.random()*cats.length)];
    return cat[Math.floor(Math.random()*cat.length)];
  },

  stopLoop() { if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; } },

  startLoop(fn) {
    this.stopLoop();
    const tick = (ts) => {
      this.frameTime = ts;
      const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
      this.lastTime  = ts;
      fn(dt, ts);
      this.animId = requestAnimationFrame(tick);
    };
    this.lastTime = performance.now();
    this.animId   = requestAnimationFrame(tick);
  },

  buildOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "mgOverlay";
    this.overlay.style.cssText = `position:fixed;inset:0;z-index:500;background:#080814;
      font-family:'Fredoka One',cursive;color:white;overflow:hidden;cursor:default;`;
    document.body.appendChild(this.overlay);
    this.canvas = document.createElement("canvas");
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.cssText = "position:absolute;inset:0;display:block;";
    this.overlay.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
  },

  closeOverlay() {
    this.stopLoop();
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    this.canvas = null; this.ctx = null;
  },

  finish(rewards) {
    rewards.forEach(r => { if (r.coins > 0) players[r.playerIndex].coins += r.coins; });
    updateHUD();
    this.closeOverlay();
    if (this.onComplete) this.onComplete();
  },

  pColor(idx) {
    return [CONFIG.couple.player1.color, CONFIG.couple.player2.color,
            CONFIG.couple.ai1.color,    CONFIG.couple.ai2.color][idx];
  },
  pName(idx) { return players[idx].name; },
  pImg(idx)  { return players[idx].image; },

  // Draw player PNG in a clipped circle — same style as the board
  drawPlayerCircle(c, idx, cx, cy, R, ringColor, ringWidth) {
    ringWidth = ringWidth || 3;
    const img = this.pImg(idx);
    c.save();
    c.beginPath(); c.arc(cx, cy+4, R, 0, Math.PI*2);
    c.fillStyle = "rgba(0,0,0,0.32)"; c.fill();
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI*2); c.clip();
    if (img && img.complete && img.naturalWidth > 0 && !img._failed) {
      c.drawImage(img, cx-R, cy-R, R*2, R*2);
    } else {
      c.fillStyle = this.pColor(idx); c.fill();
      c.font = `${R}px serif`; c.textAlign="center"; c.textBaseline="middle";
      c.fillText(players[idx].emoji, cx, cy);
    }
    c.restore();
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI*2);
    c.strokeStyle = ringColor || "white"; c.lineWidth = ringWidth; c.stroke();
  },

  // ═══════════════════════════════════════════════════════════
  //  MODE ROLL
  // ═══════════════════════════════════════════════════════════
  showModeRoll() {
    this.buildOverlay();
    const allModes=["FFA","FFA_DIG","DUOS","DUOS_RACE","1v3","1V3_TAG"];
    const chosen = this.pickMode();
    // Tell guest which mode was chosen so they open the same game
    if(typeof netMG!=="undefined"&&netMG.isHost()) netMG.broadcastStart(chosen);
    let spinT = 0, revealed = false;
    const spinDur = 2.4, W = window.innerWidth, H = window.innerHeight;
    let spinIdx = 0, spinSpeed = 22;
    const stars = Array.from({length:100}, () => ({
      x:Math.random()*W, y:Math.random()*H, r:Math.random()*2+.4, a:Math.random(),
    }));

    this.startLoop((dt) => {
      const c = this.ctx;
      c.clearRect(0,0,W,H);
      const bg = c.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.7);
      bg.addColorStop(0,"#12082a"); bg.addColorStop(1,"#080814");
      c.fillStyle=bg; c.fillRect(0,0,W,H);
      stars.forEach(s => {
        s.a = Math.max(0.05, Math.min(1, s.a+(Math.random()-.5)*.08));
        c.beginPath(); c.arc(s.x,s.y,s.r,0,Math.PI*2);
        c.fillStyle=`rgba(255,255,255,${s.a})`; c.fill();
      });

      c.font="bold 30px 'Fredoka One',cursive";
      c.fillStyle="white"; c.textAlign="center"; c.textBaseline="middle";
      mgShadow(c,"#c77dff",18);
      c.fillText("🎮  MINI GAME TIME!  🎮", W/2, H*0.2);
      mgShadow(c,"transparent",0);

      const fw=380, fh=110, fx=W/2-fw/2, fy=H/2-fh/2-10;
      c.shadowColor="#c77dff"; c.shadowBlur=40;
      c.fillStyle="rgba(100,0,200,0.15)";
      mgRoundRect(c,fx-14,fy-24,fw+28,fh+48,26); c.fill();
      c.shadowBlur=0;
      c.strokeStyle="rgba(200,150,255,0.5)"; c.lineWidth=2.5;
      mgRoundRect(c,fx-14,fy-24,fw+28,fh+48,26); c.stroke();

      spinT += dt;
      if (spinT < spinDur) {
        spinSpeed = Math.max(2, 22*(1-Math.pow(spinT/spinDur,2)));
        spinIdx   = (spinIdx + spinSpeed*dt) % allModes.length;
        const iA  = Math.floor(spinIdx) % allModes.length;
        const iB  = (iA+1) % allModes.length;
        const frac= spinIdx % 1;
        c.save(); c.beginPath(); c.rect(fx,fy,fw,fh); c.clip();
        c.font="bold 44px 'Fredoka One',cursive"; c.textAlign="center"; c.textBaseline="middle";
        c.globalAlpha = 1-frac; c.fillStyle=modeColor(allModes[iA]);
        c.fillText(modeIcon(allModes[iA])+" "+modeShortLabel(allModes[iA]), W/2, fy+fh/2 - frac*fh*1.2);
        c.globalAlpha = frac;   c.fillStyle=modeColor(allModes[iB]);
        c.fillText(modeIcon(allModes[iB])+" "+modeShortLabel(allModes[iB]), W/2, fy+fh/2 + (1-frac)*fh*1.2);
        c.restore(); c.globalAlpha=1;
        c.font="14px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.35)";
        c.textAlign="center"; c.fillText("picking a game…", W/2, H*0.76);
      } else {
        revealed = true;
        const pulse = 0.5+0.5*Math.sin(this.frameTime/260);
        c.shadowColor=modeColor(chosen); c.shadowBlur=30+pulse*20;
        c.font="bold 50px 'Fredoka One',cursive"; c.fillStyle=modeColor(chosen);
        c.textAlign="center"; c.textBaseline="middle";
        c.fillText(modeIcon(chosen)+"  "+modeShortLabel(chosen), W/2, fy+fh/2);
        c.shadowBlur=0;
        c.font="18px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.65)";
        c.fillText(modeDesc(chosen, this.landingPlayer), W/2, fy+fh/2+66);
        c.font="bold 15px 'Fredoka One',cursive";
        c.fillStyle=`rgba(255,255,255,${0.4+0.4*Math.sin(this.frameTime/420)})`;
        c.fillText("Tap anywhere to continue!", W/2, H*0.82);
      }
    });

    const go = () => {
      if (!revealed) return;
      this.overlay.removeEventListener("click", go);
      this.showRules(chosen);
    };
    this.overlay.addEventListener("click", go);
  },

  // ═══════════════════════════════════════════════════════════
  //  RULES SCREEN
  // ═══════════════════════════════════════════════════════════
  showRules(mode) {
    this.stopLoop();
    const W=window.innerWidth, H=window.innerHeight, c=this.ctx;
    const rules = getRules(mode, this.landingPlayer);

    const draw = () => {
      c.clearRect(0,0,W,H);
      const bg=c.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.7);
      bg.addColorStop(0,"#12082a"); bg.addColorStop(1,"#080814");
      c.fillStyle=bg; c.fillRect(0,0,W,H);

      mgShadow(c,modeColor(mode),22);
      c.font="bold 38px 'Fredoka One',cursive"; c.fillStyle=modeColor(mode);
      c.textAlign="center"; c.textBaseline="middle";
      c.fillText(modeIcon(mode)+"  "+modeShortLabel(mode), W/2, H*0.16);
      mgShadow(c,"transparent",0);

      c.font="bold 24px 'Fredoka One',cursive"; c.fillStyle="white";
      c.fillText(rules.title, W/2, H*0.28);

      const cardH = rules.lines.length*34 + rules.rewards.length*28 + 110;
      const cardY = H*0.35;
      c.fillStyle="rgba(255,255,255,0.05)";
      mgRoundRect(c, W/2-300, cardY-16, 600, cardH, 18); c.fill();
      c.strokeStyle="rgba(255,255,255,0.1)"; c.lineWidth=1.5;
      mgRoundRect(c, W/2-300, cardY-16, 600, cardH, 18); c.stroke();

      c.font="17px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.85)";
      rules.lines.forEach((line, i) => c.fillText(line, W/2, cardY+i*34));

      const ry = cardY + rules.lines.length*34 + 22;
      c.font="bold 15px 'Fredoka One',cursive"; c.fillStyle=modeColor(mode);
      c.fillText("REWARDS", W/2, ry);
      c.font="15px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.7)";
      rules.rewards.forEach((r,i) => c.fillText(r, W/2, ry+26+i*26));

      const bw=220,bh=56,bx=W/2-bw/2,by=H-100;
      const g=c.createLinearGradient(bx,by,bx+bw,by+bh);
      g.addColorStop(0,modeColor(mode)); g.addColorStop(1,"#c77dff");
      c.fillStyle=g; mgRoundRect(c,bx,by,bw,bh,28); c.fill();
      c.font="bold 22px 'Fredoka One',cursive"; c.fillStyle="white";
      c.fillText("LET'S GO! 🎮", W/2, by+bh/2);
    };
    draw();

    let clicked=false;
    const go=()=>{
      if(clicked) return; clicked=true;
      this.overlay.removeEventListener("click",go);
      if(mode==="FFA")        this.startFFA();
      else if(mode==="FFA_DIG")   this.startDiggers();
      else if(mode==="DUOS")      this.startDuos();
      else if(mode==="DUOS_RACE") this.startRace();
      else if(mode==="1v3")       this.startOneVsThree();
      else if(mode==="1V3_TAG")   this.startTag();
    };
    this.overlay.addEventListener("click",go);
  },

  // ═══════════════════════════════════════════════════════════
  //  FFA – DODGE THE BULLETS   (fixed + polished)
  // ═══════════════════════════════════════════════════════════
  startFFA() {
    const W=window.innerWidth, H=window.innerHeight;
    const ARENA_TOP=90, ARENA_BOT=H-50;
    const AH=ARENA_BOT-ARENA_TOP;
    const P_R=26, B_R=9, P_SPEED=190;

    // Starts very slow — ramps to intense around 30s
    let bulletInterval=2.4, bulletSpeed=110, waveCount=0;

    // Each AI has a persistent velocity for smooth movement
    const gPlayers = [0,1,2,3].map(i => ({
      idx:i, x:W*0.15+i*(W*0.7/3), y:ARENA_TOP+AH*0.5,
      alive:true, r:P_R,
      isHuman:i===0||i===1,
      homeX:[W*0.15, W*0.28, W*0.72, W*0.85][i],
      homeY:[ARENA_TOP+AH*0.5, ARENA_TOP+AH*0.75, ARENA_TOP+AH*0.25, ARENA_TOP+AH*0.5][i],
      style:i,  // 1=sidestep, 2=flee, 3=juke
    }));

    const bullets=[];
    let bulletTimer=0, gameOver=false, goTimer=0;
    let winner=null, finishOrder=[], elapsed=0, countdownT=3, started=false;

    const keys={};
    const onKey=e=>{ keys[e.key]=e.type==="keydown"; };
    window.addEventListener("keydown",onKey);
    window.addEventListener("keyup",onKey);

    // Guest: receive state from host and apply it
    netMG.reset();
    let guestState=null;
    netMG.onState(st=>{ guestState=st; });
    netMG.onEnd(rewards=>{
      window.removeEventListener("keydown",onKey);
      window.removeEventListener("keyup",onKey);
      const ordered=[...rewards].sort((a,b)=>b.coins-a.coins).map(r=>r.playerIndex);
      this.showResults("FFA",rewards,ordered);
    });

    const spawnWave=()=>{
      waveCount++;
      bulletSpeed    = 110 + Math.min(waveCount*9,190);
      bulletInterval = Math.max(0.5, 2.4 - waveCount*0.075);
      const count = 1 + Math.floor(waveCount/4);
      const side  = Math.random()<.5?"left":"right";
      for(let i=0;i<count;i++){
        const y=ARENA_TOP+40+Math.random()*(AH-80);
        const spd=bulletSpeed*(0.8+Math.random()*0.4);
        bullets.push({x:side==="left"?-B_R:W+B_R, y,
          vx:side==="left"?spd:-spd, vy:(Math.random()-.5)*40,
          r:B_R, hue:Math.floor(Math.random()*360)});
      }
      if(waveCount>10&&Math.random()<0.35){
        const x=W*0.1+Math.random()*W*0.8;
        bullets.push({x,y:-B_R,vx:0,vy:bulletSpeed*0.9,r:B_R,hue:0});
      }
    };

    // Field-based AI: samples candidate positions and scores by total bullet threat
    const aiThink=(p)=>{
      const look=0.5;
      const margin=P_R+14;

      // Score a position: lower = more dangerous
      const scorePos=(tx,ty)=>{
        if(tx<margin||tx>W-margin||ty<ARENA_TOP+margin||ty>ARENA_BOT-margin) return -99999;
        let score=0;
        bullets.forEach(b=>{
          const futX=b.x+b.vx*look, futY=b.y+b.vy*look;
          const dNow=Math.hypot(tx-b.x, ty-b.y);
          const dFut=Math.hypot(tx-futX, ty-futY);
          const threat=Math.min(dNow,dFut);
          // Heavy penalty for close bullets, mild for far
          if(threat<60)  score-=2000;
          else if(threat<120) score-=800*(120-threat)/60;
          else if(threat<220) score-=200*(220-threat)/100;
        });
        // Mild pull toward home zone so AIs spread apart
        score-=Math.hypot(tx-p.homeX, ty-p.homeY)*0.08;
        return score;
      };

      // Sample a grid of candidates around the player + a few far options
      let bestScore=-Infinity, bestDX=0, bestDY=0;
      const STEPS=5, RADIUS=180;
      for(let sx=-STEPS;sx<=STEPS;sx++) for(let sy=-STEPS;sy<=STEPS;sy++){
        if(sx===0&&sy===0) continue;
        const tx=p.x+sx*(RADIUS/STEPS), ty=p.y+sy*(RADIUS/STEPS);
        const s=scorePos(tx,ty);
        if(s>bestScore){
          bestScore=s;
          const d=Math.hypot(tx-p.x,ty-p.y)||1;
          bestDX=(tx-p.x)/d; bestDY=(ty-p.y)/d;
        }
      }
      // If current spot is safest, add small home-drift
      if(bestScore<scorePos(p.x,p.y)){
        const hx=p.homeX, hy=p.homeY;
        const d=Math.hypot(hx-p.x,hy-p.y)||1;
        bestDX=(hx-p.x)/d; bestDY=(hy-p.y)/d;
      }

      return {wx:bestDX, wy:bestDY};
    };

    this.startLoop((dt)=>{
      const c=this.ctx;
      // GUEST: apply received state to local arrays then render normally
      if(netMG.isGuest()&&netMG.connected()&&guestState){
        netMG.sendKeys(keys);
        guestState.players.forEach(sp=>{ const lp=gPlayers[sp.idx]; if(lp){lp.x=sp.x;lp.y=sp.y;lp.alive=sp.alive;} });
        bullets.length=0; guestState.bullets.forEach(b=>bullets.push(b));
        gameOver=guestState.gameOver; winner=guestState.winner;
        elapsed=guestState.elapsed;
      }
      c.clearRect(0,0,W,H);
      const bg=c.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,"#080820"); bg.addColorStop(1,"#1a082a");
      c.fillStyle=bg; c.fillRect(0,0,W,H);
      c.strokeStyle="rgba(150,100,255,0.2)"; c.lineWidth=3;
      c.strokeRect(8,ARENA_TOP,W-16,AH);
      c.font="bold 17px 'Fredoka One',cursive";
      c.fillStyle="rgba(255,255,255,.4)"; c.textAlign="center"; c.textBaseline="middle";
      c.fillText("🔫 DODGE THE BULLETS — FREE FOR ALL", W/2, 50);

      if(countdownT>0){
        countdownT-=dt;
        const n=Math.ceil(countdownT);
        const scale=1+(1-(countdownT%1))*0.4;
        c.font=`bold ${Math.round(90*scale)}px 'Fredoka One',cursive`;
        c.fillStyle=n===1?"#ff6b9d":n===2?"#c77dff":"#4cc9f0";
        mgShadow(c,c.fillStyle,30);
        c.textAlign="center"; c.textBaseline="middle";
        c.fillText(n>0?n:"GO!",W/2,H/2);
        mgShadow(c,"transparent",0);
        gPlayers.forEach(p=>this.drawPlayerCircle(c,p.idx,p.x,p.y,P_R,"white",3));
        return;
      }
      if(!started) started=true;
      elapsed+=dt;

      if(!gameOver){
        bulletTimer+=dt;
        if(bulletTimer>=bulletInterval){ bulletTimer=0; spawnWave(); }

        for(let i=bullets.length-1;i>=0;i--){
          const b=bullets[i];
          b.x+=b.vx*dt; b.y+=b.vy*dt;
          if(b.x<-120||b.x>W+120||b.y<-120||b.y>H+120) bullets.splice(i,1);
        }

        // Networked movement: host controls p0, guest keys control p1
        const mk=netMG.isHost()?netMG.mergedKeys(keys):keys;
        if(netMG.isGuest()&&netMG.connected()) netMG.sendKeys(keys);
        // Player 0 (Lanlanland) moves locally on host screen
        const hp=gPlayers[0];
        if(hp.alive&&(netMG.isHost()||!netMG.connected())){
          let mx=0,my=0;
          if(keys["ArrowLeft"]||keys["a"])  mx=-1;
          if(keys["ArrowRight"]||keys["d"]) mx= 1;
          if(keys["ArrowUp"]||keys["w"])    my=-1;
          if(keys["ArrowDown"]||keys["s"])  my= 1;
          if(mx&&my){ mx*=0.707; my*=0.707; }
          hp.x=Math.max(P_R+10,Math.min(W-P_R-10, hp.x+mx*P_SPEED*dt));
          hp.y=Math.max(ARENA_TOP+P_R,Math.min(ARENA_BOT-P_R, hp.y+my*P_SPEED*dt));
        }
        // Player 1 (Merryberry) moved by guest keys, applied on host only
        const hp1=gPlayers[1];
        if(hp1.alive&&netMG.isHost()){
          let mx=0,my=0;
          if(mk["p1_left"])  mx=-1;
          if(mk["p1_right"]) mx= 1;
          if(mk["p1_up"])    my=-1;
          if(mk["p1_down"]) my= 1;
          if(mx&&my){ mx*=0.707; my*=0.707; }
          hp1.x=Math.max(P_R+10,Math.min(W-P_R-10, hp1.x+mx*P_SPEED*dt));
          hp1.y=Math.max(ARENA_TOP+P_R,Math.min(ARENA_BOT-P_R, hp1.y+my*P_SPEED*dt));
        }

        gPlayers.forEach(p=>{
          if(!p.alive||p.isHuman) return;
          // Re-think every frame — fast, direct movement at player speed
          const {wx,wy}=aiThink(p);
          p.x+=wx*P_SPEED*dt;
          p.y+=wy*P_SPEED*dt;
          // Hard clamp to arena bounds
          if(p.x<P_R+10){p.x=P_R+10;}
          if(p.x>W-P_R-10){p.x=W-P_R-10;}
          if(p.y<ARENA_TOP+P_R){p.y=ARENA_TOP+P_R;}
          if(p.y>ARENA_BOT-P_R){p.y=ARENA_BOT-P_R;}
        });

        // Collision – eliminated players go to the FRONT of finishOrder (they die first = last place)
        gPlayers.forEach(p=>{
          if(!p.alive) return;
          for(const b of bullets){
            if(Math.hypot(b.x-p.x,b.y-p.y)<p.r+b.r){
              p.alive=false;
              finishOrder.push(p.idx);   // push to END: later = better place
              break;
            }
          }
        });

        const alive=gPlayers.filter(p=>p.alive);
        if(alive.length<=1){
          gameOver=true;
          if(alive.length===1){ finishOrder.push(alive[0].idx); winner=alive[0].idx; }
        }
        // Host broadcasts full state to guest every few frames
        if(netMG.isHost()) netMG.sendState({
          players:gPlayers.map(p=>({x:p.x,y:p.y,alive:p.alive,idx:p.idx})),
          bullets:bullets.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r,hue:b.hue})),
          gameOver, finishOrder, winner, elapsed,
        });
      } else {
        goTimer+=dt;
        if(goTimer>3.5){
          window.removeEventListener("keydown",onKey);
          window.removeEventListener("keyup",onKey);
          // finishOrder: last element = winner (survived longest = 1st place)
          // reverse so index 0 = 1st place
          const ordered=[...finishOrder].reverse();
          const prizes=[20,12,5,0];
          const rewards=ordered.map((pi,place)=>({playerIndex:pi,coins:prizes[place]||0}));
          if(netMG.isHost()) netMG.broadcastEnd(rewards); // tell guest game is over
          this.showResults("FFA",rewards,ordered);
          return;
        }
      }

      // Bullets with glow trail
      bullets.forEach(b=>{
        const gr=this.ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*2.5);
        gr.addColorStop(0,`hsla(${b.hue},100%,80%,0.9)`);
        gr.addColorStop(1,`hsla(${b.hue},100%,50%,0)`);
        c.fillStyle=gr;
        c.beginPath(); c.arc(b.x,b.y,b.r*2.5,0,Math.PI*2); c.fill();
        c.beginPath(); c.arc(b.x,b.y,b.r,0,Math.PI*2);
        c.fillStyle=`hsl(${b.hue},100%,85%)`; c.fill();
      });

      // Players
      gPlayers.forEach(p=>{
        if(!p.alive){
          c.globalAlpha=0.22;
          this.drawPlayerCircle(c,p.idx,p.x,p.y,P_R,"rgba(255,255,255,0.3)",2);
          c.globalAlpha=1; return;
        }
        const danger=bullets.some(b=>Math.hypot(b.x-p.x,b.y-p.y)<110);
        if(danger){
          c.beginPath(); c.arc(p.x,p.y,P_R+12,0,Math.PI*2);
          c.fillStyle="rgba(255,50,50,0.22)"; c.fill();
        }
        this.drawPlayerCircle(c,p.idx,p.x,p.y,P_R,p.isHuman?"gold":"white",p.isHuman?3.5:2.5);
        c.font="bold 11px 'Fredoka One',cursive";
        const nm=this.pName(p.idx);
        const tw=c.measureText(nm).width+10;
        c.fillStyle="rgba(0,0,0,0.6)";
        mgRoundRect(c,p.x-tw/2,p.y-P_R-22,tw,16,6); c.fill();
        c.fillStyle="white"; c.textAlign="center"; c.textBaseline="middle";
        c.fillText(nm,p.x,p.y-P_R-14);
      });

      // HUD
      c.font="bold 13px 'Fredoka One',cursive";
      c.fillStyle="rgba(255,255,255,.5)"; c.textAlign="left"; c.textBaseline="middle";
      c.fillText(`⏱ ${elapsed.toFixed(1)}s`,16,50);
      c.textAlign="right";
      c.fillText(`Alive: ${gPlayers.filter(p=>p.alive).length}/4`,W-16,50);
      c.textAlign="center"; c.font="11px 'Nunito',sans-serif";
      c.fillStyle="rgba(255,255,255,.25)";
      c.fillText("Arrow Keys / WASD to dodge",W/2,H-16);

      // Eliminated strip at bottom
      if(finishOrder.length>0){
        finishOrder.forEach((pi,i)=>{
          c.globalAlpha=0.5;
          this.drawPlayerCircle(c,pi,30+i*52,H-30,16,"rgba(255,255,255,0.3)",1.5);
          c.globalAlpha=1;
          c.font="10px 'Fredoka One',cursive"; c.fillStyle="rgba(255,255,255,.35)";
          c.textAlign="center"; c.fillText("💀",30+i*52,H-52);
        });
      }

      // Game over
      if(gameOver){
        c.fillStyle=`rgba(0,0,0,${Math.min(goTimer/1.2,0.7)})`; c.fillRect(0,0,W,H);
        if(goTimer>0.6&&winner!==null){
          mgShadow(c,this.pColor(winner),30);
          c.font="bold 52px 'Fredoka One',cursive"; c.fillStyle=this.pColor(winner);
          c.textAlign="center"; c.textBaseline="middle";
          c.fillText(`${this.pName(winner)} WINS! 🏆`,W/2,H/2-30);
          mgShadow(c,"transparent",0);
          this.drawPlayerCircle(c,winner,W/2,H/2+55,44,"gold",4);
        }
      }
    });
  },


  // ═══════════════════════════════════════════════════════════
  //  DUOS – TILE TAKEOVER  (fixed: hold-drag to paint, BFS AI)
  // ═══════════════════════════════════════════════════════════
  startDuos() {
    const W=window.innerWidth, H=window.innerHeight;
    const COLS=16, ROWS=10, PAD=44, TOP=88;
    const TW=Math.floor((W-PAD*2)/COLS);
    const TH=Math.floor((H-TOP-36)/ROWS);
    const OX=PAD, OY=TOP, GAME_DUR=30;

    // Each player has their own distinct colour shade
    const P_COLS=["#ff6b9d","#c94575","#06d6a0","#047a5c"];
    const TEAM_BASE=["#ff6b9d","#06d6a0"];

    const grid=Array.from({length:ROWS},()=>Array(COLS).fill(-1));

    const cursors=[0,1,2,3].map(i=>({
      idx:i, team:i<2?0:1,
      cx:i===0?0:i===1?1:i===2?COLS-1:COLS-2,
      cy:i===0?0:i===1?1:i===2?ROWS-1:ROWS-2,
      isHuman:i===0,
      pathTimer:0,
      stepInterval:[0,0.26,0.24,0.28][i],
    }));

    // Seed corners
    [[0,0,0],[0,1,1],[ROWS-1,COLS-1,2],[ROWS-1,COLS-2,3]].forEach(([r,c,pi])=>{
      if(r>=0&&r<ROWS&&c>=0&&c<COLS) grid[r][c]=pi;
    });

    let timeLeft=GAME_DUR, gameOver=false, goTimer=0;

    // BFS from cursor to best target — uses parent map (fast, no array copying)
    const bfsPath=(cur, prefer)=>{
      const ownTeam=cur.team;
      let bestR=-1,bestC=-1,bestScore=-Infinity;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const v=grid[r][c];
        // Is this tile owned by my team?
        const myTeam=(v===0||v===1)?0:(v===2||v===3)?1:-1;
        if(myTeam===ownTeam) continue; // skip own tiles
        const dist=Math.abs(r-cur.cy)+Math.abs(c-cur.cx)+0.01;
        // Base value: enemy tile always worth more than neutral
        const baseVal = v===-1 ? 2 : 6;
        // Personality modifier
        const prefMul = prefer==="neutral" ? (v===-1?2:0.5)
                      : prefer==="attack"  ? (v===-1?0.5:2.5)
                      : 1;
        const score = baseVal * prefMul / dist;
        if(score>bestScore){bestScore=score;bestR=r;bestC=c;}
      }
      if(bestR<0) return null; // board completely owned — shouldn't happen
      // BFS using parent map
      const parent=Array.from({length:ROWS},()=>Array(COLS).fill(null));
      const q=[[cur.cy,cur.cx]];
      parent[cur.cy][cur.cx]=[cur.cy,cur.cx];
      let found=false;
      while(q.length&&!found){
        const [r,c]=q.shift();
        if(r===bestR&&c===bestC){found=true;break;}
        for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
          const nr=r+dr,nc=c+dc;
          if(nr<0||nr>=ROWS||nc<0||nc>=COLS||parent[nr][nc]) continue;
          parent[nr][nc]=[r,c];
          q.push([nr,nc]);
        }
      }
      if(!found) return null;
      // Walk parent map back to find first step
      let r=bestR,c=bestC;
      while(true){
        const [pr,pc]=parent[r][c];
        if(pr===cur.cy&&pc===cur.cx) return {r,c};
        [r,c]=[pr,pc];
      }
    };

    // Each AI has a different personality
    // idx 1: expander — floods neutral tiles fast, stays away from enemy
    // idx 2: attacker — hunts enemy tiles aggressively
    // idx 3: balanced — mixes both
    const AI_PREFER={1:"neutral",2:"attack",3:"attack"};
    const aiStep=(cur)=>{
      const next=bfsPath(cur,AI_PREFER[cur.idx]||"mixed");
      if(!next) return;
      cur.cx=next.c; cur.cy=next.r;
      grid[cur.cy][cur.cx]=cur.idx;
    };

    const paintAt=(clientX,clientY)=>{
      const rect=this.canvas.getBoundingClientRect();
      const gc=Math.floor((clientX-rect.left-OX)/TW);
      const gr=Math.floor((clientY-rect.top-OY)/TH);
      if(gc<0||gc>=COLS||gr<0||gr>=ROWS) return;
      grid[gr][gc]=0;
      cursors[0].cx=gc; cursors[0].cy=gr;
    };

    const onClick=(e)=>{ if(!gameOver) paintAt(e.clientX,e.clientY); };
    this.canvas.addEventListener("click",onClick);

    this.startLoop((dt)=>{
      const c=this.ctx;
      c.clearRect(0,0,W,H);
      const bg=c.createLinearGradient(0,0,W,H);
      bg.addColorStop(0,"#080820"); bg.addColorStop(1,"#081828");
      c.fillStyle=bg; c.fillRect(0,0,W,H);

      if(!gameOver){
        timeLeft-=dt;
        if(timeLeft<=0){timeLeft=0;gameOver=true;}
        cursors.forEach(cur=>{
          if(cur.isHuman) return;
          cur.pathTimer+=dt;
          if(cur.pathTimer>=cur.stepInterval){
            cur.pathTimer=0;
            aiStep(cur);
          }
        });
      } else {
        goTimer+=dt;
        if(goTimer>4){
          this.canvas.removeEventListener("click",onClick);
          let t0=0,t1=0;
          grid.forEach(row=>row.forEach(v=>{if(v===0||v===1)t0++;if(v===2||v===3)t1++;}));
          const aw=t0>=t1;
          const rewards=aw
            ?[{playerIndex:0,coins:16},{playerIndex:1,coins:16},{playerIndex:2,coins:4},{playerIndex:3,coins:4}]
            :[{playerIndex:0,coins:4},{playerIndex:1,coins:4},{playerIndex:2,coins:16},{playerIndex:3,coins:16}];
          if(netMG.isHost()) netMG.broadcastEnd(rewards);
          this.showResults("DUOS",rewards,aw?[0,1,2,3]:[2,3,0,1]);
          return;
        }
      }

      // Grid tiles
      for(let r=0;r<ROWS;r++) for(let cc=0;cc<COLS;cc++){
        const v=grid[r][cc];
        const tx=OX+cc*TW, ty=OY+r*TH;
        c.fillStyle=v===-1?"rgba(255,255,255,0.035)":P_COLS[v]+"cc";
        c.fillRect(tx+1,ty+1,TW-2,TH-2);
        c.strokeStyle="rgba(255,255,255,0.05)"; c.lineWidth=1;
        c.strokeRect(tx,ty,TW,TH);
      }

      // Cursor highlight + portrait
      cursors.forEach(cur=>{
        const tx=OX+cur.cx*TW, ty=OY+cur.cy*TH;
        const pulse=0.5+0.5*Math.sin(this.frameTime/180+cur.idx);
        c.strokeStyle=P_COLS[cur.idx]; c.lineWidth=2+pulse*1.5;
        c.strokeRect(tx+2,ty+2,TW-4,TH-4);
        this.drawPlayerCircle(c,cur.idx,tx+TW/2,ty+TH/2,Math.min(TW,TH)*0.38,P_COLS[cur.idx],2.5);
      });

      // Header bar
      c.fillStyle="rgba(0,0,0,0.52)"; c.fillRect(0,0,W,TOP-4);
      let t0=0,t1=0;
      grid.forEach(row=>row.forEach(v=>{if(v===0||v===1)t0++;if(v===2||v===3)t1++;}));

      this.drawPlayerCircle(c,0,OX+18,38,17,P_COLS[0],2.5);
      this.drawPlayerCircle(c,1,OX+44,38,17,P_COLS[1],2.5);
      c.font="bold 13px 'Fredoka One',cursive"; c.textAlign="left"; c.textBaseline="middle";
      c.fillStyle=TEAM_BASE[0];
      c.fillText(`${this.pName(0)} & ${this.pName(1)}: ${t0} tiles`,OX+66,38);

      this.drawPlayerCircle(c,2,W-OX-44,38,17,P_COLS[2],2.5);
      this.drawPlayerCircle(c,3,W-OX-18,38,17,P_COLS[3],2.5);
      c.fillStyle=TEAM_BASE[1]; c.textAlign="right";
      c.fillText(`${this.pName(2)} & ${this.pName(3)}: ${t1} tiles`,W-OX-66,38);

      const prog2=timeLeft/GAME_DUR;
      c.font="bold 17px 'Fredoka One',cursive";
      c.fillStyle=prog2<0.25?"#ff4444":"white"; c.textAlign="center";
      c.fillText(`⏱ ${Math.ceil(timeLeft)}s`,W/2,38);

      // Territory bar
      const tbx=OX,tby=TOP-12,tbw=W-OX*2,tbh=6;
      c.fillStyle="rgba(255,255,255,0.08)"; mgRoundRect(c,tbx,tby,tbw,tbh,3); c.fill();
      const pf=t0/(t0+t1||1);
      c.fillStyle=TEAM_BASE[0]; mgRoundRect(c,tbx,tby,tbw*pf,tbh,3); c.fill();
      c.fillStyle=TEAM_BASE[1]; mgRoundRect(c,tbx+tbw*pf,tby,tbw*(1-pf),tbh,3); c.fill();

      c.font="11px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.22)"; c.textAlign="center";
      c.fillText("Click tiles to paint them your colour!",W/2,H-14);

      if(gameOver){
        c.fillStyle=`rgba(0,0,0,${Math.min(goTimer/1.4,0.74)})`; c.fillRect(0,0,W,H);
        if(goTimer>0.7){
          const win=t0>=t1,col=TEAM_BASE[win?0:1];
          mgShadow(c,col,28);
          c.font="bold 46px 'Fredoka One',cursive"; c.fillStyle=col;
          c.textAlign="center"; c.textBaseline="middle";
          c.fillText(win?`${this.pName(0)} & ${this.pName(1)} WIN! 🎉`
                       :`${this.pName(2)} & ${this.pName(3)} WIN! 🎉`,W/2,H/2-24);
          mgShadow(c,"transparent",0);
          c.font="20px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.6)";
          c.fillText(`${t0} vs ${t1} tiles`,W/2,H/2+26);
          const wt=win?[0,1]:[2,3];
          wt.forEach((pi,k)=>this.drawPlayerCircle(c,pi,W/2+(k===0?-44:44),H/2+78,30,P_COLS[pi],3.5));
        }
      }
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  1v3 – HIDE & SEEK  (full visual overhaul)
  // ═══════════════════════════════════════════════════════════
  startOneVsThree() {
    const landIdx  = this.landingPlayer.index;
    const hiderIdxs= [0,1,2,3].filter(i=>i!==landIdx);
    const W=window.innerWidth, H=window.innerHeight;
    const SPOTS=6;

    const SPOTS_DEF=[
      {name:"Forest",  emoji:"🌲",bg:"#0d3b0d",accent:"#1a6b1a",desc:"Dense pine trees"},
      {name:"Cabin",   emoji:"🏠",bg:"#3b1f08",accent:"#7a4515",desc:"Old wooden cabin"},
      {name:"Boulder", emoji:"🪨",bg:"#2e2828",accent:"#5c4f4f",desc:"Giant mossy rock"},
      {name:"Dock",    emoji:"🌊",bg:"#062040",accent:"#0e4a80",desc:"Lakeside dock"},
      {name:"Barn",    emoji:"🌾",bg:"#3b2e08",accent:"#7a6015",desc:"Old hay barn"},
      {name:"Temple",  emoji:"🕌",bg:"#1e0838",accent:"#5a1a88",desc:"Ancient temple"},
    ];

    const cardW=Math.min(190,(W-80)/3-16), cardH=160;
    const gapX=16, gapY=22;
    const gridW=cardW*3+gapX*2;
    const gridX=(W-gridW)/2, gridY=H*0.43;
    const spotPos=(i)=>({ x:gridX+(i%3)*(cardW+gapX), y:gridY+Math.floor(i/3)*(cardH+gapY) });

    let phase="hiders_pick";
    let hiderSpots={}, shotsLeft=4, eliminatedSpots=[], survivingHiders=[...hiderIdxs];
    let eliminatedHiders=[];
    let shotResult=null, doneTimer=0;
    let aiPickTimer=1.0, shooterAiTimer=0;

    // Human players are idx 0 and idx 1 (player + girlfriend).
    // If either is a hider, they pick via click. AI hiders (idx 2,3) auto-pick.
    const humanIdxs=[0,1]; // these are always human-controlled
    const humanHiders=hiderIdxs.filter(i=>humanIdxs.includes(i));
    const aiHiders=hiderIdxs.filter(i=>!humanIdxs.includes(i));
    // Track which humans have picked this round
    let humanPicked={}; // {playerIdx: true/false}
    humanHiders.forEach(i=>{ humanPicked[i]=false; });

    // Crosshair (for human shooter)
    let crossX=W/2, crossY=H/2, hoveredSpot=-1;
    let shotAnim=null;

    const aiPickSpots=()=>{
      aiHiders.filter(i=>survivingHiders.includes(i)&&hiderSpots[i]===undefined).forEach(i=>{
        const avail=[0,1,2,3,4,5].filter(s=>!eliminatedSpots.includes(s));
        hiderSpots[i]=avail[Math.floor(Math.random()*avail.length)];
      });
    };

    const allHumanHidersPicked=()=>
      humanHiders.every(i=>!survivingHiders.includes(i)||humanPicked[i]===true);

    const doShot=(spotIdx)=>{
      if(eliminatedSpots.includes(spotIdx)||phase!=="shooter_aim") return;
      eliminatedSpots.push(spotIdx); shotsLeft--;
      const hit=survivingHiders.filter(i=>hiderSpots[i]===spotIdx);
      hit.forEach(i=>{ survivingHiders=survivingHiders.filter(x=>x!==i); eliminatedHiders.push(i); });
      shotResult={spotIdx,hit};
      const pos=spotPos(spotIdx);
      shotAnim={x:pos.x+cardW/2,y:pos.y+cardH/2,t:0};
      phase="result";
      setTimeout(()=>{
        shotResult=null;
        if(survivingHiders.length===0||shotsLeft===0){ phase="end"; }
        else {
          // Surviving hiders re-pick — clear their old spots
          survivingHiders.forEach(i=>{ delete hiderSpots[i]; });
          humanHiders.forEach(i=>{ if(survivingHiders.includes(i)) humanPicked[i]=false; });
          aiPickTimer=1.0; phase="hiders_pick";
        }
      },2600);
    };

    const onMouseMove=(e)=>{
      const rect=this.canvas.getBoundingClientRect();
      crossX=e.clientX-rect.left; crossY=e.clientY-rect.top;
      hoveredSpot=-1;
      if(phase==="shooter_aim"&&humanIdxs.includes(landIdx)){
        for(let i=0;i<SPOTS;i++){
          if(eliminatedSpots.includes(i)) continue;
          const p=spotPos(i);
          if(crossX>=p.x&&crossX<=p.x+cardW&&crossY>=p.y&&crossY<=p.y+cardH){ hoveredSpot=i; break; }
        }
      }
    };

    const onClickCanvas=(e)=>{
      const rect=this.canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;

      // Human hiders picking their spot
      if(phase==="hiders_pick"){
        // Find which human hider hasn't picked yet and let them pick
        // (In practice only one human clicks at a time — first unpicked human hider claims it)
        const needsPick=humanHiders.find(i=>survivingHiders.includes(i)&&!humanPicked[i]);
        if(needsPick!==undefined){
          for(let i=0;i<SPOTS;i++){
            if(eliminatedSpots.includes(i)) continue;
            const p=spotPos(i);
            if(mx>=p.x&&mx<=p.x+cardW&&my>=p.y&&my<=p.y+cardH){
              hiderSpots[needsPick]=i; humanPicked[needsPick]=true; break;
            }
          }
        }
      }

      // Human shooter firing
      if(phase==="shooter_aim"&&humanIdxs.includes(landIdx)&&hoveredSpot>=0){
        doShot(hoveredSpot);
      }
    };

    this.canvas.addEventListener("mousemove",onMouseMove);
    this.canvas.addEventListener("click",onClickCanvas);
    if(humanIdxs.includes(landIdx)) this.canvas.style.cursor="none";

    this.startLoop((dt)=>{
      const c=this.ctx;
      c.clearRect(0,0,W,H);
      const bg=c.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,"#080820"); bg.addColorStop(1,"#18082a");
      c.fillStyle=bg; c.fillRect(0,0,W,H);

      // Header
      c.fillStyle="rgba(0,0,0,0.5)"; c.fillRect(0,0,W,86);
      c.font="bold 18px 'Fredoka One',cursive"; c.fillStyle="rgba(255,255,255,.45)";
      c.textAlign="center"; c.textBaseline="middle";
      c.fillText("🔍 HIDE & SEEK — 1v3", W/2, 22);

      // Shooter
      this.drawPlayerCircle(c,landIdx,50,56,20,"#ff6b9d",3);
      c.font="bold 13px 'Fredoka One',cursive"; c.fillStyle="#ff6b9d";
      c.textAlign="left"; c.textBaseline="middle";
      c.fillText(`🔫 ${this.pName(landIdx)}`,76,52);
      c.font="11px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.45)";
      c.fillText("Shooter",76,67);

      // Hiders — show eliminated ones greyed out
      hiderIdxs.forEach((hi,k)=>{
        const hx=W-30-(hiderIdxs.length-1-k)*48;
        const isOut=eliminatedHiders.includes(hi);
        c.globalAlpha=isOut?0.3:1;
        this.drawPlayerCircle(c,hi,hx,56,18,isOut?"#888":"#4cc9f0",2.5);
        if(isOut){
          c.font="14px serif"; c.textAlign="center"; c.textBaseline="middle";
          c.fillText("💀",hx,56);
        }
        c.globalAlpha=1;
      });
      c.font="bold 13px 'Fredoka One',cursive"; c.fillStyle="#4cc9f0";
      c.textAlign="right"; c.fillText("🫣 Hiders",W-30-hiderIdxs.length*48-8,52);

      // Shots — 4 boxes
      c.font="bold 15px 'Fredoka One',cursive"; c.fillStyle="#ffd60a"; c.textAlign="center";
      c.fillText(`Shots: ${"💥".repeat(shotsLeft)}${"⬜".repeat(4-shotsLeft)}   Alive: ${survivingHiders.length}/3`,W/2,68);

      const phY=H*0.34;
      c.font="bold 20px 'Fredoka One',cursive"; c.textAlign="center"; c.textBaseline="middle";
      if(phase==="hiders_pick"){
        const needsPick=humanHiders.find(i=>survivingHiders.includes(i)&&!humanPicked[i]);
        c.fillStyle="white";
        c.fillText(needsPick!==undefined
          ?`🫣 ${this.pName(needsPick)}: click your hiding spot!`
          :"🫣 Waiting for hiders to choose…",W/2,phY);
      } else if(phase==="shooter_aim"){
        c.fillStyle="#ff9999";
        c.fillText(humanIdxs.includes(landIdx)?"🔫 Aim and click a spot!":"🔫 Shooter is aiming…",W/2,phY);
      } else if(phase==="result"&&shotResult){
        c.fillStyle=shotResult.hit.length>0?"#ff4466":"#06d6a0";
        c.fillText(shotResult.hit.length>0
          ?`💥 HIT! ${shotResult.hit.map(i=>this.pName(i)).join(" & ")} out!`
          :"💨 Nobody was there!",W/2,phY);
      }

      // Spot cards
      for(let i=0;i<SPOTS;i++){
        const pos=spotPos(i), def=SPOTS_DEF[i];
        const elim=eliminatedSpots.includes(i);
        const isShot=shotResult&&shotResult.spotIdx===i;
        const myPickHider=humanHiders.find(h=>hiderSpots[h]===i&&phase==="hiders_pick"&&humanPicked[h]);
        const isHov=hoveredSpot===i&&!elim;

        c.globalAlpha=elim?0.15:1;

        // Card body
        const cg=c.createLinearGradient(pos.x,pos.y,pos.x,pos.y+cardH);
        cg.addColorStop(0,isShot?"#550000":def.bg);
        cg.addColorStop(1,isShot?"#220000":def.accent+"66");
        c.fillStyle=cg; mgRoundRect(c,pos.x,pos.y,cardW,cardH,16); c.fill();

        // Border / hover glow
        if(isHov){
          mgShadow(c,"#ff3333",25);
          c.strokeStyle="#ff5555"; c.lineWidth=3;
        } else if(myPickHider!==undefined){
          mgShadow(c,"#ffd60a",18);
          c.strokeStyle="#ffd60a"; c.lineWidth=3;
        } else {
          c.strokeStyle=elim?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.2)"; c.lineWidth=1.5;
        }
        mgRoundRect(c,pos.x,pos.y,cardW,cardH,16); c.stroke();
        mgShadow(c,"transparent",0);
        c.globalAlpha=1;

        if(elim){
          // Big X over shot spot
          c.strokeStyle="rgba(255,80,80,0.35)"; c.lineWidth=4;
          c.beginPath(); c.moveTo(pos.x+16,pos.y+16); c.lineTo(pos.x+cardW-16,pos.y+cardH-16); c.stroke();
          c.beginPath(); c.moveTo(pos.x+cardW-16,pos.y+16); c.lineTo(pos.x+16,pos.y+cardH-16); c.stroke();
          continue;
        }

        // Emoji
        c.font=`${Math.round(cardH*0.36)}px serif`;
        c.textAlign="center"; c.textBaseline="middle";
        c.fillText(def.emoji,pos.x+cardW/2,pos.y+cardH*0.37);

        // Name
        c.font=`bold ${Math.round(cardW*0.1)+1}px 'Fredoka One',cursive`;
        c.fillStyle=isHov?"#ffaaaa":"white"; c.textAlign="center"; c.textBaseline="middle";
        c.fillText(def.name,pos.x+cardW/2,pos.y+cardH*0.69);

        // Desc
        c.font=`${Math.round(cardW*0.075)}px 'Nunito',sans-serif`;
        c.fillStyle="rgba(255,255,255,.45)";
        c.fillText(def.desc,pos.x+cardW/2,pos.y+cardH*0.84);

        if(myPickHider!==undefined){
          c.font="bold 11px 'Fredoka One',cursive"; c.fillStyle="#ffd60a";
          c.fillText(`${this.pName(myPickHider)} IS HERE!`,pos.x+cardW/2,pos.y+cardH*0.96);
        }

        // Reveal: show player portraits above the spot — only for hiders who chose here THIS round
        if(phase==="result"||phase==="end"){
          // Show all hiders (surviving + just-hit) who are in this spot
          const hereAlive=survivingHiders.filter(hi=>hiderSpots[hi]===i);
          const hereHit=shotResult?shotResult.hit.filter(hi=>hiderSpots[hi]===i):[];
          const here=[...hereHit,...hereAlive];
          if(here.length>0){
            here.forEach((hi,k)=>{
              const total=here.length;
              const rx=pos.x+cardW*(0.5+(k-(total-1)/2)*0.28);
              const ry=pos.y-26;
              const wasHit=hereHit.includes(hi);
              this.drawPlayerCircle(c,hi,rx,ry,20,wasHit?"#ff4466":"#06d6a0",3);
              if(wasHit){
                c.font="13px serif"; c.textAlign="center"; c.textBaseline="middle";
                c.fillText("💀",rx,ry);
              }
            });
          }
        }
      }

      // Shot flash ring
      if(shotAnim){
        shotAnim.t+=dt;
        const fa=Math.max(0,1-shotAnim.t/0.45);
        const rad=18+shotAnim.t*130;
        c.beginPath(); c.arc(shotAnim.x,shotAnim.y,rad,0,Math.PI*2);
        c.strokeStyle=`rgba(255,80,80,${fa})`; c.lineWidth=5; c.stroke();
        // Second ring
        c.beginPath(); c.arc(shotAnim.x,shotAnim.y,rad*0.5,0,Math.PI*2);
        c.strokeStyle=`rgba(255,200,100,${fa*0.6})`; c.lineWidth=3; c.stroke();
        if(shotAnim.t>0.5) shotAnim=null;
      }

      // Crosshair (shooter human)
      if((phase==="shooter_aim"||phase==="hiders_pick")&&landIdx===0&&phase==="shooter_aim"){
        const cr=hoveredSpot>=0?"#ff5555":"rgba(255,210,210,0.85)";
        c.strokeStyle=cr; c.lineWidth=2;
        c.beginPath(); c.moveTo(crossX-28,crossY); c.lineTo(crossX+28,crossY); c.stroke();
        c.beginPath(); c.moveTo(crossX,crossY-28); c.lineTo(crossX,crossY+28); c.stroke();
        c.beginPath(); c.arc(crossX,crossY,12,0,Math.PI*2); c.stroke();
        // Small gap in crosshair lines for style
        c.fillStyle=cr; c.beginPath(); c.arc(crossX,crossY,3,0,Math.PI*2); c.fill();
      }

      // AI logic
      if(phase==="hiders_pick"){
        aiPickTimer-=dt;
        if(aiPickTimer<=0) aiPickSpots();
        const allAiPicked=aiHiders.every(i=>!survivingHiders.includes(i)||hiderSpots[i]!==undefined);
        if(allAiPicked&&allHumanHidersPicked()&&aiPickTimer<=0){ phase="shooter_aim"; shooterAiTimer=1.9; }
      }
      if(phase==="shooter_aim"&&!humanIdxs.includes(landIdx)){
        shooterAiTimer-=dt;
        if(shooterAiTimer<=0){
          const avail=[0,1,2,3,4,5].filter(s=>!eliminatedSpots.includes(s));
          doShot(avail[Math.floor(Math.random()*avail.length)]);
        }
      }

      // End screen
      if(phase==="end"){
        doneTimer+=dt;
        c.fillStyle=`rgba(0,0,0,${Math.min(doneTimer/1.2,0.78)})`; c.fillRect(0,0,W,H);
        if(doneTimer>0.8){
          const hw=survivingHiders.length>0;
          const col=hw?"#4cc9f0":"#ff6b9d";
          mgShadow(c,col,28);
          c.font="bold 46px 'Fredoka One',cursive"; c.fillStyle=col;
          c.textAlign="center"; c.textBaseline="middle";
          c.fillText(hw?"🫣 Hiders Survive — They Win!":"🔫 Shooter Got Them All!",W/2,H/2-30);
          mgShadow(c,"transparent",0);
          if(hw){
            survivingHiders.forEach((hi,i)=>{
              this.drawPlayerCircle(c,hi,W/2+(i-(survivingHiders.length-1)/2)*72,H/2+55,32,"#4cc9f0",3.5);
            });
          } else {
            this.drawPlayerCircle(c,landIdx,W/2,H/2+55,38,"#ff6b9d",4);
          }
        }
        if(doneTimer>2.6){
          this.canvas.style.cursor="default";          this.canvas.removeEventListener("mousemove",onMouseMove);
          this.canvas.removeEventListener("click",onClickCanvas);
          const hw=survivingHiders.length>0;
          const rewards=hw
            ?[...survivingHiders.map(i=>({playerIndex:i,coins:15})),{playerIndex:landIdx,coins:2}]
            :[{playerIndex:landIdx,coins:20},...hiderIdxs.map(i=>({playerIndex:i,coins:0}))];
          if(netMG.isHost()) netMG.broadcastEnd(rewards);
          this.showResults("1v3",rewards,hw?[...survivingHiders,landIdx]:[landIdx,...hiderIdxs]);
        }
      }

      if(phase==="hiders_pick"&&humanHiders.some(i=>survivingHiders.includes(i)&&!humanPicked[i])){
        c.font="11px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.28)";
        c.textAlign="center"; c.textBaseline="middle";
        c.fillText("The shooter won't know which spot you picked!",W/2,H-16);
      }
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  FFA_DIG – CHEST DIGGERS
  // ═══════════════════════════════════════════════════════════
  startDiggers() {
    const W=window.innerWidth, H=window.innerHeight;
    const CELL=22, COLS=Math.floor((W-80)/CELL), ROWS=Math.floor((H-120)/CELL);
    const OX=Math.floor((W-COLS*CELL)/2), OY=90;
    const P_SPEED=4.2; // cells/sec
    const DIG_RATE=0.18; // sec per cell dig
    const P_R=10;

    // Tile map: 0=dirt, 1=dug, 2=rock
    const tiles=Array.from({length:ROWS},()=>Array(COLS).fill(0));
    // Spawn rocks randomly ~12% of tiles
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      if(Math.random()<0.12) tiles[r][c]=2;
    }
    // Clear starting zones for each player
    const starts=[[1,1],[COLS-2,1],[1,ROWS-2],[COLS-2,ROWS-2]];
    starts.forEach(([sc,sr])=>{
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
        const nr=sr+dr,nc=sc+dc;
        if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) tiles[nr][nc]=1;
      }
    });

    // Chest position — hidden from AI, random centre area
    let chestC=Math.floor(COLS*0.3+Math.random()*COLS*0.4);
    let chestR=Math.floor(ROWS*0.3+Math.random()*ROWS*0.4);
    tiles[chestR][chestC]=0; // make sure it's dirt (not rock)
    let chestReveal=0;
    let winner=null, winTimer=0;
    let chestAnim={open:false,t:0,coins:[]};

    // Players: grid position in floats
    const gPlayers=[0,1,2,3].map(i=>({
      idx:i, cx:starts[i][0]*1.0, cy:starts[i][1]*1.0,
      digTimer:0, isHuman:i===0||i===1, alive:true,
      dx:0, dy:0,
      // AI state — each has a different search personality, NO chest knowledge
      aiWander:{c:Math.floor(COLS/2)+Math.floor((Math.random()-0.5)*COLS*0.3),
                r:Math.floor(ROWS/2)+Math.floor((Math.random()-0.5)*ROWS*0.3)},
      aiStuck:0, aiReplan:0,
      // Personality: 0=spiral-in, 1=diagonal-cut, 2=edge-sweep, 3=random-explore
      personality:i,
    }));

    // AI wander target picker — each AI explores differently, no chest GPS
    const aiPickWander=(p)=>{
      p.aiReplan=(p.aiReplan||0)+1;
      const n=p.aiReplan;
      const pc=Math.round(p.cx), pr=Math.round(p.cy);
      if(p.personality===1){
        // Diagonal cutter: heads toward opposite corner then adjusts
        const tc=pc<COLS/2?COLS-3:3, tr=pr<ROWS/2?ROWS-3:3;
        return {c:Math.max(1,Math.min(COLS-2,tc+Math.floor((Math.random()-0.5)*8))),
                r:Math.max(1,Math.min(ROWS-2,tr+Math.floor((Math.random()-0.5)*8)))};
      } else if(p.personality===2){
        // Edge sweeper: visits corners then spirals inward
        const margin=Math.floor(n/4)%Math.max(1,Math.floor(Math.min(COLS,ROWS)/2));
        const side=n%4;
        if(side===0) return {c:margin+2,r:margin+2};
        if(side===1) return {c:COLS-margin-2,r:margin+2};
        if(side===2) return {c:COLS-margin-2,r:ROWS-margin-2};
        return {c:margin+2,r:ROWS-margin-2};
      } else if(p.personality===3){
        // True random scatter
        return {c:2+Math.floor(Math.random()*(COLS-4)), r:2+Math.floor(Math.random()*(ROWS-4))};
      } else {
        // Spiral-in toward centre
        const tx=COLS/2+Math.cos(n*0.9)*Math.max(1,(COLS/2-2)*(1-n*0.03));
        const ty=ROWS/2+Math.sin(n*0.9)*Math.max(1,(ROWS/2-2)*(1-n*0.03));
        return {c:Math.max(1,Math.min(COLS-2,Math.round(tx))), r:Math.max(1,Math.min(ROWS-2,Math.round(ty)))};
      }
    };

    const keys={};
    const onKey=e=>{ keys[e.key]=e.type==="keydown"; };
    window.addEventListener("keydown",onKey);
    window.addEventListener("keyup",onKey);

    // BFS pathfinding for AI (through dug+diggable cells)
    const aiBFS=(sc,sr,tc,tr)=>{
      const visited=Array.from({length:ROWS},()=>Array(COLS).fill(null));
      const q=[[sc,sr]]; visited[sr][sc]=[sc,sr];
      while(q.length){
        const [c2,r2]=q.shift();
        if(c2===tc&&r2===tr){
          // Trace back first step
          let cc=tc,cr=tr;
          while(true){
            const [pc,pr]=visited[cr][cc];
            if(pc===sc&&pr===sr) return {c:cc,r:cr};
            [cc,cr]=[pc,pr];
          }
        }
        for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nc=c2+dc,nr=r2+dr;
          if(nc<0||nc>=COLS||nr<0||nr>=ROWS) continue;
          if(tiles[nr][nc]===2) continue; // rock blocks
          if(visited[nr][nc]) continue;
          visited[nr][nc]=[c2,r2];
          q.push([nc,nr]);
        }
      }
      return null;
    };

    const digAt=(p,tc,tr)=>{
      if(tc<0||tc>=COLS||tr<0||tr>=ROWS) return;
      if(tiles[tr][tc]===2) return; // rock
      tiles[tr][tc]=1;
      // Reveal chest if digging on it
      if(tc===chestC&&tr===chestR) chestReveal=Math.min(1,chestReveal+0.28);
    };

    this.startLoop((dt)=>{
      const c=this.ctx;
      c.clearRect(0,0,W,H);

      // BG — earthy
      c.fillStyle="#1a0e08"; c.fillRect(0,0,W,H);

      if(!winner){
        // Human input (networked)
        const mk=netMG.isHost()?netMG.mergedKeys(keys):keys;
        if(netMG.isGuest()&&netMG.connected()) netMG.sendKeys(keys);
        const hp=gPlayers[0];
        let hm=0,hv=0;
        if(keys["a"]||keys["ArrowLeft"])  hm=-1;
        if(keys["d"]||keys["ArrowRight"]) hm= 1;
        if(keys["w"]||keys["ArrowUp"])    hv=-1;
        if(keys["s"]||keys["ArrowDown"])  hv= 1;
        if(hm&&hv){hm*=0.707;hv*=0.707;}
        if(hm||hv){
          hp.dx=hm; hp.dy=hv;
          const nx=hp.cx+hm*P_SPEED*dt, ny=hp.cy+hv*P_SPEED*dt;
          const nc=Math.round(nx), nr=Math.round(ny);
          // Try move — dig if needed
          if(nc>=0&&nc<COLS&&nr>=0&&nr<ROWS&&tiles[nr][nc]!==2){
            if(tiles[nr][nc]===0){
              hp.digTimer+=dt;
              if(hp.digTimer>=DIG_RATE){ hp.digTimer=0; digAt(hp,nc,nr); }
            } else { hp.cx=nx; hp.cy=ny; hp.digTimer=0; }
          }
          hp.cx=Math.max(0,Math.min(COLS-1,hp.cx));
          hp.cy=Math.max(0,Math.min(ROWS-1,hp.cy));
        }
        // Dig cell under player always if dirt
        digAt(hp,Math.round(hp.cx),Math.round(hp.cy));

        // Player 1 (Merryberry) - controlled by guest keys received over network
        if(netMG.isHost()){
          const hp1=gPlayers[1];
          if(!hp1.alive) goto_ai: ;
          else {
            let hm1=0,hv1=0;
            if(mk["p1_left"])  hm1=-1;
            if(mk["p1_right"]) hm1= 1;
            if(mk["p1_up"])    hv1=-1;
            if(mk["p1_down"]) hv1= 1;
            if(hm1&&hv1){hm1*=0.707;hv1*=0.707;}
            if(hm1||hv1){
              hp1.digTimer+=dt;
              const nx1=hp1.cx+hm1*P_SPEED*dt, ny1=hp1.cy+hv1*P_SPEED*dt;
              const nc1=Math.round(nx1), nr1=Math.round(ny1);
              if(nc1>=0&&nc1<COLS&&nr1>=0&&nr1<ROWS&&tiles[nr1][nc1]!==2){
                if(tiles[nr1][nc1]===1) tiles[nr1][nc1]=0;
                hp1.cx=nx1; hp1.cy=ny1;
              }
            }
          }
        }
        // AI players — one cell per DIG_RATE seconds, same as human. No free digs.
        gPlayers.forEach(p=>{
          if(p.isHuman||!p.alive) return;
          p.aiStuck+=dt;
          p.digTimer+=dt;
          if(p.digTimer<DIG_RATE) return; // wait for cooldown
          p.digTimer=0;

          const pc=Math.round(p.cx), pr=Math.round(p.cy);

          // Pick new wander target if none, arrived, or stuck
          const atTarget=p.aiTarget&&pc===p.aiTarget.c&&pr===p.aiTarget.r;
          if(!p.aiTarget||atTarget||p.aiStuck>3.0){
            // Keep picking until we get a target that isn't our current cell
            let t=null, tries=0;
            do { t=aiPickWander(p); tries++; } while(t&&t.c===pc&&t.r===pr&&tries<5);
            p.aiTarget=t;
            p.aiStuck=0;
          }

          if(!p.aiTarget) return;
          const {c:tc,r:tr}=p.aiTarget;
          const ddx=tc-pc, ddy=tr-pr;

          // Build move priority list: toward target first, fallbacks after
          const dirs=[];
          if(Math.abs(ddx)>=Math.abs(ddy)){
            if(ddx!==0) dirs.push([Math.sign(ddx),0]);
            if(ddy!==0) dirs.push([0,Math.sign(ddy)]);
          } else {
            if(ddy!==0) dirs.push([0,Math.sign(ddy)]);
            if(ddx!==0) dirs.push([Math.sign(ddx),0]);
          }
          for(const fb of [[1,0],[-1,0],[0,1],[0,-1]]){
            if(!dirs.some(([a,b])=>a===fb[0]&&b===fb[1])) dirs.push(fb);
          }

          let moved=false;
          for(const [dc2,dr2] of dirs){
            const nc=pc+dc2, nr=pr+dr2;
            if(nc<0||nc>=COLS||nr<0||nr>=ROWS) continue;
            if(tiles[nr][nc]===2) continue; // rock — try next direction
            p.cx=nc; p.cy=nr;
            digAt(p,nc,nr); // dig the cell we just moved into
            moved=true;
            break;
          }
          if(!moved){ p.aiTarget=null; p.aiStuck=0; } // all 4 dirs are rock — replan
        });

        // Check chest reveal
        if(chestReveal>=0.8&&!winner){
          // Find closest player to chest
          let best=null, bestD=Infinity;
          gPlayers.forEach(p=>{
            const d=Math.hypot(p.cx-chestC,p.cy-chestR);
            if(d<bestD){bestD=d;best=p;}
          });
          winner=best;
          chestAnim.open=true; chestAnim.t=0;
          // Spawn coin particles
          for(let i=0;i<24;i++) chestAnim.coins.push({
            x:(chestC+0.5)*CELL+OX, y:(chestR+0.5)*CELL+OY,
            vx:(Math.random()-0.5)*220, vy:-80-Math.random()*160,
            t:0, col:`hsl(${40+Math.random()*20},100%,60%)`
          });
        }
      } else {
        winTimer+=dt;
      }

      // Draw tiles
      for(let r=0;r<ROWS;r++) for(let cc=0;cc<COLS;cc++){
        const tx=OX+cc*CELL, ty=OY+r*CELL;
        if(tiles[r][cc]===2){
          // Rock
          c.fillStyle="#555060";
          c.fillRect(tx,ty,CELL,CELL);
          c.fillStyle="rgba(0,0,0,0.3)";
          c.fillRect(tx,ty,CELL/2,CELL/2);
        } else if(tiles[r][cc]===1){
          // Dug — dark cavity
          const shade=`#0d0805`;
          c.fillStyle=shade; c.fillRect(tx,ty,CELL,CELL);
        } else {
          // Dirt gradient
          const g2=c.createLinearGradient(tx,ty,tx+CELL,ty+CELL);
          g2.addColorStop(0,"#5c3a1e"); g2.addColorStop(1,"#3d2510");
          c.fillStyle=g2; c.fillRect(tx,ty,CELL,CELL);
          // Texture dots
          c.fillStyle="rgba(0,0,0,0.15)";
          c.fillRect(tx+3,ty+5,3,3); c.fillRect(tx+12,ty+12,2,2);
        }
        // Grid lines on dug cells
        if(tiles[r][cc]===1){
          c.strokeStyle="rgba(255,255,255,0.03)"; c.lineWidth=0.5;
          c.strokeRect(tx,ty,CELL,CELL);
        }
      }

      // Chest
      const cx2=(chestC+0.5)*CELL+OX, cy2=(chestR+0.5)*CELL+OY;
      const cw=CELL*2.2, ch=CELL*1.6;
      const chestAlpha=Math.min(1,chestReveal*2);
      c.globalAlpha=chestAlpha;
      // Chest body
      const cg=c.createLinearGradient(cx2-cw/2,cy2-ch/2,cx2+cw/2,cy2+ch/2);
      cg.addColorStop(0,"#8B5E3C"); cg.addColorStop(1,"#4a2f0e");
      c.fillStyle=cg; mgRoundRect(c,cx2-cw/2,cy2-ch/2,cw,ch,6); c.fill();
      c.strokeStyle="#ffd60a"; c.lineWidth=2;
      mgRoundRect(c,cx2-cw/2,cy2-ch/2,cw,ch,6); c.stroke();
      // Lock
      c.fillStyle="#ffd60a"; c.beginPath(); c.arc(cx2,cy2,cw*0.1,0,Math.PI*2); c.fill();
      if(chestReveal>=0.5){
        // Glow
        mgShadow(c,"#ffd60a",20+chestReveal*20);
        c.strokeStyle="#ffd60a"; c.lineWidth=2;
        mgRoundRect(c,cx2-cw/2,cy2-ch/2,cw,ch,6); c.stroke();
        mgShadow(c,"transparent",0);
      }
      c.globalAlpha=1;

      // Chest progress bar
      if(chestReveal>0&&!chestAnim.open){
        const bw=60,bh=8,bx=cx2-bw/2,by=cy2-ch/2-18;
        c.fillStyle="rgba(0,0,0,0.6)"; mgRoundRect(c,bx,by,bw,bh,4); c.fill();
        c.fillStyle="#ffd60a"; mgRoundRect(c,bx,by,bw*chestReveal,bh,4); c.fill();
      }

      // Coin particles
      chestAnim.coins.forEach(coin=>{
        coin.t+=0.016;
        coin.vy+=200*0.016;
        coin.x+=coin.vx*0.016; coin.y+=coin.vy*0.016;
        const alpha=Math.max(0,1-coin.t/1.4);
        c.globalAlpha=alpha;
        c.fillStyle=coin.col; c.beginPath();
        c.arc(coin.x,coin.y,5,0,Math.PI*2); c.fill();
        c.globalAlpha=1;
      });

      // Players
      gPlayers.forEach(p=>{
        const px=OX+(p.cx+0.5)*CELL, py=OY+(p.cy+0.5)*CELL;
        // Dig progress ring
        if(p.digTimer>0){
          c.beginPath(); c.arc(px,py,P_R+6,0,Math.PI*2*(p.digTimer/DIG_RATE));
          c.strokeStyle="#ffd60a"; c.lineWidth=3; c.stroke();
        }
        this.drawPlayerCircle(c,p.idx,px,py,P_R,p.isHuman?"gold":"white",p.isHuman?3:2);
      });

      // Header
      c.fillStyle="rgba(0,0,0,0.55)"; c.fillRect(0,0,W,84);
      c.font="bold 18px 'Fredoka One',cursive"; c.fillStyle="rgba(255,255,255,.45)";
      c.textAlign="center"; c.textBaseline="middle";
      c.fillText("⛏️ CHEST DIGGERS — FFA", W/2, 30);
      c.font="13px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.4)";
      c.fillText("Dig to the chest! First to uncover 80% wins the treasure!", W/2, 55);

      // Win overlay
      if(winner&&winTimer>0){
        c.fillStyle=`rgba(0,0,0,${Math.min(winTimer/1.2,0.75)})`; c.fillRect(0,0,W,H);
        if(winTimer>0.5){
          mgShadow(c,this.pColor(winner.idx),30);
          c.font="bold 52px 'Fredoka One',cursive"; c.fillStyle=this.pColor(winner.idx);
          c.textAlign="center"; c.textBaseline="middle";
          c.fillText(`${this.pName(winner.idx)} found the chest! 🏆`,W/2,H/2-30);
          mgShadow(c,"transparent",0);
          this.drawPlayerCircle(c,winner.idx,W/2,H/2+50,40,"gold",4);
        }
        if(winTimer>3){
          window.removeEventListener("keydown",onKey);
          window.removeEventListener("keyup",onKey);
          const rewards=[{playerIndex:winner.idx,coins:25},...[0,1,2,3].filter(i=>i!==winner.idx).map(i=>({playerIndex:i,coins:4}))];
          if(netMG.isHost()) netMG.broadcastEnd(rewards);
          this.showResults("FFA_DIG",rewards,[winner.idx,...[0,1,2,3].filter(i=>i!==winner.idx)]);
        }
      }

      // Controls
      c.font="11px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.2)";
      c.textAlign="center";
      c.fillText("WASD / Arrow Keys — dig toward the chest!",W/2,H-14);
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  DUOS_RACE – CO-OP KART RACE
  //  Players 0+1 share one car. Both press D=turn right, A=turn left.
  //  Combined input: both right = hard right, split = cancelled.
  //  3 laps on a procedural oval-ish track.
  // ═══════════════════════════════════════════════════════════
  startRace() {
    const W=window.innerWidth, H=window.innerHeight;
    const CX=W/2, CY=H/2;
    const TRACK_W=90; // wider road

    // Big Rainbow Road — 2.5x scale, more waypoints, hairpins, long straights, corkscrew feel
    const S=2.5; // scale multiplier vs old track
    const WP=[
      // Start straight heading right
      {x:CX,            y:CY-500*S*0.4},
      {x:CX+120*S*0.4,  y:CY-580*S*0.4},
      {x:CX+300*S*0.4,  y:CY-640*S*0.4},
      {x:CX+520*S*0.4,  y:CY-620*S*0.4},
      // Long sweeping right arc
      {x:CX+720*S*0.4,  y:CY-520*S*0.4},
      {x:CX+860*S*0.4,  y:CY-360*S*0.4},
      {x:CX+880*S*0.4,  y:CY-160*S*0.4},
      {x:CX+820*S*0.4,  y:CY+40*S*0.4},
      // Tight hairpin left
      {x:CX+660*S*0.4,  y:CY+160*S*0.4},
      {x:CX+460*S*0.4,  y:CY+180*S*0.4},
      {x:CX+280*S*0.4,  y:CY+100*S*0.4},
      // S-bend down
      {x:CX+80*S*0.4,   y:CY+200*S*0.4},
      {x:CX-100*S*0.4,  y:CY+340*S*0.4},
      {x:CX-60*S*0.4,   y:CY+500*S*0.4},
      {x:CX+120*S*0.4,  y:CY+620*S*0.4},
      {x:CX+340*S*0.4,  y:CY+660*S*0.4},
      // Wide right loop at bottom
      {x:CX+560*S*0.4,  y:CY+620*S*0.4},
      {x:CX+700*S*0.4,  y:CY+500*S*0.4},
      {x:CX+700*S*0.4,  y:CY+340*S*0.4},
      // Chicane back left
      {x:CX+560*S*0.4,  y:CY+240*S*0.4},
      {x:CX+380*S*0.4,  y:CY+320*S*0.4},
      {x:CX+200*S*0.4,  y:CY+420*S*0.4},
      // Long sweep up left side
      {x:CX-60*S*0.4,   y:CY+360*S*0.4},
      {x:CX-260*S*0.4,  y:CY+240*S*0.4},
      {x:CX-420*S*0.4,  y:CY+100*S*0.4},
      {x:CX-520*S*0.4,  y:CY-80*S*0.4},
      {x:CX-480*S*0.4,  y:CY-280*S*0.4},
      // Tight hairpin top-left
      {x:CX-360*S*0.4,  y:CY-420*S*0.4},
      {x:CX-200*S*0.4,  y:CY-500*S*0.4},
      {x:CX-80*S*0.4,   y:CY-520*S*0.4},
    ];
    const NWP=WP.length;

    // Rainbow colours per segment
    const SEG_COLORS=[
      "#ff6b9d","#ff8c42","#ffd60a","#06d6a0","#4cc9f0","#c77dff",
      "#ff6b9d","#ff8c42","#ffd60a","#06d6a0","#4cc9f0","#c77dff",
      "#ff6b9d","#ff8c42","#ffd60a","#06d6a0","#4cc9f0","#c77dff",
      "#ff6b9d","#ff8c42","#ffd60a","#06d6a0","#4cc9f0","#c77dff",
    ];

    let camX=WP[0].x, camY=WP[0].y;

    const car={
      x:WP[0].x, y:WP[0].y+40,
      angle:-Math.PI/2, speed:0,
      maxSpeed:420, accel:220, turnRate:2.2,
      lap:0, nextWP:1, lapsNeeded:3, finished:false,
    };
    const aiCar={
      x:WP[0].x+42, y:WP[0].y+40,
      angle:-Math.PI/2, speed:0,
      maxSpeed:400, accel:205, turnRate:2.4,
      lap:0, nextWP:1, lapsNeeded:3, finished:false, isAI:true,
    };

    let raceOver=false, raceTimer=0, winnerIsPlayer=false;
    let countdownT=3, started=false;

    const keys={};
    const onKey=e=>{ keys[e.key]=e.type==="keydown"; };
    window.addEventListener("keydown",onKey);
    window.addEventListener("keyup",onKey);

    const wpDist=(car2,idx)=>{
      const wp=WP[idx%NWP];
      return Math.hypot(car2.x-wp.x,car2.y-wp.y);
    };
    const updateWP=(car2)=>{
      if(wpDist(car2,car2.nextWP)<TRACK_W*1.1){
        car2.nextWP=(car2.nextWP+1)%NWP;
        if(car2.nextWP===1){ car2.lap++; }
        if(car2.lap>=car2.lapsNeeded&&!car2.finished) car2.finished=true;
      }
    };
    // Find closest point on the track to a world position
    const nearestTrackPoint=(wx,wy)=>{
      let best=Infinity, bx=wx, by=wy;
      for(let i=0;i<NWP;i++){
        const a=WP[i], b=WP[(i+1)%NWP];
        const dx=b.x-a.x, dy=b.y-a.y, len2=dx*dx+dy*dy;
        if(len2===0) continue;
        const t=Math.max(0,Math.min(1,((wx-a.x)*dx+(wy-a.y)*dy)/len2));
        const nx=a.x+t*dx, ny=a.y+t*dy;
        const d=Math.hypot(wx-nx,wy-ny);
        if(d<best){best=d;bx=nx;by=ny;}
      }
      return {nx:bx,ny:by,dist:best};
    };

    const updateCar=(car2,steerL,steerR,dt2)=>{
      if(car2.finished) return;
      const net=steerR-steerL;
      const bothPressed=steerL>0&&steerR>0;
      const turn=bothPressed?0:net*car2.turnRate;
      car2.angle+=turn*dt2;
      car2.speed=Math.min(car2.speed+car2.accel*dt2, car2.maxSpeed);
      car2.x+=Math.cos(car2.angle)*car2.speed*dt2;
      car2.y+=Math.sin(car2.angle)*car2.speed*dt2;

      // Track bounds — push car back onto road if it wanders off
      const {nx,ny,dist}=nearestTrackPoint(car2.x,car2.y);
      if(dist>TRACK_W){
        // Push back proportionally, kill speed
        const over=dist-TRACK_W;
        const pushX=(car2.x-nx)/dist, pushY=(car2.y-ny)/dist;
        car2.x=nx+pushX*TRACK_W;
        car2.y=ny+pushY*TRACK_W;
        car2.speed*=0.35; // heavy speed penalty for going off
      }

      updateWP(car2);
    };

    const drawTrack=(c)=>{
      // Draw each segment with its rainbow colour — thick road with white kerbs
      for(let i=0;i<NWP;i++){
        const a=WP[i], b=WP[(i+1)%NWP];
        const sx=a.x-camX+W/2, sy=a.y-camY+H/2;
        const ex=b.x-camX+W/2, ey=b.y-camY+H/2;
        // Kerb (wider white/red stripe)
        c.beginPath(); c.moveTo(sx,sy); c.lineTo(ex,ey);
        c.strokeStyle=i%2===0?"#ff3333":"white";
        c.lineWidth=TRACK_W*2+16; c.lineCap="round"; c.stroke();
        // Road surface
        c.beginPath(); c.moveTo(sx,sy); c.lineTo(ex,ey);
        c.strokeStyle=SEG_COLORS[i%SEG_COLORS.length]+"cc";
        c.lineWidth=TRACK_W*2; c.stroke();
        // Dark centre line
        c.beginPath(); c.moveTo(sx,sy); c.lineTo(ex,ey);
        c.strokeStyle="rgba(0,0,0,0.2)"; c.lineWidth=4;
        c.setLineDash([16,16]); c.stroke(); c.setLineDash([]);
      }
      // Finish line
      const f=WP[0], fn=WP[1];
      const fa=Math.atan2(fn.y-f.y,fn.x-f.x);
      const fx=f.x-camX+W/2, fy=f.y-camY+H/2;
      c.save(); c.translate(fx,fy); c.rotate(fa+Math.PI/2);
      for(let i=0;i<6;i++){
        c.fillStyle=i%2===0?"white":"#111";
        c.fillRect(-TRACK_W+i*(TRACK_W/3)*2,-10,TRACK_W/3*2,20);
      }
      c.restore();
      // Arrow at next WP for player car (helpful direction cue)
      const nwp=WP[car.nextWP%NWP];
      const aw=nwp.x-camX+W/2, ah=nwp.y-camY+H/2;
      c.save(); c.translate(aw,ah);
      c.rotate(Math.atan2(nwp.y-(WP[(car.nextWP-1+NWP)%NWP].y),nwp.x-WP[(car.nextWP-1+NWP)%NWP].x));
      c.font="20px serif"; c.textAlign="center"; c.textBaseline="middle";
      c.globalAlpha=0.55; c.fillText("➡",0,0);
      c.restore(); c.globalAlpha=1;
    };

    const drawCarFn=(car2,col1,col2,isPlayer,label)=>{
      const c=this.ctx;
      c.save();
      c.translate(car2.x-camX+W/2, car2.y-camY+H/2);
      c.rotate(car2.angle+Math.PI/2);
      const bw=26,bh=42;
      const bg2=c.createLinearGradient(-bw/2,-bh/2,bw/2,bh/2);
      bg2.addColorStop(0,col1); bg2.addColorStop(1,col2||col1);
      c.fillStyle=bg2; mgRoundRect(c,-bw/2,-bh/2,bw,bh,8); c.fill();
      c.strokeStyle=isPlayer?"gold":"rgba(255,255,255,0.4)";
      c.lineWidth=isPlayer?3:2; mgRoundRect(c,-bw/2,-bh/2,bw,bh,8); c.stroke();
      c.fillStyle="rgba(100,200,255,0.35)"; mgRoundRect(c,-bw/2+4,-bh/2+5,bw-8,11,3); c.fill();
      c.fillStyle="#111";
      [[-bw/2-3,-bh/2+5],[bw/2-3,-bh/2+5],[-bw/2-3,bh/2-15],[bw/2-3,bh/2-15]].forEach(([wx,wy])=>{
        mgRoundRect(c,wx,wy,6,10,2); c.fill();
      });
      c.restore();
      const sx=car2.x-camX+W/2, sy=car2.y-camY+H/2;
      c.font="bold 11px 'Fredoka One',cursive"; c.fillStyle="white";
      c.textAlign="center"; c.textBaseline="bottom"; c.fillText(label,sx,sy-28);
    };

    this.startLoop((dt)=>{
      const c=this.ctx;
      c.clearRect(0,0,W,H);

      // Rainbow Road void BG — dark space with stars
      const bg=c.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.8);
      bg.addColorStop(0,"#0a0520"); bg.addColorStop(1,"#000008");
      c.fillStyle=bg; c.fillRect(0,0,W,H);
      // Static stars
      for(let i=0;i<60;i++){
        const sx=(i*173+13)%W, sy=(i*97+31)%H;
        c.fillStyle=`rgba(255,255,255,${0.1+0.4*(i%3===0?1:0)})`;
        c.beginPath(); c.arc(sx,sy,i%5===0?2:1,0,Math.PI*2); c.fill();
      }

      // Smooth camera
      camX+=(car.x-camX)*9*Math.min(dt,0.05);
      camY+=(car.y-camY)*9*Math.min(dt,0.05);

      drawTrack(c);

      if(countdownT>0){
        countdownT-=dt;
        const n=Math.ceil(countdownT);
        c.font=`bold ${Math.round(80+(1-(countdownT%1))*20)}px 'Fredoka One',cursive`;
        c.fillStyle=n===1?"#ff6b9d":n===2?"#c77dff":"#4cc9f0";
        mgShadow(c,c.fillStyle,30);
        c.textAlign="center"; c.textBaseline="middle";
        c.fillText(n>0?`${n}`:"GO!",W/2,H/2);
        mgShadow(c,"transparent",0);
        drawCarFn(car,this.pColor(0),this.pColor(1),true,`${this.pName(0)} + ${this.pName(1)}`);
        drawCarFn(aiCar,this.pColor(2),this.pColor(3),false,`${this.pName(2)} + ${this.pName(3)}`);
      } else {
        if(!started) started=true;

        if(!raceOver){
          // Player input: you=A/D, gf=J/L
          const p0L=keys["a"]||keys["ArrowLeft"]?1:0;
          const p0R=keys["d"]||keys["ArrowRight"]?1:0;
          const p1L=keys["j"]?1:0;
          const p1R=keys["l"]?1:0;
          const totalL=Math.min(1,p0L+p1L), totalR=Math.min(1,p0R+p1R);
          updateCar(car,totalL,totalR,dt);

          // AI steering toward next waypoint
          const wp=WP[aiCar.nextWP%NWP];
          const targetAngle=Math.atan2(wp.y-aiCar.y,wp.x-aiCar.x);
          let da=targetAngle-aiCar.angle;
          while(da>Math.PI) da-=Math.PI*2;
          while(da<-Math.PI) da+=Math.PI*2;
          const aiL=da<-0.05?Math.min(1,Math.abs(da)*0.8):0;
          const aiR=da>0.05?Math.min(1,da*0.8):0;
          updateCar(aiCar,aiL,aiR,dt);

          if(car.finished||aiCar.finished){
            raceOver=true;
            winnerIsPlayer=car.finished&&(!aiCar.finished||car.lap>=aiCar.lap);
          }
        } else {
          raceTimer+=dt;
          if(raceTimer>3.5){
            window.removeEventListener("keydown",onKey);
            window.removeEventListener("keyup",onKey);
            const rewards=winnerIsPlayer
              ?[{playerIndex:0,coins:16},{playerIndex:1,coins:16},{playerIndex:2,coins:4},{playerIndex:3,coins:4}]
              :[{playerIndex:0,coins:4},{playerIndex:1,coins:4},{playerIndex:2,coins:16},{playerIndex:3,coins:16}];
            if(netMG.isHost()) netMG.broadcastEnd(rewards);
          this.showResults("DUOS_RACE",rewards,winnerIsPlayer?[0,1,2,3]:[2,3,0,1]);
            return;
          }
        }

        drawCarFn(aiCar,this.pColor(2),this.pColor(3),false,`${this.pName(2)} + ${this.pName(3)}`);
        drawCarFn(car,this.pColor(0),this.pColor(1),true,`${this.pName(0)} + ${this.pName(1)}`);

        // HUD
        c.fillStyle="rgba(0,0,0,0.55)"; c.fillRect(0,0,W,72);
        c.font="bold 16px 'Fredoka One',cursive"; c.textAlign="center"; c.textBaseline="middle";
        c.fillStyle=this.pColor(0);
        c.fillText(`🏎️ ${this.pName(0)} & ${this.pName(1)} — Lap ${Math.min(car.lap+1,3)}/3`,W*0.28,36);
        c.fillStyle=this.pColor(2);
        c.fillText(`🤖 ${this.pName(2)} & ${this.pName(3)} — Lap ${Math.min(aiCar.lap+1,3)}/3`,W*0.72,36);
        c.font="11px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.28)";
        c.fillText("You: A/D   Gf: J/L — same direction = turn, opposite = straight",W/2,58);

        c.font="11px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.2)";
        c.textAlign="center"; c.fillText("Follow the ➡ arrows!",W/2,H-14);

        if(raceOver){
          c.fillStyle=`rgba(0,0,0,${Math.min(raceTimer/1.2,0.72)})`; c.fillRect(0,0,W,H);
          if(raceTimer>0.5){
            const col=winnerIsPlayer?this.pColor(0):this.pColor(2);
            mgShadow(c,col,28);
            c.font="bold 48px 'Fredoka One',cursive"; c.fillStyle=col;
            c.textAlign="center"; c.textBaseline="middle";
            c.fillText(winnerIsPlayer?`${this.pName(0)} & ${this.pName(1)} WIN! 🏎️`:`${this.pName(2)} & ${this.pName(3)} WIN! 🏎️`,W/2,H/2);
            mgShadow(c,"transparent",0);
          }
        }
      }

      // Mini-map
      const mmX=W-105,mmY=H-105,mmS=90;
      c.fillStyle="rgba(0,0,0,0.6)"; c.fillRect(mmX,mmY,mmS,mmS);
      c.strokeStyle="rgba(255,255,255,0.15)"; c.lineWidth=1; c.strokeRect(mmX,mmY,mmS,mmS);
      // Find track bounding box for mini-map scale
      const txs=WP.map(w=>w.x), tys=WP.map(w=>w.y);
      const tminx=Math.min(...txs),tmaxx=Math.max(...txs),tminy=Math.min(...tys),tmaxy=Math.max(...tys);
      const tscale=mmS/Math.max(tmaxx-tminx,tmaxy-tminy)*0.85;
      const tmx=(mmX+mmS/2)-(tminx+tmaxx)/2*tscale, tmy=(mmY+mmS/2)-(tminy+tmaxy)/2*tscale;
      // Track line
      c.beginPath();
      WP.forEach((wp,i)=>{ i===0?c.moveTo(tmx+wp.x*tscale,tmy+wp.y*tscale):c.lineTo(tmx+wp.x*tscale,tmy+wp.y*tscale); });
      c.closePath(); c.strokeStyle="#888"; c.lineWidth=4; c.stroke();
      // Cars on mini-map
      [{cr:car,col:"#ff6b9d"},{cr:aiCar,col:"#06d6a0"}].forEach(({cr,col})=>{
        c.fillStyle=col; c.beginPath();
        c.arc(tmx+cr.x*tscale,tmy+cr.y*tscale,4,0,Math.PI*2); c.fill();
      });
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  1V3_TAG – HAMMER TAG
  //  The 1 (runner) must survive 30s. The 3 have hammers.
  //  Runner is faster + has a dash (Space, 3s cooldown).
  //  Hunters click to slam their hammer — shows AOE then strikes.
  // ═══════════════════════════════════════════════════════════
  startTag() {
    const landIdx=this.landingPlayer.index;
    const runnerIdx=landIdx; // the 1 who landed is the runner
    const hunterIdxs=[0,1,2,3].filter(i=>i!==runnerIdx);
    const humanIdxs=[0,1];
    const W=window.innerWidth, H=window.innerHeight;
    const ARENA={x:60,y:80,w:W-120,h:H-140};
    const RUNNER_SPEED=230, HUNTER_SPEED=170;
    const DASH_COOLDOWN=3, DASH_DIST=200, DASH_DUR=0.22;
    const HAMMER_WINDUP=0.55, HAMMER_SLAM=0.18, HAMMER_LIFT=0.4;
    const HAMMER_R=38; // AOE hit radius — matches visual circle
    const SURVIVE_TIME=30;

    const runner={
      idx:runnerIdx, x:ARENA.x+ARENA.w/2, y:ARENA.y+ARENA.h/2,
      r:20, isHuman:humanIdxs.includes(runnerIdx),
      dashCD:0, dashing:false, dashT:0,
      dashDX:0, dashDY:0,
      hit:false,
    };

    const hunters=hunterIdxs.map((idx,k)=>({
      idx, r:22,
      x:[ARENA.x+ARENA.w*0.2, ARENA.x+ARENA.w*0.5, ARENA.x+ARENA.w*0.8, ARENA.x+ARENA.w*0.5][k],
      y:[ARENA.y+40, ARENA.y+40, ARENA.y+40, ARENA.y+ARENA.h-40][k],
      isHuman:humanIdxs.includes(idx)&&!humanIdxs.includes(runnerIdx),
      hammer:null,
      aiHammerCD:0,
      // Personality: 0=direct chaser, 1=left flanker, 2=right flanker, 3=blocker (cuts off escape)
      personality:k,
      // Flankers use an offset angle to approach from different sides
      flankAngle:[0, Math.PI*0.6, -Math.PI*0.6, Math.PI][k],
    }));

    let elapsed=0, survived=false, runnerHit=false, endTimer=0;
    const keys={};
    const onKey=e=>{
      keys[e.key]=e.type==="keydown";
      // Dash on space (runner only if human)
      if(e.type==="keydown"&&e.key===" "&&runner.isHuman&&runner.dashCD<=0&&!runner.dashing&&!runnerHit){
        let dx=0,dy=0;
        if(keys["ArrowLeft"]||keys["a"])  dx=-1;
        if(keys["ArrowRight"]||keys["d"]) dx= 1;
        if(keys["ArrowUp"]||keys["w"])    dy=-1;
        if(keys["ArrowDown"]||keys["s"])  dy= 1;
        if(!dx&&!dy) dx=1;
        const d=Math.hypot(dx,dy)||1;
        runner.dashing=true; runner.dashT=0;
        runner.dashDX=dx/d; runner.dashDY=dy/d;
        runner.dashCD=DASH_COOLDOWN;
      }
    };
    window.addEventListener("keydown",onKey);
    window.addEventListener("keyup",onKey);

    // Human hunter clicks to aim hammer — clamped to reach in front of hunter
    const HAMMER_REACH=110; // max distance from hunter the hammer can land
    const onClickTag=(e)=>{
      if(runnerHit||survived) return;
      const rect=this.canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      hunters.forEach(h=>{
        if(!h.isHuman||h.hammer) return;
        // Clamp click to within HAMMER_REACH of the hunter
        const dx=mx-h.x, dy=my-h.y, d=Math.hypot(dx,dy)||1;
        const clampedDist=Math.min(d, HAMMER_REACH);
        const tx=h.x+(dx/d)*clampedDist;
        const ty=h.y+(dy/d)*clampedDist;
        h.hammer={phase:"windup",t:0,tx,ty};
      });
    };
    this.canvas.addEventListener("click",onClickTag);

    this.startLoop((dt)=>{
      const c=this.ctx;
      c.clearRect(0,0,W,H);

      // BG
      const bg=c.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.6);
      bg.addColorStop(0,"#1a1028"); bg.addColorStop(1,"#080814");
      c.fillStyle=bg; c.fillRect(0,0,W,H);

      // Arena floor
      c.fillStyle="rgba(255,255,255,0.04)";
      mgRoundRect(c,ARENA.x,ARENA.y,ARENA.w,ARENA.h,18); c.fill();
      c.strokeStyle="rgba(255,255,255,0.12)"; c.lineWidth=2;
      mgRoundRect(c,ARENA.x,ARENA.y,ARENA.w,ARENA.h,18); c.stroke();
      // Floor grid
      c.strokeStyle="rgba(255,255,255,0.03)"; c.lineWidth=1;
      for(let x=ARENA.x;x<ARENA.x+ARENA.w;x+=60){c.beginPath();c.moveTo(x,ARENA.y);c.lineTo(x,ARENA.y+ARENA.h);c.stroke();}
      for(let y=ARENA.y;y<ARENA.y+ARENA.h;y+=60){c.beginPath();c.moveTo(ARENA.x,y);c.lineTo(ARENA.x+ARENA.w,y);c.stroke();}

      if(!runnerHit&&!survived){
        elapsed+=dt;
        if(elapsed>=SURVIVE_TIME){ survived=true; }

        // Runner movement
        if(!runner.dashing){
          if(runner.isHuman){
            let mx=0,my=0;
            if(keys["ArrowLeft"]||keys["a"])  mx=-1;
            if(keys["ArrowRight"]||keys["d"]) mx= 1;
            if(keys["ArrowUp"]||keys["w"])    my=-1;
            if(keys["ArrowDown"]||keys["s"])  my= 1;
            if(mx&&my){mx*=0.707;my*=0.707;}
            runner.x=Math.max(ARENA.x+runner.r,Math.min(ARENA.x+ARENA.w-runner.r,runner.x+mx*RUNNER_SPEED*dt));
            runner.y=Math.max(ARENA.y+runner.r,Math.min(ARENA.y+ARENA.h-runner.r,runner.y+my*RUNNER_SPEED*dt));
          } else {
            // AI runner: flee from closest hunter
            let fx=0,fy=0;
            hunters.forEach(h=>{
              const dx=runner.x-h.x, dy=runner.y-h.y;
              const d=Math.hypot(dx,dy)||1;
              fx+=dx/d/(d*0.01+1);
              fy+=dy/d/(d*0.01+1);
            });
            // Also avoid walls
            fx+=(runner.x-ARENA.x-ARENA.w/2)*0.003;
            fy+=(runner.y-ARENA.y-ARENA.h/2)*0.003;
            const fl=Math.hypot(fx,fy)||1;
            runner.x+=fx/fl*RUNNER_SPEED*dt;
            runner.y+=fy/fl*RUNNER_SPEED*dt;
            runner.x=Math.max(ARENA.x+runner.r,Math.min(ARENA.x+ARENA.w-runner.r,runner.x));
            runner.y=Math.max(ARENA.y+runner.r,Math.min(ARENA.y+ARENA.h-runner.r,runner.y));
            // AI dash
            if(runner.dashCD<=0){
              const closestD=Math.min(...hunters.map(h=>Math.hypot(h.x-runner.x,h.y-runner.y)));
              if(closestD<140){
                runner.dashing=true; runner.dashT=0; runner.dashCD=DASH_COOLDOWN;
                runner.dashDX=fx/fl; runner.dashDY=fy/fl;
              }
            }
          }
        } else {
          // Dashing
          runner.dashT+=dt;
          const prog=Math.min(1,runner.dashT/DASH_DUR);
          runner.x+=runner.dashDX*DASH_DIST*(1-prog)*dt/DASH_DUR;
          runner.y+=runner.dashDY*DASH_DIST*(1-prog)*dt/DASH_DUR;
          runner.x=Math.max(ARENA.x+runner.r,Math.min(ARENA.x+ARENA.w-runner.r,runner.x));
          runner.y=Math.max(ARENA.y+runner.r,Math.min(ARENA.y+ARENA.h-runner.r,runner.y));
          if(runner.dashT>=DASH_DUR) runner.dashing=false;
        }
        runner.dashCD=Math.max(0,runner.dashCD-dt);

        // Hunter movement + hammer — pincer coordination
        hunters.forEach(h=>{
          if(!h.isHuman){
            const dx=runner.x-h.x, dy=runner.y-h.y, d=Math.hypot(dx,dy)||1;

            // --- Pincer system ---
            // Each hunter targets a different angle around the runner
            // so they naturally surround rather than stack
            const totalHunters=hunters.filter(hh=>!hh.isHuman).length;
            const myRank=hunters.filter(hh=>!hh.isHuman).indexOf(h);
            const baseAngle=Math.atan2(dy,dx); // angle from hunter to runner

            let moveX=0, moveY=0;

            if(d>HAMMER_REACH*0.8){
              // Approaching: target a point offset around the runner
              // Each hunter approaches from a different spread angle
              const spreadAngle=baseAngle + (myRank/totalHunters)*Math.PI*2;
              // Stand-off distance: just outside hammer reach so they can swing
              const standoff=HAMMER_REACH*0.65;
              const targetX=runner.x-Math.cos(spreadAngle)*standoff;
              const targetY=runner.y-Math.sin(spreadAngle)*standoff;
              const td=Math.hypot(targetX-h.x,targetY-h.y)||1;
              moveX=(targetX-h.x)/td;
              moveY=(targetY-h.y)/td;
            } else {
              // In range: hold position and swing — slight drift to keep spread
              const spreadAngle=baseAngle+(myRank/totalHunters)*Math.PI*2;
              moveX=Math.cos(spreadAngle)*0.3;
              moveY=Math.sin(spreadAngle)*0.3;
            }

            if(!h.hammer||h.hammer.phase!=="slam"){
              h.x+=moveX*HUNTER_SPEED*dt;
              h.y+=moveY*HUNTER_SPEED*dt;
            }

            // AI hammer — swing when in range
            h.aiHammerCD=Math.max(0,h.aiHammerCD-dt);
            if(!h.hammer&&h.aiHammerCD<=0&&d<HAMMER_REACH*1.2){
              // Predict runner slightly ahead
              const velEst=0.3;
              const predX=runner.x+(runner.x-h.x)*velEst;
              const predY=runner.y+(runner.y-h.y)*velEst;
              const pd=Math.hypot(predX-h.x,predY-h.y)||1;
              const clamp=Math.min(pd,HAMMER_REACH);
              h.hammer={phase:"windup",t:0,
                tx:h.x+(predX-h.x)/pd*clamp,
                ty:h.y+(predY-h.y)/pd*clamp};
              // Stagger by rank so they don't all swing at once
              h.aiHammerCD=HAMMER_WINDUP+HAMMER_SLAM+HAMMER_LIFT+0.5+myRank*0.4+Math.random()*0.3;
            }
          }

          h.x=Math.max(ARENA.x+h.r,Math.min(ARENA.x+ARENA.w-h.r,h.x));
          h.y=Math.max(ARENA.y+h.r,Math.min(ARENA.y+ARENA.h-h.r,h.y));

          // Advance hammer animation
          if(h.hammer){
            h.hammer.t+=dt;
            if(h.hammer.phase==="windup"&&h.hammer.t>=HAMMER_WINDUP){
              h.hammer.phase="slam"; h.hammer.t=0;
              // Check hit
              if(Math.hypot(runner.x-h.hammer.tx,runner.y-h.hammer.ty)<HAMMER_R&&!runner.dashing){
                runnerHit=true;
              }
            } else if(h.hammer.phase==="slam"&&h.hammer.t>=HAMMER_SLAM){
              h.hammer.phase="lift"; h.hammer.t=0;
            } else if(h.hammer.phase==="lift"&&h.hammer.t>=HAMMER_LIFT){
              h.hammer=null;
            }
          }
        });
      } else {
        endTimer+=dt;
      }

      // Draw hammer AOEs (behind everything)
      hunters.forEach(h=>{
        if(!h.hammer) return;
        const {phase,t,tx,ty}=h.hammer;
        if(phase==="windup"){
          const prog=t/HAMMER_WINDUP;
          // Pulsing warning ring
          c.beginPath(); c.arc(tx,ty,HAMMER_R,0,Math.PI*2);
          c.fillStyle=`rgba(255,80,80,${0.08+prog*0.15})`; c.fill();
          c.strokeStyle=`rgba(255,80,80,${0.3+prog*0.5})`; c.lineWidth=3+prog*3; c.stroke();
          // Danger X
          c.strokeStyle=`rgba(255,80,80,${prog*0.6})`; c.lineWidth=2;
          const r2=HAMMER_R*0.6;
          c.beginPath(); c.moveTo(tx-r2,ty-r2); c.lineTo(tx+r2,ty+r2); c.stroke();
          c.beginPath(); c.moveTo(tx+r2,ty-r2); c.lineTo(tx-r2,ty+r2); c.stroke();
        } else if(phase==="slam"){
          const prog=t/HAMMER_SLAM;
          // Impact flash
          c.beginPath(); c.arc(tx,ty,HAMMER_R*(1+prog*0.4),0,Math.PI*2);
          c.fillStyle=`rgba(255,120,0,${0.5*(1-prog)})`; c.fill();
          // Shockwave rings
          for(let i=0;i<3;i++){
            const rr=HAMMER_R*(0.4+i*0.3)*prog;
            c.beginPath(); c.arc(tx,ty,rr,0,Math.PI*2);
            c.strokeStyle=`rgba(255,180,0,${0.7*(1-prog)})`; c.lineWidth=4; c.stroke();
          }
        }
      });

      // Draw hunters
      hunters.forEach(h=>{
        // Hammer visual above hunter
        if(h.hammer){
          const {phase,t}=h.hammer;
          let hammerY=0;
          if(phase==="windup") hammerY=-30*(t/HAMMER_WINDUP);
          else if(phase==="slam") hammerY=-30+(30+20)*(t/HAMMER_SLAM);
          else hammerY=20*(1-t/HAMMER_LIFT);
          c.font=`${34+hammerY*0.3}px serif`;
          c.textAlign="center"; c.textBaseline="middle";
          mgShadow(c,phase==="slam"?"#ff8000":"rgba(0,0,0,0.5)",phase==="slam"?20:8);
          c.fillText("🔨",h.x,h.y-40+hammerY);
          mgShadow(c,"transparent",0);
        }
        this.drawPlayerCircle(c,h.idx,h.x,h.y,h.r,h.isHuman?"gold":"#ff6b9d",h.isHuman?3:2.5);
      });

      // Draw runner
      if(!runnerHit){
        // Dash trail
        if(runner.dashing){
          for(let i=1;i<=4;i++){
            const tx2=runner.x-runner.dashDX*i*14, ty2=runner.y-runner.dashDY*i*14;
            c.globalAlpha=0.15*(5-i)/4;
            this.drawPlayerCircle(c,runner.idx,tx2,ty2,runner.r,"white",1);
            c.globalAlpha=1;
          }
        }
        // Dash CD ring
        if(runner.dashCD>0){
          const frac=1-runner.dashCD/DASH_COOLDOWN;
          c.beginPath(); c.arc(runner.x,runner.y,runner.r+8,-Math.PI/2,-Math.PI/2+Math.PI*2*frac);
          c.strokeStyle="rgba(100,200,255,0.7)"; c.lineWidth=3; c.stroke();
        } else {
          c.beginPath(); c.arc(runner.x,runner.y,runner.r+8,0,Math.PI*2);
          c.strokeStyle="rgba(100,200,255,0.4)"; c.lineWidth=2; c.stroke();
        }
        const runRing=runner.isHuman?"gold":"#4cc9f0";
        this.drawPlayerCircle(c,runner.idx,runner.x,runner.y,runner.r,runRing,3.5);
      } else {
        c.globalAlpha=0.3;
        this.drawPlayerCircle(c,runner.idx,runner.x,runner.y,runner.r,"#888",2);
        c.globalAlpha=1;
        c.font="22px serif"; c.textAlign="center"; c.textBaseline="middle";
        c.fillText("💀",runner.x,runner.y);
      }

      // Timer bar
      const timeLeft=Math.max(0,SURVIVE_TIME-elapsed);
      const timerFrac=timeLeft/SURVIVE_TIME;
      c.fillStyle="rgba(0,0,0,0.5)"; c.fillRect(0,0,W,72);
      c.font="bold 18px 'Fredoka One',cursive"; c.textAlign="center"; c.textBaseline="middle";
      c.fillStyle=timerFrac<0.3?"#ff4444":"white";
      c.fillText(`⏱ ${Math.ceil(timeLeft)}s`,W/2,30);
      const tbx=60,tby=50,tbw=W-120,tbh=8;
      c.fillStyle="rgba(255,255,255,0.1)"; mgRoundRect(c,tbx,tby,tbw,tbh,4); c.fill();
      const tg=c.createLinearGradient(tbx,0,tbx+tbw,0);
      tg.addColorStop(0,"#06d6a0"); tg.addColorStop(1,timerFrac<0.3?"#ff4444":"#4cc9f0");
      c.fillStyle=tg; mgRoundRect(c,tbx,tby,tbw*timerFrac,tbh,4); c.fill();

      c.font="bold 15px 'Fredoka One',cursive"; c.textAlign="left";
      c.fillStyle="#4cc9f0"; c.fillText(`🏃 ${this.pName(runnerIdx)}: Survive!`,70,30);
      c.fillStyle="#ff6b9d"; c.textAlign="right";
      c.fillText(`🔨 Hunters: Catch them!`,W-70,30);

      // Dash CD display
      c.font="11px 'Nunito',sans-serif"; c.fillStyle="rgba(255,255,255,.25)";
      c.textAlign="center"; c.fillText(
        runner.isHuman
          ? `WASD to move  |  SPACE to dash (${runner.dashCD>0?runner.dashCD.toFixed(1)+"s":"READY!"})`
          : "Hunter controls: click anywhere to swing hammer",
        W/2, H-14
      );

      // End overlay
      if(runnerHit||survived){
        c.fillStyle=`rgba(0,0,0,${Math.min(endTimer/1.2,0.75)})`; c.fillRect(0,0,W,H);
        if(endTimer>0.7){
          const runnerWin=survived;
          const col=runnerWin?this.pColor(runnerIdx):"#ff6b9d";
          mgShadow(c,col,28);
          c.font="bold 48px 'Fredoka One',cursive"; c.fillStyle=col;
          c.textAlign="center"; c.textBaseline="middle";
          c.fillText(runnerWin?`${this.pName(runnerIdx)} SURVIVED! 🏃💨`:`${this.pName(runnerIdx)} was caught! 🔨`,W/2,H/2-24);
          mgShadow(c,"transparent",0);
          this.drawPlayerCircle(c,runnerIdx,W/2,H/2+60,36,col,4);
        }
        if(endTimer>3){
          window.removeEventListener("keydown",onKey);
          window.removeEventListener("keyup",onKey);
          this.canvas.removeEventListener("click",onClickTag);
          const rw=survived;
          const rewards=rw
            ?[{playerIndex:runnerIdx,coins:22},{playerIndex:hunterIdxs[0],coins:3},{playerIndex:hunterIdxs[1],coins:3},{playerIndex:hunterIdxs[2],coins:3}]
            :[{playerIndex:runnerIdx,coins:0},{playerIndex:hunterIdxs[0],coins:14},{playerIndex:hunterIdxs[1],coins:14},{playerIndex:hunterIdxs[2],coins:14}];
          if(netMG.isHost()) netMG.broadcastEnd(rewards);
          this.showResults("1V3_TAG",rewards,rw?[runnerIdx,...hunterIdxs]:[...hunterIdxs,runnerIdx]);
        }
      }
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  RESULTS SCREEN
  // ═══════════════════════════════════════════════════════════
  showResults(mode, rewards, order) {
    this.stopLoop();
    // Track minigame win for the 1st place player
    if (typeof players !== "undefined" && order && order.length > 0) {
      const winnerIdx = order[0];
      if (players[winnerIdx] && players[winnerIdx].stats) {
        players[winnerIdx].stats.minigamesWon++;
      }
    }
    const W=window.innerWidth, H=window.innerHeight, c=this.ctx;

    const draw=()=>{
      c.clearRect(0,0,W,H);
      const bg=c.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.7);
      bg.addColorStop(0,"#180828"); bg.addColorStop(1,"#080814");
      c.fillStyle=bg; c.fillRect(0,0,W,H);
      mgShadow(c,"#ffd60a",20);
      c.font="bold 40px 'Fredoka One',cursive"; c.fillStyle="#ffd60a";
      c.textAlign="center"; c.textBaseline="middle";
      c.fillText("🏆 RESULTS",W/2,H*0.15);
      mgShadow(c,"transparent",0);

      rewards.forEach((r,i)=>{
        const yy=H*0.3+i*76;
        const medals=["🥇","🥈","🥉","🏅"];
        c.fillStyle=`rgba(255,255,255,${0.06-i*0.01})`;
        mgRoundRect(c,W/2-250,yy-28,500,56,14); c.fill();
        this.drawPlayerCircle(c,r.playerIndex,W/2-210,yy,22,this.pColor(r.playerIndex),2.5);
        c.font=`bold ${23-i}px 'Fredoka One',cursive`;
        c.fillStyle=this.pColor(r.playerIndex);
        c.textAlign="left"; c.textBaseline="middle";
        c.fillText(`${medals[i]||"•"}  ${this.pName(r.playerIndex)}`,W/2-182,yy);
        c.textAlign="right";
        c.fillStyle=r.coins>0?"#ffd60a":"rgba(255,255,255,.3)";
        c.fillText(`+${r.coins} 💰`,W/2+230,yy);
      });

      const bw=220,bh=56,bx=W/2-bw/2,by=H-90;
      const g=c.createLinearGradient(bx,by,bx+bw,by+bh);
      g.addColorStop(0,"#06d6a0"); g.addColorStop(1,"#4cc9f0");
      c.fillStyle=g; mgRoundRect(c,bx,by,bw,bh,28); c.fill();
      c.font="bold 20px 'Fredoka One',cursive"; c.fillStyle="white";
      c.textAlign="center"; c.textBaseline="middle";
      c.fillText("Back to Board 🗺",W/2,by+bh/2);
    };
    draw();
    const go=()=>{ this.overlay.removeEventListener("click",go); this.finish(rewards); };
    this.overlay.addEventListener("click",go);
  },
};

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function modeLabel(m)      {
  return {FFA:"🔫 FREE FOR ALL",FFA_DIG:"⛏️ CHEST DIGGERS",DUOS:"🤝 TILE TAKEOVER",DUOS_RACE:"🏎️ CO-OP RACE","1v3":"🔍 HIDE & SEEK","1V3_TAG":"🔨 HAMMER TAG"}[m]||m;
}
function modeShortLabel(m) {
  return {FFA:"FREE FOR ALL",FFA_DIG:"CHEST DIGGERS",DUOS:"TILE TAKEOVER",DUOS_RACE:"CO-OP RACE","1v3":"HIDE & SEEK","1V3_TAG":"HAMMER TAG"}[m]||m;
}
function modeIcon(m) {
  return {FFA:"🔫",FFA_DIG:"⛏️",DUOS:"🤝",DUOS_RACE:"🏎️","1v3":"🔍","1V3_TAG":"🔨"}[m]||"🎮";
}
function modeColor(m) {
  return {FFA:"#ff6b9d",FFA_DIG:"#c77dff",DUOS:"#4cc9f0",DUOS_RACE:"#06d6a0","1v3":"#c77dff","1V3_TAG":"#f4845f"}[m]||"#fff";
}
function modeDesc(m,lp){
  if(m==="FFA")       return "Last player standing wins!";
  if(m==="FFA_DIG")   return "Dig to the chest — first to find it wins!";
  if(m==="DUOS")      return "Paint the most tiles with your team!";
  if(m==="DUOS_RACE") return "Steer your shared kart — complete 3 laps!";
  if(m==="1v3")       return `${lp.name} is the Shooter — the other 3 must hide!`;
  if(m==="1V3_TAG")   return `${lp.name} must survive 30 seconds!`;
  return "";
}
function getRules(m,lp){
  if(m==="FFA") return {
    title:"🔫 Dodge the Bullets!",
    lines:["Bullets fly in from all sides — dodge them!",
           "Use Arrow Keys or WASD to move.",
           "Get hit = eliminated! Last one alive wins.",
           "Starts slow — ramps up over ~30 seconds."],
    rewards:["🥇 1st: +20 coins","🥈 2nd: +12 coins","🥉 3rd: +5 coins","🏅 4th: +0 coins"],
  };
  if(m==="FFA_DIG") return {
    title:"⛏️ Chest Diggers!",
    lines:["All 4 players are mole-people underground!",
           "Use WASD / Arrow Keys to dig through the dirt.",
           "Rocks block your path — dig around them.",
           "First to dig up 80% of the treasure chest wins!",
           "The chest glows brighter as you get closer."],
    rewards:["🥇 Chest finder: +25 coins","Everyone else: +4 coins"],
  };
  if(m==="DUOS") return {
    title:"🤝 Tile Takeover!",
    lines:[`Team A (Pink): ${players[0].name} & ${players[1].name}`,
           `Team B (Teal): ${players[2].name} & ${players[3].name}`,
           "Click tiles to paint them your team's colour.",
           "Most tiles painted after 30 seconds wins!"],
    rewards:["Winning team: +16 coins each","Losing team: +4 coins each"],
  };
  if(m==="DUOS_RACE") return {
    title:"🏎️ Co-op Kart Race!",
    lines:[`${players[0].name} (A/D) + ${players[1].name} (J/L) share one car!`,
           "Both pressing the same direction = turn that way.",
           "One left + one right = cancel out, go straight!",
           "First team to complete 3 laps wins!"],
    rewards:["Winning team: +16 coins each","Losing team: +4 coins each"],
  };
  if(m==="1v3") return {
    title:"🔍 Hide & Seek!",
    lines:[`${lp.name} is the Shooter. The other 3 are Hiders.`,
           "Hiders: secretly click one of 6 hiding spots.",
           "Two hiders CAN share the same spot!",
           "Shooter: 4 shots to find them all.",
           "Each shot destroys that spot forever.",
           "If any hider survives — Hiders win!"],
    rewards:["Hiders win: each survivor +15 coins","Shooter wins all: +20 coins"],
  };
  if(m==="1V3_TAG") return {
    title:"🔨 Hammer Tag!",
    lines:[`${lp.name} is the Runner — must survive 30 seconds!`,
           "Hunters: click anywhere to swing your hammer.",
           "A warning circle shows BEFORE the hammer lands — dodge it!",
           "Runner: use WASD to move. SPACE to dash (3s cooldown).",
           "The runner is faster — but one hit and it's over!"],
    rewards:["Runner survives: +22 coins","Hunters catch runner: +14 coins each"],
  };
  return {title:m,lines:[],rewards:[]};
}
function mgShadow(c,col,blur){ c.shadowColor=col; c.shadowBlur=blur; }
function mgRoundRect(c,x,y,w,h,r){
  c.beginPath(); c.moveTo(x+r,y);
  c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
}
function roundRect(ctx,x,y,w,h,r){ mgRoundRect(ctx,x,y,w,h,r); }
