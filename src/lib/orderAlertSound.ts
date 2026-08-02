let sharedCtx: AudioContext | null = null;
let currentStop: (() => void) | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedCtx.state === "suspended") {
      sharedCtx.resume();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a repeating telephone-ring alert using the Web Audio API.
 * Returns a stop function to silence it.
 */
function playPhoneRing(): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const play = () => {
    if (stopped) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Telephone ring: alternating two-tone "trrring" pattern
      const pattern = [
        { freq: 440, start: 0, dur: 0.11 },
        { freq: 520, start: 0.11, dur: 0.11 },
        { freq: 440, start: 0.22, dur: 0.11 },
        { freq: 520, start: 0.33, dur: 0.11 },
        { freq: 440, start: 0.44, dur: 0.11 },
        { freq: 520, start: 0.55, dur: 0.11 },
        { freq: 440, start: 0.66, dur: 0.11 },
        { freq: 520, start: 0.77, dur: 0.11 },
      ];

      pattern.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.7, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      });

      // Pause between rings (classic "ring... ring...")
      timer = setTimeout(play, 2200);
    } catch {
      // Audio not available
    }
  };

  play();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}

/** Starts the phone-ring order alert (stops any existing one). */
export function startOrderAlert() {
  stopOrderAlert();
  currentStop = playPhoneRing();
}

/** Silences the order alert immediately. */
export function stopOrderAlert() {
  if (currentStop) {
    currentStop();
    currentStop = null;
  }
}
