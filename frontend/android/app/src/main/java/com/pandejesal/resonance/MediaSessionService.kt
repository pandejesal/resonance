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
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
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

    private lateinit var mediaSession: MediaSessionCompat
    private var artworkBitmap: Bitmap? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()

        mediaSession = MediaSessionCompat(this, "ResonanceSession").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    sendCommand(ACTION_PLAY)
                }

                override fun onPause() {
                    sendCommand(ACTION_PAUSE)
                }

                override fun onSkipToNext() {
                    sendCommand(ACTION_NEXT)
                }

                override fun onSkipToPrevious() {
                    sendCommand(ACTION_PREV)
                }

                override fun onStop() {
                    sendCommand(ACTION_STOP)
                }
            })
            isActive = true
        }

        Log.i(TAG, "MediaSession created")
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
        val album = intent?.getStringExtra("album") ?: ""
        val artworkUrl = intent?.getStringExtra("artwork_url") ?: ""
        val isPlaying = intent?.getBooleanExtra("is_playing", false) ?: false
        val position = intent?.getLongExtra("position", 0) ?: 0
        val duration = intent?.getLongExtra("duration", 0) ?: 0

        updateMetadata(title, artist, album, artworkUrl)
        updatePlaybackState(isPlaying, position, duration)
        startForeground(NOTIFICATION_ID, buildNotification(title, artist, isPlaying))

        return START_STICKY
    }

    private fun updateMetadata(title: String, artist: String, album: String, artworkUrl: String) {
        val builder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, 0)

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
                    if (artworkBitmap != null) {
                        builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artworkBitmap)
                        mediaSession.setMetadata(builder.build())
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to load artwork: ${e.message}")
                    mediaSession.setMetadata(builder.build())
                }
            }.start()
        } else {
            mediaSession.setMetadata(builder.build())
        }
    }

    private fun updatePlaybackState(isPlaying: Boolean, position: Long, duration: Long) {
        val state = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY
                or PlaybackStateCompat.ACTION_PAUSE
                or PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                or PlaybackStateCompat.ACTION_SEEK_TO
                or PlaybackStateCompat.ACTION_STOP
            )
            .setState(
                if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                position,
                1.0f
            )
            .build()

        mediaSession.setPlaybackState(state)
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
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )

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
        mediaSession.isActive = false
        mediaSession.release()
        instance = null
        super.onDestroy()
    }
}
