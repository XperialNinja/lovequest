// ============================================================
//  LOVEQUEST — deity.js
//  The Bee Deity event: triggers at round 7, transforms one
//  board space, greets whoever lands on it, offers 3 boons.
// ============================================================

// ── STATE ────────────────────────────────────────────────────
let deityNodeId   = null;   // which board node is the deity space
let deityConsumed = false;  // once a boon is taken, deity vanishes

// Boon IDs — stored on player.deityBoons[]
const BOON_STING   = "bee_sting";     // duel cards
const BOON_HONEY   = "bee_honey";     // double blue coins
const BOON_ROYAL   = "bee_royal";     // +1 star now

// The two permanent duel cards added by Boon 1
const DEITY_CARDS = {
  bee_sting_card: {
    id:      "bee_sting_card",
    name:    "Bee Sting",
    icon:    "🐝",
    type:    "attack",
    desc:    "Deal 40–60 dmg — but 15 recoil to self!",
    color:   "#ffd60a",
    range:   1,
    dmgMin:  40,
    dmgMax:  60,
    recoil:  15,
    discard: 1,
    targetEnemy: true,
    deity:   true,
  },
  bee_heal_card: {
    id:      "bee_heal_card",
    name:    "Royal Jelly",
    icon:    "🍯",
    type:    "heal",
    desc:    "Heal 20–30 HP and draw 2 extra cards!",
    color:   "#f4845f",
    healMin: 20,
    healMax: 30,
    drawExtra: 2,
    discard: 1,
    deity:   true,
  },
};

// ── ROUND 7 TRIGGER ─────────────────────────────────────────
// Called from endTurn when round becomes 7
function triggerDeityArrival() {
  if (deityNodeId || deityConsumed) return;

  // Pick a random non-special board node to become the deity space
  const candidates = BOARD_NODES.filter(n =>
    !["star","shop","duelshop","start"].includes(n.type) && n.id !== starNodeId
  );
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  deityNodeId = picked.id;
  picked._originalType = picked.type;
  picked.type = "deity";
  boardDirty = true;

  // Dramatic announcement — cinematic overlay
  showDeityArrivalCinematic(picked);
}

// ── ARRIVAL CINEMATIC ────────────────────────────────────────
function showDeityArrivalCinematic(node) {
  const ov = document.createElement("div");
  ov.id = "deityArrivalOv";
  ov.style.cssText = `
    position:fixed;inset:0;z-index:600;
    background:rgba(0,0,0,0);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Fredoka One',cursive;color:white;
    transition:background .8s;pointer-events:none;overflow:hidden;`;
  document.body.appendChild(ov);

  // Honey-drip particle canvas
  const pc = document.createElement("canvas");
  pc.style.cssText = "position:absolute;inset:0;pointer-events:none;";
  pc.width = window.innerWidth; pc.height = window.innerHeight;
  ov.appendChild(pc);
  const pctx = pc.getContext("2d");
  const drops = Array.from({length:60}, () => ({
    x: Math.random()*pc.width,
    y: -20 - Math.random()*200,
    vy: 1.5 + Math.random()*2.5,
    r: 3 + Math.random()*6,
    hue: 35 + Math.random()*20,
  }));

  // Content
  const content = document.createElement("div");
  content.style.cssText = `
    position:relative;z-index:2;text-align:center;
    opacity:0;transition:opacity 1s;transform:translateY(30px);
    transition:opacity 1s,transform 1s;`;
  content.innerHTML = `
    <div style="font-size:100px;filter:drop-shadow(0 0 40px #ffd60a);animation:deityFloat 2s ease-in-out infinite;">🐝</div>
    <div style="font-size:36px;color:#ffd60a;text-shadow:0 0 30px #ffd60a;margin:10px 0">THE BEE DEITY ARRIVES</div>
    <div style="font-size:18px;opacity:.7;margin-bottom:8px">Round 7 — A divine presence descends…</div>
    <div style="font-size:16px;color:#ffd60a;opacity:.6">A sacred space has been claimed on the board</div>`;
  ov.appendChild(content);

  // CSS animation
  if (!document.getElementById("deityStyle")) {
    const st = document.createElement("style");
    st.id = "deityStyle";
    st.textContent = `
      @keyframes deityRiseIn { from{opacity:0;transform:translateY(60px) translateX(-50%)} to{opacity:1;transform:translateY(0) translateX(-50%)} }
      @keyframes deityFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
      @keyframes deityHexPulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.7;transform:scale(1.08)} }
      @keyframes boonPop { 0%{transform:scale(.88);opacity:0} 60%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }
      @keyframes deityTextIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      @keyframes deityShimmer { 0%,100%{text-shadow:0 0 20px #ffd60a,0 0 40px #ffd60a} 50%{text-shadow:0 0 40px #ff8c00,0 0 80px #ffd60a} }
      @keyframes deityRiseIn { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
    `;
    document.head.appendChild(st);
  }

  // Honey drop animation loop
  let animRunning = true;
  const animDrops = () => {
    if (!animRunning) return;
    pctx.clearRect(0,0,pc.width,pc.height);
    drops.forEach(d => {
      d.y += d.vy;
      if (d.y > pc.height + 20) { d.y = -20; d.x = Math.random()*pc.width; }
      pctx.beginPath();
      // Teardrop shape
      pctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
      pctx.fillStyle = `hsla(${d.hue},100%,60%,0.7)`;
      pctx.fill();
    });
    requestAnimationFrame(animDrops);
  };
  animDrops();

  // Fade in
  requestAnimationFrame(() => {
    ov.style.background = "rgba(0,0,0,0.88)";
    setTimeout(() => {
      content.style.opacity = "1";
      content.style.transform = "translateY(0)";
    }, 400);
  });

  // Auto-dismiss after 4s
  setTimeout(() => {
    animRunning = false;
    ov.style.opacity = "0";
    ov.style.transition = "opacity .8s";
    setTimeout(() => {
      ov.remove();
      // Pan camera to deity node
      const n = NODE_MAP[deityNodeId];
      if (n && typeof camera !== "undefined") {
        camera.x = n.x; camera.y = n.y;
      }
      showToast("🐝 The Bee Deity awaits… land on the golden ✨ space!", 4000);
    }, 800);
  }, 4000);
}

