// ============================================================
//  LOVEQUEST  –  game.js   (Alpha v3)
//  Fixes: overlapping nodes, missing icons, arrow-based fork UI,
//         organic map using the centre space
// ============================================================

const WORLD_W = 3200;
const WORLD_H = 2200;
const SPACE_R = 30;   // circle radius
const GAP     = 120;  // minimum gap between node centres (must be > 2*SPACE_R + padding)

// ─────────────────────────────────────────────────────────────
//  BOARD NODES
//  Rules enforced:
//    • No two nodes share the same (x,y)
//    • All nodes on the same straight segment are GAP apart
//    • Shortcuts use the centre area organically
//    • Every path loops back to node 0 (START, bottom-left)
//
//  Layout overview:
//    Outer loop: bottom (L→R), right col (B→T), top (R→L), left col (T→B)
//    Shortcut A: from bottom-right, cuts diagonally through centre → top-right  [DANGER]
//    Shortcut B: from right-mid, sweeps wide into centre → top-right area       [REWARD]
//    Shortcut C: from top-mid, dips into centre valley → left-col-top           [PUNISH]
//    Shortcut D: from left-col-top, snakes through centre-left → left-col-mid   [CHAOS]
// ─────────────────────────────────────────────────────────────

const BOARD_NODES = [

  // ══════════════════════════════════════════════════════════
  //  OUTER LOOP
  // ══════════════════════════════════════════════════════════

  // ── Bottom row  y=2020, x: 200 → 2800  (step 120) ────────
  { id:  0, x:  200, y:2020, type:"start", next:[1]        },
  { id:  1, x:  320, y:2020, type:"blue",  next:[2]        },
  { id:  2, x:  440, y:2020, type:"red",   next:[3]        },
  { id:  3, x:  560, y:2020, type:"blue",  next:[4]        },
  { id:  4, x:  680, y:2020, type:"event", next:[5]        },
  { id:  5, x:  800, y:2020, type:"blue",  next:[6]        },
  { id:  6, x:  920, y:2020, type:"red",   next:[7]        },
  { id:  7, x: 1040, y:2020, type:"blue",  next:[8]        },
  { id:  8, x: 1160, y:2020, type:"duel",  next:[9]        },
  { id:  9, x: 1280, y:2020, type:"blue",  next:[10]       },
  { id: 10, x: 1400, y:2020, type:"red",   next:[11]       },
  { id: 11, x: 1520, y:2020, type:"blue",  next:[12]       },
  { id: 12, x: 1640, y:2020, type:"event", next:[13]       },
  { id: 13, x: 1760, y:2020, type:"blue",  next:[14]       },
  { id: 14, x: 1880, y:2020, type:"minigame", next:[15]       },
  { id: 15, x: 2000, y:2020, type:"blue",  next:[16]       },
  { id: 16, x: 2120, y:2020, type:"red",   next:[17]       },
  { id: 17, x: 2240, y:2020, type:"blue",  next:[18]       },
  // FORK A  ↑ continue right OR ↘ danger shortcut
  { id: 18, x: 2360, y:2020, type:"event", next:[19, 40]   },

  // ── Right column  x=2520, y: 2020 → 180  (step -120) ─────
  { id: 19, x: 2520, y:2020, type:"blue",  next:[20]       },
  { id: 20, x: 2520, y:1900, type:"red",   next:[21]       },
  { id: 21, x: 2520, y:1780, type:"blue",  next:[22]       },
  { id: 22, x: 2520, y:1660, type:"event", next:[23]       },
  { id: 23, x: 2520, y:1540, type:"red",   next:[24]       },
  { id: 24, x: 2520, y:1420, type:"blue",  next:[25]       },
  { id: 25, x: 2520, y:1300, type:"minigame", next:[26]       },
  // FORK B  ↑ continue up OR ← reward sweep
  { id: 26, x: 2520, y:1180, type:"blue",  next:[27, 50]   },
  { id: 27, x: 2520, y:1060, type:"red",   next:[28]       },
  { id: 28, x: 2520, y: 940, type:"event", next:[29]       },
  { id: 29, x: 2520, y: 820, type:"blue",  next:[30]       },
  { id: 30, x: 2520, y: 700, type:"duel",  next:[31]       },
  { id: 31, x: 2520, y: 580, type:"red",   next:[32]       },
  { id: 32, x: 2520, y: 460, type:"blue",  next:[33]       },
  { id: 33, x: 2520, y: 340, type:"event", next:[34]       },

  // ── Top row  y=180, x: 2520 → 200  (step -120) ───────────
  { id: 34, x: 2520, y: 180, type:"minigame", next:[35]       },
  { id: 35, x: 2400, y: 180, type:"blue",  next:[36]       },
  { id: 36, x: 2280, y: 180, type:"red",   next:[37]       },
  { id: 37, x: 2160, y: 180, type:"blue",  next:[38]       },
  { id: 38, x: 2040, y: 180, type:"event", next:[39]       },
  { id: 39, x: 1920, y: 180, type:"blue",  next:[60]       },
  // FORK C  ↑ continue left OR ↓ punishing dip
  { id: 60, x: 1800, y: 180, type:"duel",  next:[61, 65]   },
  { id: 61, x: 1680, y: 180, type:"blue",  next:[62]       },
  { id: 62, x: 1560, y: 180, type:"red",   next:[63]       },
  { id: 63, x: 1440, y: 180, type:"blue",  next:[64]       },
  { id: 64, x: 1320, y: 180, type:"minigame", next:[70]       },
  { id: 70, x: 1200, y: 180, type:"blue",  next:[71]       },
  { id: 71, x: 1080, y: 180, type:"red",   next:[72]       },
  { id: 72, x:  960, y: 180, type:"event", next:[73]       },
  { id: 73, x:  840, y: 180, type:"blue",  next:[74]       },
  { id: 74, x:  720, y: 180, type:"red",   next:[75]       },
  { id: 75, x:  600, y: 180, type:"blue",  next:[76]       },
  { id: 76, x:  480, y: 180, type:"minigame", next:[77]       },
  { id: 77, x:  360, y: 180, type:"blue",  next:[90]       },

  // ── Left column  x=200, y: 180 → 2020  (step +120) ───────
  { id: 90, x:  200, y: 180, type:"red",   next:[91]       },
  // FORK D  ↓ continue down OR → chaos centre
  { id: 91, x:  200, y: 300, type:"blue",  next:[92, 80]   },
  { id: 92, x:  200, y: 420, type:"event", next:[93]       },
  { id: 93, x:  200, y: 540, type:"event",  next:[94]       },
  { id: 94, x:  200, y: 660, type:"red",   next:[95]       },
  { id: 95, x:  200, y: 780, type:"blue",  next:[96]       },
  { id: 96, x:  200, y: 900, type:"minigame", next:[97]       },
  { id: 97, x:  200, y:1020, type:"blue",  next:[98]       },
  { id: 98, x:  200, y:1140, type:"red",   next:[99]       },
  { id: 99, x:  200, y:1260, type:"event", next:[100]      },
  { id:100, x:  200, y:1380, type:"blue",  next:[101]      },
  { id:101, x:  200, y:1500, type:"red",   next:[102]      },
  { id:102, x:  200, y:1620, type:"blue",  next:[103]      },
  { id:103, x:  200, y:1740, type:"event", next:[104]      },
  { id:104, x:  200, y:1860, type:"blue",  next:[0]        },  // → back to START

  // ══════════════════════════════════════════════════════════
  //  SHORTCUT A  –  DANGER   (bottom-right → top-right)
  //  Entry: 18 → 40.  Rejoins at 34 (top-right corner)
  //  Route: angled through lower-right interior
  // ══════════════════════════════════════════════════════════
  { id: 40, x:2360, y:1880, type:"red",      next:[41]       },
  { id: 41, x:2280, y:1740, type:"duel",     next:[42]       },
  { id: 42, x:2200, y:1600, type:"shop",     next:[43]       },  // Board Shop on danger path!
  { id: 43, x:2200, y:1460, type:"duel",     next:[44]       },
  { id: 44, x:2280, y:1320, type:"red",      next:[45]       },
  { id: 45, x:2360, y:1180, type:"event",    next:[46]       },
  { id: 46, x:2360, y:1040, type:"event",    next:[47]       },  // was duelshop, moved to punish path
  { id: 47, x:2360, y: 900, type:"duel",     next:[48]       },
  { id: 48, x:2360, y: 760, type:"red",      next:[49]       },
  { id: 49, x:2400, y: 580, type:"duel",     next:[34]       },  // → top-right corner

  // ══════════════════════════════════════════════════════════
  //  SHORTCUT B  –  REWARD   (right-mid → upper-right)
  //  Entry: 26 → 50.  Rejoins at 32 (right col, upper area)
  //  Route: sweeps left into mid-right interior, heart/event heavy
  // ══════════════════════════════════════════════════════════
  { id: 50, x:2640, y:1180, type:"minigame", next:[51]       },
  { id: 51, x:2640, y:1020, type:"minigame",   next:[52]       },
  { id: 52, x:2640, y: 860, type:"event", next:[53]       },
  { id: 53, x:2480, y: 760, type:"minigame", next:[54]       },
  { id: 54, x:2320, y: 680, type:"blue",  next:[55]       },
  { id: 55, x:2160, y: 600, type:"event", next:[56]       },
  { id: 56, x:2200, y: 460, type:"minigame", next:[57]       },
  { id: 57, x:2360, y: 340, type:"blue",  next:[32]       },  // → right col upper (32 is at 2520,460)

  // ══════════════════════════════════════════════════════════
  //  SHORTCUT C  –  PUNISH   (top-mid → left-col-top)
  //  Entry: 60 → 65.  Rejoins at 90 (left col top)
  //  Route: dips down into the upper-centre area
  // ══════════════════════════════════════════════════════════
  { id: 65, x:1800, y: 320, type:"red",   next:[66]       },
  { id: 66, x:1680, y: 460, type:"duel",  next:[67]       },
  { id: 67, x:1560, y: 580, type:"red",   next:[68]       },
  { id: 68, x:1440, y: 680, type:"duel",  next:[69]       },
  { id: 69, x:1320, y: 560, type:"red",      next:[110]      },
  { id:110, x:1200, y: 440, type:"duelshop", next:[111]      },  // Duel Shop on punish path!
  { id:111, x:1080, y: 340, type:"red",      next:[90]       },  // → left col top

  // ══════════════════════════════════════════════════════════
  //  SHORTCUT D  –  CHAOS   (left-col-top → left-col-mid)
  //  Entry: 91 → 80.  Rejoins at 96 (left col, y=900)
  //  Route: snakes right through the left-centre, then back
  // ══════════════════════════════════════════════════════════
  { id: 80, x:  360, y: 300, type:"duel",  next:[81]      },
  { id: 81, x:  500, y: 400, type:"event", next:[82]      },
  { id: 82, x:  660, y: 500, type:"red",   next:[83]      },
  { id: 83, x:  820, y: 600, type:"duel",  next:[84]      },
  { id: 84, x:  980, y: 700, type:"event", next:[85]      },
  { id: 85, x: 1140, y: 800, type:"minigame", next:[86]      },
  { id: 86, x:  980, y: 900, type:"red",   next:[87]      },
  { id: 87, x:  820, y:1000, type:"duel",  next:[88]      },
  { id: 88, x:  660, y:1000, type:"event", next:[89]      },
  { id: 89, x:  500, y: 900, type:"blue",  next:[96]      },  // → left col y=900

];

