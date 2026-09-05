import { clipToWidth } from 'busybar-kit/device';
import { tickerLineLooping } from 'busybar-kit/ticker';
import { positionAt, progressOf } from '../media/position.js';
import type { NowPlaying } from '../media/types.js';
import { toAscii } from './ascii.js';
import { clockOf, durationOf, remainingOf } from './format.js';
import { BACK, BACK_CHARS, FRONT, FRONT_CHARS, fillPixels } from './layout.js';

export type NowPlayingFrame = {
  active: boolean;
  paused: boolean;
  /** While the knob is turning the front strip belongs to the volume. */
  volume: VolumeView | null;
  frontTitle: string;
  frontArtist: string;
  frontTime: string;
  frontFill: number;
  backTitle: string;
  backArtist: string;
  backAlbum: string;
  backElapsed: string;
  backDuration: string;
  backFill: number;
  backSource: string;
  /** Asset file name of the cover on the Bar; empty when there is none. */
  artFile: string;
  ledColor: string | null;
};

/**
 * What the front shows while the knob is being turned. `value` is null on a
 * backend that can move the volume but not read it back, and then the fill is
 * left empty rather than guessed at.
 */
export type VolumeView = {
  value: number | null;
  direction: 'up' | 'down';
};

export type FrameInput = {
  nowMs: number;
  artFile?: string;
  ledColor?: string | null;
  volume?: VolumeView | null;
};

export const IDLE_FRAME: NowPlayingFrame = {
  active: false,
  paused: false,
  volume: null,
  frontTitle: '',
  frontArtist: '',
  frontTime: '',
  frontFill: 0,
  backTitle: '',
  backArtist: '',
  backAlbum: '',
  backElapsed: '',
  backDuration: '',
  backFill: 0,
  backSource: '',
  artFile: '',
  ledColor: null,
};

/**
 * Everything the two displays show, as plain data. The app diffs frames by
 * value to decide whether to redraw, so nothing derived from the clock may be
 * left out of here — and nothing that is not on screen may be put in.
 */
export function buildFrame(track: NowPlaying | null, input: FrameInput): NowPlayingFrame {
  const volume = input.volume ?? null;
  if (!track) {
    // The knob still works with nothing playing, and is worth showing for it.
    return volume ? { ...IDLE_FRAME, volume } : IDLE_FRAME;
  }

  const { nowMs } = input;
  const position = positionAt(track, nowMs);
  const progress = progressOf(track, nowMs);
  const title = toAscii(track.title);
  const artist = toAscii(track.artist);
  const remaining = remainingOf(position, track.durationMs);

  return {
    active: true,
    paused: !track.playing,
    volume,
    frontTitle: tickerLineLooping('scroll', title, FRONT_CHARS.title, nowMs),
    frontArtist: tickerLineLooping('scroll', artist, FRONT_CHARS.artist, nowMs),
    // With no duration there is nothing to count down to, so the front falls
    // back to counting up — a live stream still shows how long you have been on it.
    frontTime: remaining || clockOf(position),
    frontFill: fillPixels(progress, FRONT.width),
    backTitle: tickerLineLooping('scroll', title, BACK_CHARS.panel, nowMs),
    backArtist: tickerLineLooping('scroll', artist, BACK_CHARS.panel, nowMs),
    backAlbum: clipToWidth(toAscii(track.album), BACK.textWidth, 'small'),
    backElapsed: clockOf(position),
    backDuration: durationOf(track.durationMs),
    backFill: fillPixels(progress, BACK.grooveWidth),
    backSource: clipToWidth(toAscii(track.appLabel), BACK.textWidth, 'small'),
    artFile: input.artFile ?? '',
    ledColor: input.ledColor ?? null,
  };
}
