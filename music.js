// ============================================================
//  LOVEQUEST  –  music.js
//  Centralised music manager. Reads track paths from CONFIG.music.
//  Safe to call even if a track isn't configured — it just stays silent.
//
//  Public API (all methods are no-ops if CONFIG.music isn't set):
//    MUSIC.playBoard()          — board / overworld theme
//    MUSIC.playDuel()           — duel theme
//    MUSIC.playMinigame(mode)   — per-minigame track, falls back to default
//    MUSIC.stop()               — fade out and stop
//    MUSIC.setVolume(0–1)       — change master volume mid-play
// ============================================================

const MUSIC = (() => {

  // ── INTERNAL STATE ───────────────────────────────────────────
  let current    = null;   // currently active HTMLAudioElement
  let currentSrc = null;   // src string so we don't restart the same track
  let fadeTimer  = null;

  const FADE_MS  = 900;    // total fade-in / fade-out duration in ms
  const TICK_MS  = 40;     // interval between volume steps

  // ── HELPERS ─────────────────────────────────────────────────
  function cfg() {
    return (typeof CONFIG !== "undefined" && CONFIG.music) ? CONFIG.music : null;
  }

  function masterVolume() {
    const c = cfg();
    const v = c?.volume ?? 0.4;
    return Math.max(0, Math.min(1, v));
  }

  // Resolve a track path — returns null if not configured or empty string.
  function resolveTrack(src) {
    if (!src || typeof src !== "string" || src.trim() === "") return null;
    return src.trim();
  }

  // Pick the right track for a minigame mode.
  // Falls back to minigameDefault if the specific mode isn't set.
  function minigameTrack(mode) {
    const c = cfg();
    if (!c) return null;
    const specific = resolveTrack(c.minigames?.[mode]);
    if (specific) return specific;
    return resolveTrack(c.minigameDefault);
  }

  // ── FADE LOGIC ───────────────────────────────────────────────
  function clearFade() {
    if (fadeTimer !== null) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  // Fade out the current track, then call cb() when silent.
  function fadeOut(cb) {
    clearFade();
    if (!current || current.paused) {
      if (current) { current.pause(); current = null; }
      cb();
      return;
    }
    const audio  = current;
    const steps  = FADE_MS / TICK_MS;
    const drop   = audio.volume / steps;
    fadeTimer = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - drop);
      if (audio.volume <= 0) {
        clearFade();
        audio.pause();
        cb();
      }
    }, TICK_MS);
  }

  // Fade the current audio in from 0 to masterVolume().
  function fadeIn() {
    clearFade();
    if (!current) return;
    const target = masterVolume();
    const steps  = FADE_MS / TICK_MS;
    const rise   = target / steps;
    current.volume = 0;
    fadeTimer = setInterval(() => {
      if (!current) { clearFade(); return; }
      current.volume = Math.min(target, current.volume + rise);
      if (current.volume >= target) {
        current.volume = target;
        clearFade();
      }
    }, TICK_MS);
  }

  // ── CORE PLAY ────────────────────────────────────────────────
  // Play src (string).  If it's already the active track, do nothing.
  function play(src) {
    const resolved = resolveTrack(src);
    if (!resolved) return;                     // no file configured
    if (currentSrc === resolved && current && !current.paused) return; // already playing

    fadeOut(() => {
      const audio = new Audio(resolved);
      audio.loop = true;
      audio.volume = 0;

      // Save ref before async play() so fadeIn() sees it
      current    = audio;
      currentSrc = resolved;

      audio.play().catch(err => {
        // Browser may block autoplay before a user gesture.
        // Queue it to play on the first user interaction instead.
        console.warn("[MUSIC] Autoplay blocked, will retry on first interaction:", resolved);
        const retry = () => {
          if (current === audio) {
            audio.play().catch(() => {});
            fadeIn();
          }
          document.removeEventListener("pointerdown", retry);
          document.removeEventListener("keydown",     retry);
        };
        document.addEventListener("pointerdown", retry, { once: true });
        document.addEventListener("keydown",     retry, { once: true });
      });

      fadeIn();
    });
  }

  // ── PUBLIC API ───────────────────────────────────────────────
  return {

    /** Board / overworld theme */
    playBoard() {
      play(cfg()?.board);
    },

    /** Duel theme */
    playDuel() {
      play(cfg()?.duel);
    },

    /**
     * Minigame theme.
     * @param {string} mode  One of: FFA | FFA_DIG | DUOS | DUOS_RACE | 1v3 | 1V3_TAG
     *                       Falls back to CONFIG.music.minigameDefault if mode has no track.
     */
    playMinigame(mode) {
      play(minigameTrack(mode));
    },

    /** Fade out and stop everything */
    stop() {
      fadeOut(() => { current = null; currentSrc = null; });
    },

    /**
     * Change the master volume of the currently playing track (0–1).
     * Also updates CONFIG.music.volume so future fades use the new level.
     */
    setVolume(v) {
      v = Math.max(0, Math.min(1, v));
      if (cfg()) CONFIG.music.volume = v;
      if (current) current.volume = v;
    },

    /** True while a track is actually playing */
    get isPlaying() {
      return !!(current && !current.paused);
    },
  };

})();