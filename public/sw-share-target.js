self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method === 'POST' && url.pathname === '/_share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file');
        
        if (file) {
          // Open IndexedDB to store the file temporarily
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('ChatAppSharedFilesDB', 1);
            request.onupgradeneeded = () => {
              request.result.createObjectStore('files');
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          // Save the file
          await new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            const request = store.put(file, 'latest-shared-file');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
        
        // Redirect to the main app with a query param to trigger the share flow
        return Response.redirect('/chats?shared=true', 303);
      } catch (err) {
        console.error('Error handling share target:', err);
        return Response.redirect('/chats', 303);
      }
    })());
  }
});
