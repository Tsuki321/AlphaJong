package com.alphajong.shell

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView

/** Non-exported host for emulator tests; excluded from release builds. */
class WebViewTestActivity : Activity() {
    lateinit var browser: WebView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        browser = WebView(this)
        setContentView(browser)
    }
    override fun onDestroy() {
        browser.destroy()
        super.onDestroy()
    }
}
