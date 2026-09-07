/* обробники web-push — імпортується в згенерований Workbox service worker */
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  const title = d.title || "Dnipro-M";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      tag: d.tag || "dnipro-m",
      renotify: true,
      data: { url: d.url || "/?w=1" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) { w.navigate ? w.navigate(url) : null; return w.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
