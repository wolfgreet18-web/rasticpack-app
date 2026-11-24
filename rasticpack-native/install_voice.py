#!/usr/bin/env python3
"""پلاگین Capacitor «RpVoice»: تشخیص گفتار فارسی کاملاً آفلاین با Vosk (SpeechService + گرامر محدود به اعداد)."""
import re, sys, pathlib
main = pathlib.Path('android/app/src/main')
acts = list((main / 'java').rglob('MainActivity.java'))
if not acts: sys.exit('MainActivity.java پیدا نشد.')
act = acts[0]; txt = act.read_text(encoding='utf-8')
pkg = re.search(r'^\s*package\s+([\w.]+);', txt, re.M).group(1)

PLUGIN = '''package @@PKG@@;

import android.Manifest;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;
import java.io.InputStream;

@CapacitorPlugin(name = "RpVoice", permissions = {
    @Permission(alias = "mic", strings = { Manifest.permission.RECORD_AUDIO })
})
public class RpVoicePlugin extends Plugin implements RecognitionListener {
    private Model model;
    private SpeechService svc;
    private boolean loading = false;
    private volatile String partial = "";
    private volatile String finalText = null;
    private volatile String error = null;
    private volatile boolean listening = false;

    private String grammar() {
        try {
            InputStream in = getContext().getAssets().open("voice_grammar.json");
            byte[] b = new byte[in.available()]; in.read(b); in.close();
            String s = new String(b, "UTF-8").trim();
            return s.isEmpty() ? null : s;
        } catch (Throwable t) { return null; }
    }

    @PluginMethod
    public void prepare(final PluginCall call) {
        if (model != null) { JSObject o = new JSObject(); o.put("ready", true); call.resolve(o); return; }
        if (loading) { call.reject("مدل در حال آماده‌سازی است؛ چند ثانیه صبر کن."); return; }
        loading = true;
        StorageService.unpack(getContext(), "model-fa", "model",
            new StorageService.Callback<Model>() {
                @Override public void onComplete(Model m) { model = m; loading = false; JSObject o = new JSObject(); o.put("ready", true); call.resolve(o); }
            },
            new StorageService.Callback<java.io.IOException>() {
                @Override public void onComplete(java.io.IOException e) { loading = false; call.reject("آماده‌سازی مدل صدا ناموفق بود: " + e.getMessage()); }
            });
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) { requestPermissionForAlias("mic", call, "micCb"); return; }
        doStart(call);
    }

    @PermissionCallback
    private void micCb(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) { call.reject("اجازه‌ی میکروفون داده نشد."); return; }
        doStart(call);
    }

    private void doStart(PluginCall call) {
        if (model == null) { call.reject("مدل صدا هنوز آماده نیست."); return; }
        try {
            killService();
            partial = ""; finalText = null; error = null;
            String g = grammar();
            Recognizer rec = (g != null) ? new Recognizer(model, 16000.0f, g) : new Recognizer(model, 16000.0f);
            svc = new SpeechService(rec, 16000.0f);
            listening = svc.startListening(this, 20000);
            if (!listening) { call.reject("شروع ضبط ممکن نشد (میکروفون در دسترس نیست)."); return; }
            call.resolve();
        } catch (Throwable t) { call.reject("خطا در شروع ضبط: " + t.getMessage()); }
    }

    private void killService() {
        try { if (svc != null) { svc.stop(); svc.shutdown(); } } catch (Throwable ignored) {}
        svc = null; listening = false;
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try { if (svc != null && listening) svc.stop(); } catch (Throwable ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        killService(); finalText = null; partial = "";
        call.resolve();
    }

    @PluginMethod
    public void poll(PluginCall call) {
        JSObject o = new JSObject();
        o.put("partial", partial);
        o.put("done", finalText != null);
        o.put("text", finalText == null ? "" : finalText);
        o.put("error", error == null ? "" : error);
        call.resolve(o);
    }

    private static String field(String json, String key) {
        try { return new JSONObject(json).optString(key, ""); } catch (Throwable t) { return ""; }
    }

    private void finish(String text) {
        if (finalText != null) return;
        finalText = text == null ? "" : text.trim();
        listening = false;
        final SpeechService s = svc; svc = null;
        new Thread(new Runnable() { @Override public void run() { try { if (s != null) { s.stop(); s.shutdown(); } } catch (Throwable ignored) {} } }).start();
    }

    @Override public void onPartialResult(String h) { partial = field(h, "partial"); }
    @Override public void onResult(String h) { String t = field(h, "text"); if (!t.trim().isEmpty()) finish(t); }
    @Override public void onFinalResult(String h) { if (finalText == null) finish(field(h, "text")); }
    @Override public void onError(Exception e) { error = e == null ? "خطا" : String.valueOf(e.getMessage()); finish(""); }
    @Override public void onTimeout() { finish(partial); }
}
'''
(act.parent / 'RpVoicePlugin.java').write_text(PLUGIN.replace('@@PKG@@', pkg), encoding='utf-8')

mf = main / 'AndroidManifest.xml'
t = mf.read_text(encoding='utf-8')
if 'android.permission.RECORD_AUDIO"' not in t:
    t = t.replace('<application', '    <uses-permission android:name="android.permission.RECORD_AUDIO"/>\n    <application', 1)
mf.write_text(t, encoding='utf-8')

gr = pathlib.Path('android/app/build.gradle'); g = gr.read_text(encoding='utf-8')
if 'vosk-android' not in g:
    g, n = re.subn(r'dependencies\s*\{', "dependencies {\n    implementation 'net.java.dev.jna:jna:5.13.0@aar'\n    implementation 'com.alphacephei:vosk-android:0.3.47'", g, count=1)
    if not n: sys.exit('بلوک dependencies در build.gradle پیدا نشد.')
    gr.write_text(g, encoding='utf-8')

if 'RpVoicePlugin.class' not in txt:
    if 'registerPlugin(RpBioPlugin.class);' in txt:
        txt = txt.replace('registerPlugin(RpBioPlugin.class);', 'registerPlugin(RpBioPlugin.class);\n    registerPlugin(RpVoicePlugin.class);', 1)
    elif 'registerPlugin(RpSmsPlugin.class);' in txt:
        txt = txt.replace('registerPlugin(RpSmsPlugin.class);', 'registerPlugin(RpSmsPlugin.class);\n    registerPlugin(RpVoicePlugin.class);', 1)
    else:
        sys.exit('registerPlugin جا نیفتاد.')
    act.write_text(txt, encoding='utf-8')
print('voice plugin installed')
