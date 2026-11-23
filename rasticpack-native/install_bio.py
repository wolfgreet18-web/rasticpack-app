#!/usr/bin/env python3
"""پلاگین Capacitor «RpBio»: باز کردن قفل برنامه با اثر انگشت/چهره (android.hardware.biometrics.BiometricPrompt، بدون کتابخانه‌ی اضافه)."""
import re, sys, pathlib
main = pathlib.Path('android/app/src/main')
acts = list((main / 'java').rglob('MainActivity.java'))
if not acts: sys.exit('MainActivity.java پیدا نشد.')
act = acts[0]; txt = act.read_text(encoding='utf-8')
pkg = re.search(r'^\s*package\s+([\w.]+);', txt, re.M).group(1)

PLUGIN = '''package @@PKG@@;

import android.content.Context;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RpBio")
public class RpBioPlugin extends Plugin {

    private boolean available() {
        if (Build.VERSION.SDK_INT < 29) return false;
        try {
            BiometricManager bm = (BiometricManager) getContext().getSystemService(Context.BIOMETRIC_SERVICE);
            return bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
        } catch (Throwable t) { return false; }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject o = new JSObject(); o.put("available", available()); call.resolve(o);
    }

    @PluginMethod
    public void authenticate(final PluginCall call) {
        if (!available()) { call.reject("اثر انگشت/چهره روی این گوشی تنظیم یا پشتیبانی نشده است."); return; }
        final String title = call.getString("title", "ورود به رستیک پک");
        final String cancel = call.getString("cancel", "استفاده از رمز");
        getActivity().runOnUiThread(new Runnable() {
            @Override public void run() {
                try {
                    BiometricPrompt bp = new BiometricPrompt.Builder(getContext())
                        .setTitle(title).setNegativeButton(cancel, getContext().getMainExecutor(),
                            new android.content.DialogInterface.OnClickListener() {
                                @Override public void onClick(android.content.DialogInterface d, int w) {
                                    JSObject o = new JSObject(); o.put("ok", false); call.resolve(o);
                                }
                            }).build();
                    bp.authenticate(new CancellationSignal(), getContext().getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                        @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) {
                            JSObject o = new JSObject(); o.put("ok", true); call.resolve(o);
                        }
                        @Override public void onAuthenticationError(int code, CharSequence msg) {
                            JSObject o = new JSObject(); o.put("ok", false); call.resolve(o);
                        }
                    });
                } catch (Throwable t) { call.reject("خطا در اثر انگشت: " + t.getMessage()); }
            }
        });
    }
}
'''
(act.parent / 'RpBioPlugin.java').write_text(PLUGIN.replace('@@PKG@@', pkg), encoding='utf-8')

mf = main / 'AndroidManifest.xml'
t = mf.read_text(encoding='utf-8')
if 'android.permission.USE_BIOMETRIC"' not in t:
    t = t.replace('<application', '    <uses-permission android:name="android.permission.USE_BIOMETRIC"/>\n    <application', 1)
mf.write_text(t, encoding='utf-8')

if 'RpBioPlugin.class' not in txt:
    if 'registerPlugin(RpSmsPlugin.class);' in txt:
        txt = txt.replace('registerPlugin(RpSmsPlugin.class);', 'registerPlugin(RpSmsPlugin.class);\n    registerPlugin(RpBioPlugin.class);', 1)
    elif 'super.onCreate(' in txt:
        txt = txt.replace('super.onCreate(', 'registerPlugin(RpBioPlugin.class);\n    super.onCreate(', 1)
    else:
        sys.exit('registerPlugin جا نیفتاد.')
    act.write_text(txt, encoding='utf-8')
print('bio plugin installed')
