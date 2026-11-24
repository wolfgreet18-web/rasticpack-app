#!/usr/bin/env python3
"""آزمون دودی (غیرمتوقف‌کننده): با گفتار مصنوعی espeak جمله‌ی نمونه را با همان مدل و گرامر تشخیص می‌دهد و در لاگ می‌نویسد."""
import json, subprocess, wave, pathlib, sys
try:
    from vosk import Model, KaldiRecognizer, SetLogLevel
except Exception as e:
    print('vosk نصب نشد:', e); sys.exit(0)
SetLogLevel(-1)
a = pathlib.Path('android/app/src/main/assets')
model = Model(str(a / 'model-fa')); grammar = (a / 'voice_grammar.json').read_text(encoding='utf-8')
for sent in ['سی در بیست در پانزده صد تا', 'چهل و پنج در سی در بیست تعداد دویست', 'پنجاه در چهل در سی هزار و پانصد تا']:
    subprocess.run(['espeak-ng', '-v', 'fa', '-s', '120', '-w', '/tmp/t.wav', sent], check=False)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', '/tmp/t.wav', '-ar', '16000', '-ac', '1', '/tmp/t16.wav'], check=False)
    try:
        w = wave.open('/tmp/t16.wav'); data = w.readframes(w.getnframes())
        for label, g in (('با گرامر', grammar), ('بدون گرامر', None)):
            r = KaldiRecognizer(model, 16000, g) if g else KaldiRecognizer(model, 16000)
            r.AcceptWaveform(data); print(f'[{label}] گفته‌شده: {sent} ⟵ شنیده‌شده:', json.loads(r.FinalResult()).get('text'))
    except Exception as e:
        print('آزمون این جمله ممکن نشد:', e)
