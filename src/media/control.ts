import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CLI } from './macos.js';

const run = promisify(execFile);

/**
 * Sending commands the other way: the Bar's buttons drive the player.
 *
 * The volume is the machine's output volume, not the player's. Every backend
 * here is system-wide already, and a browser tab has no volume anyone can set
 * from outside it.
 */
export type MediaControl = {
  readonly name: string;
  togglePlayPause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  /** Moves the volume by `steps` notches; returns the new one when it can. */
  nudgeVolume: (steps: number) => Promise<number | null>;
};

export const VOLUME_STEP = 4;

export function createControl(platform = process.platform): MediaControl {
  return platform === 'win32' ? new WindowsControl() : new MacosControl();
}

class MacosControl implements MediaControl {
  readonly name = 'macos';
  /** Read once, then tracked locally: `osascript` is slow to ask twice a turn. */
  private volume: number | null = null;

  async togglePlayPause(): Promise<void> {
    await run(CLI, ['togglePlayPause']);
  }

  async next(): Promise<void> {
    await run(CLI, ['next']);
  }

  async previous(): Promise<void> {
    await run(CLI, ['previous']);
  }

  async nudgeVolume(steps: number): Promise<number | null> {
    const current = this.volume ?? (await this.readVolume());
    if (current === null) {
      return null;
    }

    const wanted = Math.max(0, Math.min(100, Math.round(current + steps * VOLUME_STEP)));
    await run('osascript', ['-e', `set volume output volume ${wanted}`]);
    this.volume = wanted;

    return wanted;
  }

  private async readVolume(): Promise<number | null> {
    try {
      const { stdout } = await run('osascript', [
        '-e',
        'output volume of (get volume settings)',
      ]);
      const value = Number(stdout.trim());

      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }
}

/**
 * Windows has no equivalent of `nowplaying-cli`: `windows-media-sessions` reads
 * SMTC but cannot command it. Pressing the media keys reaches the same place,
 * and Windows routes them to whichever session is playing.
 *
 * Unverified on hardware — written from the key codes, not from a run.
 */
class WindowsControl implements MediaControl {
  readonly name = 'windows';

  async togglePlayPause(): Promise<void> {
    await this.tap(0xb3);
  }

  async next(): Promise<void> {
    await this.tap(0xb0);
  }

  async previous(): Promise<void> {
    await this.tap(0xb1);
  }

  /**
   * Volume keys move in Windows' own 2% notches, so the step is a count of
   * taps. Nothing reports back what it landed on.
   */
  async nudgeVolume(steps: number): Promise<number | null> {
    const key = steps > 0 ? 0xaf : 0xae;
    await this.tap(key, Math.min(10, Math.abs(steps) * 2));

    return null;
  }

  private async tap(key: number, times = 1): Promise<void> {
    const script = [
      'Add-Type -Name K -Namespace W -MemberDefinition \'[DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, int e);\'',
      `1..${times} | ForEach-Object { [W.K]::keybd_event(${key},0,0,0); [W.K]::keybd_event(${key},0,2,0) }`,
    ].join('; ');

    await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
  }
}
