// wordrink service worker — bump VERSION on every release
const VERSION="wordrink-2026-10-19a";
const CORE=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png"];
const AUDIO="wordrink-audio"; // kept across releases so the audio pack isn't re-downloaded
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>Promise.all(CORE.map(u=>fetch(u,{cache:"reload"}).then(r=>{if(r.ok)return c.put(u,r)}).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!==AUDIO).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==location.origin)return;
  // 1) pages: network first, so a new upload shows up immediately; cache only when offline
  if(req.mode==="navigate"||url.pathname.endsWith("/index.html")||url.pathname.endsWith("/")){
    e.respondWith(fetch(req,{cache:"no-cache"}).then(res=>{if(res.ok){const cp=res.clone();caches.open(VERSION).then(c=>c.put("./index.html",cp))}return res}).catch(()=>caches.match("./index.html",{ignoreSearch:true})));return}
  // 2) audio clips: cache first, in a cache that survives updates
  if(url.pathname.includes("/audio/")){
    e.respondWith(caches.open(AUDIO).then(c=>c.match(req).then(r=>r||fetch(req).then(res=>{if(res.ok)c.put(req,res.clone());return res}))));return}
  // 3) everything else: cache first, then network
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(r=>r||fetch(req).then(res=>{if(res.ok){const cp=res.clone();caches.open(VERSION).then(c=>c.put(req,cp))}return res})));
});
