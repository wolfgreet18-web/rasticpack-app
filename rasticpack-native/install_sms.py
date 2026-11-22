#!/usr/bin/env python3
"""دریافت پیامک مشتری (RECEIVE_SMS) + اعلان + ارسال پیامک پاسخ (SEND_SMS) — پلاگین Capacitor «RpSms»."""
import re, sys, pathlib
main = pathlib.Path('android/app/src/main')
acts = list((main / 'java').rglob('MainActivity.java'))
if not acts: sys.exit('MainActivity.java پیدا نشد.')
act = acts[0]; txt = act.read_text(encoding='utf-8')
pkg = re.search(r'^\s*package\s+([\w.]+);', txt, re.M).group(1)
jdir = act.parent

RECEIVER = '''package @@PKG@@;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

public class RpSmsReceiver extends BroadcastReceiver {
    static final String PREFS = "rp_sms";
    static final String KEY = "pending";
    static final String CH = "rp_sms_ch";
    private static final Pattern NUM = Pattern.compile("[0-9]+");

    static String digits(String s) {
        StringBuilder b = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c >= '\\u06F0' && c <= '\\u06F9') b.append((char) ('0' + (c - '\\u06F0')));
            else if (c >= '\\u0660' && c <= '\\u0669') b.append((char) ('0' + (c - '\\u0660')));
            else b.append(c);
        }
        return b.toString();
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        if (!ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", true)) return;
        try {
            SmsMessage[] msgs = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (msgs == null || msgs.length == 0) return;
            Map<String, StringBuilder> bySender = new LinkedHashMap<>();
            long t = System.currentTimeMillis();
            for (SmsMessage m : msgs) {
                String from = m.getOriginatingAddress() == null ? "" : m.getOriginatingAddress();
                StringBuilder sb = bySender.get(from);
                if (sb == null) { sb = new StringBuilder(); bySender.put(from, sb); }
                sb.append(m.getMessageBody() == null ? "" : m.getMessageBody());
            }
            for (Map.Entry<String, StringBuilder> e : bySender.entrySet()) {
                String body = e.getValue().toString();
                /* فقط پیامی که حداقل سه عدد دارد (احتمال ابعاد) ذخیره/اعلان می‌شود */
                int cnt = 0;
                java.util.regex.Matcher mm = NUM.matcher(digits(body));
                while (mm.find()) cnt++;
                if (cnt < 3) continue;
                save(ctx, e.getKey(), body, t);
                notifyUser(ctx, e.getKey(), body);
            }
        } catch (Throwable ignored) { }
    }

    static synchronized void save(Context ctx, String from, String body, long t) throws Exception {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray old = new JSONArray(sp.getString(KEY, "[]"));
        JSONArray arr = new JSONArray();
        JSONObject o = new JSONObject();
        o.put("id", t + "_" + Math.abs((from + body).hashCode()));
        o.put("sender", from); o.put("body", body); o.put("time", t);
        arr.put(o);
        for (int i = 0; i < old.length() && arr.length() < 30; i++) arr.put(old.get(i));
        sp.edit().putString(KEY, arr.toString()).apply();
    }

    static void notifyUser(Context ctx, String from, String body) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CH, "پیامک مشتری", NotificationManager.IMPORTANCE_HIGH));
        }
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open == null) return;
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(ctx, 7731, open, fl);
        android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26
            ? new android.app.Notification.Builder(ctx, CH) : new android.app.Notification.Builder(ctx);
        b.setSmallIcon(ctx.getApplicationInfo().icon)
         .setContentTitle("پیامک مشتری: " + from)
         .setContentText(body)
         .setStyle(new android.app.Notification.BigTextStyle().bigText(body + "\\n\\n(برای محاسبه‌ی قیمت لمس کنید)"))
         .setContentIntent(pi).setAutoCancel(true);
        nm.notify((int) (System.currentTimeMillis() % 100000), b.build());
    }
}
'''

