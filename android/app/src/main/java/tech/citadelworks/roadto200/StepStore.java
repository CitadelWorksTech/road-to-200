package tech.citadelworks.roadto200;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/**
 * Turns the phone's step counter (steps since the last reboot) into steps per calendar day.
 * Stored on the device in SharedPreferences as {"yyyy-MM-dd": steps}.
 */
public final class StepStore {
    private static final String PREFS = "road200_steps";
    private static final Object LOCK = new Object();

    private StepStore() {}

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Records a raw TYPE_STEP_COUNTER reading and adds the new steps to today. Returns today's total. */
    static long record(Context ctx, float raw) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(ctx);
            long counter = (long) raw;
            long last = p.getLong("lastCounter", -1);
            long delta;
            if (last < 0) delta = 0;                 // first reading: count from now on
            else if (counter < last) delta = counter; // phone restarted, counter began again at 0
            else delta = counter - last;
            if (delta > 60000) delta = 0;            // ignore impossible jumps

            String date = today();
            JSONObject days = load(p);
            long total = days.optLong(date, 0) + delta;
            try { days.put(date, total); } catch (Exception ignored) {}
            prune(days);
            p.edit()
                .putLong("lastCounter", counter)
                .putLong("lastAt", System.currentTimeMillis())
                .putString("days", days.toString())
                .apply();
            return total;
        }
    }

    static JSONObject days(Context ctx) {
        synchronized (LOCK) { return load(prefs(ctx)); }
    }

    static long todaySteps(Context ctx) {
        return days(ctx).optLong(today(), 0);
    }

    static long lastAt(Context ctx) { return prefs(ctx).getLong("lastAt", 0); }

    static boolean isEnabled(Context ctx) { return prefs(ctx).getBoolean("enabled", false); }

    static void setEnabled(Context ctx, boolean on) { prefs(ctx).edit().putBoolean("enabled", on).apply(); }

    static long enabledAt(Context ctx) { return prefs(ctx).getLong("enabledAt", 0); }

    static void markEnabledAt(Context ctx) {
        if (enabledAt(ctx) == 0) prefs(ctx).edit().putLong("enabledAt", System.currentTimeMillis()).apply();
    }

    private static JSONObject load(SharedPreferences p) {
        try { return new JSONObject(p.getString("days", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    private static void prune(JSONObject days) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, -120);
        String cutoff = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
        List<String> old = new ArrayList<>();
        Iterator<String> it = days.keys();
        while (it.hasNext()) { String k = it.next(); if (k.compareTo(cutoff) < 0) old.add(k); }
        for (String k : old) days.remove(k);
    }
}
