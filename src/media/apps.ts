/**
 * Both backends identify the player by an id meant for machines — a bundle id
 * on macOS, an AUMID on Windows. The back panel has room for a name, so turn
 * those into something a person would write.
 */
const KNOWN: Record<string, string> = {
  'com.google.chrome': 'Chrome',
  'com.google.chrome.canary': 'Chrome',
  'com.apple.safari': 'Safari',
  'com.apple.safaritechnologypreview': 'Safari',
  'com.apple.music': 'Apple Music',
  'com.apple.podcasts': 'Podcasts',
  'com.apple.tv': 'Apple TV',
  'com.spotify.client': 'Spotify',
  'org.mozilla.firefox': 'Firefox',
  'com.microsoft.edgemac': 'Edge',
  'com.brave.browser': 'Brave',
  'company.thebrowser.browser': 'Arc',
  'com.github.th-ch.youtube-music': 'YouTube Music',
  'app.ytmdesktop.ytmdesktop': 'YouTube Music',
  // Chrome derives a PWA's id from its start URL, so this one is the same on
  // every machine that installs music.youtube.com as an app.
  cinhimbnkkaeohfgghhklpknlkffjgod: 'YouTube Music',
  'chrome.exe': 'Chrome',
  'msedge.exe': 'Edge',
  'firefox.exe': 'Firefox',
  'spotify.exe': 'Spotify',
  'ytmdesktop.exe': 'YouTube Music',
};

export function appLabelFor(id: string): string {
  const key = id.trim().toLowerCase();
  if (!key) {
    return '';
  }
  const known = KNOWN[key];
  if (known) {
    return known;
  }

  // A web app installed through Chrome reports `com.google.Chrome.app.<id>`.
  // Name the web app when we know it, and fall back to the browser — "Chrome"
  // is at least true, where the raw hash is noise.
  const installed = /^(.*)\.app\.([a-p]{32})$/.exec(key);
  if (installed) {
    const [, browser = '', app = ''] = installed;

    return KNOWN[app] ?? KNOWN[browser] ?? prettify(browser);
  }

  if (key.includes('youtube') && key.includes('music')) {
    return 'YouTube Music';
  }

  return prettify(key);
}

/**
 * Last meaningful segment of the id, spelled like a name: `com.foo.BarPlayer`
 * and `BarPlayer.exe` both come out as "Barplayer".
 */
function prettify(key: string) {
  const segment =
    key
      .replace(/\.exe$/, '')
      .split(/[.!\\/]/)
      .filter(Boolean)
      .at(-1) ?? key;
  const words = segment.replace(/[_-]+/g, ' ').trim();

  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}
