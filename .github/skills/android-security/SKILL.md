---
name: android-webview-security
description: Security hardening for Android WebView apps with JNI backend
---

# Android WebView Security

## WebView Configuration
```kotlin
// NEVER set these to true in production
webView.settings.allowFileAccessFromFileURLs = false
webView.settings.allowUniversalAccessFromFileURLs = false
webView.settings.allowFileAccess = false  // default is fine
webView.settings.allowContentAccess = false  // unless needed
```

## JavaScript Injection Prevention
```kotlin
// NEVER interpolate unsanitized strings into JS
// BAD:
webView.evaluateJavascript("callback('$path')", null)
// GOOD:
webView.evaluateJavascript("callback(${JSONObject.quote(path)})", null)
```

## XSS Prevention in HTML
```kotlin
// NEVER interpolate user data into HTML
// BAD:
"<p>$error</p>"
// GOOD:
"<p>${error.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")}</p>"
```

## Context Leaks
```kotlin
// ALWAYS use applicationContext for long-lived components
class BackendPlugin(context: Context) {
    private val context = context.applicationContext  // NOT context directly
}
```

## Thread Safety
```kotlin
// Use @Volatile for cross-thread visibility
@Volatile private var isRunning = false

// Use AtomicBoolean for CAS operations
private val isRunning = AtomicBoolean(false)
```

## Foreground Service Safety (API 31+)
```kotlin
try {
    startForeground(NOTIFICATION_ID, notification)
} catch (e: ForegroundServiceStartNotAllowedException) {
    Log.e(TAG, "Cannot start foreground service from background", e)
    stopSelf()
}
```

## Permission Handling
```kotlin
// Always check result in onRequestPermissionsResult
override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
    when (requestCode) {
        REQUEST_PERMISSIONS -> {
            val denied = permissions.zip(grantResults.toList())
                .filter { it.second != PackageManager.PERMISSION_GRANTED }
            if (denied.isNotEmpty()) {
                // Show rationale or direct to settings
            }
        }
    }
}
```

## MIUI 12 Specific
- Request autostart permission on first launch only (not every time)
- Request battery optimization exemption
- Use `RECEIVER_NOT_EXPORTED` for broadcast receivers on API 33+
- Test notification channel visibility (MIUI can suppress channels)
- `startForegroundService` may fail silently in background on MIUI
