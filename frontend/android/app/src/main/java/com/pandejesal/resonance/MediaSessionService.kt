package com.pandejesal.resonance

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import java.net.URL

class MediaSessionService : Service() {

    companion object {
        private const val TAG = "MediaSessionService"
        private const val CHANNEL_ID = "resonance_playback"
        private const val NOTIFICATION_ID = 1
        private const val ACTION_PLAY = "com.pandejesal.resonance.PLAY"
        private const val ACTION_PAUSE = "com.pandejesal.resonance.PAUSE"
        private const val ACTION_NEXT = "com.pandejesal.resonance.NEXT"
        private const val ACTION_PREV = "com.pandejesal.resonance.PREV"
        private const val ACTION_STOP = "com.pandejesal.resonance.STOP"

        var instance: MediaSessionService? = null
            private set

        fun broadcastCommand(action: String) {
            instance?.let { svc ->
                val intent = Intent(svc, MediaSessionService::class.java).apply {
                    this.action = action
                }
                svc.startService(intent)
            }
        }
    }

    private var artworkBitmap: Bitmap? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        Log.i(TAG, "MediaSessionService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY, ACTION_PAUSE, ACTION_NEXT, ACTION_PREV, ACTION_STOP -> {
                sendCommand(intent.action!!)
                return START_NOT_STICKY
            }
        }

        val title = intent?.getStringExtra("title") ?: ""
        val artist = intent?.getStringExtra("artist") ?: ""
        val artworkUrl = intent?.getStringExtra("artwork_url") ?: ""
        val isPlaying = intent?.getBooleanExtra("is_playing", false) ?: false

        if (artworkUrl.isNotEmpty()) {
            Thread {
                try {
                    val fullUrl = if (artworkUrl.startsWith("/")) "http://127.0.0.1:8080$artworkUrl" else artworkUrl
                    val url = URL(fullUrl)
                    val connection = url.openConnection()
                    connection.connectTimeout = 3000
                    connection.readTimeout = 3000
                    val inputStream = connection.getInputStream()
                    artworkBitmap = BitmapFactory.decodeStream(inputStream)
                    inputStream.close()
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to load artwork: ${e.message}")
                }
            }.start()
        }

        startForeground(NOTIFICATION_ID, buildNotification(title, artist, isPlaying))

        return START_STICKY
    }

    private fun buildNotification(title: String, artist: String, isPlaying: Boolean): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        openIntent.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        val pendingOpen = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE)

        val prevIntent = Intent(this, MediaSessionService::class.java).apply { action = ACTION_PREV }
        val pendingPrev = PendingIntent.getService(this, 1, prevIntent, PendingIntent.FLAG_IMMUTABLE)

        val playPauseIntent = Intent(this, MediaSessionService::class.java).apply {
            action = if (isPlaying) ACTION_PAUSE else ACTION_PLAY
        }
        val pendingPlayPause = PendingIntent.getService(this, 2, playPauseIntent, PendingIntent.FLAG_IMMUTABLE)

        val nextIntent = Intent(this, MediaSessionService::class.java).apply { action = ACTION_NEXT }
        val pendingNext = PendingIntent.getService(this, 3, nextIntent, PendingIntent.FLAG_IMMUTABLE)

        val stopIntent = Intent(this, MediaSessionService::class.java).apply { action = ACTION_STOP }
        val pendingStop = PendingIntent.getService(this, 4, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(pendingOpen)
            .setOngoing(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, "Previous", pendingPrev)
            .addAction(
                if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                if (isPlaying) "Pause" else "Play",
                pendingPlayPause
            )
            .addAction(android.R.drawable.ic_media_next, "Next", pendingNext)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", pendingStop)

        if (artworkBitmap != null) {
            builder.setLargeIcon(artworkBitmap)
        }

        return builder.build()
    }

    private fun sendCommand(action: String) {
        val intent = Intent("com.pandejesal.resonance.MEDIA_COMMAND").apply {
            putExtra("command", action)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Controls for music playback"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }
}
