#!/usr/bin/env python3
"""Build the ocr-assets JSON (gzip+base64) from ../ocr-assets. usage: make_ocr_assets.py [--eng] -> prints JSON to stdout"""
import base64, gzip, json, os, sys
d=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','ocr-assets')
def gz(name): return base64.b64encode(gzip.compress(open(os.path.join(d,name),'rb').read(),9)).decode()
def raw(name): return base64.b64encode(open(os.path.join(d,name),'rb').read()).decode()
o={'worker':gz('worker.min.js'),'tess':gz('tesseract.min.js'),'core':gz('tesseract-core-lstm.wasm.js'),'coreSimd':gz('tesseract-core-simd-lstm.wasm.js'),'fas':raw('fas.traineddata.gz')}
if '--eng' in sys.argv: o['eng']=raw('eng.traineddata.gz')
sys.stdout.write(json.dumps(o,separators=(',',':')))
