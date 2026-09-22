package com.alphajong.shell

import android.content.Context
import java.io.File
import java.io.IOException

data class CachedScript(
    val source: String,
    val version: String,
    val sha256: String,
    val etag: String?,
    val fetchedAtEpochMs: Long,
    val confirmed: Boolean = false
)

data class ScriptCache(
    val current: CachedScript? = null,
    val previous: CachedScript? = null,
    val checkedAtEpochMs: Long = 0,
    val rejectedSha256: String? = null
)

interface ScriptStore {
    fun read(): ScriptCache
    fun write(cache: ScriptCache)
}

data class ScriptRefresh(val script: CachedScript, val changed: Boolean, val warning: String? = null)

/** All operations run on Dispatchers.IO. One process-wide instance serializes refresh/clear/write. */
class ScriptRepository internal constructor(
    private val store: ScriptStore,
    private val fetcher: ScriptFetcher = PublicScriptClient(),
    private val now: () -> Long = System::currentTimeMillis
) {
    @Synchronized fun cached(): CachedScript? = store.read().current
    @Synchronized fun info(): ScriptCache = store.read()
    @Synchronized fun clear() = store.write(ScriptCache())

    @Synchronized fun refresh(force: Boolean = false): ScriptRefresh {
        val old = store.read()
        val current = old.current
        val timestamp = now()
        if (!force && current != null && timestamp - old.checkedAtEpochMs in 0L until CHECK_INTERVAL_MS) {
            return ScriptRefresh(current, changed = false)
        }
        try {
            val downloaded = fetcher.fetch(current?.etag)
            val next = when (downloaded) {
                ScriptDownload.NotModified -> current
                    ?: throw ScriptFetchException("GitHub returned no script for this first download.")
                is ScriptDownload.Modified -> {
                    val metadata = UserscriptValidator.validate(downloaded.source)
                    if (metadata.sha256 == old.rejectedSha256) {
                        throw ScriptFetchException("The available update previously failed to start. Keeping the working version.")
                    }
                    if (current != null && UserscriptValidator.compareVersions(metadata.version, current.version) < 0) {
                        throw ScriptFetchException("GitHub returned an older version. Keeping the saved script.")
                    }
                    if (current != null && metadata.sha256 == current.sha256) current.copy(etag = downloaded.etag)
                    else CachedScript(downloaded.source, metadata.version, metadata.sha256, downloaded.etag, timestamp)
                }
            }
            val changed = next.sha256 != current?.sha256
            val previous = if (changed && current?.confirmed == true) current else old.previous
            store.write(old.copy(current = next, previous = previous, checkedAtEpochMs = timestamp))
            return ScriptRefresh(next, changed)
        } catch (error: IOException) {
            // A failed promotion never displaces the version that was readable before the request.
            runCatching { store.write(old.copy(checkedAtEpochMs = timestamp)) }
            if (current == null) throw error
            return ScriptRefresh(current, changed = false, warning = error.message ?: "Could not check for updates.")
        }
    }

    @Synchronized fun confirmStarted(script: CachedScript) {
        val cache = store.read()
        val current = cache.current ?: return
        if (current.sha256 == script.sha256 && !current.confirmed) {
            store.write(cache.copy(current = current.copy(confirmed = true)))
        } else if (current.sha256 != script.sha256 && script.sha256 != cache.rejectedSha256 &&
            (cache.previous == null || UserscriptValidator.compareVersions(script.version, cache.previous.version) >= 0)
        ) {
            // An older page can finish startup while a newer update is being downloaded.
            store.write(cache.copy(previous = script.copy(confirmed = true)))
        }
    }

    @Synchronized fun rejectStartup(sha256: String): CachedScript? {
        val cache = store.read()
        if (cache.current?.sha256 != sha256) return cache.current
        val fallback = cache.previous?.takeIf { it.confirmed && it.sha256 != sha256 }
        store.write(cache.copy(current = fallback, previous = null, rejectedSha256 = sha256))
        return fallback
    }

    companion object {
        const val CHECK_INTERVAL_MS = 5 * 60 * 1000L
        @Volatile private var instance: ScriptRepository? = null

        fun get(context: Context): ScriptRepository = instance ?: synchronized(this) {
            instance ?: ScriptRepository(
                AtomicScriptStore(File(context.applicationContext.filesDir, "userscript-cache.json"))
            ).also { instance = it }
        }
    }
}
