self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(globalThis.clients.openWindow("/"));
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "Oak & Ledger", {
      body: payload.body || "Your watchlist has a new signal.",
      icon: payload.icon || "/__grok/icon-180.png",
      tag: payload.tag || "oak-ledger-push",
    }),
  );
});