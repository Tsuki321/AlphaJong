package com.alphajong.shell

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class PublicScriptClientTest {
    private class Response(val status: Int, val bytes: ByteArray = fixtureSource().toByteArray()) : HttpURLConnection(URL(GameClient.SCRIPT_URL)) {
        val headers = mutableMapOf<String, String>()
        var disconnected = false
        var openedBody = false
        var announcedLength = -1L
        override fun getResponseCode() = status
        override fun getHeaderField(name: String): String? = headers[name]
        override fun getContentLengthLong() = announcedLength
        override fun getInputStream(): InputStream { openedBody = true; return ByteArrayInputStream(bytes) }
        override fun disconnect() { disconnected = true }
        override fun usingProxy() = false
        override fun connect() = Unit
    }

    @Test fun sendsConditionalPublicRequestWithoutCredentials() {
        val response = Response(200).apply { headers["ETag"] = "\"next\"" }
        val client = PublicScriptClient { url -> assertEquals(GameClient.SCRIPT_URL, url.toString()); response }
        val result = client.fetch("\"saved\"") as ScriptDownload.Modified
        assertEquals("\"saved\"", response.getRequestProperty("If-None-Match"))
        assertNull(response.getRequestProperty("Authorization"))
        assertEquals("\"next\"", result.etag)
        assertEquals(fixtureSource(), result.source)
        assertTrue(response.disconnected)
    }

    @Test fun notModifiedDoesNotReadABody() {
        val response = Response(304)
        assertEquals(ScriptDownload.NotModified, PublicScriptClient { response }.fetch("saved"))
        assertFalse(response.openedBody)
        assertTrue(response.disconnected)
    }

    @Test fun refusesRedirectToAnotherBranchOrHost() {
        for (location in listOf(
            "https://evil.test/AlphaJong.user.js",
            GameClient.SCRIPT_URL.replace("/master/", "/Android-Experimentals/"),
            GameClient.SCRIPT_URL.replace("https:", "http:")
        )) {
            val response = Response(302).apply { headers["Location"] = location }
            assertThrows(ScriptFetchException::class.java) { PublicScriptClient { response }.fetch(null) }
            assertTrue(response.disconnected)
        }
    }

    @Test fun acceptsOnlyBoundedValidSuccessfulResponses() {
        val tooLarge = Response(200).apply { announcedLength = UserscriptValidator.MAX_BYTES + 1L }
        assertThrows(ScriptFetchException::class.java) { PublicScriptClient { tooLarge }.fetch(null) }
        assertFalse(tooLarge.openedBody)
        for (response in listOf(Response(500), Response(200, "<html>Error</html>".toByteArray()), Response(200, ByteArray(UserscriptValidator.MAX_BYTES + 1)))) {
            assertThrows(ScriptFetchException::class.java) { PublicScriptClient { response }.fetch(null) }
            assertTrue(response.disconnected)
        }
    }
}
