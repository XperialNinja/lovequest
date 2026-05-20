// ============================================================
//  LOVEQUEST — menu.js
//  Main menu: player setup, multiplayer lobby, board cinematic,
//  then hands off to initGame() + doRollOff()
// ============================================================

(function () {

  // ── CSS ──────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    /* ── MENU OVERLAY ───────────────────────────────────────── */
    #menuOverlay {
      position:fixed;inset:0;z-index:900;
      background:#07030f;
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      font-family:'Fredoka One',cursive;color:white;
      overflow:hidden;
    }

    /* Floating hearts BG */
    #menuOverlay .menu-heart {
      position:absolute;pointer-events:none;
      font-size:18px;opacity:0;
      animation:menuHeartRise linear infinite;
    }
    @keyframes menuHeartRise {
      0%   { transform:translateY(0) scale(1);   opacity:.55; }
      80%  { opacity:.3; }
      100% { transform:translateY(-110vh) scale(1.3); opacity:0; }
    }

    /* Honeycomb canvas */
    #menuHoneycomb {
      position:absolute;inset:0;opacity:.05;pointer-events:none;
    }

    /* Radial glow */
    #menuGlow {
      position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at 50% 60%,
        rgba(255,214,10,.08) 0%, rgba(160,0,255,.06) 45%, transparent 70%);
      animation:menuGlowPulse 4s ease-in-out infinite;
    }
    @keyframes menuGlowPulse {
      0%,100%{opacity:.7} 50%{opacity:1}
    }

    /* Logo */
    #menuLogo {
      position:relative;z-index:2;
      text-align:center;margin-bottom:8px;
      animation:menuLogoIn .9s cubic-bezier(.22,1,.36,1) both;
    }
    @keyframes menuLogoIn {
      from{opacity:0;transform:translateY(-40px) scale(.92)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }
    #menuLogo .logo-title {
      font-size:clamp(42px,7vw,88px);
      background:linear-gradient(135deg,#ff6b9d,#c77dff,#ffd60a);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;
      filter:drop-shadow(0 0 32px rgba(199,119,255,.5));
      line-height:1;letter-spacing:2px;
    }
    #menuLogo .logo-sub {
      font-size:clamp(13px,1.8vw,18px);
      opacity:.5;letter-spacing:4px;text-transform:uppercase;
      margin-top:6px;color:#ffd60a;
    }
    #menuLogo .logo-hearts {
      font-size:clamp(28px,4vw,48px);margin:6px 0;
      animation:menuHeartBeat 1.4s ease-in-out infinite;
    }
    @keyframes menuHeartBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}

    /* Panel */
    #menuPanel {
      position:relative;z-index:2;
      background:rgba(15,8,28,0.88);
      border:1px solid rgba(199,119,255,.2);
      border-radius:24px;padding:28px 36px;
      width:min(480px,90vw);
      box-shadow:0 0 60px rgba(199,119,255,.12),0 20px 60px rgba(0,0,0,.6);
      animation:menuPanelIn .7s cubic-bezier(.22,1,.36,1) .25s both;
    }
    @keyframes menuPanelIn{
      from{opacity:0;transform:translateY(30px)}
      to{opacity:1;transform:translateY(0)}
    }

    /* Section headings */
    .menu-section-title {
      font-size:12px;letter-spacing:3px;text-transform:uppercase;
      opacity:.4;margin-bottom:10px;margin-top:18px;
    }
    .menu-section-title:first-child{margin-top:0}

    /* Player row */
    .menu-player-row {
      display:flex;align-items:center;gap:10px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      border-radius:14px;padding:10px 14px;margin-bottom:8px;
    }
    .menu-player-dot {
      width:14px;height:14px;border-radius:50%;flex-shrink:0;
    }
    .menu-player-name {
      flex:1;font-size:15px;opacity:.9;
    }
    .menu-player-badge {
      font-size:11px;padding:3px 10px;border-radius:20px;
      font-family:'Nunito',sans-serif;letter-spacing:.5px;
    }
    .menu-badge-local { background:rgba(159,21,192,.25);color:#c77dff; }
    .menu-badge-waiting { background:rgba(255,255,255,.07);color:rgba(255,255,255,.4);
      animation:menuBlink 1.2s ease-in-out infinite; }
    .menu-badge-connected { background:rgba(6,214,96,.18);color:#06d664; }
    @keyframes menuBlink{0%,100%{opacity:1}50%{opacity:.4}}

    /* MP code input row */
    #menuMpRow {
      display:flex;gap:8px;margin-top:6px;
    }
    #menuMpCode {
      flex:1;background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.15);border-radius:10px;
      padding:9px 14px;color:white;font-family:'Fredoka One',cursive;font-size:15px;
      outline:none;
    }
    #menuMpCode:focus{border-color:#c77dff;}
    #menuMpCode::placeholder{opacity:.3}

    /* Buttons */
    .menu-btn {
      padding:9px 18px;border:none;border-radius:10px;
      font-family:'Fredoka One',cursive;font-size:14px;cursor:pointer;
      transition:filter .15s,transform .1s;
    }
    .menu-btn:hover{filter:brightness(1.15);transform:scale(1.04);}
    .menu-btn:active{transform:scale(.97);}
    .menu-btn-host { background:linear-gradient(135deg,#9e15c0,#c77dff);color:white; }
    .menu-btn-join { background:linear-gradient(135deg,#1a6a8a,#4cc9f0);color:white; }
    .menu-btn-solo { background:rgba(255,255,255,.08);color:rgba(255,255,255,.6);
      border:1px solid rgba(255,255,255,.12); }

    #menuMpStatus {
      font-size:12px;opacity:.5;margin-top:8px;text-align:center;
      font-family:'Nunito',sans-serif;min-height:16px;
    }

    /* Start button */
    #menuStartBtn {
      width:100%;margin-top:22px;
      padding:16px;font-size:20px;border:none;border-radius:16px;cursor:pointer;
      font-family:'Fredoka One',cursive;color:white;
      background:linear-gradient(135deg,#ff6b9d,#c77dff,#ffd60a);
      background-size:200% 200%;
      animation:menuBtnGlow 2.5s ease-in-out infinite,menuBtnGrad 4s ease-in-out infinite;
      box-shadow:0 4px 32px rgba(199,119,255,.35);
      transition:transform .15s,box-shadow .15s;
    }
    #menuStartBtn:hover{transform:scale(1.03);box-shadow:0 8px 48px rgba(199,119,255,.5);}
    #menuStartBtn:active{transform:scale(.98);}
    @keyframes menuBtnGlow{0%,100%{box-shadow:0 4px 32px rgba(199,119,255,.35)}
      50%{box-shadow:0 4px 48px rgba(255,107,157,.5)}}
    @keyframes menuBtnGrad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}

    /* ── CINEMATIC OVERLAY ───────────────────────────────────── */
    #cinematicOv {
      position:fixed;inset:0;z-index:850;pointer-events:none;
      opacity:0;transition:opacity .6s;
    }
    #cinematicTitle {
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%) scale(.8);
      text-align:center;opacity:0;
      transition:opacity .8s,transform .8s cubic-bezier(.22,1,.36,1);
      pointer-events:none;
    }
    #cinematicTitle .ct-main {
      font-size:clamp(52px,8vw,100px);
      background:linear-gradient(135deg,#ff6b9d,#c77dff,#ffd60a);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;
      filter:drop-shadow(0 0 40px rgba(199,119,255,.7));
      line-height:1;
    }
    #cinematicTitle .ct-sub {
      font-size:clamp(14px,2vw,22px);
      color:rgba(255,255,255,.6);letter-spacing:5px;
      text-transform:uppercase;margin-top:10px;
    }
    #cinematicVignette {
      position:absolute;inset:0;
      background:radial-gradient(ellipse at 50% 50%,
        transparent 30%, rgba(0,0,0,.7) 100%);
    }
  `;
  document.head.appendChild(style);

  // ── DOM BUILD ────────────────────────────────────────────────
  function buildMenu() {
    const p1 = CONFIG.couple.player1;
    const p2 = CONFIG.couple.player2;

    const ov = document.createElement("div");
    ov.id = "menuOverlay";

    // BG layers
    const honeycombCanvas = document.createElement("canvas");
    honeycombCanvas.id = "menuHoneycomb";
    ov.appendChild(honeycombCanvas);

    const glow = document.createElement("div");
    glow.id = "menuGlow";
    ov.appendChild(glow);

    // Floating hearts
    const heartEmojis = ["💖","💕","💜","💙","✨","🌟","💛","💗"];
    for (let i = 0; i < 18; i++) {
      const h = document.createElement("div");
      h.className = "menu-heart";
      h.textContent = heartEmojis[i % heartEmojis.length];
      h.style.left = `${Math.random()*100}%`;
      h.style.bottom = `${-10 - Math.random()*20}%`;
      h.style.animationDuration = `${6 + Math.random()*8}s`;
      h.style.animationDelay = `${-Math.random()*10}s`;
      h.style.fontSize = `${14 + Math.random()*18}px`;
      ov.appendChild(h);
    }

    // Logo
    const logo = document.createElement("div");
    logo.id = "menuLogo";
    logo.innerHTML = `
      <div class="logo-hearts">💖</div>
      <div class="logo-title">LoveQuest</div>
      <div class="logo-sub">Alpha v4 &nbsp;•&nbsp; A Game For Two</div>`;
    ov.appendChild(logo);

    // Panel
    const panel = document.createElement("div");
    panel.id = "menuPanel";
    panel.innerHTML = `
      <div class="menu-section-title">Players</div>

      <div class="menu-player-row">
        <div class="menu-player-dot" style="background:${p1.color}"></div>
        <div class="menu-player-name">${p1.name}</div>
        <div class="menu-player-badge menu-badge-local">You · Local</div>
      </div>

      <div class="menu-player-row">
        <div class="menu-player-dot" style="background:${p2.color}"></div>
        <div class="menu-player-name">${p2.name}</div>
        <div id="p2Badge" class="menu-player-badge menu-badge-waiting">Waiting…</div>
      </div>

      <div class="menu-section-title" style="margin-top:20px;">Play Together Online</div>
      <div id="menuMpRow">
        <input id="menuMpCode" type="text" placeholder="Room code (e.g. love42)" maxlength="20" />
        <button class="menu-btn menu-btn-host" id="menuHostBtn">Host 👑</button>
        <button class="menu-btn menu-btn-join" id="menuJoinBtn">Join 💕</button>
      </div>
      <div id="menuMpStatus">Enter a code — Host on one device, Join on the other</div>

      <button id="menuStartBtn">💖 Start Game!</button>
      <div style="text-align:center;margin-top:10px;">
        <span id="menuSoloNote" style="font-size:11px;opacity:.3;font-family:'Nunito',sans-serif;cursor:pointer;"
          onclick="document.getElementById('menuStartBtn').click()">
          Playing solo? Just click Start
        </span>
      </div>`;
    ov.appendChild(panel);
    document.body.appendChild(ov);

    // Draw honeycomb BG on menu canvas
    requestAnimationFrame(() => {
      honeycombCanvas.width  = window.innerWidth;
      honeycombCanvas.height = window.innerHeight;
      drawMenuHoneycomb(honeycombCanvas);
    });

    // ── Multiplayer wiring ──────────────────────────────────
    const mpCode   = document.getElementById("menuMpCode");
    const hostBtn  = document.getElementById("menuHostBtn");
    const joinBtn  = document.getElementById("menuJoinBtn");
    const mpStatus = document.getElementById("menuMpStatus");
    const p2Badge  = document.getElementById("p2Badge");

    function setStatus(msg, color) {
      mpStatus.textContent = msg;
      mpStatus.style.color = color || "rgba(255,255,255,.45)";
    }

    hostBtn.onclick = () => {
      const code = mpCode.value.trim();
      if (!code) { setStatus("Enter a room code first!", "#ff6b9d"); return; }
      setStatus(`Hosting room "${code}" — share this code with your partner`, "#ffd60a");
      netSetupHost(code, {
        onConnected: () => {
          p2Badge.className = "menu-player-badge menu-badge-connected";
          p2Badge.textContent = "Connected ✓";
          setStatus(`${CONFIG.couple.player2.name} is connected! Ready to start 💕`, "#06d664");
        },
        onDisconnect: () => {
          p2Badge.className = "menu-player-badge menu-badge-waiting";
          p2Badge.textContent = "Waiting…";
          setStatus("Partner disconnected. Re-enter code to reconnect.", "#ff6b9d");
        },
      });
    };

    joinBtn.onclick = () => {
      const code = mpCode.value.trim();
      if (!code) { setStatus("Enter the host's room code!", "#ff6b9d"); return; }
      setStatus(`Connecting to room "${code}"…`, "#4cc9f0");
      netSetupGuest(code, {
        onConnected: () => {
          p2Badge.className = "menu-player-badge menu-badge-connected";
          p2Badge.textContent = "Connected ✓";
          setStatus(`Connected! Waiting for host to start the game…`, "#06d664");
        },
        onDisconnect: () => {
          p2Badge.className = "menu-player-badge menu-badge-waiting";
          p2Badge.textContent = "Waiting…";
          setStatus("Connection lost. Re-enter code to reconnect.", "#ff6b9d");
        },
        onGameStart: () => {
          startCinematic();
        },
      });
    };

    // Enter key submits join
    mpCode.addEventListener("keydown", e => {
      if (e.key === "Enter") joinBtn.click();
    });

    // ── Start button ──────────────────────────────────────
    document.getElementById("menuStartBtn").onclick = () => {
      // Tell guest to start if multiplayer
      if (typeof netBroadcast === "function" && netConn) {
        netBroadcast({ type: "menuStart" });
      }
      startCinematic();
    };
  }

  // ── HONEYCOMB DRAW ───────────────────────────────────────────
  function drawMenuHoneycomb(canvas) {
    const ctx = canvas.getContext("2d");
    const size = 40, W = canvas.width, H = canvas.height;
    const w = size * Math.sqrt(3), h = size * 2;
    ctx.strokeStyle = "#ffd60a"; ctx.lineWidth = 1;
    for (let row = -1; row < H/h + 2; row++) {
      for (let col = -1; col < W/w + 2; col++) {
        const cx = col * w + (row % 2 ? w/2 : 0);
        const cy = row * h * 0.75;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI/180 * (60*i - 30);
          const x = cx + size * Math.cos(angle);
          const y = cy + size * Math.sin(angle);
          i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
        }
        ctx.closePath(); ctx.stroke();
      }
    }
  }

  // ── CINEMATIC ────────────────────────────────────────────────
  function startCinematic() {
    // 1. Fade out menu overlay
    const menuOv = document.getElementById("menuOverlay");
    menuOv.style.transition = "opacity .6s";
    menuOv.style.opacity = "0";
    setTimeout(() => menuOv.remove(), 650);

    // 2. Boot game engine — board draws, but suppress roll-off until we're ready
    window._cinematicPlaying = true;
    initGame();

    // 3. Force camera to full-board wide shot immediately (no lerp yet)
    camera.x    = WORLD_W / 2;
    camera.y    = WORLD_H / 2;
    camera.zoom = 0.19;
    targetCam.x    = WORLD_W / 2;
    targetCam.y    = WORLD_H / 2;
    targetCam.zoom = 0.19;

    // 4. Slow down camera lerp for the cinematic
    window._cinematicLerpSpeed = 1.4; // override normal 8× speed

    // 5. Build dark cinematic overlay (board shows through underneath)
    const cOv = document.createElement("div");
    cOv.id = "cinematicOv";
    cOv.style.cssText = `
      position:fixed;inset:0;z-index:850;pointer-events:none;
      opacity:0;transition:opacity .5s;`;
    cOv.innerHTML = `
      <div id="cinematicVignette" style="
        position:absolute;inset:0;
        background:radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(0,0,0,.6) 100%);
        transition:background 1s;"></div>
      <div id="cinematicTitle" style="
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%) scale(.85);
        text-align:center;opacity:0;
        transition:opacity .9s,transform .9s cubic-bezier(.22,1,.36,1);">
        <div style="
          font-family:'Fredoka One',cursive;
          font-size:clamp(50px,7.5vw,96px);
          background:linear-gradient(135deg,#ff6b9d,#c77dff,#ffd60a);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          background-clip:text;
          filter:drop-shadow(0 0 40px rgba(199,119,255,.6));
          line-height:1;letter-spacing:2px;">LoveQuest 💖</div>
        <div style="
          font-family:'Fredoka One',cursive;
          font-size:clamp(13px,1.8vw,20px);
          color:rgba(255,255,255,.55);letter-spacing:5px;
          text-transform:uppercase;margin-top:12px;">A Game For Two</div>
      </div>`;
    document.body.appendChild(cOv);

    // Fade in overlay (subtle dark vignette — board visible underneath)
    requestAnimationFrame(() => { cOv.style.opacity = "1"; });

    // 6. Cinematic waypoints — slow sweeping tour of the board
    // Each dur is how long to STAY at that spot before moving to next
    // The slow lerpSpeed means the camera glides smoothly between them
    const waypoints = [
      { x: WORLD_W*0.18, y: WORLD_H*0.82, zoom: 0.26, dur: 2000 }, // bottom-left corner
      { x: WORLD_W*0.82, y: WORLD_H*0.80, zoom: 0.28, dur: 2200 }, // bottom-right corner
      { x: WORLD_W*0.78, y: WORLD_H*0.22, zoom: 0.26, dur: 2000 }, // top-right corner
      { x: WORLD_W*0.22, y: WORLD_H*0.20, zoom: 0.28, dur: 2000 }, // top-left corner
      { x: WORLD_W*0.50, y: WORLD_H*0.50, zoom: 0.22, dur: 1800 }, // pull back to full board
    ];

    let wpIdx = 0;
    function flyToNext() {
      if (wpIdx >= waypoints.length) {
        showCinematicTitle(cOv);
        return;
      }
      const wp = waypoints[wpIdx++];
      targetCam.x    = wp.x;
      targetCam.y    = wp.y;
      targetCam.zoom = wp.zoom;
      setTimeout(flyToNext, wp.dur);
    }
    // Small delay so board has time to render before we start moving
    setTimeout(flyToNext, 600);
  }

  function showCinematicTitle(cOv) {
    // Pull back to full board view, normal lerp speed
    targetCam.x    = WORLD_W / 2;
    targetCam.y    = WORLD_H / 2;
    targetCam.zoom = 0.30;
    window._cinematicLerpSpeed = 2.5; // slightly faster pull-back

    // Darken vignette so title pops
    const vignette = document.getElementById("cinematicVignette");
    vignette.style.background =
      "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,.3) 0%, rgba(0,0,0,.85) 100%)";

    // Show title after pull-back settles
    setTimeout(() => {
      const title = document.getElementById("cinematicTitle");
      title.style.opacity = "1";
      title.style.transform = "translate(-50%,-50%) scale(1)";
    }, 700);

    // Hold title for 2.5s then fade out and start game
    setTimeout(() => {
      cOv.style.transition = "opacity .9s";
      cOv.style.opacity = "0";
      setTimeout(() => {
        cOv.remove();
        // Restore normal camera lerp speed
        window._cinematicLerpSpeed = null;
        // Camera snaps toward start area
        targetCam.x    = WORLD_W * 0.12;
        targetCam.y    = WORLD_H * 0.88;
        targetCam.zoom = 0.55;
        // NOW start the roll-off — cinematic is fully done
        window._cinematicPlaying = false;
        doRollOff();
      }, 900);
    }, 3200);
  }

  // ── WAIT FOR DOM + START ─────────────────────────────────────
  function init() {
    buildMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Scripts load after DOMContentLoaded when placed at end of body
    init();
  }

})();