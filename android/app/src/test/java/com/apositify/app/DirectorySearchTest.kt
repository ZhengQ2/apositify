package com.apositify.app

import com.apositify.app.model.RegisterEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DirectorySearchTest {
    private val entries = listOf(
        RegisterEntry(id = "ontario", country = "Canada", authority = "Ministry of Public and Business Service Delivery and Procurement of the province of Ontario"),
        RegisterEntry(id = "quebec", country = "Canada", authority = "Minister of Justice of the province of Quebec"),
        RegisterEntry(id = "japan", country = "Japan", authority = "Ministry of Foreign Affairs"),
    )

    @Test fun listsEveryAuthorityInOrderWhenNothingIsTyped() {
        // Sorted by country, then authority: "Minister of Justice" precedes
        // "Ministry of Public", so Quebec comes before Ontario.
        assertEquals(listOf("quebec", "ontario", "japan"), search(entries, "").map { it.id })
    }

    @Test fun findsAnAuthorityByEitherHalfOfItsName() {
        // A user knows their certificate says Ontario, or that it is Canadian.
        assertEquals(listOf("ontario"), search(entries, "ontario").map { it.id })
        assertEquals(listOf("quebec", "ontario"), search(entries, "canada").map { it.id })
    }

    @Test fun ignoresCaseAndSurroundingSpace() {
        assertEquals(listOf("japan"), search(entries, "  JAPAN ").map { it.id })
    }

    @Test fun offersNothingRatherThanEverythingWhenNoAuthorityMatches() {
        assertTrue(search(entries, "atlantis").isEmpty())
    }
}
