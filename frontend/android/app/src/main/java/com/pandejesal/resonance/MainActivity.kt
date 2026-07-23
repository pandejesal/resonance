package com.pandejesal.resonance

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var backendPlugin: BackendPlugin
    private var backendStarted = false

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
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.allowFileAccessFromFileURLs = true
        webView.settings.allowUniversalAccessFromFileURLs = true

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                Log.e(TAG, "WebView error: ${error?.description}")
            }
        }
        webView.webChromeClient = WebChromeClient()

        webView.loadData(loadingHtml(), "text/html", "UTF-8")

        backendPlugin = BackendPlugin(this)

        backendPlugin.startBackend(
            onReady = {
                backendStarted = true
                Log.i(TAG, "Backend started, loading from server")
                runOnUiThread {
                    webView.loadUrl("http://127.0.0.1:8080")
                }
            },
            onError = { errorMsg ->
                Log.w(TAG, "Backend failed: $errorMsg")
                runOnUiThread {
                    webView.loadData(
                        setupHtml(errorMsg),
                        "text/html",
                        "UTF-8"
                    )
                }
            }
        )
    }

    private fun loadingHtml(): String {
        return "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,user-scalable=no\"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center}.spinner{width:48px;height:48px;border:4px solid rgba(255,255,255,0.2);border-top-color:#1DB954;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:24px}@keyframes spin{to{transform:rotate(360deg)}}h1{font-size:24px;font-weight:600;margin-bottom:8px}p{color:#888;font-size:14px}</style></head><body><div class=\"spinner\"></div><h1>Resonance</h1><p>Starting server...</p></body></html>"
    }

    private fun setupHtml(errorMsg: String): String {
        val escaped = errorMsg.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
        return "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,user-scalable=no\"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px}.icon{font-size:48px;margin-bottom:16px}h1{font-size:24px;font-weight:600;margin-bottom:8px}p{color:#888;font-size:14px;line-height:1.5;margin-bottom:16px}.box{background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:24px;max-width:100%;overflow:auto}.log{color:#f44;font-size:12px;text-align:left;font-family:monospace;word-break:break-all}button{background:#1DB954;color:#000;border:none;padding:12px 32px;border-radius:24px;font-size:16px;font-weight:600;cursor:pointer;margin:8px}</style></head><body><div class=\"icon\">&#9888;</div><h1>Server Not Running</h1><p>The built-in server could not start. You need to run Resonance server separately.</p><div class=\"box\"><p class=\"log\">$escaped</p></p></div><p style=\"color:#aaa;font-size:13px\">Option 1: Run the server on your PC and enter the URL below</p><p style=\"color:#aaa;font-size:13px;margin-bottom:16px\">Option 2: Install the desktop version from GitHub</p><button onclick=\"connectToServer()\">Connect to Server</button><button onclick=\"retryStart()\" style=\"background:#333;color:#fff\">Retry Local Server</button><script>function connectToServer(){var url=prompt('Enter server URL (e.g. http://192.168.1.100:8080):','http://');if(url&&url.startsWith('http')){window.location.href=url}}function retryStart(){window.location.reload()}</script></body></html>"
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

    companion object {
        private const val TAG = "Resonance"
    }
}
