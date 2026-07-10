/**
 * Plays a pleasant notification chime using the Web Audio API.
 * No external audio file needed — generates a two-tone "ding" programmatically.
 */
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.8, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Two-tone chime: C6 → E6
    playTone(1047, now, 0.15);
    playTone(1319, now + 0.12, 0.2);

    // Close context after sound finishes
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Silently fail if audio not available
  }
}
