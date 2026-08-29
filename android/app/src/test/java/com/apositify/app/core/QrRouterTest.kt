package com.apositify.app.core

import com.apositify.app.model.QrRoute
import com.apositify.app.model.QrUrlRule
import com.apositify.app.model.RegisterEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class QrRouterTest {
    private fun entry(id: String = "official") = RegisterEntry(
        id = id, country = "Test", authority = "Authority", qrRoutes = listOf(
            QrRoute("verification", 2, "https:", listOf(
                QrUrlRule(
                    protocol = "https:", hostname = "verify.example.gov", pathnamePattern = "^/apostille/[A-Z0-9-]+$",
                    allowedSearchParams = listOf("lang"), staticSearchParams = mapOf("lang" to "en"),
                    tokenPattern = "^/apostille/([A-Z0-9-]+)", canonicalUrlTemplate = "https://verify.example.gov/check/{token}",
                )
            ))
        )
    )

    @Test fun routesOnlyAllowlistedQrAndCanonicalizesItsToken() {
        val match = QrRouter.match("verify.example.gov/apostille/ABC-123?lang=en", listOf(entry()))
        assertEquals("https://verify.example.gov/check/ABC-123", match?.destination.toString())
        assertNull(QrRouter.match("https://evil.example/apostille/ABC-123?lang=en", listOf(entry())))
        assertNull(QrRouter.match("https://verify.example.gov/apostille/ABC-123?lang=en&next=https://evil.example", listOf(entry())))
    }

    @Test fun ambiguousAuthorityMatchFallsBackToText() {
        assertNull(QrRouter.match("https://verify.example.gov/apostille/ABC-123?lang=en", listOf(entry("one"), entry("two"))))
    }

    @Test fun httpNeedsExplicitSpecimenRuleAcceptance() {
        val insecure = entry().copy(qrRoutes = listOf(QrRoute("verification", 2, null, listOf(
            QrUrlRule(protocol = "http:", hostname = "verify.example.gov", pathnamePattern = "^/x$", insecureAccepted = false)
        ))))
        assertNull(QrRouter.match("http://verify.example.gov/x", listOf(insecure)))
    }
}
