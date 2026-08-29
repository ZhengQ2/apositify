package com.apositify.app

import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.apositify.app.data.RegisterStore
import com.apositify.app.model.ScanOutcome
import com.apositify.app.vision.ApostilleRecognizer
import com.apositify.app.vision.BoundedImageLoader
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class RealDeviceRecognitionTest {
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
}
