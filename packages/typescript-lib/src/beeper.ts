/**
 * @file
 *
 * A small audible-feedback helper that plays a short, throttled beep via the Web Audio API. Use it to
 * signal a rejected or blocked user action — e.g. typing into a locked note, or attempting an action
 * while a modal is minimized.
 */

const BEEP_DURATION_SECONDS = 0.08;
const BEEP_FREQUENCY_HZ = 660;
const BEEP_GAIN = 0.05;
const BEEP_THROTTLE_MILLISECONDS = 200;

/**
 * Plays a short, throttled beep to signal a rejected or blocked user action.
 */
export class Beeper {
  private audioContext: AudioContext | null = null;
  private lastBeepMilliseconds = 0;

  /**
   * Plays a short beep. A no-op if called again within {@link BEEP_THROTTLE_MILLISECONDS} of the
   * previous beep (so a burst of rejected actions does not stack into a buzz), or if the Web Audio API
   * is unavailable (e.g. the jsdom test environment).
   */
  public beep(): void {
    // Throttle so a burst of rejected actions does not stack overlapping tones into a buzz.
    const nowMilliseconds = Date.now();
    if (nowMilliseconds - this.lastBeepMilliseconds < BEEP_THROTTLE_MILLISECONDS) {
      return;
    }
    this.lastBeepMilliseconds = nowMilliseconds;

    // `lib.dom` types `AudioContext` as always present, but it is absent in some runtimes
    // (e.g. the jsdom test environment), so this guard is real, not redundant.
    const AudioContextClass = window.AudioContext;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see the comment above.
    if (!AudioContextClass) {
      return;
    }
    this.audioContext ??= new AudioContextClass();
    const audioContext = this.audioContext;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = BEEP_FREQUENCY_HZ;
    gainNode.gain.value = BEEP_GAIN;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + BEEP_DURATION_SECONDS);
  }
}
