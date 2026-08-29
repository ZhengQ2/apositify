package com.apositify.app.core

import com.apositify.app.model.RecognitionResult
import com.apositify.app.model.RecognizedLine
import com.apositify.app.model.RegisterEntry
import com.apositify.app.model.VerificationConfig
import com.apositify.app.model.VerificationField
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regressions found by sweeping the whole specimen corpus on a Pixel. Every
 * case is the OCR text a real specimen actually produced, reduced to the lines
 * that mattered, so these run without a device or an image.
 */
class SpecimenRegressionTest {
    private fun scan(vararg lines: String) = RecognitionResult(lines.map { RecognizedLine(it) })

    private fun entry(fields: List<VerificationField>, country: String = "Japan") =
        RegisterEntry(id = "test", country = country, authority = "Ministry", verification = VerificationConfig(fields = fields))

    private val number = VerificationField("number", "Apostille number", aliases = listOf("Apostille number", "No."), standardItem = 8)
    private val date = VerificationField("date", "Apostille date", aliases = listOf("Apostille date", "Date", "Fecha"), standardItem = 6)

    @Test fun aWatermarkAboveTheNumberCannotPushItOutOfTheShortlist() {
        // A Xiaohongshu watermark across the top of a photographed Japanese
        // Apostille put three reference-shaped strings above the certificate
        // number. The shortlist was trimmed before the item resolver's own
        // choice was ranked into it, so the printed number was dropped.
        val field = ApostilleParser.extractFields(entry(listOf(number)), scan(
            "13小红薯69F7FF90",
            "令和8年 7",
            "東京都千代田区丸の内三丁目3番1号",
            "8. No.",
            "26028925",
        )).single()
        assertEquals("26028925", field.suggestedValues.firstOrNull() ?: field.value)
    }

    @Test fun aMonthNameJoinedToItsYearStillParses() {
        // Japan prints "Jul. 10.2026" — no space before the year.
        val field = ApostilleParser.extractFields(entry(listOf(date)), scan("6.", "Jul. 10.2026")).single()
        assertEquals("Jul. 10.2026", field.value)
    }

    @Test fun aLabelledDateIsNarrowedToTheDateItself() {
        // Chile prints "Fecha Emisión [ 28-10-2016 ]". The brackets and the
        // repeated label are not part of what its verifier accepts.
        val field = ApostilleParser.extractFields(entry(listOf(date), country = "Chile"), scan(
            "1. País", "CHILE", "Fecha Emisión [ 28-10-2016 ]",
        )).single()
        assertEquals("28-10-2016", field.value)
    }

    @Test fun aCurrencyAmountIsNeverACertificateNumber() {
        // A legalisation sticker prints a fee beside the reference. "GBP40.00"
        // is shaped like a reference and was confirmed as the number.
        val field = ApostilleParser.extractFields(entry(listOf(number), country = "United Kingdom"), scan(
            "8. Number", "APO-: XXXXXXXXXXX", "Price: GBP40.00",
        )).single()
        assertNotEquals("GBP40.00", field.value)
        assertTrue("a fee must not be offered either", field.suggestedValues.none { it == "GBP40.00" })
    }

    @Test fun aYearFieldRejectsTheWordAfterItsLabel() {
        // Hong Kong's Year field took the next word out of "…in the Year Two
        // Thousand and Twenty-six".
        val year = VerificationField("year", "Year", aliases = listOf("Year"))
        val field = ApostilleParser.extractFields(entry(listOf(year), country = "China"), scan(
            "affixed my Seal of Office this 12th",
            "day of February in the Year Two",
            "Thousand and Twenty-six.",
        )).single()
        assertEquals("", field.value)
    }

    private val authorities = listOf(
        RegisterEntry(id = "uk", country = "United Kingdom", authority = "Foreign and Commonwealth Office"),
        RegisterEntry(id = "ireland", country = "Ireland", authority = "Department of Foreign Affairs"),
        RegisterEntry(id = "india", country = "India", authority = "Ministry of External Affairs"),
        RegisterEntry(id = "russia", country = "Russian Federation", authority = "Ministry of Justice"),
        RegisterEntry(id = "hong-kong", country = "China", authority = "Hong Kong SAR: The Registrar of the High Court"),
        RegisterEntry(id = "china", country = "China", authority = "China (Mainland): Ministry of Foreign Affairs"),
        RegisterEntry(id = "macao", country = "China", authority = "Macao SAR: Director of the Legal Affairs Bureau"),
    )

    @Test fun northernIrelandIsNotIreland() {
        val top = AuthorityMatcher(authorities).matches(scan(
            "1. Country:",
            "United Kingdom of Great Britain and Northern Ireland",
            "7. by Her Majesty's Principal Secretary of State for",
            "Foreign, Commonwealth and Development Affairs",
        )).first()
        assertEquals("uk", top.entry.id)
    }

    @Test fun theRussianFederationMatchesItsOwnPrintedName() {
        val top = AuthorityMatcher(authorities).matches(scan(
            "1. Страна:", "Российская Федерация", "6. Дата 29.02.2024",
        )).firstOrNull()
        assertEquals("russia", top?.entry?.id)
    }

    @Test fun aCountryNamedInsideASentenceDoesNotOutrankTheCountryField() {
        // A Hong Kong certificate whose attached notarial page mentioned
        // exporting goods "to India" was read as an Indian Apostille.
        val top = AuthorityMatcher(authorities).matches(scan(
            "1. Letter of Consent for Importing Carbendazim Technical 98 % w/w min to India",
            "1. Country: Hong Kong, China",
            "5. at High Court",
            "7. by Simon KWANG Registrar, High Court",
        )).first()
        assertEquals("hong-kong", top.entry.id)
    }
}
