package com.apositify.app.core

import com.apositify.app.model.ExtractedField
import com.apositify.app.model.RecognitionResult
import com.apositify.app.model.RecognizedLine
import com.apositify.app.model.RegisterEntry
import com.apositify.app.model.VerificationField
import java.text.Normalizer

object ApostilleParser {
    private data class Anchor(val item: Int, val index: Int, val line: RecognizedLine, val inline: String)
    private data class Candidate(val value: String, val source: String)

    fun numberedItems(lines: List<RecognizedLine>): Map<Int, String> = resolvedItems(lines).mapValues { it.value.value }

    fun extractFields(entry: RegisterEntry, recognition: RecognitionResult): List<ExtractedField> {
        val items = resolvedItems(recognition.lines)
        return entry.verification?.fields.orEmpty().map { field ->
            val candidates = if (field.captureSource == "portal") emptyList() else resolve(field, entry, recognition.lines, items)
            val confirmed = candidates.singleOrNull()?.takeIf { isDeterministic(field, recognition.lines, candidates) }
            ExtractedField(
                id = field.id,
                label = field.label,
                value = confirmed?.let { format(it.value, field, entry.country) }.orEmpty(),
                sourceText = confirmed?.source,
                suggestedValues = if (confirmed == null) candidates.map { format(it.value, field, entry.country) }.distinct().take(3) else emptyList(),
                aliases = field.aliases,
                browserSelectors = field.browserSelectors,
                captureSource = field.captureSource,
            )
        }
    }

    private fun resolve(
        field: VerificationField,
        entry: RegisterEntry,
        lines: List<RecognizedLine>,
        items: Map<Int, Candidate>,
    ): List<Candidate> {
        field.pattern?.let { pattern ->
            val matches = patternCandidates(pattern, lines)
            if (matches.isNotEmpty()) return unique(matches)
        }

        val anchors = anchors(lines).filter { it.item == field.standardItem }
        val inline = anchors.mapNotNull { anchor ->
            anchor.inline.takeIf { it.isNotBlank() && semantic(field, it, entry.country) }?.let { Candidate(it, anchor.line.text) }
        }
        if (inline.isNotEmpty()) return unique(inline)

        inlineLabeled(field, lines, entry.country)?.let { return listOf(it) }

        if (field.standardItem == 6) {
            val dates = dateCandidates(lines, entry.country)
            if (dates.size == 1 && (anchors.isNotEmpty() || hasIssueDateSignal(dates[0].source))) return dates
            return prefer(items[6], dates)
        }
        if (field.standardItem == 8) {
            val refs = referenceCandidates(lines)
            if (refs.size == 1 && anchors.isNotEmpty()) return refs
            return prefer(items[8], refs)
        }

        field.standardItem?.let { items[it]?.let { candidate -> return listOf(candidate) } }
        valueBesideLabel(field, lines)?.let { return listOf(it) }
        return emptyList()
    }

    private fun isDeterministic(field: VerificationField, lines: List<RecognizedLine>, candidates: List<Candidate>): Boolean {
        if (candidates.size != 1) return false
        if (field.pattern != null) return true
        if (field.standardItem == 6 || field.standardItem == 8) {
            val hasAnchor = anchors(lines).any { it.item == field.standardItem }
            val sameLineLabel = field.aliases.any { alias -> candidates[0].source.contains(alias, ignoreCase = true) }
            return hasAnchor || sameLineLabel || (field.standardItem == 6 && hasIssueDateSignal(candidates[0].source))
        }
        return true
    }

    private fun resolvedItems(lines: List<RecognizedLine>): Map<Int, Candidate> {
        val result = mutableMapOf<Int, Pair<Candidate, Int>>()
        fun offer(item: Int, candidate: Candidate, bonus: Int) {
            val score = score(candidate.value, item) + bonus
            if ((result[item]?.second ?: Int.MIN_VALUE) < score) result[item] = candidate to score
        }
        anchors(lines).filter { it.inline.isNotBlank() }.forEach { offer(it.item, Candidate(it.inline, it.line.text), 30) }
        spatialPairs(lines).forEach { (item, candidate) -> offer(item, candidate, 20) }
        rawBlocks(lines).forEach { (item, values) -> values.maxByOrNull { score(it, item) }?.let { offer(item, Candidate(it, it), 0) } }
        return result.mapValues { it.value.first }
    }

