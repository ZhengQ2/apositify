package com.apositify.app.core

import com.apositify.app.model.VerificationField
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DateAndFieldValidatorTest {
    @Test fun ambiguousNumericDateNeedsCountryMetadata() {
        assertNull(DateNormalizer.isoDate("04/05/2026"))
        assertEquals("2026-04-05", DateNormalizer.isoDate("04/05/2026", "United States of America"))
        assertEquals("2026-05-04", DateNormalizer.isoDate("04/05/2026", "Ukraine"))
        assertEquals("2026-04-25", DateNormalizer.isoDate("04/25/2026", "Canada"))
    }

    @Test fun dateValidationRequiresTheExactPortalSeparator() {
        val dotted = VerificationField(id = "date", label = "Date", format = "date-dotted")
        assertEquals("Use DD.MM.YYYY", FieldValidator.error(dotted, "29/08/2026"))
        assertNull(FieldValidator.error(dotted, "29.08.2026"))
        assertEquals("Use DD.MM.YYYY", FieldValidator.error(dotted, "31.02.2026"))
    }
}
