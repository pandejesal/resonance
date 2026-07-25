# Resonance ProGuard Rules

# Keep all app classes (needed for JNI bridge and JavaScript interface)
-keep class com.pandejesal.resonance.** { *; }

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
    private external fun startNative(...);
}

# AndroidX
-keep class androidx.** { *; }
-keep interface androidx.** { *; }

# Material Design
-keep class com.google.android.material.** { *; }

# Kotlin coroutines (if used)
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}
