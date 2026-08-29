package com.apositify.app.data

import android.content.Context
import com.apositify.app.model.RegisterCatalog
import com.apositify.app.model.RegisterEntry
import com.google.gson.Gson

class RegisterStore(context: Context) {
    val catalog: RegisterCatalog = context.assets.open("e-registers.json").bufferedReader().use {
        Gson().fromJson(it, RegisterCatalog::class.java)
    }.also {
        require(it.schemaVersion == 1) { "Unsupported register catalog schema ${it.schemaVersion}" }
        require(it.entries.size == 97) { "Expected 97 authority entries, found ${it.entries.size}" }
    }

    val entries: List<RegisterEntry> get() = catalog.entries
}
