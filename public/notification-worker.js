self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(globalThis.clients.openWindow("/"));
});