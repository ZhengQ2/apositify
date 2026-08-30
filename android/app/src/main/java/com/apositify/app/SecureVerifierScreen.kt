package com.apositify.app

import android.annotation.SuppressLint
import android.os.Message
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.apositify.app.core.DateNormalizer
import com.apositify.app.core.OfficialHostPolicy
import com.apositify.app.core.VerificationRoute
import com.apositify.app.model.ExtractedField
import com.apositify.app.model.RegisterEntry
import com.google.gson.Gson
import java.net.URI

private data class BrowserField(
    val value: String,
    val dateValue: String?,
    val aliases: List<String>,
    val selectors: List<String>,
)

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun SecureVerifierScreen(
    entry: RegisterEntry,
    route: VerificationRoute,
    fields: List<ExtractedField>,
    close: () -> Unit,
) {
    val context = LocalContext.current
    val initial = when (route) {
        is VerificationRoute.Get -> route.uri
        is VerificationRoute.Post -> route.uri
        is VerificationRoute.Official -> route.uri
        else -> null
    }
    val policy = remember(entry.id, initial) { OfficialHostPolicy.forEntry(entry, initial) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var external by remember { mutableStateOf<URI?>(null) }
    var current by remember { mutableStateOf(initial) }
    var loading by remember { mutableStateOf(true) }
    var progress by remember { mutableStateOf(0) }
    var loadError by remember { mutableStateOf<String?>(null) }
    val script = remember(entry.id, fields) { autofillScript(entry, fields) }

    BackHandler {
        val web = webView
        if (web?.canGoBack() == true) web.goBack() else close()
    }

    val clipboard = LocalClipboardManager.current
    var copiedFieldId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(copiedFieldId) {
        if (copiedFieldId != null) {
            kotlinx.coroutines.delay(1_600)
            copiedFieldId = null
        }
    }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text("Official verifier") },
            navigationIcon = { TextButton(onClick = close) { Text("Close") } },
            actions = {
                IconButton(
                    enabled = current != null,
                    onClick = {
                        current?.let { context.openExternally(it.toString()) }
                    },
                ) {
                    Icon(Icons.Default.OpenInBrowser, contentDescription = "Open in browser")
                }
            },
        )
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
                    Icon(Icons.Default.Lock, null, tint = Color(0xFF14845A), modifier = Modifier.width(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text(entry.authority, style = MaterialTheme.typography.labelLarge, maxLines = 1)
                        Text(
                            current?.host ?: "Opening official site…",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                        )
                    }
                }
            }
            // Autofill matches an authority's form by what it calls its own
            // controls, and a third of the corpus names them something the
            // reviewed values cannot be matched against. Those pages are still
            // the official verifier, so the values have to be reachable by hand
            // rather than retyped from a certificate the user is no longer
            // looking at.
            val copyable = fields.filter { it.captureSource == "document" && it.value.isNotBlank() }
            if (copyable.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    copyable.forEach { field ->
                        AssistChip(
                            onClick = {
                                clipboard.setText(AnnotatedString(field.value))
                                copiedFieldId = field.id
                            },
                            label = {
                                // The label's parenthetical is guidance for
                                // filling the field in — "(format
                                // 11-AA-AAAA-AAAA)" — and on a chip it pushes
                                // the value itself off the screen edge.
                                val name = field.label.replace(Regex("\\s*\\([^)]*\\)"), "")
                                Text(
                                    if (copiedFieldId == field.id) "Copied" else "$name: ${field.value}",
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    style = MaterialTheme.typography.labelMedium,
                                )
                            },
                            leadingIcon = {
                                Icon(Icons.Default.ContentCopy, null, Modifier.width(16.dp))
                            },
                        )
                    }
                }
                HorizontalDivider()
            }
            if (loading) {
                LinearProgressIndicator(
                    progress = { progress / 100f },
                    modifier = Modifier.fillMaxWidth().height(2.dp),
                )
            } else {
                HorizontalDivider()
            }
            loadError?.let { message ->
                Surface(color = MaterialTheme.colorScheme.errorContainer) {
                    Text(
                        message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            }
            AndroidView(
                modifier = Modifier.fillMaxSize().background(Color.White),
                factory = { viewContext ->
                    WebView(viewContext).apply {
                        // AndroidView hands a new view WRAP_CONTENT params, which
                        // leaves WebView measuring with an unbounded height. CSS
                        // viewport units then resolve to zero: the China verifier
                        // centres its CAPTCHA inside `.mask { height: 100vh }`, so a
                        // zero-height mask put the puzzle half off the top of the
                        // screen with only the slider reachable.
                        layoutParams = android.view.ViewGroup.LayoutParams(
                            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                        )
                        webView = this
                        setBackgroundColor(android.graphics.Color.WHITE)
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.allowFileAccess = false
                        settings.allowContentAccess = false
                        // Verifiers routinely hand their result page to a new
                        // window. With multiple windows off, WebView drops that
                        // navigation silently: the user submits and nothing
                        // happens. Allow it, then gate the destination in
                        // onCreateWindow the way iOS gates createWebViewWith.
                        settings.setSupportMultipleWindows(true)
                        settings.javaScriptCanOpenWindowsAutomatically = true
                        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = true
                        settings.setSupportZoom(true)
                        settings.builtInZoomControls = true
                        settings.displayZoomControls = false
                        if (android.os.Build.VERSION.SDK_INT >= 26) settings.safeBrowsingEnabled = true
                        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView, newProgress: Int) {
                                progress = newProgress
                                loading = newProgress < 100
                            }

                            override fun onCreateWindow(
                                view: WebView,
                                isDialog: Boolean,
                                isUserGesture: Boolean,
                                resultMsg: Message,
                            ): Boolean {
                                val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
                                // The requested URL is only knowable once the popup
                                // is asked to navigate, so hand WebView a throwaway
                                // view purely to capture it. It is never attached to
                                // the hierarchy and never renders.
                                val probe = WebView(view.context)
                                probe.webViewClient = object : WebViewClient() {
                                    override fun shouldOverrideUrlLoading(
                                        popup: WebView,
                                        request: WebResourceRequest,
                                    ): Boolean {
                                        openRequestedWindow(request.url.toString(), view)
                                        popup.destroy()
                                        return true
                                    }

                                    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
                                    override fun shouldOverrideUrlLoading(popup: WebView, url: String): Boolean {
                                        openRequestedWindow(url, view)
                                        popup.destroy()
                                        return true
                                    }
                                }
                                transport.webView = probe
                                resultMsg.sendToTarget()
                                return true
                            }

                            private fun openRequestedWindow(url: String, host: WebView) {
                                val destination = runCatching { URI(url) }.getOrNull() ?: return
                                when {
                                    !isWebScheme(destination.scheme) ->
                                        viewContext.openExternally(destination.toString())
                                    // Keep the authority's own result page inside the
                                    // branded, autofilled view instead of spawning a
                                    // window the user cannot see.
                                    policy.permits(destination) -> host.loadUrl(destination.toString())
                                    else -> external = destination
                                }
                            }
                        }
                        webViewClient = object : WebViewClient() {
                            @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
                            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean =
                                decideNavigation(url)

                            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                                // Subframes are deliberately not gated, matching iOS:
                                // real verifiers embed third-party CAPTCHA widgets and
                                // lazy-load their form in an iframe.
                                if (!request.isForMainFrame) return false
                                return decideNavigation(request.url.toString())
                            }

                            private fun decideNavigation(url: String): Boolean {
                                val destination = runCatching { URI(url) }.getOrNull() ?: return true
                                // tel:, mailto: and vendor intent: links belong to
                                // another app. Handing one off is not "leaving the
                                // official verifier", so do not prompt as if it were.
                                if (!isWebScheme(destination.scheme)) {
                                    viewContext.openExternally(destination.toString())
                                    return true
                                }
                                if (policy.permits(destination)) return false
                                external = destination
                                return true
                            }

                            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                                runCatching { URI(url) }.getOrNull()?.let { current = it }
                                loadError = null
                                loading = true
                            }

                            override fun onReceivedError(
                                view: WebView,
                                request: WebResourceRequest,
                                error: WebResourceError,
                            ) {
                                // A failing subresource is the page's business; a
                                // main-frame failure used to render as a blank white
                                // screen with nothing to explain it.
                                if (!request.isForMainFrame) return
                                loadError = error.description?.toString()?.ifBlank { null }
                                    ?: "The official page could not be loaded."
                                loading = false
                            }

                            override fun onPageFinished(view: WebView, url: String) {
                                val uri = runCatching { URI(url) }.getOrNull()
                                if (uri != null) current = uri
                                loading = false
                                if (uri != null && policy.permits(uri) && fields.isNotEmpty()) view.evaluateJavascript(script, null)
                            }

                            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                                // Hash-router verifiers — China's is one — swap the
                                // form in after the CAPTCHA without ever finishing a
                                // new page load, so onPageFinished alone never fills
                                // it. Safe to repeat: the script skips any control
                                // that already holds a value.
                                val uri = runCatching { URI(url) }.getOrNull() ?: return
                                current = uri
                                if (policy.permits(uri) && fields.isNotEmpty()) view.evaluateJavascript(script, null)
                            }
                        }

                        // Some CAPTCHA libraries measure the viewport once during startup.
                        // Wait until Compose has given WebView its final size before navigating.
                        addOnLayoutChangeListener(object : android.view.View.OnLayoutChangeListener {
                            override fun onLayoutChange(
                                view: android.view.View,
                                left: Int,
                                top: Int,
                                right: Int,
                                bottom: Int,
                                oldLeft: Int,
                                oldTop: Int,
                                oldRight: Int,
                                oldBottom: Int,
                            ) {
                                if (right <= left || bottom <= top) return
                                removeOnLayoutChangeListener(this)
                                when (route) {
                                    is VerificationRoute.Get -> loadUrl(route.uri.toString())
                                    is VerificationRoute.Post -> postUrl(route.uri.toString(), route.body)
                                    is VerificationRoute.Official -> loadUrl(route.uri.toString())
                                    else -> Unit
                                }
                            }
                        })
                    }
                },
            )
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            webView?.stopLoading()
            webView?.loadUrl("about:blank")
            webView?.destroy()
            webView = null
        }
    }

    external?.let { uri ->
        AlertDialog(
            onDismissRequest = { external = null },
            title = { Text("Leave the official verifier?") },
            text = { Text("This link goes to ${uri.host ?: "another app"}, which is outside the approved authority hosts. It will open externally without Apostifi branding or autofill.") },
            confirmButton = { TextButton(onClick = {
                external = null
                context.openExternally(uri.toString())
            }) { Text("Open externally") } },
            dismissButton = { TextButton(onClick = { external = null }) { Text("Stay here") } },
        )
    }
}