// ─────────────────────────────────────────────────────────────
//  BUILD NODE MAP
// ─────────────────────────────────────────────────────────────
const NODE_MAP = {};
BOARD_NODES.forEach(n => { NODE_MAP[n.id] = n; });

// ─────────────────────────────────────────────────────────────
//  STAR SYSTEM
// ─────────────────────────────────────────────────────────────
const STAR_CANDIDATES = [
  2,5,7,10,12,14,17,21,23,25,28,30,32,
  36,38,61,63,70,73,75,93,95,97,100,102,
  41,45,52,54,56,67,82,84,85,88
];
let starNodeId = STAR_CANDIDATES[Math.floor(Math.random() * STAR_CANDIDATES.length)];
let starAnim   = null; // { fromX,fromY,toX,toY,t,duration }

// ─────────────────────────────────────────────────────────────
//  GAME STATE
// ─────────────────────────────────────────────────────────────
let players            = [];
let currentPlayerIndex = 0;
let turnPhase          = "idle"; // idle|rolling|moving|fork|starOffer|landing
let round              = 1;
let pendingFork        = null;   // { player, stepsRemaining, choices:[id,id], atNodeId }
let pendingStarOffer   = null;   // { player, stepsRemaining }

// Fork arrow overlay drawn on canvas
let forkArrows         = null;   // { choices:[{nodeId,x,y,label}] }

// ─────────────────────────────────────────────────────────────
//  CAMERA
// ─────────────────────────────────────────────────────────────
let camera    = { x: WORLD_W/2, y: WORLD_H/2, zoom: 0.30 };
let targetCam = { x: WORLD_W/2, y: WORLD_H/2, zoom: 0.30 };

// ─────────────────────────────────────────────────────────────
//  CANVAS / INIT
// ─────────────────────────────────────────────────────────────
let canvas, ctx;

function initGame() {
  canvas = document.getElementById("gameCanvas");
  ctx    = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("click", onCanvasClick);

  players = [
    makePlayer(0, CONFIG.couple.player1, 0),
    makePlayer(1, CONFIG.couple.player2, 0),
    makePlayer(2, CONFIG.couple.ai1,    0),
    makePlayer(3, CONFIG.couple.ai2,    0),
  ];
  players[0].offset = { x:-22, y:-22 };
  players[1].offset = { x: 22, y:-22 };
  players[2].offset = { x:-22, y: 22 };
  players[3].offset = { x: 22, y: 22 };

  updateHUD();
  focusOnCurrentPlayer(true);
  requestAnimationFrame(gameLoop);
  initGameExtras();

  // ── Initial roll-off to decide turn order ────────────────
  setTimeout(() => doRollOff(), 800);
}

// Roll-off: all 4 players roll, highest goes first
function doRollOff() {
  showToast("🎲 Everyone rolls to decide turn order!", 2500);

  const overlay = document.createElement("div");
  overlay.id = "rollOffOverlay";
  overlay.style.cssText = `position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.82);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Fredoka One',cursive;color:white;gap:18px;`;

  overlay.innerHTML = `
    <div style="font-size:30px;margin-bottom:8px">🎲 Roll-Off — Who Goes First?</div>
    <div id="rollOffRows" style="display:flex;flex-direction:column;gap:12px;width:340px;"></div>
    <button id="rollOffBtn" style="margin-top:18px;padding:14px 44px;font-size:20px;
      font-family:'Fredoka One',cursive;background:linear-gradient(135deg,#ff6b9d,#c77dff);
      border:none;border-radius:30px;color:white;cursor:pointer;">Roll! 🎲</button>`;
  document.body.appendChild(overlay);

  const rows = document.getElementById("rollOffRows");
  players.forEach(p => {
    const row = document.createElement("div");
    row.id = `ror-${p.index}`;
    row.style.cssText = `display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.07);
      border-radius:14px;padding:10px 18px;`;
    row.innerHTML = `<div style="width:12px;height:12px;border-radius:50%;background:${p.color}"></div>
      <span style="flex:1;font-size:17px">${p.name}</span>
      <span id="ror-val-${p.index}" style="font-size:24px;opacity:.4">?</span>`;
    rows.appendChild(row);
  });

  document.getElementById("rollOffBtn").onclick = () => {
    document.getElementById("rollOffBtn").disabled = true;
    const rolls = players.map(p => ({
      p,
      roll: Math.floor(Math.random() * CONFIG.game.diceMax) + CONFIG.game.diceMin
    }));

    // Animate numbers
    let t = 0;
    const iv = setInterval(() => {
      players.forEach(p => {
        document.getElementById(`ror-val-${p.index}`).textContent =
          Math.floor(Math.random()*6)+1;
      });
      t++;
      if (t > 18) {
        clearInterval(iv);
        // Handle ties — re-roll tied players
        let maxRoll = Math.max(...rolls.map(r => r.roll));
        let winners = rolls.filter(r => r.roll === maxRoll);
        while (winners.length > 1) {
          winners.forEach(r => r.roll = Math.floor(Math.random()*CONFIG.game.diceMax)+CONFIG.game.diceMin);
          maxRoll = Math.max(...winners.map(r => r.roll));
          winners = winners.filter(r => r.roll === maxRoll);
        }
        // Show final rolls
        rolls.forEach(r => {
          const el = document.getElementById(`ror-val-${r.p.index}`);
          el.textContent = r.roll;
          el.style.opacity = 1;
          el.style.color = r.p.index === winners[0].p.index ? "#ffd60a" : "white";
        });
        // Sort players by roll descending
        const order = [...rolls].sort((a,b) => b.roll - a.roll).map(r => r.p.index);
        setTimeout(() => {
          overlay.remove();
          // Reorder: currentPlayerIndex starts at winner
          currentPlayerIndex = order[0];
          updateHUD();
          focusOnCurrentPlayer();
          const cur = players[currentPlayerIndex];
          if (currentPlayerIndex >= 2) {
            showToast(`🤖 ${cur.name} goes first!`, 1500);
            setTimeout(() => aiTakeTurn(cur), 1800);
          } else {
            showToast(`🎲 ${cur.name} goes first! Your turn.`, 2500);
            netSendTurn();
          }
        }, 1800);
      }
    }, 80);
  };
}

// ─────────────────────────────────────────────────────────────
//  MUSIC + TEST KEYS  (called after initGame sets up the game)
// ─────────────────────────────────────────────────────────────
function initGameExtras() {
  if (typeof MUSIC !== "undefined") MUSIC.playBoard();

  // ── Test keys: Q=random minigame, 1-6=specific game, E=duel ─
  window.addEventListener("keydown", e => {
    if (e.key === "q" || e.key === "Q") {
      if (document.getElementById("mgOverlay")) return;
      triggerMinigame(players[currentPlayerIndex], endTurn);
    }
    const modeMap={"1":"FFA","2":"FFA_DIG","3":"DUOS","4":"DUOS_RACE","5":"1v3","6":"1V3_TAG"};
    if (modeMap[e.key]) {
      if (document.getElementById("mgOverlay")) return;
      MG.forcedMode = modeMap[e.key];
      triggerMinigame(players[currentPlayerIndex], endTurn);
    }
    if (e.key === "e" || e.key === "E") {
      if (document.getElementById("duelOverlay")) return;
      triggerDuel(players[0], players, endTurn);
    }
  });
}

function makePlayer(idx, cfg, startNode) {
  const n = NODE_MAP[startNode];
  return {
    index: idx, name: cfg.name, color: cfg.color, emoji: cfg.emoji,
    image: loadImage(cfg.imagePath),
    nodeId: startNode, x: n.x, y: n.y,
    coins: CONFIG.game.startingCoins, stars: 0,
    movePath: [], moveIndex: 0, isMoving: false,
    offset: { x:0, y:0 },
    bounceT: Math.random() * Math.PI * 2,
    _afterMove: null,
    inventory: [],  // board items
    duelInventory: [], // duel shop items
    bonusMaxHp: 0,  // permanent HP bonus from Iron Body
    pendingBoost: 0,         // +N to next roll
    pendingDoubleDice: false, // roll 2 dice next turn
    pendingTeleport: false,   // teleport mode active
  };
}

