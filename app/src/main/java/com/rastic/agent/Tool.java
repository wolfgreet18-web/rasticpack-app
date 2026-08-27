package com.rastic.agent;

import org.json.JSONObject;

/**
 * پایه‌ی همه‌ی Toolهای Agent. هر Tool یک قابلیت مشخص روی گوشی است
 * (کلیک، اسکرول، بازکردن اپ و غیره). برای اضافه‌کردن Tool جدید در
 * آینده فقط کافیست این interface را پیاده‌سازی کنید و در
 * ToolRegistry ثبت کنید.
 */
public interface Tool {

    /** نام یکتای Tool که AI با همین اسم آن را صدا می‌زند. مثلاً "click_text" */
    String name();

    /** توضیح کوتاه برای این‌که AI بفهمد این Tool چه کاری انجام می‌دهد و چه پارامترهایی می‌گیرد. */
    String description();

    /** آیا اجرای این Tool قبل از انجام نیاز به تأیید دستی کاربر دارد؟ */
    boolean requiresConfirmation();

    /**
     * اجرای Tool با پارامترهای داده‌شده.
     * @param args پارامترهای JSON که AI برای این Tool فرستاده.
     * @return نتیجه‌ی اجرا به‌صورت متن قابل‌فهم برای AI (مثلاً "کلیک انجام شد" یا خطا).
     */
    String execute(JSONObject args) throws Exception;
}
