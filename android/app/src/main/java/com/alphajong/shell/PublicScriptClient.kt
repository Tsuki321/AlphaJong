package com.alphajong.shell

import java.net.HttpURLConnection
import java.net.URL

sealed interface ScriptDownload {
    data class Modified(val source: String, val etag: String?) : ScriptDownload
    data object NotModified : ScriptDownload
}

fun interface ScriptFetcher {
    fun fetch(etag: String?): ScriptDownload
}

/** Only the public, published master file is an update source. No credentials or ZIPs. */
class PublicScriptClient internal constructor(
    private val open: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection }
) : ScriptFetcher {
    override fun fetch(etag: String?): ScriptDownload {
        var url = URL(GameClient.SCRIPT_URL)
        repeat(4) {
            val connection = open(url)
            try {
                connection.instanceFollowRedirects = false
                connection.connectTimeout = 10_000
                connection.readTimeout = 20_000
                connection.requestMethod = "GET"
                connection.setRequestProperty("User-Agent", "AlphaJong-Android")
                connection.setRequestProperty("Accept", "text/plain, application/javascript")
                connection.setRequestProperty("Accept-Encoding", "identity")
                if (!etag.isNullOrBlank()) connection.setRequestProperty("If-None-Match", etag)
                val status = connection.responseCode
                if (status == HttpURLConnection.HTTP_NOT_MODIFIED) return ScriptDownload.NotModified
                if (status in setOf(301, 302, 303, 307, 308)) {
                    val location = connection.getHeaderField("Location")
                        ?: throw ScriptFetchException("GitHub returned an incomplete redirect.")
                    val next = URL(url, location)
                    val original = URL(GameClient.SCRIPT_URL)
                    if (next.protocol != "https" || next.host != original.host ||
                        next.path != original.path || next.userInfo != null ||
                        (next.port != -1 && next.port != 443)
                    ) throw ScriptFetchException("GitHub redirected outside the published script source.")
                    url = next
                    return@repeat
                }
                if (status != HttpURLConnection.HTTP_OK) {
                    throw ScriptFetchException("Could not check GitHub for updates (HTTP $status).")
                }
                if (connection.contentLengthLong > UserscriptValidator.MAX_BYTES) {
                    throw ScriptFetchException("The userscript exceeds the size limit.")
                }
                val bytes = connection.inputStream.use { readBounded(it, UserscriptValidator.MAX_BYTES) }
                val source = UserscriptValidator.decode(bytes)
                UserscriptValidator.validate(source)
                val responseTag = connection.getHeaderField("ETag")?.takeIf {
                    it.length <= 512 && '\r' !in it && '\n' !in it
                }
                return ScriptDownload.Modified(source, responseTag)
            } finally {
                connection.disconnect()
            }
        }
        throw ScriptFetchException("GitHub redirected too many times.")
    }
}
