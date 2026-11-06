/* ───── وارد کردن قیمت ورق از عکس (OCR آفلاین) — رابط تنظیمات ───── */
let ocrState={rows:[],preview:'',busy:false,expected:12,cls:'A',confirmed:false,notes:[]};
const OCR_TARGETS=[['','— انتخاب کنید —'],['3|2T','۳لایه Ti'],['3|KT','۳لایه Ki'],['3|E','۳لایه kT'],['5|2T','۵لایه (Kii/KiT)'],['5|KT','۵لایه Sik']];
function ocrEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function ocrFmt(n){ return (n==null||isNaN(n))?'—':Math.round(n).toLocaleString('en-US'); }
function ocrClasses(){ return ocrState.cls==='both'?['A','T']:[ocrState.cls]; }
function ocrMap(){ if(!invoiceSettings.ocrMap||typeof invoiceSettings.ocrMap!=='object') invoiceSettings.ocrMap={}; return invoiceSettings.ocrMap; }
function ocrAutoTarget(r){
  if(!r.compKey) return '';
  const m=ocrMap()[r.compKey]; if(m) return m;
  if(r.compKey==='test|irani') return '3|2T';   /* تنها نگاشت قطعی: تست-فلوت-ایرانی = Ti */
  return '';
}
function ocrReparse(r){
  const p=RpOcr.parseComposition(r.compText||''); const info=RpOcr.compositionInfo(p.parts);
  r.compOk=!!(p.ok&&info.layer); r.layer=info.layer; r.compKey=info.key||'';
  r.target=ocrAutoTarget(r); r.use=!!r.target;
}
function ocrOldPrice(r){
  if(!r.target) return null; const [l,c]=r.target.split('|'); const cls=ocrClasses()[0];
  const b=sheetPriceBreakdown[sheetPriceKey(l,c,cls)]; return b?(parseFloat(b.product)||0):0;
}
function ocrFlags(r,dup){
  const f=[];
  if(!r.compOk) f.push(['bad','ترکیب نامشخص']);
  if(!r.target) f.push(['bad','مقصد انتخاب نشده']);
  if(!(r.price>0)) f.push(['bad','قیمت نامعتبر']);
  else if(r.price<100000||r.price>5000000) f.push(['bad','قیمت خارج از بازه']);
  const old=ocrOldPrice(r); if(old>0&&r.price>0&&Math.abs(r.price-old)/old>0.25) f.push(['warn','تغییر بیش از ۲۵٪']);
  if(r.use&&r.target&&dup[r.target]>1) f.push(['bad','مقصد تکراری']);
  if(r.priceConf<80||r.compConf<60) f.push(['warn','اطمینان OCR کم']);
  return f;
}
function ocrDupMap(){ const d={}; ocrState.rows.forEach(r=>{ if(r.use&&r.target) d[r.target]=(d[r.target]||0)+1; }); return d; }
function ocrBlockers(){
  const rows=ocrState.rows, dup=ocrDupMap(), used=rows.filter(r=>r.use), out=[];
  if(!used.length) out.push('هیچ ردیفی برای ثبت انتخاب نشده.');
  used.forEach(r=>{ if(!r.target) out.push('ردیف '+r.n+': مقصد انتخاب نشده.'); if(!(r.price>=100000&&r.price<=5000000)) out.push('ردیف '+r.n+': قیمت خارج از بازه‌ی مجاز.'); if(dup[r.target]>1) out.push('ردیف '+r.n+': مقصد تکراری.'); });
  return out;
}
function ocrRender(){
  const box=$('ocrp-result'); if(!box) return;
  const S=ocrState;
  if(!S.rows.length&&!S.preview){ box.innerHTML=''; ocrRenderBackup(); return; }
  const dup=ocrDupMap();
  let rowsHtml=S.rows.map((r,i)=>{
    const fl=ocrFlags(r,dup); const worst=fl.some(x=>x[0]==='bad')?'bad':fl.length?'warn':'ok';
    const bg=worst==='bad'?'rgba(239,68,68,.16)':worst==='warn'?'rgba(245,158,11,.16)':'transparent';
    const old=ocrOldPrice(r); const pct=(old>0&&r.price>0)?((r.price-old)/old*100):null;
    const opts=OCR_TARGETS.map(t=>`<option value="${t[0]}"${r.target===t[0]?' selected':''}>${t[1]}</option>`).join('');
    return `<tr style="background:${bg}">
      <td><input type="checkbox" ${r.use?'checked':''} onchange="ocrSet(${i},'use',this.checked)"></td>
      <td>${r.n}</td>
      <td style="min-width:150px"><img src="${r.cropUrl||''}" style="width:100%;max-width:260px;display:block;margin-bottom:4px;border-radius:4px"><input type="text" value="${ocrEsc(r.compText)}" style="width:100%;font-size:.78rem" onchange="ocrSet(${i},'comp',this.value)"></td>
      <td><select style="font-size:.78rem;width:100%" onchange="ocrSet(${i},'target',this.value)">${opts}</select></td>
      <td><input type="text" inputmode="numeric" value="${r.price||''}" style="width:92px;font-size:.82rem" onchange="ocrSet(${i},'price',this.value)"></td>
      <td>${ocrFmt(old)}</td>
      <td dir="ltr">${pct==null?'—':(pct>0?'+':'')+pct.toFixed(1)+'%'}</td>
      <td style="font-size:.72rem;line-height:1.5">${fl.map(x=>(x[0]==='bad'?'🔴 ':'🟠 ')+x[1]).join('<br>')||'✅'}</td>
      <td><button type="button" class="btn" style="padding:2px 8px;margin:0" onclick="ocrDelRow(${i})">✕</button></td>
    </tr>`;
  }).join('');
  const cntWarn=S.rows.length!==S.expected?`<div style="background:rgba(245,158,11,.18);padding:8px 10px;border-radius:8px;margin:8px 0;font-size:.82rem">⚠️ تعداد ردیف‌های خوانده‌شده (${S.rows.length}) با تعداد مورد انتظار (${S.expected}) برابر نیست. ردیف‌ها را بررسی کنید؛ می‌توانید ردیف اضافه یا حذف کنید.</div>`:'';
  const bl=ocrBlockers();
  box.innerHTML=`
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;margin-top:12px">
      ${S.preview?`<div style="flex:0 0 190px;max-width:100%"><img src="${S.preview}" style="width:100%;border-radius:8px;border:1px solid var(--bd,#888);cursor:zoom-in" onclick="ocrZoom()"><div style="font-size:.72rem;color:var(--tx2);text-align:center">برای بزرگ‌نمایی لمس کنید</div></div>`:''}
      <div style="flex:1 1 100%;min-width:0;overflow-x:auto">
        ${S.notes.map(n=>`<div style="font-size:.8rem;color:var(--tx2);margin-bottom:4px">${ocrEsc(n)}</div>`).join('')}
        ${cntWarn}
        <table style="width:100%;min-width:680px;border-collapse:collapse;font-size:.8rem" cellpadding="4">
          <thead><tr style="text-align:right"><th>ثبت</th><th>#</th><th>ترکیب (قابل‌ویرایش)</th><th>مقصد</th><th>قیمت جدید</th><th>قیمت قبلی</th><th>تغییر</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <button type="button" class="btn" style="margin-top:8px" onclick="ocrAddRow()">➕ افزودن ردیف</button>
      </div>
    </div>
    <div style="margin-top:12px;font-size:.8rem;color:var(--tx2)">فقط «قیمت محصول (بدون کرایه)» ثبت می‌شود؛ کرایه دست‌نخورده می‌ماند. دسته‌ی عرض: ${ocrClasses().map(c=>c==='A'?'A':'T').join(' و ')}</div>
    ${bl.length?`<div style="font-size:.78rem;color:#ef4444;margin-top:6px">${bl.slice(0,6).map(ocrEsc).join('<br>')}</div>`:''}
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:.88rem"><input type="checkbox" id="ocrp-confirm" ${S.confirmed?'checked':''} onchange="ocrState.confirmed=this.checked;ocrUpdateBtn()"> مقادیر بالا را بررسی کردم و تأیید می‌کنم</label>
    <button type="button" class="btn btn-primary" id="ocrp-register" style="margin-top:10px" onclick="ocrRegister()">✅ ثبت قیمت‌ها در تب قیمت</button>`;
  ocrUpdateBtn(); ocrRenderBackup();
}
function ocrUpdateBtn(){ const b=$('ocrp-register'); if(!b) return; const ok=ocrState.confirmed&&!ocrBlockers().length; b.disabled=!ok; b.style.opacity=ok?'1':'.45'; }
function ocrSet(i,k,v){
  const r=ocrState.rows[i]; if(!r) return;
  if(k==='use') r.use=!!v;
  else if(k==='price'){ r.price=RpOcr.parsePrice(String(v))||parseFloat(RpOcr.toLatinDigits(String(v)).replace(/[^0-9.]/g,''))||0; r.priceConf=100; }
  else if(k==='comp'){ r.compText=v; ocrReparse(r); r.compConf=100; }
  else if(k==='target'){ r.target=v; r.use=!!v; if(r.compKey&&v){ ocrMap()[r.compKey]=v; saveState(); } }
  ocrState.confirmed=false; ocrRender();
}
function ocrDelRow(i){ ocrState.rows.splice(i,1); ocrState.rows.forEach((r,j)=>r.n=j+1); ocrState.confirmed=false; ocrRender(); }
function ocrAddRow(){ ocrState.rows.push({n:ocrState.rows.length+1,cropUrl:'',price:0,priceConf:100,compText:'',compConf:100,compOk:false,layer:null,compKey:'',target:'',use:false}); ocrState.confirmed=false; ocrRender(); }
function ocrZoom(){
  const o=document.createElement('div'); o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:99999;overflow:auto;padding:8px';
  o.innerHTML=`<img src="${ocrState.preview}" style="width:220%;max-width:none;display:block">`; o.onclick=()=>o.remove(); document.body.appendChild(o);
}
function ocrSetCls(c){ ocrState.cls=c; ['A','T','both'].forEach(k=>{ const b=$('ocrp-cls-'+k); if(b) b.classList.toggle('active',k===c); }); ocrState.confirmed=false; ocrRender(); }
function ocrSetExpected(v){ ocrState.expected=Math.max(1,parseInt(v)||12); ocrRender(); }
async function ocrPick(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const st=$('ocrp-status'); const say=m=>{ if(st) st.textContent=m; };
  if(ocrState.busy) return; ocrState.busy=true;
  try{
    if(typeof RpOcr==='undefined') throw new Error('ماژول OCR در این نسخه موجود نیست.');
    const res=await RpOcr.run(f,say);
    ocrState.preview=res.preview||''; ocrState.notes=res.notes||[]; ocrState.confirmed=false;
    ocrState.rows=res.rows.map((x,i)=>{ const r={n:i+1,cropUrl:x.cropUrl,price:x.price||0,priceConf:x.priceConf,compText:(x.texts||[]).join(' - ')||x.compRaw,compConf:x.compConf}; ocrReparse(r); return r; });
    if(!ocrState.rows.length&&!ocrState.notes.length) ocrState.notes=['هیچ ردیفی خوانده نشد؛ عکس را صاف و کامل بگیرید.'];
    say('پایان خواندن — '+ocrState.rows.length+' ردیف. لطفاً جدول را بررسی و تأیید کنید.');
  }catch(e){ say('خطا: '+(e&&e.message||e)); console.error(e); }
  ocrState.busy=false; inp.value=''; ocrRender();
}
function ocrRegister(){
  if(!ocrState.confirmed||ocrBlockers().length) return;
  const used=ocrState.rows.filter(r=>r.use&&r.target), clsList=ocrClasses();
  const backup={time:new Date().toISOString(),items:[]}, seen={};
  used.forEach(r=>{ const [l,c]=r.target.split('|'); clsList.forEach(cls=>{ const key=sheetPriceKey(l,c,cls); if(!seen[key]){ seen[key]=1; const b=sheetPriceBreakdown[key]||{product:0,freight:0}; backup.items.push({key,product:parseFloat(b.product)||0,freight:parseFloat(b.freight)||0,existed:!!sheetPriceBreakdown[key]}); } }); });
  invoiceSettings.ocrBackup=backup;
  used.forEach(r=>{ const [l,c]=r.target.split('|'); clsList.forEach(cls=>{ const key=sheetPriceKey(l,c,cls); if(!sheetPriceBreakdown[key]) sheetPriceBreakdown[key]={product:0,freight:0}; sheetPriceBreakdown[key].product=r.price; recalcSheetPriceTotal(key); }); });
  saveState(); try{ renderSheetPrices(); }catch(_){} try{ runCalc2({live:true}); }catch(_){}
  ocrState.confirmed=false; ocrRender();
  const st=$('ocrp-status'); if(st) st.textContent='✅ '+backup.items.length+' قیمت در تب قیمت ثبت شد. نسخه‌ی قبلی ذخیره شد (دکمه‌ی برگرداندن).';
}
function ocrRestore(){
  const b=invoiceSettings.ocrBackup; if(!b||!b.items) return;
  if(!confirm('قیمت‌های قبل از آخرین ثبت برگردانده شود؟')) return;
  b.items.forEach(it=>{ if(!it.existed&&!sheetPriceBreakdown[it.key]) return; if(!sheetPriceBreakdown[it.key]) sheetPriceBreakdown[it.key]={product:0,freight:0}; sheetPriceBreakdown[it.key].product=it.product; recalcSheetPriceTotal(it.key); });
  delete invoiceSettings.ocrBackup; saveState(); try{ renderSheetPrices(); }catch(_){} try{ runCalc2({live:true}); }catch(_){}
  const st=$('ocrp-status'); if(st) st.textContent='↩️ قیمت‌های قبلی برگردانده شد.'; ocrRender();
}
function ocrRenderBackup(){
  const d=$('ocrp-backup'); if(!d) return; const b=invoiceSettings.ocrBackup;
  if(b&&b.items&&b.items.length){ let t=''; try{ t=new Date(b.time).toLocaleString('fa-IR'); }catch(_){}
    d.innerHTML=`<button type="button" class="btn" onclick="ocrRestore()">↩️ برگرداندن قیمت‌های قبلی</button> <span style="font-size:.75rem;color:var(--tx2)">${ocrEsc(t)} — ${b.items.length} قیمت</span>`; }
  else d.innerHTML='';
}
