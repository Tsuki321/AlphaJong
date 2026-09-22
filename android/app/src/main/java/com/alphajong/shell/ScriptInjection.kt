package com.alphajong.shell

/** Source is added last so tokens inside the downloaded script are never substituted. */
object ScriptInjection {
    fun render(script: CachedScript, template: String, mobileControls: String): String = template
        .replace("__ALPHAJONG_HASH__", script.sha256)
        .replace("/*__ALPHAJONG_MOBILE_CONTROLS__*/", mobileControls)
        .replace("/*__ALPHAJONG_USERSCRIPT__*/", script.source)

    const val RESTORE_CONTROLS = "Boolean(window.__alphaJongAndroidShell && window.__alphaJongAndroidShell.restoreControls())"
    fun readyCheck(hash: String): String =
        "Boolean(window.__alphaJongAndroidShell && window.__alphaJongAndroidShell.ready && " +
            "window.__alphaJongAndroidShell.sha256 === '$hash')"
}
