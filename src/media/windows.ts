import { appLabelFor } from './apps.js';
import { trackKey, type Artwork, type MediaSource, type NowPlaying } from './types.js';

export const PACKAGE = 'windows-media-sessions';

/**
 * The shape `windows-media-sessions` publishes, mirrored here rather than
 * imported: the package declares `os: win32`, so npm skips it on macOS and its
 * types are simply absent when this file is compiled anywhere else.
 */
export type WinSession = {
  id: string;
  sourceAppUserModelId: string;
  sourceAppDisplayName?: string;
  title?: string;
  artist?: string;
  albumTitle?: string;
  playbackStatus: 'closed' | 'opened' | 'changing' | 'stopped' | 'playing' | 'paused';
  timeline?: { positionMs?: number; durationMs?: number };
  /** `data:image/jpeg;base64,…` when the app publishes one. */
  thumbnail?: string;
};

type WinModule = {
  getAllSessions: () => Promise<WinSession[]>;
  onSessionsChanged: (callback: (sessions: readonly WinSession[]) => void) => () => void;
  shutdown: () => Promise<void>;
};

export type WindowsOptions = {
  /** Substring of the AUMID or app name to accept; empty follows anything. */
  appFilter?: string;
};

/**
 * Reads SMTC — the same system session Windows shows on the volume overlay, so
 * a YouTube Music tab in any Chromium browser is visible here.
 *
 * Unlike the macOS backend this one pushes: the snapshot is timestamped when
 * the callback fires, which is the closest thing to a sample time SMTC gives.
 */
export class WindowsSource implements MediaSource {
  readonly name = 'windows';
  private readonly appFilter: string;
  private module: WinModule | null = null;
  private unsubscribe: (() => void) | null = null;
  private latest: NowPlaying | null = null;

  constructor(options: WindowsOptions = {}) {
    this.appFilter = (options.appFilter ?? '').toLowerCase();
  }

  async start(): Promise<void> {
    let loaded: unknown;
    try {
      loaded = await import(PACKAGE);
    } catch (error) {
      throw new Error(missingPackageHint(error), { cause: error });
    }
    const module = loaded as WinModule;
    this.module = module;

    // The first call completes the backend handshake, so the subscription that
    // follows starts from a known-good snapshot rather than an empty cache.
    this.accept(await module.getAllSessions(), Date.now());
    this.unsubscribe = module.onSessionsChanged((sessions) => {
      this.accept([...sessions], Date.now());
    });
  }

  /** Nothing to await: the subscription keeps the latest snapshot current. */
  read(): Promise<NowPlaying | null> {
    return Promise.resolve(this.latest);
  }

  async artwork(track: NowPlaying): Promise<Artwork | null> {
    const sessions = (await this.module?.getAllSessions()) ?? [];
    const session = sessions.find(
      (candidate) => toNowPlaying(candidate, Date.now())?.trackId === track.trackId,
    );

    return parseDataUrl(session?.thumbnail ?? '');
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.module?.shutdown().catch(() => undefined);
    this.module = null;
  }

  private accept(sessions: WinSession[], at: number) {
    const session = pickSession(sessions, this.appFilter);
    this.latest = session ? toNowPlaying(session, at) : null;
  }
}

/**
 * Windows tracks every player at once. Prefer the one actually playing, then
 * anything paused with something to show — a paused track is still what the
 * desk should say you are listening to.
 */
export function pickSession(
  sessions: WinSession[],
  appFilter: string,
): WinSession | null {
  const matching = appFilter
    ? sessions.filter((session) => matchesApp(session, appFilter))
    : sessions;
  const usable = matching.filter((session) =>
    (session.title ?? session.artist ?? '').trim(),
  );

  return (
    usable.find((session) => session.playbackStatus === 'playing') ??
    usable.find((session) => session.playbackStatus === 'paused') ??
    null
  );
}

export function toNowPlaying(session: WinSession, at: number): NowPlaying | null {
  const title = (session.title ?? '').trim();
  const artist = (session.artist ?? '').trim();
  if (!title && !artist) {
    return null;
  }

  const album = (session.albumTitle ?? '').trim();
  const playing = session.playbackStatus === 'playing';
  const app = session.sourceAppUserModelId ?? '';

  return {
    trackId: trackKey(title, artist, album),
    title,
    artist,
    album,
    durationMs: positive(session.timeline?.durationMs),
    positionMs: positive(session.timeline?.positionMs),
    positionAt: at,
    rate: playing ? 1 : 0,
    playing,
    app,
    appLabel: session.sourceAppDisplayName?.trim() || appLabelFor(app),
  };
}

export function parseDataUrl(value: string): Artwork | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value.trim());
  const mime = match?.[1];
  const data = match?.[2];
  if (!mime || !data) {
    return null;
  }

  return { bytes: Buffer.from(data, 'base64'), mime };
}

function matchesApp(session: WinSession, appFilter: string) {
  const haystack =
    `${session.sourceAppUserModelId} ${session.sourceAppDisplayName ?? ''}`.toLowerCase();

  return haystack.includes(appFilter);
}

function positive(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function missingPackageHint(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return `${PACKAGE} could not be loaded (${message}). It installs on Windows only — run \`npm install\` on the Windows machine.`;
}
