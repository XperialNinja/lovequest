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
    totalRounds: 14,  // 14 months 💖
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
