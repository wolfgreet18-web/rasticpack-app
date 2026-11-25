#!/usr/bin/env python3
"""پلاگین «RpShare»: فایل (PDF پیش‌فاکتور) را مستقیم به روبیکا (یا لیست اشتراک‌گذاری) می‌فرستد؛ WebView اندروید navigator.share با فایل را ندارد."""
import re, sys, pathlib
main = pathlib.Path('android/app/src/main')
acts = list((main / 'java').rglob('MainActivity.java'))
if not acts: sys.exit('MainActivity.java پیدا نشد.')
act = acts[0]; txt = act.read_text(encoding='utf-8')
pkg = re.search(r'^\s*package\s+([\w.]+);', txt, re.M).group(1)
PLUGIN = '''package @@PKG@@;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "RpShare")
public class RpSharePlugin extends Plugin {

    @PluginMethod
    public void shareFile(PluginCall call) {
        try {
            String b64 = call.getString("base64", "");
            String raw = call.getString("name", "file.pdf"); StringBuilder nb = new StringBuilder();
            for (char ch : raw.toCharArray()) nb.append((Character.isLetterOrDigit(ch) || ".-_ ".indexOf(ch) >= 0) ? ch : '_');
            String name = nb.toString();
            String mime = call.getString("mime", "application/pdf");
            String pref = call.getString("package", "ir.resaneh1.iptv");
            if (b64 == null || b64.isEmpty()) { call.reject("فایل خالی است."); return; }
            Context c = getContext();
            File dir = new File(c.getCacheDir(), "shared"); dir.mkdirs();
            File f = new File(dir, name);
            FileOutputStream os = new FileOutputStream(f);
            os.write(Base64.decode(b64, Base64.DEFAULT)); os.close();
            Uri uri = FileProvider.getUriForFile(c, c.getPackageName() + ".fileprovider", f);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            boolean direct = false;
            if (pref != null && !pref.isEmpty() && c.getPackageManager().getLaunchIntentForPackage(pref) != null) {
                Intent d = new Intent(send); d.setPackage(pref); d.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { c.startActivity(d); direct = true; } catch (ActivityNotFoundException e) { direct = false; }
            }
            if (!direct) {
                Intent ch = Intent.createChooser(send, "ارسال پیش‌فاکتور");
                ch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(ch);
            }
            JSObject o = new JSObject(); o.put("direct", direct); call.resolve(o);
        } catch (Throwable t) { call.reject("ارسال فایل ناموفق بود: " + t.getMessage()); }
    }
}
'''
(act.parent / 'RpSharePlugin.java').write_text(PLUGIN.replace('@@PKG@@', pkg), encoding='utf-8')
if 'RpSharePlugin.class' not in txt:
    for anchor in ('registerPlugin(RpVoicePlugin.class);', 'registerPlugin(RpBioPlugin.class);', 'registerPlugin(RpSmsPlugin.class);'):
        if anchor in txt:
            txt = txt.replace(anchor, anchor + '\n    registerPlugin(RpSharePlugin.class);', 1); break
    else: sys.exit('registerPlugin جا نیفتاد.')
    act.write_text(txt, encoding='utf-8')
# بسته‌ی روبیکا برای دیده شدن توسط getLaunchIntentForPackage (اندروید ۱۱+)
mf = main / 'AndroidManifest.xml'; t = mf.read_text(encoding='utf-8')
if 'ir.resaneh1.iptv' not in t:
    t = t.replace('<application', '    <queries><package android:name="ir.resaneh1.iptv"/></queries>\n    <application', 1)
    mf.write_text(t, encoding='utf-8')
print('share plugin installed')
