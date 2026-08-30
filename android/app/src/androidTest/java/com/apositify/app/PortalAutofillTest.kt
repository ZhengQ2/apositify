package com.apositify.app

import android.webkit.WebView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.apositify.app.data.RegisterStore
import com.apositify.app.model.ExtractedField
import com.apositify.app.model.RegisterEntry
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Loads each authority's verification portal in a real WebView and injects the
 * script the app actually ships, to report how many of that authority's fields
 * the page would accept.
 *
 * This is a survey, not a pass/fail gate. The portals are live third-party
 * sites: they change, they rate-limit, and several are unreachable from any
 * given network, so failing the build on their behaviour would make the suite
 * lie about the app. Nothing is ever submitted — the script fills controls in
 * the page and the test reads them back.
 */
@RunWith(AndroidJUnit4::class)
class PortalAutofillTest {
    @Test
    fun reportsWhichPortalsAcceptTheReviewedValues() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val entries = RegisterStore(context).entries.filter { entry ->
            entry.verification?.kind == "fields" && entry.registerUrl?.startsWith("https") == true
        }

        // Logged as each portal is measured, not accumulated to the end: these
        // runs take minutes over live networks, and a device that drops off USB
        // partway through should still leave everything it had already learned.
        val totals = mutableMapOf<String, Int>()
        for (entry in entries) {
            val fields = probeFields(entry)
            if (fields.isEmpty()) {
                record(totals, "no-document-fields", entry, 0, 0)
                continue
            }
            val outcome = runCatching { fill(entry, fields) }.getOrElse { error ->
                record(totals, "error: ${error.message?.take(40)}", entry, 0, fields.size)
                continue
            }
            val status = when {
                outcome.controls == 0 -> "no-controls"
                outcome.filled == fields.size -> "all-filled"
                outcome.filled > 0 -> "partial"
                else -> "none-matched"
            }
            record(totals, status, entry, outcome.filled, fields.size, outcome.controls)
        }
        android.util.Log.i(
            TAG,
            "--- " + totals.entries.sortedByDescending { it.value }.joinToString(", ") { "${it.key}: ${it.value}" },
        )
    }

    private data class Outcome(val filled: Int, val controls: Int)

    /** Values shaped like the real thing, so nothing real is typed into a live form. */
    private fun probeFields(entry: RegisterEntry): List<ExtractedField> =
        entry.verification?.fields.orEmpty()
            .filter { it.captureSource == "document" }
            .map { config ->
                ExtractedField(
                    id = config.id,
                    label = config.label,
                    value = if (config.standardItem == 6) "19/06/2026" else "PROBE-0000-0000",
                    aliases = config.aliases,
                    browserSelectors = config.browserSelectors,
                    captureSource = config.captureSource,
                )
            }

    private fun fill(entry: RegisterEntry, fields: List<ExtractedField>): Outcome {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        var webView: WebView? = null
        val loaded = CountDownLatch(1)

        instrumentation.runOnMainSync {
            webView = WebView(instrumentation.targetContext).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                webViewClient = object : android.webkit.WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) = loaded.countDown()
                    override fun onReceivedError(
                        view: WebView?,
                        request: android.webkit.WebResourceRequest?,
                        error: android.webkit.WebResourceError?,
                    ) {
                        if (request?.isForMainFrame == true) loaded.countDown()
                    }
                }
                loadUrl(entry.registerUrl!!)
            }
        }
        loaded.await(PAGE_LOAD_SECONDS, TimeUnit.SECONDS)
        // Single-page verifiers mount their form after load; the app's own
        // script re-runs on mutation, so give the page the same chance here.
        Thread.sleep(HYDRATION_MILLIS)

        val controls = evaluate(webView!!, COUNT_CONTROLS)?.toIntOrNull() ?: 0
        // The app re-runs its script on every DOM mutation for ten seconds, so
        // a form that mounts late is still filled. Injecting once under-reported
        // exactly those pages — Ontario among them, which the audit called
        // partial while the app fills it completely. Inject twice to match.
        evaluate(webView!!, autofillScript(entry, fields))
        Thread.sleep(HYDRATION_MILLIS)
        evaluate(webView!!, autofillScript(entry, fields))
        val filled = evaluate(webView!!, countFilled(fields))?.toIntOrNull() ?: 0

        instrumentation.runOnMainSync { webView?.destroy() }
        return Outcome(filled = filled, controls = controls)
    }

    private fun countFilled(fields: List<ExtractedField>): String {
        val values = fields.joinToString(",") { "\"${it.value}\"" }
        return """
            (() => {
              const wanted = [$values];
              const seen = [...document.querySelectorAll('input, select, textarea')].map(el => el.value);
              return wanted.filter(value => seen.includes(value)).length;
            })();
        """.trimIndent()
    }

    private fun evaluate(webView: WebView, script: String): String? {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val done = CountDownLatch(1)
        var result: String? = null
        instrumentation.runOnMainSync {
            webView.evaluateJavascript(script) { value ->
                result = value?.trim('"')
                done.countDown()
            }
        }
        done.await(EVALUATE_SECONDS, TimeUnit.SECONDS)
        return result?.takeUnless { it == "null" }
    }

    private fun record(
        totals: MutableMap<String, Int>,
        status: String,
        entry: RegisterEntry,
        filled: Int,
        total: Int,
        controls: Int = 0,
    ) {
        totals[status] = (totals[status] ?: 0) + 1
        android.util.Log.i(
            TAG,
            status.padEnd(26) + entry.country.take(20).padEnd(20) +
                "$filled/$total fields, $controls controls  " + entry.id.take(46),
        )
    }

    private companion object {
        const val TAG = "PortalAudit"
        const val PAGE_LOAD_SECONDS = 15L
        const val EVALUATE_SECONDS = 10L
        const val HYDRATION_MILLIS = 2_500L
        const val COUNT_CONTROLS =
            "document.querySelectorAll('input:not([type=hidden]), select, textarea').length"
    }
}
