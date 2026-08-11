# Resonance ProGuard Rules

# Keep JavaScript interface methods (called from WebView)
-keepclassmembers class com.pandejesal.resonance.MainActivity$AppBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep the native library name
-keep class com.pandejesal.resonance.BackendPlugin {
    native void startNative(...);
}
