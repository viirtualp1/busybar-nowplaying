/** How long a press waits to see whether a second one is coming. */
export const DOUBLE_PRESS_MS = 350;

export type Gesture = 'single' | 'double';

/**
 * Tells one press from two, without a timer of its own: a second press inside
 * the window resolves immediately, and a lone one falls due when the window
 * closes, which the render loop notices on its next tick.
 *
 * The cost is that a single press acts a third of a second late — unavoidable,
 * since until the window closes it might still be half of a double.
 */
export class DoublePress {
  private pendingAt: number | null = null;

  constructor(private readonly windowMs = DOUBLE_PRESS_MS) {}

  /** A press happened. Returns 'double' when this one completed a pair. */
  press(nowMs: number): Gesture | null {
    if (this.pendingAt !== null && nowMs - this.pendingAt <= this.windowMs) {
      this.pendingAt = null;

      return 'double';
    }
    this.pendingAt = nowMs;

    return null;
  }

  /** Call on every tick: yields the single press once nothing followed it. */
  due(nowMs: number): Gesture | null {
    if (this.pendingAt === null || nowMs - this.pendingAt <= this.windowMs) {
      return null;
    }
    this.pendingAt = null;

    return 'single';
  }

  reset(): void {
    this.pendingAt = null;
  }
}
