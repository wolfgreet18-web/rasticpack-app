#!/usr/bin/env python3
"""نصب خودکار ویجت «قیمت‌دهی سریع» در پروژه‌ی Capacitor (اندروید).
اجرا: داخل پوشه‌ی اصلی پروژه (کنار capacitor.config و پوشه‌ی android)  ←  python install_widget.py
چند بار اجرا هم مشکلی ندارد."""
import re, sys, pathlib
root = pathlib.Path('.')
main = root / 'android/app/src/main'
if not main.exists():
    sys.exit('پوشه android/app/src/main پیدا نشد. اول «npx cap add android» را بزنید و اسکریپت را در پوشه‌ی اصلی پروژه اجرا کنید.')

appid = None
for f in ('capacitor.config.json', 'capacitor.config.ts', 'capacitor.config.js'):
    p = root / f
    if p.exists():
        m = re.search(r'appId["\']?\s*:\s*["\']([\w.]+)["\']', p.read_text(encoding='utf-8'))
        if m: appid = m.group(1); break
acts = list((main / 'java').rglob('MainActivity.java'))
if not acts:
    sys.exit('MainActivity.java پیدا نشد (اگر MainActivity.kt دارید خبر بدهید).')
act = acts[0]
txt = act.read_text(encoding='utf-8')
pkg = re.search(r'^\s*package\s+([\w.]+);', txt, re.M).group(1)
ns = appid or pkg
g = root / 'android/app/build.gradle'
if g.exists():
    m = re.search(r'namespace\s*=?\s*["\']([\w.]+)["\']', g.read_text(encoding='utf-8'))
    if m: ns = m.group(1)
jdir = act.parent

def w(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8'); print('نوشته شد:', path)

w(jdir / 'RestikWidgetPlugin.java', f'''package {pkg};

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RestikWidget")
public class RestikWidgetPlugin extends Plugin {{
  @PluginMethod
  public void update(PluginCall call) {{
    getContext().getSharedPreferences("restik_widget", 0).edit()
      .putBoolean("enabled", Boolean.TRUE.equals(call.getBoolean("enabled", false)))
      .putString("last", call.getString("last", "")).apply();
    QuickPriceWidget.refreshAll(getContext());
    call.resolve();
  }}

  @PluginMethod
  public void pin(PluginCall call) {{
    AppWidgetManager m = AppWidgetManager.getInstance(getContext());
    JSObject r = new JSObject();
    boolean ok = false;
    try {{
      ok = Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported()
        && m.requestPinAppWidget(new ComponentName(getContext(), QuickPriceWidget.class), null, null);
    }} catch (Exception e) {{ ok = false; }}
    r.put("requested", ok);
    call.resolve(r);
  }}
}}
''')

w(jdir / 'QuickPriceWidget.java', f'''package {pkg};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import {ns}.R;

public class QuickPriceWidget extends AppWidgetProvider {{
  @Override
  public void onUpdate(Context c, AppWidgetManager m, int[] ids) {{
    for (int id : ids) m.updateAppWidget(id, build(c));
  }}

  static RemoteViews build(Context c) {{
    SharedPreferences p = c.getSharedPreferences("restik_widget", 0);
    String last = p.getString("last", "");
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quick_price);
    v.setTextViewText(R.id.w_sub, last.isEmpty() ? "لمس برای قیمت‌دهی" : "آخرین: " + last);
    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("restikpack://quick"))
        .setPackage(c.getPackageName()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    v.setOnClickPendingIntent(R.id.w_root,
        PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    return v;
  }}

  static void refreshAll(Context c) {{
    AppWidgetManager m = AppWidgetManager.getInstance(c);
    for (int id : m.getAppWidgetIds(new ComponentName(c, QuickPriceWidget.class)))
      m.updateAppWidget(id, build(c));
  }}
}}
''')

res = main / 'res'
w(res / 'layout/widget_quick_price.xml', '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/w_root" android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="vertical" android:gravity="center" android:padding="10dp"
    android:background="@drawable/widget_bg">
  <TextView android:layout_width="wrap_content" android:layout_height="wrap_content"
      android:text="⚡ قیمت‌دهی سریع" android:textColor="#FFFFFF" android:textSize="15sp" android:textStyle="bold"/>
  <TextView android:id="@+id/w_sub" android:layout_width="wrap_content" android:layout_height="wrap_content"
      android:textColor="#FFE4E4" android:textSize="12sp" android:layout_marginTop="4dp"/>
</LinearLayout>
''')
w(res / 'drawable/widget_bg.xml', '''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#B91C1C"/><corners android:radius="18dp"/>
</shape>
''')
w(res / 'xml/quick_price_widget_info.xml', '''<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp" android:minHeight="60dp" android:targetCellWidth="3" android:targetCellHeight="1"
    android:updatePeriodMillis="0" android:initialLayout="@layout/widget_quick_price"
    android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"
    android:description="@string/app_name"/>
''')

mf = main / 'AndroidManifest.xml'
t = mf.read_text(encoding='utf-8')
if 'QuickPriceWidget' not in t:
    rec = '''
        <receiver android:name=".QuickPriceWidget" android:exported="true" android:label="قیمت‌دهی سریع">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/quick_price_widget_info"/>
        </receiver>
    '''
    t = t.replace('</application>', rec + '</application>', 1)
    print('receiver به Manifest اضافه شد')
if 'restikpack' not in t:
    flt = '''
            <intent-filter>
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <category android:name="android.intent.category.BROWSABLE"/>
                <data android:scheme="restikpack" android:host="quick"/>
            </intent-filter>
        '''
    t, n = re.subn(r'(<activity[^>]*MainActivity[^>]*>.*?)(</activity>)', lambda m: m.group(1) + flt + m.group(2), t, count=1, flags=re.S)
    print('intent-filter لینک اضافه شد' if n else 'هشدار: activity اصلی در Manifest پیدا نشد')
mf.write_text(t, encoding='utf-8')

if 'RestikWidgetPlugin.class' not in txt:
    if 'super.onCreate(' in txt:
        txt = txt.replace('super.onCreate(', 'registerPlugin(RestikWidgetPlugin.class);\n    super.onCreate(', 1)
    else:
        txt, n = re.subn(r'(class\s+MainActivity\s+extends\s+BridgeActivity\s*\{)',
            r'\1\n  @Override\n  public void onCreate(android.os.Bundle savedInstanceState) {\n    registerPlugin(RestikWidgetPlugin.class);\n    super.onCreate(savedInstanceState);\n  }\n', txt, count=1)
        if not n: sys.exit('ساختار MainActivity نامعمول است؛ خط registerPlugin(RestikWidgetPlugin.class); را قبل از super.onCreate دستی اضافه کنید.')
    act.write_text(txt, encoding='utf-8'); print('MainActivity اصلاح شد')

print('\nتمام. حالا: npm i @capacitor/app  ←  npx cap sync android  ←  برنامه را دوباره بسازید و نصب کنید.')
