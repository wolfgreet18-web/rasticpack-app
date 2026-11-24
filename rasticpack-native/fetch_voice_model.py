#!/usr/bin/env python3
"""مدل آفلاین فارسی Vosk را می‌گیرد، داخل assets می‌گذارد و گرامر محدود (اعداد/در/تا/...) را از واژگان همان مدل می‌سازد."""
import sys, os, json, zipfile, shutil, uuid, urllib.request, pathlib
ASSETS = pathlib.Path('android/app/src/main/assets'); ASSETS.mkdir(parents=True, exist_ok=True)
URLS = ['https://alphacephei.com/vosk/models/vosk-model-small-fa-0.5.zip',
        'https://huggingface.co/rhasspy/vosk-models/resolve/main/fa/vosk-model-small-fa-0.5.zip',
        'https://alphacephei.com/vosk/models/vosk-model-small-fa-0.42.zip']
zp = pathlib.Path('/tmp/vosk-fa.zip')
for u in URLS:
    try:
        print('دانلود', u); urllib.request.urlretrieve(u, zp)
        if zp.stat().st_size > 10_000_000: break
    except Exception as e: print('ناموفق:', e)
else: sys.exit('✗ دانلود مدل فارسی ناموفق بود.')
tmp = pathlib.Path('/tmp/vosk-fa'); shutil.rmtree(tmp, ignore_errors=True)
with zipfile.ZipFile(zp) as z: z.extractall(tmp)
root = next(p for p in tmp.iterdir() if p.is_dir())
dst = ASSETS / 'model-fa'; shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(root, dst)
(dst / 'uuid').write_text(str(uuid.uuid4()))
print('✓ مدل کپی شد:', sum(f.stat().st_size for f in dst.rglob('*') if f.is_file()) // 1048576, 'MB')

words = set()
for cand in ['graph/words.txt', 'words.txt', 'am/words.txt']:
    f = dst / cand
    if f.exists():
        for line in f.read_text(encoding='utf-8', errors='ignore').splitlines():
            w = line.split(' ')[0].strip()
            if w: words.add(w)
        print('واژگان از', cand, ':', len(words)); break
WANT = """صفر یک دو سه چهار پنج شش شیش هفت هشت نه ده یازده دوازده سیزده چهارده چارده پانزده پونزده شانزده شونزده
هفده هیجده هجده نوزده بیست سی چهل پنجاه شصت هفتاد هشتاد نود صد یکصد دویست سیصد چهارصد پانصد پونصد ششصد شیشصد
هفتصد هشتصد نهصد هزار و در ضرب ضربدر ایکس بر تا عدد تعداد کارتن جعبه طول عرض ارتفاع قد""".split()
if words:
    have = [w for w in WANT if w in words]; miss = [w for w in WANT if w not in words]
    print('✓ کلمات موجود در مدل:', len(have), '| ✗ کلمات غایب:', ' '.join(miss) or '—')
else:
    have = WANT; print('! فهرست واژگان مدل پیدا نشد؛ گرامر کامل نوشته شد.')
(ASSETS / 'voice_grammar.json').write_text(json.dumps(have + ['[unk]'], ensure_ascii=False), encoding='utf-8')
print('گرامر نوشته شد:', len(have), 'کلمه')
