package com.apositify.app.vision

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Rect
import android.net.Uri
import com.apositify.app.core.QrRouter
import com.apositify.app.model.RecognitionResult
import com.apositify.app.model.RecognizedLine
import com.apositify.app.model.NormalizedRect
import com.apositify.app.model.RegisterEntry
import com.apositify.app.model.ScanOutcome
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

data class RecognitionSession(val outcome: ScanOutcome, val preview: Bitmap)

class ApostilleRecognizer(private val context: Context, private val entries: List<RegisterEntry>) {
    suspend fun recognize(uri: Uri): RecognitionSession {
        val bitmap = BoundedImageLoader.decode(context, uri)
        val image = InputImage.fromBitmap(bitmap, 0)
        val qrPayloads = detectQr(image)
        val verifiedMatches = qrPayloads.mapNotNull { QrRouter.match(it, entries) }
        val first = verifiedMatches.firstOrNull()
        if (first != null && verifiedMatches.all { it.entry.id == first.entry.id }) {
            return RecognitionSession(ScanOutcome.Qr(first), bitmap)
        }

        val recognition = recognizeText(image, bitmap.width, bitmap.height)
        return RecognitionSession(ScanOutcome.Text(recognition, qrPayloads), bitmap)
    }

    private suspend fun detectQr(image: InputImage): List<String> {
        val options = BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
        val scanner = BarcodeScanning.getClient(options)
        return try {
            scanner.process(image).awaitResult().mapNotNull { it.rawValue?.trim()?.takeIf(String::isNotEmpty) }.distinct()
        } finally {
            scanner.close()
        }
    }

    private suspend fun recognizeText(image: InputImage, width: Int, height: Int): RecognitionResult {
        val recognizers = listOf(
            TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS),
            TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build()),
            TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build()),
            TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build()),
        )
        val observations = mutableListOf<RecognizedLine>()
        try {
            for (recognizer in recognizers) {
                val result = runCatching { recognizer.process(image).awaitResult() }.getOrNull() ?: continue
                result.textBlocks.flatMap { it.lines }.forEach { line ->
                    val box = line.boundingBox ?: return@forEach
                    val candidate = RecognizedLine(line.text.trim(), normalize(box, width, height))
                    if (candidate.text.isNotEmpty() && observations.none { duplicate(it, candidate) }) observations += candidate
                }
            }
        } finally {
            recognizers.forEach { it.close() }
        }
        val ordered = observations.sortedWith(compareBy<RecognizedLine> { it.bounds.top }.thenBy { it.bounds.left })
        return RecognitionResult(ordered)
    }

    private fun normalize(rect: Rect, width: Int, height: Int) = NormalizedRect(
        rect.left.toFloat() / width,
        rect.top.toFloat() / height,
        rect.right.toFloat() / width,
        rect.bottom.toFloat() / height,
    )

    private fun duplicate(a: RecognizedLine, b: RecognizedLine): Boolean {
        val sameText = a.text.lowercase().replace(Regex("\\s+"), " ") == b.text.lowercase().replace(Regex("\\s+"), " ")
        if (!sameText) return false
        val left = maxOf(a.bounds.left, b.bounds.left)
        val top = maxOf(a.bounds.top, b.bounds.top)
        val right = minOf(a.bounds.right, b.bounds.right)
        val bottom = minOf(a.bounds.bottom, b.bounds.bottom)
        if (right <= left || bottom <= top) return false
        val intersectionArea = (right - left) * (bottom - top)
        val smallerArea = minOf(a.bounds.width * a.bounds.height, b.bounds.width * b.bounds.height).coerceAtLeast(0.000001f)
        return intersectionArea / smallerArea >= 0.55f
    }
}
