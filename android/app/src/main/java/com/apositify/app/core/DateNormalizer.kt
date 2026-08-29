package com.apositify.app.core

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.format.ResolverStyle
import java.util.Locale

object DateNormalizer {
    enum class NumericOrder { DAY_FIRST, MONTH_FIRST, UNKNOWN }

    /// Day-first is right almost everywhere. The United States is month-first,
    /// and three jurisdictions use both orders in everyday writing, so their
    /// nationality decides nothing and the date must not be interpreted from
    /// it. (The Philippines prints no date on its Apostille; Israel and Saudi
    /// Arabia do. Saudi certificates may also carry a Hijri date, which no
    /// day/month order can rescue.)
    fun orderFor(country: String): NumericOrder = when (country) {
        "United States of America" -> NumericOrder.MONTH_FIRST
        "Philippines", "Saudi Arabia", "Israel" -> NumericOrder.UNKNOWN
        else -> NumericOrder.DAY_FIRST
    }

    fun isoDate(raw: String, country: String? = null): String? =
        isoDate(raw, country?.let(::orderFor) ?: NumericOrder.UNKNOWN)

    fun isoDate(raw: String, order: NumericOrder): String? {
        val value = raw.trim().replace(Regex("(?i)(\\d)(st|nd|rd|th)\\b"), "$1")
        Regex("^(\\d{4})[-./](\\d{1,2})[-./](\\d{1,2})$").matchEntire(value)?.let {
            return validIso(it.groupValues[1].toInt(), it.groupValues[2].toInt(), it.groupValues[3].toInt())
        }
        Regex("^(\\d{1,2})[-./](\\d{1,2})[-./](\\d{2}|\\d{4})$").matchEntire(value)?.let {
            val first = it.groupValues[1].toInt()
            val second = it.groupValues[2].toInt()
            val yearValue = it.groupValues[3].toInt()
            val year = if (yearValue < 100) 2000 + yearValue else yearValue
            if (first <= 12 && second <= 12 && order == NumericOrder.UNKNOWN) return null
            val (day, month) = when {
                first > 12 -> first to second
                second > 12 -> second to first
                order == NumericOrder.DAY_FIRST -> first to second
                else -> second to first
            }
            return validIso(year, month, day)
        }
        Regex("^(\\d{4})年(\\d{1,2})月(\\d{1,2})日$").matchEntire(value)?.let {
            return validIso(it.groupValues[1].toInt(), it.groupValues[2].toInt(), it.groupValues[3].toInt())
        }

        // Japan prints "Jul. 10.2026": the month is abbreviated with a period
        // and the same period separates day from year. Numeric forms have
        // already returned above, so loosening the separators here is safe.
        val cleaned = value.replace(Regex("(?i)\\bde\\b"), " ")
            .replace(Regex("(?<=\\p{L})[.,]"), " ")
            .replace(Regex("(?<=\\d)[.,](?=\\d{4})"), " ")
            .replace(Regex("\\s+"), " ").trim()
        val patterns = listOf(
            "d MMMM uuuu", "d MMM uuuu", "MMMM d, uuuu", "MMM d, uuuu", "MMMM d uuuu", "MMM d uuuu",
        )
        val locales = listOf(
            Locale.ENGLISH, Locale.FRENCH, Locale.forLanguageTag("es"),
            Locale.GERMAN, Locale.ITALIAN, Locale.forLanguageTag("pt"),
        )
        for (locale in locales) for (pattern in patterns) {
            val formatter = DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern(pattern)
                .toFormatter(locale).withResolverStyle(ResolverStyle.STRICT)
            runCatching { LocalDate.parse(cleaned, formatter) }.getOrNull()?.let { return it.toString() }
        }
        return null
    }

    fun formatted(raw: String, format: String?, order: NumericOrder): String {
        val iso = isoDate(raw, order) ?: return raw.trim()
        val date = LocalDate.parse(iso)
        return when (format) {
            "date-iso" -> iso
            "date-dotted" -> date.format(DateTimeFormatter.ofPattern("dd.MM.uuuu"))
            else -> raw.trim()
        }
    }

    private fun validIso(year: Int, month: Int, day: Int): String? =
        runCatching { LocalDate.of(year, month, day).toString() }.getOrNull()
}
