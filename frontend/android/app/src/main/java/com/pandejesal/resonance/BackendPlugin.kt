package com.pandejesal.resonance

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream

class BackendPlugin(private val context: Context) {

    companion object {
        private const val TAG = "BackendPlugin"
        private const val PORT = 8080

        init {
            try {
                System.loadLibrary("resonance_backend")
                Log.i(TAG, "Native library loaded")
            } catch (e: UnsatisfiedLinkError) {
                Log.e(TAG, "Failed to load native library: ${e.message}")
            }
        }
    }

    private external fun startNative(
        dbPath: String,
        staticDir: String,
        host: String,
        port: Int
    ): Boolean

    private var serverThread: Thread? = null
    private var isStarting = false

    fun startBackend(onReady: () -> Unit, onError: (String) -> Unit) {
        if (isStarting) return
        isStarting = true

        serverThread = Thread {
            try {
                val filesDir = context.filesDir
                val dbPath = File(filesDir, "resonance.db").absolutePath
                val staticDir = File(filesDir, "static").absolutePath

                copyAssetsIfNeeded(staticDir)

                Log.i(TAG, "Starting native server...")
                Log.i(TAG, "DB: $dbPath")
                Log.i(TAG, "Static: $staticDir")

                val success = startNative(dbPath, staticDir, "127.0.0.1", PORT)

                if (success) {
                    Log.i(TAG, "Server started on port $PORT")
                    Thread.sleep(2000)
                    onReady()
                } else {
                    Log.e(TAG, "Server failed to start")
                    onError("Server failed to start")
                }
            } catch (e: Throwable) {
                Log.e(TAG, "Error: ${e.message}", e)
                onError(e.message ?: "Unknown error")
            } finally {
                isStarting = false
            }
        }
        serverThread?.start()
    }

    fun stopBackend() {
        serverThread?.interrupt()
        serverThread = null
    }

    private fun copyAssetsIfNeeded(staticDir: String) {
        val staticDirFile = File(staticDir)
        if (staticDirFile.exists() && staticDirFile.listFiles()?.isNotEmpty() == true) {
            return
        }

        staticDirFile.mkdirs()

        try {
            val assetManager = context.assets
            val files = assetManager.list("static") ?: return

            for (filename in files) {
                copyAssetFile("static/$filename", File(staticDirFile, filename))
            }
            Log.i(TAG, "Copied ${files.size} files from assets")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to copy assets: ${e.message}")
        }
    }

    private fun copyAssetFile(assetPath: String, destFile: File) {
        val assetManager = context.assets
        val subFiles = assetManager.list(assetPath)

        if (subFiles != null && subFiles.isNotEmpty()) {
            destFile.mkdirs()
            for (subFile in subFiles) {
                copyAssetFile("$assetPath/$subFile", File(destFile, subFile))
            }
        } else {
            assetManager.open(assetPath).use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            }
        }
    }
}