// ── LANDING HANDLER ──────────────────────────────────────────
function handleDeityLanding(player, onDone) {
  if (deityConsumed) { onDone(); return; }
  showDeityDialogue(player, onDone);
}

// ── DEITY DIALOGUE ───────────────────────────────────────────
function showDeityDialogue(player, onDone) {
  const W = window.innerWidth, H = window.innerHeight;

  const ov = document.createElement("div");
  ov.id = "deityDialogueOv";
  ov.style.cssText = `
    position:fixed;inset:0;z-index:700;
    background:rgba(0,0,0,0.88);
    font-family:'Fredoka One',cursive;color:white;
    overflow:hidden;opacity:0;transition:opacity .5s;`;
  document.body.appendChild(ov);

  // Honeycomb BG
  const hc = document.createElement("canvas");
  hc.style.cssText = "position:absolute;inset:0;opacity:.07;pointer-events:none;";
  hc.width = W; hc.height = H;
  drawHoneycombBG(hc);
  ov.appendChild(hc);

  // Ambient glow pulse on the BG
  const ambientGlow = document.createElement("div");
  ambientGlow.style.cssText = `
    position:absolute;bottom:-10%;left:50%;transform:translateX(-50%);
    width:70%;height:60%;
    background:radial-gradient(ellipse at 50% 100%, #ffd60a22 0%, transparent 70%);
    animation:deityFloat 3s ease-in-out infinite;pointer-events:none;`;
  ov.appendChild(ambientGlow);

  const deityImg  = CONFIG.deity?.imagePath || "";
  const deityGlow = CONFIG.deity?.glowColor || "#ffd60a";
  const deityName = CONFIG.deity?.name      || "THE BEE DEITY";

  // ── PORTRAIT — full height, slightly off-centre left, cuts off at bottom like Hades ──
  const portraitWrap = document.createElement("div");
  portraitWrap.id = "deityPortraitWrap";
  portraitWrap.style.cssText = `
    position:absolute;
    bottom:-60px; left:50%; transform:translateX(-50%);
    width:min(520px, 72vw);
    z-index:3;
    animation:deityRiseIn .9s cubic-bezier(.22,1,.36,1) both;
    pointer-events:none;`;

  // Glow halo behind portrait
  const halo = document.createElement("div");
  halo.style.cssText = `
    position:absolute;bottom:60px;left:50%;transform:translateX(-50%);
    width:120%;height:80%;
    background:radial-gradient(ellipse at 50% 80%, ${deityGlow}40 0%, ${deityGlow}10 40%, transparent 70%);
    animation:deityFloat 3s ease-in-out infinite;`;
  portraitWrap.appendChild(halo);

  if (deityImg) {
    const img = document.createElement("img");
    img.src = deityImg;
    img.style.cssText = `
      width:100%;display:block;
      object-fit:contain;object-position:bottom;
      filter:drop-shadow(0 0 40px ${deityGlow}) drop-shadow(0 0 15px ${deityGlow}88);
      animation:deityFloat 3s ease-in-out infinite;`;
    portraitWrap.appendChild(img);
  } else {
    const emoji = document.createElement("div");
    emoji.style.cssText = `
      font-size:min(260px,38vw);text-align:center;line-height:1;
      filter:drop-shadow(0 0 50px ${deityGlow}) drop-shadow(0 0 20px #ff8c00);
      animation:deityFloat 3s ease-in-out infinite;`;
    emoji.textContent = "🐝";
    portraitWrap.appendChild(emoji);
  }
  ov.appendChild(portraitWrap);

  // ── NAME — top centre ──
  const namePlate = document.createElement("div");
  namePlate.style.cssText = `
    position:absolute;top:28px;left:50%;transform:translateX(-50%);
    z-index:4;text-align:center;
    font-size:clamp(18px,2.2vw,28px);
    color:${deityGlow};
    letter-spacing:4px;text-transform:uppercase;
    animation:deityShimmer 2.5s ease-in-out infinite;
    text-shadow:0 0 24px ${deityGlow}88;
    white-space:nowrap;`;
  namePlate.textContent = deityName;
  ov.appendChild(namePlate);

  // ── SPEECH BOX — pinned to bottom, Hades-style ──
  const speechBox = document.createElement("div");
  speechBox.id = "deitySpeechBox";
  speechBox.style.cssText = `
    position:absolute;bottom:0;left:0;right:0;z-index:5;
    padding:22px 32px 28px;
    background:linear-gradient(0deg, rgba(5,3,0,0.97) 60%, rgba(5,3,0,0) 100%);
    border-top:1px solid ${deityGlow}33;`;

  const speakerLabel = document.createElement("div");
  speakerLabel.style.cssText = `
    font-size:13px;color:${deityGlow};opacity:.7;
    letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;`;
  speakerLabel.textContent = deityName;
  speechBox.appendChild(speakerLabel);

  const textEl = document.createElement("div");
  textEl.id = "deityText";
  textEl.style.cssText = `
    font-size:clamp(15px,1.8vw,20px);line-height:1.7;
    color:rgba(255,255,255,.94);min-height:2.4em;
    font-family:'Nunito',sans-serif;`;
  speechBox.appendChild(textEl);

  const skipHint = document.createElement("div");
  skipHint.style.cssText = `
    font-size:12px;opacity:.3;margin-top:10px;text-align:right;
    font-family:'Nunito',sans-serif;`;
  skipHint.textContent = "Click to continue…";
  speechBox.appendChild(skipHint);

  ov.appendChild(speechBox);

  // ── TYPEWRITER ──
  const lines = [
    `Ahhh… ${player.name}. I have been expecting you. 🐝`,
    `The hive hums with your destiny. Choose wisely, little one…`,
    `A boon, granted once — to whomever stands here first.`,
  ];
  let lineIdx = 0;
  let typeIv = null;
  let lineComplete = false;

  function typewriteLine(line, cb) {
    textEl.textContent = "";
    lineComplete = false;
    let i = 0;
    typeIv = setInterval(() => {
      textEl.textContent += line[i++];
      if (i >= line.length) {
        clearInterval(typeIv); typeIv = null;
        lineComplete = true;
        setTimeout(cb, 900);
      }
    }, 26);
  }

  function showNextLine() {
    if (lineIdx < lines.length) typewriteLine(lines[lineIdx++], showNextLine);
    else setTimeout(() => transitionToBoons(ov, player, onDone, portraitWrap, speechBox), 300);
  }

  // Click skips current line or advances
  speechBox.addEventListener("click", () => {
    if (typeIv) { clearInterval(typeIv); typeIv = null; textEl.textContent = lines[lineIdx-1]; lineComplete = true; }
    else if (lineComplete && lineIdx < lines.length) showNextLine();
    else if (lineComplete && lineIdx >= lines.length) transitionToBoons(ov, player, onDone, portraitWrap, speechBox);
  });

  requestAnimationFrame(() => { ov.style.opacity = "1"; });
  setTimeout(showNextLine, 700);
}

