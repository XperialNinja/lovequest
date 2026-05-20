// ============================================================
//  LOVEQUEST CONFIG  –  edit this file to customise your game
// ============================================================

const CONFIG = {

  // ── COUPLE INFO ──────────────────────────────────────────
  couple: {
    player1: {
      name: "Lanlanland",
      // Drop your PNG into assets/ and update the path:
      imagePath: "DinoCharacter.png",
      color: "#9e15c0",
      emoji: "💙",
    },
    player2: {
      name: "Merryberry",
      imagePath: "Meredith.png",
      color: "#e936da",
      emoji: "💜",
    },
    ai1: {
      name: "Romeo",
      imagePath: "BlueHatMale.png",
      color: "#1a6a8a",
      emoji: "💛",
    },
    ai2: {
      name: "Juliet",
      imagePath: "CaitFemale.png",
      color: "#06d664",
      emoji: "💚",
    },
  },

  // ── GAME SETTINGS ────────────────────────────────────────
  game: {
    totalRounds: 21,  // 21 rounds 💖
    diceMin: 1,
    diceMax: 6,
    starsToWin: 3,
    starCost: 20,           // coins needed to buy a star
    startingCoins: 10,
  },

  // ── BOARD SPACES ─────────────────────────────────────────
  // Types: "blue" | "red" | "star" | "event" | "heart" | "duel" | "shop" | "duelshop"
  spaceColors: {
    blue:     { bg: "#4cc9f0", label: "+3 coins",    icon: "💰" },
    red:      { bg: "#ef233c", label: "-3 coins",    icon: "💸" },
    star:     { bg: "#ffd60a", label: "Buy a Star!", icon: "⭐" },
    event:    { bg: "#c77dff", label: "Love Event",  icon: "💌" },
    heart:    { bg: "#ff6b9d", label: "+1 Star!",    icon: "💖" },
    minigame: { bg: "#a855f7", label: "Mini Game!",  icon: "🎮" },
    deity:    { bg: "#ffd60a", label: "Bee Deity!",   icon: "🐝" },
    duel:     { bg: "#f4845f", label: "Duel!",       icon: "⚔️"  },
    start:    { bg: "#06d6a0", label: "START",       icon: "🏠" },
    shop:     { bg: "#38b000", label: "Board Shop",  icon: "🛒" },
    duelshop: { bg: "#7209b7", label: "Duel Shop",   icon: "⚗️"  },
  },

  // ── SHOP ITEMS (Board Shop) ───────────────────────────────
  shopItems: {
    doubleDice: {
      id: "doubleDice",
      name: "Double Dice",
      icon: "🎲🎲",
      desc: "Roll 2 dice & add them!",
      cost: 8,
    },
    smallTeleport: {
      id: "smallTeleport",
      name: "Teleport",
      icon: "✨",
      desc: "Jump 10+ spaces ahead!",
      cost: 12,
    },
    boost: {
      id: "boost",
      name: "Boost",
      icon: "🚀",
      desc: "+2 added to your roll",
      cost: 5,
    },
  },

  // ── DUEL SHOP ITEMS ───────────────────────────────────────────
  // Stored on boardPlayer.duelInventory[]
  // Applied at the start of the next duel, then consumed (except permHP)
  duelShopItems: {
    extraCard: {
      id: "extraCard",
      name: "Extra Card",
      icon: "🃏",
      desc: "+1 card drawn this duel (stackable)",
      cost: 8,
      permanent: false,   // consumed after one duel
    },
    meleePower: {
      id: "meleePower",
      name: "Melee Power",
      icon: "🗡️",
      desc: "+5 melee damage this duel",
      cost: 10,
      permanent: false,
    },
    permHP: {
      id: "permHP",
      name: "Iron Body",
      icon: "❤️‍🔥",
      desc: "+10 max HP permanently",
      cost: 15,
      permanent: true,    // stays forever, applied to boardPlayer.bonusMaxHp
    },
  },
  // ── DEITY ─────────────────────────────────────────────────────
  // Drop your deity PNG into the same folder as index.html and
  // put the filename here. The image shows Hades-style during encounter.
  deity: {
    name:      "The Bee Deity",
    imagePath: "BeeDeity.png",   // ← change to your actual filename
    glowColor: "#ffd60a",
  },

  // ── COUPLE ACTIVITIES ────────────────────────────────────────
  // Shown between rounds on a spin wheel — one per round, no repeats.
  // Categories: talk 💬 | sweet 💕 | goofy 😜 | challenge 🎯 | find 🔍
  coupleActivities: [
    // ── TALK ──────────────────────────────────────────────────
    { icon:"💬", text:"What's the first character that pops in your head when you think of the colour red?", category:"talk" },
    { icon:"💬", text:"If our relationship was a movie genre, what would it be?", category:"talk" },
    { icon:"💬", text:"What's one thing you love about how we communicate?", category:"talk" },
    { icon:"💬", text:"What song reminds you of us and why?", category:"talk" },
    { icon:"💬", text:"What's a memory of us that always makes you smile?", category:"talk" },
    { icon:"💬", text:"If you could describe me in 3 emojis only, what would they be?", category:"talk" },
    { icon:"💬", text:"What's something small I do that you really appreciate?", category:"talk" },
    { icon:"💬", text:"What's a place you'd love us to visit together someday?", category:"talk" },
    { icon:"💬", text:"What's something new you'd want us to try together?", category:"talk" },
    { icon:"💬", text:"If we had a couples theme song, what would it be right now?", category:"talk" },

    // ── SWEET 💕 ──────────────────────────────────────────────
    { icon:"💕", text:"Tell the other person one thing you genuinely admire about them.", category:"sweet" },
    { icon:"💕", text:"What's your favourite thing we've done together in the last 14 months?", category:"sweet" },
    { icon:"💕", text:"Share a moment where you felt really proud of the other person.", category:"sweet" },
    { icon:"💕", text:"What does a perfect lazy day with each other look like?", category:"sweet" },
    { icon:"💕", text:"Tell each other what you were thinking the first time you video called.", category:"sweet" },

    // ── GOOFY 😜 ──────────────────────────────────────────────
    { icon:"😜", text:"Each person does their best impression of the other — judge each other.", category:"goofy" },
    { icon:"😜", text:"Both say a word at the same time. Keep going until you say the same word!", category:"goofy" },
    { icon:"😜", text:"Speed round: one person says a colour, the other says the first food that matches it. Do 5 rounds.", category:"goofy" },
    { icon:"😜", text:"Who would win in an arm wrestle? Debate it seriously for 30 seconds.", category:"goofy" },
    { icon:"😜", text:"Each person ranks: pizza vs pasta vs tacos vs burgers. Compare lists.", category:"goofy" },
    { icon:"😜", text:"Say a random animal at the same time. Now explain why it represents the other person.", category:"goofy" },
    { icon:"😜", text:"Play 2 truths and 1 lie — the other person has to guess the lie!", category:"goofy" },

    // ── CHALLENGE 🎯 ──────────────────────────────────────────
    { icon:"🎯", text:"Name 5 of each other's favourite foods in under 30 seconds. Most correct wins!", category:"challenge" },
    { icon:"🎯", text:"Guess what the other person's phone wallpaper is right now without looking.", category:"challenge" },
    { icon:"🎯", text:"Both write down your top 3 dream travel destinations — how many match?", category:"challenge" },
    { icon:"🎯", text:"Each person writes what they think the other person's love language is. Compare!", category:"challenge" },
    { icon:"🎯", text:"Name as many things as you can that you both like — you have 60 seconds.", category:"challenge" },

    // ── FIND IT 🔍 ────────────────────────────────────────────
    { icon:"🔍", text:"Find the oldest photo of you two together and share it!", category:"find" },
    { icon:"🔍", text:"Find something in your room right now that reminds you of the other person and explain why.", category:"find" },
    { icon:"🔍", text:"Find and send each other a meme that perfectly describes your dynamic right now.", category:"find" },
  ],
  loveEvents: [
    { text: "Send each other a voice note 🎤", coins: 0 },
    { text: "You get to pick the next movie night film 🎬", coins: 5 },
    { text: "Opponent team loses 3 coins – date night energy! 💅", coins: 0, opponentLose: 3 },
    { text: "Free hug voucher redeemed! +5 coins 🤗", coins: 5 },
    { text: "Cutest couple wins 10 coins 👑", coins: 10 },
    { text: "Star gazing mini-game coming soon 🌠", coins: 2 },
    { text: "Anniversary milestone bonus! +8 coins 🎉", coins: 8 },
    { text: "Bad luck – you tripped over love. -2 coins 😅", coins: -2 },
  ],

  // ── MUSIC ────────────────────────────────────────────────────
  // Drop your audio files into an assets/music/ folder and fill
  // in the filenames below.  Leave a value as "" to stay silent
  // for that context.  Supported formats: .mp3, .ogg, .wav
  music: {

    // Master volume: 0.0 (silent) → 1.0 (full).  Default 0.4.
    volume: 0.4,

    // ── Main board / overworld ─────────────────────────────────
    board: "Afternoon_Promenade.mp3",

    // ── Duel ──────────────────────────────────────────────────
    duel: "Velvet_and_Blade.mp3",

    // ── Minigames ─────────────────────────────────────────────
    // Played when no mode-specific track is found:
    minigameDefault: "assets/music/minigame_default.mp3",

    // Per-minigame overrides — remove or leave "" to use the default:
    minigames: {
      FFA:        "",        // 🔫 Free For All
      FFA_DIG:    "",    // ⛏️  Chest Diggers
      DUOS:       "",       // 🤝 Tile Takeover
      DUOS_RACE:  "",  // 🏎️  Co-op Race
      "1v3":      "",  // 🔍 Hide & Seek
      "1V3_TAG":  "", // 🔨 Hammer Tag
    },
  },

};