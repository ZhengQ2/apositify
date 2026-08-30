package com.apositify.app.core

import com.apositify.app.model.RegisterEntry
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.URI

/**
 * A verifier that redirects to its own www, or to a sibling subdomain, has not
 * left the authority — but it used to be treated as if it had. The widening is
 * deliberately narrower than the registrable domain, because two of the roots
 * in this corpus are shared umbrellas.
 */
class OfficialHostPolicyTest {
    private fun policy(host: String, domains: List<String>) = OfficialHostPolicy.forEntry(
        RegisterEntry(
            id = "test",
            country = "Test",
            authority = "Ministry",
            registerUrl = "https://$host/verify",
            allowedDomains = domains,
        ),
        null,
    )

    @Test fun acceptsTheWwwAndApexFormsOfTheSameHost() {
        val bahrain = policy("www.mofa.gov.bh", listOf("mofa.gov.bh"))
        assertTrue(bahrain.permits(URI("https://www.mofa.gov.bh/legalization")))
        assertTrue(bahrain.permits(URI("https://mofa.gov.bh/legalization")))
    }

    @Test fun acceptsASiblingSubdomainOfTheSameAuthority() {
        val bahrain = policy("www.mofa.gov.bh", listOf("mofa.gov.bh"))
        assertTrue(bahrain.permits(URI("https://apostille.mofa.gov.bh/check")))
    }

    @Test fun refusesAnotherMinistryUnderTheSameGovernment() {
        // gov.bh spans every Bahraini ministry. Widening that far would let an
        // unrelated one wear the official verifier's branding.
        val bahrain = policy("www.mofa.gov.bh", listOf("mofa.gov.bh"))
        assertFalse(bahrain.permits(URI("https://www.moj.gov.bh/apostille")))
    }

    @Test fun refusesAnotherTenantOnSharedHosting() {
        // Four authorities are hosted on powerappsportals.com. It is not a
        // public suffix, so the registrable domain would have trusted every
        // tenant on it.
        val canada = policy("apostille-gac.powerappsportals.com", listOf("apostille-gac.powerappsportals.com"))
        assertTrue(canada.permits(URI("https://apostille-gac.powerappsportals.com/en-US/")))
        assertFalse(canada.permits(URI("https://someone-else.powerappsportals.com/")))
    }

    @Test fun refusesAnotherSiteUnderAGovernmentUmbrella() {
        // govern.ad is Andorra's whole government, and is not a public suffix.
        val andorra = policy("isi.govern.ad", listOf("isi.govern.ad"))
        assertTrue(andorra.permits(URI("https://isi.govern.ad/CGI-BIN/lansaweb")))
        assertFalse(andorra.permits(URI("https://tramits.govern.ad/")))
    }

    @Test fun stillRefusesPlainHttpWhereverItLeads() {
        val bahrain = policy("www.mofa.gov.bh", listOf("mofa.gov.bh"))
        assertFalse(bahrain.permits(URI("http://www.mofa.gov.bh/legalization")))
    }
}
