import { BASE_COLORS } from 'busybar-kit/colors';

export const COLORS = {
  ...BASE_COLORS,

  /**
   * Front: the filled part of the bar sits *behind* the text, so it has to be
   * dark enough to read white on. It is the only colour on the front display
   * doing work, which is why the rest of the strip stays plain.
   */
  progress: '#17263FFF',
  progressPaused: '#1C1C1CFF',

  title: '#FFFFFFFF',
  titlePaused: '#8A8A8AFF',
  artist: '#9AA0A6FF',
  artistPaused: '#5F6368FF',
  time: '#9AA0A6FF',
  timePaused: '#5F6368FF',

  /** The volume bar, brighter than the track's: it is a deliberate action. */
  volume: '#2E4A7DFF',

  /** A short blue blink on a new track, and nothing else — songs are frequent. */
  ledTrack: '#2B7FFFFF',

  /** Back: 16 greys, so the hierarchy is brightness and position, not hue. */
  backTitle: '#FFFFFFFF',
  backArtist: '#C8C8C8FF',
  backAlbum: '#8A8A8AFF',
  backGroove: '#3A3A3AFF',
  backFill: '#E6E6E6FF',
  backTime: '#C8C8C8FF',
  backSource: '#6E6E6EFF',
} as const;
