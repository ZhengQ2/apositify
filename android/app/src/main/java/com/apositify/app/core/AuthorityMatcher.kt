package com.apositify.app.core

import com.apositify.app.model.AuthorityMatch
import com.apositify.app.model.RecognitionResult
import com.apositify.app.model.RegisterEntry
import java.text.Normalizer

class AuthorityMatcher(private val entries: List<RegisterEntry>) {
    fun matches(recognition: RecognitionResult, limit: Int = 5): List<AuthorityMatch> {
        val text = normalize(recognition.fullText)
        val itemSeven = ApostilleParser.numberedItems(recognition.lines)[7]?.let(::normalize).orEmpty()
        val tokens = text.split(' ').toSet()
        val itemTokens = itemSeven.split(' ').toSet()
        val lines = recognition.lines.map { normalize(it.text) }
        val countries = detectCountries(lines, text)

        return entries.mapNotNull { entry ->
            val countryHit = entry.country in countries
            val authorityTokens = significant(entry.authority)
            val hits = authorityTokens.count { it in tokens }
            val itemHits = authorityTokens.count { it in itemTokens }
            val aliasHit = aliases[entry.id].orEmpty().any { phrase(normalize(it), text) }
            var score = if (countryHit) 0.66 else 0.0
            if (authorityTokens.isNotEmpty()) {
                score += 0.24 * hits / authorityTokens.size
                score += 0.10 * itemHits / authorityTokens.size
            }
            if (aliasHit) score += 0.28
            if (countryHit && entries.count { it.country == entry.country } == 1) score = maxOf(score, 0.91)
            if (score < 0.20) null else AuthorityMatch(
                entry, minOf(score, 1.0),
                if (countryHit && hits > 0) "Country and issuing authority appear in the scan"
                else if (countryHit) "Country appears in the scan" else "Issuing authority words appear in the scan",
            )
        }.sortedWith(compareByDescending<AuthorityMatch> { it.score }.thenBy { it.entry.authority }).take(limit)
    }

    // The parenthesis matters: `.map` used to bind to the `when` block alone,
    // leaving the plain country name un-normalised and therefore unable to match
    // the normalised scan text. Only countries with a hand-written lowercase
    // alias below worked; the rest never matched at all.
    private fun countryNames(country: String): List<String> = (listOf(country) + when (country) {
        "Korea, Republic of" -> listOf("republic of korea", "south korea", "대한민국")
        "Moldova, Republic of" -> listOf("republic of moldova", "moldova")
        "China" -> listOf("china", "中国", "中國")
        "Türkiye" -> listOf("turkiye", "turkey", "türkiye")
        "United States of America" -> listOf("united states of america", "united states", "usa")
        "Russian Federation" -> listOf("russian federation", "russia", "российская федерация", "россия")
        else -> emptyList()
    }).map(::normalize).distinct()

    private fun significant(value: String): List<String> {
        val ignored = setOf("and", "of", "the", "for", "to", "de", "la", "le", "du", "des", "et", "ministry", "minister", "department", "office", "authority")
        return normalize(value).split(' ').filter { it.length > 2 && it !in ignored }
    }

    private fun normalize(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
        .lowercase().replace(Regex("[^\\p{L}\\p{N}]+"), " ").replace(Regex("\\s+"), " ").trim()
    /// An Apostille prints its country as a field value, not inside a sentence.
    /// A Hong Kong certificate whose attached notarial page happened to mention
    /// exporting goods "to India" was read as an Indian Apostille, because a
    /// country name anywhere on the page counted the same as the country field.
    /// Require the name to account for a real share of the line it sits on, and
    /// fall back to the whole page when that finds nothing.
    private fun detectCountries(lines: List<String>, text: String): Set<String> {
        val distinctCountries = entries.map { it.country }.distinct()
        val fieldLike = distinctCountries.filter { country ->
            countryNames(country).any { name ->
                lines.any { line -> phrase(name, line) && name.length * 2 + 24 >= line.length }
            }
        }.toSet()
        if (fieldLike.isNotEmpty()) return fieldLike
        return distinctCountries.filter { countryNames(it).any { name -> phrase(name, text) } }.toSet()
    }

    /// A country name printed only inside a larger place name belonging to a
    /// different state is not that country. "United Kingdom of Great Britain and
    /// Northern Ireland" names one country, and reading "Ireland" out of it put
    /// every UK Apostille under the wrong authority.
    private val shadowingPhrases = mapOf("ireland" to listOf("northern ireland"))

    private fun phrase(needle: String, haystack: String): Boolean {
        var padded = " $haystack "
        shadowingPhrases[needle].orEmpty().forEach { padded = padded.replace(" $it ", " ") }
        return padded.contains(" $needle ")
    }

    private val aliases = mapOf(
        "united-kingdom-foreign-and-commonwealth-office" to listOf("legalisation office", "legalization office", "foreign commonwealth and development office", "fcdo"),
    )
}
