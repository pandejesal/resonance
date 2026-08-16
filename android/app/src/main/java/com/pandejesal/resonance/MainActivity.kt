package com.pandejesal.resonance

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import android.view.View
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var backendPlugin: BackendPlugin
    private var mediaReceiver: BroadcastReceiver? = null
    private var isBackendStarted = false

    private val folderPickerLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri ->
        uri?.let {
            contentResolver.takePersistableUriPermission(
                it, Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
            val path = getPathFromUri(it)
            Log.i(TAG, "Selected folder: $path")
            webView.post {
                // Use JSONObject.quote() to prevent JavaScript injection
                webView.evaluateJavascript(
                    "if(window.__onFolderSelected) window.__onFolderSelected(${org.json.JSONObject.quote(path)});",
                    null
                )
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge: let content draw behind system bars
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Make status bar and navigation bar transparent
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT

        webView = WebView(this).apply {
            // WebView must be added programmatically (no XML layout needed)
        }
        setContentView(webView)

        // Light status bar icons for dark theme (must be after setContentView)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.setSystemBarsAppearance(
                0,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            )
        }

        setupWebView()
        requestPermissionsIfNeeded()

        // Show loading screen while backend starts
        webView.loadData(getLoadingHtml(), "text/html", "UTF-8")

        // Start the Rust backend
        backendPlugin = BackendPlugin(this)
        startBackend()

        // Register receiver for media commands from notification
        registerMediaReceiver()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false

            // Security: disable file access (not needed for HTTP-loaded UI)
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false

            // Performance optimizations for POCO C31 (Helio G35)
            cacheMode = WebSettings.LOAD_DEFAULT
            databaseEnabled = true

            // Proper viewport for 720x1560 display
            useWideViewPort = true
            loadWithOverviewMode = true

            // Text scaling for readability on 720p
            textZoom = 100
        }

        webView.addJavascriptInterface(AppBridge(this), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return true
                val remote = getPrefs().getString("server_url", "") ?: ""
                // Only allow the local backend and the user-configured remote server
                val allowed = url.startsWith("http://127.0.0.1:$PORT") ||
                              url.startsWith("http://localhost:$PORT") ||
                              (remote.isNotEmpty() && url.startsWith(remote))
                if (!allowed) {
                    Log.w(TAG, "Blocked navigation to: $url")
                    return true
                }
                return false
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    Log.w(TAG, "Main frame error: ${error?.description}")
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.i(TAG, "Page loaded: $url")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    Log.d("ResonanceJS", "${it.messageLevel()}: ${it.message()} [${it.sourceId()}:${it.lineNumber()}]")
                }
                return true
            }
        }

        // Enable hardware acceleration for smooth scrolling
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
    }

    // ── Permissions ──────────────────────────────────────────────────

    private fun requestPermissionsIfNeeded() {
        val permsToRequest = mutableListOf<String>()

        // READ_MEDIA_AUDIO is the correct permission for API 33+
        // For API 29-32, READ_EXTERNAL_STORAGE covers audio
        if (Build.VERSION.SDK_INT >= 33) {
            if (!hasPermission("android.permission.READ_MEDIA_AUDIO")) {
                permsToRequest.add("android.permission.READ_MEDIA_AUDIO")
            }
            if (!hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
                permsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        } else {
            // API 29-32: READ_EXTERNAL_STORAGE is sufficient
            if (!hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)) {
                permsToRequest.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }

        if (permsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permsToRequest.toTypedArray(), REQUEST_PERMISSIONS)
        }

        // MIUI 12: Request autostart permission (critical for background playback)
        requestMiuiAutostartIfNeeded()

        // Disable battery optimization for continuous playback
        requestIgnoreBatteryOptimizations()
    }

    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * MIUI 12 has an aggressive autostart blocker that kills background services.
     * This opens MIUI's autostart settings so the user can enable it for Resonance.
     */
    private fun requestMiuiAutostartIfNeeded() {
        if (!isMiui()) return

        val prefs = getPrefs()
        if (prefs.getBoolean("miui_autostart_shown", false)) return

        try {
            val intent = Intent()
            intent.setClassName(
                "com.miui.securitycenter",
                "com.miui.permcenter.autostart.AutoStartManagementActivity"
            )
            startActivity(intent)
            prefs.edit().putBoolean("miui_autostart_shown", true).apply()
        } catch (e: Exception) {
            Log.w(TAG, "MIUI autostart settings not available: ${e.message}")
        }
    }

    /**
     * Request to ignore battery optimizations so the service isn't killed
     * during background playback on MIUI 12.
     */
    private fun requestIgnoreBatteryOptimizations() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
            } catch (e: Exception) {
                Log.w(TAG, "Could not request battery optimization exemption: ${e.message}")
            }
        }
    }

    private fun isMiui(): Boolean {
        return try {
            val clazz = Class.forName("android.os.SystemProperties")
            val method = clazz.getMethod("get", String::class.java, String::class.java)
            val miuiVersion = method.invoke(null, "ro.miui.ui.version.name", "") as String
            miuiVersion.isNotEmpty()
        } catch (e: Exception) {
            // Check for MIUI properties as fallback
            val prop = try {
                val process = Runtime.getRuntime().exec(arrayOf("getprop", "ro.miui.ui.version.name"))
                process.inputStream.bufferedReader().readLine().orEmpty()
            } catch (_: Exception) { "" }
            prop.isNotEmpty()
        }
    }

    // ── Backend ──────────────────────────────────────────────────────

    private fun startBackend() {
        if (isBackendStarted) return
        isBackendStarted = true

        backendPlugin.startBackend(
            onReady = {
                Log.i(TAG, "Backend ready on port $PORT")
                runOnUiThread {
                    val remote = getPrefs().getString("server_url", "") ?: ""
                    webView.loadUrl(if (remote.isNotEmpty()) remote else "http://127.0.0.1:$PORT")
                }
            },
            onError = { msg ->
                Log.e(TAG, "Backend failed: $msg")
                runOnUiThread {
                    webView.loadData(getErrorHtml(msg), "text/html", "UTF-8")
                }
            }
        )
    }

    // ── Media Receiver ───────────────────────────────────────────────

    private fun registerMediaReceiver() {
        mediaReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                val command = intent?.getStringExtra("command") ?: return
                val js = when (command) {
                    ACTION_PLAY -> "if(window.__mediaCommand) window.__mediaCommand('play')"
                    ACTION_PAUSE -> "if(window.__mediaCommand) window.__mediaCommand('pause')"
                    ACTION_NEXT -> "if(window.__mediaCommand) window.__mediaCommand('next')"
                    ACTION_PREV -> "if(window.__mediaCommand) window.__mediaCommand('prev')"
                    ACTION_STOP -> "if(window.__mediaCommand) window.__mediaCommand('stop')"
                    else -> null
                }
                js?.let { webView.post { webView.evaluateJavascript(it, null) } }
            }
        }
        val filter = IntentFilter(ACTION_MEDIA_COMMAND)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mediaReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(mediaReceiver, filter)
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    override fun onPause() {
        super.onPause()
        // Do NOT pause the WebView — audio must keep playing in background
    }

    override fun onDestroy() {
        mediaReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
        stopService(Intent(this, MediaSessionService::class.java))
        backendPlugin.stopBackend()
        webView.destroy()
        super.onDestroy()
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private fun getPrefs() = getSharedPreferences("resonance", Context.MODE_PRIVATE)

    private fun getPathFromUri(uri: Uri): String {
        // Handle DocumentProvider URIs from folder picker
        val docId = uri.lastPathSegment ?: return uri.path ?: "/storage/emulated/0"
        if (docId.startsWith("primary:")) {
            return "/storage/emulated/0/${docId.removePrefix("primary:")}"
        }
        if (docId.contains(":")) {
            val parts = docId.split(":")
            return if (parts.size > 1) "/storage/emulated/0/${parts[1]}" else "/storage/emulated/0"
        }
        return "/storage/emulated/0"
    }

    // ── HTML Screens ─────────────────────────────────────────────────

    private fun getLoadingHtml(): String = """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
        <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
             display:flex;flex-direction:column;align-items:center;justify-content:center;
             min-height:100vh;text-align:center;padding:24px}
        h1{font-size:28px;font-weight:700;margin-bottom:16px;color:#1DB954;letter-spacing:-0.5px}
        .spinner{width:40px;height:40px;border:4px solid #222;border-top-color:#1DB954;border-radius:50%;
                 animation:spin 0.8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .msg{color:#666;font-size:14px;margin-top:20px}
        .dots{display:flex;gap:6px;justify-content:center;margin-top:12px}
        .dots span{width:6px;height:6px;border-radius:50%;background:#333;animation:pulse 1.4s ease-in-out infinite}
        .dots span:nth-child(2){animation-delay:0.2s}
        .dots span:nth-child(3){animation-delay:0.4s}
        @keyframes pulse{0%,80%,100%{background:#333}40%{background:#1DB954}}
        </style>
        </head>
        <body>
        <h1>Resonance</h1>
        <div class="spinner"></div>
        <p class="msg">Starting server...</p>
        <div class="dots"><span></span><span></span><span></span></div>
        </body>
        </html>
    """.trimIndent()

    private fun getErrorHtml(error: String): String {
        // HTML-escape the error string to prevent XSS
        val safeError = error
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
        <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
             display:flex;flex-direction:column;align-items:center;justify-content:center;
             min-height:100vh;text-align:center;padding:24px}
        h1{font-size:28px;font-weight:700;margin-bottom:8px;color:#1DB954}
        .sub{color:#888;font-size:14px;margin-bottom:32px}
        .card{background:#111;border-radius:16px;padding:24px;width:100%;max-width:360px;
              border:1px solid #222}
        label{display:block;text-align:left;font-size:13px;color:#aaa;margin-bottom:6px}
        input{width:100%;padding:12px;border:1px solid #333;border-radius:10px;background:#000;
              color:#fff;font-size:15px;margin-bottom:16px;outline:none;transition:border-color 0.2s}
        input:focus{border-color:#1DB954}
        button{width:100%;padding:14px;border:none;border-radius:24px;font-size:16px;font-weight:600;
               cursor:pointer;transition:transform 0.1s,opacity 0.1s}
        button:active{transform:scale(0.97);opacity:0.9}
        .btn-primary{background:#1DB954;color:#000}
        .btn-secondary{background:#222;color:#fff;margin-top:10px}
        .status{margin-top:16px;font-size:12px;color:#888}
        .err{color:#ff4444;font-size:12px;margin-top:12px;word-break:break-word}
        </style>
        </head>
        <body>
        <h1>Resonance</h1>
        <p class="sub">Self-hosted music streaming</p>
        <div class="card">
          <label>Server URL</label>
          <input type="url" id="url" placeholder="http://192.168.1.100:8080" value="http://127.0.0.1:8080">
          <button class="btn-primary" onclick="connect()">Connect</button>
          <button class="btn-secondary" onclick="retry()">Retry Local</button>
          <p class="status" id="status"></p>
          <p class="err">$safeError</p>
        </div>
        <script>
        function connect(){
          var u=document.getElementById('url').value.trim();
          if(!u)return;if(!u.startsWith('http'))u='http://'+u;
          document.getElementById('status').textContent='Connecting...';
          fetch(u+'/api/stats').then(function(r){
            if(r.ok){localStorage.setItem('server_url',u);window.location.href=u}
            else{document.getElementById('status').textContent='Server returned '+r.status}
          }).catch(function(e){
            document.getElementById('status').textContent='Cannot reach: '+e.message});
        }
        function retry(){document.getElementById('url').value='http://127.0.0.1:8080';connect()}
        </script>
        </body>
        </html>
    """.trimIndent()
    }

    // ── JavaScript Bridge ────────────────────────────────────────────

    inner class AppBridge(private val ctx: Context) {

        @JavascriptInterface
        fun getServerUrl(): String = getPrefs().getString("server_url", "") ?: ""

        @JavascriptInterface
        fun setServerUrl(url: String) {
            getPrefs().edit().putString("server_url", url).apply()
        }

        @JavascriptInterface
        fun clearServerUrl() {
            getPrefs().edit().remove("server_url").apply()
        }

        @JavascriptInterface
        fun openUrl(url: String) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(intent)
            } catch (_: Exception) {
            }
        }

        @JavascriptInterface
        fun getServerMode(): String {
            val url = getPrefs().getString("server_url", "") ?: ""
            return if (url.isNotEmpty()) "remote" else "local"
        }

        /**
         * Validates a remote Resonance server (GET /api/stats on a background
         * thread), stores it, and navigates the WebView to it. The result is
         * delivered to window.__onConnectResult as JSON.
         */
        @JavascriptInterface
        fun connectToServer(url: String) {
            Thread {
                var normalized = url.trim()
                if (normalized.isEmpty()) {
                    deliverConnectResult("{\"ok\":false,\"error\":\"Enter a server URL\"}")
                    return@Thread
                }
                if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
                    normalized = "http://$normalized"
                }
                normalized = normalized.trimEnd('/')
                var code = 0
                try {
                    val conn = (java.net.URL("$normalized/api/stats").openConnection() as java.net.HttpURLConnection).apply {
                        connectTimeout = 4000
                        readTimeout = 4000
                        instanceFollowRedirects = true
                        requestMethod = "GET"
                    }
                    code = conn.responseCode
                    conn.disconnect()
                } catch (e: Exception) {
                    deliverConnectResult("{\"ok\":false,\"error\":\"Cannot reach server: ${safeJson(e.message ?: "connection failed")}\"}")
                    return@Thread
                }
                if (code in 200..299) {
                    getPrefs().edit().putString("server_url", normalized).apply()
                    Log.i(TAG, "Connected to remote server: $normalized")
                    webView.post { webView.loadUrl(normalized) }
                    deliverConnectResult("{\"ok\":true}")
                } else {
                    deliverConnectResult("{\"ok\":false,\"error\":\"Server returned HTTP $code\"}")
                }
            }.apply {
                name = "server-connect"
                start()
            }
        }

        private fun deliverConnectResult(json: String) {
            webView.post {
                webView.evaluateJavascript(
                    "if(window.__onConnectResult) window.__onConnectResult(${org.json.JSONObject.quote(json)});",
                    null
                )
            }
        }

        private fun safeJson(s: String): String {
            return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ")
        }

        @JavascriptInterface
        fun disconnectFromServer() {
            getPrefs().edit().remove("server_url").apply()
            Log.i(TAG, "Disconnected from remote server, returning to local")
            webView.post { webView.loadUrl("http://127.0.0.1:$PORT") }
        }

        @JavascriptInterface
        fun getLanIp(): String {
            return try {
                java.util.Collections.list(java.net.NetworkInterface.getNetworkInterfaces())
                    .filter { it.isUp && !it.isLoopback }
                    .flatMap { java.util.Collections.list(it.inetAddresses) }
                    .firstOrNull { it is java.net.Inet4Address && it.isSiteLocalAddress }
                    ?.hostAddress ?: ""
            } catch (e: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun openFolderPicker() {
            runOnUiThread {
                folderPickerLauncher.launch(null)
            }
        }

        @JavascriptInterface
        fun hasStoragePermission(): Boolean {
            return if (Build.VERSION.SDK_INT >= 33) {
                hasPermission("android.permission.READ_MEDIA_AUDIO")
            } else {
                hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }

        @JavascriptInterface
        fun requestStoragePermission() {
            requestPermissionsIfNeeded()
        }

        @JavascriptInterface
        fun getExternalStoragePath(): String {
            return Environment.getExternalStorageDirectory().absolutePath
        }

        @JavascriptInterface
        fun updatePlaybackState(
            title: String,
            artist: String,
            album: String,
            artworkUrl: String,
            isPlaying: Boolean,
            positionMs: Long,
            durationMs: Long
        ) {
            val intent = Intent(ctx, MediaSessionService::class.java).apply {
                putExtra("title", title)
                putExtra("artist", artist)
                putExtra("album", album)
                putExtra("artwork_url", artworkUrl)
                putExtra("is_playing", isPlaying)
                putExtra("position", positionMs)
                putExtra("duration", durationMs)
            }
            ContextCompat.startForegroundService(ctx, intent)
        }

        @JavascriptInterface
        fun scanDeviceMusic(): String {
            val tracks = JSONArray()

            // API 29+ uses MediaStore with scoped storage
            val projection = arrayOf(
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.YEAR,
                MediaStore.Audio.Media.TRACK,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.MIME_TYPE,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.DATE_ADDED,
                MediaStore.Audio.Media.ALBUM_ID
            )

            val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} > 5000"
            val sortOrder = "${MediaStore.Audio.Media.ARTIST} ASC, ${MediaStore.Audio.Media.ALBUM} ASC, ${MediaStore.Audio.Media.TRACK} ASC"

            try {
                ctx.contentResolver.query(
                    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    null,
                    sortOrder
                )?.use { cursor ->
                    val colPath = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
                    val colTitle = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                    val colArtist = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                    val colAlbum = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                    val colDuration = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                    val colYear = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
                    val colTrack = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
                    val colName = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
                    val colMime = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
                    val colSize = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
                    val colDate = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
                    val colAlbumId = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)

                    while (cursor.moveToNext()) {
                        val obj = JSONObject().apply {
                            put("path", cursor.getString(colPath) ?: "")
                            put("title", cursor.getString(colTitle) ?: "")
                            put("artist", cursor.getString(colArtist) ?: "")
                            put("album", cursor.getString(colAlbum) ?: "")
                            put("duration_ms", cursor.getLong(colDuration))
                            put("year", cursor.getInt(colYear))
                            put("track_number", cursor.getInt(colTrack))
                            put("file_name", cursor.getString(colName) ?: "")
                            put("mime_type", cursor.getString(colMime) ?: "")
                            put("file_size", cursor.getLong(colSize))
                            put("date_added", cursor.getLong(colDate))
                        }
                        tracks.put(obj)
                    }
                }
                Log.i(TAG, "MediaStore scan: ${tracks.length()} tracks found")
            } catch (e: Exception) {
                Log.e(TAG, "MediaStore scan failed: ${e.message}", e)
            }

            return tracks.toString()
        }
    }

    // ── Companion ────────────────────────────────────────────────────

    companion object {
        private const val TAG = "Resonance"
        private const val PORT = 8080
        private const val REQUEST_PERMISSIONS = 100
        private const val ACTION_MEDIA_COMMAND = "com.pandejesal.resonance.MEDIA_COMMAND"
        private const val ACTION_PLAY = "com.pandejesal.resonance.PLAY"
        private const val ACTION_PAUSE = "com.pandejesal.resonance.PAUSE"
        private const val ACTION_NEXT = "com.pandejesal.resonance.NEXT"
        private const val ACTION_PREV = "com.pandejesal.resonance.PREV"
        private const val ACTION_STOP = "com.pandejesal.resonance.STOP"
    }
}
