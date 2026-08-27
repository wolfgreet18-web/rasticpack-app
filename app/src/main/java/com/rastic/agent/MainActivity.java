package com.rastic.agent;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private TextView chatView;
    private EditText input;
    private ScrollView scrollView;
    private SharedPreferences prefs;
    private AgentCore agentCore;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("agent", MODE_PRIVATE);
        agentCore = new AgentCore(this);
        buildUi();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateServiceStatus();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        int pad = dp(12);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Rastic AI Agent");
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        root.addView(title, wrap(-1, dp(48)));

        statusText = new TextView(this);
        statusText.setTextSize(13);
        statusText.setGravity(Gravity.CENTER);
        root.addView(statusText, wrap(-1, dp(28)));

        LinearLayout bar = new LinearLayout(this);
        Button accessBtn = new Button(this);
        accessBtn.setText("فعال‌کردن کنترل گوشی");
        accessBtn.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        Button cfgBtn = new Button(this);
        cfgBtn.setText("تنظیمات API");
        cfgBtn.setOnClickListener(v -> showApiSettings());
        bar.addView(accessBtn, weighted());
        bar.addView(cfgBtn, weighted());
        root.addView(bar, wrap(-1, dp(56)));

        chatView = new TextView(this);
        chatView.setText("سلام! یک دستور ساده بده، مثلاً: «Chrome را باز کن»\n");
        chatView.setTextSize(15);
        chatView.setPadding(dp(4), dp(4), dp(4), dp(4));
        scrollView = new ScrollView(this);
        scrollView.addView(chatView, wrap(-1, -2));
        root.addView(scrollView, weightedVertical());

        LinearLayout sendBar = new LinearLayout(this);
        input = new EditText(this);
        input.setHint("مثلاً: صفحه فعلی را بخوان");
        Button sendBtn = new Button(this);
        sendBtn.setText("ارسال");
        sendBtn.setOnClickListener(v -> onSend());
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(0, dp(56), 1);
        sendBar.addView(input, inputParams);
        sendBar.addView(sendBtn, wrap(dp(90), dp(56)));
        root.addView(sendBar, wrap(-1, dp(56)));

        setContentView(root);
        updateServiceStatus();
    }

    private TextView statusText;

    private void updateServiceStatus() {
        boolean running = AgentAccessibilityService.isRunning();
        statusText.setText(running ? "وضعیت سرویس: فعال ✅" : "وضعیت سرویس: غیرفعال — از دکمه بالا آن را روشن کنید ⚠️");
        statusText.setTextColor(running ? Color.parseColor("#1B5E20") : Color.parseColor("#B71C1C"));
    }

    private void onSend() {
        String text = input.getText().toString().trim();
        if (text.isEmpty()) return;
        appendChat("شما: " + text);
        input.setText("");
        appendChat("Agent: در حال پردازش...");

        agentCore.ask(text, result -> {
            removeLastLine();
            appendChat("Agent: " + result);
        });
    }

    private String lastAppended = "";

    private void appendChat(String line) {
        lastAppended = line;
        chatView.append("\n" + line + "\n");
        scrollView.post(() -> scrollView.fullScroll(ScrollView.FOCUS_DOWN));
    }

    private void removeLastLine() {
        String current = chatView.getText().toString();
        int idx = current.lastIndexOf("\n" + lastAppended + "\n");
        if (idx >= 0) {
            chatView.setText(current.substring(0, idx));
        }
    }

    private void showApiSettings() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        layout.setPadding(pad, pad, pad, pad);

        EditText endpointField = new EditText(this);
        endpointField.setHint("Endpoint (مثلاً https://api.openai.com/v1/chat/completions)");
        endpointField.setText(prefs.getString("endpoint", "https://api.openai.com/v1/chat/completions"));

        EditText keyField = new EditText(this);
        keyField.setHint("API Key");
        keyField.setInputType(android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD | android.text.InputType.TYPE_CLASS_TEXT);
        keyField.setText(prefs.getString("apiKey", ""));

        EditText modelField = new EditText(this);
        modelField.setHint("Model (مثلاً gpt-4o-mini)");
        modelField.setText(prefs.getString("model", "gpt-4o-mini"));

        layout.addView(endpointField);
        layout.addView(keyField);
        layout.addView(modelField);

        new AlertDialog.Builder(this)
                .setTitle("تنظیمات AI")
                .setView(layout)
                .setPositiveButton("ذخیره", (dialog, which) -> {
                    prefs.edit()
                            .putString("endpoint", endpointField.getText().toString().trim())
                            .putString("apiKey", keyField.getText().toString().trim())
                            .putString("model", modelField.getText().toString().trim())
                            .apply();
                    Toast.makeText(this, "ذخیره شد", Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("انصراف", null)
                .show();
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    private LinearLayout.LayoutParams wrap(int w, int h) {
        return new LinearLayout.LayoutParams(w, h);
    }

    private LinearLayout.LayoutParams weighted() {
        return new LinearLayout.LayoutParams(0, dp(56), 1);
    }

    private LinearLayout.LayoutParams weightedVertical() {
        return new LinearLayout.LayoutParams(-1, 0, 1);
    }
}
