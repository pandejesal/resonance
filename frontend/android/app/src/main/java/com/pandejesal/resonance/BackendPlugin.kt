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
        private const val STARTUP_TIMEOUT_MS = 20000L
        private const val POLL_INTERVAL_MS = 500L
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
                    onError("Backend binary not found in APK assets. The APK may be corrupted.")
                    return@Thread
                }

                FileOutputStream(backendBinaryFile).use { it.write(assetBytes) }
                backendBinaryFile.setExecutable(true, false)
                Log.i(TAG, "Backend binary: ${assetBytes.size} bytes, executable=${backendBinaryFile.canExecute()}")

                copyAssetDir(STATIC_DIR, File(backendDir, STATIC_DIR))

                val dbPath = File(dbDir, "resonance.db").absolutePath
                val staticPath = File(backendDir, STATIC_DIR).absolutePath

                val processBuilder = ProcessBuilder(backendBinaryFile.absolutePath)
                processBuilder.directory(backendDir)
                processBuilder.environment()["DATABASE_URL"] = "sqlite:$dbPath"
                processBuilder.environment()["HOST"] = HOST
                processBuilder.environment()["PORT"] = PORT
                processBuilder.environment()["STATIC_DIR"] = staticPath
                processBuilder.redirectErrorStream(true)

                val logFile = File(backendDir, "backend.log")
                processBuilder.redirectOutput(ProcessBuilder.Redirect.appendTo(logFile))

                Log.i(TAG, "Starting: ${backendBinaryFile.absolutePath}")
                Log.i(TAG, "Args: DATABASE_URL=sqlite:$dbPath HOST=$HOST PORT=$PORT STATIC_DIR=$staticPath")

                backendProcess = processBuilder.start()
                val pid = getPid(backendProcess!!)
                Log.i(TAG, "Process started (PID: $pid)")

                Thread.sleep(1000)

                if (backendProcess != null && !backendProcess!!.isAlive) {
                    val exitCode = backendProcess?.exitValue() ?: -1
                    val logContent = readFileTail(logFile, 30)
                    val errorMsg = "Binary exited with code $exitCode\n\n$logContent"
                    Log.e(TAG, errorMsg)
                    onError(errorMsg)
                    return@Thread
                }

                val serverReady = waitForServer(HOST, PORT.toInt(), STARTUP_TIMEOUT_MS)
                if (serverReady) {
                    Log.i(TAG, "Server ready")
                    onReady()
                } else {
                    val logContent = readFileTail(logFile, 30)
                    val processAlive = backendProcess?.isAlive ?: false
                    val errorMsg = if (!processAlive) {
                        val exitCode = backendProcess?.exitValue() ?: -1
                        "Binary crashed (exit code $exitCode)\n\n$logContent"
                    } else {
                        "Server did not respond within ${STARTUP_TIMEOUT_MS / 1000}s\n\n$logContent"
                    }
                    Log.e(TAG, errorMsg)
                    backendProcess?.destroyForcibly()
                    backendProcess = null
                    onError(errorMsg)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception", e)
                backendProcess?.destroyForcibly()
                backendProcess = null
                onError("Exception: ${e.javaClass.simpleName}: ${e.message}")
            }
        }.start()
    }

    fun stopBackend() {
        backendProcess?.destroyForcibly()
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
                            FileOutputStream(destFile).use { output -> input.copyTo(output) }
                        }
                    } catch (_: Exception) {}
                }
            }
        } catch (_: Exception) {}
    }

    private fun waitForServer(host: String, port: Int, timeoutMs: Long): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                Socket(host, port).use { return true }
            } catch (_: Exception) {
                if (backendProcess != null && !backendProcess!!.isAlive) return false
                Thread.sleep(POLL_INTERVAL_MS)
            }
        }
        return false
    }

    private fun readFileTail(file: File, maxLines: Int): String {
        if (!file.exists()) return "(no log file)"
        return try {
            file.readLines().takeLast(maxLines).joinToString("\n")
        } catch (_: Exception) { "" }
    }

    private fun getPid(process: Process): Int {
        return try {
            val pidField = process.javaClass.getDeclaredField("pid")
            pidField.isAccessible = true
            pidField.getInt(process)
        } catch (_: Exception) { -1 }
    }
}
