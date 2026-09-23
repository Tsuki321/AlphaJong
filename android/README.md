# AlphaJong Android Experimental

Android 8.0+ WebView shell for Mahjong Soul Global. Keep Android System WebView
or Chrome updated: the shell requires document-start injection and scoped web
messages. The app reports when the installed WebView lacks these features.

## Script updates

The app downloads the public release at
[master/AlphaJong.user.js](https://raw.githubusercontent.com/Tsuki321/AlphaJong/master/AlphaJong.user.js).
No GitHub account or token is needed. The Android branch does not determine the
userscript channel; only updates published to that master URL are delivered.
Compatible userscript updates do not require rebuilding the APK.

The app opens with its saved script and checks GitHub in the background. Checks
are throttled to five minutes on startup/resume and repeat while the app is in
the foreground. **Check for updates** bypasses that throttle. GitHub caching can
delay visibility of a new release by several minutes. ETags avoid downloading
unchanged content.

Updates are validated and saved for the next reload. The app never reloads an
active game just because an update was found. Use **Reload game** after your
match to apply it. The toolbar distinguishes the running version from a waiting
update. Failed requests keep the saved script usable; first installation still
needs a successful download. Mahjong Soul itself requires a network connection.

Script identity, version, metadata, UTF-8 encoding and size are checked. Older
versions and unsupported userscript-manager dependencies are rejected. Script
and metadata are saved together using Android AtomicFile. A previous version
that acknowledged startup is retained for recovery; an update that fails to
start is rejected until its content changes. This is a startup check, not a
claim that every future game protocol change can be detected automatically.

## Game and controls

The userscript executes at document start on explicit Mahjong Soul HTTPS
origins. WebView handles documents, redirects, cookies and security headers.
The app does not rewrite HTML or remove CSP. Its scoped message object accepts
startup status only; it exposes no file, token or other privileged operations.

**Show controls** in the native toolbar restores a hidden userscript toolbar.
The toolbar is a single 36 dp row with compact icon buttons. **Full screen**
hides the toolbar and Android system bars; use the Android Back button/gesture
to show the toolbar again without reloading the game.

The APK includes compact phone controls and hints for the current public script,
including hint dragging, close taps and viewport clamping. Unavailable Unity
matchmaking controls are hidden. Android system bars, cutouts and the keyboard
are inset correctly. Game fullscreen requests and renderer-exit recovery are
handled.

Sign in through the game and choose a standard match. The current Unity adapter
does not automate matchmaking or highlight recommendations inside the game
canvas. Foreground/background reconnection and real-game performance depend on
the device and WebView. Third-party login providers may impose embedded-browser
restrictions; an external browser cannot automatically share its login session
with this WebView.

## Builds and verification

Builds run in [Android Experimental](../.github/workflows/android.yml) on GitHub
Actions. The complete Gradle 8.11.1 wrapper is checked in, and its distribution
checksum is pinned. The workflow builds the debug APK, runs Android lint and
JVM/Robolectric tests, and exercises a real WebView in an Android 15 emulator.
Emulator fixtures use loopback only. A separate browser job tests the APK's
actual injection template and touch adapter with the current public userscript
and runs the existing 3P/4P Unity integration fixtures.

Download the APK artifact from a successful run on `Android-Experimentals`.
It is an experimental debug-signed build. CI runners can use different debug
keys, so Android may require uninstalling a previous experimental build before
installing another. Production distribution requires a protected, persistent
release signing key; no signing secrets are stored in this repository.

The debug-only instrumentation host is not exported, and only debug builds
permit HTTP loopback fixtures. Release networking permits HTTPS only. App and
WebView data are excluded from backup/device transfer. Release WebView debugging
is disabled. This project does not include a copy of the userscript or game.

See [AUDIT-FIXES.md](AUDIT-FIXES.md) for the audit resolutions and validation scope.
