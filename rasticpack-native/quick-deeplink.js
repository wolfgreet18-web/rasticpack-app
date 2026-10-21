/* لینک عمیق ویجت: restikpack://quick?l=..&w=..&h=..&n=..&g=..&layer=..&paper=..&cls=..&p=..&c=..&sec=waste|twopiece|zerosheet|prod
   ورودی‌های ویجت را در تب قیمت می‌گذارد، محاسبه می‌کند و بخش خواسته‌شده (بلانک/پرت/دوتکه/...) را باز می‌کند. */
(function(){
  function q(u){ try{ const i=u.indexOf('?'); return i<0?null:new URLSearchParams(u.slice(i+1).split('#')[0]); }catch(_){ return null; } }
  function clickBtn(sel){ const b=document.querySelector(sel); if(b) b.click(); return !!b; }
  function apply(u){
    const P=q(u||''); if(!P||!P.has('l')) return;
    try{
      if(typeof openQuickPrice==='function') openQuickPrice();
      const set=(id,v)=>{ const e=document.getElementById(id); if(e&&v!==''&&v!=null){ e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); } };
      const id=1;
      set('c2-length-'+id,P.get('l')); set('c2-width-'+id,P.get('w')); set('c2-height-'+id,P.get('h')); set('c2-qty-'+id,P.get('n'));
      const g=P.get('g'); if(g) clickBtn(`button[onclick*="setCartonGlue(${id},'${g}'"]`);
      const ly=P.get('layer'); if(ly) clickBtn(`button[onclick*="setCartonLayer(${id},'${ly}'"]`);
      const pa=P.get('paper'); const cur=document.getElementById('c2-paper-'+id);
      if(pa&&cur&&cur.value!==pa) clickBtn(`button[onclick*="setCartonPaper(${id},'${pa}'"]`);
      const cl=P.get('cls'); const cc=document.getElementById('c2-cls-'+id);
      if(cl&&cc&&cc.value!==cl) clickBtn(`button[onclick*="setCartonCls(${id},'${cl}'"]`);
      set('calc2-profit',P.get('p')); set('calc2-check',P.get('c'));
      if(typeof runCalc2==='function') runCalc2();
      const sec=P.get('sec');
      setTimeout(function(){
        try{
          if(sec==='prod'){ return; }
          if(sec&&typeof calc2Accordion==='function'){
            if(calc2Accordion(id,sec)&&(sec==='twopiece'||sec==='zerosheet')&&typeof renderCalc2SuggestSheet==='function') renderCalc2SuggestSheet(id);
          }
        }catch(_){}
      },700);
    }catch(_){}
  }
  window.addEventListener('load',function(){
    const A=(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App)||null;
    try{
      if(window.Capacitor&&window.Capacitor.registerPlugin){
        const App=window.Capacitor.Plugins.App||window.Capacitor.registerPlugin('App');
        App.addListener('appUrlOpen',function(e){ setTimeout(function(){ apply(e&&e.url); },500); });
        App.getLaunchUrl&&App.getLaunchUrl().then(function(r){ if(r&&r.url) setTimeout(function(){ apply(r.url); },1200); });
      }
    }catch(_){}
  });
})();
