package tech.citadelworks.roadto200;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StepCounterPlugin.class);
        registerPlugin(GpsTrackerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
