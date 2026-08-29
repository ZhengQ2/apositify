package com.apositify.app

import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.apositify.app.core.ApostilleParser
import com.apositify.app.core.AuthorityMatcher
import com.apositify.app.core.FieldValidator
import com.apositify.app.core.VerificationRoute
import com.apositify.app.core.VerificationRouter
import com.apositify.app.data.RegisterStore
import com.apositify.app.model.ExtractedField
import com.apositify.app.model.QrMatch
import com.apositify.app.model.RecognitionResult
import com.apositify.app.model.RegisterEntry
import com.apositify.app.model.ScanOutcome
import com.apositify.app.vision.ApostilleRecognizer
import java.io.File
import kotlinx.coroutines.launch

// Shared with the iOS app (BrandBlue.colorset, HomeView.swift) and the web
// stylesheet, so the three clients read as one product.
private val BrandBlue = Color(0xFF1554EF)
private val HeroNavy = Color(0xFF0D264D)
private val PageBackground = Color(0xFFF2F2F7)
private val CardSurface = Color.White
private val CardShape = RoundedCornerShape(22.dp)
private val HeroShape = RoundedCornerShape(28.dp)

private sealed interface AppScreen {
    data object Home : AppScreen
    data object Processing : AppScreen
    data class TextReview(val result: RecognitionResult, val rejectedQr: List<String>, val preview: Bitmap) : AppScreen
    data class QrReview(val match: QrMatch, val preview: Bitmap) : AppScreen
    data class Verifier(val entry: RegisterEntry, val route: VerificationRoute, val fields: List<ExtractedField>) : AppScreen
    data class Failure(val message: String) : AppScreen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Debug builds only: exposes the verifier WebView to Chrome DevTools so a
        // misbehaving government page can be inspected on a real device instead
        // of guessed at. Never enabled in a release build.
        if (BuildConfig.DEBUG) android.webkit.WebView.setWebContentsDebuggingEnabled(true)
        setContent { ApositifyApp() }
    }
}

@Composable
private fun ApositifyApp() {
    val context = LocalContext.current
    val store = remember { RegisterStore(context.applicationContext) }
    val recognizer = remember { ApostilleRecognizer(context.applicationContext, store.entries) }
    val scope = rememberCoroutineScope()
    var screen: AppScreen by remember { mutableStateOf(AppScreen.Home) }
    var cameraUri by remember { mutableStateOf<Uri?>(null) }

    fun process(uri: Uri) {
        screen = AppScreen.Processing
        scope.launch {
            screen = runCatching { recognizer.recognize(uri) }.fold(
                onSuccess = { session -> when (val outcome = session.outcome) {
                    is ScanOutcome.Qr -> AppScreen.QrReview(outcome.match, session.preview)
                    is ScanOutcome.Text -> AppScreen.TextReview(outcome.recognition, outcome.detectedQrPayloads, session.preview)
                } },
                onFailure = { AppScreen.Failure(it.message ?: "The document could not be scanned.") },
            )
        }
    }

    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let(::process) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        if (saved) cameraUri?.let(::process) else screen = AppScreen.Home
    }

    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = BrandBlue,
            background = PageBackground,
            surface = CardSurface,
            secondaryContainer = BrandBlue.copy(alpha = 0.12f),
            onSecondaryContainer = BrandBlue,
        )
    ) {
        when (val current = screen) {
            AppScreen.Home -> HomeScreen(
                onCamera = {
                    val directory = File(context.cacheDir, "captured-documents").apply { mkdirs() }
                    val file = File.createTempFile("apostille-", ".jpg", directory)
                    val captureUri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                    cameraUri = captureUri
                    camera.launch(captureUri)
                },
                onGallery = { gallery.launch("image/*") },
            )
            AppScreen.Processing -> ProcessingScreen()
            is AppScreen.Failure -> FailureScreen(current.message) { screen = AppScreen.Home }
            is AppScreen.QrReview -> QrReviewScreen(current.match, current.preview, { screen = AppScreen.Home }) { route ->
                when (route) {
                    is VerificationRoute.ExternalInsecure -> context.openExternally(route.uri.toString())
                    else -> screen = AppScreen.Verifier(current.match.entry, route, emptyList())
                }
            }
            is AppScreen.TextReview -> ReviewScreen(current, store.entries, { screen = AppScreen.Home }) { entry, route, fields ->
                screen = AppScreen.Verifier(entry, route, fields)
            }
            is AppScreen.Verifier -> {
                BackHandler { screen = AppScreen.Home }
                SecureVerifierScreen(current.entry, current.route, current.fields) { screen = AppScreen.Home }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeScreen(onCamera: () -> Unit, onGallery: () -> Unit) {
    Scaffold(
        containerColor = PageBackground,
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Apositify", fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = PageBackground),
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            HeroCard()
            ScanCard(onCamera = onCamera, onGallery = onGallery)
            PrivacyCard()
        }
    }
}

@Composable private fun HeroCard() {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(HeroShape)
            .background(Brush.linearGradient(listOf(HeroNavy, BrandBlue)))
            .padding(26.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.VerifiedUser, null, tint = Color.White.copy(alpha = 0.9f), modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "Official sources only",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = Color.White.copy(alpha = 0.9f),
            )
        }
        Text(
            "Scan an Apostille.\nFind its official verifier.",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "Your certificate is read on this device and never uploaded. The verification itself happens on the issuing authority\u2019s official website.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.82f),
        )
    }
}