function loadImage(src) {
  const img = new Image();
  img.onerror = () => { img._failed = true; };
  img.src = src;
  return img;
}

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ─────────────────────────────────────────────────────────────
//  GAME LOOP
// ─────────────────────────────────────────────────────────────
let lastTime = 0;
let frameTime = 0;        // updated once per frame — used in draw instead of Date.now()
let boardDirty = true;    // flag: redraw offscreen board cache
let boardCanvas = null;   // offscreen canvas for static board layer
let boardCtx    = null;

function gameLoop(ts = 0) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  frameTime = ts;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  camera.x    += (targetCam.x    - camera.x)    * 8  * dt;
  camera.y    += (targetCam.y    - camera.y)    * 8  * dt;
  camera.zoom += (targetCam.zoom - camera.zoom) * 5  * dt;

  players.forEach(p => { p.bounceT += dt * 3; });

  if (starAnim) {
    starAnim.t += dt / starAnim.duration;
    if (starAnim.t >= 1) starAnim = null;
  }

  const mover = players.find(p => p.isMoving);
  if (mover) tickMove(mover, dt);
}

// ─────────────────────────────────────────────────────────────
//  MOVEMENT
// ─────────────────────────────────────────────────────────────
const MOVE_SPEED = 5;

function tickMove(p, dt) {
  if (p.moveIndex >= p.movePath.length) {
    p.isMoving = false;
    if (p._afterMove) {
      const cb = p._afterMove;
      p._afterMove = null;
      cb();
    } else if (turnPhase === "moving") {
      turnPhase = "landing";
      handleLanding(p);
    }
    return;
  }
  const tgt  = NODE_MAP[p.movePath[p.moveIndex]];
  const dx   = tgt.x - p.x, dy = tgt.y - p.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const step = MOVE_SPEED * 120 * dt;
  if (dist <= step) {
    p.x = tgt.x; p.y = tgt.y;
    p.nodeId = p.movePath[p.moveIndex];
    p.moveIndex++;
    p.bounceT = Math.PI / 2;
    focusOnCurrentPlayer();
  } else {
    p.x += (dx/dist)*step;
    p.y += (dy/dist)*step;
  }
}

// buildAndMove: walk steps from player's current position,
// pausing at forks and star pass-overs
function buildAndMove(player, steps) {
  const segment = [];
  let current = player.nodeId;

  for (let i = 0; i < steps; i++) {
    const node  = NODE_MAP[current];
    const nexts = node.next;

    // ── FORK ────────────────────────────────────────────────
    if (nexts.length > 1) {
      player.movePath  = segment;
      player.moveIndex = 0;
      player.isMoving  = (segment.length > 0);
      turnPhase        = "moving";
      const remaining  = steps - i;
      player._afterMove = () => showForkArrows(player, nexts, remaining);
      if (segment.length === 0) {
        // Already at fork, show immediately
        const cb = player._afterMove;
        player._afterMove = null;
        cb();
      } else {
        focusOnCurrentPlayer();
      }
      return;
    }

    const nextId = nexts[0];

    // ── STAR PASS-OVER (not the final space) ────────────────
    if (nextId === starNodeId && i < steps - 1) {
      segment.push(nextId);
      player.movePath  = segment;
      player.moveIndex = 0;
      player.isMoving  = true;
      turnPhase        = "moving";
      const remaining  = steps - i - 1;
      player._afterMove = () => {
        pendingStarOffer = { player, stepsRemaining: remaining };
        showStarOfferUI();
      };
      focusOnCurrentPlayer();
      return;
    }

    // ── SHOP PASS-OVER (board shop or duel shop, not the final space) ─
    const nextNode = NODE_MAP[nextId];
    if (nextNode && (nextNode.type === "shop" || nextNode.type === "duelshop") && i < steps - 1) {
      segment.push(nextId);
      player.movePath  = segment;
      player.moveIndex = 0;
      player.isMoving  = true;
      turnPhase        = "moving";
      const remaining  = steps - i - 1;
      const isDuel     = nextNode.type === "duelshop";
      player._afterMove = () => {
        openShopPassby(player, isDuel, () => {
          if (remaining > 0) buildAndMove(player, remaining);
          else { turnPhase = "landing"; handleLanding(player); }
        }, false);
      };
      focusOnCurrentPlayer();
      return;
    }

    segment.push(nextId);
    current = nextId;
  }

  // No interruption
  player.movePath  = segment;
  player.moveIndex = 0;
  player.isMoving  = true;
  player._afterMove = null;
  turnPhase         = "moving";
  focusOnCurrentPlayer();
}

// ─────────────────────────────────────────────────────────────
//  FORK ARROWS  (drawn directly on canvas in world space)
// ─────────────────────────────────────────────────────────────
function showForkArrows(player, choices, stepsRemaining) {
  turnPhase = "fork";
  pendingFork = { player, stepsRemaining, choices, atNodeId: player.nodeId };

  const isAI = player.index >= 2;
  if (isAI) {
    // AI picks fork automatically after a short pause
    setTimeout(() => {
      const chosenId = aiForkChoice(choices);
      forkArrows = null;
      player.nodeId = chosenId;
      player.x = NODE_MAP[chosenId].x;
      player.y = NODE_MAP[chosenId].y;
      const { stepsRemaining: rem } = pendingFork;
      pendingFork = null;
      if (rem - 1 > 0) buildAndMove(player, rem - 1);
      else { turnPhase = "landing"; handleLanding(player); }
    }, 1200);
    return; // don't draw arrows for AI
  }

  // Build arrow data for each choice
  forkArrows = choices.map(id => {
    const info = peekPath(id, 5);
    return { nodeId: id, x: NODE_MAP[id].x, y: NODE_MAP[id].y, info };
  });

  // Zoom in to the fork so arrows are clear
  const fn = NODE_MAP[player.nodeId];
  targetCam.x = fn.x; targetCam.y = fn.y; targetCam.zoom = 1.4;
  showToast("🔀 Choose your path! Click an arrow.", 99999);
}

function peekPath(startId, depth) {
  let red=0, heart=0, duel=0, event=0, shop=0;
  let cur = startId;
  for (let i = 0; i < depth; i++) {
    const n = NODE_MAP[cur]; if (!n) break;
    if (n.type==="red")      red++;
    if (n.type==="minigame") heart++;
    if (n.type==="duel")     duel++;
    if (n.type==="event")    event++;
    if (n.type==="shop" || n.type==="duelshop") shop++;
    if (n.next.length) cur = n.next[0]; else break;
  }
  if (shop >= 1 && duel >= 1) return { icon:"🛒", label:"Shop+Duels!", color:"#f4845f" };
  if (shop >= 1)               return { icon:"🛒", label:"Shop ahead!", color:"#38b000" };
  if (duel >= 2 && red >= 2)   return { icon:"💀", label:"Danger!",     color:"#ef233c" };
  if (duel >= 2)               return { icon:"⚔️",  label:"Duels",      color:"#f4845f" };
  if (heart >= 2)              return { icon:"💖",  label:"Love!",      color:"#ff6b9d" };
  if (red >= 3)                return { icon:"💸",  label:"Red zone",   color:"#ef233c" };
  if (event >= 2)              return { icon:"💌",  label:"Events",     color:"#c77dff" };
  return                              { icon:"💰",  label:"Safe",       color:"#4cc9f0" };
}

// Called on canvas click — check if we hit a fork arrow or teleport target
function onCanvasClick(e) {
  // Convert screen coords → world coords
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const wx = (sx - canvas.width/2)  / camera.zoom + camera.x;
  const wy = (sy - canvas.height/2) / camera.zoom + camera.y;

  // Teleport mode takes priority
  if (teleportMode) {
    checkTeleportClick(wx, wy);
    return;
  }

  if (turnPhase !== "fork" || !forkArrows) return;

  // Hit-test each arrow button (drawn as a circle around the target node)
  const HIT_R = 55; // hit radius in world units
  for (const arrow of forkArrows) {
    const dx = wx - arrow.x, dy = wy - arrow.y;
    if (dx*dx + dy*dy <= HIT_R*HIT_R) {
      chooseFork(arrow.nodeId);
      return;
    }
  }
}

function chooseFork(chosenId) {
  forkArrows = null;
  clearToast();
  if (!pendingFork) return;
  const { player, stepsRemaining } = pendingFork;
  pendingFork = null;

  // Step into the chosen branch node
  const n = NODE_MAP[chosenId];
  player.nodeId = chosenId; player.x = n.x; player.y = n.y;

  if (stepsRemaining - 1 > 0) {
    buildAndMove(player, stepsRemaining - 1);
  } else {
    turnPhase = "landing";
    handleLanding(player);
  }
}

// ─────────────────────────────────────────────────────────────
//  STAR OFFER UI
// ─────────────────────────────────────────────────────────────
function showStarOfferUI() {
  if (!pendingStarOffer) return;
  turnPhase = "starOffer";
  const { player } = pendingStarOffer;
  const canAfford  = player.coins >= CONFIG.game.starCost;

  showChoicePopup(
    "⭐",
    `You're passing the Star!\nBuy it for ${CONFIG.game.starCost} coins?`,
    canAfford ? `Buy Star ⭐  (-${CONFIG.game.starCost})` : `Need ${CONFIG.game.starCost} coins`,
    canAfford,
    "Keep Going →",
    bought => {
      if (bought) {
        player.coins -= CONFIG.game.starCost;
        player.stars++;
        updateHUD();
        relocateStar();
        showToast("⭐ Star bought! Watch it fly to a new spot!", 3000);
      }
      const { stepsRemaining } = pendingStarOffer;
      pendingStarOffer = null;
      if (stepsRemaining > 0) buildAndMove(player, stepsRemaining);
      else { turnPhase="landing"; handleLanding(player); }
    }
  );
}

