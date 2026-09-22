package com.alphajong.shell

internal fun fixtureSource(version: String = "1.3.13", body: String = "window.fixture = true;"): String = """
// ==UserScript==
// @name         AlphaJong
// @namespace    alphajong
// @version      $version
// @grant        none
// @run-at       document-start
// @match        https://mahjongsoul.game.yo-star.com/*
// ==/UserScript==
$body
""".trimIndent()

internal fun fixtureScript(version: String = "1.3.13", confirmed: Boolean = false): CachedScript {
    val source = fixtureSource(version)
    val metadata = UserscriptValidator.validate(source)
    return CachedScript(source, metadata.version, metadata.sha256, "\"$version\"", 100, confirmed)
}

internal class MemoryScriptStore(var state: ScriptCache = ScriptCache()) : ScriptStore {
    var failWrites = false
    override fun read(): ScriptCache = state
    override fun write(cache: ScriptCache) {
        if (failWrites) throw java.io.IOException("disk full")
        state = cache
    }
}
