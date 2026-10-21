/* لینک عمیق ویجت: restikpack://quick?l=..&w=..&h=..&n=..&g=..&layer=..&paper=..&cls=..&p=..&c=..&sec=waste|twopiece|zerosheet|sheet|prod
   ورودی‌های ویجت را در تب قیمت می‌گذارد، محاسبه می‌کند و بخش خواسته‌شده (بلانک/پرت/دوتکه/...) را مثل لمس کارت نتیجه باز می‌کند. */
(function(){
  function q(u){ try{ const i=u.indexOf('?'); return i<0?null:new URLSearchParams(u.slice(i+1).split('#')[0]); }catch(_){ return null; } }
  function clickBtn(sel){ const b=document.querySelector(sel); if(b) b.click(); return !!b; }
  function ready(){
    const o=document.getElementById('loading-overlay');
    return (!o||o.style.display==='none') && typeof runCalc2==='function' && typeof calc2Accordion==='function' && document.querySelector('[id^="c2-length-"]');
  }
  function waitFor(cond,cb,ms,step){
    const t0=Date.now();
    (function tick(){ let ok=false; try{ ok=cond(); }catch(_){}
      if(ok) return cb(true);
      if(Date.now()-t0>ms) return cb(false);
      setTimeout(tick,step||150); })();
  }
  let busy=false, lastKey='';
  function apply(u){
    const P=q(u||''); if(!P||!P.has('l')) return;
    const key=u; if(busy&&key===lastKey) return; busy=true; lastKey=key;
    waitFor(ready,function(ok){
      if(!ok){ busy=false; return; }
      try{
        if(typeof openQuickPrice==='function') openQuickPrice();
        const first=document.querySelector('[id^="c2-length-"]');
        const id=first.id.replace('c2-length-','');
        const set=(fid,v)=>{ const e=document.getElementById(fid); if(e&&v!==''&&v!=null){ e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); } };
        set('c2-length-'+id,P.get('l')); set('c2-width-'+id,P.get('w')); set('c2-height-'+id,P.get('h')); set('c2-qty-'+id,P.get('n'));
        const g=P.get('g'); if(g) clickBtn(`button[onclick*="setCartonGlue(${id},'${g}'"]`);
        const ly=P.get('layer'); if(ly) clickBtn(`button[onclick*="setCartonLayer(${id},'${ly}'"]`);
        const pa=P.get('paper'); const cur=document.getElementById('c2-paper-'+id);
        if(pa&&cur&&cur.value!==pa) clickBtn(`button[onclick*="setCartonPaper(${id},'${pa}'"]`);
        const cl=P.get('cls'); const cc=document.getElementById('c2-cls-'+id);
        if(cl&&cc&&cc.value!==cl) clickBtn(`button[onclick*="setCartonCls(${id},'${cl}'"]`);
        set('calc2-profit',P.get('p')); set('calc2-check',P.get('c'));
        runCalc2();
        const sec=P.get('sec')||'';
        if(!sec||sec==='prod'){ busy=false; return; }
        // کارت نتیجه ساخته شود، بعد همان کاری که لمس کارت/آیکن می‌کند
        waitFor(function(){ return document.getElementById('c2sec-'+sec+'-'+id); },function(found){
          try{
            if(found){
              if(sec==='sheet'&&typeof openCalc2Sheet==='function') openCalc2Sheet(id);
              else if(calc2Accordion(id,sec)&&(sec==='twopiece'||sec==='zerosheet')&&typeof renderCalc2SuggestSheet==='function') renderCalc2SuggestSheet(id);
              setTimeout(function(){ const t=document.getElementById('c2sec-'+sec+'-'+id); if(t&&t.scrollIntoView) t.scrollIntoView({block:'center',behavior:'smooth'}); },350);
            }
          }catch(_){}
          busy=false;
        },6000,120);
      }catch(_){ busy=false; }
    },20000,200);
  }
  window.__rpDeepLink=apply;
  window.addEventListener('load',function(){
    try{
      if(window.Capacitor&&window.Capacitor.registerPlugin){
        const App=(window.Capacitor.Plugins&&window.Capacitor.Plugins.App)||window.Capacitor.registerPlugin('App');
        App.addListener('appUrlOpen',function(e){ apply(e&&e.url); });
        App.getLaunchUrl&&App.getLaunchUrl().then(function(r){ if(r&&r.url) apply(r.url); });
      }
    }catch(_){}
  });
})();