// ─────────────────────────────────────────────────────────────
//  STAR RELOCATION
// ─────────────────────────────────────────────────────────────
function relocateStar() {
  const old = NODE_MAP[starNodeId];
  const fromX = old.x, fromY = old.y;

  const occupied = new Set(players.map(p => p.nodeId));
  occupied.add(starNodeId);
  const pool = STAR_CANDIDATES.filter(id => !occupied.has(id));
  const newId = pool[Math.floor(Math.random() * pool.length)] ?? STAR_CANDIDATES[0];
  starNodeId = newId;
  boardDirty = true;   // rebuild board cache with new star position

  const newN = NODE_MAP[newId];
  starAnim = { fromX, fromY, toX: newN.x, toY: newN.y, t:0, duration:1.8 };

  zoomOut();
  setTimeout(() => {
    showToast("⭐ Star has landed somewhere new!", 2500);
    setTimeout(focusOnCurrentPlayer, 2500);
  }, 400);
}

// ─────────────────────────────────────────────────────────────
//  DICE
// ─────────────────────────────────────────────────────────────
function rollDice() {
  if (turnPhase !== "idle") return;
  const p = players[currentPlayerIndex];

  // In multiplayer, only the correct local player can roll
  if (netConn) {
    const isMyTurn = (netRole==="host" && currentPlayerIndex===0) ||
                     (netRole==="guest" && currentPlayerIndex===1);
    if (!isMyTurn) return;
  }

  turnPhase = "rolling";
  document.getElementById("btnRoll").disabled = true;
  disableItemButtons();

  if (p.pendingDoubleDice) {
    p.pendingDoubleDice = false;
    removeFromInventory(p, "doubleDice");
    const r1 = Math.floor(Math.random() * CONFIG.game.diceMax) + CONFIG.game.diceMin;
    const r2 = Math.floor(Math.random() * CONFIG.game.diceMax) + CONFIG.game.diceMin;
    const boost = p.pendingBoost;
    const result = r1 + r2 + boost;
    p.pendingBoost = 0;
    animateDoubleDice(r1, r2, boost, () => {
      showToast(`🎲🎲 ${r1} + ${r2}${boost?` + ${boost}(boost)`:""}= ${result}! Moving…`, 3000);
      buildAndMove(p, result);
    });
  } else {
    const base = Math.floor(Math.random() * CONFIG.game.diceMax) + CONFIG.game.diceMin;
    const boost = p.pendingBoost;
    const result = base + boost;
    const hadBoost = boost > 0;
    if (hadBoost) removeFromInventory(p, "boost");
    p.pendingBoost = 0;
    animateDice(result, () => {
      document.getElementById("diceValue").textContent = result;
      const msg = hadBoost ? `🚀 ${base} + ${boost}(boost) = ${result}! Moving…` : `🎲 Rolled a ${result}! Moving…`;
      showToast(msg, 2000);
      buildAndMove(p, result);
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  ITEM USAGE
// ─────────────────────────────────────────────────────────────
function removeFromInventory(player, itemId) {
  const idx = player.inventory.indexOf(itemId);
  if (idx !== -1) player.inventory.splice(idx, 1);
  updateHUD();
}

function useItem(itemId) {
  if (turnPhase !== "idle") return;
  const p = players[currentPlayerIndex];
  if (!p.inventory.includes(itemId)) return;

  switch(itemId) {
    case "doubleDice":
      if (p.pendingDoubleDice) { showToast("🎲🎲 Double Dice already active!", 1500); return; }
      p.pendingDoubleDice = true;
      showToast("🎲🎲 Double Dice ready! Now roll!", 2000);
      flashItemUsed("doubleDice");
      break;
    case "boost":
      if (p.pendingBoost > 0) { showToast("🚀 Boost already active!", 1500); return; }
      p.pendingBoost = 2;
      showToast("🚀 Boost activated! +2 to next roll!", 2000);
      flashItemUsed("boost");
      break;
    case "smallTeleport":
      if (p.pendingTeleport) { showToast("✨ Already in teleport mode! Click a green space.", 2000); return; }
      p.pendingTeleport = true;
      removeFromInventory(p, "smallTeleport");
      activateTeleportMode(p);
      break;
  }
  updateHUD();
}

function flashItemUsed(itemId) {
  const btn = document.querySelector(`.item-btn[data-item="${itemId}"]`);
  if (!btn) return;
  btn.classList.add("item-activated");
  setTimeout(() => btn.classList.remove("item-activated"), 600);
}

function disableItemButtons() {
  document.querySelectorAll(".item-btn").forEach(b => b.disabled = true);
}

// ─────────────────────────────────────────────────────────────
//  TELEPORT MODE
// ─────────────────────────────────────────────────────────────
let teleportMode = null; // { player, eligibleIds }

function activateTeleportMode(player) {
  const eligible = getNodesWithin10(player.nodeId);
  teleportMode = { player, eligible };
  turnPhase = "teleport";
  canvas.classList.add("fork-mode");
  document.getElementById("btnRoll").disabled = true;
  showToast("✨ TELEPORT! Click a glowing space to jump up to 10 spaces ahead!", 99999);
  zoomOut();
}

function getNodesWithin10(startId) {
  // BFS to find distances
  const dist = {};
  const queue = [[startId, 0]];
  dist[startId] = 0;
  while (queue.length) {
    const [id, d] = queue.shift();
    const node = NODE_MAP[id];
    if (!node) continue;
    for (const nid of node.next) {
      if (dist[nid] === undefined) {
        dist[nid] = d + 1;
        queue.push([nid, d + 1]);
      }
    }
  }
  return Object.keys(dist).filter(id => dist[id] > 0 && dist[id] <= 10).map(Number);
}

function checkTeleportClick(wx, wy) {
  if (!teleportMode) return false;
  const { player, eligible } = teleportMode;
  const HIT_R = 55;
  for (const id of eligible) {
    const node = NODE_MAP[id];
    if (!node) continue;
    const dx = wx - node.x, dy = wy - node.y;
    if (dx*dx + dy*dy <= HIT_R*HIT_R) {
      teleportMode = null;
      canvas.classList.remove("fork-mode");
      clearToast();
      player.pendingTeleport = false;
      player.x = node.x; player.y = node.y; player.nodeId = id;
      showToast(`✨ Teleported to space ${id}!`, 2000);
      focusOnCurrentPlayer();
      document.getElementById("btnRoll").disabled = false;
      document.querySelectorAll(".item-btn").forEach(b => b.disabled = false);
      turnPhase = "idle";
      setTimeout(() => {
        turnPhase = "landing";
        handleLanding(player);
      }, 600);
      return true;
    }
  }
  return false;
}

function animateDice(finalVal, cb, isDouble=false) {
  const el = document.getElementById("diceValue");
  const box = document.getElementById("diceBox");
  if (isDouble) box.classList.add("double-roll");
  el.classList.add("rolling");
  let count = 0;
  const iv = setInterval(() => {
    el.textContent = Math.floor(Math.random()*12)+2;
    if (++count >= 14) {
      clearInterval(iv);
      el.textContent = finalVal;
      el.classList.remove("rolling");
      el.classList.add("pop");
      box.classList.remove("double-roll");
      setTimeout(() => el.classList.remove("pop"), 400);
      setTimeout(cb, 200);
    }
  }, 60);
}

function animateDoubleDice(r1, r2, boost, cb) {
  // Replace the single dice box with two dice + formula
  const container = document.getElementById("diceContainer");
  const label = document.getElementById("diceLabel");
  label.textContent = "Double Dice!";

  // Save original HTML to restore later
  const origInner = container.innerHTML;

  container.innerHTML = `
    <span id="diceLabel" style="font-size:11px;opacity:.7;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:gold;">🎲🎲 Double Dice!</span>
    <div style="display:flex;align-items:center;gap:6px;">
      <div class="double-roll" id="diceA" style="width:54px;height:54px;background:linear-gradient(135deg,#1e1e3f,#2d2d5e);border:2px solid gold;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:'Fredoka One',cursive;font-size:30px;color:white;">?</div>
      <span style="font-family:'Fredoka One',cursive;font-size:20px;opacity:.7;">+</span>
      <div class="double-roll" id="diceB" style="width:54px;height:54px;background:linear-gradient(135deg,#1e1e3f,#2d2d5e);border:2px solid gold;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:'Fredoka One',cursive;font-size:30px;color:white;">?</div>
      ${boost ? `<span style="font-family:'Fredoka One',cursive;font-size:20px;opacity:.7;">+</span><div style="width:38px;height:38px;background:rgba(255,214,10,0.2);border:2px solid gold;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Fredoka One',cursive;font-size:20px;color:gold;">${boost}</div>` : ""}
      <span style="font-family:'Fredoka One',cursive;font-size:20px;opacity:.7;">=</span>
      <div id="diceTotalBox" style="width:60px;height:60px;background:linear-gradient(135deg,#2a1a4a,#3d2060);border:2px solid #c77dff;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:'Fredoka One',cursive;font-size:34px;color:white;">?</div>
    </div>`;

  const dA = document.getElementById("diceA");
  const dB = document.getElementById("diceB");
  const dT = document.getElementById("diceTotalBox");

  // Animate both dice rolling
  let count = 0;
  const iv = setInterval(() => {
    dA.textContent = Math.floor(Math.random()*6)+1;
    dB.textContent = Math.floor(Math.random()*6)+1;
    if (++count >= 14) {
      clearInterval(iv);
      dA.textContent = r1;
      dB.textContent = r2;
      setTimeout(() => {
        dT.textContent = r1 + r2 + boost;
        dT.style.animation = "dicePop .35s ease-out forwards";
        // Restore normal dice after 2.5s
        setTimeout(() => {
          container.innerHTML = `
            <span id="diceLabel" style="font-size:11px;opacity:.6;font-weight:800;letter-spacing:.5px;text-transform:uppercase;">Dice</span>
            <div id="diceBox" style="width:74px;height:74px;background:linear-gradient(135deg,#1e1e3f,#2d2d5e);border:2px solid rgba(255,255,255,.15);border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1);position:relative;overflow:hidden;">
              <span id="diceValue" style="font-family:'Fredoka One',cursive;font-size:42px;color:white;">${r1+r2+boost}</span>
            </div>`;
          cb();
        }, 1200);
      }, 350);
    }
  }, 60);
}

// ─────────────────────────────────────────────────────────────
//  LANDING
// ─────────────────────────────────────────────────────────────
function handleLanding(player) {
  const node   = NODE_MAP[player.nodeId];
  const onStar = player.nodeId === starNodeId;
  const type   = onStar ? "starLand" : node.type;
  const cfg    = CONFIG.spaceColors[node.type] || CONFIG.spaceColors.blue;
  const isAI   = player.index >= 2;

  setTimeout(() => {
    switch (type) {
      case "blue":
        player.coins += 3;
        spawnFloat(player, "+3 💰", "#4cc9f0");
        updateHUD(); endTurn(); break;

      case "red":
        player.coins = Math.max(0, player.coins - 3);
        spawnFloat(player, "-3 💰", "#ef233c");
        updateHUD(); endTurn(); break;

      case "minigame":
        showSpacePopup("🎮", "Mini Game!\nGet ready…", "#a855f7", () => {
          triggerMinigame(player, endTurn);
        }); break;

      case "starLand":
        if (player.coins >= CONFIG.game.starCost) {
          player.coins -= CONFIG.game.starCost; player.stars++;
          updateHUD(); relocateStar();
          if (isAI) { spawnFloat(player, "⭐ Star!", "#ffd60a"); setTimeout(endTurn, 1200); }
          else showSpacePopup("⭐", `Star purchased!\n(-${CONFIG.game.starCost} coins)`, "#ffd60a", endTurn);
        } else {
          if (isAI) { setTimeout(endTurn, 600); }
          else showSpacePopup("⭐", `Not enough!\n(need ${CONFIG.game.starCost} coins)`, "#ffd60a", endTurn);
        } break;

      case "event":
        triggerLoveEvent(player, endTurn); break;

      case "duel":
        showSpacePopup("⚔️", "Duel Space!\nPrepare to fight…", "#f4845f", () => {
          triggerDuel(player, players, endTurn);
        }); break;

      case "shop":
        if (isAI) {
          if (aiShopDecision(player, false)) aiBuyItem(player);
          setTimeout(endTurn, 800);
        } else { openShop(player, false, endTurn); }
        break;

      case "duelshop":
        if (isAI) { setTimeout(endTurn, 600); }
        else { openShop(player, true, endTurn); }
        break;

      case "start":
        player.coins += 5;
        spawnFloat(player, "+5 💰 START!", "#06d6a0");
        updateHUD();
        if (isAI) setTimeout(endTurn, 800);
        else showSpacePopup("🏠", "Passed START!\n+5 bonus coins 🎉", "#06d6a0", endTurn);
        break;

      default:
        endTurn();
    }
    updateHUD();
  }, 400);
}

function triggerLoveEvent(player, cb) {
  const ev = CONFIG.loveEvents[Math.floor(Math.random()*CONFIG.loveEvents.length)];
  player.coins = Math.max(0, player.coins + ev.coins);
  updateHUD();
  const extra = ev.coins > 0 ? `\n+${ev.coins} coins` : ev.coins < 0 ? `\n${ev.coins} coins` : "";
  showSpacePopup("💌", ev.text + extra, "#c77dff", cb);
}

// ─────────────────────────────────────────────────────────────
//  FLOATING COIN TEXT  (instead of popup for simple spaces)
// ─────────────────────────────────────────────────────────────
let floatingTexts = []; // [{x,y,text,color,t,life}]

function spawnFloat(player, text, color) {
  const node = NODE_MAP[player.nodeId];
  if (!node) return;
  floatingTexts.push({ x: node.x, y: node.y - 40, text, color: color||"#ffd60a", t:0, life:1.8 });
}

// Called from render loop
function drawFloatingTexts() {
  floatingTexts = floatingTexts.filter(f => f.t < f.life);
  floatingTexts.forEach(f => {
    f.t += 0.016;
    const alpha = Math.max(0, 1 - f.t / f.life);
    const y = f.y - f.t * 60;
    ctx.save();
    ctx.font = "bold 22px 'Fredoka One',cursive";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = f.color;
    ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 8;
    ctx.fillText(f.text, f.x, y);
    ctx.restore();
  });
}

// ─────────────────────────────────────────────────────────────
//  TURN MANAGEMENT
// ─────────────────────────────────────────────────────────────
function endTurn() {
  forkArrows  = null;
  pendingFork = null;

  // Advance to next player
  const prev = currentPlayerIndex;
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

  // New round when we wrap back to first player
  if (currentPlayerIndex === 0) {
    round++;
    document.getElementById("roundNum").textContent = round;
    if (round > CONFIG.game.totalRounds) { showGameOver(); return; }
  }

  turnPhase = "idle";
  document.getElementById("btnRoll").disabled = false;
  document.querySelectorAll(".item-btn").forEach(b => b.disabled = false);
  updateHUD();
  focusOnCurrentPlayer();

  const cur = players[currentPlayerIndex];
  const isHuman = currentPlayerIndex === 0 || currentPlayerIndex === 1;

  if (isHuman) {
    // Sync turn to remote player 2 if multiplayer active
    netSendTurn();
    showToast(`🎲 ${cur.name}'s turn! Roll the dice.`, 2000);
  } else {
    // AI plays automatically after a short pause
    setTimeout(() => aiTakeTurn(cur), 900);
  }
}

// ─────────────────────────────────────────────────────────────
//  AI TURN
// ─────────────────────────────────────────────────────────────
function aiTakeTurn(player) {
  if (players[currentPlayerIndex] !== player) return; // stale call guard

  // Maybe use an item first
  aiMaybeUseItem(player);

  // Roll after slight delay
  setTimeout(() => {
    showToast(`🤖 ${player.name} is rolling…`, 1200);
    const base = Math.floor(Math.random() * CONFIG.game.diceMax) + CONFIG.game.diceMin;
    const boost = player.pendingBoost || 0;
    const result = base + boost;
    if (boost > 0) { removeFromInventory(player, "boost"); player.pendingBoost = 0; }

    animateDice(result, () => {
      document.getElementById("diceValue").textContent = result;
      buildAndMove(player, result);
    });
  }, 800);
}

function aiMaybeUseItem(player) {
  if (!player.inventory || player.inventory.length === 0) return;
  // Use boost if we have it ~60% of the time
  if (player.inventory.includes("boost") && Math.random() < 0.6) {
    player.pendingBoost = (player.pendingBoost || 0) + 2;
    removeFromInventory(player, "boost");
    showToast(`🚀 ${player.name} used Boost!`, 1000);
  }
}

// AI fork choice — prefer paths with more blue/heart/star, avoid red/duel
function aiForkChoice(choices) {
  const scores = choices.map(id => {
    let score = 0;
    let cur = id;
    for (let i = 0; i < 6; i++) {
      const n = NODE_MAP[cur]; if (!n) break;
      if (n.type === "blue")    score += 2;
      if (n.type === "heart")   score += 3;
      if (n.type === "star")    score += 5;
      if (n.type === "shop")    score += 2;
      if (n.type === "red")     score -= 2;
      if (n.type === "duel")    score -= 1;
      cur = n.next[0];
    }
    return score;
  });
  const best = Math.max(...scores);
  return choices[scores.indexOf(best)];
}

// AI shop decision — buy if we can afford and it's useful
function aiShopDecision(player, isDuelShop) {
  if (isDuelShop) return false; // AI skips duel shop for now
  const items = Object.values(CONFIG.shopItems);
  const affordable = items.filter(it => player.coins >= it.cost);
  if (affordable.length === 0) return false;
  if (player.coins < 8) return false; // save coins
  return Math.random() < 0.45; // 45% chance to buy something
}

function aiBuyItem(player) {
  const items = Object.values(CONFIG.shopItems);
  const affordable = items.filter(it => player.coins >= it.cost);
  if (affordable.length === 0) return;
  const pick = affordable[Math.floor(Math.random() * affordable.length)];
  player.coins -= pick.cost;
  addToInventory(player, pick.id);
  updateHUD();
  showToast(`🛍️ ${player.name} bought ${pick.name}!`, 1500);
}

// ─────────────────────────────────────────────────────────────
//  GAME OVER
// ─────────────────────────────────────────────────────────────
function showGameOver() {
  const sorted = [...players].sort((a,b) => b.stars - a.stars || b.coins - a.coins);
  const winner = sorted[0];
  const overlay = document.createElement("div");
  overlay.style.cssText = `position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.85);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Fredoka One',cursive;color:white;`;
  overlay.innerHTML = `
    <div style="font-size:48px;margin-bottom:12px">🏆 GAME OVER!</div>
    <div style="font-size:28px;color:${winner.color};margin-bottom:24px">${winner.name} wins!</div>
    <div style="font-size:16px;opacity:.7;margin-bottom:32px">
      ${sorted.map((p,i)=>`${["🥇","🥈","🥉","🏅"][i]} ${p.name}: ${p.stars}⭐ ${p.coins}💰`).join("<br>")}
    </div>
    <button onclick="location.reload()" style="padding:14px 40px;font-size:20px;font-family:'Fredoka One',cursive;
      background:linear-gradient(135deg,#ff6b9d,#c77dff);border:none;border-radius:30px;color:white;cursor:pointer;">
      Play Again 🎲
    </button>`;
  document.body.appendChild(overlay);
}

// ─────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Draw static board from cache (connections + spaces), rebuild only when needed
  if (boardDirty || !boardCanvas) {
    buildBoardCache();
    boardDirty = false;
  }
  ctx.drawImage(boardCanvas, 0, 0);

  // Dynamic layers: animated rings, fork arrows, star fly, players
  drawDynamicSpaceEffects();
  if (forkArrows) drawForkArrows();
  drawTeleportHighlights();
  drawStarAnim();
  drawPlayers();
  drawFloatingTexts();

  ctx.restore();
}

// Build the static board once (or when dirty)
function buildBoardCache() {
  if (!boardCanvas) {
    boardCanvas = document.createElement("canvas");
    boardCanvas.width  = WORLD_W;
    boardCanvas.height = WORLD_H;
    boardCtx = boardCanvas.getContext("2d");
  }
  boardCtx.clearRect(0, 0, WORLD_W, WORLD_H);
  drawConnections(boardCtx);
  drawSpaces(boardCtx);
}

// Only animated effects (pulses, star ring) drawn each frame on main ctx
function drawDynamicSpaceEffects() {
  BOARD_NODES.forEach(node => {
    const isStar = node.id === starNodeId;
    const isShop = node.type === "shop" || node.type === "duelshop";
    if (!isStar && !isShop && node.next.length <= 1) return; // nothing animated
    const r = isShop ? SPACE_R + 6 : SPACE_R;

    if (isStar) {
      const pulse = 0.5 + 0.5*Math.sin(frameTime/280);
      ctx.beginPath();
      ctx.arc(node.x, node.y, r+10+pulse*7, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(255,214,10,${0.4+pulse*0.5})`;
      ctx.lineWidth   = 3.5; ctx.stroke();
    }
    if (isShop) {
      const pulse = 0.5 + 0.5*Math.sin(frameTime/400 + node.id);
      const shopColor = node.type === "duelshop" ? "114,9,183" : "56,176,0";
      ctx.beginPath();
      ctx.arc(node.x, node.y, r+8+pulse*6, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${shopColor},${0.5+pulse*0.4})`;
      ctx.lineWidth   = 3; ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r+16+pulse*4, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${shopColor},${0.15+pulse*0.15})`;
      ctx.lineWidth   = 2; ctx.stroke();
    }
  });
}

// ── CONNECTIONS ──────────────────────────────────────────────
function drawConnections(c) {
  c = c || ctx;
  BOARD_NODES.forEach(node => {
    node.next.forEach(nextId => {
      const next = NODE_MAP[nextId]; if (!next) return;

      // Thick pale track
      c.beginPath();
      c.moveTo(node.x, node.y); c.lineTo(next.x, next.y);
      c.strokeStyle = "rgba(255,255,255,0.10)";
      c.lineWidth   = 18; c.lineCap = "round";
      c.stroke();

      // Dashed centre line
      c.beginPath();
      c.setLineDash([9,9]);
      c.moveTo(node.x, node.y); c.lineTo(next.x, next.y);
      c.strokeStyle = "rgba(255,255,255,0.22)";
      c.lineWidth   = 3;
      c.stroke();
      c.setLineDash([]);
    });
  });
}

// ── SPACES ───────────────────────────────────────────────────
function drawSpaces(c) {
  c = c || ctx;
  BOARD_NODES.forEach(node => drawSpace(node, c));
}

function drawSpace(node, c) {
  c = c || ctx;
  const isStar = node.id === starNodeId;
  const isShop = node.type === "shop" || node.type === "duelshop";
  const cfg    = CONFIG.spaceColors[node.type] || CONFIG.spaceColors.blue;
  const r      = isShop ? SPACE_R + 6 : SPACE_R;

  // Fork dashed ring
  if (node.next.length > 1) {
    c.beginPath();
    c.arc(node.x, node.y, r+7, 0, Math.PI*2);
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.lineWidth   = 2; c.setLineDash([4,4]); c.stroke();
    c.setLineDash([]);
  }

  // Drop shadow
  c.beginPath();
  c.arc(node.x, node.y+5, r, 0, Math.PI*2);
  c.fillStyle = "rgba(0,0,0,0.4)"; c.fill();

  // Body
  c.beginPath();
  c.arc(node.x, node.y, r, 0, Math.PI*2);
  c.fillStyle = isStar ? "#ffd60a" : cfg.bg;
  c.fill();

  // Inner highlight
  c.beginPath();
  c.arc(node.x - r*0.2, node.y - r*0.25, r*0.42, 0, Math.PI*2);
  c.fillStyle = "rgba(255,255,255,0.14)"; c.fill();

  // Rim
  c.beginPath();
  c.arc(node.x, node.y, r, 0, Math.PI*2);
  c.strokeStyle = "rgba(255,255,255,0.42)";
  c.lineWidth = 2.5; c.stroke();

  // Icon — centered with emoji offset correction
  const iconSize = Math.round(r * 0.88);
  c.save();
  c.font = `${iconSize}px serif`;
  c.textAlign = "center";
  c.textBaseline = "alphabetic";  // more reliable cross-browser centering for emoji
  c.shadowColor = "rgba(0,0,0,0.85)";
  c.shadowBlur   = 5;
  c.shadowOffsetX = 0;
  c.shadowOffsetY = 0;
  c.globalAlpha  = 1;
  // Offset: alphabetic baseline sits ~70% up the em box; nudge up ~30% of icon size
  const emojiY = node.y + iconSize * 0.30;
  c.fillText(isStar ? "⭐" : cfg.icon, node.x, emojiY);
  c.restore();
}

// ── FORK ARROWS  (drawn in world-space on the canvas) ────────
function drawForkArrows() {
  if (!pendingFork || !forkArrows) return;
  const fromNode = NODE_MAP[pendingFork.atNodeId];

  forkArrows.forEach((arrow, idx) => {
    const tx = arrow.x, ty = arrow.y;
    const fx = fromNode.x, fy = fromNode.y;

    // Direction vector fork→target
    const dx = tx - fx, dy = ty - fy;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/len, uy = dy/len;

    // Draw a thick animated arrow along the path
    const pulse = 0.5 + 0.5*Math.sin(Date.now()/350 + idx*Math.PI);

    // Arrow shaft (from just outside fork node to just outside target)
    const startX = fx + ux*(SPACE_R+8), startY = fy + uy*(SPACE_R+8);
    const endX   = tx - ux*(SPACE_R+8), endY   = ty - uy*(SPACE_R+8);

    // Glowing track
    ctx.beginPath();
    ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + pulse*0.12})`;
    ctx.lineWidth   = 22; ctx.lineCap = "round"; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
    ctx.strokeStyle = arrow.info.color;
    ctx.lineWidth   = 5; ctx.stroke();

    // Arrowhead
    const headLen = 22;
    const angle   = Math.atan2(endY-startY, endX-startX);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen*Math.cos(angle-0.42), endY - headLen*Math.sin(angle-0.42));
    ctx.lineTo(endX - headLen*Math.cos(angle+0.42), endY - headLen*Math.sin(angle+0.42));
    ctx.closePath();
    ctx.fillStyle = arrow.info.color; ctx.fill();

    // Clickable circle at the target node (overlaid, pulsing)
    ctx.beginPath();
    ctx.arc(tx, ty, SPACE_R+14+pulse*5, 0, Math.PI*2);
    ctx.fillStyle   = arrow.info.color + "44"; ctx.fill();
    ctx.strokeStyle = arrow.info.color;
    ctx.lineWidth   = 3.5; ctx.stroke();

    // Label above the target circle
    ctx.font = "bold 22px 'Fredoka One', cursive";
    ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 8;
    ctx.fillText(`${arrow.info.icon} ${arrow.info.label}`, tx, ty - SPACE_R - 20);
    ctx.shadowBlur = 0;
  });
}

// ── TELEPORT HIGHLIGHTS ───────────────────────────────────────
function drawTeleportHighlights() {
  if (!teleportMode) return;
  const { eligible } = teleportMode;
  const pulse = 0.5 + 0.5*Math.sin(frameTime/200);
  eligible.forEach(id => {
    const node = NODE_MAP[id]; if (!node) return;
    // Outer glow ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, SPACE_R + 14 + pulse * 8, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(0,255,120,${0.5 + pulse*0.5})`;
    ctx.lineWidth = 3.5; ctx.stroke();
    // Inner bright ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, SPACE_R + 5, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(0,255,120,0.9)`;
    ctx.lineWidth = 2; ctx.stroke();
    // Tinted fill overlay
    ctx.beginPath();
    ctx.arc(node.x, node.y, SPACE_R, 0, Math.PI*2);
    ctx.fillStyle = `rgba(0,255,120,${0.18 + pulse*0.12})`;
    ctx.fill();
  });
}


function drawStarAnim() {
  if (!starAnim) return;
  const t    = Math.min(starAnim.t, 1);
  const ease = t<0.5 ? 2*t*t : -1+(4-2*t)*t;
  const x    = starAnim.fromX + (starAnim.toX-starAnim.fromX)*ease;
  const y    = starAnim.fromY + (starAnim.toY-starAnim.fromY)*ease
               - Math.sin(Math.PI*t)*500;

  ctx.beginPath();
  ctx.arc(x, y, SPACE_R+10, 0, Math.PI*2);
  ctx.fillStyle = `rgba(255,214,10,${(1-t)*0.5})`; ctx.fill();

  ctx.globalAlpha = 1-t*0.2;
  ctx.font = `${SPACE_R*1.9}px serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("⭐", x, y);
  ctx.globalAlpha = 1;
}

// ── PLAYERS ──────────────────────────────────────────────────
function drawPlayers() {
  players.forEach(p => {
    const bounce = Math.sin(p.bounceT) * 5;
    const px = p.x + p.offset.x;
    const py = p.y + p.offset.y + bounce;
    const R  = 24;

    ctx.beginPath();
    ctx.ellipse(px, p.y+p.offset.y+R+5, R*0.7, R*0.25, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();

    if (p.image && p.image.complete && p.image.naturalWidth>0 && !p.image._failed) {
      ctx.save();
      ctx.beginPath(); ctx.arc(px,py,R+2,0,Math.PI*2); ctx.clip();
      ctx.drawImage(p.image, px-R-2, py-R-2, (R+2)*2, (R+2)*2);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(px,py,R+2,0,Math.PI*2);
      ctx.fillStyle = p.color; ctx.fill();
      ctx.font = `${R*1.1}px serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(p.emoji, px, py);
    }

    ctx.beginPath(); ctx.arc(px,py,R+2,0,Math.PI*2);
    ctx.strokeStyle="white"; ctx.lineWidth=2.5; ctx.stroke();

    // Name tag
    ctx.font = "bold 11px 'Nunito', sans-serif";
    const tw = ctx.measureText(p.name).width+10;
    ctx.fillStyle="rgba(0,0,0,0.65)";
    rrect(px-tw/2, py-R-23, tw, 16, 6);
    ctx.fill();
    ctx.fillStyle="white"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(p.name, px, py-R-15);

    if (players[currentPlayerIndex]===p && turnPhase==="idle") {
      ctx.beginPath(); ctx.arc(px,py,R+9,0,Math.PI*2);
      ctx.strokeStyle="gold"; ctx.lineWidth=3;
      ctx.setLineDash([6,4]); ctx.stroke(); ctx.setLineDash([]);
    }
  });
}

