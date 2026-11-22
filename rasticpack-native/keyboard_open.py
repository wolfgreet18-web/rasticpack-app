#!/usr/bin/env python3
"""باز شدن خودکار کیبورد روی چارت طول، هنگام اولین باز شدن برنامه (WebView بدون لمس کاربر کیبورد را باز نمی‌کند)."""
import sys, pathlib
main = pathlib.Path('android/app/src/main')
acts = list((main / 'java').rglob('MainActivity.java'))
if not acts: sys.exit('MainActivity.java پیدا نشد.')
act = acts[0]; txt = act.read_text(encoding='utf-8')
if 'rpKbDone' in txt: print('already'); sys.exit(0)
i = txt.rstrip().rfind('}')
add = '''
    private boolean rpKbDone = false;
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus || rpKbDone) return;
        rpKbDone = true;
        final int[] delays = {1500, 2600};
        for (final int d : delays) {
            getWindow().getDecorView().postDelayed(new Runnable() {
                @Override public void run() {
                    try {
                        final android.webkit.WebView wv = getBridge().getWebView();
                        wv.requestFocus();
                        wv.evaluateJavascript("(function(){var e=document.getElementById('c2-length-1');if(e&&!document.getElementById('rp-sms-modal')){e.focus();}})()", null);
                        android.view.inputmethod.InputMethodManager imm = (android.view.inputmethod.InputMethodManager) getSystemService(android.content.Context.INPUT_METHOD_SERVICE);
                        if (imm != null) imm.showSoftInput(wv, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);
                    } catch (Throwable t) { }
                }
            }, d);
        }
    }
'''
txt = txt[:i] + add + txt[i:]
act.write_text(txt, encoding='utf-8'); print('keyboard auto-open added')
