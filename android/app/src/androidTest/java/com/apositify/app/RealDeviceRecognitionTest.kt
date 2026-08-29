package com.apositify.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.apositify.app.data.RegisterStore
import com.apositify.app.core.ApostilleParser
import com.apositify.app.model.ScanOutcome
import com.apositify.app.vision.ApostilleRecognizer
import com.apositify.app.vision.BoundedImageLoader
import kotlinx.coroutines.runBlocking
import org.junit.Assume.assumeTrue
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class RealDeviceRecognitionTest {
    private fun requireLocalAssets(vararg names: String) {
        val assets = InstrumentationRegistry.getInstrumentation().context.assets.list("").orEmpty().toSet()
        assumeTrue("Local specimen fixture is intentionally unavailable", names.all(assets::contains))
    }

    @Test
    fun qrFreeOfficialHcchSpecimenUsesTextFallback() = runBlocking {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val fixture = File(context.cacheDir, "hcch-en-fr.png")
        instrumentation.context.assets.open("hcch-en-fr.png").use { input ->
            fixture.outputStream().use(input::copyTo)
        }

        val store = RegisterStore(context)
        val session = ApostilleRecognizer(context, store.entries).recognize(Uri.fromFile(fixture))
        val outcome = session.outcome
        assertTrue("A QR-free model must use text fallback", outcome is ScanOutcome.Text)
        val text = (outcome as ScanOutcome.Text).recognition.fullText
        val anchors = listOf("APOSTILLE", "Country", "Pays", "Signature")
        assertTrue("Expected at least three HCCH model anchors, recognized:\n$text",
            anchors.count { text.contains(it, ignoreCase = true) } >= 3)
        assertTrue("The decoded image must remain memory-bounded",
            maxOf(session.preview.width, session.preview.height) <= BoundedImageLoader.MAX_EDGE)
    }

    @Test
    fun ontarioUserSampleFindsCertificateNumberWhenStoredSideways() = runBlocking {
        requireLocalAssets(
            "ontario-user-sample.jpg",
            "ontario-user-sample-landscape.jpg",
            "ontario-user-sample-landscape-opposite.jpg",
        )
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val store = RegisterStore(context)
        val ontario = store.entries.first { it.authority.contains("Ontario", ignoreCase = true) }
        listOf(
            "ontario-user-sample.jpg",
            "ontario-user-sample-landscape.jpg",
            "ontario-user-sample-landscape-opposite.jpg",
        ).forEach { assetName ->
            val fixture = File(context.cacheDir, assetName)
            instrumentation.context.assets.open(assetName).use { input ->
                fixture.outputStream().use(input::copyTo)
            }
            val session = ApostilleRecognizer(context, store.entries).recognize(Uri.fromFile(fixture))
            val outcome = session.outcome
            assertTrue("The QR-free Ontario sample must use text fallback", outcome is ScanOutcome.Text)
            val recognition = (outcome as ScanOutcome.Text).recognition
            val number = ApostilleParser.extractFields(ontario, recognition)
                .firstOrNull { field -> ontario.verification?.fields.orEmpty().firstOrNull { it.id == field.id }?.standardItem == 8 }
            assertTrue(
                "$assetName: expected ON-26-506237-8785, extracted=$number\nRecognized text:\n${recognition.fullText}",
                number?.value == "ON-26-506237-8785",
            )
        }
    }

    @Test
    fun chinaOfficialSpecimenFindsTopRightStickerWhenQrIsRemoved() = runBlocking {
        requireLocalAssets("china-2025-official.png")
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val source = instrumentation.context.assets.open("china-2025-official.png").use(BitmapFactory::decodeStream)
        val qrFree = source.copy(Bitmap.Config.ARGB_8888, true)
        Canvas(qrFree).drawRect(
            qrFree.width * 0.19f,
            qrFree.height * 0.15f,
            qrFree.width * 0.35f,
            qrFree.height * 0.27f,
            Paint().apply { color = Color.WHITE },
        )
        val fixture = File(context.cacheDir, "china-2025-official-without-qr.png")
        fixture.outputStream().use { qrFree.compress(Bitmap.CompressFormat.PNG, 100, it) }

        val store = RegisterStore(context)
        val china = store.entries.first { it.id == "china-china-mainland-ministry-of-foreign-affairs" }
        val session = ApostilleRecognizer(context, store.entries).recognize(Uri.fromFile(fixture))
        val outcome = session.outcome
        assertTrue("The QR-masked China specimen must use text fallback", outcome is ScanOutcome.Text)
        val textOutcome = outcome as ScanOutcome.Text
        assertTrue("The masked QR must not be detected", textOutcome.detectedQrPayloads.isEmpty())
        val sticker = ApostilleParser.extractFields(china, textOutcome.recognition)
            .firstOrNull { it.id == "stickerNumber" }
        assertTrue(
            "Expected upper-right barcode E00268460, extracted=$sticker\nRecognized text:\n${textOutcome.recognition.fullText}",
            sticker?.value == "E00268460",
        )
        assertTrue(
            "Sticker must be supplied by barcode evidence",
            textOutcome.recognition.lines.any { it.text == "Sticker Number: E00268460" },
        )
    }
}
