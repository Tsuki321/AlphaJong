package com.alphajong.shell

import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ScriptRepositoryTest {
    @Test fun firstInstallDownloadsAndThenUsesConditionalChecks() {
        val store = MemoryScriptStore()
        var calls = 0
        val repo = ScriptRepository(store, { tag ->
            calls++
            if (calls == 1) { assertNull(tag); ScriptDownload.Modified(fixtureSource(), "saved-tag") }
            else { assertEquals("saved-tag", tag); ScriptDownload.NotModified }
        }, { 1_000_000L })
        assertTrue(repo.refresh().changed)
        assertFalse(repo.refresh().changed)
        assertEquals(1, calls)
        assertFalse(repo.refresh(force = true).changed)
        assertEquals(2, calls)
    }

    @Test fun networkFailureKeepsCacheButFirstInstallReportsFailure() {
        val cached = fixtureScript(confirmed = true)
        val store = MemoryScriptStore(ScriptCache(current = cached))
        val repo = ScriptRepository(store, { throw IOException("offline") }, { 1_000_000L })
        val result = repo.refresh()
        assertEquals(cached, result.script)
        assertEquals("offline", result.warning)
        assertEquals(cached, store.state.current)
        assertThrows(IOException::class.java) { ScriptRepository(MemoryScriptStore(), { throw IOException("offline") }).refresh() }
    }

    @Test fun rejectsInvalidAndOlderPayloadsWithoutDisplacingSavedScript() {
        val original = fixtureScript(confirmed = true)
        for (source in listOf("<html>Error</html>", fixtureSource("1.3.12"))) {
            val store = MemoryScriptStore(ScriptCache(current = original))
            val result = ScriptRepository(store, { ScriptDownload.Modified(source, null) }, { 1_000_000L }).refresh()
            assertEquals(original, result.script)
            assertNotNull(result.warning)
            assertEquals(original, store.state.current)
        }
    }

    @Test fun updateRetainsConfirmedFallbackAndRejectsFailedStartupUntilContentChanges() {
        val old = fixtureScript(confirmed = true)
        val store = MemoryScriptStore(ScriptCache(current = old))
        var payload = fixtureSource("1.3.14")
        val repo = ScriptRepository(store, { ScriptDownload.Modified(payload, null) }, { 1_000_000L })
        val update = repo.refresh().script
        assertEquals(old, store.state.previous)
        assertEquals(old, repo.rejectStartup(update.sha256))
        assertEquals(old, repo.refresh(force = true).script)
        payload = fixtureSource("1.3.14", "window.fixed = true;")
        assertTrue(repo.refresh(force = true).changed)
    }

    @Test fun startupConfirmationDuringAnotherDownloadPreservesWorkingVersion() {
        val running = fixtureScript()
        val store = MemoryScriptStore(ScriptCache(current = running))
        val repo = ScriptRepository(store, { ScriptDownload.Modified(fixtureSource("1.3.14"), null) }, { 1_000_000L })
        val next = repo.refresh().script
        repo.confirmStarted(running)
        assertEquals(running.sha256, store.state.previous?.sha256)
        assertTrue(store.state.previous!!.confirmed)
        assertEquals(running.sha256, repo.rejectStartup(next.sha256)?.sha256)
    }

    @Test fun storageFailureDoesNotActivateDownloadedUpdate() {
        val original = fixtureScript(confirmed = true)
        val store = MemoryScriptStore(ScriptCache(current = original)).apply { failWrites = true }
        val result = ScriptRepository(store, { ScriptDownload.Modified(fixtureSource("1.3.14"), null) }, { 1_000_000L }).refresh()
        assertEquals(original, result.script)
        assertEquals(original, store.state.current)
        assertNotNull(result.warning)
    }

    @Test fun clearWaitsForAnInflightDownloadAndCannotBeUndoneByIt() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val store = MemoryScriptStore()
        val repo = ScriptRepository(store, {
            entered.countDown()
            check(release.await(5, TimeUnit.SECONDS))
            ScriptDownload.Modified(fixtureSource(), null)
        })
        val pool = Executors.newFixedThreadPool(2)
        try {
            val fetch = pool.submit<ScriptRefresh> { repo.refresh() }
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            val clear = pool.submit { repo.clear() }
            release.countDown()
            fetch.get(5, TimeUnit.SECONDS)
            clear.get(5, TimeUnit.SECONDS)
            assertNull(repo.cached())
        } finally { release.countDown(); pool.shutdownNow() }
    }

    @Test fun a304WithoutCacheIsAnError() {
        assertThrows(ScriptFetchException::class.java) {
            ScriptRepository(MemoryScriptStore(), { ScriptDownload.NotModified }).refresh()
        }
    }
}
