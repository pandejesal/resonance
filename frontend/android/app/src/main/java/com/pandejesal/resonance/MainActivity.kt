package com.pandejesal.resonance

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var backendPlugin: BackendPlugin

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

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        val savedUrl = getPrefs().getString("server_url", null)
        if (savedUrl != null) {
            Log.i(TAG, "Connecting to saved server: $savedUrl")
            webView.loadUrl(savedUrl)
        } else {
            Log.i(TAG, "No server configured, showing setup")
            webView.loadData(setupHtml(), "text/html", "UTF-8")
        }

        backendPlugin = BackendPlugin(this)
        tryStartBackend()
    }

    private fun tryStartBackend() {
        backendPlugin.startBackend(
            onReady = {
                val savedUrl = getPrefs().getString("server_url", null)
                if (savedUrl == null) {
                    Log.i(TAG, "Backend started, saving URL")
                    getPrefs().edit().putString("server_url", "http://127.0.0.1:8080").apply()
                    runOnUiThread {
                        webView.loadUrl("http://127.0.0.1:8080")
                    }
                }
            },
            onError = { msg ->
                Log.w(TAG, "Backend failed: $msg")
            }
        )
    }

    private fun setupHtml(): String {
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
</style>
</head>
<body>
<h1>Resonance</h1>
<p class="sub">Self-hosted music streaming</p>
<div class="card">
  <label>Server URL</label>
  <input type="url" id="url" placeholder="http://192.168.1.100:8080" value="http://127.0.0.1:8080">
  <button class="btn-primary" onclick="connect()">Connect</button>
  <button class="btn-secondary" onclick="tryLocal()">Try Local Server</button>
  <p class="status" id="status"></p>
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
function tryLocal(){
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

    override fun onDestroy() {
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
    }

    companion object {
        private const val TAG = "Resonance"
    }
}
