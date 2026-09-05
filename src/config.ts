import { loadBarConfig, loadEnvFile, type BarConfig } from 'busybar-kit/config';
import { SOURCE_KINDS, type SourceKind } from './media/index.js';

export { loadEnvFile };

export type Config = BarConfig & {
  /** Which backend to read the system session from. */
  sourceKind: SourceKind;
  /** Substring of the player's bundle id / AUMID; empty follows anything. */
  appFilter: string;
  pollMs: number;
  frameMs: number;
  idleMs: number;
  requestTimeoutMs: number;
  artContrast: boolean;
  /** Listen to the Bar's buttons and knob. */
  input: boolean;
};

export type LoadedConfig = {
  config: Config;
  warnings: string[];
};

export const DEFAULTS = {
  /**
   * Both backends republish a position about once a second, so polling faster
   * buys nothing: between reports the position is interpolated locally.
   */
  pollMs: 1000,
  /** The countdown ticks in seconds and the title scrolls, so 200ms is plenty. */
  frameMs: 200,
  /** Silence for this long hands the Bar back to whatever else wants it. */
  idleMs: 60_000,
  requestTimeoutMs: 10_000,
} as const;

const LIMITS = {
  pollMs: { min: 200, max: 5000 },
  frameMs: { min: 50, max: 1000 },
  idleMs: { min: 5000, max: 3_600_000 },
  requestTimeoutMs: { min: 1000, max: 30_000 },
} as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LoadedConfig {
  const warnings: string[] = [];
  const { bar, env: reader } = loadBarConfig(env, warnings);
  const { read, number } = reader;

  const requested = read('MEDIA_SOURCE').toLowerCase();
  const sourceKind = SOURCE_KINDS.includes(requested as SourceKind)
    ? (requested as SourceKind)
    : 'auto';
  if (requested && sourceKind === 'auto' && requested !== 'auto') {
    warnings.push(
      `MEDIA_SOURCE=${requested} is not one of ${SOURCE_KINDS.join(', ')}, detecting instead`,
    );
  }

  return {
    warnings,
    config: {
      ...bar,
      sourceKind,
      appFilter: read('MEDIA_APP'),
      pollMs: number('POLL_MS', DEFAULTS.pollMs, LIMITS.pollMs),
      frameMs: number('FRAME_MS', DEFAULTS.frameMs, LIMITS.frameMs),
      idleMs: number('IDLE_MS', DEFAULTS.idleMs, LIMITS.idleMs),
      requestTimeoutMs: number(
        'REQUEST_TIMEOUT_MS',
        DEFAULTS.requestTimeoutMs,
        LIMITS.requestTimeoutMs,
      ),
      artContrast: flag(read('ART_CONTRAST'), true),
      input: flag(read('INPUT'), true),
    },
  };
}

function flag(value: string, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return !/^(0|false|no|off)$/i.test(value.trim());
}
