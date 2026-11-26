/* Service worker: caches nothing (every request goes to the network, so updates arrive immediately) and shows the update notifications. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request)));
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'Larsens Casino',{body:d.body||'Es gibt ein neues Update.',icon:'icon-192.png',badge:'icon-192.png',tag:d.tag||'update',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const target=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus' in c)return c.focus()}return self.clients.openWindow(target)}))});
