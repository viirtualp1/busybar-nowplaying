# busybar-nowplaying

> [!IMPORTANT]
> **Unofficial community project.** Built and maintained by [@viirtualp1](https://github.com/viirtualp1), **not** an official Flipper Devices / BUSY product, and not affiliated with, endorsed by, or supported by them. "BUSY Bar" remains their trademark. For the real hardware and official apps, visit **[busy.app](https://busy.app/)**.

Whatever your machine is playing, on a [BUSY Bar](https://busy.app/). The track
on the front, the cover on the back — dithered down to the panel's 16 greys.

Works with YouTube Music, and with everything else, because it does not talk to
any music service at all. It reads the **system** now-playing session: the one
Control Center shows on macOS and the volume overlay shows on Windows. A
YouTube Music tab lands there on the strength of `navigator.mediaSession`, the
same way Spotify or Apple Music does.

## What you get

**Front — the strip is the track**

- The bar behind the text fills with the track, left to right
- Title on the top row, scrolling when it does not fit
- Artist bottom left, **time remaining** bottom right — the bar moves a pixel
  every two or three seconds, so the countdown is what carries the ticking
- Paused dims the whole strip rather than adding an icon

**Back — the cover, and the caption**

- **80×80 of album art**, error-diffusion dithered to the exact 16 greys the
  panel can show, so the device's own quantiser has nothing left to ruin
- Title, artist and album down the right-hand side
- A progress bar with elapsed and total under it
- Which app it came from, in the bottom corner

**Feedback**

- A short blue LED blink when a new track starts, and nothing else. A blink on
  every pause would be a machine gun on the third rewind.
- After a minute of silence the app hands the screen back and the Bar returns
  to whatever it shows on its own.

Non-ASCII titles are transliterated rather than dropped — the device fonts are
ASCII bitmaps, so `Гражданская оборона` reads as `Grazhdanskaya oborona` instead
of eighteen blank pixels.

## Requirements

- Node.js 22+
- BUSY Bar on USB, Wi-Fi or cloud
- **macOS**: [`nowplaying-cli`](https://github.com/kirtan-shah/nowplaying-cli) —
  `brew install nowplaying-cli`
- **Windows**: nothing to install by hand; `npm install` pulls in
  [`windows-media-sessions`](https://github.com/Gyom03/windows-media-sessions),
  which ships its own SMTC backend

## Setup

```bash
npm install
cp .env.example .env   # USB needs nothing changed
npm run dev
```

Check what the media backend is actually saying, with no Bar involved:

```bash
npm run probe
```

Render the exact frame the Bar would draw, to PNGs:

```bash
npm run shot            # from what is playing now
npm run shot -- --fixture
```

## How it works

**The position has to be interpolated, and sometimes invented.** Neither backend
runs a clock. Rendering the reported position straight gives a progress bar that
jumps a second at a time — and with a browser it gives one that never moves at
all.

Measured on macOS 26 with YouTube Music in Chrome: `elapsedTime` is published
once as **0**, with no timestamp, and is never refreshed — not on a seek, not
even across a pause. `playbackRate` is the one field that stays honest (1 while
playing, 0 while paused). A native player publishes a real position; a browser
does not.

So `PositionClock` re-anchors on the _report moving_, not on the report
disagreeing: a backend that keeps repeating the same number is left to one side
and the clock counts on its own. That means with a browser the elapsed time is
counted from **when this app first saw the track** — exact for a track that
starts while it is running, and off by however far in you were if you start the
app mid-song. A backend that does publish a moving position (SMTC, native
players) stays in charge, and a real seek still re-anchors.

**The cover is dithered here, not on the device.** The Bar quantises an uploaded
image to its 16 greys, and a plain nearest-level mapping turns every gradient
into bands. Doing it locally with Floyd–Steinberg on a serpentine scan means
every pixel already sits exactly on a level, so the device's mapping is a no-op.
The pipeline is: decode → centre-crop → box-filter to 80×80 **in linear light**
→ luminance → stretch the histogram → diffuse the error. Linear light matters:
averaging gamma-encoded bytes is the usual reason a downscaled cover comes out
muddier than the original.

**The cover has to be uploaded.** The Bar draws an image by path, from the app's
own assets, so each new track's PNG goes up via `AssetsUpload` before the frame
that references it. File names rotate (`art-0.png`, `art-1.png`, …) because
overwriting the path an element already points at is the one case where nothing
appears to change.

## Configuration

Everything is optional; the defaults assume a Bar on USB and no filtering.

| Variable             | Default | What it does                                                        |
| -------------------- | ------- | ------------------------------------------------------------------- |
| `BUSY_ADDR`          | USB     | Bar address; `https://api.busy.app` for cloud                       |
| `BUSY_HTTP_PASSWORD` | —       | Wi-Fi only (Bar web UI → Network → HTTP API access)                 |
| `BUSY_TOKEN`         | —       | Cloud only                                                          |
| `DRAW_PRIORITY`      | `40`    | How hard to fight other apps for the screen                         |
| `MEDIA_SOURCE`       | `auto`  | `auto`, `macos`, `windows`                                          |
| `MEDIA_APP`          | —       | Only follow players matching this, e.g. `chrome`, `spotify`         |
| `POLL_MS`            | `1000`  | How often the backend is asked; between reads the position is local |
| `FRAME_MS`           | `200`   | Redraw rate                                                         |
| `IDLE_MS`            | `60000` | Silence before the display is handed back                           |
| `ART_CONTRAST`       | `1`     | Stretch the cover's histogram before dithering                      |
| `REQUEST_TIMEOUT_MS` | `10000` | Bar request timeout                                                 |

## Notes

`nowplaying-cli` uses a private Apple framework. It is tested through macOS
Tahoe 26.3 and works on 26.6, but a macOS update can break it — if the probe
starts reporting nothing while music plays, that is the first thing to check.
[`mediaremote-adapter`](https://github.com/ungive/mediaremote-adapter) is the
fallback worth wiring in if it ever does.

On Windows the SMTC session list contains every player at once, so
`npm run probe` is the first thing to run there: it prints which app won and
what it published.

Built on [busybar-kit](https://github.com/viirtualp1/busybar-kit).