// Internal rather than private so the on-device portal audit can inject the
// very script the app ships, instead of a copy that could drift from it.
internal fun autofillScript(entry: RegisterEntry, fields: List<ExtractedField>): String {
    val configById = entry.verification?.fields.orEmpty().associateBy { it.id }
    val payload = fields.filter { it.captureSource == "document" && it.value.isNotBlank() }.map { field ->
        val config = configById[field.id]
        BrowserField(
            value = field.value.trim(),
            dateValue = if (config?.standardItem == 6) DateNormalizer.isoDate(field.value, entry.country) else null,
            aliases = field.aliases,
            selectors = field.browserSelectors,
        )
    }
    val json = Gson().toJson(payload)
    return """
        (() => {
          const fields = $json;
          const norm = value => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
          // innerText is layout-dependent and empty for anything not rendered,
          // so fall back to textContent rather than losing the label entirely.
          const label = node => (node && (node.innerText || node.textContent)) || '';
          const describe = el => {
            const labels = el.labels ? [...el.labels].map(label) : [];
            return norm([el.name, el.id, el.placeholder, el.getAttribute('aria-label'), ...labels, label(el.closest('label'))].filter(Boolean).join(' '));
          };
          // Government forms routinely name a control after the field it holds
          // but run the words together — New York's is "txtdocumentnumber",
          // Colombia's date is "tbFechaExpedicion". Comparing without spaces or
          // connecting words finds those. This is stricter than matching on
          // words, not looser: the control's own name has to spell the alias
          // out. The length floor keeps short aliases like "date" from
          // matching inside an unrelated word such as "validatecertificate".
          const compact = value => norm(value.replace(/\([^)]*\)/g, ' '))
            .replace(/\b(de|del|des|du|da|do|of|the|d|l|von|di)\b/g, ' ')
            .replace(/[^\p{L}\p{N}]+/gu, '');
          const MINIMUM_COMPACT_ALIAS = 8;
          // A reviewed Apostille value must never land in a challenge box: it
          // fails the challenge and reads as the app malfunctioning. Verifiers
          // that gate their form behind one are common enough that this has to
          // hold on every path, including an authored selector.
          const isChallenge = el => /captcha|recaptcha|turnstile|yzm|yanzheng/i.test(
            [el.id, el.name, el.className, el.getAttribute('aria-label'), el.placeholder].filter(Boolean).join(' ')
          );
          const skippedTypes = ['hidden', 'submit', 'button', 'image', 'reset', 'file', 'password'];
          // Never fight a control the page has locked, and never overwrite a
          // value already present — this runs again on every client-side route
          // change, so overwriting would discard what the user just typed.
          // A value the page shipped in its own markup is not something the
          // user typed, and Andorra prefills its date box with today's date —
          // which the user would then submit instead of the certificate's.
          // defaultValue reflects the value attribute, so it separates the two
          // exactly: anything typed, or already filled by this script, differs
          // from it and is still left alone.
          const untouched = el => !el.value || el.value === el.defaultValue;
          const fillable = el => !!el && !el.disabled && !el.readOnly && untouched(el) &&
            !skippedTypes.includes((el.type || '').toLowerCase()) && !isChallenge(el);
          const controls = [...document.querySelectorAll('input, select, textarea')].filter(fillable);
          const used = new Set();
          const assign = (el, field) => {
            if (!el || used.has(el) || !fillable(el)) return false;
            const value = ((el.type || '').toLowerCase() === 'date' && field.dateValue) ? field.dateValue : field.value;
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
            if (setter) setter.call(el, value); else el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            used.add(el); return true;
          };
          for (const field of fields) {
            let matched = false;
            for (const selector of field.selectors || []) {
              try { if (assign(document.querySelector(selector), field)) { matched = true; break; } } catch (_) {}
            }
            if (matched) continue;
            const aliases = (field.aliases || []).map(norm).filter(Boolean);
            const compacted = (field.aliases || []).map(compact).filter(alias => alias.length >= MINIMUM_COMPACT_ALIAS);
            // Delimited, not merely contained: "date" sits inside "validate",
            // and "validate" is on half the verification forms in the corpus.
            // A bare substring test put the certificate's date into whatever
            // box a page happened to name that way.
            const mentions = (signal, alias) => (' ' + signal + ' ').includes(' ' + alias + ' ');
            const matches = el => {
              const signal = describe(el);
              if (aliases.some(alias => mentions(signal, alias))) return true;
              const runTogether = compact(signal);
              return compacted.some(alias => runTogether.includes(alias));
            };
            assign(controls.find(el => !used.has(el) && matches(el)), field);
          }
        })();
    """.trimIndent()
}
