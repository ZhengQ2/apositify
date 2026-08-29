plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Real-device photo fixtures intentionally live under the repository's
// ignored specimens/ directory. Local test builds package them when present;
// remote checkouts still compile and the fixture-dependent tests skip.
val prepareLocalRecognitionTestAssets by tasks.registering(Sync::class) {
    from(rootProject.file("../specimens/device-test-local"))
    // Every loose specimen too, so the on-device sweep reads the same corpus
    // the host-side suite does. Subdirectories are excluded: the official
    // cache is already covered by the host suite and would double the APK.
    from(rootProject.file("../specimens")) {
        include("*.png", "*.jpg", "*.jpeg", "*.JPG", "*.heic", "*.webp")
    }
    // Specimens whose real reference is redacted, with a known value written
    // onto item 8 by `npm run prepare:redaction-fixtures`.
    from(rootProject.file("../specimens/redaction-filled"))
    into(layout.buildDirectory.dir("generated/localRecognitionTestAssets"))
}
val localRecognitionTestAssetsDirectory = layout.buildDirectory.dir("generated/localRecognitionTestAssets").get().asFile

android {
    namespace = "com.apositify.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.apositify.app"
        minSdk = 23
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    packaging.resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}")

    sourceSets.getByName("androidTest").assets.directories.add(localRecognitionTestAssetsDirectory.absolutePath)
}

tasks.matching { it.name == "mergeDebugAndroidTestAssets" }.configureEach {
    dependsOn(prepareLocalRecognitionTestAssets)
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.08.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.12.4")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.exifinterface:exifinterface:1.4.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.google.code.gson:gson:2.13.2")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("com.google.mlkit:text-recognition-chinese:16.0.1")
    implementation("com.google.mlkit:text-recognition-japanese:16.0.1")
    implementation("com.google.mlkit:text-recognition-korean:16.0.1")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
