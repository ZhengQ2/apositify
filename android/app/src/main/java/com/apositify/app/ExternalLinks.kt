package com.apositify.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Hands a destination to whatever app the device has for it.
 *
 * Every call site here is reachable from a government page we do not control,
 * which can link to `tel:`, `mailto:` or a vendor `intent:` scheme that no
 * installed app handles. An unguarded [Context.startActivity] throws
 * [ActivityNotFoundException] in that case and takes the whole app down while
 * the user is mid-verification.
 *
 * Returns false when nothing could open it, so the caller can stay put.
 */
internal fun Context.openExternally(destination: String): Boolean {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(destination))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
        startActivity(intent)
        true
    } catch (_: ActivityNotFoundException) {
        false
    } catch (_: SecurityException) {
        false
    }
}

/**
 * Schemes the in-app verifier renders itself. Anything else belongs to another
 * app and is handed off, matching what the iOS verifier does with a non-web
 * scheme rather than showing a "leave this site" prompt for `tel:`.
 */
internal fun isWebScheme(scheme: String?): Boolean =
    when (scheme?.lowercase()) {
        "https", "http", "about" -> true
        else -> false
    }
