#!/usr/bin/env python3
"""پیدا کردن k ابعاد ورق (عرض×طول) که روی مجموعه‌ای از کارتن‌ها کمترین پرت را بدهد.

منطق دقیقاً مثل خود اپ است (calcLayout): بلانک = (W+H) × (2(L+W)+چسب)، بدون چرخش،
تعداد روی ورق = floor(sw/bw)*floor(sh/bh). عرض ورق از لیست عرض‌ها، طول ۶۰ تا ۳۰۰ سانت.

استفاده:
  python3 optimize_sheets.py --backup rasticpack-2026-xx-xx.json -k 4     # از فاکتورهای واقعی بکاپ (وزن = تعداد کارتن)
  python3 optimize_sheets.py --synthetic 5000 -k 4                        # کارتن‌های ساختگی
"""
import argparse, json
import numpy as np
WIDTHS=[120,130,140,150,160,180,200,210,220,230]
LENS=list(range(60,301)); GLUE=4
CAND=[(w,s) for w in WIDTHS for s in LENS]

def from_backup(path):
    d=json.load(open(path,encoding='utf-8')); agg={}
    for inv in d.get('invoices',[]):
        for it in inv.get('items',[]):
            L,W,H=it.get('cartonLength'),it.get('cartonWidth'),it.get('cartonHeight')
            q=it.get('cartonQty') or 1
            if L and W and H: agg[(L,W,H)]=agg.get((L,W,H),0)+q
    keys=list(agg); return np.array(keys,float), np.array([agg[k] for k in keys],float)

def synthetic(n,seed=1):
    r=np.random.default_rng(seed)
    L=np.clip(np.round(r.lognormal(np.log(36),0.38,n)),15,90)
    W=np.clip(np.round(L*r.uniform(0.45,1.0,n)),10,60)
    H=np.clip(np.round(r.lognormal(np.log(26),0.45,n)),6,70)
    return np.stack([L,W,H],1), np.ones(n)

def cost_matrix(bw,bh):
    C=np.full((len(bw),len(CAND)),np.inf,dtype=np.float32)
    for j,(w,s) in enumerate(CAND):
        per=np.floor(w/bw)*np.floor(s/bh); ok=per>0
        C[ok,j]=w*s/per[ok]-(bw*bh)[ok]
    return C

def local(Cw,sel):
    sel=list(sel); best=np.min(Cw[:,sel],1).sum(); imp=True
    while imp:
        imp=False
        for p in range(len(sel)):
            oth=[s for i,s in enumerate(sel) if i!=p]
            base=np.min(Cw[:,oth],1) if oth else np.full(Cw.shape[0],1e12,dtype=np.float32)
            sc=np.minimum(base[:,None],Cw).sum(0); j=int(np.argmin(sc))
            if sc[j]<best-1e-6: sel[p]=j; best=sc[j]; imp=True
    return sel,best

def solve(C,wt,k,restarts=40):
    pen=1e6; Cw=(np.where(np.isinf(C),pen,C)*wt[:,None]).astype(np.float32)
    cur=np.full(C.shape[0],1e12,dtype=np.float32); sel=[]
    for _ in range(k):
        j=int(np.argmin(np.minimum(cur[:,None],Cw).sum(0))); sel.append(j); cur=np.minimum(cur,Cw[:,j])
    sel,b=local(Cw,sel); r=np.random.default_rng(0)
    for _ in range(restarts):
        s,v=local(Cw,list(r.choice(Cw.shape[1],k,replace=False)))
        if v<b-1e-6: sel,b=s,v
    return sel

if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--backup'); ap.add_argument('--synthetic',type=int); ap.add_argument('-k',type=int,default=4)
    a=ap.parse_args()
    cart,wt=from_backup(a.backup) if a.backup else synthetic(a.synthetic or 5000)
    bw=cart[:,1]+cart[:,2]; bh=2*(cart[:,0]+cart[:,1])+GLUE
    C=cost_matrix(bw,bh); ok=~np.all(np.isinf(C),1)
    print(f'کارتن‌های متفاوت: {len(cart)} — قابل ساخت یک‌تکه روی ورق‌های مجاز: {ok.sum()}')
    cart,wt,bw,bh,C=cart[ok],wt[ok],bw[ok],bh[ok],C[ok]
    sel=solve(C,wt,a.k); m=np.min(C[:,sel],1)
    print('ورق‌های پیشنهادی (عرض×طول):',sorted(CAND[j] for j in sel))
    print('درصد پرت کل: %.2f%%'%(100*(m*wt).sum()/((m*wt).sum()+(bw*bh*wt).sum())))
