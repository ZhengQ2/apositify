package com.apositify.app.model

import java.net.URI

data class RegisterCatalog(
    val schemaVersion: Int = 0,
    val sourceUrl: String = "",
    val entries: List<RegisterEntry> = emptyList(),
)

data class RegisterEntry(
    val id: String = "",
    val country: String = "",
    val authority: String = "",
    val registerUrl: String? = null,
    val verificationMode: String = "",
    val notes: String = "",
    val registerLinks: List<RegisterLink> = emptyList(),
    val registerGuide: RegisterGuide? = null,
    val qrRoutes: List<QrRoute> = emptyList(),
    val verification: VerificationConfig? = null,
)

data class RegisterLink(val label: String = "", val url: String = "")
data class RegisterGuide(val title: String = "", val steps: List<String> = emptyList())

data class VerificationConfig(
    val kind: String = "fields",
    val fields: List<VerificationField> = emptyList(),
    val note: String? = null,
    val deepLink: DeepLink? = null,
)

data class VerificationField(
    val id: String = "",
    val label: String = "",
    val placeholder: String = "Exactly as printed",
    val format: String? = null,
    val aliases: List<String> = emptyList(),
    val browserSelectors: List<String> = emptyList(),
    val captureSource: String = "document",
    val standardItem: Int? = null,
    val pattern: String? = null,
)

data class DeepLink(
    val method: String = "get",
    val url: String = "",
    val extraParams: Map<String, String> = emptyMap(),
    val paramOrder: List<String> = emptyList(),
)

data class QrRoute(
    val function: String = "",
    val specimenCount: Int = 0,
    val normalizeSchemelessTo: String? = null,
    val allowedUrls: List<QrUrlRule> = emptyList(),
)

data class QrUrlRule(
    val protocol: String = "https:",
    val hostname: String = "",
    val port: String = "",
    val pathnamePattern: String? = null,
    val allowedSearchParams: List<String> = emptyList(),
    val requiredSearchParams: List<String> = emptyList(),
    val staticSearchParams: Map<String, String> = emptyMap(),
    val allowSubdomains: Boolean = false,
    val allowFragment: Boolean = false,
    val requireFragment: Boolean = false,
    val fragmentPattern: String? = null,
    val insecureAccepted: Boolean = false,
    val tokenPattern: String? = null,
    val tokenGroup: Int? = null,
    val tokenSource: String? = null,
    val canonicalUrlTemplate: String? = null,
)

data class NormalizedRect(
    val left: Float = 0f,
    val top: Float = 0f,
    val right: Float = 0f,
    val bottom: Float = 0f,
) {
    val width get() = right - left
    val height get() = bottom - top
    val centerX get() = (left + right) / 2f
    val centerY get() = (top + bottom) / 2f
    val isEmpty get() = width <= 0 || height <= 0
}
data class RecognizedLine(val text: String, val bounds: NormalizedRect = NormalizedRect())
data class RecognitionResult(val lines: List<RecognizedLine>) {
    val fullText: String get() = lines.joinToString("\n") { it.text }
}

data class QrMatch(
    val entry: RegisterEntry,
    val destination: URI,
    val function: String,
    val rawPayload: String,
    val specimenCount: Int,
)

sealed interface ScanOutcome {
    data class Qr(val match: QrMatch) : ScanOutcome
    data class Text(val recognition: RecognitionResult, val detectedQrPayloads: List<String>) : ScanOutcome
}

data class ExtractedField(
    val id: String,
    val label: String,
    val value: String,
    val sourceText: String? = null,
    val suggestedValues: List<String> = emptyList(),
    val aliases: List<String> = emptyList(),
    val browserSelectors: List<String> = emptyList(),
    val captureSource: String = "document",
)

data class AuthorityMatch(
    val entry: RegisterEntry,
    val score: Double,
    val evidence: String,
)
