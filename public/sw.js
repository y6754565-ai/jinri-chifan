const CACHE = "jinri-chifan-v17";
const BASE = new URL("./", self.registration.scope);
const ASSETS = [
  "./", "styles.css?v=17", "app.js?v=17", "recipes.json?v=17", "manifest.webmanifest", "icons/app-icon.svg",
  "images/cucumber-pork.jpg", "images/greens-pork.jpg",
  "images/smashed-cucumber.jpg", "images/greens-soup.jpg",
  "images/meat.svg", "images/tofu.svg", "images/egg.svg", "images/noodles.svg"
].map((asset) => new URL(asset, BASE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