// ── TRANSITION: portrait shrinks to top-left, boons slide up ──
function transitionToBoons(ov, player, onDone, portraitWrap, speechBox) {
  const deityGlow = CONFIG.deity?.glowColor || "#ffd60a";

  // Shrink portrait to top-left corner
  portraitWrap.style.transition = "all .65s cubic-bezier(.22,1,.36,1)";
  portraitWrap.style.bottom = "auto";
  portraitWrap.style.top = "0px";
  portraitWrap.style.left = "0px";
  portraitWrap.style.transform = "none";
  portraitWrap.style.width = "min(180px,22vw)";

  // Fade out speech box
  speechBox.style.transition = "opacity .4s";
  speechBox.style.opacity = "0";

  setTimeout(() => {
    speechBox.remove();
    showBoons(ov, player, onDone);
  }, 500);
}

// ── BOON SELECTION ───────────────────────────────────────────
function showBoons(ov, player, onDone) {
  const isAI = player.index >= 2;
  const deityGlow = CONFIG.deity?.glowColor || "#ffd60a";

  const boonData = [
    {
      id: BOON_STING,
      icon: "🐝⚔️",
      name: "Bee's Wrath",
      desc: "Gain 2 deity duel cards permanently:\n🐝 Bee Sting — massive melee dmg (15 recoil to self)\n🍯 Royal Jelly — heal 20–30 HP + draw 2 cards",
      color: "#ff8c00",
      glow: "#ff8c00",
    },
    {
      id: BOON_HONEY,
      icon: "💰🍯",
      name: "Honey Flood",
      desc: "From now on:\n💰 Blue spaces give +6 coins (double) for you\n💸 Red spaces give +3 coins instead of −3",
      color: "#ffd60a",
      glow: "#ffd60a",
    },
    {
      id: BOON_ROYAL,
      icon: "⭐👑",
      name: "Royal Favour",
      desc: "Immediately gain +1 Star.\nNo cost. No conditions. Divine gift.",
      color: "#c77dff",
      glow: "#c77dff",
    },
  ];

  // Boons panel — right side, vertically centred
  const boonsEl = document.createElement("div");
  boonsEl.style.cssText = `
    position:absolute;
    top:50%;right:0;
    transform:translate(100%,-50%);
    z-index:4;
    width:min(420px,52vw);
    padding:0 24px 0 0;
    display:flex;flex-direction:column;gap:14px;
    transition:transform .55s cubic-bezier(.22,1,.36,1);`;

  const heading = document.createElement("div");
  heading.style.cssText = `
    font-size:clamp(16px,1.8vw,22px);
    color:${deityGlow};letter-spacing:2px;
    margin-bottom:4px;text-align:center;`;
  heading.textContent = "✨  Choose Your Boon  ✨";
  boonsEl.appendChild(heading);

  boonData.forEach((b, i) => {
    const card = document.createElement("div");
    card.style.cssText = `
      background:rgba(8,5,0,0.85);
      border:1.5px solid ${b.color}55;
      border-left:3px solid ${b.color};
      border-radius:14px;padding:14px 18px;
      cursor:pointer;
      animation:boonPop .4s ease-out ${i*0.12+0.1}s both;
      transition:background .18s,border-color .18s,transform .14s,box-shadow .18s;
      display:flex;align-items:center;gap:14px;`;

    card.innerHTML = `
      <div style="font-size:34px;flex-shrink:0;filter:drop-shadow(0 0 10px ${b.glow});">${b.icon}</div>
      <div style="flex:1;">
        <div style="font-size:clamp(14px,1.5vw,18px);color:${b.color};margin-bottom:3px;">${b.name}</div>
        <div style="font-size:clamp(11px,1.1vw,13px);opacity:.72;line-height:1.5;white-space:pre-line;font-family:'Nunito',sans-serif;">${b.desc}</div>
      </div>
      <div style="font-size:22px;opacity:.25;flex-shrink:0;">›</div>`;

    card.onmouseenter = () => {
      card.style.background = `rgba(${hexToRgb(b.color)},0.14)`;
      card.style.borderColor = b.color;
      card.style.borderLeftColor = b.color;
      card.style.transform = "translateX(-4px)";
      card.style.boxShadow = `0 0 20px ${b.color}33`;
    };
    card.onmouseleave = () => {
      card.style.background = "rgba(8,5,0,0.85)";
      card.style.borderColor = `${b.color}55`;
      card.style.borderLeftColor = b.color;
      card.style.transform = "";
      card.style.boxShadow = "";
    };
    card.onclick = () => applyBoon(ov, player, b, onDone);
    boonsEl.appendChild(card);
  });

  ov.appendChild(boonsEl);
  // Slide in from right
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      boonsEl.style.transform = "translate(0,-50%)";
    });
  });

  if (isAI) {
    const aiPick = boonData[Math.floor(Math.random() * boonData.length)];
    setTimeout(() => applyBoon(ov, player, aiPick, onDone), 2200);
  }
}

