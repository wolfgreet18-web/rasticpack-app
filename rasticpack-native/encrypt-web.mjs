/* رمزنگاری کد برنامه: www/index.html و www/db-bundle.js داخل www/app.enc (AES-256-GCM) قرار می‌گیرند
   و صفحه‌ی ورود (رمز نصب) جای index.html می‌نشیند. رمز فقط از متغیر محیطی INSTALL_PASSWORD (GitHub Secret) خوانده می‌شود؛
   هیچ‌جا در مخزن یا APK ذخیره نمی‌شود. salt ثابت است تا کلید بین نسخه‌ها یکی بماند و بعد از آپدیت دوباره رمز نخواهد. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const pw = process.env.INSTALL_PASSWORD || '';
if (!pw) { console.error('✗ INSTALL_PASSWORD تنظیم نشده؛ ساخت بدون رمز نصب متوقف شد (GitHub ▸ Settings ▸ Secrets ▸ Actions).'); process.exit(1); }
const SALT = Buffer.from('7f3a9c2e51b84d06a1e7c93b5d20f8ae', 'hex');
const ITER = 600000;
const dir = process.argv[2] || 'www';

const html = fs.readFileSync(dir + '/index.html', 'utf8');
const bundle = fs.existsSync(dir + '/db-bundle.js') ? fs.readFileSync(dir + '/db-bundle.js', 'utf8') : '';
const plain = zlib.gzipSync(Buffer.from(JSON.stringify({ html, bundle }), 'utf8'), { level: 9 });
const key = crypto.pbkdf2Sync(pw, SALT, ITER, 32, 'sha256');
const iv = crypto.randomBytes(12);
const c = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
fs.writeFileSync(dir + '/app.enc', Buffer.concat([iv, ct]));

const loader = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>رستیک پک</title>
<style>html,body{margin:0;height:100%;background:#16120f;color:#f5efe6;font-family:system-ui,Tahoma,sans-serif}
#g{min-height:100%;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}
.c{width:100%;max-width:340px;background:#241d18;border:1px solid #3a2f27;border-radius:18px;padding:22px;text-align:center}
h1{font-size:1.15rem;margin:0 0 6px}p{font-size:.82rem;opacity:.75;margin:0 0 14px;line-height:1.8}
input{width:100%;box-sizing:border-box;padding:13px;border-radius:12px;border:1.5px solid #5a4a3d;background:#16120f;color:#fff;font-size:1.05rem;text-align:center;letter-spacing:.2em;direction:ltr}
button{width:100%;margin-top:12px;padding:13px;border:0;border-radius:12px;background:#c0392b;color:#fff;font-weight:700;font-size:1rem}
#m{min-height:1.4em;margin-top:10px;font-size:.82rem;color:#ff9b8f}</style></head>
<body><div id="g"><div class="c"><h1>🔒 رستیک پک</h1><p>برای نصب و فعال‌سازی، رمز نصب را وارد کنید.</p>
<input id="p" type="password" autocomplete="off" inputmode="text" placeholder="رمز نصب"><button id="b">ورود</button><div id="m"></div></div></div>
<script>
(function(){
var SALT=Uint8Array.from('${SALT.toString('hex')}'.match(/../g).map(function(h){return parseInt(h,16)}));var ITER=${ITER};
var $=function(i){return document.getElementById(i)};var data=null,fails=0;
function b64(u){var s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)}
function unb64(s){var r=atob(s),u=new Uint8Array(r.length);for(var i=0;i<r.length;i++)u[i]=r.charCodeAt(i);return u}
async function open(key){
  var buf;try{buf=await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12)},key,data.slice(12));}catch(e){return false}
  var txt=await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  var p=JSON.parse(txt);var h=p.html;
  if(p.bundle){var u=URL.createObjectURL(new Blob([p.bundle],{type:'text/javascript'}));h=h.split('./db-bundle.js').join(u);}
  document.open();document.write(h);document.close();return true;
}
async function fromPw(pw){
  var base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:SALT,iterations:ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},true,['decrypt']);
}
async function go(){
  var pw=$('p').value;if(!pw)return;$('b').disabled=true;$('m').textContent='⏳ در حال بررسی...';
  if(fails>=5){await new Promise(function(r){setTimeout(r,Math.min(30000,(fails-4)*5000))});}
  try{var k=await fromPw(pw);
    if(await open(k)){try{localStorage.setItem('rp_k',b64(new Uint8Array(await crypto.subtle.exportKey('raw',k))));}catch(e){}return;}
  }catch(e){}
  fails++;$('m').textContent='رمز اشتباه است.';$('b').disabled=false;$('p').value='';$('p').focus();
}
(async function(){
  try{data=new Uint8Array(await (await fetch('app.enc',{cache:'no-store'})).arrayBuffer());}catch(e){$('m').textContent='فایل برنامه خوانده نشد.';return}
  var sk=null;try{sk=localStorage.getItem('rp_k');}catch(e){}
  if(sk){try{var k=await crypto.subtle.importKey('raw',unb64(sk),'AES-GCM',false,['decrypt']);if(await open(k))return;}catch(e){}}
  $('b').onclick=go;$('p').addEventListener('keydown',function(e){if(e.key==='Enter')go()});$('p').focus();
})();
})();
</script></body></html>`;
fs.writeFileSync(dir + '/index.html', loader);
fs.rmSync(dir + '/db-bundle.js', { force: true });
console.log('✓ کد برنامه رمزنگاری شد:', (fs.statSync(dir + '/app.enc').size / 1024).toFixed(0) + 'KB');
