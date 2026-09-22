// Kept in the APK so public userscripts gain touch controls without a separate release feed.
function installAndroidControls(gui, header, panel) {
    if (!gui || !header || !panel) return { restore: function () { return false; } };
    var drag = null;
    header.style.touchAction = 'none';
    panel.style.maxHeight = 'calc(100dvh - 16px)';
    panel.style.maxWidth = 'calc(100vw - 16px)';
    panel.style.overflowY = 'auto';

    function place(left, top) {
        var rect = panel.getBoundingClientRect();
        var x = Math.max(8, Math.min(left, Math.max(8, window.innerWidth - rect.width - 8)));
        var y = Math.max(8, Math.min(top, Math.max(8, window.innerHeight - rect.height - 8)));
        if (panel.style.left !== x + 'px') panel.style.left = x + 'px';
        if (panel.style.top !== y + 'px') panel.style.top = y + 'px';
    }
    function fit() {
        var minimum = Math.max(0, Math.min(230, window.innerWidth - 16)) + 'px';
        if (panel.style.minWidth !== minimum) panel.style.minWidth = minimum;
        if (panel.getClientRects().length) place(parseFloat(panel.style.left) || 20, parseFloat(panel.style.top) || 60);
    }
    function savePosition() {
        try {
            localStorage.setItem('alphajongHintPos', JSON.stringify({
                left: parseFloat(panel.style.left), top: parseFloat(panel.style.top)
            }));
        } catch (_) { /* A storage restriction must not disable the controls. */ }
    }
    // Stop the legacy mouse-only drag listener, including its cancellation of close-button taps.
    header.addEventListener('mousedown', function (event) { event.stopImmediatePropagation(); }, true);
    header.addEventListener('pointerdown', function (event) {
        if (!event.isPrimary || event.button !== 0 || event.target.closest('button,input,select,a')) return;
        event.preventDefault();
        var rect = panel.getBoundingClientRect();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        header.setPointerCapture(event.pointerId);
    });
    header.addEventListener('pointermove', function (event) {
        if (!drag || event.pointerId !== drag.id) return;
        event.preventDefault();
        place(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
    });
    function finish(event) {
        if (!drag || event.pointerId !== drag.id) return;
        drag = null;
        if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
        savePosition();
    }
    header.addEventListener('pointerup', finish);
    header.addEventListener('pointercancel', finish);
    // Close taps must work after a drag even when the WebView suppresses compatibility clicks.
    var close = header.querySelector('button');
    var closeTouch = null;
    if (close) {
        close.addEventListener('pointerdown', function (event) {
            if (event.isPrimary && event.pointerType !== 'mouse') {
                closeTouch = { id: event.pointerId, x: event.clientX, y: event.clientY };
            }
        });
        close.addEventListener('pointerup', function (event) {
            if (!closeTouch || closeTouch.id !== event.pointerId) return;
            var tap = Math.hypot(event.clientX - closeTouch.x, event.clientY - closeTouch.y) <= 12;
            closeTouch = null;
            if (tap) { event.preventDefault(); close.click(); }
        });
        close.addEventListener('pointercancel', function () { closeTouch = null; });
    }
    window.addEventListener('resize', fit);
    if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(panel);
    fit();
    return {
        restore: function () {
            gui.style.display = 'block';
            fit();
            return gui.isConnected;
        }
    };
}
