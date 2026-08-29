package com.apositify.app.core

import com.apositify.app.model.RecognitionResult
import com.apositify.app.model.RecognizedLine
import com.apositify.app.model.RegisterEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthorityMatcherTest {
    private val entries = listOf(
        RegisterEntry(
            id = "canada-ontario",
            country = "Canada",
            authority = "Ministry of Public and Business Service Delivery and Procurement of the province of Ontario",
        ),
        RegisterEntry(id = "canada-quebec", country = "Canada", authority = "Minister of Justice of the province of Quebec"),
        RegisterEntry(id = "china-mainland", country = "China", authority = "China (Mainland): Ministry of Foreign Affairs"),
        RegisterEntry(id = "andorra", country = "Andorra", authority = "Ministry of Foreign Affairs"),
    )

    private fun scan(vararg lines: String) =
        RecognitionResult(lines.map { RecognizedLine(it) })

    @Test fun matchesACountryPrintedPlainlyOnTheCertificate() {
        // Regression: countryNames() built its list as
        //     listOf(country) + when (country) { ... }.map(::normalize)
        // where .map bound to the `when` block alone, so the plain country name
        // was compared un-normalised ("Canada") against normalised text
        // ("canada") and never matched. Only the handful of countries with
        // hand-written lowercase aliases worked; every other one silently fell
        // through to "No confident match".
        val matches = AuthorityMatcher(entries).matches(
            scan(
                "APOSTILLE",
                "1. Country: / Pays :",
                "Canada",
                "MINISTRY OF PUBLIC AND BUSINESS SERVICE DELIVERY",
                "7. by / par",
                "Manager Official Documents Services",
                "Toronto, Ontario",
            )
        )
        assertTrue("Canada must be detected from the certificate text", matches.isNotEmpty())
        assertEquals("canada-ontario", matches.first().entry.id)
        assertTrue("a country and authority hit must be confident", matches.first().score >= 0.66)
    }

    @Test fun stillMatchesCountriesThatRelyOnAnAlias() {
        val matches = AuthorityMatcher(entries).matches(
            scan("APOSTILLE", "1. Country: China", "7. by: Ministry of Foreign Affairs")
        )
        assertEquals("china-mainland", matches.first().entry.id)
    }

    @Test fun offersNothingWhenNoCountryOrAuthorityAppears() {
        val matches = AuthorityMatcher(entries).matches(scan("APOSTILLE", "a page with no jurisdiction on it"))
        assertTrue("an unrelated page must not suggest an authority", matches.isEmpty())
    }
}
