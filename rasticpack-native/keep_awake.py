#!/usr/bin/env python3
"""صفحه‌ی گوشی تا وقتی برنامه باز است خاموش نشود (FLAG_KEEP_SCREEN_ON)."""
import sys, pathlib
main = pathlib.Path('android/app/src/main')
acts = list((main / 'java').rglob('MainActivity.java'))
if not acts: sys.exit('MainActivity.java پیدا نشد.')
act = acts[0]; txt = act.read_text(encoding='utf-8')
if 'FLAG_KEEP_SCREEN_ON' in txt: print('already'); sys.exit(0)
i = txt.rstrip().rfind('}')
add = '''
    @Override
    public void onResume() {
        super.onResume();
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
'''
txt = txt[:i] + add + txt[i:]
act.write_text(txt, encoding='utf-8'); print('keep-screen-on added')
