package com.apositify.app.core

import com.apositify.app.model.RecognitionResult
import com.apositify.app.model.RecognizedLine
import com.apositify.app.model.RegisterEntry
import com.apositify.app.model.VerificationConfig
import com.apositify.app.model.VerificationField
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A numeric date like 12/07/2019 has two readings. What the app does about that
 * depends on whether it has to interpret the date at all — 52 of the 54 date
 * fields in the catalogue submit the text exactly as printed — and, where it
 * does, on the best evidence available rather than on nationality.
 */
class NumericDateOrderTest {
    private fun scan(vararg lines: String) = RecognitionResult(lines.map { RecognizedLine(it) })

    private fun entry(field: VerificationField, country: String) = RegisterEntry(
        id = "test", country = country, authority = "Ministry",
        verification = VerificationConfig(fields = listOf(field)),
    )

    private fun value(field: VerificationField, country: String, vararg lines: String) =
        ApostilleParser.extractFields(entry(field, country), scan(*lines)).single()

    private fun dateField(label: String = "Date", format: String? = null) =
        VerificationField("date", label, aliases = listOf("Date"), standardItem = 6, format = format)

    @Test fun aPrintedDateNeedsNoInterpretationToBeSubmittedAsPrinted() {
        // Israel writes dates both ways, so its nationality settles nothing —
        // but the field submits the printed text, so nothing needs settling.
        val field = value(dateField(), "Israel", "1. Country: Israel", "6. the 12/07/2019")
        assertEquals("12/07/2019", field.value)
    }

    @Test fun aFieldThatMustSubmitIsoUsesTheCountryWhenNothingElseSaysOtherwise() {
        val field = value(dateField(format = "date-iso"), "Costa Rica", "1. País: Costa Rica", "6. El: 12/07/2019")
        assertEquals("2019-07-12", field.value)
    }

    @Test fun aLabelDeclaringItsOwnOrderOutranksTheCountry() {
        // Washington State prints "(MM-DD-YYYY)" in the field label.
        val monthFirst = value(
            dateField("Date Printed (MM-DD-YYYY)", format = "date-iso"),
            "United States of America",
            "6. Date Printed 05/09/2022",
        )
        assertEquals("2022-05-09", monthFirst.value)

        // Azerbaijan declares day-first against the same printed digits.
        val dayFirst = value(
            dateField("Date (DD.MM.YYYY)", format = "date-iso"),
            "Azerbaijan",
            "6. Date 05/09/2022",
        )
        assertEquals("2022-09-05", dayFirst.value)
    }

    @Test fun anUnambiguousDateOnTheSamePageSetsTheOrder() {
        // One page, one printer, one order: 25/12/2021 can only be day-first,
        // which settles the ambiguous date beside it against the US default.
        val field = value(
            dateField(format = "date-iso"),
            "United States of America",
            "Signed on 25/12/2021",
            "6. Date: 05/09/2022",
        )
        assertEquals("2022-09-05", field.value)
    }

    @Test fun anAmbiguousDateIsNeverOfferedAsACertificateNumber() {
        val number = VerificationField("number", "Apostille number", aliases = listOf("No."), standardItem = 8)
        val field = value(number, "Israel", "6. the 12/07/2019", "8. No. IL-4471-22")
        assertTrue(
            "a date must never be a certificate number, got '${field.value}' ${field.suggestedValues}",
            field.value != "12/07/2019" && !field.suggestedValues.contains("12/07/2019"),
        )
    }

    @Test fun countriesUsingBothOrdersDoNotResolveByNationality() {
        for (country in listOf("Philippines", "Saudi Arabia", "Israel")) {
            assertEquals(DateNormalizer.NumericOrder.UNKNOWN, DateNormalizer.orderFor(country))
            assertNull("$country must not guess", DateNormalizer.isoDate("12/07/2019", country))
        }
        assertEquals(DateNormalizer.NumericOrder.MONTH_FIRST, DateNormalizer.orderFor("United States of America"))
        assertEquals(DateNormalizer.NumericOrder.DAY_FIRST, DateNormalizer.orderFor("Costa Rica"))
    }
}
