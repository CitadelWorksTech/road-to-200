package tech.citadelworks.roadto200;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import java.text.NumberFormat;

/**
 * Counts steps all day using the phone's built-in step counter sensor.
 * Runs as a low-power foreground service (the step sensor batches readings in hardware).
 */
public class StepCounterService extends Service implements SensorEventListener {
    static final String CHANNEL_ID = "road200_steps";
    static final int NOTIFICATION_ID = 2001;

    private SensorManager sensorManager;
    private long lastNotifyAt = 0;

    static boolean canCount(Context ctx) {
        SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null || sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) == null) return false;
        return Build.VERSION.SDK_INT < 29
            || ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    static void start(Context ctx) {
        if (!canCount(ctx)) return;
        ContextCompat.startForegroundService(ctx, new Intent(ctx, StepCounterService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        try {
            int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(StepStore.todaySteps(this)), type);
        } catch (Exception e) {
            stopSelf();
            return;
        }
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        Sensor sensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (sensor == null) { stopSelf(); return; }
        // Let the sensor hub batch readings for up to a minute to save battery.
        sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL, 60_000_000);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;
        long today = StepStore.record(this, event.values[0]);
        long now = System.currentTimeMillis();
        if (now - lastNotifyAt > 60_000) {
            lastNotifyAt = now;
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(today));
            try { RoadWidgetProvider.updateAll(this); } catch (Exception ignored) {}
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    public void onDestroy() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Step counting", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shows today's steps while Road to 200 counts them.");
            ch.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(long steps) {
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_steps)
            .setContentTitle("Today: " + NumberFormat.getIntegerInstance().format(steps) + " steps")
            .setContentText("Road to 200 is counting your steps")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setContentIntent(pi)
            .build();
    }
}
