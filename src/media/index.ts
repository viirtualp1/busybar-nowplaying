import { MacosSource } from './macos.js';
import type { MediaSource } from './types.js';
import { WindowsSource } from './windows.js';

export type SourceKind = 'auto' | 'macos' | 'windows';

export const SOURCE_KINDS: SourceKind[] = ['auto', 'macos', 'windows'];

export type SourceOptions = {
  kind?: SourceKind;
  appFilter?: string;
  timeoutMs?: number;
};

/**
 * Both platforms expose a system-wide "now playing" session — MediaRemote on
 * macOS, SMTC on Windows — and a browser publishes into it on the strength of
 * `navigator.mediaSession` alone. That is why there is no YouTube Music client
 * anywhere in this app.
 */
export function createSource(options: SourceOptions = {}): MediaSource {
  const kind = options.kind ?? 'auto';
  const appFilter = options.appFilter ?? '';
  const resolved = kind === 'auto' ? platformKind() : kind;

  if (resolved === 'macos') {
    return new MacosSource({
      appFilter,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
  }

  return new WindowsSource({ appFilter });
}

function platformKind(): Exclude<SourceKind, 'auto'> {
  if (process.platform === 'darwin') {
    return 'macos';
  }
  if (process.platform === 'win32') {
    return 'windows';
  }

  throw new Error(
    `no media source for ${process.platform} — macOS and Windows are supported, set MEDIA_SOURCE to force one`,
  );
}

export * from './types.js';
