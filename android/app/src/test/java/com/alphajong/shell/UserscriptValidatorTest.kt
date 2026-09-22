package com.alphajong.shell

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.InputStream

class UserscriptValidatorTest {
    @Test fun acceptsPublishedMetadataAndHashesContent() {
        val first = UserscriptValidator.validate(fixtureSource())
        assertEquals("1.3.13", first.version)
        assertEquals(64, first.sha256.length)
        assertNotEquals(first.sha256, UserscriptValidator.validate(fixtureSource(body = "window.fixture = false;")).sha256)
        assertEquals("1.3.13", UserscriptValidator.validate("\uFEFF" + fixtureSource().replace("\n", "\r\n")).version)
    }

    @Test fun rejectsWrongIdentityHtmlAndUnsupportedManagerFeatures() {
        for (source in listOf(
            "<html>GitHub error</html>",
            fixtureSource().replace("@name         AlphaJong", "@name         OtherScript"),
            fixtureSource().replace("@grant        none", "@grant        GM_xmlhttpRequest"),
            fixtureSource().replace("@run-at       document-start", "@run-at       document-end"),
            fixtureSource().replace("// ==/UserScript==", "// @require https://example.test/code.js\n// ==/UserScript=="),
            fixtureSource("unknown"), fixtureSource(body = "")
        )) assertThrows(ScriptFetchException::class.java) { UserscriptValidator.validate(source) }
    }

    @Test fun rejectsMalformedUtf8AndOversizedScripts() {
        assertThrows(ScriptFetchException::class.java) { UserscriptValidator.decode(byteArrayOf(0xc3.toByte(), 0x28)) }
        assertThrows(ScriptFetchException::class.java) { UserscriptValidator.validate(fixtureSource(body = "a".repeat(UserscriptValidator.MAX_BYTES))) }
    }

    @Test fun stopsReadingAtLimitRatherThanAllocatingWholeInput() {
        var read = 0
        val endless = object : InputStream() {
            override fun read(): Int { read++; return 65 }
        }
        assertThrows(ScriptFetchException::class.java) { readBounded(endless, 100) }
        assertEquals(101, read)
        assertArrayEquals(byteArrayOf(1, 2, 3), readBounded(ByteArrayInputStream(byteArrayOf(1, 2, 3)), 3))
    }

    @Test fun comparesVersionNumbersNumerically() {
        assertTrue(UserscriptValidator.compareVersions("1.10.0", "1.9.9") > 0)
        assertTrue(UserscriptValidator.compareVersions("1.3.12", "1.3.13") < 0)
        assertEquals(0, UserscriptValidator.compareVersions("1.3.13", "1.3.13"))
    }

    @Test fun onlyAllowsExactHttpsGameOrigins() {
        assertTrue(GameClient.isGameUrl(GameClient.GLOBAL_URL + "redirect/destination?test=1"))
        assertTrue(GameClient.isGameUrl("https://majsoul.com:443/"))
        for (url in listOf("http://majsoul.com/", "https://majsoul.com.evil.test/", "https://majsoul.com:444/", "https://user@majsoul.com/", "javascript:alert(1)", "bad url")) {
            assertFalse(url, GameClient.isGameUrl(url))
        }
    }
}
