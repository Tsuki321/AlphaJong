package com.alphajong.shell

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.ScriptHandler
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date

class MainActivity : AppCompatActivity() {
    private lateinit var repository: ScriptRepository
    private lateinit var root: View
    private lateinit var toolbar: MaterialToolbar
    private lateinit var browserContainer: FrameLayout
    private lateinit var blocking: View
    private lateinit var progress: ProgressBar
    private lateinit var blockingMessage: TextView
    private var webView: WebView? = null
    private var handler: ScriptHandler? = null
    private var installed: CachedScript? = null
    private var available: CachedScript? = null
    private var updateJob: Job? = null
    private var bootstrapJob: Job? = null
    private var foregroundJob: Job? = null
    private var initialized = false
    private var pageFailed = false
    private var pageReady = false
    private var navigation = 0
    private var fullScreenCallback: WebChromeClient.CustomViewCallback? = null
    private val template by lazy { assets.open("document-start.js").bufferedReader().use { it.readText() } }
    private val mobileControls by lazy { assets.open("mobile-controls.js").bufferedReader().use { it.readText() } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)
        repository = ScriptRepository.get(this)
        root = findViewById(R.id.root)
        toolbar = findViewById(R.id.toolbar)
        browserContainer = findViewById(R.id.browser_container)
        blocking = findViewById(R.id.blocking)
        progress = findViewById(R.id.progress)
        blockingMessage = findViewById(R.id.blocking_message)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val padding = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or
                    WindowInsetsCompat.Type.ime()
            )
            view.setPadding(padding.left, padding.top, padding.right, padding.bottom)
            insets
        }
        WindowInsetsControllerCompat(window, root).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        ViewCompat.requestApplyInsets(root)
        toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_refresh_script -> checkUpdates(force = true, announce = true)
                R.id.action_reload -> confirmReload()
                R.id.action_restore_controls -> webView?.evaluateJavascript(ScriptInjection.RESTORE_CONTROLS) {
                    if (it != "true") showMessage(getString(R.string.controls_not_ready))
                }
                R.id.action_script_info -> showScriptInfo()
                else -> return@setOnMenuItemClickListener false
            }
            true
        }
        findViewById<View>(R.id.retry).setOnClickListener {
            if (webView == null || installed == null) bootstrap()
            else lifecycleScope.launch {
                val saved = withContext(Dispatchers.IO) { repository.cached() }
                if (saved != null) loadScript(saved, reload = true)
                else { installed = null; checkUpdates(force = true, announce = true) }
            }
        }
        findViewById<View>(R.id.update_webview).setOnClickListener {
            openExternal(Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.webview"))
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (fullScreenCallback != null) exitFullscreen()
                else if (webView?.canGoBack() == true) webView?.goBack()
                else finish()
            }
        })
        bootstrap()
    }

    private fun bootstrap() {
        if (bootstrapJob?.isActive == true || !ensureWebView()) return
        bootstrapJob = lifecycleScope.launch {
            val saved = withContext(Dispatchers.IO) { repository.cached() }
            available = saved
            if (saved != null) loadScript(saved)
            else installed = null
            initialized = true
            checkUpdates(force = saved == null, announce = false)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun ensureWebView(): Boolean {
        if (webView != null) return true
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
        ) {
            showBlocking(getString(R.string.webview_too_old), busy = false, updateWebView = true)
            return false
        }
        val view = WebView(this)
        webView = view
        browserContainer.addView(view, FrameLayout.LayoutParams(-1, -1))
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            javaScriptCanOpenWindowsAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(view, "AlphaJongAndroidStatus", GameClient.origins) { sender, message, origin, mainFrame, _ ->
                if (sender !== webView || !mainFrame || !GameClient.isGameUrl(origin.toString()) ||
                    message.type != WebMessageCompat.TYPE_STRING
                ) return@addWebMessageListener
                val text = message.data ?: return@addWebMessageListener
                if (text.length > 512) return@addWebMessageListener
                val data = runCatching { JSONObject(text) }.getOrNull() ?: return@addWebMessageListener
                val script = installed ?: return@addWebMessageListener
                if (data.optString("sha256") != script.sha256 || pageFailed) return@addWebMessageListener
                when (data.optString("type")) {
                    "ready" -> scriptReady(script)
                    "error" -> scriptFailed(script)
                    "unsupported" -> {
                        pageFailed = true
                        showBlocking(getString(R.string.unsupported_graphics), busy = false, updateWebView = true)
                    }
                }
            }
        }
        view.webViewClient = GameWebViewClient(
            onStarted = { navigation++; pageReady = false; pageFailed = false },
            onFinished = { url ->
                val script = installed
                val generation = navigation
                if (!pageFailed && !pageReady && script != null && GameClient.isGameUrl(url)) {
                    view.evaluateJavascript(ScriptInjection.readyCheck(script.sha256)) { result ->
                        if (view === webView && generation == navigation && !pageFailed && !pageReady) {
                            if (result == "true") scriptReady(script) else scriptFailed(script)
                        }
                    }
                }
            },
            onError = { message -> pageFailed = true; showBlocking(message, busy = false) },
            onRendererGone = { dead ->
                if (dead === webView) {
                    exitFullscreen()
                    webView = null
                    handler = null
                    browserContainer.removeView(dead)
                    dead.destroy()
                    showBlocking(getString(R.string.renderer_gone), busy = false)
                }
            },
            onExternalLink = ::openExternal
        )
        view.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(customView: View, callback: CustomViewCallback) {
                if (fullScreenCallback != null) { callback.onCustomViewHidden(); return }
                fullScreenCallback = callback
                findViewById<View>(R.id.normal_content).visibility = View.GONE
                findViewById<FrameLayout>(R.id.fullscreen).apply {
                    addView(customView, FrameLayout.LayoutParams(-1, -1))
                    visibility = View.VISIBLE
                }
                WindowInsetsControllerCompat(window, root).apply {
                    systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    hide(WindowInsetsCompat.Type.systemBars())
                }
            }
            override fun onHideCustomView() = exitFullscreen()
        }
        return true
    }

    private fun checkUpdates(force: Boolean, announce: Boolean) {
        if (!initialized || updateJob?.isActive == true) return
        if (installed == null) showBlocking(getString(R.string.fetching_script), busy = true)
        updateJob = lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { repository.refresh(force) }
                available = result.script
                if (installed == null) loadScript(result.script)
                else {
                    updateSubtitle()
                    if (result.warning != null) showMessage(getString(R.string.using_saved, result.warning))
                    else if (installed?.sha256 != result.script.sha256) {
                        Snackbar.make(root, getString(R.string.update_ready, result.script.version), Snackbar.LENGTH_LONG)
                            .setAction(R.string.reload_page) { confirmReload() }.show()
                    } else if (announce) showMessage(getString(R.string.script_current, result.script.version))
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                val message = error.message ?: getString(R.string.fetch_failed)
                if (installed == null) showBlocking(message, busy = false) else showMessage(message)
            }
        }
    }

    private fun loadScript(script: CachedScript, reload: Boolean = false) {
        if (!ensureWebView() || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        val view = webView ?: return
        handler?.remove()
        handler = WebViewCompat.addDocumentStartJavaScript(
            view, ScriptInjection.render(script, template, mobileControls), GameClient.origins
        )
        installed = script
        available = script
        pageReady = false
        pageFailed = false
        updateSubtitle()
        showBlocking(getString(R.string.loading_game), busy = true)
        if (reload && view.url?.let(GameClient::isGameUrl) == true) view.reload()
        else view.loadUrl(GameClient.GLOBAL_URL)
    }

    private fun scriptReady(script: CachedScript) {
        pageReady = true
        blocking.visibility = View.GONE
        updateSubtitle()
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) { repository.confirmStarted(script) }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                showMessage(getString(R.string.cache_write_failed))
            }
        }
    }

    private fun scriptFailed(script: CachedScript) {
        if (pageFailed) return
        pageFailed = true
        val generation = navigation
        lifecycleScope.launch {
            try {
                val fallback = withContext(Dispatchers.IO) { repository.rejectStartup(script.sha256) }
                available = fallback
                if (generation != navigation || isFinishing) return@launch
                val message = if (fallback != null) getString(R.string.script_failed_fallback, fallback.version)
                    else getString(R.string.script_failed)
                showBlocking(message, busy = false)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                showBlocking(getString(R.string.cache_write_failed), busy = false)
            }
        }
    }

    private fun confirmReload() {
        MaterialAlertDialogBuilder(this).setTitle(R.string.reload_title).setMessage(R.string.reload_message)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.reload_page) { _, _ ->
                lifecycleScope.launch {
                    val saved = withContext(Dispatchers.IO) { repository.cached() }
                    if (saved != null) loadScript(saved, reload = true)
                    else { installed = null; checkUpdates(force = true, announce = true) }
                }
            }.show()
    }

    private fun showScriptInfo() {
        lifecycleScope.launch {
            val info = withContext(Dispatchers.IO) { repository.info() }
            val checked = if (info.checkedAtEpochMs == 0L) getString(R.string.never_checked)
                else DateFormat.getDateTimeInstance().format(Date(info.checkedAtEpochMs))
            MaterialAlertDialogBuilder(this@MainActivity).setTitle(R.string.script_info)
                .setMessage(getString(R.string.script_details, installed?.version ?: "—", info.current?.version ?: "—", checked))
                .setPositiveButton(android.R.string.ok, null)
                .setNeutralButton(R.string.view_source) { _, _ -> openExternal(Uri.parse(GameClient.SCRIPT_URL)) }
                .show()
        }
    }

    private fun updateSubtitle() {
        val running = installed ?: return
        toolbar.subtitle = getString(
            if (available != null && available?.sha256 != running.sha256) R.string.script_pending else R.string.script_status,
            running.version
        )
    }

    private fun showBlocking(message: String, busy: Boolean, updateWebView: Boolean = false) {
        blocking.visibility = View.VISIBLE
        blockingMessage.text = message
        progress.visibility = if (busy) View.VISIBLE else View.GONE
        findViewById<View>(R.id.retry).visibility = if (busy) View.GONE else View.VISIBLE
        findViewById<View>(R.id.update_webview).visibility = if (updateWebView) View.VISIBLE else View.GONE
    }

    private fun showMessage(message: String) = Snackbar.make(root, message, Snackbar.LENGTH_LONG).show()

    private fun openExternal(uri: Uri) {
        if (uri.scheme?.lowercase() !in setOf("https", "http", "mailto", "market")) {
            showMessage(getString(R.string.external_link_unsupported))
            return
        }
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            showMessage(getString(R.string.external_link_unsupported))
        }
    }

    private fun exitFullscreen() {
        val callback = fullScreenCallback ?: return
        fullScreenCallback = null
        findViewById<FrameLayout>(R.id.fullscreen).apply { removeAllViews(); visibility = View.GONE }
        findViewById<View>(R.id.normal_content).visibility = View.VISIBLE
        WindowInsetsControllerCompat(window, root).show(WindowInsetsCompat.Type.systemBars())
        callback.onCustomViewHidden()
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        foregroundJob?.cancel()
        foregroundJob = lifecycleScope.launch {
            while (isActive) {
                checkUpdates(force = false, announce = false)
                delay(ScriptRepository.CHECK_INTERVAL_MS)
            }
        }
    }

    override fun onPause() {
        foregroundJob?.cancel()
        webView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        exitFullscreen()
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) handler?.remove()
        handler = null
        webView?.let { browserContainer.removeView(it); it.destroy() }
        webView = null
        super.onDestroy()
    }
}
