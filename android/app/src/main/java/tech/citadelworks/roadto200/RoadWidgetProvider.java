package tech.citadelworks.roadto200;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.NumberFormat;

/** Home-screen widget: today's steps, push-ups and calories left. */
public class RoadWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        updateAll(context);
    }

    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        if (mgr == null) return;
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, RoadWidgetProvider.class));
        if (ids == null || ids.length == 0) return;

        JSONObject st = ReminderScheduler.state(ctx);
        boolean same = StepStore.today().equals(st.optString("date", ""));
        NumberFormat nf = NumberFormat.getIntegerInstance();

        long steps = StepStore.isEnabled(ctx) ? StepStore.todaySteps(ctx) : (same ? st.optLong("steps", 0) : 0);
        int stepTarget = Math.max(1, st.optInt("stepTarget", 5500));
        int push = same ? st.optInt("pushups", 0) : 0;
        int pushTarget = st.optInt("pushTarget", 20);
        int cal = same ? st.optInt("calories", -1) : -1;
        int calTarget = st.optInt("calorieTarget", 2300);

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_road);
        v.setTextViewText(R.id.w_steps, nf.format(steps));
        v.setTextViewText(R.id.w_steps_of, "of " + nf.format(stepTarget) + " steps");
        v.setProgressBar(R.id.w_steps_bar, 100, (int) Math.min(100, steps * 100 / stepTarget), false);
        v.setTextViewText(R.id.w_push, push + "/" + pushTarget);
        if (cal < 0) {
            v.setTextViewText(R.id.w_cal, "–");
            v.setTextViewText(R.id.w_cal_label, "calories not logged");
        } else if (cal <= calTarget) {
            v.setTextViewText(R.id.w_cal, nf.format(calTarget - cal));
            v.setTextViewText(R.id.w_cal_label, "calories left");
        } else {
            v.setTextViewText(R.id.w_cal, "+" + nf.format(cal - calTarget));
            v.setTextViewText(R.id.w_cal_label, "calories over");
        }

        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 5100, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.w_root, pi);

        mgr.updateAppWidget(ids, v);
    }
}
