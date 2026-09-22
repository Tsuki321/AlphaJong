package com.alphajong.shell

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.URI
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import java.util.Locale

object GameClient {
    const val GLOBAL_URL = "https://mahjongsoul.game.yo-star.com/"
    const val SCRIPT_URL = "https://raw.githubusercontent.com/Tsuki321/AlphaJong/master/AlphaJong.user.js"
    val hosts = setOf(
        "mahjongsoul.game.yo-star.com", "majsoul.com", "game.maj-soul.com",
        "game.maj-soul.net", "majsoul.union-game.com", "game.mahjongsoul.com"
    )
    val origins: Set<String> = hosts.map { "https://$it" }.toSet()

    fun isGameUrl(value: String): Boolean = runCatching {
        val uri = URI(value)
        uri.scheme.equals("https", ignoreCase = true) && uri.userInfo == null &&
            (uri.port == -1 || uri.port == 443) && uri.host?.lowercase(Locale.ROOT) in hosts
    }.getOrDefault(false)
}

class ScriptFetchException(message: String) : IOException(message)

/** Bound the allocation while reading, including responses with no Content-Length. */
fun readBounded(input: InputStream, limit: Int): ByteArray {
    require(limit > 0)
    val output = ByteArrayOutputStream(minOf(limit, 32_768))
    val buffer = ByteArray(8192)
    var total = 0
    while (true) {
        val count = input.read(buffer, 0, minOf(buffer.size, limit - total + 1))
        if (count < 0) break
        total += count
        if (total > limit) throw ScriptFetchException("The downloaded file exceeds the size limit.")
        output.write(buffer, 0, count)
    }
    return output.toByteArray()
}

data class ScriptMetadata(val version: String, val sha256: String)

object UserscriptValidator {
    const val MAX_BYTES = 2 * 1024 * 1024
    private val field = Regex("""(?m)^//\s*@([\w-]+)\s+([^\r\n]+)""")
    private val version = Regex("""[0-9]{1,9}\.[0-9]{1,9}\.[0-9]{1,9}""")

    fun decode(bytes: ByteArray): String = try {
        Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
    } catch (_: java.nio.charset.CharacterCodingException) {
        throw ScriptFetchException("GitHub returned a file that is not valid UTF-8.")
    }

    fun validate(source: String): ScriptMetadata {
        val bytes = source.toByteArray(Charsets.UTF_8)
        if (bytes.size > MAX_BYTES) throw ScriptFetchException("The userscript exceeds the size limit.")
        val text = source.removePrefix("\uFEFF")
        val end = text.indexOf("// ==/UserScript==")
        if (!text.startsWith("// ==UserScript==") || end !in 1..16_384) {
            throw ScriptFetchException("GitHub did not return an AlphaJong userscript.")
        }
        val metadata = field.findAll(text.substring(0, end)).groupBy(
            { it.groupValues[1] }, { it.groupValues[2].trim() }
        )
        val scriptVersion = metadata["version"]?.singleOrNull().orEmpty()
        if (metadata["name"] != listOf("AlphaJong") || !version.matches(scriptVersion) ||
            metadata["namespace"] != listOf("alphajong") ||
            metadata["run-at"] != listOf("document-start") ||
            metadata["grant"] != listOf("none") || metadata.containsKey("require") ||
            metadata.containsKey("resource") ||
            metadata["match"]?.contains(GameClient.GLOBAL_URL + "*") != true ||
            text.substring(end + "// ==/UserScript==".length).isBlank()
        ) {
            throw ScriptFetchException("This userscript is incomplete or incompatible with the Android app.")
        }
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
            .joinToString("") { "%02x".format(it.toInt() and 255) }
        return ScriptMetadata(scriptVersion, digest)
    }

    fun compareVersions(left: String, right: String): Int {
        val first = left.split('.').map(String::toLong)
        val second = right.split('.').map(String::toLong)
        for (index in 0..2) {
            val compared = first[index].compareTo(second[index])
            if (compared != 0) return compared
        }
        return 0
    }
}
