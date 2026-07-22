package com.pandejesal.resonance

import android.content.Context
import android.util.Log
import java.io.*
import java.net.Socket
import java.nio.file.Files
import java.nio.file.StandardCopyOption

class BackendPlugin(private val context: Context) {

    companion object {
        private const val TAG = "BackendPlugin"
        private const val BACKEND_BINARY = "resonance-backend"
        private const val STATIC_DIR = "static"
        private const val HOST = "127.0.0.1"
        private const val PORT = "8080"
        private const val STARTUP_TIMEOUT_MS = 10000L
        private const val POLL_INTERVAL_MS = 100L
    }

    private var backendProcess: Process? = null

    fun startBackend(onReady: () -> Unit) {
        Thread {
            try {
                val filesDir = context.filesDir
                val backendDir = File(filesDir, "backend")
                backendDir.mkdirs()

                copyAsset(BACKEND_BINARY, File(backendDir, BACKEND_BINARY))
                copyAssetDir(STATIC_DIR, File(backendDir, STATIC_DIR))

                val backendBinary = File(backendDir, BACKEND_BINARY)
                backendBinary.setExecutable(true)

                val dbDir = File(filesDir, "data")
                dbDir.mkdirs()

                val processBuilder = ProcessBuilder(
                    backendBinary.absolutePath
                )
                processBuilder.directory(backendDir)
                processBuilder.environment()["DATABASE_URL"] = "sqlite:${File(dbDir, "resonance.db").absolutePath}"
                processBuilder.environment()["HOST"] = HOST
                processBuilder.environment()["PORT"] = PORT
                processBuilder.environment()["STATIC_DIR"] = File(backendDir, STATIC_DIR).absolutePath
                processBuilder.redirectErrorStream(true)

                val logFile = File(backendDir, "backend.log")
                processBuilder.redirectOutput(ProcessBuilder.Redirect.appendTo(logFile))

                backendProcess = processBuilder.start()
                Log.i(TAG, "Backend process started (PID: ${backendProcess?.let { getPid(it) }})")

                if (waitForServer(HOST, PORT.toInt(), STARTUP_TIMEOUT_MS)) {
                    Log.i(TAG, "Backend server ready on $HOST:$PORT")
                    onReady()
                } else {
                    Log.e(TAG, "Backend server failed to start within timeout")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start backend", e)
            }
        }.start()
    }

    fun stopBackend() {
        backendProcess?.let { process ->
            Log.i(TAG, "Stopping backend process")
            process.destroyForcibly()
            try {
                process.waitFor()
            } catch (_: Exception) {}
        }
        backendProcess = null
    }

    private fun copyAsset(assetName: String, destFile: File) {
        if (destFile.exists()) return
        try {
            context.assets.open(assetName).use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            }
            Log.d(TAG, "Copied asset: $assetName → ${destFile.absolutePath}")
        } catch (e: FileNotFoundException) {
            Log.w(TAG, "Asset not found: $assetName (will be provided at build time)")
        } catch (e: IOException) {
            Log.e(TAG, "Failed to copy asset: $assetName", e)
        }
    }

    private fun copyAssetDir(assetDir: String, destDir: File) {
        try {
            val files = context.assets.list(assetDir) ?: return
            destDir.mkdirs()
            for (file in files) {
                val subAsset = "$assetDir/$file"
                val destFile = File(destDir, file)
                val subFiles = context.assets.list(subAsset)
                if (subFiles != null && subFiles.isNotEmpty()) {
                    copyAssetDir(subAsset, destFile)
                } else {
                    copyAsset(subAsset, destFile)
                }
            }
        } catch (e: IOException) {
            Log.w(TAG, "Asset dir not found: $assetDir")
        }
    }

    private fun waitForServer(host: String, port: Int, timeoutMs: Long): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                Socket(host, port).use { return true }
            } catch (_: Exception) {
                Thread.sleep(POLL_INTERVAL_MS)
            }
        }
        return false
    }

    private fun getPid(process: Process): Int {
        return try {
            val pidField = process.javaClass.getDeclaredField("pid")
            pidField.isAccessible = true
            pidField.getInt(process)
        } catch (_: Exception) {
            -1
        }
    }
}
