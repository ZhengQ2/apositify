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
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

data class RecognitionSession(val outcome: ScanOutcome, val preview: Bitmap)

class ApostilleRecognizer(private val context: Context, private val entries: List<RegisterEntry>) {
    suspend fun recognize(uri: Uri): RecognitionSession {
        val bitmap = BoundedImageLoader.decode(context, uri)
        val barcodes = detectBarcodes(InputImage.fromBitmap(bitmap, 0))
        val qrPayloads = barcodes.filter { it.format == Barcode.FORMAT_QR_CODE }.map { it.payload }.distinct()
        val verifiedMatches = qrPayloads.mapNotNull { QrRouter.match(it, entries) }
        val first = verifiedMatches.firstOrNull()
        if (first != null && verifiedMatches.all { it.entry.id == first.entry.id }) {
            return RecognitionSession(ScanOutcome.Qr(first), bitmap)
        }

        val textPass = recognizeText(bitmap)
        val fullPageStickerLines = barcodes.mapNotNull { barcode ->
            if (barcode.format != Barcode.FORMAT_CODE_128 && barcode.format != Barcode.FORMAT_CODE_39) return@mapNotNull null
            val rawBounds = barcode.bounds ?: return@mapNotNull null
            val uprightBounds = rotate(normalize(rawBounds, bitmap.width, bitmap.height), textPass.degrees)
            ChinaStickerBarcode.recognizedLine(barcode.payload, uprightBounds)
        }
        val stickerLines = if (fullPageStickerLines.isNotEmpty()) {
            fullPageStickerLines
        } else {
            detectFocusedStickerPayloads(bitmap, textPass.degrees).mapNotNull { payload ->
                ChinaStickerBarcode.recognizedLine(
                    payload,
                    NormalizedRect(left = 0.55f, top = 0.08f, right = 0.94f, bottom = 0.32f),
                )
            }
        }
        val recognition = RecognitionResult(
            (textPass.recognition.lines + stickerLines)
                .sortedWith(compareBy<RecognizedLine> { it.bounds.top }.thenBy { it.bounds.left })
        )
        return RecognitionSession(ScanOutcome.Text(recognition, qrPayloads), bitmap)
    }

    private data class DetectedBarcode(val payload: String, val format: Int, val bounds: Rect?)

    private suspend fun detectBarcodes(image: InputImage): List<DetectedBarcode> {
        val options = BarcodeScannerOptions.Builder().setBarcodeFormats(
            Barcode.FORMAT_QR_CODE,
            Barcode.FORMAT_CODE_128,
            Barcode.FORMAT_CODE_39,
        ).build()
        val scanner = BarcodeScanning.getClient(options)
        return try {
            scanner.process(image).awaitResult().mapNotNull { barcode ->
                val payload = barcode.rawValue?.trim()?.takeIf(String::isNotEmpty) ?: return@mapNotNull null
                DetectedBarcode(payload, barcode.format, barcode.boundingBox?.let(::Rect))
            }
        } finally {
            scanner.close()
        }
    }

    private suspend fun detectFocusedStickerPayloads(bitmap: Bitmap, degrees: Int): List<String> {
        val region = when (degrees) {
            90 -> Rect(
                (bitmap.width * 0.06f).toInt(),
                (bitmap.height * 0.06f).toInt(),
                (bitmap.width * 0.32f).toInt(),
                (bitmap.height * 0.48f).toInt(),
            )
            180 -> Rect(
                (bitmap.width * 0.06f).toInt(),
                (bitmap.height * 0.68f).toInt(),
                (bitmap.width * 0.48f).toInt(),
                (bitmap.height * 0.94f).toInt(),
            )
            270 -> Rect(
                (bitmap.width * 0.68f).toInt(),
                (bitmap.height * 0.52f).toInt(),
                (bitmap.width * 0.94f).toInt(),
                (bitmap.height * 0.94f).toInt(),
            )
            else -> Rect(
                (bitmap.width * 0.52f).toInt(),
                (bitmap.height * 0.06f).toInt(),
                (bitmap.width * 0.94f).toInt(),
                (bitmap.height * 0.32f).toInt(),
            )
        }
        val cropped = Bitmap.createBitmap(bitmap, region.left, region.top, region.width(), region.height())
        val options = BarcodeScannerOptions.Builder().setBarcodeFormats(
            Barcode.FORMAT_CODE_128,
            Barcode.FORMAT_CODE_39,
        ).build()
        val scanner = BarcodeScanning.getClient(options)
        return try {
            scanner.process(InputImage.fromBitmap(cropped, degrees)).awaitResult()
                .mapNotNull { it.rawValue }
                .mapNotNull(ChinaStickerBarcode::normalizedValue)
                .distinct()
        } finally {
            scanner.close()
            cropped.recycle()
        }
    }

