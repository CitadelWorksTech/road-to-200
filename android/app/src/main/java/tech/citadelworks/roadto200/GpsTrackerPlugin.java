package tech.citadelworks.roadto200;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

/** JavaScript bridge for background GPS tracking: window.Capacitor.registerPlugin("GpsTracker") */
@CapacitorPlugin(
    name = "GpsTracker",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class GpsTrackerPlugin extends Plugin {

    private boolean locationGranted() { return getPermissionState("location") == PermissionState.GRANTED; }

    @PluginMethod
    public void start(PluginCall call) {
        if (!locationGranted()) { requestPermissionForAliases(new String[] { "location", "notifications" }, call, "afterPermission"); return; }
        begin(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (!locationGranted()) { call.reject("Location permission wasn't allowed.", "DENIED"); return; }
        begin(call);
    }

    private void begin(PluginCall call) {
        String label = call.getString("label", "Walk");
        Double maxSpeed = call.getDouble("maxSpeed", 4.0);
        try {
            GpsTrackerService.send(getContext(), GpsTrackerService.ACTION_START, label, maxSpeed == null ? 4.0 : maxSpeed);
        } catch (Exception e) {
            call.reject("Couldn't start GPS tracking: " + e.getMessage(), "START_FAILED");
            return;
        }
        call.resolve(snapshot(0));
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (TrackData.get().active) GpsTrackerService.send(getContext(), GpsTrackerService.ACTION_PAUSE, null, 0);
        TrackData.get().pause();
        call.resolve(snapshot(call.getInt("since", 0)));
    }

    @PluginMethod
    public void resume(PluginCall call) {
        if (TrackData.get().active) GpsTrackerService.send(getContext(), GpsTrackerService.ACTION_RESUME, null, 0);
        TrackData.get().resume();
        call.resolve(snapshot(call.getInt("since", 0)));
    }

    /** Stops tracking and returns the whole track. */
    @PluginMethod
    public void stop(PluginCall call) {
        TrackData.get().stop();
        JSObject all = snapshot(0);
        try { GpsTrackerService.send(getContext(), GpsTrackerService.ACTION_STOP, null, 0); } catch (Exception ignored) {}
        call.resolve(all);
    }

    /** Current distance and time plus any points after index `since`. */
    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(snapshot(call.getInt("since", 0)));
    }

    private JSObject snapshot(Integer since) {
        TrackData t = TrackData.get();
        JSObject r = new JSObject();
        synchronized (t) {
            int from = Math.max(0, Math.min(since == null ? 0 : since, t.points.size()));
            JSArray pts = new JSArray();
            for (int i = from; i < t.points.size(); i++) {
                double[] p = t.points.get(i);
                JSONArray a = new JSONArray();
                try { a.put((int) p[0]); a.put(p[1]); a.put(p[2]); } catch (Exception ignored) {}
                pts.put(a);
            }
            r.put("active", t.active);
            r.put("paused", t.paused);
            r.put("meters", t.meters);
            r.put("elapsedMs", t.elapsed());
            r.put("accuracy", t.accuracy);
            r.put("total", t.points.size());
            r.put("points", pts);
        }
        return r;
    }
}