// ── APPLY BOON ───────────────────────────────────────────────
function applyBoon(ov, player, boon, onDone) {
  if (deityConsumed) return;
  deityConsumed = true;

  // Remove deity space from board
  const node = NODE_MAP[deityNodeId];
  if (node) {
    node.type = node._originalType || "blue";
    delete node._originalType;
  }
  boardDirty = true;

  // Grant the boon
  if (!player.deityBoons) player.deityBoons = [];
  player.deityBoons.push(boon.id);

  if (boon.id === BOON_STING) {
    // Add two permanent deity duel cards to player
    if (!player.deityCards) player.deityCards = [];
    player.deityCards.push("bee_sting_card", "bee_heal_card");
    showToast(`🐝 ${player.name} gains the Bee Sting & Royal Jelly cards!`, 3500);
  } else if (boon.id === BOON_HONEY) {
    showToast(`🍯 ${player.name}'s coin spaces are blessed by the hive!`, 3500);
  } else if (boon.id === BOON_ROYAL) {
    player.stars++;
    if (typeof relocateStar === "function") relocateStar();
    showToast(`👑 ${player.name} receives a divine star!`, 3500);
  }

  if (typeof updateHUD === "function") updateHUD();

  // Boon grant animation
  const flash = document.createElement("div");
  flash.style.cssText = `
    position:absolute;inset:0;z-index:10;
    background:radial-gradient(circle at 50% 40%, ${boon.glow}55 0%, transparent 70%);
    animation:boonPop .5s ease-out forwards;pointer-events:none;`;
  ov.appendChild(flash);

  // Show confirmation text
  const conf = document.createElement("div");
  conf.style.cssText = `
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    z-index:11;text-align:center;pointer-events:none;
    animation:boonPop .4s ease-out forwards;`;
  conf.innerHTML = `
    <div style="font-size:70px;filter:drop-shadow(0 0 30px ${boon.glow});">${boon.icon}</div>
    <div style="font-size:26px;color:${boon.color};margin-top:8px;">${boon.name}</div>
    <div style="font-size:15px;opacity:.7;margin-top:6px;">Boon granted to ${player.name}!</div>
    <div style="font-size:13px;color:#ffd60a;margin-top:4px;">The deity departs… 🐝</div>`;
  ov.appendChild(conf);

  setTimeout(() => {
    ov.style.opacity = "0";
    ov.style.transition = "opacity .8s";
    setTimeout(() => { ov.remove(); onDone(); }, 800);
  }, 2200);
}

