# busybar-nowplaying

> [!IMPORTANT]
> **Unofficial community project.** Built and maintained by [@viirtualp1](https://github.com/viirtualp1), **not** an official Flipper Devices / BUSY product, and not affiliated with, endorsed by, or supported by them. "BUSY Bar" remains their trademark. For the real hardware and official apps, visit **[busy.app](https://busy.app/)**.

Now playing on a [BUSY Bar](https://busy.app/): the track on the front, the
album cover on the back, dithered to the panel's 16 greys.

It reads the system now-playing session rather than any music service, so
YouTube Music in a browser, Spotify and Apple Music all work the same way.

## What you get

- **Front** — a progress bar behind the title, with artist and time remaining
- **Back** — 80×80 album cover, title, artist, album, progress and source app
- Blue LED blink on a new track
- The display is handed back after a minute of silence
- Non-ASCII titles are transliterated, since the device fonts are ASCII only

## Requirements

- Node.js 22+
- BUSY Bar on USB, Wi-Fi or cloud
- **macOS**: `brew install nowplaying-cli`
- **Windows**: nothing extra, `npm install` covers it

## Setup

```bash
npm install
cp .env.example .env   # USB needs nothing changed
npm run dev
```

Two helpers, neither needs a Bar:

```bash
npm run probe   # what the media backend is reporting
npm run shot    # render the frame to PNGs
```

## Configuration

All optional; the defaults assume a Bar on USB.

| Variable             | Default | What it does                                                |
| -------------------- | ------- | ----------------------------------------------------------- |
| `BUSY_ADDR`          | USB     | Bar address; `https://api.busy.app` for cloud               |
| `BUSY_HTTP_PASSWORD` | —       | Wi-Fi only (Bar web UI → Network → HTTP API access)         |
| `BUSY_TOKEN`         | —       | Cloud only                                                  |
| `DRAW_PRIORITY`      | `40`    | How hard to fight other apps for the screen                 |
| `MEDIA_SOURCE`       | `auto`  | `auto`, `macos`, `windows`                                  |
| `MEDIA_APP`          | —       | Only follow players matching this, e.g. `chrome`, `spotify` |
| `POLL_MS`            | `1000`  | How often the media backend is asked                        |
| `FRAME_MS`           | `200`   | Redraw rate                                                 |
| `IDLE_MS`            | `60000` | Silence before the display is handed back                   |
| `ART_CONTRAST`       | `1`     | Stretch the cover's contrast before dithering               |
| `REQUEST_TIMEOUT_MS` | `10000` | Bar request timeout                                         |

## Known limits

- Browsers publish a playback position once and never update it, so elapsed
  time is counted from when this app first saw the track. Start it before the
  song and it is exact; start it mid-song and it is off by where you were.
- `nowplaying-cli` uses a private Apple framework and a macOS update can break
  it. If `npm run probe` shows nothing while music plays, check that first.
- On Windows every player is in the session list at once; `MEDIA_APP` picks one.

Built on [busybar-kit](https://github.com/viirtualp1/busybar-kit).