function rrect(x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────
//  CAMERA
// ─────────────────────────────────────────────────────────────
function focusOnCurrentPlayer(instant=false) {
  const p = players[currentPlayerIndex];
  targetCam.x=p.x; targetCam.y=p.y; targetCam.zoom=1.5;
  if (instant) { camera.x=p.x; camera.y=p.y; camera.zoom=1.5; }
}

function zoomOut() {
  targetCam.x = WORLD_W/2; targetCam.y = WORLD_H/2;
  targetCam.zoom = Math.min(
    (window.innerWidth*0.88)/WORLD_W,
    (window.innerHeight*0.82)/WORLD_H
  );
}

function toggleZoom() {
  if (targetCam.zoom < 1) focusOnCurrentPlayer(); else zoomOut();
}

// ─────────────────────────────────────────────────────────────
//  HUD
// ─────────────────────────────────────────────────────────────
function updateHUD() {
  players.forEach((p,i) => {
    const card = document.getElementById(`pcard-${i}`); if (!card) return;
    card.querySelector(".pc-coins").textContent = `💰 ${p.coins}`;
    card.querySelector(".pc-stars").textContent  = `⭐ ${p.stars}`;
    card.classList.toggle("active", i===currentPlayerIndex && turnPhase==="idle");

    // Update inventory display (board items)
    const inv = card.querySelector(".pc-inventory");
    if (inv) {
      const boardCounts = {};
      p.inventory.forEach(id => { boardCounts[id] = (boardCounts[id]||0)+1; });
      const duelCounts = {};
      (p.duelInventory||[]).forEach(id => { duelCounts[id] = (duelCounts[id]||0)+1; });

      let html = "";
      // Board items
      if (p.inventory.length > 0) {
        html += Object.entries(boardCounts).map(([id, cnt]) => {
          const item = CONFIG.shopItems[id];
          if (!item) return "";
          const isActive = (id==="doubleDice" && p.pendingDoubleDice) ||
                           (id==="boost" && p.pendingBoost > 0) ||
                           (id==="smallTeleport" && p.pendingTeleport);
          return `<span class="inv-item ${isActive?'inv-active':''}" title="${item.name}: ${item.desc}">${item.icon}${cnt>1?`<sup>×${cnt}</sup>`:""}</span>`;
        }).join("");
      }
      // Duel items
      if ((p.duelInventory||[]).length > 0 || (p.bonusMaxHp||0) > 0) {
        if (html) html += `<span class="inv-divider">|</span>`;
        html += Object.entries(duelCounts).map(([id, cnt]) => {
          const item = CONFIG.duelShopItems[id];
          if (!item) return "";
          return `<span class="inv-item inv-duel" title="${item.name}: ${item.desc}">${item.icon}${cnt>1?`<sup>×${cnt}</sup>`:""}</span>`;
        }).join("");
        if ((p.bonusMaxHp||0) > 0) {
          html += `<span class="inv-item inv-duel inv-perm" title="Iron Body: +${p.bonusMaxHp} max HP permanently">❤️‍🔥<sup>+${p.bonusMaxHp}</sup></span>`;
        }
      }
      inv.innerHTML = html || `<span class="inv-empty">No items</span>`;
    }

    // Update item buttons for current player
    if (i === currentPlayerIndex) {
      updateItemButtons(p);
    }
  });
}

function updateItemButtons(player) {
  const bar = document.getElementById("itemBar");
  if (!bar) return;

  // Count items
  const counts = {};
  player.inventory.forEach(id => { counts[id] = (counts[id]||0)+1; });

  const items = Object.values(CONFIG.shopItems);
  bar.innerHTML = items.map(item => {
    const cnt = counts[item.id] || 0;
    const isActive = (item.id==="doubleDice" && player.pendingDoubleDice) ||
                     (item.id==="boost" && player.pendingBoost > 0) ||
                     (item.id==="smallTeleport" && player.pendingTeleport);
    if (cnt === 0) return "";
    return `<button class="item-btn ${isActive?'item-active':''}" data-item="${item.id}"
      onclick="useItem('${item.id}')" title="${item.name}: ${item.desc}">
      ${item.icon} <span class="item-label">${item.name}</span>${cnt>1?`<span class="item-count">×${cnt}</span>`:""}
    </button>`;
  }).join("");

  // Show/hide bar based on whether player has items
  bar.style.display = player.inventory.length > 0 ? "flex" : "none";
}

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
function showToast(msg, duration=2500) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._timer);
  if (duration < 99000) t._timer = setTimeout(() => t.classList.remove("show"), duration);
}
function clearToast() {
  const t = document.getElementById("toast");
  clearTimeout(t._timer); t.classList.remove("show");
}

