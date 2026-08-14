package com.pandejesal.resonance

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var backendPlugin: BackendPlugin
    private var mediaReceiver: BroadcastReceiver? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.allowFileAccessFromFileURLs = true
        webView.settings.allowUniversalAccessFromFileURLs = true

        webView.addJavascriptInterface(AppBridge(this), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                Log.w(TAG, "WebView error: $description")
            }
        }
        webView.webChromeClient = WebChromeClient()

        requestPermissions()

        webView.loadData(getLoadingHtml(), "text/html", "UTF-8")

        backendPlugin = BackendPlugin(this)
        tryStartBackend()

        mediaReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                val command = intent?.getStringExtra("command") ?: return
                val js = when (command) {
                    "com.pandejesal.resonance.PLAY" -> "if(window.__mediaCommand) window.__mediaCommand('play')"
                    "com.pandejesal.resonance.PAUSE" -> "if(window.__mediaCommand) window.__mediaCommand('pause')"
                    "com.pandejesal.resonance.NEXT" -> "if(window.__mediaCommand) window.__mediaCommand('next')"
                    "com.pandejesal.resonance.PREV" -> "if(window.__mediaCommand) window.__mediaCommand('prev')"
                    "com.pandejesal.resonance.STOP" -> "if(window.__mediaCommand) window.__mediaCommand('stop')"
                    else -> null
                }
                js?.let { webView.post { webView.evaluateJavascript(it, null) } }
            }
        }
        val filter = IntentFilter("com.pandejesal.resonance.MEDIA_COMMAND")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mediaReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(mediaReceiver, filter)
        }
    }

    private fun requestPermissions() {
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT < 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, "android.permission.READ_MEDIA_AUDIO")
                != PackageManager.PERMISSION_GRANTED) {
                perms.add("android.permission.READ_MEDIA_AUDIO")
            }
            if (ContextCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS")
                != PackageManager.PERMISSION_GRANTED) {
                perms.add("android.permission.POST_NOTIFICATIONS")
            }
        }
        if (perms.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, perms.toTypedArray(), 100)
        }
        if (Build.VERSION.SDK_INT >= 30 && !Environment.isExternalStorageManager()) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
            } catch (e: Exception) {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                startActivity(intent)
            }
        }
    }

    private fun tryStartBackend() {
        backendPlugin.startBackend(
            onReady = {
                Log.i(TAG, "Backend ready, loading UI")
                runOnUiThread {
                    webView.loadUrl("http://127.0.0.1:$PORT")
                }
            },
            onError = { msg ->
                Log.w(TAG, "Backend failed: $msg")
                runOnUiThread {
                    webView.loadData(getErrorHtml(msg), "text/html", "UTF-8")
                }
            }
        )
    }

    private fun getLoadingHtml(): String {
        return """<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
h1{font-size:28px;font-weight:700;margin-bottom:16px;color:#1DB954}
.spinner{width:40px;height:40px;border:4px solid #333;border-top-color:#1DB954;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.msg{color:#888;font-size:14px;margin-top:20px}
</style>
</head>
<body>
<h1>Resonance</h1>
<div class="spinner"></div>
<p class="msg">Starting server...</p>
</body>
</html>"""
    }

    private fun getErrorHtml(error: String): String {
        return """<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
h1{font-size:28px;font-weight:700;margin-bottom:8px;color:#1DB954}
.sub{color:#888;font-size:14px;margin-bottom:32px}
.card{background:#1a1a1a;border-radius:16px;padding:24px;width:100%;max-width:360px}
label{display:block;text-align:left;font-size:13px;color:#aaa;margin-bottom:6px}
input{width:100%;padding:12px;border:1px solid #333;border-radius:8px;background:#000;color:#fff;font-size:15px;margin-bottom:16px;outline:none}
input:focus{border-color:#1DB954}
button{width:100%;padding:14px;border:none;border-radius:24px;font-size:16px;font-weight:600;cursor:pointer}
.btn-primary{background:#1DB954;color:#000}
.btn-secondary{background:#333;color:#fff;margin-top:10px}
.status{margin-top:16px;font-size:12px;color:#888}
.err{color:#ff4444;font-size:12px;margin-top:12px}
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
  <p class="err">$error</p>
</div>
<script>
function connect(){
  var url=document.getElementById('url').value.trim();
  if(!url){return}
  if(!url.startsWith('http')){url='http://'+url}
  document.getElementById('status').textContent='Connecting...';
  fetch(url+'/api/stats').then(function(r){
    if(r.ok){
      localStorage.setItem('server_url',url);
      window.location.href=url;
    }else{
      document.getElementById('status').textContent='Server returned '+r.status;
    }
  }).catch(function(e){
    document.getElementById('status').textContent='Cannot reach server: '+e.message;
  });
}
function retry(){
  document.getElementById('url').value='http://127.0.0.1:8080';
  connect();
}
</script>
</body>
</html>"""
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onPause() {
        super.onPause()
        // Keep WebView alive for background audio - don't let it pause
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

    private fun getPrefs() = getSharedPreferences("resonance", Context.MODE_PRIVATE)

    inner class AppBridge(private val context: Context) {
        @JavascriptInterface
        fun getServerUrl(): String {
            return getPrefs().getString("server_url", "") ?: ""
        }

        @JavascriptInterface
        fun setServerUrl(url: String) {
            getPrefs().edit().putString("server_url", url).apply()
        }

        @JavascriptInterface
        fun clearServerUrl() {
            getPrefs().edit().remove("server_url").apply()
        }

        @JavascriptInterface
        fun openFolderPicker() {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                @Suppress("DEPRECATION")
                startActivityForResult(intent, FOLDER_PICKER_REQUEST)
            }
        }

        @JavascriptInterface
        fun hasStoragePermission(): Boolean {
            return if (Build.VERSION.SDK_INT >= 30) {
                Environment.isExternalStorageManager()
            } else if (Build.VERSION.SDK_INT >= 33) {
                ContextCompat.checkSelfPermission(context, "android.permission.READ_MEDIA_AUDIO") ==
                    PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) ==
                    PackageManager.PERMISSION_GRANTED
            }
        }

        @JavascriptInterface
        fun requestStoragePermission() {
            requestPermissions()
        }

        @JavascriptInterface
        fun getExternalStoragePath(): String {
            return android.os.Environment.getExternalStorageDirectory().absolutePath
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
            val intent = Intent(context, MediaSessionService::class.java).apply {
                putExtra("title", title)
                putExtra("artist", artist)
                putExtra("album", album)
                putExtra("artwork_url", artworkUrl)
                putExtra("is_playing", isPlaying)
                putExtra("position", positionMs)
                putExtra("duration", durationMs)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        @JavascriptInterface
        fun scanDeviceMusic(): String {
            val tracks = JSONArray()
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
                context.contentResolver.query(
                    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    null,
                    sortOrder
                )?.use { cursor ->
                    val pathCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
                    val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                    val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                    val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                    val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                    val yearCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
                    val trackCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
                    val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
                    val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
                    val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
                    val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
                    val albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
                    while (cursor.moveToNext()) {
                        val obj = JSONObject()
                        obj.put("path", cursor.getString(pathCol) ?: "")
                        obj.put("title", cursor.getString(titleCol) ?: "")
                        obj.put("artist", cursor.getString(artistCol) ?: "")
                        obj.put("album", cursor.getString(albumCol) ?: "")
                        obj.put("duration_ms", cursor.getLong(durationCol))
                        obj.put("year", cursor.getInt(yearCol))
                        obj.put("track_number", cursor.getInt(trackCol))
                        obj.put("file_name", cursor.getString(nameCol) ?: "")
                        obj.put("mime_type", cursor.getString(mimeCol) ?: "")
                        obj.put("file_size", cursor.getLong(sizeCol))
                        obj.put("date_added", cursor.getLong(dateCol))
                        tracks.put(obj)
                    }
                }
                Log.i(TAG, "MediaStore scan found ${tracks.length()} tracks")
            } catch (e: Exception) {
                Log.e(TAG, "MediaStore scan failed: ${e.message}", e)
            }
            return tracks.toString()
        }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FOLDER_PICKER_REQUEST && resultCode == Activity.RESULT_OK) {
            val uri = data?.data ?: return
            val path = getPathFromUri(uri)
            Log.i(TAG, "Selected folder: $path")
            webView.post {
                webView.evaluateJavascript(
                    "if(window.__onFolderSelected) window.__onFolderSelected('$path');",
                    null
                )
            }
        }
    }

    private fun getPathFromUri(uri: Uri): String {
        val docId = uri.lastPathSegment ?: return uri.path ?: "/"
        if (docId.startsWith("primary:")) {
            return "/storage/emulated/0/${docId.removePrefix("primary:")}"
        }
        if (docId.contains(":")) {
            val parts = docId.split(":")
            return if (parts.size > 1) "/storage/emulated/0/${parts[1]}" else "/storage/emulated/0"
        }
        return "/storage/emulated/0"
    }

    companion object {
        private const val TAG = "Resonance"
        private const val PORT = 8080
        private const val FOLDER_PICKER_REQUEST = 9999
    }
}
