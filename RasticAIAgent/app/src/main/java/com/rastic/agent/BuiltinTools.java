package com.rastic.agent;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;

import org.json.JSONObject;

/**
 * Toolهای پایه‌ی نسخه‌ی اول: خواندن صفحه، کلیک، اسکرول، Back، Home
 * و بازکردن یک برنامه با نام. برای اضافه‌کردن Tool جدید در آینده
 * (مثل screenshot یا بررسی SQLite) کافی‌ست یک کلاس مشابه پیاده‌سازی
 * و در registerAll ثبت شود.
 */
public class BuiltinTools {

    public static void registerAll(ToolRegistry registry, Context context) {

        registry.register(new Tool() {
            public String name() { return "read_screen"; }
            public String description() { return "متن قابل‌مشاهده در صفحه فعلی را می‌خواند. پارامتری نمی‌گیرد."; }
            public boolean requiresConfirmation() { return false; }
            public String execute(JSONObject args) {
                if (!AgentAccessibilityService.isRunning()) return errNoService();
                return AgentAccessibilityService.getInstance().readScreen();
            }
        });

        registry.register(new Tool() {
            public String name() { return "click_text"; }
            public String description() { return "روی عنصری از صفحه که شامل متن داده‌شده است کلیک می‌کند. پارامتر: {\"text\": \"...\"}"; }
            public boolean requiresConfirmation() { return false; }
            public String execute(JSONObject args) throws Exception {
                if (!AgentAccessibilityService.isRunning()) return errNoService();
                String text = args.optString("text", "");
                if (text.isEmpty()) return "خطا: پارامتر text لازم است.";
                boolean ok = AgentAccessibilityService.getInstance().clickByText(text);
                return ok ? ("روی «" + text + "» کلیک شد.") : ("عنصری با متن «" + text + "» پیدا نشد.");
            }
        });

        registry.register(new Tool() {
            public String name() { return "scroll_forward"; }
            public String description() { return "صفحه را به سمت پایین اسکرول می‌کند. پارامتری نمی‌گیرد."; }
            public boolean requiresConfirmation() { return false; }
            public String execute(JSONObject args) {
                if (!AgentAccessibilityService.isRunning()) return errNoService();
                boolean ok = AgentAccessibilityService.getInstance().scrollForward();
                return ok ? "اسکرول به پایین انجام شد." : "امکان اسکرول در این صفحه نبود.";
            }
        });

        registry.register(new Tool() {
            public String name() { return "scroll_backward"; }
            public String description() { return "صفحه را به سمت بالا اسکرول می‌کند. پارامتری نمی‌گیرد."; }
            public boolean requiresConfirmation() { return false; }
            public String execute(JSONObject args) {
                if (!AgentAccessibilityService.isRunning()) return errNoService();
                boolean ok = AgentAccessibilityService.getInstance().scrollBackward();
                return ok ? "اسکرول به بالا انجام شد." : "امکان اسکرول در این صفحه نبود.";
            }
        });

        registry.register(new Tool() {
            public String name() { return "back"; }
            public String description() { return "دکمه Back سیستم را فشار می‌دهد. پارامتری نمی‌گیرد."; }
            public boolean requiresConfirmation() { return false; }
            public String execute(JSONObject args) {
                if (!AgentAccessibilityService.isRunning()) return errNoService();
                AgentAccessibilityService.getInstance().pressBack();
                return "دکمه Back فشرده شد.";
            }
        });

        registry.register(new Tool() {
            public String name() { return "home"; }
            public String description() { return "به صفحه اصلی (Home) می‌رود. پارامتری نمی‌گیرد."; }
            public boolean requiresConfirmation() { return false; }
            public String execute(JSONObject args) {
                if (!AgentAccessibilityService.isRunning()) return errNoService();
                AgentAccessibilityService.getInstance().pressHome();
                return "به Home رفت.";
            }
        });

        registry.register(new Tool() {
            public String name() { return "open_app"; }
            public String description() { return "یک برنامه را با نام آن باز می‌کند. پارامتر: {\"app_name\": \"Chrome\"}"; }
            public boolean requiresConfirmation() { return false; }
            public String execute(JSONObject args) {
                String appName = args.optString("app_name", "");
                if (appName.isEmpty()) return "خطا: پارامتر app_name لازم است.";
                return openAppByName(context, appName);
            }
        });
    }

    private static String errNoService() {
        return "خطا: سرویس Accessibility فعال نیست. از دکمه «فعال‌کردن کنترل گوشی» آن را روشن کنید.";
    }

    /** جستجوی ساده بین برنامه‌های نصب‌شده بر اساس بخشی از نام (case-insensitive). */
    private static String openAppByName(Context context, String appName) {
        PackageManager pm = context.getPackageManager();
        String query = appName.trim().toLowerCase();
        for (android.content.pm.ApplicationInfo appInfo : pm.getInstalledApplications(PackageManager.GET_META_DATA)) {
            String label = pm.getApplicationLabel(appInfo).toString();
            if (label.toLowerCase().contains(query)) {
                Intent launchIntent = pm.getLaunchIntentForPackage(appInfo.packageName);
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(launchIntent);
                    return "برنامه «" + label + "» باز شد.";
                }
            }
        }
        return "برنامه‌ای با نام «" + appName + "» پیدا نشد.";
    }
}
