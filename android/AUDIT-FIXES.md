# Android audit follow-up — 22 September 2026

The initial draft could not compile and used an unfiltered GitHub Actions
artifact feed. This branch replaces that flow with the public master userscript
and addresses the Android-specific audit findings.

| Finding | Resolution |
| --- | --- |
| Incompatible encrypted-storage API | Removed the token flow and security-crypto dependency entirely. |
| Updates could come from any branch | Fixed HTTPS public master URL; redirects cannot change repository/path/branch. Numeric downgrade protection. |
| Cache unusable when GitHub fails | Cached startup before network checking; failures retain the saved version. Conditional ETag requests. |
| Incomplete wrapper and no Android CI | Official complete wrapper, verified wrapper JAR, pinned distribution checksum; APK, lint, JVM and emulator checks in Actions. |
| Android 15 content behind system bars | System-bar, display-cutout and IME insets on the activity root. |
| Redirects could bypass injection | AndroidX document-start injection with explicit origin rules; no HTML interception or CSP removal. |
| Controls could be hidden; mouse-only hints | Native Show controls action and an APK touch adapter with pointer dragging, reliable close taps and viewport clamping. |
| Unvalidated, non-atomic cache replacement | Metadata/content validation, SHA-256 consistency, AtomicFile snapshot, serialized writes, and a confirmed prior version for startup recovery. |
| Limits checked after whole-body allocation | Bounded streaming, early Content-Length rejection, strict UTF-8 decoding; ZIP download/extraction removed. |

Updates check on startup/resume and every five minutes in the foreground.
Downloading a new script never reloads a running match. The user applies it
through Reload game. Renderer loss offers recovery instead of terminating the
app, and obsolete WebViews receive an actionable update message.

The workflow tests HTTP/ETag handling, wrong-source redirects, malformed and
oversized downloads, downgrade rejection, GitHub failures, atomic recovery,
concurrent download/clear behavior and recovery after failed script startup.
Real Android WebView fixtures cover redirect injection, preserved CSP, origin
restrictions and the effect of removing a document-start script. Browser
fixtures use the public userscript and test startup plus touch controls in both
phone orientations.

Local verification before the first push: 26 mobile browser checks passed.
Android compilation and Android tests are run only through GitHub Actions.
See the successful workflow result for the commit being installed; local source
inspection is not Android build evidence.

These checks use fixtures and do not sign into a real Mahjong Soul account or
play a live match. Actual device/GPU performance, provider-specific login flows
and live-match reconnection still require device use. Production signing is
outside this experimental debug-build workflow.
