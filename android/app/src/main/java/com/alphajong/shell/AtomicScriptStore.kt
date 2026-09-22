package com.alphajong.shell

import android.util.AtomicFile
import org.json.JSONObject
import java.io.File

/** Script and matching metadata are committed together; AtomicFile recovers interrupted writes. */
class AtomicScriptStore(file: File) : ScriptStore {
    private val atomic = AtomicFile(file)

    override fun read(): ScriptCache = runCatching {
        val bytes = atomic.openRead().use { readBounded(it, UserscriptValidator.MAX_BYTES * 12 + 65_536) }
        val data = JSONObject(UserscriptValidator.decode(bytes))
        if (data.optInt("schema") != 1) return@runCatching ScriptCache()
        val current = readScript(data.optJSONObject("current"))
        val previous = readScript(data.optJSONObject("previous"))?.takeIf { it.confirmed }
        ScriptCache(
            current = current ?: previous,
            previous = previous.takeIf { current != null && it?.sha256 != current.sha256 },
            checkedAtEpochMs = data.optLong("checkedAt", 0),
            rejectedSha256 = data.optString("rejectedSha256").takeIf { it.matches(Regex("[a-f0-9]{64}")) }
        )
    }.getOrDefault(ScriptCache())

    override fun write(cache: ScriptCache) {
        val data = JSONObject().put("schema", 1).put("checkedAt", cache.checkedAtEpochMs)
            .put("current", cache.current?.let(::writeScript) ?: JSONObject.NULL)
            .put("previous", cache.previous?.let(::writeScript) ?: JSONObject.NULL)
            .put("rejectedSha256", cache.rejectedSha256 ?: JSONObject.NULL)
            .toString().toByteArray(Charsets.UTF_8)
        val stream = atomic.startWrite()
        try {
            stream.write(data)
            atomic.finishWrite(stream)
        } catch (error: Exception) {
            atomic.failWrite(stream)
            throw error
        }
    }

    private fun readScript(data: JSONObject?): CachedScript? = runCatching {
        if (data == null) return@runCatching null
        val source = data.getString("source")
        val metadata = UserscriptValidator.validate(source)
        if (metadata.sha256 != data.getString("sha256") || metadata.version != data.getString("version")) return@runCatching null
        CachedScript(
            source, metadata.version, metadata.sha256,
            if (data.isNull("etag")) null else data.getString("etag").takeIf {
                it.length <= 512 && '\r' !in it && '\n' !in it
            },
            data.getLong("fetchedAt"), data.optBoolean("confirmed", false)
        )
    }.getOrNull()

    private fun writeScript(script: CachedScript): JSONObject = JSONObject()
        .put("source", script.source).put("version", script.version).put("sha256", script.sha256)
        .put("etag", script.etag ?: JSONObject.NULL).put("fetchedAt", script.fetchedAtEpochMs)
        .put("confirmed", script.confirmed)
}
