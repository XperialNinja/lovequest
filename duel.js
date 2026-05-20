// ============================================================
//  LOVEQUEST  –  duel.js
//  Full grid-based card duel system
//  Called from game.js: triggerDuel(landingPlayer, allPlayers, onDuelComplete)
// ============================================================

const DUEL = (() => {

  // ── GRID CONFIG ─────────────────────────────────────────────
  const GRID_COLS = 7;
  const GRID_ROWS = 7;
  const CELL_SIZE = 78;
  const CELL_GAP  = 10;
  const MAX_HP    = 100;
  const HAND_SIZE = 5;

  // ── ARENA LAYOUTS ────────────────────────────────────────────
  const ARENA_LAYOUTS = [
    // 0: Classic rounded
    new Set(["0,0","0,6","1,0","1,6","0,2","0,4","6,0","6,6","5,0","5,6","6,2","6,4","3,0","3,6"]),
    // 1: Diamond
    new Set(["0,0","0,1","0,2","0,4","0,5","0,6","1,0","1,1","1,5","1,6","2,0","2,6","4,0","4,6","5,0","5,1","5,5","5,6","6,0","6,1","6,2","6,4","6,5","6,6"]),
    // 2: Cross / plus
    new Set(["0,0","0,1","0,5","0,6","1,0","1,1","1,5","1,6","5,0","5,1","5,5","5,6","6,0","6,1","6,5","6,6"]),
    // 3: Scattered interior pits
    new Set(["0,0","0,6","6,0","6,6","2,2","2,4","3,1","3,5","4,2","4,4"]),
    // 4: Twin lanes
    new Set(["0,3","1,3","2,3","4,3","5,3","6,3","0,0","6,0","0,6","6,6"]),
    // 5: Spiral-ish
    new Set(["0,0","0,5","0,6","1,0","1,6","2,6","3,0","3,6","4,0","5,0","5,6","6,0","6,1","6,6"]),
    // 6: Open coliseum
    new Set(["0,0","0,1","0,5","0,6","1,0","1,6","5,0","5,6","6,0","6,1","6,5","6,6","0,3","6,3"]),
    // 7: Hourglass
    new Set(["0,0","0,6","1,0","1,1","1,5","1,6","2,0","2,1","2,2","2,4","2,5","2,6","4,0","4,1","4,2","4,4","4,5","4,6","5,0","5,1","5,5","5,6","6,0","6,6"]),
  ];

  const ARENA_NAMES = [
    "🌸 Blossom Grove", "💎 Diamond Fields", "✝️ Crossroads",
    "🕳️ Crater Pit", "🛤️ Twin Lanes", "🌀 Spiral Ruins",
    "🏛️ Open Coliseum", "⏳ Hourglass Keep",
  ];

  let HOLE_CELLS = ARENA_LAYOUTS[0];
  let currentArenaName = ARENA_NAMES[0];

  // ── FOREST PARTICLES (pre-seeded for consistency) ─────────
  const FOREST_PARTICLES = Array.from({length: 22}, (_, i) => ({
    ox:       (i * 0.13 + Math.random() * 0.5) % 1,
    speed:    0.022 + Math.random() * 0.038,
    size:     2 + Math.random() * 3.5,
    phase:    Math.random() * Math.PI * 2,
    driftAmp: 0.04 + Math.random() * 0.07,
    type:     Math.random() < 0.55 ? "leaf" : "firefly",
    leafRot:  Math.random() * Math.PI * 2,
    leafColor: Math.random() < 0.5 ? "80,160,55" : "100,200,70",
  }));

  // ── CARD DEFINITIONS ────────────────────────────────────────
  const ALL_CARDS = [
    {
      id: "move1",
      name: "Step",
      icon: "👟",
      type: "move",
      desc: "Move 1 space",
      color: "#4cc9f0",
      move: 1,
      discard: 0,
    },
    {
      id: "move2",
      name: "Dash",
      icon: "💨",
      type: "move",
      desc: "Move 2 spaces",
      color: "#06d6a0",
      move: 2,
      discard: 1,
    },
    {
      id: "melee",
      name: "Strike",
      icon: "⚔️",
      type: "attack",
      desc: "Melee attack (range 1)\n10–30 dmg",
      color: "#f4845f",
      range: 1,
      dmgMin: 10,
      dmgMax: 30,
      discard: 1,
      targetEnemy: true,
    },
    {
      id: "ranged",
      name: "Arrow",
      icon: "🏹",
      type: "attack",
      desc: "Ranged attack (range 3)\n8–24 dmg",
      color: "#ffd60a",
      range: 3,
      dmgMin: 8,
      dmgMax: 24,
      discard: 1,
      targetEnemy: true,
    },
    {
      id: "heal",
      name: "Mend",
      icon: "💚",
      type: "heal",
      desc: "Heal yourself\n5–15 HP",
      color: "#38b000",
      healMin: 5,
      healMax: 15,
      discard: 1,
    },
    {
      id: "fireball",
      name: "Fireball",
      icon: "🔥",
      type: "aoe",
      desc: "3×3 explosion (range 3)\n25–30 dmg — hits self too!",
      color: "#ef233c",
      dmgMin: 25,
      dmgMax: 30,
      discard: 2,
      targetTile: true,
      aoeRadius: 1,
      castRange: 3,     // max manhattan distance from caster to target tile
    },
    {
      id: "wild",
      name: "Wild Card",
      icon: "🌀",
      type: "wild",
      desc: "Pick any card effect",
      color: "#c77dff",
      discard: 1,
    },
  ];

  // ── STATE ────────────────────────────────────────────────────
  let duelState = null;
  let duelCanvas, duelCtx;
  let animFrame;
  let onDuelEnd;

  // ── PUBLIC ENTRY ─────────────────────────────────────────────
  function triggerDuel(landingPlayer, allPlayers, cb) {
    onDuelEnd = cb;
    if (typeof MUSIC !== "undefined") MUSIC.playDuel();

    // Pick random arena layout
    const layoutIdx = Math.floor(Math.random() * ARENA_LAYOUTS.length);
    HOLE_CELLS = ARENA_LAYOUTS[layoutIdx];
    currentArenaName = ARENA_NAMES[layoutIdx];

    // Show spin wheels first, then start combat
    showPreDuelSpins(landingPlayer, allPlayers);
  }

  // ─────────────────────────────────────────────────────────────
  //  PRE-DUEL SPIN SEQUENCE
  // ─────────────────────────────────────────────────────────────
  let preDuelOverlay = null;

  function showPreDuelSpins(landingPlayer, allPlayers) {
    const ov = document.createElement("div");
    ov.id = "preDuelOverlay";
    document.body.appendChild(ov);
    preDuelOverlay = ov;
    showFormatWheel(landingPlayer, allPlayers);
  }

  function removePreDuelOverlay() {
    if (preDuelOverlay) { preDuelOverlay.remove(); preDuelOverlay = null; }
  }

  function showFormatWheel(landingPlayer, allPlayers) {
    const segs = [
      { label:"1v1", icon:"⚔️", color:"#f4845f" },
      { label:"2v2", icon:"🤝", color:"#c77dff" },
      { label:"1v1", icon:"⚔️", color:"#f4845f" },
      { label:"2v2", icon:"🤝", color:"#c77dff" },
      { label:"1v1", icon:"⚔️", color:"#f4845f" },
      { label:"1v1", icon:"⚔️", color:"#f4845f" },
    ];
    const result = Math.random() < 0.6 ? "1v1" : "2v2";
    const targetIdx = segs.findIndex(s => s.label === result);
    runSpinWheel(preDuelOverlay, {
      title: "⚔️ Battle Format!",
      subtitle: "What kind of duel will it be?",
      segments: segs,
      targetIndex: targetIdx,
      onResult: (seg) => {
        setTimeout(() => showBetWheel(landingPlayer, allPlayers, seg.label), 800);
      }
    });
  }

  function showBetWheel(landingPlayer, allPlayers, format) {
    const segs = [
      { label:"5",  icon:"💰", color:"#4cc9f0", bet:5  },
      { label:"10", icon:"💰", color:"#06d6a0", bet:10 },
      { label:"5",  icon:"💰", color:"#4cc9f0", bet:5  },
      { label:"15", icon:"💰", color:"#ffd60a", bet:15 },
      { label:"10", icon:"💰", color:"#06d6a0", bet:10 },
      { label:"20", icon:"🌟", color:"#ff6b9d", bet:20 },
      { label:"5",  icon:"💰", color:"#4cc9f0", bet:5  },
      { label:"10", icon:"💰", color:"#06d6a0", bet:10 },
    ];
    const targetIdx = Math.floor(Math.random() * segs.length);
    runSpinWheel(preDuelOverlay, {
      title: "🎰 Stakes!",
      subtitle: `${format} — How much is on the line?`,
      segments: segs,
      targetIndex: targetIdx,
      onResult: (seg) => {
        setTimeout(() => {
          removePreDuelOverlay();
          startActualDuel(landingPlayer, allPlayers, format, seg.bet);
        }, 800);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  GENERIC SPIN WHEEL — auto-spins immediately, no button
  // ─────────────────────────────────────────────────────────────
  function runSpinWheel(container, { title, subtitle, segments, targetIndex, onResult }) {
    container.innerHTML = "";
    const n = segments.length;
    const sliceDeg = 360 / n;
    const targetCentre = targetIndex * sliceDeg + sliceDeg / 2;
    const stopAngle = 270 - targetCentre;
    const totalSpin = 360 * 7 + ((stopAngle % 360) + 360) % 360;
    const SIZE = 300, R = SIZE / 2;

    container.innerHTML = `
      <div class="sw-backdrop">
        <div class="sw-title">${title}</div>
        <div class="sw-subtitle">${subtitle}</div>
        <div class="sw-wheel-wrap">
          <div class="sw-pointer">▼</div>
          <canvas id="swCanvas" width="${SIZE}" height="${SIZE}"></canvas>
          <div class="sw-center-dot"></div>
        </div>
        <div class="sw-result-text" id="swResult" style="opacity:0"> </div>
      </div>`;

    const canvas = container.querySelector("#swCanvas");
    const ctx    = canvas.getContext("2d");

    function drawWheel(angleDeg) {
      ctx.clearRect(0, 0, SIZE, SIZE);
      segments.forEach((seg, i) => {
        const startRad = ((angleDeg + i * sliceDeg) * Math.PI) / 180;
        const endRad   = ((angleDeg + (i+1) * sliceDeg) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(R, R);
        ctx.arc(R, R, R - 3, startRad, endRad);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.globalAlpha = 0.90; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 2; ctx.stroke();

        ctx.save();
        ctx.translate(R, R);
        ctx.rotate(((angleDeg + i * sliceDeg + sliceDeg / 2) * Math.PI) / 180);
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.font = "bold 14px 'Fredoka One',cursive";
        ctx.fillStyle = "white";
        ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 5;
        ctx.fillText(`${seg.icon} ${seg.label}`, R - 14, 0);
        ctx.restore();
      });
      ctx.beginPath();
      ctx.arc(R, R, R - 3, 0, Math.PI*2);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 5; ctx.stroke();
    }

    drawWheel(0);

    // AUTO-SPIN after a short dramatic pause
    const DURATION = 4500;
    let startTs = null;
    const easeOut = t => 1 - Math.pow(1 - t, 4);

    setTimeout(() => {
      function frame(ts) {
        if (!startTs) startTs = ts;
        const progress = Math.min((ts - startTs) / DURATION, 1);
        drawWheel(easeOut(progress) * totalSpin % 360);

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          const seg = segments[targetIndex];
          const resultEl = container.querySelector("#swResult");
          if (resultEl) {
            resultEl.textContent = `${seg.icon} ${seg.label}${seg.bet ? ` coins!` : `!`}`;
            resultEl.style.opacity = "1";
            resultEl.style.transform = "scale(1.2)";
            setTimeout(() => { if (resultEl) resultEl.style.transform = "scale(1)"; }, 200);
          }
          onResult(seg);
        }
      }
      requestAnimationFrame(frame);
    }, 600); // 600ms dramatic pause before spin starts
  }

  // ─────────────────────────────────────────────────────────────
  //  START ACTUAL DUEL — after spins resolve
  // ─────────────────────────────────────────────────────────────
  function startActualDuel(landingPlayer, allPlayers, format, betAmount) {
    const is2v2 = format === "2v2" && allPlayers.length >= 4;

    let fighters;
    if (is2v2) {
      // Team 0: You (index 0) + Her (index 1)
      // Team 1: Romeo (index 2) + Juliet (index 3)
      fighters = [
        makeFighter(allPlayers[0], 0),
        makeFighter(allPlayers[1], 0),
        makeFighter(allPlayers[2], 1),
        makeFighter(allPlayers[3], 1),
      ];
    } else {
      // 1v1: human players always fight AI, AI always fights a human
      const landingIsHuman = landingPlayer.index <= 1;
      let opponent;
      if (landingIsHuman) {
        // Human landed — pick a random AI opponent (index 2 or 3)
        const aiOpponents = allPlayers.filter(p => p.index >= 2);
        opponent = aiOpponents[Math.floor(Math.random() * aiOpponents.length)];
      } else {
        // AI landed — pick a random human opponent (index 0 or 1)
        const humanOpponents = allPlayers.filter(p => p.index <= 1);
        opponent = humanOpponents[Math.floor(Math.random() * humanOpponents.length)];
      }
      fighters = [
        makeFighter(landingPlayer, 0),
        makeFighter(opponent, 1),
      ];
    }

    fighters.forEach(f => { f.initRoll = Math.floor(Math.random()*6)+1; });
    fighters.sort((a, b) => b.initRoll - a.initRoll);
    if (fighters[0].initRoll === fighters[1].initRoll) fighters.sort(() => Math.random()-0.5);

    // Human controls all fighters on team 0
    const humanFighterIndex = fighters.findIndex(f => f.teamIndex === 0);

    duelState = {
      fighters,
      humanFighterIndex,
      humanTeam: 0,
      is2v2,
      betAmount,
      turn: 0,
      phase: "rollReveal",
      hand: [],
      selectedCard: null,
      validTargets: [],
      validTiles: [],
      wildMode: false,
      anims: [],
      floatingTexts: [],
      highlightCells: [],
      landingPlayer,
      allPlayers,
    };

    if (is2v2) {
      // Place by TEAM, not by array index — sort ruins the grouping
      const team0 = fighters.filter(f => f.teamIndex === 0);
      const team1 = fighters.filter(f => f.teamIndex === 1);
      // Team 0 (You + Her) — top-left quadrant
      placeOnGrid(team0[0], 1, 1);
      placeOnGrid(team0[1], 2, 1);
      // Team 1 (Romeo + Juliet) — bottom-right quadrant
      placeOnGrid(team1[0], GRID_ROWS-2, GRID_COLS-2);
      placeOnGrid(team1[1], GRID_ROWS-3, GRID_COLS-2);
    } else {
      placeOnGrid(fighters[0], 1, 2);
      placeOnGrid(fighters[1], GRID_ROWS-2, GRID_COLS-3);
    }

    buildDuelUI(fighters);
    dealHand();
    enterPhase("rollReveal");
  }

  // ── MAKE FIGHTER ─────────────────────────────────────────────
  function makeFighter(boardPlayer, teamIndex) {
    const baseHp   = MAX_HP + (boardPlayer.bonusMaxHp || 0);
    const duelInv  = boardPlayer.duelInventory || [];
    const extraCards    = duelInv.filter(id => id === "extraCard").length;
    const meleePowerBonus = duelInv.filter(id => id === "meleePower").length * 5;
    return {
      boardPlayer,
      name: boardPlayer.name,
      color: boardPlayer.color,
      emoji: boardPlayer.emoji,
      image: boardPlayer.image,
      hp: baseHp,
      maxHp: baseHp,
      teamIndex,
      row: 0, col: 0,
      hand: [],
      deck: shuffleDeck(boardPlayer),
      initRoll: 0,
      extraCards,
      meleePowerBonus,
    };
  }

  function shuffleDeck(boardPlayer) {
    // Start with double base deck
    const deck = [...ALL_CARDS, ...ALL_CARDS].map(c => ({...c}));
    // Add deity cards permanently (2 copies each)
    if (typeof getDeityCardsForPlayer === "function" && boardPlayer) {
      const deityCards = getDeityCardsForPlayer(boardPlayer);
      deityCards.forEach(dc => { deck.push({...dc}); deck.push({...dc}); });
    }
    for (let i = deck.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function placeOnGrid(fighter, prefRow, prefCol) {
    const visited = new Set();
    const queue = [[prefRow, prefCol]];
    while (queue.length) {
      const [r, c] = queue.shift();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
      if (!HOLE_CELLS.has(key) && !duelState.fighters.some(f => f.row===r && f.col===c && f!==fighter)) {
        fighter.row = r; fighter.col = c; return;
      }
      queue.push([r+1,c],[r-1,c],[r,c+1],[r,c-1]);
    }
    for (let r=0;r<GRID_ROWS;r++) for (let c=0;c<GRID_COLS;c++) {
      if (!HOLE_CELLS.has(`${r},${c}`)) { fighter.row=r; fighter.col=c; return; }
    }
  }

  // ── DEAL HAND ────────────────────────────────────────────────
  function dealHand() {
    const f = duelState.fighters[duelState.turn];
    f.hand = [];
    const drawCount = HAND_SIZE + (f.extraCards || 0);
    for (let i = 0; i < drawCount; i++) {
      if (f.deck.length === 0) f.deck = shuffleDeck(f.boardPlayer);
      f.hand.push(f.deck.pop());
    }
    duelState.hand = f.hand;
    duelState.selectedCard = null;
    duelState.validTargets = [];
    duelState.validTiles = [];
    renderHand();
  }

  function consumeDuelItems() {
    duelState.fighters.forEach(f => {
      const inv = f.boardPlayer.duelInventory;
      if (!inv) return;
      f.boardPlayer.duelInventory = inv.filter(id => {
        const item = CONFIG.duelShopItems && CONFIG.duelShopItems[id];
        return item && item.permanent;
      });
    });
    if (typeof updateHUD === "function") updateHUD();
  }

  // ── PHASE CONTROL ────────────────────────────────────────────
  function enterPhase(phase) {
    duelState.phase = phase;
    updateDuelUI();

    if (phase === "rollReveal") {
      showRollReveal();
    } else if (phase === "pickCard") {
      highlightCurrentFighter();
      setStatus(`${duelState.fighters[duelState.turn].name}'s turn — pick a card`);
    }
  }

  // ── ROLL REVEAL SCREEN ───────────────────────────────────────
  function showRollReveal() {
    const { fighters, is2v2, betAmount } = duelState;
    const bet = betAmount || 10;
    const box = document.getElementById("duelInitBox");
    if (!box) return;

    let matchupHTML;
    if (is2v2) {
      const teamA = fighters.filter(f => f.teamIndex === 0);
      const teamB = fighters.filter(f => f.teamIndex === 1);
      matchupHTML = `
        <div class="di-row">
          <div class="di-team">
            ${teamA.map(f=>`<div class="di-fighter">
              <div class="di-avatar" style="background:${f.color};width:62px;height:62px;font-size:34px">${f.emoji}</div>
              <div class="di-name" style="font-size:15px">${f.name}</div>
              <div class="di-roll" style="font-size:20px;padding:4px 12px">🎲 ${f.initRoll}</div>
            </div>`).join("")}
          </div>
          <div class="di-vs">VS</div>
          <div class="di-team">
            ${teamB.map(f=>`<div class="di-fighter">
              <div class="di-avatar" style="background:${f.color};width:62px;height:62px;font-size:34px">${f.emoji}</div>
              <div class="di-name" style="font-size:15px">${f.name}</div>
              <div class="di-roll" style="font-size:20px;padding:4px 12px">🎲 ${f.initRoll}</div>
            </div>`).join("")}
          </div>
        </div>`;
    } else {
      const [f0, f1] = fighters;
      matchupHTML = `
        <div class="di-row">
          <div class="di-fighter">
            <div class="di-avatar" style="background:${f0.color}">${f0.emoji}</div>
            <div class="di-name">${f0.name}</div>
            <div class="di-roll">🎲 ${f0.initRoll}</div>
          </div>
          <div class="di-vs">VS</div>
          <div class="di-fighter">
            <div class="di-avatar" style="background:${f1.color}">${f1.emoji}</div>
            <div class="di-name">${f1.name}</div>
            <div class="di-roll">🎲 ${f1.initRoll}</div>
          </div>
        </div>`;
    }

    box.innerHTML = `
      <div class="di-title">${is2v2 ? "🤝 2v2 Duel!" : "⚔️ 1v1 Duel!"}</div>
      ${matchupHTML}
      <div class="di-first">${fighters[0].name} goes first!</div>
      <div class="di-bet-badge">💰 ${bet} coins on the line!</div>
      <div class="di-arena-name">${currentArenaName}</div>
      <button class="di-btn" onclick="DUEL.startDuel()">Begin Duel!</button>
    `;
    box.style.display = "flex";
  }

  // ── CARD SELECTION ───────────────────────────────────────────
  function selectCard(handIndex) {
    // Allow re-selection while previewing a card's range (pickTile / pickTarget)
    const allowed = ["pickCard", "pickTile", "pickTarget"];
    if (!allowed.includes(duelState.phase)) return;
    if (duelState.turn !== duelState.humanFighterIndex) return;
    const card = duelState.hand[handIndex];
    if (!card) return;

    // Clicking the already-selected card cancels it and goes back to picking
    if (duelState.selectedCard?.handIndex === handIndex) {
      duelState.selectedCard = null;
      duelState.validTargets = [];
      duelState.validTiles = [];
      duelState.highlightCells = [];
      duelState.phase = "pickCard";
      setStatus(`${duelState.fighters[duelState.turn].name}'s turn — pick a card`);
      renderHand();
      updateDuelUI();
      return;
    }

    duelState.selectedCard = { card, handIndex };

    if (card.type === "wild") {
      showWildPicker();
      return;
    }
    computeValidTargets(card);
    renderHand();
    updateDuelUI();
  }

  function computeValidTargets(card) {
    const f = duelState.fighters[duelState.turn];
    duelState.validTargets = [];
    duelState.validTiles = [];
    duelState.highlightCells = [];

    if (card.type === "move") {
      const radius = card.move;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (HOLE_CELLS.has(`${r},${c}`)) continue;
          const dist = Math.abs(r - f.row) + Math.abs(c - f.col);
          if (dist > 0 && dist <= radius && !isOccupied(r, c)) {
            duelState.validTiles.push({r,c});
            duelState.highlightCells.push({r,c,color:"rgba(76,201,240,0.45)"});
          }
        }
      }
      duelState.phase = "pickTile";
      setStatus(`Pick where to move — or click another card to switch`);
    } else if (card.type === "attack") {
      const enemies = duelState.fighters.filter((_,i) => i !== duelState.turn);
      enemies.forEach(enemy => {
        const dist = Math.abs(enemy.row - f.row) + Math.abs(enemy.col - f.col);
        if (dist <= card.range) {
          const globalIdx = duelState.fighters.indexOf(enemy);
          duelState.validTargets.push(globalIdx);
          duelState.highlightCells.push({r:enemy.row, c:enemy.col, color:"rgba(239,35,60,0.45)"});
        }
      });
      duelState.phase = "pickTarget";
      setStatus(`Pick an enemy to attack — or click another card to switch`);
    } else if (card.type === "aoe") {
      const castRange = card.castRange || 99;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (HOLE_CELLS.has(`${r},${c}`)) continue;
          const dist = Math.abs(r - f.row) + Math.abs(c - f.col);
          if (dist <= castRange) {
            duelState.validTiles.push({r,c});
            duelState.highlightCells.push({r, c, color: "rgba(239,35,60,0.45)"});
          }
        }
      }
      duelState.phase = "pickTile";
      setStatus(`🔥 Fireball — pick target tile (range ${castRange})`);

    } else if (card.type === "heal") {
      playCard(card, null);
      return;
    }

    if (card.type === "attack" && duelState.validTargets.length === 0) {
      setStatus("No enemies in range! Pick another card.");
      duelState.selectedCard = null;
      duelState.phase = "pickCard";
      renderHand();
      return;
    }
    updateDuelUI();
  }

  // ── TILE / TARGET CLICK ──────────────────────────────────────
  function onGridClick(row, col) {

  // Prevent clicking while animations are happening
  if (duelState.phase === "animating") {
    return;
  }

  const phase = duelState.phase;

  if (phase === "pickTile") {

    const valid = duelState.validTiles.find(
      t => t.r === row && t.c === col
    );

    if (!valid) {
      return;
    }

    if (!duelState.selectedCard || !duelState.selectedCard.card) {
      return;
    }

    playCard(duelState.selectedCard.card, { row, col });
    return;
  }

  if (phase === "pickTarget") {

    const fi = duelState.fighters.findIndex(
      f => f.row === row && f.col === col
    );

    if (fi === -1) {
      return;
    }

    if (!duelState.validTargets.includes(fi)) {
      return;
    }

    if (!duelState.selectedCard || !duelState.selectedCard.card) {
      return;
    }

    playCard(
      duelState.selectedCard.card,
      duelState.fighters[fi]
    );
  }
}

 // ── PLAY CARD ────────────────────────────────────────────────
function playCard(card, target) {
  if (!duelState || duelState.phase === "over") return;

  duelState.phase = "animating";
  duelState.highlightCells = [];

  const f = duelState.fighters[duelState.turn];

  doDiscard(card, () => {
    switch (card.type) {
      case "move":
        doMove(f, target.row, target.col, () => afterCard());
        break;

      case "attack":
        doAttack(f, target, card, () => afterCard());
        break;

      case "aoe":
        doFireball(f, target.row, target.col, card, () => afterCard());
        break;

      case "heal":
        doHeal(f, card, () => afterCard());
        break;

      default:
        afterCard();
        break;
    }

    updateDuelUI();
  });
}

  // ── DISCARD ──────────────────────────────────────────────────
  function doDiscard(playedCard, onDone) {
    const f = duelState.fighters[duelState.turn];

    const handEntries = f.hand.map((c, i) => ({ c, i, keep: true }));

    // FIX: Ensure Wild Cards are properly targeted for discard so we don't freeze
    let pi = f.hand.indexOf(playedCard);
    if (pi === -1) pi = f.hand.findIndex(c => c.type === "wild");
    if (pi !== -1) handEntries[pi].keep = false;

    // Discard extra random cards based on card.discard value
    const eligible = handEntries.filter(e => e.keep);
    for (let i = 0; i < playedCard.discard && eligible.length > 0; i++) {
      const ri = Math.floor(Math.random() * eligible.length);
      eligible[ri].keep = false;
      eligible.splice(ri, 1);
    }

    const discardIdxArr = handEntries.filter(e => !e.keep).map(e => e.i);

    // Render hand with discarding animation on the leaving cards
    renderHandWithDiscards(f.hand, discardIdxArr);

    // After animation completes, update hand state and fire callback
    const animDelay = 480 + discardIdxArr.length * 90;
    setTimeout(() => {
      f.hand = handEntries.filter(e => e.keep).map(e => e.c);
      duelState.hand = f.hand;
      onDone && onDone();
    }, animDelay);
  }

  // ── RENDER HAND WITH DISCARD ANIMATION ──────────────────────
  function renderHandWithDiscards(hand, discardIdxArr) {
    const handEl = document.getElementById("duelHand");
    if (!handEl || !duelState) return;
    const discardSet = new Set(discardIdxArr);
    const isHumanTurn = duelState.turn === duelState.humanFighterIndex;

    handEl.innerHTML = hand.map((card, i) => {
      const isDiscarding = discardSet.has(i);
      const order = discardIdxArr.indexOf(i);
      const sel = !isDiscarding && duelState.selectedCard?.handIndex === i;
      const disabled = !isDiscarding && !isHumanTurn;

      return `<div class="dcard ${isDiscarding ? 'dcard-discarding' : ''} ${sel ? 'dcard-sel' : ''} ${disabled ? 'dcard-disabled' : ''}"
        style="--card-color:${card.color};border-color:${(sel||isDiscarding)?card.color:'rgba(255,255,255,0.2)'};${isDiscarding ? `animation-delay:${order*90}ms` : ''}"
        onclick="${(!isDiscarding && isHumanTurn) ? `DUEL.selectCard(${i})` : ''}">
        <div class="dcard-icon">${card.icon}</div>
        <div class="dcard-name" style="color:${card.color}">${card.name}</div>
        <div class="dcard-desc">${card.desc}</div>
        ${card.discard > 0
          ? `<div class="dcard-discard">-${card.discard} extra card${card.discard>1?'s':''}</div>`
          : `<div class="dcard-nodiscard">Self only</div>`}
      </div>`;
    }).join("");
  }

  // ── MOVE ANIMATION ───────────────────────────────────────────
  function doMove(fighter, toRow, toCol, cb) {
    const fromPx = cellToPx(fighter.row, fighter.col);
    const toPx   = cellToPx(toRow, toCol);
    fighter.row = toRow; fighter.col = toCol;

    addFloatText(toPx.x, toPx.y - 30, "💨 Move!", "#4cc9f0", 900);
    addAnim({
      type: "move",
      fighter,
      fromX: fromPx.x, fromY: fromPx.y,
      toX: toPx.x,     toY: toPx.y,
      t: 0, duration: 380,
      onDone: cb,
    });
  }

  // ── ATTACK ANIMATION ─────────────────────────────────────────
  function doAttack(attacker, defender, card, cb) {
    const fromPx = cellToPx(attacker.row, attacker.col);
    const toPx   = cellToPx(defender.row, defender.col);
    const isMelee  = card.id === "melee" || card.id === "bee_sting_card";
    const isRanged = card.id === "ranged";
    const meleeBonus = (isMelee && attacker.meleePowerBonus) ? attacker.meleePowerBonus : 0;
    const dmg = randInt(card.dmgMin, card.dmgMax) + meleeBonus;

    addAnim({
      type: isRanged ? "arrow" : "slash",
      fromX: fromPx.x, fromY: fromPx.y,
      toX: toPx.x,     toY: toPx.y,
      t: 0, duration: isRanged ? 500 : 300,
      onDone: () => {
        applyDamage(defender, dmg);
        addShake(defender);
        // Bee Sting recoil
        if (card.recoil && card.recoil > 0) {
          applyDamage(attacker, card.recoil);
          const apx = cellToPx(attacker.row, attacker.col);
          addFloatText(apx.x, apx.y - 40, `-${card.recoil} recoil 🐝`, "#ffd60a", 1200);
        }
        // Royal Jelly draw extra
        if (card.drawExtra && card.drawExtra > 0) {
          for (let i = 0; i < card.drawExtra; i++) {
            if (attacker.deck.length === 0) attacker.deck = shuffleDeck(attacker.boardPlayer);
            attacker.hand.push(attacker.deck.pop());
          }
          duelState.hand = attacker.hand;
          renderHand();
          addFloatText(fromPx.x, fromPx.y - 60, `+${card.drawExtra} cards 🍯`, "#ffd60a", 1400);
        }
        const dead = checkDead();
        cb && !dead && cb();
        if (dead) onFighterDead(dead);
      },
    });
  }

  // ── FIREBALL LOGIC ───────────────────────────────────────────
  function doFireball(caster, toRow, toCol, card, cb) {
  const fromPx = cellToPx(caster.row, caster.col);
  const toPx   = cellToPx(toRow, toCol);

  addAnim({
    type: "fireball",
    fromX: fromPx.x,
    fromY: fromPx.y,
    toX: toPx.x,
    toY: toPx.y,
    t: 0,
    duration: 600,
    onDone: () => {
      addAnim({
        type: "explosion",
        cx: toPx.x,
        cy: toPx.y,
        t: 0,
        duration: 450,
        onDone: () => {
          const hitCells = [];

          for (let r = toRow - 1; r <= toRow + 1; r++) {
            for (let c = toCol - 1; c <= toCol + 1; c++) {
              if (
                r >= 0 &&
                r < GRID_ROWS &&
                c >= 0 &&
                c < GRID_COLS &&
                !HOLE_CELLS.has(`${r},${c}`)
              ) {
                hitCells.push({ r, c });
              }
            }
          }

          duelState.highlightCells = hitCells.map(cell => ({
            r: cell.r,
            c: cell.c,
            color: "rgba(239,35,60,0.45)"
          }));
          updateDuelUI();

          let hitSomething = false;

          for (let i = 0; i < duelState.fighters.length; i++) {
            // Fireball hits everyone in blast radius — including the caster!
            const fighter = duelState.fighters[i];
            const inArea =
              fighter.row >= toRow - 1 &&
              fighter.row <= toRow + 1 &&
              fighter.col >= toCol - 1 &&
              fighter.col <= toCol + 1;

            if (!inArea) continue;

            hitSomething = true;

            const dmg = randInt(card.dmgMin, card.dmgMax);
            applyDamage(fighter, dmg);
            addShake(fighter);
          }

          updateHPBars();

          setTimeout(() => {
            if (!duelState) return;

            duelState.highlightCells = [];
            updateDuelUI();

            const dead = checkDead();
            if (dead) {
              onFighterDead(dead);
              return;
            }

            if (!hitSomething) {
              setStatus("Fireball hit empty ground.");
            }

            if (cb) cb();
          }, 250);
        }
      });
    }
  });
}
  

  // ── HEAL ANIMATION ───────────────────────────────────────────
  function doHeal(fighter, card, cb) {
    const heal = randInt(card.healMin, card.healMax);
    fighter.hp = Math.min(fighter.maxHp, fighter.hp + heal);
    const px = cellToPx(fighter.row, fighter.col);
    addFloatText(px.x, px.y - 40, `+${heal} HP`, "#38b000", 1200);
    // Royal Jelly: draw extra cards
    if (card.drawExtra && card.drawExtra > 0) {
      for (let i = 0; i < card.drawExtra; i++) {
        if (fighter.deck.length === 0) fighter.deck = shuffleDeck(fighter.boardPlayer);
        fighter.hand.push(fighter.deck.pop());
      }
      duelState.hand = fighter.hand;
      renderHand();
      addFloatText(px.x, px.y - 70, `+${card.drawExtra} cards 🍯`, "#ffd60a", 1400);
    }
    addAnim({
      type: "healPulse",
      fighter,
      cx: px.x, cy: px.y,
      t: 0, duration: 500,
      onDone: cb,
    });
    updateHPBars();
  }

  // ── WILD CARD ────────────────────────────────────────────────
  function showWildPicker() {
    duelState.phase = "wild";
    const box = document.getElementById("duelWildBox");
    if (!box) return;
    box.innerHTML = `<div class="wild-title">🌀 Wild Card — Choose any effect!</div>
      <div class="wild-grid">` +
      ALL_CARDS.filter(c => c.id !== "wild").map(c => `
        <div class="wild-option" onclick="DUEL.pickWild('${c.id}')" style="border-color:${c.color}">
          <span class="wild-icon">${c.icon}</span>
          <div class="wild-name" style="color:${c.color}">${c.name}</div>
          <div class="wild-desc">${c.desc}</div>
        </div>`).join("") +
      `</div>`;
    box.style.display = "flex";
  }

  function pickWild(cardId) {
    const box = document.getElementById("duelWildBox");
    if (box) box.style.display = "none";
    const card = ALL_CARDS.find(c => c.id === cardId);
    if (!card) return;
    duelState.selectedCard = { card, handIndex: duelState.selectedCard?.handIndex };
    duelState.phase = "pickCard";
    computeValidTargets(card);
  }

  // ── AFTER CARD ───────────────────────────────────────────────
  function afterCard() {
    const f = duelState.fighters[duelState.turn];
    if (f.hand.length === 0) {
      setTimeout(() => nextTurn(), 400);
    } else {
      duelState.phase = "pickCard";
      duelState.selectedCard = null;
      duelState.validTargets = [];
      duelState.validTiles = [];
      duelState.highlightCells = [];
      setStatus(`${f.name}'s turn — pick a card or End Turn`);

    // Safety cleanup
    renderHand();

    updateDuelUI();
    }
  }

  function endTurnManual() {
    if (duelState.phase !== "pickCard") return;
    if (duelState.turn !== duelState.humanFighterIndex) return;
    nextTurn();
  }

  function nextTurn() {
    let next = (duelState.turn + 1) % duelState.fighters.length;
    let safety = 0;
    while (duelState.fighters[next].hp <= 0 && safety++ < duelState.fighters.length) {
      next = (next + 1) % duelState.fighters.length;
    }
    duelState.turn = next;
    dealHand();
    enterPhase("pickCard");

    const f = duelState.fighters[duelState.turn];
    const isHumanTeamMember = duelState.is2v2
      ? f.teamIndex === (duelState.humanTeam ?? 0)
      : duelState.turn === duelState.humanFighterIndex;

    if (isHumanTeamMember) {
      duelState.humanFighterIndex = duelState.turn;
      setStatus(`${f.name}'s turn — pick a card`);
    } else {
      setStatus(`${f.name} is thinking…`);
      setTimeout(() => aiTakeTurn(), 1000);
    }
  }

  // ── AI: find best playable action from a list of cards ───────
  function findBestAction(cards, fighter, foe) {
    const dist = Math.abs(foe.row - fighter.row) + Math.abs(foe.col - fighter.col);

    // Priority 1: Attack if enemy is in range
    for (const card of cards) {
      if (card.type === "attack" && dist <= card.range) {
        return { card, target: foe };
      }
    }

    // Priority 2: AoE – always has a valid tile (center on enemy)
    for (const card of cards) {
      if (card.type === "aoe") {
        return { card, target: { row: foe.row, col: foe.col } };
      }
    }

    // Priority 3: Heal if hurt enough
    if (fighter.hp < 55) {
      for (const card of cards) {
        if (card.type === "heal") return { card, target: fighter };
      }
    }

    // Priority 4: Move toward foe using any available move card
    for (const card of cards) {
      if (card.type !== "move") continue;
      const moveTiles = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (HOLE_CELLS.has(`${r},${c}`)) continue;
          const md = Math.abs(r - fighter.row) + Math.abs(c - fighter.col);
          if (md > 0 && md <= card.move && !isOccupied(r, c)) {
            moveTiles.push({ row: r, col: c });
          }
        }
      }
      if (moveTiles.length > 0) {
        // Pick tile that gets closest to enemy
        moveTiles.sort((a, b) =>
          (Math.abs(a.row-foe.row) + Math.abs(a.col-foe.col)) -
          (Math.abs(b.row-foe.row) + Math.abs(b.col-foe.col))
        );
        return { card, target: moveTiles[0] };
      }
    }

    // Priority 5: Heal even if not hurt (better than nothing)
    for (const card of cards) {
      if (card.type === "heal") return { card, target: fighter };
    }

    return null; // Nothing playable
  }

  // ── AI TAKE TURN ─────────────────────────────────────────────
  function aiTakeTurn() {

  if (!duelState) return;
  if (duelState.turn === duelState.humanFighterIndex) return;

  const fighter = duelState.fighters[duelState.turn];
  const enemy = duelState.fighters[duelState.humanFighterIndex];

  if (!fighter || !enemy) {
    nextTurn();
    return;
  }

  let actionsTaken = 0;
  const MAX_ACTIONS = 10;

  function endAITurn() {
    setStatus(`${fighter.name} ends their turn.`);
    setTimeout(() => {
      nextTurn();
    }, 600);
  }

  function distanceToEnemy() {
    return Math.abs(fighter.row - enemy.row) + Math.abs(fighter.col - enemy.col);
  }

  function getMoveTiles(moveAmount) {

    const tiles = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {

        if (HOLE_CELLS.has(`${r},${c}`)) continue;
        if (isOccupied(r, c)) continue;

        const dist =
          Math.abs(r - fighter.row) +
          Math.abs(c - fighter.col);

        if (dist > 0 && dist <= moveAmount) {

          const enemyDist =
            Math.abs(r - enemy.row) +
            Math.abs(c - enemy.col);

          tiles.push({
            row: r,
            col: c,
            enemyDist
          });
        }
      }
    }

    return tiles;
  }

  function continueAI() {

    actionsTaken++;

    if (actionsTaken >= MAX_ACTIONS) {
      endAITurn();
      return;
    }

    setTimeout(() => {
      aiLogic();
    }, 450);
  }

  function useMoveCard(card, moveTowardEnemy = true) {

    const tiles = getMoveTiles(card.move);

    if (tiles.length === 0) {
      return false;
    }

    if (moveTowardEnemy) {
      tiles.sort((a, b) => a.enemyDist - b.enemyDist);
    } else {
      tiles.sort((a, b) => b.enemyDist - a.enemyDist);
    }

    const bestTile = tiles[0];

    duelState.selectedCard = {
      card,
      handIndex: fighter.hand.indexOf(card)
    };

    duelState.phase = "animating";

    doDiscard(card, () => {

      doMove(
        fighter,
        bestTile.row,
        bestTile.col,
        () => {

          renderHand();
          updateDuelUI();

          continueAI();
        }
      );

    });

    return true;
  }

  function useAttackCard(card) {

    const dist = distanceToEnemy();

    if (dist > card.range) {
      return false;
    }

    duelState.selectedCard = {
      card,
      handIndex: fighter.hand.indexOf(card)
    };

    duelState.phase = "animating";

    doDiscard(card, () => {

      doAttack(
        fighter,
        enemy,
        card,
        () => {

          renderHand();
          updateDuelUI();

          const dead = checkDead();

          if (dead) {
            onFighterDead(dead);
            return;
          }

          continueAI();
        }
      );

    });

    return true;
  }

  function useFireball(card) {
    // Respect castRange — don't fire if enemy is out of range
    const castRange = card.castRange || 99;
    const distToEnemy = Math.abs(enemy.row - fighter.row) + Math.abs(enemy.col - fighter.col);
    if (distToEnemy > castRange) return false;

    duelState.selectedCard = {
      card,
      handIndex: fighter.hand.indexOf(card)
    };

    duelState.phase = "animating";

    doDiscard(card, () => {

      doFireball(
        fighter,
        enemy.row,
        enemy.col,
        card,
        () => {

          renderHand();
          updateDuelUI();

          const dead = checkDead();

          if (dead) {
            onFighterDead(dead);
            return;
          }

          continueAI();
        }
      );

    });

    return true;
  }

  function useHeal(card) {

    duelState.selectedCard = {
      card,
      handIndex: fighter.hand.indexOf(card)
    };

    duelState.phase = "animating";

    doDiscard(card, () => {

      doHeal(
        fighter,
        card,
        () => {

          renderHand();
          updateDuelUI();

          continueAI();
        }
      );

    });

    return true;
  }

  function aiLogic() {

    if (!duelState) return;

    if (!fighter.hand || fighter.hand.length === 0) {
      endAITurn();
      return;
    }

    duelState.phase = "pickCard";

    const dist = distanceToEnemy();

    const moveCards =
      fighter.hand.filter(c => c.type === "move");

    const meleeCards =
      fighter.hand.filter(c =>
        c.type === "attack" &&
        c.range === 1
      );

    const rangedCards =
      fighter.hand.filter(c =>
        c.type === "attack" &&
        c.range > 1
      );

    const healCards =
      fighter.hand.filter(c =>
        c.type === "heal"
      );

    const fireballCards =
      fighter.hand.filter(c =>
        c.type === "aoe"
      );

    // LOW HP = HEAL
    if (fighter.hp <= 35 && healCards.length > 0) {

      if (useHeal(healCards[0])) {
        return;
      }
    }

    // MELEE ATTACK
    for (const melee of meleeCards) {

      if (dist <= melee.range) {

        if (useAttackCard(melee)) {
          return;
        }
      }
    }

    // RANGED ATTACK
    for (const ranged of rangedCards) {

      if (dist <= ranged.range) {

        if (useAttackCard(ranged)) {
          return;
        }
      }
    }

    // FIREBALL
    if (fireballCards.length > 0) {

      if (useFireball(fireballCards[0])) {
        return;
      }
    }

    // MOVE TOWARD ENEMY
    if (moveCards.length > 0) {

      // Retreat if low hp
      if (fighter.hp <= 25) {

        if (useMoveCard(moveCards[0], false)) {
          return;
        }
      }

      // Ranged enemies kite sometimes
      if (
        rangedCards.length > 0 &&
        dist <= 2 &&
        Math.random() < 0.45
      ) {

        if (useMoveCard(moveCards[0], false)) {
          return;
        }
      }

      // Otherwise move closer
      if (useMoveCard(moveCards[0], true)) {
        return;
      }
    }

    // LIGHT HEALING
    if (
      fighter.hp < fighter.maxHp &&
      healCards.length > 0
    ) {

      if (useHeal(healCards[0])) {
        return;
      }
    }

  function useWildCard(wildCard) {
    // Pick the best real-card effect the AI can execute right now
    const allReal = ALL_CARDS.filter(c => c.id !== "wild");
    const dist = distanceToEnemy();
    let bestReal = null;

    for (const c of allReal) {
      if (c.type === "attack" && dist <= c.range) { bestReal = c; break; }
    }
    if (!bestReal) {
      const aoe = allReal.find(c => c.type === "aoe");
      if (aoe && dist <= (aoe.castRange || 99)) bestReal = aoe;
    }
    if (!bestReal && fighter.hp < 55) bestReal = allReal.find(c => c.type === "heal") || null;
    if (!bestReal) {
      const moves = allReal.filter(c => c.type === "move").sort((a,b) => b.move-a.move);
      for (const mc of moves) {
        if (getMoveTiles(mc.move).length > 0) { bestReal = mc; break; }
      }
    }
    if (!bestReal) bestReal = allReal.find(c => c.type === "heal") || null;
    if (!bestReal) bestReal = allReal.find(c => c.type === "attack") || null;
    if (!bestReal) return false;

    const execCard = { ...bestReal, discard: wildCard.discard };
    duelState.selectedCard = { card: wildCard, handIndex: fighter.hand.indexOf(wildCard) };
    duelState.phase = "animating";

    doDiscard(wildCard, () => {
      const done = () => {
        renderHand(); updateDuelUI();
        const dead = checkDead();
        if (dead) { onFighterDead(dead); return; }
        continueAI();
      };
      if (execCard.type === "attack" && dist <= execCard.range) {
        doAttack(fighter, enemy, execCard, done);
      } else if (execCard.type === "aoe" && dist <= (execCard.castRange || 99)) {
        doFireball(fighter, enemy.row, enemy.col, execCard, done);
      } else if (execCard.type === "heal") {
        doHeal(fighter, execCard, done);
      } else if (execCard.type === "move") {
        const tiles = getMoveTiles(execCard.move);
        if (tiles.length > 0) {
          tiles.sort((a,b) => a.enemyDist - b.enemyDist);
          doMove(fighter, tiles[0].row, tiles[0].col, done);
        } else { done(); }
      } else { done(); }
    });
    return true;
  }

    // WILD CARDS — use as best real action
    const wildCards = fighter.hand.filter(c => c.type === "wild");
    for (const wc of wildCards) {
      if (useWildCard(wc)) return;
    }

    // NOTHING POSSIBLE
    endAITurn();
  }

  aiLogic();
}  // end aiTakeTurn

  // ── DAMAGE / DEATH ───────────────────────────────────────────
  function applyDamage(fighter, dmg) {
    fighter.hp = Math.max(0, fighter.hp - dmg);
    const px = cellToPx(fighter.row, fighter.col);
    addFloatText(px.x, px.y - 40, `-${dmg}`, "#ef233c", 1100);
    updateHPBars();
  }

  function checkDead() {
    return duelState.fighters.find(f => f.hp <= 0) || null;
  }

  function checkTeamWiped() {
    for (const ti of [0, 1]) {
      const members = duelState.fighters.filter(f => f.teamIndex === ti);
      if (members.every(f => f.hp <= 0)) return ti;
    }
    return null;
  }

  function onFighterDead(deadFighter) {
    const px = cellToPx(deadFighter.row, deadFighter.col);
    addFloatText(px.x, px.y - 60, "💀 KO!", "#ef233c", 2000);

    if (duelState.is2v2) {
      const wipedTeam = checkTeamWiped();
      if (wipedTeam !== null) {
        const winner = duelState.fighters.find(f => f.teamIndex !== wipedTeam && f.hp > 0);
        setTimeout(() => resolveDuel(winner, deadFighter), 1200);
      } else {
        setTimeout(() => { if (duelState && duelState.phase !== "over") nextTurn(); }, 1000);
      }
    } else {
      const winner = duelState.fighters.find(f => f !== deadFighter);
      setTimeout(() => resolveDuel(winner, deadFighter), 1200);
    }
  }

  function resolveDuel(winner, loser) {
    const PRIZE  = duelState.betAmount || 10;
    const is2v2  = duelState.is2v2;
    // Track duel win for stats
    if (winner && winner.boardPlayer && winner.boardPlayer.stats) {
      winner.boardPlayer.stats.duelsWon++;
    }
    if (is2v2) {
      const wt = duelState.fighters.filter(f=>f.teamIndex===winner.teamIndex);
      wt.forEach(f=>{ if(f!==winner&&f.boardPlayer&&f.boardPlayer.stats) f.boardPlayer.stats.duelsWon++; });
    }

    if (is2v2) {
      const winTeam  = duelState.fighters.filter(f => f.teamIndex === winner.teamIndex);
      const loseTeam = duelState.fighters.filter(f => f.teamIndex !== winner.teamIndex);
      const perPlayer = Math.max(1, Math.floor(PRIZE / 2));
      let msgs = [];
      loseTeam.forEach(lf => {
        const take = Math.min(lf.boardPlayer.coins, perPlayer);
        lf.boardPlayer.coins -= take;
        winTeam.forEach(wf => { wf.boardPlayer.coins += Math.floor(take / winTeam.length); });
        if (take > 0) msgs.push(`${lf.name} lost ${take} 💰`);
        else if (lf.boardPlayer.stars > 0) {
          lf.boardPlayer.stars--;
          winTeam[0].boardPlayer.stars++;
          msgs.push(`${lf.name} lost ⭐`);
        }
      });
      const winnerName = winTeam.map(f => f.name).join(" & ");
      showDuelResult(winner, `${winnerName} win!\n${msgs.join(", ")}`);
    } else {
      const loserBoard  = loser.boardPlayer;
      const winnerBoard = winner.boardPlayer;
      let resultMsg;
      if (loserBoard.coins >= PRIZE) {
        loserBoard.coins  -= PRIZE;
        winnerBoard.coins += PRIZE;
        resultMsg = `${winner.name} wins!\n+${PRIZE} 💰 from ${loser.name}`;
      } else if (loserBoard.coins > 0) {
        const taken = loserBoard.coins;
        winnerBoard.coins += taken;
        loserBoard.coins = 0;
        resultMsg = `${winner.name} wins!\n+${taken} 💰 (all they had)`;
      } else if (loserBoard.stars > 0) {
        loserBoard.stars--;
        winnerBoard.stars++;
        resultMsg = `${winner.name} wins!\n+1 ⭐ (no coins left!)`;
      } else {
        resultMsg = `${winner.name} wins!\n(${loser.name} had nothing…)`;
      }
      showDuelResult(winner, resultMsg);
    }
  }

  // ── UI BUILDING ──────────────────────────────────────────────
  function buildDuelUI(fighters) {
    const old = document.getElementById("duelOverlay");
    if (old) old.remove();

    const gridPxW = GRID_COLS * (CELL_SIZE + CELL_GAP) + CELL_GAP;
    const gridPxH = GRID_ROWS * (CELL_SIZE + CELL_GAP) + CELL_GAP;
    const is2v2   = duelState.is2v2;

    const teamA = fighters.filter(f => f.teamIndex === 0);
    const teamB = fighters.filter(f => f.teamIndex === 1);

    // HP bar HTML — team A on left, team B on right, separated by divider
    function hpBarHTML(f, i) {
      return `<div class="dhp-row" id="dhp-${i}">
        <div class="dhp-avatar" style="background:${f.color}">${f.emoji}</div>
        <div class="dhp-info">
          <div class="dhp-name">${f.name}</div>
          <div class="dhp-bar-bg">
            <div class="dhp-bar-fill" id="dhp-fill-${i}" style="width:100%;background:${f.color}"></div>
          </div>
          <div class="dhp-hp" id="dhp-hp-${i}">${f.hp} / ${f.maxHp}</div>
        </div>
      </div>`;
    }

    const hpBarsHTML = is2v2
      ? `${teamA.map((f,i) => hpBarHTML(f, fighters.indexOf(f))).join("")}
         <div class="dhp-divider">VS</div>
         ${teamB.map((f,i) => hpBarHTML(f, fighters.indexOf(f))).join("")}`
      : fighters.map((f,i) => hpBarHTML(f,i)).join(`<div class="dhp-divider">VS</div>`);

    // Side panel HTML — left = team A, right = team B
    function sidePanelHTML(team, side, teamFighters) {
      return `<div class="duel-side-panel dsp-${side}" id="duel-side-${side}">
        <div class="dsp-team-label">${side === "left" ? "Your Team" : "Rivals"}</div>
        ${teamFighters.map((f, fi) => `
          <div class="dsp-fighter-block">
            <div class="dsp-name" style="color:${f.color}">${f.emoji} ${f.name}</div>
            <div class="dsp-label">Buffs</div>
            <div class="dsp-buffs" id="duel-buffs-${fighters.indexOf(f)}">
              <span class="dbuff-empty">No buffs</span>
            </div>
          </div>
        `).join("")}
      </div>`;
    }

    const ov = document.createElement("div");
    ov.id = "duelOverlay";
    ov.innerHTML = `
      <div id="duelInitBox"   style="display:none;"></div>
      <div id="duelWildBox"   style="display:none;"></div>
      <div id="duelResultBox" style="display:none;"></div>

      <div id="duelMain">
        <div id="duelHpBars">${hpBarsHTML}</div>

        <div id="duelBattleRow">
          ${sidePanelHTML(0, "left",  teamA)}

          <div id="duelArena">
            <div id="duelArenaInner" style="
              position:relative;
              width:${gridPxW}px;
              height:${gridPxH}px;
              flex-shrink:0;">
              <div id="duelGrid" style="
                position:absolute; top:0; left:0;
                width:${gridPxW}px; height:${gridPxH}px;
                display:grid;
                grid-template-columns: repeat(${GRID_COLS}, ${CELL_SIZE}px);
                grid-template-rows: repeat(${GRID_ROWS}, ${CELL_SIZE}px);
                gap:${CELL_GAP}px; padding:${CELL_GAP}px; z-index:1;
              "></div>
              <canvas id="duelCanvas" width="${gridPxW}" height="${gridPxH}" style="
                position:absolute; top:0; left:0;
                width:${gridPxW}px; height:${gridPxH}px;
                z-index:2; pointer-events:none;
              "></canvas>
            </div>
          </div>

          ${sidePanelHTML(1, "right", teamB)}
        </div>

        <div id="duelControls">
          <div id="duelStatus"></div>
          <div id="duelHand"></div>
          <div id="duelActions">
            <button class="duel-btn-end" onclick="DUEL.endTurnManual()">End Turn</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    buildGridCells();
    duelCanvas = document.getElementById("duelCanvas");
    duelCtx    = duelCanvas.getContext("2d");

    requestAnimationFrame(() => {
      scaleArenaToFit(gridPxW, gridPxH);
      animFrame = requestAnimationFrame(duelLoop);
    });
  }

  function scaleArenaToFit(gridPxW, gridPxH) {
    const arena = document.getElementById("duelArena");
    const inner = document.getElementById("duelArenaInner");
    if (!arena || !inner) return;

    const arenaRect = arena.getBoundingClientRect();
    const availW = arenaRect.width  - 24;
    const availH = arenaRect.height - 24;

    const scaleX = availW / gridPxW;
    const scaleY = availH / gridPxH;
    const scale  = Math.min(scaleX, scaleY, 1);

    inner.style.transform       = `scale(${scale})`;
    inner.style.transformOrigin = "top left";

    const scaledW = gridPxW * scale;
    const scaledH = gridPxH * scale;
    inner.style.marginLeft = `${(arenaRect.width  - scaledW) / 2}px`;
    inner.style.marginTop  = `${(arenaRect.height - scaledH) / 2}px`;
  }

  function buildGridCells() {
    const grid = document.getElementById("duelGrid");
    if (!grid) return;
    grid.innerHTML = "";
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = document.createElement("div");
        if (HOLE_CELLS.has(`${r},${c}`)) {
          cell.className = "dcell hole";
        } else {
          cell.className = "dcell";
          cell.dataset.r = r;
          cell.dataset.c = c;
          cell.addEventListener("click", () => onGridClick(+cell.dataset.r, +cell.dataset.c));
        }
        grid.appendChild(cell);
      }
    }
  }

  // ── GAME LOOP ────────────────────────────────────────────────
  function duelLoop(ts) {
    if (!duelCanvas || !duelCtx) return;
    const W = duelCanvas.width, H = duelCanvas.height;
    duelCtx.clearRect(0, 0, W, H);

    drawBattlefield(W, H, ts);
    updateAndDrawAnims(ts);
    drawHighlights();
    drawFighters();
    drawFloatingTexts(ts);
    updateGridHighlights();

    animFrame = requestAnimationFrame(duelLoop);
  }

  // ── FOREST BATTLEFIELD DRAWING ───────────────────────────────
  function drawBattlefield(W, H, ts) {
    const now = ts / 1000;

    // ── Forest floor overlay ───────────────────────────────────
    const floor = duelCtx.createLinearGradient(0, 0, 0, H);
    floor.addColorStop(0,   "rgba(8, 28, 8,  0.72)");
    floor.addColorStop(0.45,"rgba(12, 40, 10, 0.58)");
    floor.addColorStop(1,   "rgba(6, 22, 5,  0.78)");
    duelCtx.fillStyle = floor;
    duelCtx.fillRect(0, 0, W, H);

    // ── Mossy clearing glow in centre ─────────────────────────
    const glow = duelCtx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W,H)*0.55);
    glow.addColorStop(0,   "rgba(255, 180, 220, 0.07)");
    glow.addColorStop(0.35,"rgba(80, 180, 60,   0.06)");
    glow.addColorStop(1,   "rgba(0,   0,   0,   0)");
    duelCtx.fillStyle = glow;
    duelCtx.fillRect(0, 0, W, H);

    // ── Tree silhouettes ──────────────────────────────────────
    drawForestEdge(W, H, now);

    // ── Ground texture — green moss + pink glow under each tile ─
    duelCtx.save();
    for (let gx = 0; gx < GRID_COLS; gx++) {
      for (let gy = 0; gy < GRID_ROWS; gy++) {
        if (HOLE_CELLS.has(`${gy},${gx}`)) continue;
        const cx = CELL_GAP + gx*(CELL_SIZE+CELL_GAP) + CELL_SIZE/2;
        const cy = CELL_GAP + gy*(CELL_SIZE+CELL_GAP) + CELL_SIZE/2;
        const r  = CELL_SIZE * 0.46;

        // Green moss base
        const alpha = 0.05 + 0.025 * Math.sin(gx*1.7 + gy*2.3);
        duelCtx.beginPath();
        duelCtx.arc(cx, cy, r, 0, Math.PI*2);
        duelCtx.fillStyle = `rgba(20, 90, 15, ${alpha})`;
        duelCtx.fill();

        // Pink shimmer — makes tiles glow cutely in the forest
        const pinkAlpha = 0.07 + 0.03 * Math.sin(gx*2.1 + gy*1.5 + now*0.4);
        const pinkGrd = duelCtx.createRadialGradient(cx, cy - r*0.2, 0, cx, cy, r);
        pinkGrd.addColorStop(0,   `rgba(255,140,190,${pinkAlpha * 1.8})`);
        pinkGrd.addColorStop(0.6, `rgba(255,100,170,${pinkAlpha})`);
        pinkGrd.addColorStop(1,   `rgba(200,60,140,0)`);
        duelCtx.beginPath();
        duelCtx.arc(cx, cy, r, 0, Math.PI*2);
        duelCtx.fillStyle = pinkGrd;
        duelCtx.fill();
      }
    }
    duelCtx.restore();

    // ── Floating leaves & fireflies ───────────────────────────
    drawForestParticles(W, H, now);

    // ── Thin mist at ground level ─────────────────────────────
    const mist = duelCtx.createLinearGradient(0, H*0.72, 0, H);
    mist.addColorStop(0, "rgba(200, 240, 210, 0)");
    mist.addColorStop(1, "rgba(200, 240, 210, 0.055)");
    duelCtx.fillStyle = mist;
    duelCtx.fillRect(0, H*0.72, W, H*0.28);
  }

  function drawForestEdge(W, H, now) {
    // ── Top row of pines ──────────────────────────────────────
    const topCount = 11;
    for (let i = 0; i < topCount; i++) {
      const x = (i / (topCount - 1)) * W;
      const sway = Math.sin(now * 0.35 + i * 0.9) * 4;
      const h = H * (0.155 + 0.04 * Math.sin(i * 1.8));
      const baseY = H * (0.17 + 0.025 * Math.sin(i * 2.4));
      const alpha = 0.52 + 0.18 * Math.sin(i * 1.1);
      drawPineTree(x + sway, baseY, h,
        i % 2 === 0 ? `rgba(6,20,6,${alpha})` : `rgba(10,32,8,${alpha})`);
    }

    // ── Left column pines ────────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const y = H * (0.22 + i * 0.135);
      const sway = Math.sin(now * 0.28 + i * 1.3) * 3;
      const h = H * (0.13 + 0.025 * Math.sin(i * 2.1));
      drawPineTree(W * 0.03 + sway, y, h, `rgba(7,22,6,0.50)`);
    }

    // ── Right column pines ───────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const y = H * (0.22 + i * 0.135);
      const sway = Math.sin(now * 0.32 + i * 1.5 + 1) * 3;
      const h = H * (0.13 + 0.025 * Math.sin(i * 1.9 + 1));
      drawPineTree(W * 0.97 + sway, y, h, `rgba(7,22,6,0.50)`);
    }
  }

  function drawPineTree(x, baseY, h, color) {
    duelCtx.fillStyle = color;
    // Trunk
    duelCtx.fillRect(x - h*0.04, baseY, h*0.08, h*0.12);
    // Three layered triangles (bottom to top)
    const layers = [
      { yOff: 0,     wMul: 0.52 },
      { yOff: 0.30,  wMul: 0.42 },
      { yOff: 0.55,  wMul: 0.28 },
    ];
    layers.forEach(({ yOff, wMul }) => {
      duelCtx.beginPath();
      duelCtx.moveTo(x,            baseY - h*(1 - yOff));
      duelCtx.lineTo(x + h*wMul,   baseY - h*yOff);
      duelCtx.lineTo(x - h*wMul,   baseY - h*yOff);
      duelCtx.closePath();
      duelCtx.fill();
    });
  }

  function drawForestParticles(W, H, now) {
    FOREST_PARTICLES.forEach(p => {
      const age = (now * p.speed + p.phase) % 1;
      const driftX = Math.sin(now * 0.4 + p.phase) * W * p.driftAmp;
      const x = ((p.ox * W + driftX) + W) % W;
      const y = H * age;
      const alpha = Math.sin(age * Math.PI) * 0.7;

      if (p.type === "leaf") {
        duelCtx.save();
        duelCtx.translate(x, y);
        duelCtx.rotate(p.leafRot + now * 1.2 + p.phase);
        duelCtx.globalAlpha = alpha * 0.65;
        duelCtx.beginPath();
        duelCtx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        duelCtx.fillStyle = `rgb(${p.leafColor})`;
        duelCtx.fill();
        duelCtx.restore();
      } else {
        // Firefly glow
        const pulse = 0.35 + 0.65 * Math.abs(Math.sin(now * 2.8 + p.phase));
        const r = p.size * 2.8;
        const grd = duelCtx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(210,255,160,${pulse * alpha * 0.95})`);
        grd.addColorStop(0.4,`rgba(150,255,100,${pulse * alpha * 0.4})`);
        grd.addColorStop(1,  "rgba(150,255,100,0)");
        duelCtx.fillStyle = grd;
        duelCtx.beginPath();
        duelCtx.arc(x, y, r, 0, Math.PI * 2);
        duelCtx.fill();
      }
    });
  }

  // ── FIX: ANIMATION SYSTEM (Resolves the Fireball hard-lock) ──
  let lastTs = 0;
  function updateAndDrawAnims(ts) {
    const dt = lastTs ? ts - lastTs : 16;
    lastTs = ts;

    const survivingAnims = [];
    const completedAnims = [];

    // 1. Process all animations
    for (const anim of duelState.anims) {
      anim.t += dt;
      const progress = Math.min(anim.t / anim.duration, 1);
      const ease = easeOutBack(progress);

      switch (anim.type) {
        case "move": {
          const x = lerp(anim.fromX, anim.toX, ease);
          const y = lerp(anim.fromY, anim.toY, ease);
          duelCtx.beginPath();
          duelCtx.arc(x, y, 12, 0, Math.PI*2);
          duelCtx.fillStyle = `rgba(76,201,240,${(1-progress)*0.5})`;
          duelCtx.fill();
          break;
        }
        case "slash": {
          const x = lerp(anim.fromX, anim.toX, ease);
          const y = lerp(anim.fromY, anim.toY, ease);
          const alpha = Math.sin(progress * Math.PI);
          duelCtx.save();
          duelCtx.globalAlpha = alpha;
          duelCtx.strokeStyle = "#ffd60a";
          duelCtx.lineWidth = 5;
          duelCtx.lineCap = "round";
          duelCtx.beginPath();
          duelCtx.moveTo(anim.fromX, anim.fromY);
          duelCtx.lineTo(x, y);
          duelCtx.stroke();
          for (let i = 0; i < 6; i++) {
            const ang = (i/6)*Math.PI*2 + progress*3;
            const r = 16 * progress;
            duelCtx.beginPath();
            duelCtx.moveTo(x, y);
            duelCtx.lineTo(x+Math.cos(ang)*r, y+Math.sin(ang)*r);
            duelCtx.stroke();
          }
          duelCtx.restore();
          break;
        }
        case "arrow": {
          const x = lerp(anim.fromX, anim.toX, ease);
          const y = lerp(anim.fromY, anim.toY, ease);
          const ang = Math.atan2(anim.toY-anim.fromY, anim.toX-anim.fromX);
          duelCtx.save();
          duelCtx.translate(x, y);
          duelCtx.rotate(ang);
          duelCtx.fillStyle = "#ffd60a";
          duelCtx.fillRect(-18, -3, 18, 6);
          duelCtx.beginPath();
          duelCtx.moveTo(0, -8); duelCtx.lineTo(14, 0); duelCtx.lineTo(0, 8);
          duelCtx.closePath(); duelCtx.fill();
          duelCtx.globalAlpha = 0.35;
          duelCtx.fillStyle = "#fff";
          duelCtx.fillRect(-34, -2, 16, 4);
          duelCtx.restore();
          break;
        }
        case "fireball": {
          const x = lerp(anim.fromX, anim.toX, ease);
          const y = lerp(anim.fromY, anim.toY, ease) - Math.sin(progress*Math.PI)*40;
          const size = 18 + progress*6;
          const grd = duelCtx.createRadialGradient(x,y,0,x,y,size*2.2);
          grd.addColorStop(0,"rgba(255,200,50,0.9)");
          grd.addColorStop(0.4,"rgba(239,35,60,0.7)");
          grd.addColorStop(1,"rgba(239,35,60,0)");
          duelCtx.beginPath();
          duelCtx.arc(x, y, size*2.2, 0, Math.PI*2);
          duelCtx.fillStyle = grd; duelCtx.fill();
          duelCtx.font = `${Math.round(size*1.6)}px serif`;
          duelCtx.textAlign = "center"; duelCtx.textBaseline = "middle";
          duelCtx.fillText("🔥", x, y);
          for (let s = 0; s < 5; s++) {
            const tp = progress - s*0.07;
            if (tp <= 0) continue;
            const sx = lerp(anim.fromX, anim.toX, Math.min(tp*1.4,1)*easeOutBack(tp));
            const sy = lerp(anim.fromY, anim.toY, Math.min(tp*1.4,1)*easeOutBack(tp)) - Math.sin(tp*Math.PI)*40;
            duelCtx.beginPath();
            duelCtx.arc(sx, sy, 4*(1-tp), 0, Math.PI*2);
            duelCtx.fillStyle = `rgba(255,140,0,${(1-tp)*0.6})`;
            duelCtx.fill();
          }
          break;
        }
        case "explosion": {
          const r1 = easeOutBack(progress) * 60;
          const r2 = easeOutBack(progress) * 90;
          const alpha = 1 - progress;
          duelCtx.beginPath();
          duelCtx.arc(anim.cx, anim.cy, r1, 0, Math.PI*2);
          duelCtx.fillStyle = `rgba(255,160,0,${alpha*0.5})`; duelCtx.fill();
          duelCtx.beginPath();
          duelCtx.arc(anim.cx, anim.cy, r2, 0, Math.PI*2);
          duelCtx.strokeStyle = `rgba(239,35,60,${alpha*0.8})`;
          duelCtx.lineWidth = 6; duelCtx.stroke();
          const emojis = ["🔥","💥","✨"];
          duelCtx.font = "24px serif";
          duelCtx.textAlign = "center"; duelCtx.textBaseline = "middle";
          for (let e = 0; e < 6; e++) {
            const ang = (e/6)*Math.PI*2 + progress*2;
            const er = r1 * 0.8;
            duelCtx.globalAlpha = alpha;
            duelCtx.fillText(emojis[e%3], anim.cx+Math.cos(ang)*er, anim.cy+Math.sin(ang)*er);
          }
          duelCtx.globalAlpha = 1;
          break;
        }
        case "healPulse": {
          const pr = easeOutBack(progress) * 50;
          duelCtx.beginPath();
          duelCtx.arc(anim.cx, anim.cy, pr, 0, Math.PI*2);
          duelCtx.strokeStyle = `rgba(56,176,0,${1-progress})`;
          duelCtx.lineWidth = 4; duelCtx.stroke();
          break;
        }
      }

      if (progress >= 1) {
        completedAnims.push(anim);
      } else {
        survivingAnims.push(anim);
      }
    }

    // 2. Overwrite the array FIRST
    duelState.anims = survivingAnims;

    // 3. NOW call onDone. This guarantees that if onDone adds a NEW animation
    // (like Fireball adding an Explosion), it correctly saves it into duelState.anims!
    completedAnims.forEach(anim => {
      if (anim.onDone) anim.onDone();
    });
  }

  function drawFighters() {
    if (!duelState) return;
    duelState.fighters.forEach((f, fi) => {
      const {x, y} = cellToPx(f.row, f.col);
      const shake = f._shake || 0;
      const sx = x + (shake ? (Math.random()-0.5)*shake : 0);
      const sy = y + (shake ? (Math.random()-0.5)*shake : 0);

      // Shadow
      duelCtx.beginPath();
      duelCtx.ellipse(sx, sy + 28, 20, 7, 0, 0, Math.PI*2);
      duelCtx.fillStyle = "rgba(0,0,0,0.30)"; duelCtx.fill();

      // Avatar circle
      const R = 26;
      duelCtx.beginPath(); duelCtx.arc(sx, sy, R, 0, Math.PI*2);
      duelCtx.fillStyle = f.color; duelCtx.fill();

      // Image or emoji
      if (f.image && f.image.complete && f.image.naturalWidth > 0 && !f.image._failed) {
        duelCtx.save();
        duelCtx.beginPath(); duelCtx.arc(sx, sy, R, 0, Math.PI*2); duelCtx.clip();
        duelCtx.drawImage(f.image, sx-R, sy-R, R*2, R*2);
        duelCtx.restore();
      } else {
        duelCtx.font = `${R*1.2}px serif`;
        duelCtx.textAlign = "center"; duelCtx.textBaseline = "middle";
        duelCtx.fillText(f.emoji, sx, sy);
      }

      // Ring (gold if current turn)
      duelCtx.beginPath(); duelCtx.arc(sx, sy, R, 0, Math.PI*2);
      const isActive = fi === duelState.turn && duelState.phase !== "over";
      duelCtx.strokeStyle = isActive ? "gold" : "rgba(255,255,255,0.4)";
      duelCtx.lineWidth = isActive ? 3.5 : 2;
      if (isActive) {
        duelCtx.setLineDash([6,4]);
        const pulse = 0.5+0.5*Math.sin(Date.now()/250);
        duelCtx.strokeStyle = `rgba(255,215,0,${0.6+pulse*0.4})`;
      }
      duelCtx.stroke();
      duelCtx.setLineDash([]);

      // HP bar under fighter
      const barW = CELL_SIZE - 8;
      const barH = 7;
      const barX = sx - barW/2;
      const barY = sy + R + 5;
      duelCtx.fillStyle = "rgba(0,0,0,0.5)";
      duelCtx.beginPath(); roundRect(duelCtx, barX, barY, barW, barH, 3); duelCtx.fill();
      const fill = Math.max(0, f.hp / f.maxHp);
      const barColor = fill > 0.5 ? "#38b000" : fill > 0.25 ? "#ffd60a" : "#ef233c";
      duelCtx.fillStyle = barColor;
      duelCtx.beginPath(); roundRect(duelCtx, barX, barY, barW*fill, barH, 3); duelCtx.fill();

      if (f._shake) f._shake = Math.max(0, f._shake - 1.2);
    });
  }

  function drawHighlights() {
    if (!duelState) return;
    const now = Date.now();
    duelState.highlightCells.forEach(h => {
      const { x, y } = cellToPx(h.r, h.c);
      const pulse = 0.5 + 0.5 * Math.sin(now / 250);
      const isFireball = h.color.includes("239,35,60") || h.color.includes("255,100,30");

      if (isFireball) {
        // Bold filled square highlight so fireball range is unmissable
        const half = (CELL_SIZE / 2) - 2;
        duelCtx.save();
        duelCtx.globalAlpha = 0.35 + pulse * 0.25;
        duelCtx.fillStyle = "#ef4444";
        duelCtx.strokeStyle = "#ff6b00";
        duelCtx.lineWidth = 3;
        duelCtx.beginPath();
        roundRect(duelCtx, x - half, y - half, half*2, half*2, 10);
        duelCtx.fill();
        duelCtx.stroke();
        // Flame emoji hint
        duelCtx.globalAlpha = 0.55 + pulse * 0.3;
        duelCtx.font = "16px serif";
        duelCtx.textAlign = "center"; duelCtx.textBaseline = "middle";
        duelCtx.fillText("🔥", x, y);
        duelCtx.restore();
      } else {
        // Normal highlight (move, attack)
        duelCtx.beginPath();
        duelCtx.arc(x, y, (CELL_SIZE / 2) - 4, 0, Math.PI * 2);
        duelCtx.fillStyle = h.color.replace("0.45", (0.25 + pulse * 0.25).toFixed(2));
        duelCtx.fill();
      }
    });
  }

  function drawFloatingTexts(ts) {
    duelState.floatingTexts = duelState.floatingTexts.filter(ft => {
      const age = ts - ft.startTs;
      if (age > ft.life) return false;
      const progress = age / ft.life;
      duelCtx.save();
      duelCtx.globalAlpha = 1 - progress;
      duelCtx.font = `bold ${ft.size||22}px 'Fredoka One', cursive`;
      duelCtx.textAlign = "center";
      duelCtx.shadowColor = "rgba(0,0,0,0.8)";
      duelCtx.shadowBlur = 6;
      duelCtx.fillStyle = ft.color;
      duelCtx.fillText(ft.text, ft.x, ft.y - progress*50);
      duelCtx.restore();
      return true;
    });
  }

  function updateGridHighlights() {
    if (!duelState) return;
    document.querySelectorAll("#duelGrid .dcell").forEach(cell => {
      const r = +cell.dataset.r, c = +cell.dataset.c;
      const isValid = duelState.validTiles.some(t=>t.r===r&&t.c===c) ||
                      duelState.fighters.some((f,fi)=>f.row===r&&f.col===c&&duelState.validTargets.includes(fi));
      cell.classList.toggle("dcell-valid", isValid);
    });
  }

  // ── HELPERS ──────────────────────────────────────────────────
  function cellToPx(row, col) {
    return {
      x: CELL_GAP + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE/2,
      y: CELL_GAP + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE/2,
    };
  }

  function isOccupied(r, c) {
    return duelState.fighters.some(f => f.row===r && f.col===c);
  }

  function addAnim(anim) { duelState.anims.push(anim); }
  function addShake(fighter) { fighter._shake = 14; }
  function addFloatText(x, y, text, color, life) {
    duelState.floatingTexts.push({x, y, text, color, life, startTs: performance.now(), size:26});
  }

  function lerp(a, b, t) { return a + (b-a)*t; }
  function easeOutBack(t) {
    const c1=1.70158, c3=c1+1;
    return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2);
  }
  function randInt(min, max) { return min + Math.floor(Math.random()*(max-min+1)); }
  function roundRect(c, x, y, w, h, r) {
    if (w < 0) w = 0;
    c.moveTo(x+r, y); c.lineTo(x+w-r, y);
    c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
    c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y);
  }

  // ── UI HELPERS ───────────────────────────────────────────────
  function renderHand() {
    const handEl = document.getElementById("duelHand");
    if (!handEl || !duelState) return;
    const f = duelState.fighters[duelState.turn];
    const isHumanTurn = duelState.turn === duelState.humanFighterIndex;

    handEl.innerHTML = f.hand.map((card, i) => {
      const sel = duelState.selectedCard?.handIndex === i;
      let desc = card.desc;
      if (card.id === "melee" && (f.meleePowerBonus || 0) > 0) {
        const lo = card.dmgMin + f.meleePowerBonus;
        const hi = card.dmgMax + f.meleePowerBonus;
        desc = `Melee attack (range 1)\n${lo}–${hi} dmg 🗡️+${f.meleePowerBonus}`;
      }
      return `<div class="dcard ${sel?"dcard-sel":""} ${!isHumanTurn?"dcard-disabled":""}"
        onclick="${isHumanTurn?`DUEL.selectCard(${i})`:""}"
        style="--card-color:${card.color};border-color:${sel?card.color:'rgba(255,255,255,0.2)'}">
        <div class="dcard-icon">${card.icon}</div>
        <div class="dcard-name" style="color:${card.color}">${card.name}</div>
        <div class="dcard-desc">${desc}</div>
        ${card.discard > 0
          ? `<div class="dcard-discard">-${card.discard} extra card${card.discard>1?'s':''}</div>`
          : `<div class="dcard-nodiscard">Self only</div>`}
      </div>`;
    }).join("");

    const endBtn = document.querySelector(".duel-btn-end");
    if (endBtn) endBtn.style.display = isHumanTurn ? "inline-block" : "none";

    updateBuffSidebars();
  }

  function updateBuffSidebars() {
    if (!duelState) return;
    duelState.fighters.forEach((f, i) => {
      const panel = document.getElementById(`duel-buffs-${i}`);
      if (!panel) return;
      const buffs = [];
      if ((f.extraCards    || 0) > 0) buffs.push({ icon:"🃏", label:`+${f.extraCards} card${f.extraCards>1?"s":""}`, color:"#c77dff" });
      if ((f.meleePowerBonus||0) > 0) buffs.push({ icon:"🗡️",  label:`+${f.meleePowerBonus} melee`, color:"#f4845f" });
      if (f.maxHp > MAX_HP)           buffs.push({ icon:"❤️‍🔥", label:`+${f.maxHp - MAX_HP} HP`,    color:"#ff6b9d" });
      panel.innerHTML = buffs.length === 0
        ? `<span class="dbuff-empty">No buffs</span>`
        : buffs.map(b => `<div class="dbuff-chip" style="border-color:${b.color}30;background:${b.color}18">
            <span class="dbuff-icon">${b.icon}</span>
            <span class="dbuff-label" style="color:${b.color}">${b.label}</span>
          </div>`).join("");
    });
  }

  function updateHPBars() {
    if (!duelState) return;
    duelState.fighters.forEach((f, i) => {
      const fill = document.getElementById(`dhp-fill-${i}`);
      const hp   = document.getElementById(`dhp-hp-${i}`);
      if (fill) fill.style.width = `${Math.max(0,(f.hp/f.maxHp)*100)}%`;
      if (hp) hp.textContent = `${Math.max(0,f.hp)} / ${f.maxHp}`;
    });
  }

  function updateDuelUI() {
    if (!duelState) return;
    renderHand();
    updateHPBars();
    duelState.fighters.forEach((f,i) => {
      const row = document.getElementById(`dhp-${i}`);
      if (row) row.classList.toggle("dhp-active", i===duelState.turn);
    });
  }

  function setStatus(msg) {
    const el = document.getElementById("duelStatus");
    if (el) el.textContent = msg;
  }

  function highlightCurrentFighter() {
    // Active ring handled in drawFighters() via canvas
  }

  function showDuelResult(winner, msg) {
    duelState.phase = "over";
    const box = document.getElementById("duelResultBox");
    if (!box) return;
    box.innerHTML = `
      <div class="dr-crown">🏆</div>
      <div class="dr-title">${winner.name} Wins!</div>
      <div class="dr-msg">${msg.replace(/\n/g,"<br>")}</div>
      <button class="di-btn" onclick="DUEL.closeDuel()">Back to Board</button>
    `;
    box.style.display = "flex";

    if (typeof updateHUD === "function") updateHUD();
  }

  function closeDuel() {
    if (typeof MUSIC !== "undefined") MUSIC.playBoard();
    cancelAnimationFrame(animFrame);
    const ov = document.getElementById("duelOverlay");
    if (ov) {
      ov.classList.add("duel-fade-out");
      setTimeout(() => { ov.remove(); if (onDuelEnd) onDuelEnd(); }, 500);
    } else {
      if (onDuelEnd) onDuelEnd();
    }
    duelState  = null;
    duelCanvas = null;
    duelCtx    = null;
    lastTs     = 0;
  }

  // ── PUBLIC API ───────────────────────────────────────────────
  return {
    trigger: triggerDuel,
    selectCard,
    endTurnManual,
    pickWild,
    startDuel() {
      const box = document.getElementById("duelInitBox");
      if (box) box.style.display = "none";
      consumeDuelItems();
      enterPhase("pickCard");
      const f = duelState.fighters[duelState.turn];
      const isHuman = duelState.is2v2
        ? f.teamIndex === (duelState.humanTeam ?? 0)
        : duelState.turn === duelState.humanFighterIndex;
      if (!isHuman) {
        setStatus(`${f.name} is thinking…`);
        setTimeout(() => aiTakeTurn(), 1000);
      }
    },
    closeDuel,
  };

})(); // end IIFE

// ── HOOK INTO game.js ────────────────────────────────────────
function triggerDuel(landingPlayer, allPlayers, cb) {
  DUEL.trigger(landingPlayer, allPlayers, cb);
}