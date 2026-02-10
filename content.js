// Content script que corre en la pagina
// Extrae el token CSRF de la página

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getToken') {
    const token = extractCSRFToken();
    console.log('token extraído:', token ? 'ENCONTRADO ✓' : 'NO ENCONTRADO ✗');
    sendResponse({ token: token });
  }
  return true;
});

function extractCSRFToken() {
  console.log('Buscando token CSRF...');
  
  // Método 1: Buscar en input hidden con name="_token"
  const tokenInput = document.querySelector('input[name="_token"]');
  if (tokenInput && tokenInput.value) {
    console.log('Token encontrado (Método 1: input[name="_token"])');
    return tokenInput.value;
  }

  // Método 2: Buscar en meta tag
  const tokenMeta = document.querySelector('meta[name="csrf-token"]');
  if (tokenMeta) {
    const content = tokenMeta.getAttribute('content');
    if (content) {
      console.log('Token encontrado (Método 2: meta[name="csrf-token"])');
      return content;
    }
  }

  // Método 3: Buscar en cualquier input con "token" en el name
  const anyTokenInput = document.querySelector('input[name*="token" i]');
  if (anyTokenInput && anyTokenInput.value) {
    console.log('Token encontrado (Método 3: input con "token" en name)');
    return anyTokenInput.value;
  }

  // Método 4: Buscar en localStorage
  const localToken = localStorage.getItem('csrf_token') || localStorage.getItem('_token');
  if (localToken) {
    console.log('Token encontrado (Método 4: localStorage)');
    return localToken;
  }

  // Método 5: Buscar en el body del HTML
  const bodyHtml = document.body.innerHTML;
  const tokenMatch = bodyHtml.match(/csrf[_-]?token["']?\s*[:=]\s*["']([^"']+)["']/i);
  if (tokenMatch && tokenMatch[1]) {
    console.log('Token encontrado (Método 5: regex en HTML)');
    return tokenMatch[1];
  }

  console.error('No se encontró token CSRF en la página');
  console.log('URL actual:', window.location.href);
  console.log('Inputs en la página:', document.querySelectorAll('input').length);
  
  return null;
}

// Notificar al background cuando se detecta la página
if (window.location.hostname === 'sucursal.correos.go.cr') {
  console.log('Content script cargado en:', window.location.href);
  chrome.runtime.sendMessage({ 
    action: 'pageLoaded', 
    url: window.location.href 
  });
  
  // Intentar encontrar el token automáticamente cuando carga la página
  setTimeout(() => {
    const token = extractCSRFToken();
    if (token) {
      console.log('Token detectado automáticamente al cargar la página');
    } else {
      console.warn('No se detectó token al cargar. Asegúrate de estar en la página de crear guías.');
    }
  }, 1000);
}
