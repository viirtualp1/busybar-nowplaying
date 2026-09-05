import type { NowPlaying } from './types.js';

/**
 * A reported position further than this from the running estimate is a seek,
 * not drift. Below it, the estimate is kept: both backends round the position
 * to the second and republish it at their own pace, so trusting every report
 * makes a displayed clock jitter backwards.
 */
export const SEEK_TOLERANCE_MS = 1500;

/** Where playback is *now*, given a sample taken at `track.positionAt`. */
export function positionAt(track: NowPlaying, nowMs: number) {
  const elapsed = track.playing ? Math.max(0, nowMs - track.positionAt) * track.rate : 0;

  return clamp(
    track.positionMs + elapsed,
    0,
    track.durationMs || Number.MAX_SAFE_INTEGER,
  );
}

export function progressOf(track: NowPlaying, nowMs: number) {
  if (track.durationMs <= 0) {
    return 0;
  }

  return clamp(positionAt(track, nowMs) / track.durationMs, 0, 1);
}

/**
 * Holds the anchor the position is interpolated from, and only re-anchors when
 * the backend really moved — a track change, a seek, or a pause. Everything
 * on screen reads the clock through this, so the seconds only ever tick
 * forward at one per second.
 */
export class PositionClock {
  private anchor: NowPlaying | null = null;

  /** Feeds a fresh backend report in; returns the track to render. */
  update(track: NowPlaying | null, nowMs: number): NowPlaying | null {
    if (!track) {
      this.anchor = null;

      return null;
    }

    const previous = this.anchor;
    const keepsAnchor =
      previous !== null &&
      previous.trackId === track.trackId &&
      previous.playing === track.playing &&
      previous.rate === track.rate &&
      Math.abs(track.positionMs - positionAt(previous, nowMs)) <= SEEK_TOLERANCE_MS;

    // Keeping the old anchor keeps the estimate running; the rest of the
    // report (title, duration) is identical when the track has not changed.
    this.anchor = keepsAnchor
      ? { ...track, positionMs: previous.positionMs, positionAt: previous.positionAt }
      : track;

    return this.anchor;
  }

  current(): NowPlaying | null {
    return this.anchor;
  }

  reset(): void {
    this.anchor = null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
