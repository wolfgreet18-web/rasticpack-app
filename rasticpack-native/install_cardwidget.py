#!/usr/bin/env python3
"""نصب «ویجت شماره کارت» (دکمه‌ی 💳 صفحه‌ی هوم که متن را کپی می‌کند). بعد از install_widget.py اجرا شود."""
import re, sys, pathlib
root = pathlib.Path('.'); main = root / 'android/app/src/main'
if not main.exists(): sys.exit('android/app/src/main پیدا نشد.')
acts = list((main / 'java').rglob('MainActivity.java'))
if not acts: sys.exit('MainActivity.java پیدا نشد.')
act = acts[0]; txt = act.read_text(encoding='utf-8')
pkg = re.search(r'^\s*package\s+([\w.]+);', txt, re.M).group(1)
ns = pkg
g = root / 'android/app/build.gradle'
if g.exists():
    m = re.search(r'namespace\s*=?\s*["\']([\w.]+)["\']', g.read_text(encoding='utf-8'))
    if m: ns = m.group(1)
jdir = act.parent
sub = lambda s: s.replace('@@PKG@@', pkg).replace('@@NS@@', ns)
def w(p, c):
    p.parent.mkdir(parents=True, exist_ok=True); p.write_text(c, encoding='utf-8'); print('نوشته شد:', p)

PLUGIN = '''package @@PKG@@;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CardWidget")
public class CardWidgetPlugin extends Plugin {
  @PluginMethod
  public void save(PluginCall call) {
    String t = call.getString("text");
    String af = call.getString("after");
    SharedPreferences.Editor e = getContext().getSharedPreferences(CardCopyActivity.PREFS, 0).edit();
    if (t != null) e.putString("text", t);
    if (af != null) e.putString("after", af);
    e.apply();
    call.resolve();
  }

  @PluginMethod
  public void pin(PluginCall call) {
    JSObject r = new JSObject();
    boolean ok = false;
    try {
      AppWidgetManager m = AppWidgetManager.getInstance(getContext());
      ok = Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported()
          && m.requestPinAppWidget(new ComponentName(getContext(), CardWidget.class), null, null);
    } catch (Exception ex) { ok = false; }
    r.put("requested", ok);
    call.resolve(r);
  }
}
'''
WIDGET = '''package @@PKG@@;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import @@NS@@.R;

public class CardWidget extends AppWidgetProvider {
  @Override
  public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
    for (int id : ids) {
      RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_card);
      Intent i = new Intent(c, CardCopyActivity.class);
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
      int fl = PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
      v.setOnClickPendingIntent(R.id.card_root, PendingIntent.getActivity(c, 7, i, fl));
      m.updateAppWidget(id, v);
    }
  }
}
'''
ACTIVITY = '''package @@PKG@@;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

/** پنجره‌ی نامرئی: متن را کپی می‌کند، پیام کوتاه نشان می‌دهد و بسته می‌شود. */
public class CardCopyActivity extends Activity {
  static final String PREFS = "restik_card";
  static final String DEFAULT = "شماره کارت:\\n6219861427686307\\nشماره شبا:\\nIR620560611828005375757801\\nعلیرضا پهلولن هاشمی";

  @Override
  protected void onCreate(Bundle b) {
    super.onCreate(b);
    try {
      String t = getSharedPreferences(PREFS, 0).getString("text", DEFAULT);
      ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
      cm.setPrimaryClip(ClipData.newPlainText("card", t));
      Toast.makeText(this, "✅ کپی شد", Toast.LENGTH_SHORT).show();
      String af = getSharedPreferences(PREFS, 0).getString("after", "none");
      Intent go = null;
      if ("tel".equals(af)) {
        go = new Intent(Intent.ACTION_DIAL);
      } else if ("sms".equals(af)) {
        go = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MESSAGING);
      }
      if (go != null) {
        go.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(go); } catch (Throwable ex) { Toast.makeText(this, "برنامه‌ی مقصد باز نشد", Toast.LENGTH_SHORT).show(); }
      }
    } catch (Throwable e) {
      Toast.makeText(this, "کپی نشد", Toast.LENGTH_SHORT).show();
    }
    finish();
    overridePendingTransition(0, 0);
  }
}
'''
LAYOUT = '''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/card_root" android:layout_width="match_parent" android:layout_height="match_parent"
    android:background="@android:color/transparent">
  <ImageView android:layout_width="match_parent" android:layout_height="match_parent"
      android:src="@drawable/blu_card" android:scaleType="fitCenter" android:padding="16dp"
      android:contentDescription="کپی"/>
</FrameLayout>
'''
BG = '''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#FFFFFF"/><corners android:radius="22dp"/><stroke android:width="1dp" android:color="#E6E0D4"/></shape>
'''
INFO = '''<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="56dp" android:minHeight="56dp" android:targetCellWidth="1" android:targetCellHeight="1"
    android:updatePeriodMillis="0" android:initialLayout="@layout/widget_card"
    android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"/>
'''
w(jdir / 'CardWidgetPlugin.java', sub(PLUGIN))
w(jdir / 'CardWidget.java', sub(WIDGET))
w(jdir / 'CardCopyActivity.java', sub(ACTIVITY))
res = main / 'res'
w(res / 'layout/widget_card.xml', LAYOUT)
png = root / 'branding/blu_card.png'
if png.exists():
    dst = res / 'drawable-nodpi/blu_card.png'; dst.parent.mkdir(parents=True, exist_ok=True); dst.write_bytes(png.read_bytes()); print('نوشته شد:', dst)
else:
    sys.exit('branding/blu_card.png پیدا نشد')
w(res / 'xml/card_widget_info.xml', INFO)

mf = main / 'AndroidManifest.xml'; t = mf.read_text(encoding='utf-8')
if '.CardWidget"' not in t:
    t = t.replace('</application>', '''
        <receiver android:name=".CardWidget" android:exported="true" android:label="شماره کارت">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/card_widget_info"/>
        </receiver>
        <activity android:name=".CardCopyActivity" android:exported="false" android:theme="@android:style/Theme.Translucent.NoTitleBar"
            android:excludeFromRecents="true" android:taskAffinity="" android:noHistory="true"/>
    </application>''', 1)
    mf.write_text(t, encoding='utf-8'); print('Manifest به‌روز شد')

txt = act.read_text(encoding='utf-8')
if 'CardWidgetPlugin.class' not in txt:
    if 'registerPlugin(RestikWidgetPlugin.class);' in txt:
        txt = txt.replace('registerPlugin(RestikWidgetPlugin.class);', 'registerPlugin(RestikWidgetPlugin.class);\n    registerPlugin(CardWidgetPlugin.class);', 1)
    elif 'super.onCreate(' in txt:
        txt = txt.replace('super.onCreate(', 'registerPlugin(CardWidgetPlugin.class);\n    super.onCreate(', 1)
    else:
        sys.exit('MainActivity نامعمول است.')
    act.write_text(txt, encoding='utf-8'); print('MainActivity اصلاح شد')