    private fun anchors(lines: List<RecognizedLine>): List<Anchor> = lines.mapIndexedNotNull { index, line ->
        val text = clean(line.text)
        Regex("^\\s*(10|[1-9])\\s*[.):\\-]\\s*(.*)$").find(text)?.let {
            Anchor(it.groupValues[1].toInt(), index, line, stripLabels(it.groupValues[2], it.groupValues[1].toInt()))
        } ?: if (containsRtl(text)) Regex("^(.*?)\\s*[.):\\-]\\s*(10|[1-9])\\s*$").find(text)?.let {
            Anchor(it.groupValues[2].toInt(), index, line, stripLabels(it.groupValues[1], it.groupValues[2].toInt()))
        } else null
    }

    private fun spatialPairs(lines: List<RecognizedLine>): Map<Int, Candidate> {
        val allAnchors = anchors(lines)
        val anchorIndices = allAnchors.map { it.index }.toSet()
        data class Pairing(val cost: Float, val anchor: Anchor, val candidateIndex: Int)
        val proposals = allAnchors.filter { it.inline.isBlank() }.flatMap { anchor ->
            lines.mapIndexedNotNull { index, candidate ->
                if (index in anchorIndices || structural(candidate.text)) null
                else pairingCost(anchor.line, candidate)?.let { Pairing(it, anchor, index) }
            }
        }.sortedBy { it.cost }
        val usedAnchors = mutableSetOf<Int>()
        val usedCandidates = mutableSetOf<Int>()
        val result = mutableMapOf<Int, Candidate>()
        for (proposal in proposals) {
            if (!usedAnchors.add(proposal.anchor.index) || !usedCandidates.add(proposal.candidateIndex)) continue
            val line = lines[proposal.candidateIndex]
            val value = stripLabels(line.text, proposal.anchor.item)
            if (value.isBlank()) continue
            val existing = result[proposal.anchor.item]
            if (existing == null || score(value, proposal.anchor.item) > score(existing.value, proposal.anchor.item)) {
                result[proposal.anchor.item] = Candidate(value, proposal.anchor.line.text + " " + line.text)
            }
        }
        return result
    }

    private fun pairingCost(label: RecognizedLine, candidate: RecognizedLine): Float? {
        val a = label.bounds
        val b = candidate.bounds
        if (a.isEmpty || b.isEmpty) return null
        val verticalOverlap = (minOf(a.bottom, b.bottom) - maxOf(a.top, b.top)).coerceAtLeast(0f)
        val minHeight = minOf(a.height, b.height).coerceAtLeast(0.001f)
        val rowOverlap = verticalOverlap / minHeight
        val horizontalGap = (b.left - a.right).coerceAtLeast(0f)
        val belowGap = (b.top - a.bottom).coerceAtLeast(0f)
        return when {
            rowOverlap >= 0.35f && b.centerX > a.centerX -> horizontalGap + kotlin.math.abs(b.centerY - a.centerY) * 0.35f
            belowGap <= maxOf(a.height, b.height) * 2.4f -> belowGap * 1.4f + kotlin.math.abs(b.left - a.left) * 0.35f
            else -> null
        }
    }

    private fun rawBlocks(lines: List<RecognizedLine>): Map<Int, List<String>> {
        val result = mutableMapOf<Int, MutableList<String>>()
        var current: Int? = null
        for (line in lines) {
            val match = Regex("^\\s*(10|[1-9])\\s*[.):\\-]\\s*(.*)$").find(line.text.trim())
            if (match != null) {
                current = match.groupValues[1].toInt()
                if (match.groupValues[2].isNotBlank()) result.getOrPut(current) { mutableListOf() }.add(match.groupValues[2])
            } else if (current != null && !conventionReference(line.text) && !structural(line.text)) {
                result.getOrPut(current) { mutableListOf() }.add(line.text)
            }
        }
        return result
    }

