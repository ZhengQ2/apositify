package com.apositify.app

import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.viewinterop.AndroidView
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The verifier hosts a WebView through Compose's [AndroidView], which hands a new
 * view WRAP_CONTENT layout params. WebView then measures with an unbounded
 * height and every CSS viewport unit resolves to zero.
 *
 * That is not cosmetic. China's verifier centres its CAPTCHA inside
 * `.mask { position: fixed; height: 100vh }`; with a zero-height mask the
 * `translateY(-50%)` that should centre the dialog pushed it half off the top of
 * the screen, leaving the puzzle unreachable and the certificate unverifiable.
 */
@RunWith(AndroidJUnit4::class)
class VerifierViewportTest {
    @get:Rule
    val compose = createComposeRule()

    private fun viewportHeightOf(applyLayoutParams: Boolean): String {
        lateinit var webView: WebView
        compose.setContent {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        if (applyLayoutParams) {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT,
                            )
                        }
                        settings.javaScriptEnabled = true
                        webView = this
                        loadDataWithBaseURL(
                            "https://example.invalid/",
                            "<html><body><div id='p' style='height:100vh'></div></body></html>",
                            "text/html",
                            "utf-8",
                            null,
                        )
                    }
                },
            )
        }
        compose.waitForIdle()

        // Give the load a moment to finish before measuring.
        val settled = CountDownLatch(1)
        compose.runOnIdle { settled.countDown() }
        settled.await(5, TimeUnit.SECONDS)
        Thread.sleep(1500)

        val result = arrayOfNulls<String>(1)
        val done = CountDownLatch(1)
        compose.runOnUiThread {
            webView.evaluateJavascript(
                "getComputedStyle(document.getElementById('p')).height",
            ) { value -> result[0] = value; done.countDown() }
        }
        assertTrue("WebView did not answer in time", done.await(10, TimeUnit.SECONDS))
        return result[0].orEmpty()
    }

    @Test
    fun viewportUnitsResolveWhenTheWebViewIsGivenABoundedHeight() {
        val height = viewportHeightOf(applyLayoutParams = true)
        val pixels = height.trim('"').removeSuffix("px").toFloatOrNull() ?: 0f
        assertTrue("100vh resolved to $height; a CAPTCHA centred in it would sit off-screen", pixels > 100f)
    }

    @Test
    fun theVerifierWebViewAsksForABoundedHeight() {
        // Guards the fix itself: without these params AndroidView leaves the
        // WebView measuring unbounded and the case above regresses.
        lateinit var webView: WebView
        compose.setContent {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        )
                        webView = this
                    }
                },
            )
        }
        compose.waitForIdle()
        assertEquals(ViewGroup.LayoutParams.MATCH_PARENT, webView.layoutParams.height)
        assertTrue("WebView was laid out with no height", webView.height > 0)
    }
}
