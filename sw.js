//Service worker: para permitir que la aplicación funcione sin conexión y pueda enviar notificaciones.

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open("mi-bta-cache").then((cache) => {
            return cache.addAll([
                "/",
                "/index.html",
                "/index.js",
                "/index.css",
                "/site.webmanifest",
                "/imagenes/maquina.png",
                "/imagenes/favicon-32x32.png"
            ]);
        })
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

//Este script:
//Guarda en caché los archivos esenciales para que la PWA funcione sin conexión.
//Intercepta las solicitudes y sirve los archivos desde la caché si están disponibles.