package tech.citadelworks.roadto200;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.util.Locale;

/**
 * Records a GPS walk, hike or ride as a foreground service, so tracking continues
 * with the screen off or while using other apps. A notification shows live distance and time.
 */
public class GpsTrackerService extends Service implements LocationListener {
    static final String ACTION_START = "tech.citadelworks.roadto200.GPS_START";
    static final String ACTION_PAUSE = "tech.citadelworks.roadto200.GPS_PAUSE";
    static final String ACTION_RESUME = "tech.citadelworks.roadto200.GPS_RESUME";
    static final String ACTION_STOP = "tech.citadelworks.roadto200.GPS_STOP";
    static final String CHANNEL_ID = "road200_gps";
    static final int NOTIFICATION_ID = 2002;

    private LocationManager lm;
    private boolean listening;
    private long lastNotify;

    static void send(Context ctx, String action, String label, double maxSpeed) {
        Intent i = new Intent(ctx, GpsTrackerService.class).setAction(action);
        if (label != null) i.putExtra("label", label);
        i.putExtra("maxSpeed", maxSpeed);
        if (ACTION_START.equals(action)) androidx.core.content.ContextCompat.startForegroundService(ctx, i);
        else ctx.startService(i);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent == null ? null : intent.getAction();
        TrackData t = TrackData.get();
        if (ACTION_START.equals(a)) {
            t.start(intent.getStringExtra("label"), intent.getDoubleExtra("maxSpeed", 4));
            if (!goForeground()) { t.stop(); stopSelf(); return START_NOT_STICKY; }
            listen();
        } else if (ACTION_PAUSE.equals(a)) {
            t.pause(); unlisten(); notifyNow();
        } else if (ACTION_RESUME.equals(a)) {
            t.resume(); listen(); notifyNow();
        } else if (ACTION_STOP.equals(a)) {
            t.stop(); unlisten();
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            stopSelf();
        } else if (!t.active) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private boolean goForeground() {
        createChannel();
        try {
            int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, build(), type);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void listen() {
        if (listening) return;
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) return;
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 0f, this, Looper.getMainLooper());
            listening = true;
        } catch (SecurityException | IllegalArgumentException ignored) {}
    }

    private void unlisten() {
        if (lm != null && listening) { try { lm.removeUpdates(this); } catch (Exception ignored) {} }
        listening = false;
    }

    @Override
    public void onLocationChanged(Location l) {
        TrackData.get().onFix(l.getLatitude(), l.getLongitude(), l.hasAccuracy() ? l.getAccuracy() : 50f, l.getTime());
        if (System.currentTimeMillis() - lastNotify > 10_000) notifyNow();
    }

    // Implemented explicitly: older Android versions call these and have no default implementation.
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}

    private void notifyNow() {
        lastNotify = System.currentTimeMillis();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null && TrackData.get().active) {
            try { nm.notify(NOTIFICATION_ID, build()); } catch (SecurityException ignored) {}
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "GPS tracking", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shows distance and time while Forgeway records a walk, hike or ride.");
            ch.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification build() {
        TrackData t = TrackData.get();
        long s = t.elapsed() / 1000;
        String time = s >= 3600 ? String.format(Locale.US, "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60) : String.format(Locale.US, "%d:%02d", s / 60, s % 60);
        String miles = String.format(Locale.US, "%.2f mi", t.meters / 1609.344);
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 2, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_steps)
            .setContentTitle((t.paused ? "Paused: " : "") + t.label)
            .setContentText(miles + " · " + time)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setContentIntent(pi)
            .build();
    }

    @Override
    public void onDestroy() { unlisten(); super.onDestroy(); }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
