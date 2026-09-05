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

export type FrameInput = {
  nowMs: number;
  artFile?: string;
  ledColor?: string | null;
};

export const IDLE_FRAME: NowPlayingFrame = {
  active: false,
  paused: false,
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
  if (!track) {
    return IDLE_FRAME;
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