    private fun dateCandidates(lines: List<RecognizedLine>, country: String): List<Candidate> {
        val patterns = listOf(
            Regex("(?<!\\d)\\d{4}[-./]\\d{1,2}[-./]\\d{1,2}(?!\\d)"),
            Regex("(?<!\\d)\\d{1,2}[-./]\\d{1,2}[-./]\\d{2,4}(?!\\d)"),
            Regex("(?i)(?<!\\d)\\d{1,2}(?:st|nd|rd|th)?(?:\\s+de)?\\s+[\\p{L}.]+(?:\\s+de)?\\s+\\d{4}(?!\\d)"),
            Regex("(?i)[\\p{L}.]+\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{4}"),
            Regex("\\d{4}年\\d{1,2}月\\d{1,2}日"),
        )
        val seenIso = mutableSetOf<String>()
        return lines.filterNot { conventionReference(it.text) }.flatMap { line ->
            patterns.flatMap { regex -> regex.findAll(line.text).mapNotNull { match ->
                DateNormalizer.isoDate(match.value, country)?.takeIf(seenIso::add)?.let { Candidate(match.value, line.text) }
            }.toList() }
        }
    }

    private fun referenceCandidates(lines: List<RecognizedLine>): List<Candidate> {
        val regex = Regex("[\\p{L}\\p{N}](?:[\\p{L}\\p{N}]|[._/\\-]){3,47}")
        return unique(lines.filterNot { structural(it.text) }.flatMap { line ->
            regex.findAll(line.text).mapNotNull { match -> match.value.takeIf(::plausibleReference)?.let { Candidate(it, line.text) } }.toList()
        })
    }

    private fun inlineLabeled(field: VerificationField, lines: List<RecognizedLine>, country: String): Candidate? {
        for (line in lines) for (alias in field.aliases.sortedByDescending(String::length)) {
            val index = line.text.indexOf(alias, ignoreCase = true)
            if (index < 0) continue
            val value = clean(line.text.substring(index + alias.length).trim(' ', ':', '/', '-', '–', '—'))
            if (value.isNotBlank() && semantic(field, value, country)) return Candidate(value, line.text)
        }
        return null
    }

    private fun valueBesideLabel(field: VerificationField, lines: List<RecognizedLine>): Candidate? {
        for ((index, line) in lines.withIndex()) for (alias in field.aliases.sortedByDescending(String::length)) {
            val position = line.text.indexOf(alias, ignoreCase = true)
            if (position < 0) continue
            val suffix = clean(line.text.substring(position + alias.length).trim(' ', ':', '/', '-'))
            if (suffix.isNotBlank()) return Candidate(suffix, line.text)
            val next = lines.getOrNull(index + 1)?.takeUnless { structural(it.text) } ?: continue
            return Candidate(clean(next.text), line.text + " " + next.text)
        }
        return null
    }

    private fun patternCandidates(pattern: String, lines: List<RecognizedLine>): List<Candidate> = runCatching {
        val regex = Regex(pattern, RegexOption.IGNORE_CASE)
        unique(lines.flatMap { line -> regex.findAll(line.text).map { Candidate(it.value, line.text) }.toList() })
    }.getOrDefault(emptyList())

    private fun prefer(preferred: Candidate?, candidates: List<Candidate>): List<Candidate> {
        if (preferred == null) return unique(candidates)
        val selected = candidates.firstOrNull { normalize(preferred.value).contains(normalize(it.value)) }
        return unique(listOfNotNull(selected) + candidates)
    }

    private fun semantic(field: VerificationField, value: String, country: String): Boolean = when (field.standardItem) {
        6 -> DateNormalizer.isoDate(value, country) != null
        8 -> plausibleReference(value)
        else -> true
    }

    private fun plausibleReference(value: String): Boolean {
        val cleaned = clean(value).trim('.', ':', '/', '|', '-', ' ')
        if (cleaned.length !in 4..48 || !cleaned.any(Char::isDigit) || cleaned.split(Regex("\\s+")).size > 3) return false
        if (DateNormalizer.isoDate(cleaned) != null) return false
        return cleaned.count(Char::isLetterOrDigit) >= 4 && !(cleaned.all(Char::isDigit) && cleaned.length < 5)
    }

