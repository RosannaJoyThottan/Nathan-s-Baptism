self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    self.clients.claim();
});

self.addEventListener('push', (event) => {
    // Can be implemented later if server Push API is used
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(self.clients.matchAll({
        type: 'window'
    }).then(clientsArr => {
        // If a Window tab is open, focus it
        const hadWindowToFocus = clientsArr.some(windowClient => windowClient.url === '/' ? (windowClient.focus(), true) : false);
        // Otherwise, open a new tab to the app
        if (!hadWindowToFocus) {
            self.clients.openWindow('/');
        }
    }));
});
