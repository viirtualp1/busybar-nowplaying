import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appLabelFor } from './apps.js';
import { trackKey, type Artwork, type MediaSource, type NowPlaying } from './types.js';

const run = promisify(execFile);

export const CLI = 'nowplaying-cli';

/** Everything the render loop needs, and nothing the size of an image. */
const FIELDS = [
  'title',
  'artist',
  'album',
  'duration',
  'elapsedTime',
  'playbackRate',
  'timestamp',
  'bundleIdentifier',
] as const;

const ART_FIELDS = ['artworkData', 'artworkMIMEType'] as const;

const ART_MAX_BUFFER = 32 * 1024 * 1024;

export type MacosOptions = {
  timeoutMs?: number;
  /** Substring of the bundle id to accept; empty follows whatever plays. */
  appFilter?: string;
};

/**
 * Reads the system "Now Playing" that Control Center shows, via `nowplaying-cli`
 * over MediaRemote. This is deliberately not a YouTube Music integration: the
 * web player publishes `navigator.mediaSession`, so a browser tab lands here
 * the same way a native app does.
 */
export class MacosSource implements MediaSource {
  readonly name = 'macos';
  private readonly timeoutMs: number;
  private readonly appFilter: string;

  constructor(options: MacosOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 4000;
    this.appFilter = (options.appFilter ?? '').toLowerCase();
  }

  async start(): Promise<void> {
    try {
      await this.cli(['get', '--json', 'title'], 1024 * 1024);
    } catch (error) {
      throw new Error(missingCliHint(error), { cause: error });
    }
  }

  async read(): Promise<NowPlaying | null> {
    const { stdout } = await this.cli(['get', '--json', ...FIELDS], 1024 * 1024);
    const track = parseNowPlaying(stdout, Date.now());
    if (!track || !this.accepts(track)) {
      return null;
    }

    return track;
  }

  async artwork(): Promise<Artwork | null> {
    const { stdout } = await this.cli(['get', '--json', ...ART_FIELDS], ART_MAX_BUFFER);

    return parseArtwork(stdout);
  }

  async stop(): Promise<void> {
    // Nothing to tear down: every read is its own short-lived process.
  }

  private accepts(track: NowPlaying) {
    return !this.appFilter || track.app.toLowerCase().includes(this.appFilter);
  }

  private cli(args: string[], maxBuffer: number) {
    return run(CLI, args, { timeout: this.timeoutMs, maxBuffer });
  }
}

export function parseNowPlaying(stdout: string, nowMs: number): NowPlaying | null {
  const raw = parseJson(stdout);
  if (!raw) {
    return null;
  }

  const title = text(raw['title']);
  const artist = text(raw['artist']);
  // MediaRemote keeps stale metadata around after a player quits; a session
  // with neither a title nor an artist is not something worth showing.
  if (!title && !artist) {
    return null;
  }

  const album = text(raw['album']);
  const rate = number(raw['playbackRate']) ?? 0;
  const app = text(raw['bundleIdentifier']);

  return {
    trackId: trackKey(title, artist, album),
    title,
    artist,
    album,
    durationMs: seconds(raw['duration']),
    positionMs: seconds(raw['elapsedTime']),
    positionAt: parseTimestamp(raw['timestamp'], nowMs),
    rate,
    playing: rate > 0,
    app,
    appLabel: appLabelFor(app),
  };
}

export function parseArtwork(stdout: string): Artwork | null {
  const raw = parseJson(stdout);
  const data = raw ? text(raw['artworkData']) : '';
  if (!data) {
    return null;
  }

  return {
    bytes: Buffer.from(data, 'base64'),
    mime: (raw ? text(raw['artworkMIMEType']) : '') || 'image/jpeg',
  };
}

/**
 * `elapsedTime` is the position at the moment the player last published it —
 * for a track playing untouched that can be minutes ago, so the timestamp is
 * what makes the progress bar right rather than merely plausible.
 */
export function parseTimestamp(value: unknown, nowMs: number): number {
  const parsed = toEpochMs(value);
  if (parsed === null) {
    return nowMs;
  }

  // A timestamp from the future, or from before this machine booted, means the
  // format was misread; the poll time is wrong by milliseconds, not minutes.
  const ahead = parsed - nowMs;
  const behind = nowMs - parsed;

  return ahead > 5000 || behind > 24 * 3600 * 1000 ? nowMs : parsed;
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return epochFromNumber(value);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return epochFromNumber(asNumber);
  }
  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function epochFromNumber(value: number) {
  if (value > 1e12) {
    return value;
  }

  return value > 1e9 ? value * 1000 : null;
}

function parseJson(stdout: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stdout);

    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function seconds(value: unknown) {
  const parsed = number(value);

  return parsed === null || parsed < 0 ? 0 : Math.round(parsed * 1000);
}

function missingCliHint(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT/.test(message)) {
    return `${CLI} is not installed — run \`brew install ${CLI}\``;
  }

  return `${CLI} failed: ${message}`;
}
