import { errorMessage, isForbidden } from 'busybar-kit/errors';
import { ArtworkCache, renderArtwork } from './art/index.js';
import type { BarDisplay } from './bar/display.js';
import type { Config } from './config.js';
import { FlashWindow } from './domain/flash.js';
import { PositionClock } from './media/position.js';
import type { MediaSource, NowPlaying } from './media/types.js';
import { COLORS } from './view/colors.js';
import { buildFrame } from './view/frame.js';

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

export type AppDeps = {
  config: Config;
  source: MediaSource;
  display: BarDisplay;
  logger?: Logger;
};

const BAR_RETRY_MS = 2000;
const REPEAT_WARNING_MS = 30_000;

export class App {
  private readonly config: Config;
  private readonly source: MediaSource;
  private readonly display: BarDisplay;
  private readonly logger: Logger;
  private readonly clock = new PositionClock();
  private readonly artwork = new ArtworkCache();
  private readonly flash = new FlashWindow();

  private artFile = '';
  private artToken = 0;
  private lastTrackId = '';
  private notedFreeRun = false;
  private activeAt = Date.now();
  private blanked = false;
  private running = false;
  private loops: Promise<void>[] = [];
  private warnings = new Map<string, { message: string; at: number }>();

  constructor(deps: AppDeps) {
    this.config = deps.config;
    this.source = deps.source;
    this.display = deps.display;
    this.logger = deps.logger ?? console;
  }

  async start(): Promise<void> {
    this.running = true;
    await this.source.start();
    await this.connectBar();
    if (!this.running) {
      return;
    }
    this.loops = [this.sourceLoop(), this.renderLoop()];
  }

  async wait(): Promise<void> {
    await Promise.all(this.loops);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;
    await Promise.allSettled(this.loops);
    await this.source.stop().catch(() => undefined);
    try {
      await this.display.clear();
    } catch {
      // the device may already be gone
    }
  }

  private async connectBar(): Promise<void> {
    while (this.running) {
      try {
        await this.display.ping();
        this.logger.info(`BUSY Bar connected (${this.config.busyAddr})`);
        this.display.markStale();
        // Assets do not survive the Bar going away, so the covers cached
        // against them cannot either.
        this.artwork.clear();
        this.artFile = '';

        return;
      } catch (error) {
        const hint =
          isForbidden(error) && !this.config.isCloud
            ? ' — set BUSY_HTTP_PASSWORD to the HTTP Access password, leave BUSY_TOKEN empty'
            : '';
        this.warnRepeated(
          'bar',
          `Waiting for BUSY Bar at ${this.config.busyAddr}: ${errorMessage(error)}${hint}`,
        );
        await this.sleep(BAR_RETRY_MS);
      }
    }
  }

  private async sourceLoop(): Promise<void> {
    while (this.running) {
      try {
        const track = this.clock.update(await this.source.read(), Date.now());
        this.warnings.delete('source');
        this.onTrack(track);
        this.noteFreeRunning(track);
      } catch (error) {
        this.warnRepeated('source', `${this.source.name}: ${errorMessage(error)}`);
      }

      await this.sleep(this.config.pollMs);
    }
  }

  private onTrack(track: NowPlaying | null): void {
    if (!track) {
      this.lastTrackId = '';
      this.artFile = '';

      return;
    }

    if (track.playing) {
      this.activeAt = Date.now();
    }

    if (track.trackId === this.lastTrackId) {
      return;
    }
    this.lastTrackId = track.trackId;
    this.flash.trigger(COLORS.ledTrack, Date.now());
    this.logger.info(`[track] ${track.title} — ${track.artist} (${track.appLabel})`);

    const cached = this.artwork.get(track.trackId);
    this.artFile = cached?.file ?? '';
    if (!cached) {
      void this.loadArt(track);
    }
  }

  /**
   * Worth saying out loud once: a browser publishes a position it then never
   * updates, so the elapsed time is counted from when this app saw the track
   * rather than read from the player.
   */
  private noteFreeRunning(track: NowPlaying | null): void {
    if (!this.clock.isFreeRunning || this.notedFreeRun) {
      return;
    }
    this.notedFreeRun = true;
    this.logger.info(
      `${track?.appLabel || 'This player'} publishes no playback position — counting locally from where the track was first seen`,
    );
  }

  /**
   * Covers are fetched and dithered off the poll loop: decoding a 600px JPEG
   * takes longer than a frame, and the clock must not stutter for it.
   */
  private async loadArt(track: NowPlaying): Promise<void> {
    const token = (this.artToken += 1);
    try {
      const source = await this.source.artwork(track);
      if (!source || token !== this.artToken) {
        return;
      }

      const rendered = renderArtwork(source.bytes, source.mime, {
        contrast: this.config.artContrast,
      });
      const cached = this.artwork.put(track.trackId, rendered);
      await this.display.uploadArt(cached.file, cached.png);
      if (token === this.artToken) {
        this.artFile = cached.file;
      }
    } catch (error) {
      this.warnRepeated('art', `Cover art: ${errorMessage(error)}`);
    }
  }

  private async renderLoop(): Promise<void> {
    while (this.running) {
      const now = Date.now();
      try {
        if (this.shouldBlank(now)) {
          await this.blank();
        } else {
          this.blanked = false;
          await this.display.push(
            buildFrame(this.clock.current(), {
              nowMs: now,
              artFile: this.artFile,
              ledColor: this.flash.active(now),
            }),
          );
        }
      } catch (error) {
        this.warnRepeated('draw', `BUSY Bar draw failed: ${errorMessage(error)}`);
      }

      await this.sleep(this.config.frameMs);
    }
  }

  /**
   * Music is off most of the day, unlike a match that runs for an hour. Rather
   * than leave a frozen track on a desk object, give the screen back — and do
   * it after a pause, too, since a pause left overnight is silence.
   */
  private shouldBlank(nowMs: number) {
    const track = this.clock.current();
    if (track?.playing) {
      return false;
    }

    return nowMs - this.activeAt > this.config.idleMs;
  }

  private async blank(): Promise<void> {
    if (this.blanked) {
      return;
    }
    await this.display.blank();
    this.blanked = true;
    this.logger.info('Idle — display released');
  }

  private warnRepeated(key: string, message: string): void {
    const now = Date.now();
    const previous = this.warnings.get(key);
    if (
      previous &&
      previous.message === message &&
      now - previous.at < REPEAT_WARNING_MS
    ) {
      return;
    }
    this.warnings.set(key, { message, at: now });
    this.logger.warn(message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
