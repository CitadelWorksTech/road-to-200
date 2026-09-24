package tech.citadelworks.roadto200;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * Smart reminders. The app sends today's numbers (weigh-in logged, push-ups, targets) through
 * StepCounterPlugin.syncState. An inexact alarm wakes ReminderReceiver at each reminder time, and a
 * reminder is only shown if it's still needed.
 */
public final class ReminderScheduler {
    static final String PREFS = "road200_app_state";
    static final String CHANNEL_ID = "road200_reminders";
    private static final int REQ_ALARM = 4100;

    private ReminderScheduler() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void saveState(Context ctx, JSONObject state) {
        prefs(ctx).edit().putString("state", state.toString()).apply();
    }

    static JSONObject state(Context ctx) {
        try { return new JSONObject(prefs(ctx).getString("state", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    private static final class Slot {
        final String key; final String time; final int minute;
        Slot(String key, String time, int minute) { this.key = key; this.time = time; this.minute = minute; }
    }

    private static int parseTime(String t) {
        try {
            String[] p = t.split(":");
            int h = Integer.parseInt(p[0].trim()), m = Integer.parseInt(p[1].trim());
            if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
            return h * 60 + m;
        } catch (Exception e) { return -1; }
    }

    private static List<Slot> slots(JSONObject r) {
        List<Slot> out = new ArrayList<>();
        if (r == null) return out;
        if (r.optBoolean("weighOn", false)) {
            String t = r.optString("weigh", ""); int m = parseTime(t); if (m >= 0) out.add(new Slot("weigh", t, m));
        }
        if (r.optBoolean("pushOn", false)) {
            JSONArray a = r.optJSONArray("push");
            if (a != null) for (int i = 0; i < a.length(); i++) {
                String t = a.optString(i, ""); int m = parseTime(t); if (m >= 0) out.add(new Slot("push", t, m));
            }
        }
        if (r.optBoolean("stepsOn", false)) {
            String t = r.optString("steps", ""); int m = parseTime(t); if (m >= 0) out.add(new Slot("steps", t, m));
        }
        return out;
    }

    private static PendingIntent alarmIntent(Context ctx) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction("tech.citadelworks.roadto200.REMINDER");
        return PendingIntent.getBroadcast(ctx, REQ_ALARM, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Sets one alarm for the next reminder time (today or tomorrow). */
    static void scheduleNext(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(ctx);
        List<Slot> list = slots(state(ctx).optJSONObject("remind"));
        if (list.isEmpty()) { am.cancel(pi); return; }
        long now = System.currentTimeMillis(), best = Long.MAX_VALUE;
        for (Slot s : list) {
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, s.minute / 60);
            c.set(Calendar.MINUTE, s.minute % 60);
            c.set(Calendar.SECOND, 5);
            c.set(Calendar.MILLISECOND, 0);
            if (c.getTimeInMillis() <= now + 30_000) c.add(Calendar.DAY_OF_YEAR, 1);
            best = Math.min(best, c.getTimeInMillis());
        }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, best, pi);
    }

    /** Called by ReminderReceiver: shows any reminders that are due and still needed. */
    static void onAlarm(Context ctx) {
        JSONObject st = state(ctx);
        String today = StepStore.today();
        boolean sameDay = today.equals(st.optString("date", ""));
        Calendar now = Calendar.getInstance();
        int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        SharedPreferences p = prefs(ctx);
        NumberFormat nf = NumberFormat.getIntegerInstance();

        for (Slot s : slots(st.optJSONObject("remind"))) {
            if (nowMin < s.minute || nowMin - s.minute > 90) continue; // not due, or too late to be useful
            String firedKey = "fired_" + s.key + "_" + s.time;
            if (today.equals(p.getString(firedKey, ""))) continue;
            p.edit().putString(firedKey, today).apply();

            if ("weigh".equals(s.key)) {
                boolean weighed = sameDay && st.optBoolean("weighed", false);
                if (!weighed) notify(ctx, 3001, "Morning weigh-in", "Step on the scale before breakfast, then log it.");
            } else if ("push".equals(s.key)) {
                int done = sameDay ? st.optInt("pushups", 0) : 0;
                int target = st.optInt("pushTarget", 20);
                if (done < target) notify(ctx, 3002, "Push-up check", done + " of " + target + " done today. Knock out a set now.");
            } else if ("steps".equals(s.key)) {
                long steps = StepStore.isEnabled(ctx) ? StepStore.todaySteps(ctx) : (sameDay ? st.optLong("steps", 0) : 0);
                int target = st.optInt("stepTarget", 5500);
                if (steps < target) {
                    long left = target - steps;
                    notify(ctx, 3003, nf.format(left) + " steps to go",
                        "You're at " + nf.format(steps) + " of " + nf.format(target) + ". A 20-minute walk covers about 2,000.");
                }
            }
        }
        scheduleNext(ctx);
    }

    private static void notify(Context ctx, int id, String title, String text) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reminders", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Weigh-in, push-up and step reminders from Road to 200.");
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_steps)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build();
        try { nm.notify(id, n); } catch (SecurityException ignored) {} // notifications not allowed
    }
}
