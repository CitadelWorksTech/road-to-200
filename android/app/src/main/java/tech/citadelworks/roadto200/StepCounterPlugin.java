package tech.citadelworks.roadto200;

import android.Manifest;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

/** JavaScript bridge: window.Capacitor.registerPlugin("StepCounter") */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = "activity"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class StepCounterPlugin extends Plugin {

    private boolean hasSensor() {
        SensorManager sm = (SensorManager) getContext().getSystemService(android.content.Context.SENSOR_SERVICE);
        return sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    private boolean activityGranted() {
        return Build.VERSION.SDK_INT < 29 || getPermissionState("activity") == PermissionState.GRANTED;
    }

    private void resolveStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", hasSensor());
        r.put("granted", activityGranted());
        r.put("enabled", StepStore.isEnabled(getContext()));
        r.put("lastAt", StepStore.lastAt(getContext()));
        r.put("enabledAt", StepStore.enabledAt(getContext()));
        try {
            r.put("days", new JSObject(StepStore.days(getContext()).toString()));
        } catch (Exception e) {
            r.put("days", new JSObject());
        }
        call.resolve(r);
    }

    /** Current status plus steps per day. Also makes sure counting is running if it was turned on. */
    @PluginMethod
    public void getDays(PluginCall call) {
        if (StepStore.isEnabled(getContext()) && activityGranted()) {
            try { StepCounterService.start(getContext()); } catch (Exception ignored) {}
        }
        resolveStatus(call);
    }

    /** Turns on all-day step counting, asking for the Physical activity permission if needed. */
    @PluginMethod
    public void start(PluginCall call) {
        if (!hasSensor()) { call.reject("This phone doesn't have a step counter sensor.", "NO_SENSOR"); return; }
        if (!activityGranted() || (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)) {
            requestPermissionForAliases(new String[] { "activity", "notifications" }, call, "afterPermissions");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void afterPermissions(PluginCall call) {
        if (!activityGranted()) {
            call.reject("Physical activity permission wasn't allowed.", "DENIED");
            return;
        }
        begin(call);
    }

    private void begin(PluginCall call) {
        StepStore.setEnabled(getContext(), true);
        StepStore.markEnabledAt(getContext());
        try {
            StepCounterService.start(getContext());
        } catch (Exception e) {
            call.reject("Couldn't start step counting: " + e.getMessage(), "START_FAILED");
            return;
        }
        resolveStatus(call);
    }

    /** Turns off all-day step counting. Saved days are kept. */
    @PluginMethod
    public void stop(PluginCall call) {
        StepStore.setEnabled(getContext(), false);
        getContext().stopService(new Intent(getContext(), StepCounterService.class));
        resolveStatus(call);
    }

    /** Receives today's numbers and reminder settings from the app; reschedules reminders and refreshes the widget. */
    @PluginMethod
    public void syncState(PluginCall call) {
        try {
            JSONObject data = new JSONObject(call.getData().toString());
            ReminderScheduler.saveState(getContext(), data);
            ReminderScheduler.scheduleNext(getContext());
            RoadWidgetProvider.updateAll(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't sync: " + e.getMessage());
        }
    }

    /** Asks for notification permission (Android 13+) so reminders can show. */
    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject r = new JSObject(); r.put("granted", true); call.resolve(r); return;
        }
        requestPermissionForAlias("notifications", call, "afterNotifications");
    }

    @PermissionCallback
    private void afterNotifications(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(r);
    }

    /** Opens this app's page in Android settings (permissions, battery). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
