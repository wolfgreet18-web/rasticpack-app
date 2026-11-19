#!/usr/bin/env python3
"""نام «Rastic» و آیکن لوگو را در پروژه‌ی اندروید اعمال می‌کند (بعد از cap add android)."""
import os, re, shutil, glob
RES = "android/app/src/main/res"
here = os.path.dirname(os.path.abspath(__file__))
for d in glob.glob(os.path.join(here, "branding/res/mipmap-*")):
    dst = os.path.join(RES, os.path.basename(d)); os.makedirs(dst, exist_ok=True)
    for f in os.listdir(d): shutil.copy(os.path.join(d, f), os.path.join(dst, f))
os.makedirs(os.path.join(RES, "values"), exist_ok=True)
open(os.path.join(RES, "values/rastic_colors.xml"), "w").write('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="rastic_bg">#000000</color></resources>\n')
ad = os.path.join(RES, "mipmap-anydpi-v26"); os.makedirs(ad, exist_ok=True)
xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/rastic_bg"/>\n  <foreground android:drawable="@mipmap/rastic_fg"/>\n</adaptive-icon>\n'
for n in ("ic_launcher.xml", "ic_launcher_round.xml"): open(os.path.join(ad, n), "w").write(xml)
sp = os.path.join(RES, "values/strings.xml"); s = open(sp, encoding="utf-8").read()
s = re.sub(r'(<string name="app_name">)[^<]*(</string>)', r'\1​\2', s)
s = re.sub(r'(<string name="title_activity_main">)[^<]*(</string>)', r'\1​\2', s)
open(sp, "w", encoding="utf-8").write(s)
print("branding applied")

# صفحه‌ی شروع (splash) اندروید: حذف لوگو؛ فقط رنگ پس‌زمینه‌ی خود برنامه تا بدون پرش وارد برنامه شود
open(os.path.join(RES, "values/rastic_splash.xml"), "w").write('''<?xml version="1.0" encoding="utf-8"?>
<resources><color name="rastic_splash_bg">#f2efe8</color></resources>''')
stp = os.path.join(RES, "values/styles.xml"); st = open(stp, encoding="utf-8").read()
st = re.sub(r'<style name="AppTheme\.NoActionBarLaunch"[^>]*>.*?</style>',
  '<style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">\n        <item name="android:background">@color/rastic_splash_bg</item>\n        <item name="android:windowBackground">@color/rastic_splash_bg</item>\n    </style>', st, flags=re.S)
open(stp, "w", encoding="utf-8").write(st)
v31 = os.path.join(RES, "values-v31"); os.makedirs(v31, exist_ok=True)
open(os.path.join(v31, "rastic_splash.xml"), "w").write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
    <item name="android:background">@color/rastic_splash_bg</item>
    <item name="android:windowBackground">@color/rastic_splash_bg</item>
    <item name="android:windowSplashScreenBackground">@color/rastic_splash_bg</item>
    <item name="android:windowSplashScreenAnimatedIcon">@android:color/transparent</item>
    <item name="android:windowSplashScreenIconBackgroundColor">@color/rastic_splash_bg</item>
  </style>
</resources>''')
print("splash removed")
