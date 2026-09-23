// Kept in the APK so public userscripts gain touch controls without a separate release feed.
function installAndroidControls(gui, header, panel, options) {
    if (!gui || !header || !panel) return { restore: function () { return false; } };
    options = options || {};
    Object.assign(gui.style, {
        position: 'fixed', left: '4px', right: '4px', top: '4px', width: 'auto',
        font: '11px/1.2 sans-serif', pointerEvents: 'none'
    });
    var row = gui.firstElementChild;
    if (row) {
        Object.assign(row.style, {
            display: 'inline-flex', flexWrap: options.hideMatchmaking ? 'nowrap' : 'wrap',
            alignItems: 'center', justifyContent: 'center',
            gap: '3px', padding: '2px', maxWidth: '100%', boxSizing: 'border-box',
            borderRadius: '4px', pointerEvents: 'auto'
        });
        Array.from(row.children).forEach(function (control) { control.style.margin = '0'; });
        row.querySelectorAll('button,select,input').forEach(function (control) {
            Object.assign(control.style, {
                font: '11px/1.2 sans-serif', minHeight: '26px', padding: '2px 5px',
                boxSizing: 'border-box', borderRadius: '3px', maxWidth: '160px', flexShrink: '0'
            });
            if (control.type === 'checkbox') {
                Object.assign(control.style, { width: '12px', height: '12px', minHeight: '0', padding: '0' });
            } else if (control.readOnly) {
                Object.assign(control.style, {
                    flex: '1 1 80px', width: 'clamp(60px,24vw,120px)', minWidth: '0', maxWidth: '120px'
                });
                control.setAttribute('aria-label', 'Bot status');
            }
            if (control.tagName === 'BUTTON' && control.textContent === 'Hide GUI') {
                control.setAttribute('aria-label', 'Hide GUI');
                control.textContent = 'Hide';
            }
        });
    }
    if (options.hideMatchmaking) {
        // Unity matchmaking is selected in the game; its disabled desktop controls waste a row.
        if (options.autostart) {
            options.autostart.style.display = 'none';
            Array.from(options.autostart.labels || []).forEach(function (label) { label.style.display = 'none'; });
        }
        if (options.room) options.room.style.display = 'none';
    }
    Array.from(gui.children).slice(1).forEach(function (notice) {
        Object.assign(notice.style, {
            font: '11px/1.3 sans-serif', padding: '5px 8px', margin: '4px auto', maxWidth: '420px',
            maxHeight: '72px', overflowY: 'auto', boxSizing: 'border-box', pointerEvents: 'auto'
        });
    });
    var drag = null;
    Object.assign(header.style, { font: '11px/1.2 sans-serif', padding: '2px 6px' });
    Array.from(panel.children).filter(function (child) { return child !== header; }).forEach(function (content) {
        Object.assign(content.style, { fontSize: '12px', lineHeight: '1.3', padding: '6px 8px' });
    });
    header.style.touchAction = 'none';
    panel.style.maxHeight = 'min(180px,42dvh)';
    panel.style.maxWidth = 'min(320px,calc(100vw - 16px))';
    panel.style.overflowY = 'auto';

    function place(left, top) {
        var rect = panel.getBoundingClientRect();
        var x = Math.max(8, Math.min(left, Math.max(8, window.innerWidth - rect.width - 8)));
        var y = Math.max(8, Math.min(top, Math.max(8, window.innerHeight - rect.height - 8)));
        if (panel.style.left !== x + 'px') panel.style.left = x + 'px';
        if (panel.style.top !== y + 'px') panel.style.top = y + 'px';
    }
    function fit() {
        var minimum = Math.max(0, Math.min(180, window.innerWidth - 16)) + 'px';
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
        Object.assign(close.style, { width: '24px', height: '24px', padding: '0', fontSize: '16px', flex: '0 0 24px' });
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
