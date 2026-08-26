# Rastic AI Agent

نسخه اول یک AI Agent شخصی برای Android که به یک مدل هوش مصنوعی
(سازگار با OpenAI Chat Completions API — یعنی GPT، یا Claude/Gemini
از طریق یک proxy سازگار) وصل می‌شود و می‌تواند با اجازه‌ی کاربر
صفحه‌ی گوشی را بخواند و روی آن اکشن انجام دهد.

## معماری

```
User → Rastic AI Agent (MainActivity + AgentCore)
     → AI Model (قابل تعویض از تنظیمات: endpoint / key / model)
     → ToolRegistry → Tool ها (click, scroll, back, home, open_app, read_screen)
     → AgentAccessibilityService → Android
```

- **Tool-based**: AI هرگز کد اجرا نمی‌کند؛ فقط می‌تواند یکی از Toolهای
  ثبت‌شده در `ToolRegistry` را با نام صدا بزند. اضافه‌کردن Tool جدید
  یعنی پیاده‌سازی interface `Tool` و ثبت آن در `BuiltinTools`.
- **چرخه‌ی Agent** در `AgentCore`: پیام کاربر → AI → انتخاب Tool →
  اجرا → نتیجه به AI → ادامه یا پاسخ نهایی (حداکثر ۶ مرحله در v1).

## قابلیت‌های نسخه اول (v1)

- رابط چت ساده
- تنظیم Endpoint / API Key / Model از داخل اپ
- Tool: `read_screen` — خواندن متن صفحه فعلی
- Tool: `click_text` — کلیک روی عنصر بر اساس متن
- Tool: `scroll_forward` / `scroll_backward`
- Tool: `back` / `home`
- Tool: `open_app` — بازکردن یک برنامه با نام

## قابلیت‌های نسخه‌های بعدی (در معماری جا گذاشته شده)

- Screenshot
- حالت تأیید قبل از Actionهای حساس
- تاریخچه‌ی کامل مکالمه (function calling واقعی)
- Toolهای اختصاصی برای دیباگ اپ Capacitor (خواندن فایل، SQLite، لاگ، Performance)

## پیش‌نیاز Build در Termux

```bash
pkg update && pkg upgrade -y
pkg install git openjdk-17 -y
```

برای build کامل به Android SDK نیاز است. اگر SDK را در Termux نصب
نکرده‌اید، ساده‌ترین راه استفاده از **GitHub Actions** است (پایین
توضیح داده شده) که build را در سرورهای گیت‌هاب انجام می‌دهد و فقط
باید کد را push کنید — نیازی به SDK روی گوشی نیست.

## Build با GitHub Actions (پیشنهادی، چون فقط گوشی دارید)

۱. یک repo در گیت‌هاب بسازید و این پروژه را push کنید:

```bash
cd RasticAIAgent
git init
git add .
git commit -m "Initial commit: Rastic AI Agent v1"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

۲. فایل `.github/workflows/build-apk.yml` را اضافه کنید (اگر ندارید
بخواهید بسازیم) تا با هر push به‌صورت خودکار APK بسازد.

۳. بعد از اتمام Action، از تب **Actions → آخرین اجرا → Artifacts**
فایل APK را دانلود کنید.

## نصب APK روی گوشی

۱. فایل APK را روی گوشی دانلود کنید.
۲. اجازه‌ی «نصب از منابع ناشناس» را برای مرورگر/فایل‌منیجر بدهید.
۳. روی فایل APK بزنید و نصب کنید.

## راه‌اندازی اولیه

۱. اپ Rastic AI Agent را باز کنید.
۲. «تنظیمات API» را بزنید و Endpoint، API Key و Model را وارد کنید.
۳. «فعال‌کردن کنترل گوشی» را بزنید و در تنظیمات Accessibility، سرویس
   Rastic AI Agent را روشن کنید.
۴. برگردید به اپ؛ باید بالای صفحه «وضعیت سرویس: فعال ✅» را ببینید.

## تست مرحله اول

در چت بنویسید:

```
Chrome را باز کن
```

یا:

```
صفحه فعلی را بخوان
```

Agent باید Tool مناسب (`open_app` یا `read_screen`) را انتخاب و اجرا
کند و نتیجه را در چت نشان دهد.

## نکته امنیتی

- API Key فقط در `SharedPreferences` روی خود گوشی ذخیره می‌شود و در
  کد یا Git commit نیست.
- `.gitignore` باید فایل‌های حساس محلی (در صورت اضافه‌شدن در آینده،
  مثل فایل‌های کانفیگ محلی) را کنار بگذارد.
- این نسخه برای استفاده شخصی طراحی شده؛ هیچ Login یا چند-کاربری ندارد.
