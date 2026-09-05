export const FLASH_MS = 500;

/**
 * Keeps the LED colour up for a moment after a new track starts.
 *
 * Only track changes flash. A play/pause blink sounds reasonable until you
 * pause and resume three times looking for a lyric.
 */
export class FlashWindow {
  private color: string | null = null;
  private until = 0;

  constructor(private readonly durationMs = FLASH_MS) {}

  trigger(color: string, nowMs: number): void {
    this.color = color;
    this.until = nowMs + this.durationMs;
  }

  active(nowMs: number): string | null {
    return nowMs < this.until ? this.color : null;
  }
}
