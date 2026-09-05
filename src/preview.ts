#!/usr/bin/env node
/**
 * Renders the very frame the Bar would draw, to PNGs, with no device involved.
 *
 * The cover is the part most likely to be wrong, and judging a dither by
 * squinting at an 80px greyscale panel across the desk is a bad loop. This
 * writes the same pixels at 8x so a banding problem is obvious.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RectangleElement, TextElement } from '@busy-app/busy-lib';
import { renderBack, renderFront, type Bitmap } from 'busybar-kit/preview';
import { renderArtwork } from './art/index.js';
import type { Element } from './bar/elements.js';
import { backElements, frontElements } from './bar/elements.js';
import { loadConfig, loadEnvFile } from './config.js';
import { FIXTURE_TRACK, fixtureArtwork } from './fixtures.js';
import { createSource } from './media/index.js';
import type { NowPlaying } from './media/types.js';
import { buildFrame } from './view/frame.js';
import { BACK } from './view/layout.js';

loadEnvFile();
const { config } = loadConfig();

const args = new Set(process.argv.slice(2));
const useFixture = args.has('--fixture');
const scale = Number(readOption('--scale') ?? 8);
const outDir = readOption('--out') ?? 'preview';

const { track, artwork, label } = useFixture ? fixture() : await live();

const nowMs = Date.now();
// The fixture's sample time is relative, so anchor it to this render.
const anchored: NowPlaying = { ...track, positionAt: track.positionAt || nowMs };
const art = artwork
  ? renderArtwork(artwork.bytes, artwork.mime, {
      contrast: config.artContrast,
    })
  : null;

const frame = buildFrame(anchored, {
  nowMs,
  artFile: art ? 'art-0.png' : '',
  ledColor: null,
});

const front = renderFront(drawable(frontElements(frame)));
const back = renderBack(drawable(backElements(frame)));
// The raster knows text and rectangles; an image element is a path it cannot
// follow, so the cover is composited the way the device would show it.
if (art) {
  back.blit(art.bitmap, BACK.artX, BACK.artY);
}

mkdirSync(outDir, { recursive: true });
write(join(outDir, 'front.png'), front);
write(join(outDir, 'back.png'), back);
if (art) {
  write(join(outDir, 'art.png'), art.bitmap);
}

console.log(`busybar-nowplaying preview — ${label}`);
console.log(`  ${frame.backTitle} / ${frame.backArtist}`);
console.log(
  `  ${frame.backElapsed} / ${frame.backDuration}   front bar ${frame.frontFill}/72px`,
);
console.log(
  `  wrote ${outDir}/front.png, ${outDir}/back.png${art ? `, ${outDir}/art.png` : ' (no cover)'}`,
);

function write(path: string, bitmap: Bitmap) {
  writeFileSync(path, scale > 1 ? bitmap.scale(scale).toPng() : bitmap.toPng());
}

function drawable(elements: Element[]): Array<TextElement | RectangleElement> {
  return elements.filter(
    (element): element is TextElement | RectangleElement => element.type !== 'image',
  );
}

function fixture() {
  return {
    track: FIXTURE_TRACK,
    artwork: { bytes: fixtureArtwork(), mime: 'image/png' },
    label: 'fixture',
  };
}

async function live() {
  const source = createSource({
    kind: config.sourceKind,
    appFilter: config.appFilter,
    timeoutMs: config.requestTimeoutMs,
  });
  await source.start();
  const track = await source.read();
  if (!track) {
    await source.stop();
    console.warn('Nothing is playing — falling back to the fixture');

    return fixture();
  }

  const artwork = await source.artwork(track).catch(() => null);
  await source.stop();

  return { track, artwork, label: `${source.name}, live` };
}

function readOption(name: string) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(name);

  return index >= 0 ? argv[index + 1] : undefined;
}