// ── HONEYCOMB BG DRAW ────────────────────────────────────────
function drawHoneycombBG(canvas) {
  const ctx = canvas.getContext("2d");
  const size = 36, W = canvas.width, H = canvas.height;
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

// ── DRAW DEITY SPACE ON BOARD ────────────────────────────────
// Called from game.js drawSpace when node.type === "deity"
function drawDeitySpace(node, c) {
  const R = 32; // slightly larger
  const pulse = 0.5 + 0.5 * Math.sin((typeof frameTime !== "undefined" ? frameTime : Date.now()) / 300);

  // Outer glow rings
  c.beginPath(); c.arc(node.x, node.y, R + 14 + pulse*8, 0, Math.PI*2);
  c.strokeStyle = `rgba(255,214,10,${0.35+pulse*0.4})`; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.arc(node.x, node.y, R + 24 + pulse*4, 0, Math.PI*2);
  c.strokeStyle = `rgba(255,140,0,${0.15+pulse*0.2})`; c.lineWidth = 2; c.stroke();

  // Shadow
  c.beginPath(); c.arc(node.x, node.y+5, R, 0, Math.PI*2);
  c.fillStyle = "rgba(0,0,0,0.4)"; c.fill();

  // Body — gold gradient
  const grad = c.createRadialGradient(node.x-R*.2, node.y-R*.2, 2, node.x, node.y, R);
  grad.addColorStop(0, "#ffe566");
  grad.addColorStop(0.6, "#ffd60a");
  grad.addColorStop(1, "#ff8c00");
  c.beginPath(); c.arc(node.x, node.y, R, 0, Math.PI*2);
  c.fillStyle = grad; c.fill();
  c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 2.5; c.stroke();

  // Honeycomb pattern overlay
  c.save(); c.beginPath(); c.arc(node.x, node.y, R-2, 0, Math.PI*2); c.clip();
  c.globalAlpha = 0.12;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const hx = node.x - R + i*20 - 5, hy = node.y - R + j*20 - 5;
    c.strokeStyle = "#fff"; c.lineWidth = 1;
    c.beginPath();
    for (let k=0;k<6;k++){
      const a=Math.PI/180*(60*k-30);
      k===0?c.moveTo(hx+8*Math.cos(a),hy+8*Math.sin(a)):c.lineTo(hx+8*Math.cos(a),hy+8*Math.sin(a));
    }
    c.closePath(); c.stroke();
  }
  c.restore(); c.globalAlpha = 1;

  // Bee emoji
  c.font = `${Math.round(R*0.9)}px serif`;
  c.textAlign = "center"; c.textBaseline = "alphabetic";
  c.shadowColor = "rgba(0,0,0,0.8)"; c.shadowBlur = 6;
  c.fillText("🐝", node.x, node.y + R*0.32);
  c.shadowBlur = 0;
}

