package com.rastic.agent;

import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * ارتباط با مدل هوش مصنوعی از طریق یک API سازگار با OpenAI Chat
 * Completions. endpoint، API key و مدل از تنظیمات کاربر خوانده
 * می‌شوند تا بتوان بین GPT / Claude (سازگار با OpenAI schema از طریق
 * proxy) / Gemini جابه‌جا شد بدون تغییر کد.
 */
public class AiProvider {

    private final SharedPreferences prefs;

    public AiProvider(SharedPreferences prefs) {
        this.prefs = prefs;
    }

    public String getEndpoint() {
        return prefs.getString("endpoint", "https://api.openai.com/v1/chat/completions");
    }

    public String getApiKey() {
        return prefs.getString("apiKey", "");
    }

    public String getModel() {
        return prefs.getString("model", "gpt-4o-mini");
    }

    /**
     * یک پیام ساده (بدون تاریخچه) به مدل می‌فرستد و پاسخ متنی را برمی‌گرداند.
     * برای v1 کافی است؛ در نسخه‌های بعد تاریخچه‌ی مکالمه و function-calling
     * واقعی اضافه خواهد شد.
     */
    public String chat(String systemPrompt, String userMessage) throws Exception {
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.trim().isEmpty()) {
            return "خطا: API Key تنظیم نشده. از دکمه «تنظیمات API» یک کلید معتبر وارد کنید.";
        }

        JSONObject body = new JSONObject();
        body.put("model", getModel());
        JSONArray messages = new JSONArray();

        JSONObject sys = new JSONObject();
        sys.put("role", "system");
        sys.put("content", systemPrompt);
        messages.put(sys);

        JSONObject user = new JSONObject();
        user.put("role", "user");
        user.put("content", userMessage);
        messages.put(user);

        body.put("messages", messages);
        body.put("temperature", 0.3);

        URL url = new URL(getEndpoint());
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + apiKey);
        conn.setDoOutput(true);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(60000);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }

        int code = conn.getResponseCode();
        InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
        String responseText = readStream(is);

        if (code < 200 || code >= 300) {
            return "خطا از سرور AI (کد " + code + "): " + responseText;
        }

        JSONObject json = new JSONObject(responseText);
        JSONArray choices = json.optJSONArray("choices");
        if (choices == null || choices.length() == 0) {
            return "پاسخ نامعتبر از مدل: " + responseText;
        }
        JSONObject message = choices.getJSONObject(0).optJSONObject("message");
        if (message == null) return "پاسخ نامعتبر از مدل.";
        return message.optString("content", "(پاسخ خالی)");
    }

    private String readStream(InputStream is) throws Exception {
        if (is == null) return "";
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[4096];
        int len;
        while ((len = is.read(chunk)) != -1) {
            buffer.write(chunk, 0, len);
        }
        return buffer.toString("UTF-8");
    }
}