PLUGIN = '''package @@PKG@@;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.telephony.SmsManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;

@CapacitorPlugin(name = "RpSms", permissions = {
    @Permission(alias = "sms", strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.SEND_SMS })
})
public class RpSmsPlugin extends Plugin {

    private boolean notifGranted() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return getContext().checkSelfPermission("android.permission.POST_NOTIFICATIONS") == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    private JSObject state() {
        JSObject o = new JSObject();
        o.put("sms", getPermissionState("sms") == PermissionState.GRANTED);
        o.put("notif", notifGranted());
        return o;
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        getContext().getSharedPreferences(RpSmsReceiver.PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", on).apply();
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) { call.resolve(state()); }

    @PluginMethod
    public void requestPerms(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && !notifGranted() && getActivity() != null) {
            getActivity().requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7732);
        }
        if (getPermissionState("sms") == PermissionState.GRANTED) { call.resolve(state()); return; }
        requestPermissionForAlias("sms", call, "permCb");
    }

    @PermissionCallback
    private void permCb(PluginCall call) { call.resolve(state()); }

    @PluginMethod
    public void getPending(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences(RpSmsReceiver.PREFS, Context.MODE_PRIVATE);
            JSONArray a = new JSONArray(sp.getString(RpSmsReceiver.KEY, "[]"));
            JSObject o = new JSObject();
            o.put("items", new JSArray(a.toString()));
            call.resolve(o);
        } catch (Exception e) { call.reject("خواندن پیامک‌ها ناموفق بود: " + e.getMessage()); }
    }

    @PluginMethod
    public void removePending(PluginCall call) {
        try {
            String id = call.getString("id", "");
            SharedPreferences sp = getContext().getSharedPreferences(RpSmsReceiver.PREFS, Context.MODE_PRIVATE);
            synchronized (RpSmsReceiver.class) {
                JSONArray a = new JSONArray(sp.getString(RpSmsReceiver.KEY, "[]"));
                JSONArray n = new JSONArray();
                for (int i = 0; i < a.length(); i++) {
                    JSONObject it = a.getJSONObject(i);
                    if (!id.equals(it.optString("id"))) n.put(it);
                }
                sp.edit().putString(RpSmsReceiver.KEY, n.toString()).apply();
            }
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        String to = call.getString("to", "");
        String text = call.getString("text", "");
        if (to == null || to.trim().isEmpty() || text == null || text.trim().isEmpty()) { call.reject("شماره یا متن خالی است."); return; }
        if (getPermissionState("sms") != PermissionState.GRANTED) { call.reject("اجازه‌ی ارسال پیامک داده نشده است."); return; }
        try {
            SmsManager sm = Build.VERSION.SDK_INT >= 31 ? getContext().getSystemService(SmsManager.class) : SmsManager.getDefault();
            ArrayList<String> parts = sm.divideMessage(text);
            if (parts.size() > 1) sm.sendMultipartTextMessage(to.trim(), null, parts, null, null);
            else sm.sendTextMessage(to.trim(), null, text, null, null);
            JSObject o = new JSObject(); o.put("parts", parts.size());
            call.resolve(o);
        } catch (Throwable e) { call.reject("ارسال پیامک ناموفق بود: " + e.getMessage()); }
    }
}
'''
def w(p, s):
    p.write_text(s.replace('@@PKG@@', pkg), encoding='utf-8'); print('نوشته شد:', p)
w(jdir / 'RpSmsReceiver.java', RECEIVER)
w(jdir / 'RpSmsPlugin.java', PLUGIN)

mf = main / 'AndroidManifest.xml'
t = mf.read_text(encoding='utf-8')
perms = ''
for p in ('RECEIVE_SMS', 'SEND_SMS', 'POST_NOTIFICATIONS'):
    if f'android.permission.{p}"' not in t:
        perms += f'    <uses-permission android:name="android.permission.{p}"/>\n'
if perms:
    t = t.replace('<application', perms + '    <application', 1)
if 'RpSmsReceiver' not in t:
    rec = '''
        <receiver android:name=".RpSmsReceiver" android:exported="true" android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999"><action android:name="android.provider.Telephony.SMS_RECEIVED"/></intent-filter>
        </receiver>
    '''
    t = t.replace('</application>', rec + '</application>', 1)
mf.write_text(t, encoding='utf-8')

if 'RpSmsPlugin.class' not in txt:
    if 'super.onCreate(' in txt:
        txt = txt.replace('super.onCreate(', 'registerPlugin(RpSmsPlugin.class);\n    super.onCreate(', 1)
    else:
        txt, n = re.subn(r'(class\s+MainActivity\s+extends\s+BridgeActivity\s*\{)',
            r'\1\n  @Override\n  public void onCreate(android.os.Bundle savedInstanceState) {\n    registerPlugin(RpSmsPlugin.class);\n    super.onCreate(savedInstanceState);\n  }\n', txt, count=1)
        if not n: sys.exit('ساختار MainActivity نامعمول است.')
    act.write_text(txt, encoding='utf-8'); print('MainActivity اصلاح شد')
print('SMS plugin installed')
