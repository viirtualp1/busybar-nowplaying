/**
 * One shape for every platform. macOS (MediaRemote) and Windows (SMTC) expose
 * the same handful of facts about whatever the machine is playing, so the
 * sources normalise into this and nothing above them knows which OS it is on.
 */
export type NowPlaying = {
  /** Stable per track, so art is fetched once and a change means "new song". */
  trackId: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  /**
   * Where playback was at `positionAt` — a sample, not a running clock. Both
   * backends publish it on change only, so it must be interpolated forward.
   */
  positionMs: number;
  positionAt: number;
  /** 0 while paused, 1 at normal speed. */
  rate: number;
  playing: boolean;
  /** Bundle id (macOS) or AUMID (Windows) of the app that owns the session. */
  app: string;
  /** What to call that app on screen: "YouTube Music", "Chrome", … */
  appLabel: string;
};

export type Artwork = {
  bytes: Buffer;
  mime: string;
};

export type MediaSource = {
  readonly name: string;
  /** Throws with a human-readable reason when this source cannot run here. */
  start: () => Promise<void>;
  read: () => Promise<NowPlaying | null>;
  /** Called once per track, never per frame — artwork is big and slow. */
  artwork: (track: NowPlaying) => Promise<Artwork | null>;
  stop: () => Promise<void>;
};

/**
 * Identity of a track for caching and change detection. Deliberately not the
 * position or the app: the same song paused and resumed is the same song.
 *
 * Newline-joined rather than run together, so a title ending where an artist
 * begins cannot collide with the other way round.
 */
export function trackKey(title: string, artist: string, album: string) {
  return [title, artist, album].join('\n').toLowerCase();
}

export function isSameTrack(a: NowPlaying | null, b: NowPlaying | null) {
  return a?.trackId === b?.trackId;
}
