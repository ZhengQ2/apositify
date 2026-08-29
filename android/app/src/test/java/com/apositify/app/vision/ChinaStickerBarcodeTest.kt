package com.apositify.app.vision

import com.apositify.app.model.NormalizedRect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChinaStickerBarcodeTest {
    @Test
    fun acceptsOnlyChinaStickerShapeInUpperRight() {
        val upperRight = NormalizedRect(left = 0.66f, top = 0.12f, right = 0.84f, bottom = 0.18f)
        assertEquals(
            "Sticker Number: E00268460",
            ChinaStickerBarcode.recognizedLine("e00268460", upperRight)?.text,
        )
        assertNull(
            ChinaStickerBarcode.recognizedLine(
                "E00268460",
                NormalizedRect(left = 0.66f, top = 0.62f, right = 0.84f, bottom = 0.68f),
            )
        )
        assertNull(ChinaStickerBarcode.recognizedLine("E0026846O", upperRight))
    }
}