// ── BOON: COIN MODIFIER ─────────────────────────────────────
// Call this from handleLanding instead of directly modifying coins
function deityApplyCoinChange(player, baseAmount) {
  if (!player.deityBoons || !player.deityBoons.includes(BOON_HONEY)) {
    return baseAmount; // no boon — normal
  }
  // Blue spaces (+3): doubled → +6
  // Red spaces (-3): reversed → +3
  if (baseAmount > 0) return baseAmount * 2;
  if (baseAmount < 0) return Math.abs(baseAmount); // loss → gain
  return baseAmount;
}

// ── DUEL INTEGRATION ────────────────────────────────────────
// Called from duel.js shuffleDeck to inject deity cards into deck
function getDeityCardsForPlayer(boardPlayer) {
  if (!boardPlayer || !boardPlayer.deityCards) return [];
  return boardPlayer.deityCards.map(id => DEITY_CARDS[id]).filter(Boolean);
}

// ── HUD BOON DISPLAY ────────────────────────────────────────
function getPlayerBoonHtml(player) {
  if (!player.deityBoons || player.deityBoons.length === 0) return "";
  const boonInfo = {
    [BOON_STING]: { icon:"🐝⚔️", label:"Bee's Wrath", color:"#ff8c00" },
    [BOON_HONEY]: { icon:"🍯💰", label:"Honey Flood",  color:"#ffd60a" },
    [BOON_ROYAL]: { icon:"⭐👑", label:"Royal Favour", color:"#c77dff" },
  };
  return player.deityBoons.map(id => {
    const b = boonInfo[id]; if (!b) return "";
    return `<span class="inv-item inv-deity" title="Deity Boon: ${b.label}" style="color:${b.color}">${b.icon}</span>`;
  }).join("");
}

// ── UTILITY ─────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}