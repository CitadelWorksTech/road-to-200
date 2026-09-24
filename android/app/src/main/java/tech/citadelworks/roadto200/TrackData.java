package tech.citadelworks.roadto200;

import java.util.ArrayList;
import java.util.List;

/** The GPS track being recorded by GpsTrackerService. Thread-safe singleton. */
final class TrackData {
    private static final TrackData I = new TrackData();
    static TrackData get() { return I; }

    boolean active, paused;
    String label = "Walk";
    double maxSpeed = 4;          // m/s above which a jump is treated as a GPS glitch
    double meters;
    long elapsedBase, resumedAt;
    float accuracy = -1;
    final List<double[]> points = new ArrayList<>(); // {segment, lat, lon}
    private int seg = 0, skips = 0;
    private double[] last; private long lastTime;

    private TrackData() {}

    synchronized void start(String label, double maxSpeed) {
        this.label = label == null || label.isEmpty() ? "Walk" : label;
        this.maxSpeed = maxSpeed > 0 ? maxSpeed : 4;
        active = true; paused = false; meters = 0; elapsedBase = 0; resumedAt = System.currentTimeMillis();
        accuracy = -1; points.clear(); seg = 0; skips = 0; last = null;
    }

    synchronized void pause() {
        if (!active || paused) return;
        elapsedBase = elapsed(); paused = true;
    }

    synchronized void resume() {
        if (!active || !paused) return;
        paused = false; resumedAt = System.currentTimeMillis(); seg++; last = null; skips = 0;
    }

    synchronized void stop() {
        if (active && !paused) elapsedBase = elapsed();
        active = false; paused = false;
    }

    synchronized long elapsed() {
        return elapsedBase + (active && !paused ? System.currentTimeMillis() - resumedAt : 0);
    }

    /** Same filtering as the web version: skip weak fixes, jitter and impossible jumps. */
    synchronized void onFix(double lat, double lon, float acc, long time) {
        accuracy = acc;
        if (!active || paused || acc > 35) return;
        double[] p = { seg, lat, lon };
        if (last == null) { points.add(p); last = p; lastTime = time; return; }
        double d = haversine(last[1], last[2], lat, lon);
        double dt = Math.max(1, (time - lastTime) / 1000.0);
        if (d < Math.max(4, acc * 0.4)) return;
        if (d / dt > maxSpeed) {
            if (++skips < 3) return;
            seg++; p[0] = seg; points.add(p); last = p; lastTime = time; skips = 0; return;
        }
        meters += d; points.add(p); last = p; lastTime = time; skips = 0;
    }

    static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371000, t = Math.PI / 180, dl = (lat2 - lat1) * t, dg = (lon2 - lon1) * t;
        double x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dg / 2) * Math.sin(dg / 2);
        return 2 * r * Math.asin(Math.sqrt(x));
    }
}
