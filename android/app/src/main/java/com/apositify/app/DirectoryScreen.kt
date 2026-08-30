package com.apositify.app

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.apositify.app.model.RegisterEntry

/**
 * The scan-first path fails on a certificate the camera cannot read, and on the
 * authorities whose verifier takes a value no Apostille prints. The directory is
 * the way through: pick the authority and go straight to its official page —
 * the same fallback the website offers.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DirectoryScreen(
    entries: List<RegisterEntry>,
    onClose: () -> Unit,
    onSelect: (RegisterEntry) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val matches = remember(query) { search(entries, query) }

    Scaffold(
        containerColor = PageBackground,
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Find your authority", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onClose) { Icon(Icons.Default.ArrowBack, "Back") }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = PageBackground),
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                singleLine = true,
                shape = CircleShape,
                leadingIcon = { Icon(Icons.Default.Search, null) },
                placeholder = { Text("Country or authority") },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
            )
            if (matches.isEmpty()) {
                Text(
                    "No authority matches “$query”. The Convention has 126 parties; this directory covers the ones with a published verification route.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.DarkGray,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                )
            }
            LazyColumn(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp)) {
                items(matches, key = { it.id }) { entry ->
                    Column(
                        Modifier.fillMaxWidth().clickable { onSelect(entry) }.padding(vertical = 14.dp)
                    ) {
                        Text(entry.country, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(
                            entry.authority,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.DarkGray,
                        )
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

/** Matches on either half of the name, so "ontario" and "canada" both find it. */
internal fun search(entries: List<RegisterEntry>, query: String): List<RegisterEntry> {
    val needle = query.trim().lowercase()
    val ordered = entries.sortedWith(compareBy({ it.country }, { it.authority }))
    if (needle.isEmpty()) return ordered
    return ordered.filter {
        it.country.lowercase().contains(needle) || it.authority.lowercase().contains(needle)
    }
}

/**
 * What an authority offers, mirroring the website's directory: an official page
 * for most, a QR scan for the six that publish nothing else, and an honest
 * explanation for the ones that can only be verified by contacting them.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthorityScreen(
    entry: RegisterEntry,
    onBack: () -> Unit,
    onScanQr: () -> Unit,
    onOpen: (String) -> Unit,
) {
    Scaffold(
        containerColor = PageBackground,
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(entry.country, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Back") }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = PageBackground),
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Card(Modifier.fillMaxWidth(), shape = CardShape, colors = CardDefaults.cardColors(containerColor = CardSurface)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(entry.authority, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    if (entry.notes.isNotBlank()) {
                        Text(entry.notes, style = MaterialTheme.typography.bodyMedium, color = Color.DarkGray)
                    }
                    entry.registerGuide?.let { guide ->
                        Text(guide.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        guide.steps.forEachIndexed { index, step ->
                            Text("${index + 1}. $step", style = MaterialTheme.typography.bodySmall, color = Color.DarkGray)
                        }
                    }
                }
            }

            when (entry.verificationMode) {
                "qr_only" -> ActionCard(
                    icon = Icons.Default.QrCodeScanner,
                    title = "Verified by QR code",
                    body = "This authority publishes no lookup page. Its Apostille carries a QR code that resolves to the official record — scan the certificate and the app will follow it.",
                    action = "Scan the QR code",
                    onAction = onScanQr,
                )
                "manual_contact" -> ActionCard(
                    icon = Icons.Default.MailOutline,
                    title = "Contact the authority",
                    body = "This authority has no online register. Verification means writing to them directly, so there is nothing for the app to open.",
                    action = null,
                    onAction = {},
                )
                "source_link_missing", "hybrid_link_missing" -> ActionCard(
                    icon = Icons.Default.MailOutline,
                    title = "No official link recorded",
                    body = "This authority verifies online, but no official URL has been confirmed for it yet. Opening an unverified page would defeat the point.",
                    action = null,
                    onAction = {},
                )
                else -> {
                    val links = entry.registerLinks.ifEmpty {
                        entry.registerUrl?.let { listOf(com.apositify.app.model.RegisterLink("Open official verifier", it)) }.orEmpty()
                    }
                    if (links.isEmpty()) {
                        ActionCard(
                            icon = Icons.Default.MailOutline,
                            title = "No official link recorded",
                            body = "No official URL has been confirmed for this authority yet.",
                            action = null,
                            onAction = {},
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            links.forEach { link ->
                                Button(
                                    onClick = { onOpen(link.url) },
                                    shape = CircleShape,
                                    modifier = Modifier.fillMaxWidth().height(50.dp),
                                ) {
                                    Icon(Icons.Default.OpenInNew, null)
                                    Spacer(Modifier.width(8.dp))
                                    Text(link.label.ifBlank { "Open official verifier" }, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            Text(
                                "The authority's own page decides whether the Apostille is genuine. Nothing about your document is sent from here.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.DarkGray,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    body: String,
    action: String?,
    onAction: () -> Unit,
) {
    Card(Modifier.fillMaxWidth(), shape = CardShape, colors = CardDefaults.cardColors(containerColor = CardSurface)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, tint = BrandBlue, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(10.dp))
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            }
            Text(body, style = MaterialTheme.typography.bodyMedium, color = Color.DarkGray)
            if (action != null) {
                Button(onClick = onAction, shape = CircleShape, modifier = Modifier.fillMaxWidth().height(50.dp)) {
                    Text(action, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
