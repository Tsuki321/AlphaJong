package com.alphajong.shell

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.net.InetAddress
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
class WebViewInjectionTest {
    private val html = """
        <!doctype html><meta charset="utf-8"><title>Android injection fixture</title>
        <script nonce="game">window.__earlyHook = !!window.__fixtureNativeSocket && WebSocket !== window.__fixtureNativeSocket;</script>
        <script>window.__blockedInline = true;</script><canvas id="unity-canvas"></canvas>
    """.trimIndent()

    private fun server(): MockWebServer = MockWebServer().apply {
        dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse =
                if (request.path == "/redirect") MockResponse().setResponseCode(302).addHeader("Location", "/game")
                else MockResponse().setHeader("Content-Type", "text/html; charset=utf-8")
                    .setHeader("Content-Security-Policy", "script-src 'nonce-game'; object-src 'none'")
                    .setBody(html)
        }
        start(InetAddress.getByName("127.0.0.1"), 0)
    }

    private fun script(): CachedScript {
        val source = """
            // ==UserScript==
            // @name AlphaJong
            // @namespace alphajong
            // @version 1.0.0
            // @grant none
            // @run-at document-start
            // @match https://mahjongsoul.game.yo-star.com/*
            // ==/UserScript==
            window.__fixtureNativeSocket = window.WebSocket;
            window.WebSocket = function() {};
            window.WebSocket.prototype = window.__fixtureNativeSocket.prototype;
            var alphaJongUnityClient = { transport: { getStatus: function() { return { installed: true }; } } };
            var guiDiv = document.createElement('div');
            var hintPanelHeader = null, hintPanelDiv = null;
            document.addEventListener('DOMContentLoaded', function() { document.body.appendChild(guiDiv); });
        """.trimIndent()
        val metadata = UserscriptValidator.validate(source)
        return CachedScript(source, metadata.version, metadata.sha256, null, 1)
    }

    @SuppressLint("SetJavaScriptEnabled", "RequiresFeature")
    private fun install(activity: WebViewTestActivity, origins: Set<String>, started: CountDownLatch): ScriptHandler {
        assertTrue("Current WebView must support document-start scripts", WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
        assertTrue("Current WebView must support scoped messages", WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
        activity.browser.settings.javaScriptEnabled = true
        activity.browser.settings.domStorageEnabled = true
        WebViewCompat.addWebMessageListener(activity.browser, "AlphaJongAndroidStatus", origins) { _, message, _, mainFrame, _ ->
            val data = JSONObject(message.data.orEmpty())
            if (mainFrame && data.optString("type") == "ready") started.countDown()
        }
        val template = activity.assets.open("document-start.js").bufferedReader().use { it.readText() }
        val mobile = activity.assets.open("mobile-controls.js").bufferedReader().use { it.readText() }
        return WebViewCompat.addDocumentStartJavaScript(activity.browser, ScriptInjection.render(script(), template, mobile), origins)
    }

    @Test fun redirectDestinationIsInjectedBeforeGameScriptsWithoutRemovingCsp() {
        val server = server()
        val origin = "http://127.0.0.1:${server.port}"
        val started = CountDownLatch(1)
        val finished = CountDownLatch(1)
        val state = AtomicReference<String>()
        try {
            ActivityScenario.launch(WebViewTestActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    install(activity, setOf(origin), started)
                    activity.browser.webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView, url: String) {
                            if (url.endsWith("/game")) view.evaluateJavascript(
                                "Boolean(window.__earlyHook && !window.__blockedInline && window.__alphaJongAndroidShell.ready)"
                            ) { state.set(it); finished.countDown() }
                        }
                    }
                    activity.browser.loadUrl("$origin/redirect")
                }
                assertTrue("No startup acknowledgment after redirect", started.await(20, TimeUnit.SECONDS))
                assertTrue("Redirect destination did not finish", finished.await(20, TimeUnit.SECONDS))
                assertEquals("Injection must precede the game and preserve CSP enforcement", "true", state.get())
            }
        } finally { server.shutdown() }
    }

    @Test fun unrelatedOriginReceivesNeitherUserscriptNorNativeMessageObject() {
        val server = server()
        val origin = "http://127.0.0.1:${server.port}"
        val finished = CountDownLatch(1)
        val state = AtomicReference<String>()
        try {
            ActivityScenario.launch(WebViewTestActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    install(activity, GameClient.origins, CountDownLatch(1))
                    activity.browser.webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView, url: String) {
                            view.evaluateJavascript("Boolean(!window.__alphaJongAndroidShell && typeof AlphaJongAndroidStatus === 'undefined')") {
                                state.set(it); finished.countDown()
                            }
                        }
                    }
                    activity.browser.loadUrl("$origin/outside")
                }
                assertTrue(finished.await(20, TimeUnit.SECONDS))
                assertEquals("true", state.get())
            }
        } finally { server.shutdown() }
    }

    @Test fun removingScriptDoesNotChangeTheRunningPageAndAppliesAtNextNavigation() {
        val server = server()
        val origin = "http://127.0.0.1:${server.port}"
        val started = CountDownLatch(1)
        val currentChecked = CountDownLatch(1)
        val nextChecked = CountDownLatch(1)
        val currentState = AtomicReference<String>()
        val nextState = AtomicReference<String>()
        var handler: ScriptHandler? = null
        try {
            ActivityScenario.launch(WebViewTestActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    handler = install(activity, setOf(origin), started)
                    activity.browser.webViewClient = object : WebViewClient() {}
                    activity.browser.loadUrl("$origin/game")
                }
                assertTrue(started.await(20, TimeUnit.SECONDS))
                scenario.onActivity { activity ->
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) handler?.remove()
                    activity.browser.evaluateJavascript(ScriptInjection.readyCheck(script().sha256)) {
                        currentState.set(it); currentChecked.countDown()
                    }
                }
                assertTrue(currentChecked.await(10, TimeUnit.SECONDS))
                assertEquals("true", currentState.get())
                scenario.onActivity { activity ->
                    activity.browser.webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView, url: String) {
                            if (url.endsWith("/second")) view.evaluateJavascript("Boolean(!window.__alphaJongAndroidShell)") {
                                nextState.set(it); nextChecked.countDown()
                            }
                        }
                    }
                    activity.browser.loadUrl("$origin/second")
                }
                assertTrue(nextChecked.await(20, TimeUnit.SECONDS))
                assertEquals("true", nextState.get())
            }
        } finally { server.shutdown() }
    }
}
