package com.pandejesal.resonance

import android.content.Context
import android.os.Build
import android.util.Log
import java.io.File
import java.io.FileOutputStream

class BackendPlugin(private val context: Context) {

    companion object {
        private const val TAG = "BackendPlugin"
        private const val PORT = 8080

        init {
            try {
                // Load the Rust-compiled shared library
                // POCO C31 uses ARM64-v8a (primary) or armeabi-v7a (fallback)
                System.loadLibrary("resonance_backend")
                Log.i(TAG, "Native library loaded successfully")
            } catch (e: UnsatisfiedLinkError) {
                Log.e(TAG, "CRITICAL: Failed to load native library: ${e.message}")
                Log.e(TAG, "ABI: ${Build.SUPPORTED_ABIS.joinToString()}")
                Log.e(TAG, "Device: ${Build.MANUFACTURER} ${Build.MODEL}")
                Log.e(TAG, "Android: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            }
        }
    }

    /**
     * Native function defined in Rust (libresonance_backend.so).
     * Starts the HTTP server on the given host:port.
     * Returns true if the server started successfully.
     */
    private external fun startNative(
        dbPath: String,
        staticDir: String,
        host: String,
        port: Int
    ): Boolean

    private var serverThread: Thread? = null
    @Volatile
    private var isRunning = false

    fun startBackend(onReady: () -> Unit, onError: (String) -> Unit) {
        if (isRunning) {
            Log.w(TAG, "Backend already running, skipping start")
            return
        }

        serverThread = Thread {
            try {
                isRunning = true

                val filesDir = context.filesDir
                val dbPath = File(filesDir, "resonance.db").absolutePath
                val staticDir = File(filesDir, "static").absolutePath

                // Copy frontend assets from APK to internal storage on first launch
                copyAssetsIfNeeded(staticDir)

                Log.i(TAG, "Starting native server...")
                Log.i(TAG, "  DB path: $dbPath")
                Log.i(TAG, "  Static dir: $staticDir")
                Log.i(TAG, "  Host: 127.0.0.1, Port: $PORT")
                Log.i(TAG, "  Device: ${Build.MANUFACTURER} ${Build.MODEL}")
                Log.i(TAG, "  ABI: ${Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"}")

                val success = startNative(dbPath, staticDir, "127.0.0.1", PORT)

                if (success) {
                    Log.i(TAG, "Server started successfully on port $PORT")

                    // Give the server a moment to bind the port
                    // POCO C31 (Helio G35) may need slightly longer
                    Thread.sleep(2500)
                    onReady()
                } else {
                    Log.e(TAG, "Server returned false (failed to bind or start)")
                    onError("Server failed to start. The port may be in use.")
                }
            } catch (e: UnsatisfiedLinkError) {
                Log.e(TAG, "JNI error: ${e.message}", e)
                onError("Native library error: ${e.message}")
            } catch (e: OutOfMemoryError) {
                Log.e(TAG, "Out of memory loading backend", e)
                onError("Device out of memory. Try closing other apps.")
            } catch (e: Throwable) {
                Log.e(TAG, "Unexpected error: ${e.message}", e)
                onError(e.message ?: "Unknown error")
            } finally {
                isRunning = false
            }
        }.apply {
            name = "resonance-backend"
            priority = Thread.MAX_PRIORITY // Give backend high priority on Helio G35
            start()
        }
    }

    fun stopBackend() {
        Log.i(TAG, "Stopping backend...")
        isRunning = false
        serverThread?.let {
            it.interrupt()
            try {
                it.join(3000) // Wait up to 3 seconds for clean shutdown
            } catch (_: InterruptedException) {}
        }
        serverThread = null
        Log.i(TAG, "Backend stopped")
    }

    /**
     * Copies frontend static files from APK assets to internal storage.
     * Only copies if the directory is empty (first launch).
     */
    private fun copyAssetsIfNeeded(staticDir: String) {
        val dir = File(staticDir)
        if (dir.exists() && dir.listFiles()?.isNotEmpty() == true) {
            Log.i(TAG, "Static dir already populated, skipping copy")
            return
        }

        dir.mkdirs()

        try {
            val assetManager = context.assets
            val files = assetManager.list("static") ?: run {
                Log.w(TAG, "No 'static' directory found in assets")
                return
            }

            var count = 0
            for (filename in files) {
                copyAssetRecursive("static/$filename", File(dir, filename))
                count++
            }
            Log.i(TAG, "Copied $count asset entries to $staticDir")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to copy assets: ${e.message}", e)
        }
    }

    private fun copyAssetRecursive(assetPath: String, destFile: File) {
        val assetManager = context.assets
        val subFiles = assetManager.list(assetPath)

        if (subFiles != null && subFiles.isNotEmpty()) {
            // It's a directory — recurse
            destFile.mkdirs()
            for (subFile in subFiles) {
                copyAssetRecursive("$assetPath/$subFile", File(destFile, subFile))
            }
        } else {
            // It's a file — copy it
            assetManager.open(assetPath).use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            }
        }
    }
}
