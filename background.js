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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Mensaje recibido en background:', request);

  if (request.action === 'getCookie') {
    console.log('🍪 Intentando obtener cookie:', request.name);

    chrome.cookies.getAll({
      domain: 'correos.go.cr'
    }, (cookies) => {
      console.log('📋 Cookies obtenidas:', cookies);

      const xsrfCookie = cookies.find(c => c.name === request.name);

      if (xsrfCookie) {
        console.log('✅ Cookie encontrada:', xsrfCookie.value);
        sendResponse({ value: xsrfCookie.value });
      } else {
        console.log('❌ Cookie no encontrada');
        console.log('Cookies disponibles:', cookies.map(c => c.name));
        sendResponse({
          value: null,
          error: 'Cookie not found',
          available: cookies.map(c => c.name)
        });
      }
    });

    return true; // ⬅️ MUY IMPORTANTE - mantiene el canal abierto
  }

  // Si no es getCookie, responde de todos modos
  console.log('⚠️ Acción desconocida');
  sendResponse({ error: 'Unknown action' });
  return true;
});
