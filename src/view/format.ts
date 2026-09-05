import { formatClock } from 'busybar-kit/format';

/** `1:23`, counting whole seconds elapsed. */
export function clockOf(positionMs: number) {
  return formatClock(Math.floor(Math.max(0, positionMs) / 1000));
}

/**
 * `-2:07`, rounded up: a track showing `-0:00` for a full second before it ends
 * looks stuck.
 */
export function remainingOf(positionMs: number, durationMs: number) {
  if (durationMs <= 0) {
    return '';
  }
  const left = Math.max(0, durationMs - positionMs);

  return formatClock(-Math.ceil(left / 1000));
}

/** Streams and radio arrive with no duration at all. */
export function durationOf(durationMs: number) {
  return durationMs > 0 ? formatClock(Math.round(durationMs / 1000)) : 'LIVE';
}
