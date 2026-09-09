import { defineConfigSpec, integerIn } from 'busybar-kit/config-spec';

export default defineConfigSpec({
  name: 'nowplaying',
  summary: 'What is playing, with the cover art and the knob for volume',
  sections: [
    {
      kind: 'env',
      file: '.env',
      title: 'Settings',
      fields: [
        {
          key: 'MEDIA_SOURCE',
          label: 'Where the track comes from',
          type: 'select',
          fallback: 'auto',
          options: [
            { value: 'auto', label: 'auto', hint: 'whatever this machine offers' },
            { value: 'windows', label: 'windows', hint: 'the system media session' },
            { value: 'demo', label: 'demo', hint: 'a made-up track' },
          ],
        },
        {
          key: 'MEDIA_APP',
          label: 'Only follow one player',
          type: 'text',
          placeholder: 'Spotify.exe',
          hint: 'Empty follows whichever app is playing',
        },
        {
          key: 'INPUT',
          label: 'Let the knob change the volume',
          type: 'boolean',
          fallback: '1',
          hint: 'The window manager leaves the knob alone so this can have it',
        },
        {
          key: 'ART_CONTRAST',
          label: 'Push the cover art contrast',
          type: 'boolean',
          fallback: '1',
          hint: 'The back panel only has sixteen greys to work with',
        },
        {
          key: 'IDLE_MS',
          label: 'Silence before the screen is given back',
          type: 'number',
          advanced: true,
          validate: integerIn(1000, 3_600_000),
        },
        {
          key: 'POLL_MS',
          label: 'How often the player is read',
          type: 'number',
          advanced: true,
          validate: integerIn(100, 60_000),
        },
      ],
    },
  ],
});
