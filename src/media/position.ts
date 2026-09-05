import type { NowPlaying } from './types.js';

/**
 * A report further than this from the running estimate is a seek, not drift.
 * Below it the estimate is kept: backends round the position to the second and
 * republish it at their own pace, so trusting every report makes the displayed
 * clock jitter backwards.
 */
export const SEEK_TOLERANCE_MS = 1500;

/** How much the raw report must change before it counts as the backend moving. */
export const REPORT_MOVE_MS = 250;

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
 * Runs the playback clock locally, because no backend runs one for us.
 *
 * Two failure modes have to be handled at once. A backend that republishes the
 * position every second (SMTC) would make the seconds jitter if every report
 * were believed. And a browser on macOS publishes `elapsedTime` **once** — for
 * a YouTube Music tab it is 0 for the whole track, with no timestamp and no
 * refresh on pause — so a clock that re-anchored whenever the report disagreed
 * would sit at zero forever.
 *
 * So the rule is about the *report* moving, not about it disagreeing: re-anchor
 * only when the backend published a genuinely new position that also differs
 * from the estimate. Otherwise keep counting. A frozen backend then means the
 * clock counts from where the track was when this app first saw it — right for
 * a track that starts while it is running, and the best available guess for one
 * that was already playing.
 */
export class PositionClock {
  private anchor: NowPlaying | null = null;
  private lastReport: NowPlaying | null = null;
  private freeRun = false;

  update(report: NowPlaying | null, nowMs: number): NowPlaying | null {
    if (!report) {
      this.anchor = null;
      this.lastReport = null;
      this.freeRun = false;

      return null;
    }

    const previous = this.anchor;
    const lastReport = this.lastReport;
    this.lastReport = report;

    if (!previous || previous.trackId !== report.trackId) {
      this.freeRun = false;
      this.anchor = report;

      return this.anchor;
    }

    const estimate = positionAt(previous, nowMs);
    const reportMoved =
      !lastReport || Math.abs(report.positionMs - lastReport.positionMs) > REPORT_MOVE_MS;
    const diverged = Math.abs(report.positionMs - estimate) > SEEK_TOLERANCE_MS;

    if (reportMoved && diverged) {
      this.anchor = report;

      return this.anchor;
    }

    // Carrying the estimate forward is also what makes pause and resume work:
    // the estimate is frozen while paused, and the report's own rate takes over
    // from now, without the frozen position ever being believed.
    this.freeRun = this.freeRun || (report.playing && !reportMoved && diverged);
    this.anchor = { ...report, positionMs: estimate, positionAt: nowMs };

    return this.anchor;
  }

  current(): NowPlaying | null {
    return this.anchor;
  }

  /** True once the backend has been caught not publishing a moving position. */
  get isFreeRunning(): boolean {
    return this.freeRun;
  }

  reset(): void {
    this.anchor = null;
    this.lastReport = null;
    this.freeRun = false;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