// ─────────────────────────────────────────────────────────────
//  POPUPS
// ─────────────────────────────────────────────────────────────
function showSpacePopup(icon, text, color, cb) {
  const ov = document.getElementById("popupOverlay");
  ov.style.display="flex";
  document.getElementById("popupBox").style.borderColor = color;
  document.getElementById("popupIcon").textContent = icon;
  const pt = document.getElementById("popupText");
  pt.innerHTML = ""; pt.textContent = text; // safe reset
  document.getElementById("popupBtn").style.background = color;
  document.getElementById("popupBtn").style.display = "inline-block";
  document.getElementById("popupChoiceRow").style.display = "none";
  document.getElementById("popupBtn").onclick = () => { ov.style.display="none"; cb(); };
}

function showChoicePopup(icon, text, yesLabel, yesEnabled, noLabel, cb) {
  const ov = document.getElementById("popupOverlay");
  ov.style.display="flex";
  document.getElementById("popupBox").style.borderColor = "#ffd60a";
  document.getElementById("popupIcon").textContent = icon;
  document.getElementById("popupText").textContent = text;
  document.getElementById("popupBtn").style.display = "none";
  const row = document.getElementById("popupChoiceRow");
  row.style.display = "flex";
  const yes = document.getElementById("popupYes");
  const no  = document.getElementById("popupNo");
  yes.textContent = yesLabel; yes.disabled = !yesEnabled;
  no.textContent  = noLabel;
  yes.onclick = () => { ov.style.display="none"; cb(true);  };
  no.onclick  = () => { ov.style.display="none"; cb(false); };
}

