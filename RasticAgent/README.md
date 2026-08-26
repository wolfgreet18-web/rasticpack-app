# Rastic Agent v1

نسخه اول یک Android Agent شخصی برای کنترل محدود و قابل‌ردیابی گوشی است.

## قابلیت‌های فعلی
- چت با مدل از طریق API سازگار با OpenAI Chat Completions
- خواندن متن/ساختار پنجره فعال با Accessibility
- click_text
- scroll_forward / scroll_backward
- back / home
- آماده برای اضافه‌کردن ابزارهای تست اپ کارتن‌سازی

## پیش‌نیاز ساخت
- JDK 17
- Gradle 9.5 (wrapper داخل پروژه)
- Android SDK Platform 36
- Android Gradle Plugin 9.3.1

## ساخت در Termux
```bash
pkg update
pkg install git openjdk-17
# Android SDK/Build Tools را نیز در محیط Termux خودت نصب/تنظیم کن.
git clone <YOUR_GITHUB_REPO>
cd RasticAgent
./gradlew assembleDebug
```
APK:
`app/build/outputs/apk/debug/app-debug.apk`

## راه‌اندازی
1. APK را نصب کن.
2. Rastic Agent را باز کن.
3. «فعال‌کردن کنترل گوشی» را بزن و Accessibility را برای Rastic Agent روشن کن.
4. «تنظیمات API» را باز کن و endpoint، API key و model را وارد کن.
5. آزمایش: `صفحه فعلی را بخوان` یا `اسکرول کن`.

## نکته امنیتی
API key داخل SharedPreferences ذخیره می‌شود؛ این نسخه برای استفاده شخصی/آزمایشی است. برای انتشار عمومی باید کلید از اپ خارج و از یک backend امن استفاده شود.

## معماری نسخه بعدی
- command loop چندمرحله‌ای با تأیید هر اقدام
- screenshot tool برای Android 11+
- اجرای تست روی RasticPack/Capacitor
- جمع‌آوری logcat/Performance
- ابزارهای مخصوص SQLite و CustomerRepo
- sandbox و allowlist ابزارها
