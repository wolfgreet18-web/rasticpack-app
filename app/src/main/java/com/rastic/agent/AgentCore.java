package com.rastic.agent;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

/**
 * موتور اصلی Agent: پیام کاربر را می‌گیرد، به AI می‌دهد، AI یک Tool
 * انتخاب می‌کند (یا پاسخ نهایی می‌دهد)، Tool اجرا می‌شود و نتیجه دوباره
 * به AI بازمی‌گردد تا زنجیره‌ی Action کامل شود.
 *
 * برای v1 این چرخه ساده نگه داشته شده: حداکثر چند مرحله، و فرمت
 * دستور AI برای انتخاب Tool به‌صورت متن ساده parse می‌شود
 * (TOOL: name {json}) تا بدون کتابخانه‌ی اضافی روی Termux قابل build باشد.
 */
public class AgentCore {

    public interface ResultCallback {
        void onResult(String text);
    }

    private static final int MAX_STEPS = 6;

    private final Context context;
    private final AiProvider ai;
    private final ToolRegistry tools;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public AgentCore(Context context) {
        this.context = context.getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences("agent", Context.MODE_PRIVATE);
        this.ai = new AiProvider(prefs);
        this.tools = new ToolRegistry();
        BuiltinTools.registerAll(tools, this.context);
    }

    /** ورودی اصلی: پیام کاربر را پردازش می‌کند و در نهایت callback را روی UI thread صدا می‌زند. */
    public void ask(String userMessage, ResultCallback callback) {
        new Thread(() -> {
            String result;
            try {
                result = runLoop(userMessage);
            } catch (Exception e) {
                result = "خطای غیرمنتظره: " + e.getMessage();
            }
            String finalResult = result;
            mainHandler.post(() -> callback.onResult(finalResult));
        }).start();
    }

    private String runLoop(String userMessage) throws Exception {
        StringBuilder transcript = new StringBuilder();
        transcript.append("درخواست کاربر: ").append(userMessage).append("\n");

        for (int step = 0; step < MAX_STEPS; step++) {
            String systemPrompt = buildSystemPrompt();
            String aiResponse = ai.chat(systemPrompt, transcript.toString());

            ParsedAction action = parseAction(aiResponse);

            if (action == null) {
                // AI پاسخ نهایی متنی داده، نه دستور Tool.
                return aiResponse;
            }

            Tool tool = tools.get(action.name);
            if (tool == null) {
                return "AI درخواست اجرای Toolای به نام «" + action.name + "» را داد که وجود ندارد.";
            }

            String toolResult;
            try {
                toolResult = tool.execute(action.args);
            } catch (Exception e) {
                toolResult = "خطا در اجرای Tool: " + e.getMessage();
            }

            transcript.append("Tool اجراشده: ").append(action.name)
                    .append(" | نتیجه: ").append(toolResult).append("\n");
        }

        return "تعداد مراحل مجاز (" + MAX_STEPS + ") تمام شد. آخرین وضعیت:\n" + transcript;
    }

    private String buildSystemPrompt() {
        return "شما Rastic AI Agent هستید، دستیاری که روی گوشی Android کاربر عمل می‌کند.\n" +
                "شما فقط اجازه دارید از میان Toolهای زیر انتخاب کنید؛ اجرای کد دلخواه ممنوع است.\n\n" +
                tools.describeAll() +
                "\nاگر برای پاسخ به کاربر نیاز به اجرای یک Tool دارید، دقیقاً با این فرمت پاسخ دهید " +
                "(فقط همین یک خط، بدون توضیح اضافه):\n" +
                "TOOL: نام_تول {\"پارامتر\": \"مقدار\"}\n\n" +
                "اگر دیگر نیازی به اجرای Tool نیست و می‌خواهید نتیجه نهایی را به کاربر بگویید، " +
                "فقط پاسخ نهایی را به فارسی و به‌صورت متن عادی بنویسید (بدون کلمه TOOL).";
    }

    private static class ParsedAction {
        String name;
        JSONObject args;
    }

    /** خط پاسخ AI را بررسی می‌کند؛ اگر با "TOOL:" شروع شود، آن را parse می‌کند، وگرنه null برمی‌گرداند. */
    private ParsedAction parseAction(String aiResponse) {
        if (aiResponse == null) return null;
        String trimmed = aiResponse.trim();
        if (!trimmed.startsWith("TOOL:")) return null;

        String rest = trimmed.substring("TOOL:".length()).trim();
        int jsonStart = rest.indexOf('{');
        String toolName;
        String jsonPart;
        if (jsonStart == -1) {
            toolName = rest.trim();
            jsonPart = "{}";
        } else {
            toolName = rest.substring(0, jsonStart).trim();
            jsonPart = rest.substring(jsonStart).trim();
        }

        try {
            ParsedAction action = new ParsedAction();
            action.name = toolName;
            action.args = new JSONObject(jsonPart);
            return action;
        } catch (Exception e) {
            return null;
        }
    }
}