@Composable private fun ScanCard(onCamera: () -> Unit, onGallery: () -> Unit) {
    HomeCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.DocumentScanner, null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
            Text("Start with a clear, flat document", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        Text(
            "Include the title \u201CApostille\u201D and numbered items 1\u201310. Avoid glare over seals and security codes.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.DarkGray,
        )
        Button(onClick = onCamera, shape = CircleShape, modifier = Modifier.fillMaxWidth().height(50.dp)) {
            Icon(Icons.Default.CameraAlt, null); Spacer(Modifier.width(8.dp)); Text("Scan with camera", fontWeight = FontWeight.SemiBold)
        }
        FilledTonalButton(onClick = onGallery, shape = CircleShape, modifier = Modifier.fillMaxWidth().height(50.dp)) {
            Icon(Icons.Default.PhotoLibrary, null); Spacer(Modifier.width(8.dp)); Text("Choose existing photos", fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable private fun PrivacyCard() {
    HomeCard {
        Row(verticalAlignment = Alignment.Top) {
            Icon(Icons.Default.Lock, null, tint = BrandBlue, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(14.dp))
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("Private by design", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    "Recognition happens on this device. Scans are not uploaded or retained by Apositify.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.DarkGray,
                )
            }
        }
    }
}

@Composable private fun HomeCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        shape = CardShape,
        colors = CardDefaults.cardColors(containerColor = CardSurface),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
    }
}

@Composable private fun ProcessingScreen() = Box(Modifier.fillMaxSize().background(PageBackground), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        CircularProgressIndicator(); Spacer(Modifier.height(16.dp)); Text("Reading your document…")
    }
}

@Composable private fun FailureScreen(message: String, startOver: () -> Unit) = Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Scan failed", style = MaterialTheme.typography.headlineSmall); Text(message, modifier = Modifier.padding(vertical = 12.dp))
        Button(onClick = startOver) { Text("Try another photo") }
    }
}

@Composable
private fun QrReviewScreen(match: QrMatch, preview: Bitmap, startOver: () -> Unit, open: (VerificationRoute) -> Unit) {
    var insecure by remember { mutableStateOf<VerificationRoute.ExternalInsecure?>(null) }
    val route = VerificationRouter.routeTo(match.destination.toString())
    Scaffold(topBar = { SimpleTopBar("Official verifier", startOver) }, containerColor = PageBackground) { padding ->
        Column(Modifier.padding(padding).padding(20.dp).verticalScroll(rememberScrollState())) {
            ScanPreview(preview)
            Card(Modifier.fillMaxWidth().padding(vertical = 14.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(18.dp)) {
                    Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF14845A), modifier = Modifier.size(42.dp))
                    Text("Official verifier found", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("${match.entry.country} — ${match.entry.authority}", modifier = Modifier.padding(vertical = 8.dp))
                    Text("This opens the issuing authority’s own verification page. Only the authority can confirm the Apostille.", color = Color.DarkGray)
                    Button(onClick = { if (route is VerificationRoute.ExternalInsecure) insecure = route else open(route) }, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                        Text("Open official verification")
                    }
                }
            }
        }
    }
    insecure?.let { warning -> InsecureWarning({ insecure = null }, { insecure = null; open(warning) }) }
}

