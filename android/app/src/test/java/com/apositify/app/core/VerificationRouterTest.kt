package com.apositify.app.core

import com.apositify.app.model.DeepLink
import com.apositify.app.model.RegisterEntry
import com.apositify.app.model.VerificationConfig
import com.apositify.app.model.VerificationField
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.URI

class VerificationRouterTest {
    private val fields = listOf(VerificationField("number", "Number"), VerificationField("date", "Date"))

    @Test fun secureGetUsesReviewedValues() {
        val entry = RegisterEntry(id = "x", verification = VerificationConfig(fields = fields, deepLink = DeepLink(
            method = "get", url = "https://verify.gov/check", paramOrder = listOf("no", "date")
        )))
        val route = VerificationRouter.route(entry, mapOf("number" to "NEW-22", "date" to "2026-08-29"))
        assertTrue(route is VerificationRoute.Get)
        assertTrue((route as VerificationRoute.Get).uri.query.contains("no=NEW-22"))
    }

    @Test fun httpNeverReceivesOrAutofillsCertificateValues() {
        val entry = RegisterEntry(id = "x", verification = VerificationConfig(fields = fields, deepLink = DeepLink(
            method = "post", url = "http://legacy.gov/check", paramOrder = listOf("no", "date")
        )))
        val route = VerificationRouter.route(entry, mapOf("number" to "SECRET", "date" to "2026-08-29"))
        assertEquals(VerificationRoute.ExternalInsecure(URI("http://legacy.gov/check")), route)
    }

    @Test fun officialHostPolicyRejectsHttpsLookalike() {
        val entry = RegisterEntry(id = "x", registerUrl = "https://verify.gov/check")
        val policy = OfficialHostPolicy.forEntry(entry, URI(entry.registerUrl))
        assertTrue(policy.permits(URI("https://verify.gov/result")))
        assertTrue(!policy.permits(URI("https://verify.gov.evil.example/result")))
        assertTrue(!policy.permits(URI("http://verify.gov/result")))
    }
}
