/* ══════════ RpOcr — خواندن لیست قیمت ورق از عکس (کاملاً آفلاین، tesseract.js v5 + داده‌ی فارسی) ══════════
   همه‌ی فایل‌های موتور (worker، core، داده‌ی زبان) به‌صورت gzip+base64 داخل <script id="ocr-assets" type="application/json"> تعبیه شده‌اند
   و با Blob URL به موتور داده می‌شوند؛ هیچ درخواست اینترنتی ندارد و روی file:// هم کار می‌کند. */
const RpOcr=(function(){
  /* ───── ابزارهای متن ───── */
  const FA_DIG='۰۱۲۳۴۵۶۷۸۹', AR_DIG='٠١٢٣٤٥٦٧٨٩';
  function toLatinDigits(s){
    return String(s||'').replace(/[۰-۹]/g,c=>FA_DIG.indexOf(c)).replace(/[٠-٩]/g,c=>AR_DIG.indexOf(c));
  }
  /* «659/000» یا «1/154/000» یا «۱٬۱۵۴٬۰۰۰» → 659000 / 1154000 ؛ خروجی null اگر عددی نباشد */
  function parsePrice(raw){
    let s=toLatinDigits(raw).replace(/[\s‌‏‎]/g,'');
    const digits=s.replace(/[^0-9]/g,'');
    if(!digits) return null;
    return parseInt(digits,10);
  }
  /* ساختار «ارقام + گروه‌های سه‌رقمی» سالم است؟ (مثل 1/154/000) */
  function priceShapeOk(raw){
    const s=toLatinDigits(raw).replace(/[\s‌‏‎]/g,'').replace(/[٬،,\.٫]/g,'/');
    return /^\d{1,3}(\/\d{3})+$/.test(s);
  }
  function normFa(s){
    return String(s||'')
      .replace(/[يى]/g,'ی').replace(/[ك]/g,'ک').replace(/ۀ|ة/g,'ه').replace(/[ؤ]/g,'و').replace(/[أإآ]/g,'ا')
      .replace(/[ً-ٰٟـ‌‍‎‏]/g,'')   /* اعراب، کشیده، نیم‌فاصله و علائم جهت */
      .replace(/\s+/g,' ').trim();
  }
  /* تشابه ۰..۱ با فاصله‌ی ویرایشی */
  function sim(a,b){
    if(a===b) return 1; const n=a.length,m=b.length; if(!n||!m) return 0;
    let prev=new Array(m+1),cur=new Array(m+1);
    for(let j=0;j<=m;j++) prev[j]=j;
    for(let i=1;i<=n;i++){ cur[0]=i; for(let j=1;j<=m;j++){ cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); } [prev,cur]=[cur,prev]; }
    return 1-prev[m]/Math.max(n,m);
  }
  /* واژگان لیست قیمت ← کلید داخلی. مقدار: چند املا/شکل ممکن (بدون فاصله) */
  const WORDS={
    test:['تست'],
    shebe:['شبهکرافت','شبکرافت','شبه‌کرافت'],
    sooper:['سوپرکرافت','سوپرکرفت','سوپرکراقت'],
    white:['سفید'],
    irani:['ایرانی','ایرانى'],
    flute:['فلوت']
  };
  const WORD_LABEL={test:'تست',shebe:'شبه کرافت',sooper:'سوپر کرافت',white:'سفید',irani:'ایرانی',flute:'فلوت'};
  function matchWord(tok){
    const t=normFa(tok).replace(/[\s‌]/g,'').replace(/[^؀-ۿ]/g,'');
    if(!t) return null;
    const scored=[];
    Object.keys(WORDS).forEach(k=>{ let b=0; WORDS[k].forEach(w=>{ b=Math.max(b,sim(t,normFa(w).replace(/\s/g,''))); }); scored.push([k,b]); });
    scored.sort((x,y)=>y[1]-x[1]);
    const best=scored[0], second=scored[1];
    if(best[1]>=0.74&&best[1]-second[1]>=0.08) return {k:best[0],s:best[1]};
    return null;
  }
  /* متن ترکیب خام ← {parts:[کلید|null...], texts:[...], ok} ؛ اگر خط‌تیره‌ها خوانده نشده باشند با اسکن واژگان تقسیم می‌کند */
  function parseComposition(raw){
    let s=normFa(raw).replace(/[–—−‐‑‒―_|~\/\\]+/g,'-').replace(/\s*-\s*/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
    let toks=s.split('-').map(x=>x.trim()).filter(Boolean);
    let parts=toks.map(matchWord);
    /* اگر تعداد اجزا کم است (خط‌تیره‌ها گم شده) یا نامشخص دارد: اسکن پشت‌سرهم روی متن بدون فاصله */
    if(toks.length<3||parts.some(p=>!p)){
      const flat=normFa(raw).replace(/[^؀-ۿ]/g,'');
      const seq=[]; let i=0, okAll=true;
      while(i<flat.length){
        let bestK=null,bestLen=0,bestS=0;
        Object.keys(WORDS).forEach(k=>WORDS[k].forEach(w=>{
          const ww=normFa(w).replace(/[\s‌]/g,'');
          for(const len of [ww.length-1,ww.length,ww.length+1]){
            if(len<2||i+len>flat.length) continue;
            const sc=sim(flat.substr(i,len),ww);
            if(sc>bestS+1e-9||(Math.abs(sc-bestS)<1e-9&&len>bestLen)){ bestS=sc; bestK=k; bestLen=len; }
          }
        }));
        if(bestK&&bestS>=0.8){ seq.push({k:bestK,s:bestS}); i+=bestLen; } else { okAll=false; i+=1; }
      }
      /* فقط وقتی کل متن به واژگان شناخته‌شده تبدیل شد و طول معقول (3 یا 5 جزء) داد جایگزین شود */
      if(okAll&&(seq.length===3||seq.length===5)&&(!parts.every(p=>p)||toks.length!==seq.length)){ parts=seq; toks=seq.map(x=>WORD_LABEL[x.k]); }
    }
    return {parts,texts:toks,ok:parts.length>0&&parts.every(p=>p)};
  }
  /* اجزا ← لایه و کلید ترکیب (بدون «فلوت») */
  function compositionInfo(parts){
    if(!parts||!parts.length||!parts.every(p=>p)) return {layer:null,key:null,label:''};
    const ks=parts.map(p=>p.k);
    const layer=ks.length===3?'3':ks.length===5?'5':null;
    const liners=ks.filter(k=>k!=='flute');
    return {layer,key:liners.join('|'),label:ks.map(k=>WORD_LABEL[k]).join(' – ')};
  }

  /* ───── بارگذاری دارایی‌های تعبیه‌شده ───── */
  let _assets=null, _urls=null, _tessLoaded=null, _worker=null;
  function readAssets(){
    if(_assets) return _assets;
    const el=document.getElementById('ocr-assets');
    let o=null; try{ o=JSON.parse(el?el.textContent:'{}'); }catch(_){ o=null; }
    if(!o||!o.worker||!o.tess||!o.core||!o.fas) throw new Error('بسته‌ی OCR آفلاین داخل این نسخه تعبیه نشده است.');
    _assets=o; return o;
  }
  function b64ToBytes(b64){ const bin=atob(b64); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
  async function gunzip(bytes){
    if(typeof DecompressionStream==='undefined') throw new Error('این مرورگر از DecompressionStream پشتیبانی نمی‌کند.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function simdOk(){
    try{ return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])); }catch(_){ return false; }
  }
  async function prepare(onStatus){
    if(_urls&&_tessLoaded) return;
    const a=readAssets();
    onStatus&&onStatus('بارگذاری موتور OCR…');
    const tessJs=await gunzip(b64ToBytes(a.tess));
    const workerJs=await gunzip(b64ToBytes(a.worker));
    const useSimd=simdOk()&&a.coreSimd;
    const coreJs=await gunzip(b64ToBytes(useSimd?a.coreSimd:a.core));
    const langs={fas:a.fas}; if(a.eng) langs.eng=a.eng;
    /* worker: پیش‌کد جایگزین fetch برای داده‌ی زبان (بدون هیچ درخواست شبکه) + خود worker.min.js */
    /* پیش‌کد worker: fetch داده‌ی زبان را از داده‌ی تعبیه‌شده پاسخ می‌دهد (بدون شبکه).
       خود core (TesseractCore) هم عیناً داخل همین worker قرار می‌گیرد تا importScripts از Blob دیگر لازم نباشد
       (روی file:// مبدأ blob «null» است و importScripts بین blobها مسدود می‌شود). */
    const pre='(function(){var D='+JSON.stringify(langs)+';var of=self.fetch;function dec(b){var s=atob(b),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}'+
      'self.fetch=function(u){var m=/\\/([a-z_]+)\\.traineddata/.exec(String(u));if(m&&D[m[1]]){return Promise.resolve(new Response(dec(D[m[1]]),{status:200}));}return of.apply(this,arguments);};})();\n';
    const workerBlob=new Blob([pre,coreJs,'\n;',workerJs],{type:'text/javascript'});
    _urls={worker:URL.createObjectURL(workerBlob),core:'https://offline.invalid/tesseract-core.js',simd:useSimd};
    if(!window.Tesseract){
      const turl=URL.createObjectURL(new Blob([tessJs],{type:'text/javascript'}));
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=turl; s.onload=res; s.onerror=()=>rej(new Error('بارگذاری Tesseract ناموفق بود')); document.head.appendChild(s); });
    }
    _tessLoaded=true;
  }
  async function getWorker(onStatus){
    if(_worker) return _worker;
    await prepare(onStatus);
    onStatus&&onStatus('آماده‌سازی زبان فارسی…');
    _worker=await Tesseract.createWorker(['fas'],1,{
      workerPath:_urls.worker, corePath:_urls.core, langPath:'https://offline.invalid/lang', gzip:true,
      cacheMethod:'none', workerBlobURL:false, logger:()=>{}, errorHandler:e=>{ console.error('ocr worker',e); }
    });
    return _worker;
  }
  let _pw=null;
  async function getPriceWorker(onStatus){
    const a=readAssets(); if(!a.eng) return getWorker(onStatus);
    if(_pw) return _pw;
    await prepare(onStatus);
    onStatus&&onStatus('آماده‌سازی خواندن ارقام…');
    _pw=await Tesseract.createWorker(['eng'],1,{
      workerPath:_urls.worker, corePath:_urls.core, langPath:'https://offline.invalid/lang', gzip:true,
      cacheMethod:'none', workerBlobURL:false, logger:()=>{}, errorHandler:e=>{ console.error('ocr worker',e); }
    });
    return _pw;
  }
  async function terminate(){ try{ if(_worker) await _worker.terminate(); }catch(_){} try{ if(_pw) await _pw.terminate(); }catch(_){} _worker=null; _pw=null; }

  /* ───── پردازش تصویر ───── */
  function newCanvas(w,h){ const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }
  async function loadBitmap(file){
    if(typeof createImageBitmap==='function'){
      try{ return await createImageBitmap(file,{imageOrientation:'from-image'}); }catch(_){ try{ return await createImageBitmap(file); }catch(__){} }
    }
    const url=URL.createObjectURL(file);
    try{ const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('تصویر باز نشد')); i.src=url; }); return img; }
    finally{ setTimeout(()=>URL.revokeObjectURL(url),5000); }
  }
  function grayOf(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); const w=canvas.width,h=canvas.height;
    const d=ctx.getImageData(0,0,w,h).data; const g=new Uint8Array(w*h);
    for(let i=0,j=0;i<g.length;i++,j+=4) g[i]=(d[j]*299+d[j+1]*587+d[j+2]*114)/1000|0;
    return {g,w,h};
  }
  function canvasFromGray(g,w,h){
    const c=newCanvas(w,h), ctx=c.getContext('2d'); const id=ctx.createImageData(w,h);
    for(let i=0,j=0;i<g.length;i++,j+=4){ id.data[j]=id.data[j+1]=id.data[j+2]=g[i]; id.data[j+3]=255; }
    ctx.putImageData(id,0,0); return c;
  }
  /* تخت‌کردن نور: هر پیکسل ÷ پس‌زمینه‌ی محلی (میانگین جعبه‌ای با تصویر انتگرالی) و کشش کنتراست */
  function flatten(g,w,h){
    const R=Math.max(12,Math.round(Math.min(w,h)/28));
    const W1=w+1; const I=new Float64Array(W1*(h+1));
    for(let y=0;y<h;y++){ let row=0; for(let x=0;x<w;x++){ row+=g[y*w+x]; I[(y+1)*W1+x+1]=I[y*W1+x+1]+row; } }
    const out=new Uint8Array(w*h);
    for(let y=0;y<h;y++){
      const y0=Math.max(0,y-R),y1=Math.min(h,y+R+1);
      for(let x=0;x<w;x++){
        const x0=Math.max(0,x-R),x1=Math.min(w,x+R+1);
        const s=I[y1*W1+x1]-I[y0*W1+x1]-I[y1*W1+x0]+I[y0*W1+x0];
        const mean=s/((x1-x0)*(y1-y0));
        /* پس‌زمینه ≈ بالاترین حد میانگین (متن تیره میانگین را پایین می‌آورد) → جبران سبک */
        const bg=Math.max(mean*1.08,mean+6);
        let v=g[y*w+x]/Math.max(30,bg)*255; if(v>255) v=255; out[y*w+x]=v;
      }
    }
    return out;
  }
  function otsu(g){
    const hist=new Array(256).fill(0); for(let i=0;i<g.length;i++) hist[g[i]]++;
    const total=g.length; let sum=0; for(let i=0;i<256;i++) sum+=i*hist[i];
    let sB=0,wB=0,best=0,thr=128;
    for(let t=0;t<256;t++){ wB+=hist[t]; if(!wB) continue; const wF=total-wB; if(!wF) break; sB+=t*hist[t]; const mB=sB/wB,mF=(sum-sB)/wF; const v=wB*wF*(mB-mF)*(mB-mF); if(v>best){best=v;thr=t;} }
    return thr;
  }
  /* بینری: 1 = جوهر. روی تصویر تخت‌شده با آستانه‌ی اوتسو */
  function binarize(flat,w,h){
    const thr=otsu(flat); const b=new Uint8Array(w*h);
    for(let i=0;i<b.length;i++) b[i]=flat[i]<thr?1:0;
    return b;
  }
  /* تشخیص زاویه‌ی کجی: بیشینه‌کردن واریانس هیستوگرام ردیف‌ها روی نمونه‌ی کوچک‌شده */
  function detectSkew(bin,w,h){
    const step=Math.max(1,Math.round(w/700)); const pts=[];
    for(let y=0;y<h;y+=step) for(let x=0;x<w;x+=step) if(bin[y*w+x]) pts.push(x/step,y/step);
    const hh=Math.ceil(h/step), ww=Math.ceil(w/step);
    const score=ang=>{
      const th=ang*Math.PI/180, c=Math.cos(th), s=Math.sin(th);
      const bins=new Float64Array(hh+ww+4); const off=ww+2;
      for(let i=0;i<pts.length;i+=2){ const yy=pts[i+1]*c-pts[i]*s+off; const b=yy|0; if(b>=0&&b<bins.length) bins[b]++; }
      let v=0; for(let i=1;i<bins.length;i++){ const d=bins[i]-bins[i-1]; v+=d*d; }
      return v;
    };
    let best=0,bs=-1;
    for(let a=-10;a<=10.001;a+=0.5){ const sc=score(a); if(sc>bs){bs=sc;best=a;} }
    for(let a=best-0.5;a<=best+0.501;a+=0.1){ const sc=score(a); if(sc>bs){bs=sc;best=a;} }
    return Math.abs(best)<0.15?0:best;
  }
  function rotateCanvas(canvas,deg){
    if(!deg) return canvas;
    const th=deg*Math.PI/180, w=canvas.width,h=canvas.height;
    const out=newCanvas(w,h), ctx=out.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
    ctx.translate(w/2,h/2); ctx.rotate(-th); ctx.drawImage(canvas,-w/2,-h/2);
    return out;
  }
  /* خطوط جدول: پیک‌های تصویر افقی/عمودی. خروجی مختصات مرکز خطوط */
  function runsAxis(bin,w,h,horizontal,minRun,lo,hi){
    const prof=new Float64Array(horizontal?h:w);
    if(horizontal){
      const x0=lo||0,x1=hi==null?w:hi;
      for(let y=0;y<h;y++){ let run=0,tot=0; for(let x=x0;x<=x1;x++){ if(x<x1&&bin[y*w+x]) run++; else { if(run>=minRun) tot+=run; run=0; } } prof[y]=tot; }
    }else{
      const y0=lo||0,y1=hi==null?h:hi;
      for(let x=0;x<w;x++){ let run=0,tot=0; for(let y=y0;y<=y1;y++){ if(y<y1&&bin[y*w+x]) run++; else { if(run>=minRun) tot+=run; run=0; } } prof[x]=tot; }
    }
    return prof;
  }
  function peaks(prof,thr,gap){
    const out=[]; let i=0;
    while(i<prof.length){
      if(prof[i]>=thr){ let j=i,sum=0,wsum=0; while(j<prof.length&&prof[j]>=thr*0.5){ sum+=prof[j]; wsum+=prof[j]*j; j++; } out.push({pos:wsum/sum,len:sum,w:j-i}); i=j+gap; }
      else i++;
    }
    return out;
  }
  function pk(prof,frac){ let m=0; for(const v of prof) m=Math.max(m,v); return {m,l:peaks(prof,m*frac,2).map(p=>p.pos)}; }
  function fillGaps(l){
    if(l.length<4) return l;
    const d=[]; for(let i=1;i<l.length;i++) d.push(l[i]-l[i-1]);
    const med=d.slice().sort((a,b)=>a-b)[d.length>>1];
    const out=[l[0]];
    for(let i=1;i<l.length;i++){
      const gap=l[i]-l[i-1], n=Math.round(gap/med);
      if(n>=2&&Math.abs(gap-n*med)<med*0.18) for(let k=1;k<n;k++) out.push(l[i-1]+gap*k/n);
      out.push(l[i]);
    }
    return out;
  }
  function detectGrid(bin,w,h){
    /* مرحله ۱: خطوط افقی سراسری → بازه‌ی عمودی جدول */
    let H=pk(runsAxis(bin,w,h,true,Math.round(w*0.08)),0.5);
    if(H.m<w*0.25||H.l.length<3) return null;
    let ya=Math.max(0,Math.floor(H.l[0])-3), yb=Math.min(h,Math.ceil(H.l[H.l.length-1])+3);
    /* مرحله ۲: خطوط عمودی فقط داخل بازه‌ی جدول (لبه‌ی عکس/سایه حذف می‌شود) */
    let V=pk(runsAxis(bin,w,h,false,Math.round((yb-ya)*0.45),ya,yb),0.5);
    if(V.l.length<3) return null;
    const xa=Math.max(0,Math.floor(V.l[0])-3), xb=Math.min(w,Math.ceil(V.l[V.l.length-1])+3);
    /* مرحله ۳: افقی‌ها دوباره فقط داخل بازه‌ی افقی جدول */
    H=pk(runsAxis(bin,w,h,true,Math.round((xb-xa)*0.5),xa,xb),0.4);
    if(H.l.length<3) return null;
    const hl=fillGaps(H.l), vl=V.l;
    return {h:hl,v:vl};
  }

  /* ───── OCR یک ناحیه ───── */
  async function recognizeCanvas(worker,canvas,params){
    await worker.setParameters(params);
    const r=await worker.recognize(canvas);
    return {text:(r.data.text||'').replace(/\s+/g,' ').trim(),conf:r.data.confidence||0,words:r.data.words||[],lines:r.data.lines||[]};
  }
  function cropPadded(src,x0,y0,x1,y1,scale,pad,binary){
    const w=Math.max(1,Math.round(x1-x0)),h=Math.max(1,Math.round(y1-y0));
    const cw=Math.round(w*scale)+pad*2, ch=Math.round(h*scale)+pad*2;
    const c=newCanvas(cw,ch), ctx=c.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,cw,ch);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(src,x0,y0,w,h,pad,pad,Math.round(w*scale),Math.round(h*scale));
    if(binary){
      const ctx2=c.getContext('2d'); const id=ctx2.getImageData(0,0,cw,ch); const d=id.data; const g=new Uint8Array(cw*ch);
      for(let i=0,j=0;i<g.length;i++,j+=4) g[i]=d[j];
      const t=otsu(g)+8;
      for(let i=0,j=0;i<g.length;i++,j+=4){ const v=g[i]<t?0:255; d[j]=d[j+1]=d[j+2]=v; }
      ctx2.putImageData(id,0,0);
    }
    return c;
  }
  const PRICE_PARAMS={tessedit_char_whitelist:'0123456789/,.٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٬',tessedit_pageseg_mode:'7',preserve_interword_spaces:'0'};
  const TEXT_PARAMS={tessedit_char_whitelist:'',tessedit_pageseg_mode:'7',preserve_interword_spaces:'1'};

  async function readPrice(worker,src,cell){
    const attempts=[[2.2,false],[3,true],[1.6,false]];
    let best=null;
    for(const [sc,bin] of attempts){
      const c=cropPadded(src,cell.x0,cell.y0,cell.x1,cell.y1,sc,16,bin);
      const r=await recognizeCanvas(worker,c,PRICE_PARAMS);
      const val=parsePrice(r.text), shape=priceShapeOk(toLatinDigits(r.text));
      const score=(shape?100:0)+(val&&val>=1e5&&val<=5e6?50:0)+r.conf;
      if(!best||score>best.score) best={text:r.text,val,shape,conf:r.conf,score};
      if(shape&&r.conf>=85&&val>=1e5&&val<=5e6) break;
    }
    return best;
  }
  async function readComp(worker,src,cell){
    const attempts=[[2,false],[2.6,true]];
    let best=null;
    for(const [sc,bin] of attempts){
      const c=cropPadded(src,cell.x0,cell.y0,cell.x1,cell.y1,sc,16,bin);
      const r=await recognizeCanvas(worker,c,TEXT_PARAMS);
      const p=parseComposition(r.text); const info=compositionInfo(p.parts);
      const score=(p.ok?100:0)+(info.layer?30:0)+r.conf*0.5;
      if(!best||score>best.score) best={text:r.text,parsed:p,info,conf:r.conf,score};
      if(p.ok&&info.layer&&r.conf>=75) break;
    }
    return best;
  }

  /* ───── اجرای کامل روی یک عکس ───── */
  async function run(file,onStatus,opts){
    opts=opts||{};
    const st=m=>{ try{ onStatus&&onStatus(m); }catch(_){} };
    const worker=await getWorker(st);
    const pworker=await getPriceWorker(st);
    st('پیش‌پردازش تصویر…');
    const bmp=await loadBitmap(file);
    let W=bmp.width||bmp.naturalWidth, H=bmp.height||bmp.naturalHeight;
    const longSide=Math.max(W,H);
    let sc=1; if(longSide>2600) sc=2600/longSide; else if(W<1300) sc=1300/W;
    let canvas=newCanvas(W*sc,H*sc); { const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.imageSmoothingQuality='high'; ctx.drawImage(bmp,0,0,canvas.width,canvas.height); }
    /* اول بدون چرخش: خاکستری → تخت‌سازی نور → بینری → زاویه */
    let {g,w,h}=grayOf(canvas); let flat=flatten(g,w,h); let bin=binarize(flat,w,h);
    const skew=detectSkew(bin,w,h);
    if(skew){ canvas=rotateCanvas(canvas,skew); ({g,w,h}=grayOf(canvas)); flat=flatten(g,w,h); bin=binarize(flat,w,h); }
    const flatCanvas=canvasFromGray(flat,w,h);
    st('تشخیص خطوط جدول…');
    const grid=detectGrid(bin,w,h);
    const preview=(()=>{ const pc=newCanvas(Math.min(900,w),h*Math.min(900,w)/w); pc.getContext('2d').drawImage(canvas,0,0,pc.width,pc.height); return pc.toDataURL('image/jpeg',0.8); })();
    const out={skew,gridFound:!!grid,rows:[],preview,size:[w,h],notes:[],dbg:[]};
    if(opts.debug&&grid){ out.grid=grid; }
    if(!grid){ out.notes.push('خطوط جدول در عکس پیدا نشد؛ عکس را صاف‌تر و کامل‌تر بگیرید.'); return out; }
    const vs=grid.v, hs=grid.h;
    /* ستون‌ها بین خطوط عمودی؛ پهن‌ترین = ترکیب ورق، سمت چپ‌تر از آن = قیمت (جدول راست‌به‌چپ) */
    const cols=[]; for(let i=0;i+1<vs.length;i++) cols.push({x0:vs[i],x1:vs[i+1],w:vs[i+1]-vs[i]});
    if(cols.length<2){ out.notes.push('ستون‌های جدول تشخیص داده نشد.'); return out; }
    let ci=0; cols.forEach((c,i)=>{ if(c.w>cols[ci].w) ci=i; });
    const compCol=cols[ci];
    const priceCol=ci>0?cols[ci-1]:cols[Math.min(cols.length-1,ci+1)];
    const rowsGeo=[]; for(let i=0;i+1<hs.length;i++) rowsGeo.push({y0:hs[i],y1:hs[i+1],h:hs[i+1]-hs[i]});
    /* ردیف‌های بسیار کوتاه/بلند غیرعادی حذف نشوند ولی تیتر معمولاً قیمت ندارد و خودش کنار می‌رود */
    const inset=Math.max(3,Math.round(w*0.003));
    const items=[];
    for(let r=0;r<rowsGeo.length;r++){
      const rg=rowsGeo[r]; if(rg.h<w*0.015) continue;
      st(`خواندن ردیف ${r+1} از ${rowsGeo.length}…`);
      const pc={x0:priceCol.x0+inset,x1:priceCol.x1-inset,y0:rg.y0+inset,y1:rg.y1-inset};
      const cc={x0:compCol.x0+inset,x1:compCol.x1-inset,y0:rg.y0+inset,y1:rg.y1-inset};
      const p=await readPrice(pworker,flatCanvas,pc);
      if(opts.debug) out.dbg.push({r,img:cropPadded(flatCanvas,pc.x0,pc.y0,pc.x1,pc.y1,1,0,false).toDataURL('image/png'),t:p&&p.text});
      if(!p||p.val==null||p.text.replace(/[^0-9۰-۹٠-٩]/g,'').length<4){ continue; }   /* تیتر یا سلول بدون عدد */
      const c=await readComp(worker,flatCanvas,cc);
      /* تصویر کل ردیف برای مقایسه‌ی چشمی (از تصویر اصلی صاف‌شده) */
      const rx0=Math.min(compCol.x0,priceCol.x0), rx1=Math.max(compCol.x1,priceCol.x1,cols[cols.length-1].x1);
      const rc=cropPadded(canvas,vs[0],rg.y0,vs[vs.length-1],rg.y1,Math.min(1,760/(vs[vs.length-1]-vs[0])),4,false);
      items.push({
        n:items.length+1,gridRow:r,cropUrl:rc.toDataURL('image/jpeg',0.8),
        priceRaw:p.text,price:p.val,priceShape:p.shape,priceConf:Math.round(p.conf),
        compRaw:c.text,parts:c.parsed.parts.map(x=>x?x.k:null),texts:c.parsed.texts,compOk:c.parsed.ok,compConf:Math.round(c.conf),
        layer:c.info.layer,key:c.info.key,label:c.info.label
      });
    }
    out.rows=items;
    return out;
  }
  return {run,terminate,prepare,getWorker,parsePrice,priceShapeOk,parseComposition,compositionInfo,matchWord,toLatinDigits,WORD_LABEL,
          _internal:{normFa,sim,detectSkew,detectGrid,flatten,binarize,grayOf,rotateCanvas,newCanvas}};
})();
if(typeof window!=='undefined') window.RpOcr=RpOcr;
