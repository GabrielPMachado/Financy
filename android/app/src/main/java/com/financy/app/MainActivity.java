package com.financy.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.financy.overlay.QuickAddOverlayPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QuickAddOverlayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
