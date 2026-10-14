// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { Beeper } from './beeper.ts';
import { castTo } from './object-utils.ts';

const startMock = vi.fn();
const stopMock = vi.fn();
const oscillatorConnectMock = vi.fn();
const gainConnectMock = vi.fn();
const createOscillatorMock = vi.fn(() => ({
  connect: oscillatorConnectMock,
  frequency: { value: 0 },
  start: startMock,
  stop: stopMock,
  type: ''
}));
const createGainMock = vi.fn(() => ({ connect: gainConnectMock, gain: { value: 0 } }));
const audioContextCtorMock = vi.fn(
  // eslint-disable-next-line prefer-arrow-callback -- vitest needs a real function (not an arrow) to construct via `new`.
  function fakeAudioContextCtor() {
    return {
      createGain: createGainMock,
      createOscillator: createOscillatorMock,
      currentTime: 0,
      destination: {}
    };
  }
);

let originalAudioContext: typeof AudioContext | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  originalAudioContext = window.AudioContext;
  window.AudioContext = castTo<typeof AudioContext>(audioContextCtorMock);
});

afterEach(() => {
  window.AudioContext = castTo<typeof AudioContext>(originalAudioContext);
  vi.useRealTimers();
});

describe('Beeper', () => {
  it('should play a short sine tone when the Web Audio API is available', () => {
    const beeper = new Beeper();
    beeper.beep();

    expect(audioContextCtorMock).toHaveBeenCalledTimes(1);
    expect(createOscillatorMock).toHaveBeenCalledTimes(1);
    expect(createGainMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(oscillatorConnectMock).toHaveBeenCalledTimes(1);
    expect(gainConnectMock).toHaveBeenCalledTimes(1);
  });

  it('should throttle rapid beeps into a single tone and reuse one AudioContext', () => {
    vi.useFakeTimers();
    const beeper = new Beeper();

    beeper.beep();
    beeper.beep();
    expect(createOscillatorMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(200);
    beeper.beep();
    expect(createOscillatorMock).toHaveBeenCalledTimes(2);
    // The AudioContext is created once and reused across beeps.
    expect(audioContextCtorMock).toHaveBeenCalledTimes(1);
  });

  it('should be a no-op when the Web Audio API is unavailable', () => {
    window.AudioContext = castTo<typeof AudioContext>(undefined);
    const beeper = new Beeper();

    expect(() => {
      beeper.beep();
    }).not.toThrow();
    expect(createOscillatorMock).not.toHaveBeenCalled();
  });
});
