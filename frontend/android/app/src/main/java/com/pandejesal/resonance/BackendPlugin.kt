package com.pandejesal.resonance

import android.content.Context
import android.util.Log
import java.io.*
import java.net.Socket

class BackendPlugin(private val context: Context) {

    companion object {
        private const val TAG = "BackendPlugin"
        private const val BACKEND_BINARY = "resonance-backend"
        private const val STATIC_DIR = "static"
        private const val HOST = "127.0.0.1"
        private const val PORT = "8080"
        private const val STARTUP_TIMEOUT_MS = 15000L
        private const val POLL_INTERVAL_MS = 200L
    }

    private var backendProcess: Process? = null

    fun startBackend(onReady: () -> Unit, onError: (String) -> Unit) {
        Thread {
            try {
                val filesDir = context.filesDir
                val backendDir = File(filesDir, "backend")
                backendDir.mkdirs()

                val dbDir = File(filesDir, "data")
                dbDir.mkdirs()

                val backendBinaryFile = File(backendDir, BACKEND_BINARY)

                val assetBytes = try {
                    context.assets.open(BACKEND_BINARY).use { it.readBytes() }
                } catch (e: Exception) {
                    onError("Backend binary not found in app assets. The APK may be corrupted. Please reinstall.")
                    return@Thread
                }

                FileOutputStream(backendBinaryFile).use { it.write(assetBytes) }
                Log.i(TAG, "Copied backend binary (${assetBytes.size} bytes)")

                backendBinaryFile.setExecutable(true, false)

                val stat = backendBinaryFile.setReadable(true, false)
                Log.i(TAG, "Binary permissions set: executable=${backendBinaryFile.canExecute()}, readable=${backendBinaryFile.canRead()}")

                copyAssetDir(STATIC_DIR, File(backendDir, STATIC_DIR))

                val dbPath = File(dbDir, "resonance.db").absolutePath
                val staticPath = File(backendDir, STATIC_DIR).absolutePath

                Log.i(TAG, "Starting backend: db=$dbPath, static=$staticPath")

                val processBuilder = ProcessBuilder(
                    backendBinaryFile.absolutePath
                )
                processBuilder.directory(backendDir)
                processBuilder.environment()["DATABASE_URL"] = "sqlite:$dbPath"
                processBuilder.environment()["HOST"] = HOST
                processBuilder.environment()["PORT"] = PORT
                processBuilder.environment()["STATIC_DIR"] = staticPath
                processBuilder.redirectErrorStream(true)

                val logFile = File(backendDir, "backend.log")
                processBuilder.redirectOutput(ProcessBuilder.Redirect.appendTo(logFile))

                backendProcess = processBuilder.start()
                Log.i(TAG, "Backend process started (PID: ${getPid(backendProcess!!)})")

                val serverReady = waitForServer(HOST, PORT.toInt(), STARTUP_TIMEOUT_MS)
                if (serverReady) {
                    Log.i(TAG, "Backend server ready on $HOST:$PORT")
                    onReady()
                } else {
                    val logContent = readFileTail(logFile, 20)
                    val errorMsg = if (logContent.isNotBlank()) {
                        "Backend failed to start. Log:\n$logContent"
                    } else {
                        "Backend server failed to start within ${STARTUP_TIMEOUT_MS / 1000}s. The binary may not be compatible with this device."
                    }
                    Log.e(TAG, errorMsg)
                    backendProcess?.destroyForcibly()
                    backendProcess = null
                    onError(errorMsg)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start backend", e)
                backendProcess?.destroyForcibly()
                backendProcess = null
                onError("Failed to start backend: ${e.message}")
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
                    try {
                        context.assets.open(subAsset).use { input ->
                            FileOutputStream(destFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to copy asset: $subAsset")
                    }
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
                if (backendProcess != null && !backendProcess!!.isAlive) {
                    Log.e(TAG, "Backend process exited prematurely with code: ${backendProcess?.exitValue()}")
                    return false
                }
                Thread.sleep(POLL_INTERVAL_MS)
            }
        }
        return false
    }

    private fun readFileTail(file: File, maxLines: Int): String {
        if (!file.exists()) return ""
        return try {
            val lines = file.readLines()
            lines.takeLast(maxLines).joinToString("\n")
        } catch (e: Exception) {
            ""
        }
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