    /**
     * ML Kit can read sideways text while leaving its boxes in sideways image
     * coordinates. That makes item labels and values appear to be in different
     * columns even when the words themselves are correct. iOS avoids this by
     * always giving Vision an orientation-normalized image. On Android we first
     * use the Latin model to choose the upright orientation, then run every
     * language model in that same coordinate system.
     */
    private data class TextRecognitionPass(val degrees: Int, val recognition: RecognitionResult)

    private suspend fun recognizeText(bitmap: Bitmap): TextRecognitionPass {
        val latin = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val orientation = try {
            selectUprightOrientation(bitmap, latin)
        } finally {
            latin.close()
        }
        val image = InputImage.fromBitmap(bitmap, orientation.degrees)
        val width = if (orientation.degrees == 90 || orientation.degrees == 270) bitmap.height else bitmap.width
        val height = if (orientation.degrees == 90 || orientation.degrees == 270) bitmap.width else bitmap.height
        val recognizers = listOf(
            TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build()),
            TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build()),
            TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build()),
        )
        val observations = mutableListOf<RecognizedLine>()
        addLines(orientation.text, width, height, observations)
        try {
            for (recognizer in recognizers) {
                val result = runCatching { recognizer.process(image).awaitResult() }.getOrNull() ?: continue
                addLines(result, width, height, observations)
            }
        } finally {
            recognizers.forEach { it.close() }
        }
        val ordered = observations.sortedWith(compareBy<RecognizedLine> { it.bounds.top }.thenBy { it.bounds.left })
        return TextRecognitionPass(orientation.degrees, RecognitionResult(ordered))
    }

    private data class OrientationPass(val degrees: Int, val text: Text, val score: Int)

    private suspend fun selectUprightOrientation(bitmap: Bitmap, recognizer: TextRecognizer): OrientationPass {
        return listOf(0, 90, 270, 180).mapNotNull { degrees ->
            runCatching {
                val text = recognizer.process(InputImage.fromBitmap(bitmap, degrees)).awaitResult()
                OrientationPass(degrees, text, orientationScore(text))
            }.getOrNull()
        }.maxByOrNull { it.score } ?: error("No readable text was found.")
    }

    private fun orientationScore(text: Text): Int {
        val lines = text.textBlocks.flatMap { it.lines }
        val joined = lines.joinToString(" ") { it.text }
        val numbered = lines.count { Regex("^\\s*(10|[1-9])\\s*[.):\\-]").containsMatchIn(it.text) }
        val horizontal = lines.sumOf { line ->
            val box = line.boundingBox ?: return@sumOf 0
            when {
                box.width() >= box.height() * 1.35f -> 3
                box.height() >= box.width() * 1.35f -> -3
                else -> 0
            }
        }
        return horizontal + numbered * 30 +
            (if (joined.contains("APOSTILLE", ignoreCase = true)) 120 else 0) +
            minOf(lines.size, 50)
    }

    private fun addLines(result: Text, width: Int, height: Int, observations: MutableList<RecognizedLine>) {
        result.textBlocks.flatMap { it.lines }.forEach { line ->
            val box = line.boundingBox ?: return@forEach
            val candidate = RecognizedLine(line.text.trim(), normalize(box, width, height))
            if (candidate.text.isNotEmpty() && observations.none { duplicate(it, candidate) }) observations += candidate
        }
    }

    private fun normalize(rect: Rect, width: Int, height: Int) = NormalizedRect(
        rect.left.toFloat() / width,
        rect.top.toFloat() / height,
        rect.right.toFloat() / width,
        rect.bottom.toFloat() / height,
    )

    private fun rotate(rect: NormalizedRect, degrees: Int): NormalizedRect = when (degrees) {
        90 -> NormalizedRect(1 - rect.bottom, rect.left, 1 - rect.top, rect.right)
        180 -> NormalizedRect(1 - rect.right, 1 - rect.bottom, 1 - rect.left, 1 - rect.top)
        270 -> NormalizedRect(rect.top, 1 - rect.right, rect.bottom, 1 - rect.left)
        else -> rect
    }

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

internal object ChinaStickerBarcode {
    private val pattern = Regex("^E[0-9]{8}$")

    fun normalizedValue(payload: String): String? = payload.trim().uppercase().takeIf(pattern::matches)

    fun recognizedLine(payload: String, bounds: NormalizedRect): RecognizedLine? {
        val value = normalizedValue(payload) ?: return null
        if (bounds.centerX < 0.55f || bounds.centerY > 0.32f) return null
        return RecognizedLine("Sticker Number: $value", bounds)
    }
}