// ─────────────────────────────────────────────────────────────
//  SHOP SYSTEM
// ─────────────────────────────────────────────────────────────
// Shop nodes: when passing, player gets offered to shop.
// When landing directly: half-price discount!
const SHOP_NODE_IDS      = [42];   // board shop — on danger path!
const DUEL_SHOP_NODE_IDS = [110];   // duel shop — on punish path (shortcut C)!

// Pass-over check integrated into buildAndMove via landing logic
// Direct landing is handled by handleLanding → openShop

function openShop(player, isDuelShop, cb) {
  if (isDuelShop) {
    const items = Object.values(CONFIG.duelShopItems);
    showDuelShopPopup(player, items, false, cb);
  } else {
    const items = Object.values(CONFIG.shopItems);
    showShopPopup(player, items, false, false, cb);
  }
}

function openShopPassby(player, isDuelShop, cb, halfOff=false) {
  if (isDuelShop) {
    const items = Object.values(CONFIG.duelShopItems);
    showDuelShopPopup(player, items, halfOff, cb);
  } else {
    const items = Object.values(CONFIG.shopItems);
    showShopPopup(player, items, false, halfOff, cb);
  }
}

function showShopPopup(player, items, isDuelShop, halfOff, cb) {
  const ov = document.getElementById("popupOverlay");
  ov.style.display = "flex";

  const box = document.getElementById("popupBox");
  box.style.borderColor = isDuelShop ? "#7209b7" : "#38b000";

  document.getElementById("popupBtn").style.display = "none";
  document.getElementById("popupChoiceRow").style.display = "none";

  document.getElementById("popupIcon").textContent = isDuelShop ? "⚗️" : "🛒";

  let html = "";
  const mult = halfOff ? 0.5 : 1;
  html = `<div style="font-family:'Fredoka One',cursive;font-size:20px;margin-bottom:4px">${halfOff?"🏷️ HALF OFF! ":""}Board Shop</div>
          <div style="opacity:.6;font-size:12px;margin-bottom:16px">Use items BEFORE you roll!</div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">`;
  items.forEach(item => {
    const cost = Math.floor(item.cost * mult);
    const canAfford = player.coins >= cost;
    html += `<div class="shop-item ${canAfford?'':'shop-item-broke'}" onclick="${canAfford?`buyItem('${item.id}',${cost})`:''}">
      <span class="shop-item-icon">${item.icon}</span>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
      </div>
      <div class="shop-item-cost ${canAfford?'':'shop-cost-broke'}">💰${cost}</div>
    </div>`;
  });
  html += `</div><button onclick="closeShopPopup()" style="padding:10px 30px;border-radius:50px;border:none;background:rgba(255,255,255,.15);color:white;font-family:'Fredoka One',cursive;font-size:16px;cursor:pointer;border:1px solid rgba(255,255,255,.2)">Leave Shop</button>`;

  document.getElementById("popupText").innerHTML = html;

  // Store cb for use by buyItem/closeShopPopup
  window._shopCb = cb;
  window._shopPlayer = player;
}