    private val labelPatterns = mapOf(
        1 to "country|pays|pa[ií]s|land|paese|χώρα|[üu]lke|[țt]ara|страна|държава|الدولة|文书出具国|國家|国家|국가",
        2 to "has been signed by|a été signé par|ha sido firmado por|unterzeichnet von|è stato firmato da|is ondertekend door|a fost semnat[ăa] de|έχει υπογραφεί από|imzalayan|подписан|签署人",
        3 to "acting in the capacity of|agissant en qualité de|quien actúa en calidad de|in seiner eigenschaft als|nella qualità di|handelend in de hoedanigheid van|în calitate de|με την ιδιότητα|s[ıi]fat[ıi]yla|в качестве|身份",
        4 to "bears? the seal\\W*(?:or\\W*)?stamp\\W*of|bears? the (?:seal|stamp)\\W*of|est rev[êe]tu du sceau\\W*(?:ou\\W*)?(?:du\\W*)?timbre de|(?:y\\W*)?est[áa] revestido del sello\\W*(?:o\\W*)?(?:del\\W*)?timbre de|seal|stamp|sceau|sello|timbro|sigillo|zegel|stempel|sigiliul|[șs]tampila|σφραγίδα|m[üu]h[üu]r|damga|печать|印章",
        5 to "at|à|en|in|в|地点",
        6 to "dated?|date|the|fecha|el\\s+d[ií]a|d[ií]a|le|il|op|am|data|datum|dato|tanggal|ημερομηνία|tarih|дата|التاريخ|签发日期|簽發日期|日期|日付",
        7 to "by|par|por|durch|da|door|de c[ăa]tre|από|taraf[ıi]ndan|от|بواسطة|签发人|簽發人|由|발급자",
        8 to "number|num[eé]ro|n[uú]mero|num[ăa]rul|nummer|bajo\\s+el\\s+n[uú]mero|unter\\s+nr\\.?|unter\\s+zahl|zahl|onder\\s+nr\\.?|sous\\s+n[oº°]\\.?|no\\.?|nr\\.?|n[º°]|αριθμ[όο]ς|αρ\\.?|numara|say[ıi]|номер|رقم|附加证明书编号|附加證明書編號|编号|編號|番号",
        9 to "seal.?stamp|sceau.?timbre|sello.?timbre|sigillo|zegel|stempel|sigiliu|σφραγίδα|m[üu]h[üu]r|печать|印章",
        10 to "signature|firma|handtekening|semn[ăa]tura|υπογραφή|imza|подпись|签名|署名",
    )

    private fun stripLabels(value: String, item: Int): String {
        var result = clean(value)
        val pattern = labelPatterns[item] ?: return result
        repeat(4) {
            val replaced = result.replace(Regex("^[\\s.:/|·•–—-]*(?:$pattern)(?![\\p{L}\\p{N}])", RegexOption.IGNORE_CASE), "")
            if (replaced == result) return@repeat
            result = replaced
        }
        return clean(result.trim('.', ':', '/', '|', '·', '•', '–', '—', '-', ' '))
    }

    private fun score(value: String, item: Int): Int {
        var result = value.count(Char::isLetterOrDigit)
        if (item == 6 && DateNormalizer.isoDate(value) != null) result += 200
        if (item == 8) {
            if (value.any(Char::isDigit)) result += 100
            result -= 25 * (value.split(Regex("\\s+")).size - 1).coerceAtLeast(0)
        }
        return result
    }

    private fun structural(text: String) = anchors(listOf(RecognizedLine(text))).isNotEmpty() || conventionReference(text)
    private fun conventionReference(text: String) = (text.contains("1961") || text.contains("١٩٦١") || text.contains("۱۹۶۱")) &&
        Regex("(?i)convention|convenio|konvention|verdrag|übereinkommen|конвенц|اتفاقي|公约|公約|条約|협약|la haye|hague|la haya|haag").containsMatchIn(text)
    private fun hasIssueDateSignal(text: String) = Regex("(?i)issued|issue\\s+date|date\\s+of\\s+issue|dated|certified\\s+on|fecha\\s+de\\s+emisi[oó]n|date\\s+d['’]émission|ausstellungsdatum").containsMatchIn(text) &&
        !Regex("(?i)underlying|source\\s+document|original\\s+document").containsMatchIn(text)
    private fun containsRtl(text: String) = text.any { it.code in 0x0590..0x08FF || it.code in 0xFB1D..0xFEFF }
    private fun clean(value: String) = value.replace(Regex("\\s+"), " ").trim()
    private fun normalize(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
        .lowercase().replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim()
    private fun unique(values: List<Candidate>): List<Candidate> = values.distinctBy { normalize(it.value) }.take(3)
    private fun format(value: String, field: VerificationField, country: String) = DateNormalizer.formatted(clean(value), field.format, country)
}
