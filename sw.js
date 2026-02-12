self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('fetch', (event) => {
  // Empty for now to pass validation
});