window.buyItem = function(itemId, cost) {
  const player = window._shopPlayer;
  if (!player || player.coins < cost) return;
  player.coins -= cost;
  player.inventory.push(itemId);
  updateHUD();

  // Flash the bought item
  const items = Object.values(CONFIG.shopItems);
  showShopPopup(player, items, false, false, window._shopCb);
  showToast(`${CONFIG.shopItems[itemId].icon} ${CONFIG.shopItems[itemId].name} purchased!`, 1800);
};

window.closeShopPopup = function() {
  document.getElementById("popupOverlay").style.display = "none";
  document.getElementById("popupText").innerHTML = "";
  const cb = window._shopCb;
  window._shopCb = null;
  window._shopPlayer = null;
  if (cb) cb();
};

// ── DUEL SHOP ────────────────────────────────────────────────
function showDuelShopPopup(player, items, halfOff, cb) {
  const ov = document.getElementById("popupOverlay");
  ov.style.display = "flex";
  const box = document.getElementById("popupBox");
  box.style.borderColor = "#7209b7";
  document.getElementById("popupBtn").style.display = "none";
  document.getElementById("popupChoiceRow").style.display = "none";
  document.getElementById("popupIcon").textContent = "⚗️";

  const mult = halfOff ? 0.5 : 1;
  let html = `<div style="font-family:'Fredoka One',cursive;font-size:20px;margin-bottom:4px">${halfOff?"🏷️ HALF OFF! ":""}Duel Shop ⚗️</div>
              <div style="opacity:.6;font-size:12px;margin-bottom:16px">Items that power up your next duel!</div>
              <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">`;
  items.forEach(item => {
    const cost = Math.floor(item.cost * mult);
    const canAfford = player.coins >= cost;
    const tag = item.permanent ? '<span style="font-size:9px;background:rgba(199,125,255,0.2);color:#c77dff;border-radius:4px;padding:1px 5px;margin-left:4px">PERMANENT</span>' : '<span style="font-size:9px;background:rgba(255,107,157,0.15);color:#ff6b9d;border-radius:4px;padding:1px 5px;margin-left:4px">1 DUEL</span>';
    html += `<div class="shop-item ${canAfford?'':'shop-item-broke'}" onclick="${canAfford?`buyDuelItem('${item.id}',${cost})`:''}">
      <span class="shop-item-icon">${item.icon}</span>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}${tag}</div>
        <div class="shop-item-desc">${item.desc}</div>
      </div>
      <div class="shop-item-cost ${canAfford?'':'shop-cost-broke'}">💰${cost}</div>
    </div>`;
  });
  html += `</div><button onclick="closeShopPopup()" style="padding:10px 30px;border-radius:50px;border:none;background:rgba(255,255,255,.15);color:white;font-family:'Fredoka One',cursive;font-size:16px;cursor:pointer;border:1px solid rgba(255,255,255,.2)">Leave Shop</button>`;

  document.getElementById("popupText").innerHTML = html;
  window._shopCb = cb;
  window._shopPlayer = player;
}

window.buyDuelItem = function(itemId, cost) {
  const player = window._shopPlayer;
  if (!player || player.coins < cost) return;
  const item = CONFIG.duelShopItems[itemId];
  if (!item) return;

  player.coins -= cost;

  if (item.permanent) {
    // Iron Body — apply immediately and permanently
    player.bonusMaxHp = (player.bonusMaxHp || 0) + 10;
    showToast(`${item.icon} ${item.name} — Max HP permanently +10!`, 2200);
  } else {
    player.duelInventory.push(itemId);
    showToast(`${item.icon} ${item.name} purchased!`, 1800);
  }

  updateHUD();
  // Refresh shop display
  showDuelShopPopup(player, Object.values(CONFIG.duelShopItems), false, window._shopCb);
};
window.rollDice   = rollDice;
window.toggleZoom = toggleZoom;
window.initGame   = initGame;
window.useItem    = useItem;

// ─────────────────────────────────────────────────────────────
//  MULTIPLAYER  (PeerJS — works across computers, no server needed)
// ─────────────────────────────────────────────────────────────
let netPeer = null, netConn = null, netRole = null; // "host"|"guest"

// Called at end of each human turn to notify remote player
function netSendTurn() {
  if (!netConn) return;
  try {
    netConn.send({ type:"turn", playerIndex: currentPlayerIndex,
      gameState: netSerialiseState() });
  } catch(e) {}
}

function netSerialiseState() {
  return {
    players: players.map(p => ({
      coins: p.coins, stars: p.stars, nodeId: p.nodeId,
      inventory: p.inventory, pendingBoost: p.pendingBoost,
      pendingDoubleDice: p.pendingDoubleDice,
    })),
    round, currentPlayerIndex, starNodeId,
  };
}

function netApplyState(state) {
  state.players.forEach((s,i) => {
    players[i].coins = s.coins; players[i].stars = s.stars;
    players[i].nodeId = s.nodeId; players[i].inventory = s.inventory;
    players[i].pendingBoost = s.pendingBoost;
    players[i].pendingDoubleDice = s.pendingDoubleDice;
    const node = NODE_MAP[s.nodeId];
    if (node) { players[i].x = node.x; players[i].y = node.y; }
  });
  round = state.round;
  currentPlayerIndex = state.currentPlayerIndex;
  starNodeId = state.starNodeId;
  document.getElementById("roundNum").textContent = round;
  updateHUD(); focusOnCurrentPlayer();
}

function netSetupHost(roomCode) {
  if (typeof Peer === "undefined") return;
  netRole = "host";
  netPeer = new Peer(`lovequest-${roomCode}`, { debug:0 });
  netPeer.on("connection", conn => {
    netConn = conn;
    conn.on("data", netHandleData);
    conn.on("open", () => {
      showToast("💕 Partner connected! Game synced.", 2500);
      // Send full state
      conn.send({ type:"sync", gameState: netSerialiseState() });
    });
  });
  netPeer.on("error", () => {}); // silently ignore
}

function netSetupGuest(roomCode) {
  if (typeof Peer === "undefined") return;
  netRole = "guest";
  netPeer = new Peer({ debug:0 });
  netPeer.on("open", () => {
    netConn = netPeer.connect(`lovequest-${roomCode}`);
    netConn.on("open", () => showToast("💕 Connected to partner!", 2500));
    netConn.on("data", netHandleData);
  });
  netPeer.on("error", () => {});
}

function netHandleData(data) {
  if (data.type === "sync" || data.type === "turn") {
    netApplyState(data.gameState);
    turnPhase = "idle";
    document.getElementById("btnRoll").disabled = false;
    const cur = players[currentPlayerIndex];
    const isMyTurn = (netRole==="host" && currentPlayerIndex===0) ||
                     (netRole==="guest" && currentPlayerIndex===1);
    if (isMyTurn) showToast(`🎲 Your turn, ${cur.name}! Roll the dice.`, 2500);
    else if (currentPlayerIndex >= 2) {
      setTimeout(() => aiTakeTurn(cur), 900);
    }
  }
  if (data.type === "roll") {
    // Remote player rolled — animate their dice
    animateDice(data.result, () => {
      document.getElementById("diceValue").textContent = data.result;
      buildAndMove(players[data.playerIndex], data.result);
    });
  }
}

// Multiplayer UI — shown in top bar
function showMultiplayerPanel() {
  const existing = document.getElementById("mpPanel");
  if (existing) { existing.remove(); return; }

  const panel = document.createElement("div");
  panel.id = "mpPanel";
  panel.style.cssText = `position:fixed;top:70px;right:16px;z-index:400;
    background:rgba(20,10,40,0.95);border:1px solid rgba(255,255,255,0.15);
    border-radius:16px;padding:18px 22px;font-family:'Fredoka One',cursive;
    color:white;min-width:260px;box-shadow:0 8px 32px rgba(0,0,0,0.5);`;

  panel.innerHTML = `
    <div style="font-size:18px;margin-bottom:14px">💕 Multiplayer</div>
    <div style="font-size:13px;opacity:.6;margin-bottom:10px">
      Player 1 (you) = Host &nbsp;|&nbsp; Player 2 (her) = Guest
    </div>
    <div style="margin-bottom:10px">
      <label style="font-size:13px;opacity:.7">Room Code</label><br>
      <input id="mpCode" placeholder="e.g. love42" style="width:100%;margin-top:4px;
        padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);
        background:rgba(255,255,255,.08);color:white;font-family:'Fredoka One',cursive;
        font-size:16px;box-sizing:border-box;"/>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="mpHost()" style="flex:1;padding:10px;font-family:'Fredoka One',cursive;
        font-size:15px;background:linear-gradient(135deg,#9e15c0,#c77dff);border:none;
        border-radius:12px;color:white;cursor:pointer;">Host 👑</button>
      <button onclick="mpJoin()" style="flex:1;padding:10px;font-family:'Fredoka One',cursive;
        font-size:15px;background:linear-gradient(135deg,#1a6a8a,#4cc9f0);border:none;
        border-radius:12px;color:white;cursor:pointer;">Join 💕</button>
    </div>
    <div id="mpStatus" style="font-size:12px;opacity:.5;margin-top:10px;text-align:center">
      Enter a code and Host or Join
    </div>`;
  document.body.appendChild(panel);
}

window.mpHost = () => {
  const code = document.getElementById("mpCode").value.trim();
  if (!code) { document.getElementById("mpStatus").textContent="Enter a room code!"; return; }
  netSetupHost(code);
  document.getElementById("mpStatus").textContent = `Hosting room "${code}" — waiting for partner…`;
};
window.mpJoin = () => {
  const code = document.getElementById("mpCode").value.trim();
  if (!code) { document.getElementById("mpStatus").textContent="Enter a room code!"; return; }
  netSetupGuest(code);
  document.getElementById("mpStatus").textContent = `Joining room "${code}"…`;
};
window.showMultiplayerPanel = showMultiplayerPanel;