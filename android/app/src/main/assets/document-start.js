(function () {
    if (window.top !== window) return;
    var shellHash = '__ALPHAJONG_HASH__';
    function notify(type) {
        try {
            window.AlphaJongAndroidStatus.postMessage(JSON.stringify({ type: type, sha256: shellHash }));
        } catch (_) { /* The desktop test harness may not provide a native listener. */ }
    }
    if (window.__alphaJongAndroidShell) return;
    try {
        /*__ALPHAJONG_USERSCRIPT__*/

        /*__ALPHAJONG_MOBILE_CONTROLS__*/

        function ready() {
            try {
                if (typeof WebAssembly !== 'object' || typeof WebGL2RenderingContext !== 'function') {
                    notify('unsupported');
                    return;
                }
                if (typeof guiDiv === 'undefined' || !guiDiv.isConnected) throw new Error('Missing controls');
                var hooked = typeof alphaJongUnityClient !== 'undefined' && alphaJongUnityClient &&
                    alphaJongUnityClient.transport.getStatus().installed;
                var legacy = typeof hasLegacyClient === 'function' && hasLegacyClient();
                if (!hooked && !legacy) throw new Error('Missing game connection hook');
                var controls = installAndroidControls(guiDiv,
                    typeof hintPanelHeader === 'undefined' ? null : hintPanelHeader,
                    typeof hintPanelDiv === 'undefined' ? null : hintPanelDiv);
                window.__alphaJongAndroidShell = { sha256: shellHash, ready: true, restoreControls: controls.restore };
                notify('ready');
            } catch (_) { notify('error'); }
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
        else ready();
    } catch (_) { notify('error'); }
})();
