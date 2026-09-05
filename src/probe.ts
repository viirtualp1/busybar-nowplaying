#!/usr/bin/env node
/**
 * What the media backend is actually saying, with no Bar in the loop. This is
 * the first thing to run on a new machine — especially on Windows, where the
 * session list contains every player at once.
 */
import { writeFileSync } from 'node:fs';
import { errorMessage } from 'busybar-kit/errors';
import { renderArtwork } from './art/index.js';
import { loadConfig, loadEnvFile } from './config.js';
import { createSource } from './media/index.js';
import { PositionClock, positionAt } from './media/position.js';
import type { NowPlaying } from './media/types.js';
import { clockOf, durationOf } from './view/format.js';

loadEnvFile();
const { config, warnings } = loadConfig();

const args = new Set(process.argv.slice(2));
const once = args.has('--once');
const dumpArt = args.has('--art');

const source = createSource({
  kind: config.sourceKind,
  appFilter: config.appFilter,
  timeoutMs: config.requestTimeoutMs,
});

for (const warning of warnings) {
  console.warn(warning);
}

try {
  await source.start();
} catch (error) {
  console.error(errorMessage(error));
  process.exit(1);
}

console.log(`busybar-nowplaying probe — source ${source.name}, every ${config.pollMs}ms`);

const clock = new PositionClock();
let lastTrackId = '';
let running = true;

process.on('SIGINT', () => {
  running = false;
});

do {
  try {
    const track = clock.update(await source.read(), Date.now());
    console.log(describe(track));

    if (dumpArt && track && track.trackId !== lastTrackId) {
      lastTrackId = track.trackId;
      await dump(track);
    }
  } catch (error) {
    console.warn(`read failed: ${errorMessage(error)}`);
  }

  if (once) {
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, config.pollMs));
} while (running);

await source.stop();

function describe(track: NowPlaying | null) {
  const stamp = new Date().toISOString().slice(11, 19);
  if (!track) {
    return `${stamp}  —  nothing playing`;
  }

  const position = positionAt(track, Date.now());

  return [
    stamp,
    track.playing ? '>' : '||',
    `${track.title} — ${track.artist}`,
    `${clockOf(position)}/${durationOf(track.durationMs)}`,
    track.album ? `[${track.album}]` : '',
    `${track.appLabel} (${track.app})`,
  ]
    .filter(Boolean)
    .join('  ');
}

/** Writes both the original cover and the 16-grey version next to each other. */
async function dump(track: NowPlaying) {
  const artwork = await source.artwork(track);
  if (!artwork) {
    console.log('   no cover published for this track');

    return;
  }

  const extension = artwork.mime.includes('png') ? 'png' : 'jpg';
  writeFileSync(`probe-art-source.${extension}`, artwork.bytes);
  const rendered = renderArtwork(artwork.bytes, artwork.mime, {
    contrast: config.artContrast,
  });
  writeFileSync('probe-art-bar.png', rendered.bitmap.scale(6).toPng());
  console.log(
    `   cover ${artwork.mime}, ${artwork.bytes.length} bytes → probe-art-source.${extension}, probe-art-bar.png`,
  );
}
