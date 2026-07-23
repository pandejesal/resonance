package com.pandejesal.resonance

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
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
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    view?.loadData(
                        errorHtml("Connection failed", "Could not connect to the backend server. It may still be starting up."),
                        "text/html",
                        "UTF-8"
                    )
                }
            }
        }
        webView.webChromeClient = WebChromeClient()

        webView.loadData(loadingHtml(), "text/html", "UTF-8")

        backendPlugin = BackendPlugin(this)

        backendPlugin.startBackend(
            onReady = {
                runOnUiThread {
                    webView.loadUrl("http://127.0.0.1:8080")
                }
            },
            onError = { errorMsg ->
                runOnUiThread {
                    webView.loadData(
                        errorHtml("Server Error", errorMsg),
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

    private fun errorHtml(title: String, message: String): String {
        return "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,user-scalable=no\"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px}.icon{font-size:48px;margin-bottom:16px}h1{font-size:24px;font-weight:600;margin-bottom:8px}p{color:#888;font-size:14px;line-height:1.5;margin-bottom:24px}button{background:#1DB954;color:#000;border:none;padding:12px 32px;border-radius:24px;font-size:16px;font-weight:600;cursor:pointer}</style></head><body><div class=\"icon\">&#9888;</div><h1>$title</h1><p>$message</p><button onclick=\"location.reload()\">Retry</button></body></html>"
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
}
