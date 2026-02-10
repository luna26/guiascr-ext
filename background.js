// Background service worker para la extensión
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extensión GuíasCR instalada');
});

// Escuchar mensajes del content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'pageLoaded') {
    console.log('Página detectada:', request.url);
  }
});
