package com.alphajong.shell

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient

/** WebView owns documents, redirects, cookies, CSP, compression and game asset loading. */
class GameWebViewClient(
    private val onStarted: () -> Unit,
    private val onFinished: (String) -> Unit,
    private val onError: (String) -> Unit,
    private val onRendererGone: (WebView) -> Unit,
    private val onExternalLink: (Uri) -> Unit
) : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (request.url.scheme.equals("https", ignoreCase = true)) return false
        if (request.isForMainFrame && request.hasGesture()) onExternalLink(request.url)
        return true
    }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) = onStarted()
    override fun onPageFinished(view: WebView, url: String) = onFinished(url)

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) onError("Could not load Mahjong Soul: ${error.description}")
    }

    override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
        if (request.isForMainFrame) onError("Mahjong Soul returned HTTP ${response.statusCode}.")
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        onRendererGone(view)
        return true
    }
}
