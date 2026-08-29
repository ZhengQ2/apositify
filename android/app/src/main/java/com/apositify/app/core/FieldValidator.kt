package com.apositify.app.core

import com.apositify.app.model.VerificationField
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle

object FieldValidator {
    fun error(field: VerificationField, rawValue: String): String? {
        val value = rawValue.trim()
        if (value.isEmpty()) return "Required"
        return when (field.format) {
            "date-iso" -> if (!strictDate(value, Regex("^\\d{4}-\\d{2}-\\d{2}$"), "uuuu-MM-dd")) "Use YYYY-MM-DD" else null
            "date-dotted" -> if (!strictDate(value, Regex("^\\d{2}\\.\\d{2}\\.\\d{4}$"), "dd.MM.uuuu")) "Use DD.MM.YYYY" else null
            "non-arij-apostille-code" -> if (value.startsWith("arij", ignoreCase = true)) "ARIJ codes use Moldova’s separate MPass service" else null
            else -> null
        }
    }

    private fun strictDate(value: String, shape: Regex, format: String): Boolean =
        shape.matches(value) && runCatching {
            LocalDate.parse(value, DateTimeFormatter.ofPattern(format).withResolverStyle(ResolverStyle.STRICT))
        }.isSuccess
}
