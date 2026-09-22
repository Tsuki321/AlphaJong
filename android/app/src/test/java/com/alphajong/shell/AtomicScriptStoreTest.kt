package com.alphajong.shell

import android.util.AtomicFile
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class AtomicScriptStoreTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test fun roundTripKeepsScriptAndMetadataTogether() {
        val store = AtomicScriptStore(File(temporary.root, "cache.json"))
        val cache = ScriptCache(fixtureScript("1.3.14"), fixtureScript(confirmed = true), 1234)
        store.write(cache)
        assertEquals(cache, store.read())
    }

    @Test fun failedAtomicWritePreservesLastCommittedData() {
        val file = File(temporary.root, "cache.json")
        val store = AtomicScriptStore(file)
        val cache = ScriptCache(current = fixtureScript(confirmed = true))
        store.write(cache)
        val atomic = AtomicFile(file)
        val output = atomic.startWrite()
        output.write("{truncated".toByteArray())
        atomic.failWrite(output)
        assertEquals(cache, store.read())
    }

    @Test fun mismatchedHashFallsBackToValidatedPreviousScript() {
        val file = File(temporary.root, "cache.json")
        val store = AtomicScriptStore(file)
        val current = fixtureScript("1.3.14")
        val previous = fixtureScript(confirmed = true)
        store.write(ScriptCache(current, previous))
        file.writeText(file.readText().replace(current.sha256, "0".repeat(64)))
        assertEquals(previous, store.read().current)
        assertNull(store.read().previous)
    }

    @Test fun malformedCacheCanBeReplacedByAValidDownload() {
        val file = File(temporary.root, "cache.json").apply { writeText("{broken") }
        val store = AtomicScriptStore(file)
        assertNull(store.read().current)
        val repo = ScriptRepository(store, { ScriptDownload.Modified(fixtureSource(), null) })
        assertTrue(repo.refresh().changed)
        assertEquals("1.3.13", store.read().current?.version)
    }
}