@Composable
private fun ReviewScreen(
    scan: AppScreen.TextReview,
    entries: List<RegisterEntry>,
    startOver: () -> Unit,
    open: (RegisterEntry, VerificationRoute, List<ExtractedField>) -> Unit,
) {
    val context = LocalContext.current
    val matches = remember(scan.result) { AuthorityMatcher(entries).matches(scan.result) }
    val countries = remember(entries) { entries.map { it.country }.distinct().sorted() }
    var selectedId by remember { mutableStateOf(matches.firstOrNull()?.entry?.id ?: entries.first().id) }
    val selected = entries.first { it.id == selectedId }
    var country by remember(selectedId) { mutableStateOf(selected.country) }
    var countryMenu by remember { mutableStateOf(false) }
    var authorityMenu by remember { mutableStateOf(false) }
    var extracted by remember(selectedId) { mutableStateOf(ApostilleParser.extractFields(selected, scan.result)) }
    var values by remember(selectedId) { mutableStateOf(extracted.associate { it.id to it.value }) }
    var insecure by remember { mutableStateOf<VerificationRoute.ExternalInsecure?>(null) }
    var showText by remember { mutableStateOf(false) }
    val authorities = entries.filter { it.country == country }.sortedBy { it.authority }
    val configFields = selected.verification?.fields.orEmpty()
    val hasErrors = configFields.filter { it.captureSource == "document" }.any { FieldValidator.error(it, values[it.id].orEmpty()) != null }
    val route = VerificationRouter.route(selected, values)

    LaunchedEffect(selectedId) {
        extracted = ApostilleParser.extractFields(selected, scan.result)
        values = extracted.associate { it.id to it.value }
    }

    Scaffold(topBar = { SimpleTopBar("Review scan", startOver) }, containerColor = PageBackground) { padding ->
        Column(Modifier.padding(padding).padding(18.dp).verticalScroll(rememberScrollState())) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(scan.preview.asImageBitmap(), "Scanned Apostille", Modifier.size(82.dp), contentScale = ContentScale.Crop)
                Spacer(Modifier.width(14.dp))
                Column {
                    Text("Details read from your document", fontWeight = FontWeight.Bold, color = BrandBlue)
                    Text("Review every value against the original.", style = MaterialTheme.typography.bodySmall)
                    if (scan.rejectedQr.isNotEmpty()) Text("We could not confirm where this QR code leads, so it was not opened.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF9B5D00))
                }
            }

            SectionCard("Issuing authority") {
                matches.firstOrNull()?.let {
                    Text(if (it.score >= 0.8) "Suggested from document text · ${(it.score * 100).toInt()}%" else "Best available text match · ${(it.score * 100).toInt()}%",
                        style = MaterialTheme.typography.bodySmall, color = BrandBlue)
                } ?: Text("No confident match—choose the authority manually.", color = Color(0xFF9B5D00))
                Box {
                    OutlinedButton(onClick = { countryMenu = true }, modifier = Modifier.fillMaxWidth()) { Text(country, modifier = Modifier.weight(1f)); Text("▾") }
                    DropdownMenu(expanded = countryMenu, onDismissRequest = { countryMenu = false }) {
                        countries.forEach { option -> DropdownMenuItem(text = { Text(option) }, onClick = {
                            country = option
                            selectedId = entries.first { it.country == option }.id
                            countryMenu = false
                        }) }
                    }
                }
                Box {
                    OutlinedButton(onClick = { authorityMenu = true }, modifier = Modifier.fillMaxWidth()) { Text(selected.authority, modifier = Modifier.weight(1f)); Text("▾") }
                    DropdownMenu(expanded = authorityMenu, onDismissRequest = { authorityMenu = false }) {
                        authorities.forEach { option -> DropdownMenuItem(text = { Text(option.authority) }, onClick = {
                            selectedId = option.id; authorityMenu = false
                        }) }
                    }
                }
            }

            SectionCard("Verification details") {
                when {
                    selected.verification?.kind == "upload" -> Text("This authority verifies the original digital Apostille file rather than values from a paper scan.")
                    extracted.isEmpty() -> Text("This authority does not publish a confirmed field list. Continue to its official instructions.")
                    else -> extracted.forEach { field ->
                        val configuration = configFields.firstOrNull { it.id == field.id }
                        Column(Modifier.padding(vertical = 7.dp)) {
                            Text(field.label, fontWeight = FontWeight.SemiBold)
                            if (field.captureSource == "portal") {
                                Text("Complete this on the official website", style = MaterialTheme.typography.bodySmall, color = Color.DarkGray)
                            } else {
                                OutlinedTextField(
                                    value = values[field.id].orEmpty(),
                                    onValueChange = { newValue -> values = values + (field.id to newValue) },
                                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                                    placeholder = { Text("Enter exactly as printed") },
                                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                                    isError = configuration?.let { FieldValidator.error(it, values[field.id].orEmpty()) != null && values[field.id].orEmpty().isNotBlank() } == true,
                                )
                                if (field.suggestedValues.isNotEmpty()) {
                                    Text("OCR found several plausible values. Select the one shown on the Apostille.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF9B5D00))
                                    field.suggestedValues.forEach { suggestion ->
                                        OutlinedButton(onClick = { values = values + (field.id to suggestion) }, modifier = Modifier.padding(end = 6.dp)) { Text(suggestion) }
                                    }
                                }
                                configuration?.let { FieldValidator.error(it, values[field.id].orEmpty()) }?.takeIf { values[field.id].orEmpty().isNotBlank() }?.let {
                                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }
                selected.verification?.note?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Color.DarkGray) }
            }

            SectionCard("Official verification") {
                Text("The issuing authority’s website makes the authenticity decision. Apositify only helps route and fill reviewed values.")
                if (route == VerificationRoute.Unavailable) {
                    Text("No official online verifier is recorded for this authority.", color = Color(0xFF9B5D00))
                } else {
                    Button(
                        enabled = !hasErrors,
                        onClick = {
                            val latestFields = extracted.map { it.copy(value = values[it.id].orEmpty()) }
                            if (route is VerificationRoute.ExternalInsecure) insecure = route else open(selected, route, latestFields)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(if (route is VerificationRoute.Get || route is VerificationRoute.Post) "Verify with reviewed values" else "Open official verifier") }
                }
            }

            TextButton(onClick = { showText = !showText }) { Text(if (showText) "Hide recognized text" else "Show recognized text") }
            if (showText) Text(scan.result.fullText, style = MaterialTheme.typography.bodySmall, modifier = Modifier.fillMaxWidth().background(Color.White).padding(12.dp))
        }
    }
    insecure?.let { warning -> InsecureWarning({ insecure = null }, {
        insecure = null
        context.openExternally(warning.uri.toString())
    }) }
}

@Composable private fun SectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        Modifier.fillMaxWidth().padding(top = 14.dp),
        shape = CardShape,
        colors = CardDefaults.cardColors(containerColor = CardSurface),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun SimpleTopBar(title: String, startOver: () -> Unit) = TopAppBar(
    title = { Text(title) }, actions = { TextButton(onClick = startOver) { Icon(Icons.Default.Refresh, null); Text("Start over") } },
)

@Composable private fun ScanPreview(bitmap: Bitmap) {
    Image(bitmap.asImageBitmap(), "Scanned Apostille", Modifier.fillMaxWidth().height(190.dp), contentScale = ContentScale.Fit)
}

@Composable private fun InsecureWarning(cancel: () -> Unit, proceed: () -> Unit) = AlertDialog(
    onDismissRequest = cancel,
    title = { Text("This verifier is not secure") },
    text = { Text("This authority only provides an unencrypted HTTP page. Apositify will open it outside the branded verifier and will not send or autofill certificate values.") },
    confirmButton = { TextButton(onClick = proceed) { Text("Open externally") } },
    dismissButton = { TextButton(onClick = cancel) { Text("Cancel") } },
)
