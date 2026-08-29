package com.apositify.app.core

import com.apositify.app.model.DeepLink
import com.apositify.app.model.NormalizedRect
import com.apositify.app.model.RecognitionResult
import com.apositify.app.model.RecognizedLine
import com.apositify.app.model.RegisterEntry
import com.apositify.app.model.VerificationConfig
import com.apositify.app.model.VerificationField
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ApostilleParserTest {
    private val date = VerificationField("date", "Date", aliases = listOf("Date", "Fecha", "签发日期"), standardItem = 6)
    private val number = VerificationField("number", "Apostille number", aliases = listOf("Number", "No.", "附加证明书编号"), standardItem = 8)
    private fun entry(fields: List<VerificationField> = listOf(date, number), country: String = "Canada") = RegisterEntry(
        id = "test", country = country, authority = "Ministry", verification = VerificationConfig(fields = fields),
    )

    @Test fun multilingualInlineLabelsProduceTheActualValues() {
        val result = RecognitionResult(listOf(
            RecognizedLine("APOSTILLE (Convention de La Haye du 5 octobre 1961)"),
            RecognizedLine("6. Date / Fecha / 签发日期: 29 August 2026"),
            RecognizedLine("8. 附加证明书编号 / No.: 263600004721"),
        ))
        val fields = ApostilleParser.extractFields(entry(country = "China"), result).associateBy { it.id }
        assertEquals("29 August 2026", fields["date"]?.value)
        assertEquals("263600004721", fields["number"]?.value)
    }

    @Test fun geometryAssignsEveryCandidateToOnlyOneNumberedLine() {
        val lines = listOf(
            RecognizedLine("7. by", NormalizedRect(.05f, .30f, .22f, .35f)),
            RecognizedLine("Ministry of Justice", NormalizedRect(.35f, .30f, .75f, .35f)),
            RecognizedLine("8. No.", NormalizedRect(.05f, .40f, .22f, .45f)),
            RecognizedLine("CA-2026-01983", NormalizedRect(.35f, .40f, .65f, .45f)),
        )
        val numbered = ApostilleParser.numberedItems(lines)
        assertEquals("Ministry of Justice", numbered[7])
        assertEquals("CA-2026-01983", numbered[8])
    }

    @Test fun twoPlausibleReferencesRequireUserSelection() {
        val result = RecognitionResult(listOf(
            RecognizedLine("8. Number"),
            RecognizedLine("CA-2026-01983"),
            RecognizedLine("Sticker 4400183372"),
        ))
        val field = ApostilleParser.extractFields(entry(fields = listOf(number)), result).single()
        assertTrue(field.value.isEmpty())
        assertTrue(field.suggestedValues.size >= 2)
    }

    @Test fun languageCorrectionRejectsZeroPrefixedMonthAsCertificateNumber() {
        val result = RecognitionResult(listOf(
            RecognizedLine("Convention of 5 0ctober"),
            RecognizedLine("ON-26-506237-8785"),
            RecognizedLine("8. NO sous n°"),
            RecognizedLine("8. N° / sous n°"),
        ))
        val field = ApostilleParser.extractFields(entry(fields = listOf(number)), result).single()
        assertEquals("ON-26-506237-8785", field.value)
    }

    @Test fun corruptedBilingualNumberLabelCannotBecomeTheNumber() {
        val ontarioNumber = number.copy(pattern = "\\b[A-Z]{2}-\\d{2}-\\d{6}-\\d{4}\\b")
        val field = ApostilleParser.extractFields(entry(fields = listOf(ontarioNumber)), RecognitionResult(listOf(
            RecognizedLine("8. N°7sous n。"),
            RecognizedLine("ON-26-506237-8785"),
        ))).single()
        assertEquals("ON-26-506237-8785", field.value)
    }

    @Test fun authoritySpecificPatternHandlesNonStandardSticker() {
        val sticker = VerificationField("sticker", "Sticker number", pattern = "\\b\\d{10}\\b", aliases = listOf("Sticker number"))
        val field = ApostilleParser.extractFields(entry(listOf(sticker), "China"), RecognitionResult(listOf(
            RecognizedLine("贴纸编号 / Sticker number: 4400183372")
        ))).single()
        assertEquals("4400183372", field.value)
    }

    @Test fun conventionDateNeverBecomesIssueDate() {
        val field = ApostilleParser.extractFields(entry(listOf(date)), RecognitionResult(listOf(
            RecognizedLine("Convention de La Haye du 5 octobre 1961"),
            RecognizedLine("6. Date")
        ))).single()
        assertTrue(field.value.isEmpty())
    }
}
