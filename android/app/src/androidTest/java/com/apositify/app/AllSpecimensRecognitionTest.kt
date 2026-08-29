package com.apositify.app

import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.apositify.app.core.ApostilleParser
import com.apositify.app.core.AuthorityMatcher
import com.apositify.app.data.RegisterStore
import com.apositify.app.model.ScanOutcome
import com.apositify.app.vision.ApostilleRecognizer
import kotlinx.coroutines.runBlocking
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Reads every specimen present on the device through the real ML Kit pipeline
 * and logs what the app would show. Ground truth for the readable ones is
 * asserted in [SpecimenAccuracyTest]; this sweep exists so a regression in a
 * specimen nobody has written expectations for is still visible.
 */
@RunWith(AndroidJUnit4::class)
class AllSpecimensRecognitionTest {
    @Test
    fun everySpecimenIsReadable() = runBlocking {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val assets = instrumentation.context.assets.list("").orEmpty()
            .filter { it.substringAfterLast('.', "").lowercase() in IMAGE_EXTENSIONS }
            .sorted()
        assumeTrue("Local specimen fixtures are intentionally unavailable", assets.isNotEmpty())

        val store = RegisterStore(context)
        val recognizer = ApostilleRecognizer(context, store.entries)
        val matcher = AuthorityMatcher(store.entries)
        val report = StringBuilder()

        for (asset in assets) {
            val fixture = File(context.cacheDir, asset)
            instrumentation.context.assets.open(asset).use { input ->
                fixture.outputStream().use(input::copyTo)
            }
            report.append("========== ").append(asset).append('\n')
            val session = runCatching { recognizer.recognize(Uri.fromFile(fixture)) }.getOrElse { error ->
                report.append("  RECOGNIZE FAILED ").append(error.message).append('\n')
                continue
            }
            when (val outcome = session.outcome) {
                is ScanOutcome.Qr -> report.append("  qr route ").append(outcome.match.entry.id).append('\n')
                is ScanOutcome.Text -> {
                    val recognition = outcome.recognition
                    report.append("  lines ").append(recognition.lines.size)
                        .append(" qrPayloads ").append(outcome.detectedQrPayloads.size).append('\n')
                    ApostilleParser.numberedItems(recognition.lines).toSortedMap().forEach { (item, value) ->
                        report.append("  item ").append(item).append(": ").append(value).append('\n')
                    }
                    val matches = matcher.matches(recognition)
                    matches.take(2).forEach {
                        report.append("  authority ").append(String.format("%.2f", it.score))
                            .append(' ').append(it.entry.country).append(" / ").append(it.entry.authority).append('\n')
                    }
                    matches.firstOrNull()?.entry?.let { entry ->
                        ApostilleParser.extractFields(entry, recognition).forEach { field ->
                            report.append("  field ").append(field.id).append(" [").append(field.label)
                                .append("] = '").append(field.value).append('\'')
                                .append(" suggestions=").append(field.suggestedValues).append('\n')
                        }
                    }
                }
            }
        }
        // Chunked because logcat drops long single lines.
        report.toString().lineSequence().forEach { android.util.Log.i(TAG, it) }
    }

    private companion object {
        const val TAG = "SpecimenSweep"
        val IMAGE_EXTENSIONS = setOf("png", "jpg", "jpeg", "heic", "webp")
    }
}
