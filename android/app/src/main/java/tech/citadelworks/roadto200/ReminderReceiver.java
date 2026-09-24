package tech.citadelworks.roadto200;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Woken by the reminder alarm. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try { ReminderScheduler.onAlarm(context); } catch (Exception ignored) {}
        try { RoadWidgetProvider.updateAll(context); } catch (Exception ignored) {}
    }
}
