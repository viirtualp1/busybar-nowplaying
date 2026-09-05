import type { ImageElement, RectangleElement, TextElement } from '@busy-app/busy-lib';
import { COLORS } from '../view/colors.js';
import type { NowPlayingFrame, VolumeView } from '../view/frame.js';
import { BACK, FRONT } from '../view/layout.js';

export type Element = TextElement | RectangleElement | ImageElement;

/**
 * The front strip: the bar behind, two rows of text on top. Rectangles come
 * first because elements paint in array order.
 */
export function frontElements(frame: NowPlayingFrame): Element[] {
  if (frame.volume) {
    return volumeElements(frame.volume);
  }
  const filled = frame.frontFill > 0 && frame.active;

  return [
    rectangle(
      'progress',
      'front',
      0,
      0,
      Math.max(1, frame.frontFill),
      FRONT.height,
      filled
        ? frame.paused
          ? COLORS.progressPaused
          : COLORS.progress
        : COLORS.transparent,
    ),
    text({
      id: 'title',
      display: 'front',
      value: frame.frontTitle,
      font: 'small',
      color: frame.paused ? COLORS.titlePaused : COLORS.title,
      x: 1,
      y: FRONT.titleY,
      width: FRONT.titleWidth,
    }),
    text({
      id: 'artist',
      display: 'front',
      value: frame.frontArtist,
      font: 'tiny',
      color: frame.paused ? COLORS.artistPaused : COLORS.artist,
      x: 1,
      y: FRONT.bottomY,
      width: FRONT.artistWidth,
    }),
    text({
      id: 'time',
      display: 'front',
      value: frame.frontTime,
      font: 'tiny',
      color: frame.paused ? COLORS.timePaused : COLORS.time,
      x: FRONT.width - 1,
      y: FRONT.bottomY,
      width: FRONT.timeWidth,
      align: 'top_right',
    }),
  ];
}

/**
 * Turning the knob hands the front strip over, the way the ticker takes the
 * bottom row in the Dota app: the bar *is* the volume for a moment, then gives
 * the track back. Same element ids, so nothing has to be cleared in between.
 */
function volumeElements(volume: VolumeView): Element[] {
  const value = volume.value;

  return [
    rectangle(
      'progress',
      'front',
      0,
      0,
      value === null ? 1 : Math.max(1, Math.round((value / 100) * FRONT.width)),
      FRONT.height,
      value === null ? COLORS.transparent : COLORS.volume,
    ),
    text({
      id: 'title',
      display: 'front',
      value: value === null ? 'VOL' : String(value),
      font: 'bold',
      color: COLORS.title,
      x: 2,
      // Bold is twice the height of the small font, so it stands across both
      // rows: the label goes beside it rather than under it.
      y: FRONT.volumeY,
      width: FRONT.titleWidth,
    }),
    text({
      id: 'artist',
      display: 'front',
      // With no reading to show, the direction is the whole message.
      value: value === null ? (volume.direction === 'up' ? 'UP' : 'DOWN') : 'VOLUME',
      font: 'tiny',
      color: COLORS.artist,
      x: FRONT.width - 1,
      y: FRONT.bottomY,
      width: FRONT.artistWidth,
      align: 'top_right',
    }),
    text({
      id: 'time',
      display: 'front',
      value: '',
      font: 'tiny',
      color: COLORS.transparent,
      x: FRONT.width - 1,
      y: FRONT.bottomY,
      width: FRONT.timeWidth,
      align: 'top_right',
    }),
  ];
}

/** The back panel: the cover on the left, who and how far on the right. */
export function backElements(frame: NowPlayingFrame): Element[] {
  const elements: Element[] = [
    // Painted whether or not there is a cover, so a track without art shows a
    // clean square rather than the previous one.
    rectangle(
      'art-bg',
      'back',
      BACK.artX,
      BACK.artY,
      BACK.artSize,
      BACK.artSize,
      COLORS.panelDark,
    ),
  ];

  if (frame.artFile) {
    elements.push({
      id: 'art',
      type: 'image',
      display: 'back',
      align: 'top_left',
      x: BACK.artX,
      y: BACK.artY,
      path: frame.artFile,
      opacity: 100,
      timeout: 0,
    });
  }

  elements.push(
    text({
      id: 'back-title',
      display: 'back',
      value: frame.backTitle,
      font: 'small',
      color: COLORS.backTitle,
      x: BACK.panelX,
      y: BACK.titleY,
      width: BACK.textWidth,
    }),
    text({
      id: 'back-artist',
      display: 'back',
      value: frame.backArtist,
      font: 'tiny',
      color: COLORS.backArtist,
      x: BACK.panelX,
      y: BACK.artistY,
      width: BACK.textWidth,
    }),
    text({
      id: 'back-album',
      display: 'back',
      value: frame.backAlbum,
      font: 'tiny',
      color: COLORS.backAlbum,
      x: BACK.panelX,
      y: BACK.albumY,
      width: BACK.textWidth,
    }),
    rectangle(
      'groove',
      'back',
      BACK.panelX,
      BACK.grooveY,
      BACK.grooveWidth,
      BACK.grooveHeight,
      frame.active ? COLORS.backGroove : COLORS.transparent,
    ),
    rectangle(
      'groove-fill',
      'back',
      BACK.panelX,
      BACK.grooveY,
      Math.max(1, frame.backFill),
      BACK.grooveHeight,
      frame.active && frame.backFill > 0 ? COLORS.backFill : COLORS.transparent,
    ),
    rectangle(
      'times-bg',
      'back',
      BACK.panelX,
      BACK.timesY,
      BACK.textWidth,
      BACK.timesHeight,
      COLORS.panelDark,
    ),
    text({
      id: 'back-elapsed',
      display: 'back',
      value: frame.backElapsed,
      font: 'small',
      color: COLORS.backTime,
      x: BACK.panelX,
      y: BACK.timesY,
      width: BACK.timeWidth,
    }),
    text({
      id: 'back-duration',
      display: 'back',
      value: frame.backDuration,
      font: 'small',
      color: COLORS.backTime,
      x: BACK.width - 2,
      y: BACK.timesY,
      width: BACK.timeWidth,
      align: 'top_right',
    }),
    text({
      id: 'back-source',
      display: 'back',
      value: frame.backSource,
      font: 'tiny',
      color: COLORS.backSource,
      x: BACK.panelX,
      y: BACK.sourceY,
      width: BACK.textWidth,
    }),
  );

  return elements;
}

type TextSpec = {
  id: string;
  display: 'front' | 'back';
  value: string;
  font: TextElement['font'];
  color: string;
  x: number;
  y: number;
  width: number;
  align?: TextElement['align'];
};

/**
 * An empty slot is drawn as a transparent space rather than dropped: the Bar
 * keeps elements it is not told about, so a vanished line would otherwise stay
 * on screen from the frame before.
 */
function text(spec: TextSpec): TextElement {
  return {
    id: spec.id,
    type: 'text',
    text: spec.value || ' ',
    font: spec.font,
    color: spec.value ? spec.color : COLORS.transparent,
    display: spec.display,
    align: spec.align ?? 'top_left',
    x: spec.x,
    y: spec.y,
    width: spec.width,
    timeout: 0,
  };
}

function rectangle(
  id: string,
  display: 'front' | 'back',
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): RectangleElement {
  return {
    id,
    type: 'rectangle',
    display,
    align: 'top_left',
    x,
    y,
    width: Math.max(1, width),
    height,
    fill: 'solid',
    fill_colors: [color],
    border_width: 0,
    border_color: COLORS.transparent,
    timeout: 0,
  };
}
