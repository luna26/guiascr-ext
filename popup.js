// popup.js - Extensión Chrome con Access Key Authentication

//TODO WHEN PROD IS https://guiascr-backend-production.up.railway.app/api so fix this for local dev

const API_URL = 'https://oleomargaric-theosophic-vivienne.ngrok-free.dev/api';
const CORREOS_CR_URL = 'https://sucursal.correos.go.cr/sucursal/guide/store';

// Variables globales
let orders = [];
let selectedOrders = new Set();
let processing = false;
let accessKey = null;
let currentShop = null;

// Elementos del DOM
const configScreen = document.getElementById('configScreen');
const mainScreen = document.getElementById('mainScreen');
const accessKeyInput = document.getElementById('accessKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const changeKeyLink = document.getElementById('changeKeyLink');
const shopInfo = document.getElementById('shopInfo');
const shopName = document.getElementById('shopName');
const shopLink = document.getElementById('shopLink');
const ordersContainer = document.getElementById('ordersContainer');
const selectAllBtn = document.getElementById('selectAllBtn');
const createBtn = document.getElementById('createBtn');
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');

// ============================================================================
// CONFIGURACIÓN DE ACCESS KEY
// ============================================================================

// Cargar access key al iniciar
document.addEventListener('DOMContentLoaded', async () => {
  await loadAccessKey();
});

// Cargar access key guardado
async function loadAccessKey() {
  chrome.storage.sync.get(['accessKey'], async (result) => {
    if (result.accessKey) {
      accessKey = result.accessKey;
      showMainScreen();
      await loadOrders();
    } else {
      showConfigScreen();
    }
  });
}

// Guardar access key
saveKeyBtn.addEventListener('click', async () => {
  const key = accessKeyInput.value.trim();
  
  if (!key) {
    alert('Por favor ingresa un access key');
    return;
  }

  if (!key.startsWith('sk_')) {
    alert('El access key debe comenzar con "sk_"');
    return;
  }

  saveKeyBtn.disabled = true;
  saveKeyBtn.textContent = 'Verificando...';

  // Verificar que el key funciona
  try {
    const response = await fetch(`${API_URL}/orders/pending`, {
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (!response.ok) {
      throw new Error('Access key inválido');
    }

    // Guardar
    chrome.storage.sync.set({ accessKey: key }, () => {
      accessKey = key;
      showMainScreen();
      loadOrders();
    });

  } catch (error) {
    alert(`Error: ${error.message}. Verifica tu access key.`);
    saveKeyBtn.disabled = false;
    saveKeyBtn.textContent = 'Guardar y Conectar';
  }
});

// Cambiar access key
changeKeyLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('¿Quieres cambiar tu access key? Deberás configurar uno nuevo.')) {
    chrome.storage.sync.remove('accessKey', () => {
      accessKey = null;
      currentShop = null;
      showConfigScreen();
    });
  }
});

// Mostrar pantalla de configuración
function showConfigScreen() {
  configScreen.style.display = 'block';
  mainScreen.style.display = 'none';
  accessKeyInput.value = '';
  accessKeyInput.focus();
}

// Mostrar pantalla principal
function showMainScreen() {
  configScreen.style.display = 'none';
  mainScreen.style.display = 'block';
}

// ============================================================================
// CARGAR PEDIDOS
// ============================================================================

async function loadOrders() {
  showStatus('loading', 'Cargando pedidos...');
  
  try {
    const response = await fetch(`${API_URL}/orders/pending`, {
      headers: {
        'Authorization': `Bearer ${accessKey}`
      }
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error cargando pedidos');
    }

    orders = data.orders;
    currentShop = data.shop;
    
    // Mostrar info de la tienda
    if (currentShop) {
      shopName.textContent = currentShop;
      shopLink.href = `https://${currentShop}/admin`;
      shopInfo.style.display = 'block';
    }

    renderOrders();
    hideStatus();

    if (orders.length === 0) {
      showEmptyState();
    }

  } catch (error) {
    console.error('Error:', error);
    showStatus('error', `Error: ${error.message}`);
  }
}

// Renderizar pedidos
function renderOrders() {
  ordersContainer.innerHTML = '';

  orders.forEach(order => {
    const orderEl = createOrderElement(order);
    ordersContainer.appendChild(orderEl);
  });
}

// Crear elemento de pedido
function createOrderElement(order) {
  const div = document.createElement('div');
  div.className = 'order-item';
  div.dataset.orderId = order.id;

  const isCompleted = order.completed;
  if (isCompleted) {
    div.classList.add('completed');
  }

  div.innerHTML = `
    <div class="order-header">
      ${!isCompleted ? `
        <input type="checkbox" id="order-${order.id}" data-order-id="${order.id}">
      ` : ''}
      <label for="order-${order.id}" class="order-number">
        Pedido #${order.order_number}
      </label>
      ${isCompleted ? '<span class="check-icon">✓</span>' : ''}
    </div>
    <div class="order-details">
      <div class="customer-name">${order.customer.name}</div>
      <div>${order.shipping_address?.city || 'N/A'} | 
           ${order.currency} ${order.total_price} | 
           ${order.line_items.length} producto(s)</div>
    </div>
  `;

  if (!isCompleted) {
    const checkbox = div.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', handleCheckboxChange);
  }

  return div;
}

// Manejar selección de checkbox
function handleCheckboxChange(e) {
  const orderId = e.target.dataset.orderId;
  const orderEl = e.target.closest('.order-item');

  if (e.target.checked) {
    selectedOrders.add(orderId);
    orderEl.classList.add('selected');
  } else {
    selectedOrders.delete(orderId);
    orderEl.classList.remove('selected');
  }

  updateUI();
}

// Seleccionar/deseleccionar todos
selectAllBtn.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]:not(:disabled)');
  const allChecked = checkboxes.length === selectedOrders.size;

  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
    const orderId = cb.dataset.orderId;
    const orderEl = cb.closest('.order-item');

    if (!allChecked) {
      selectedOrders.add(orderId);
      orderEl.classList.add('selected');
    } else {
      selectedOrders.delete(orderId);
      orderEl.classList.remove('selected');
    }
  });

  updateUI();
});

// (Continúa en la siguiente parte...)
// popup.js - PARTE 2: Creación de guías

// ============================================================================
// CREAR GUÍAS
// ============================================================================

createBtn.addEventListener('click', async () => {
  if (processing || selectedOrders.size === 0) return;

  processing = true;
  updateUI();

  const ordersToProcess = Array.from(selectedOrders);
  progressBar.classList.add('active');
  
  let completed = 0;
  let failed = 0;

  for (const orderId of ordersToProcess) {
    const order = orders.find(o => o.id == orderId);
    
    try {
      showStatus('loading', `Creando guía para pedido #${order.order_number}...`);
      
      // Crear guía en Correos CR
      const tracking = await createGuideInCorreosCR(order);
      
      // Actualizar Shopify con el tracking
      await updateShopifyTracking(orderId, tracking);
      
      // Marcar como completado
      markOrderAsCompleted(orderId);
      completed++;
      
    } catch (error) {
      console.error(`Error processing order ${orderId}:`, error);
      failed++;
    }

    // Actualizar progreso
    const progress = ((completed + failed) / ordersToProcess.length) * 100;
    progressFill.style.width = `${progress}%`;
  }

  // Resultado final
  progressBar.classList.remove('active');
  processing = false;
  selectedOrders.clear();

  if (failed === 0) {
    showStatus('success', `✓ ${completed} guía(s) creada(s) exitosamente`);
  } else {
    showStatus('error', `${completed} exitosas, ${failed} fallidas`);
  }

  setTimeout(() => {
    hideStatus();
    updateUI();
  }, 3000);
});

// ============================================================================
// CREAR GUÍA EN CORREOS CR
// ============================================================================

async function createGuideInCorreosCR(order) {
  // Obtener token CSRF de Correos CR
  const token = await getCSRFToken();
  
  if (!token) {
    throw new Error('No se pudo obtener el token. Asegúrate de estar logueado en Correos CR.');
  }

  // Obtener configuración de remitente del backend
  const senderConfig = await getSenderConfig();
  
  if (!senderConfig) {
    throw new Error('Configura los datos del remitente en la app de Shopify primero.');
  }

  // Construir payload
  const payload = buildCorreosCRPayload(order, token, senderConfig);

  // Hacer POST con XMLHttpRequest
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', CORREOS_CR_URL, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          const trackingNumber = result.tracking_number || result.guide_number || result.id || 'TRACKING-' + Date.now();
          resolve(trackingNumber);
        } catch (e) {
          console.error('Error parsing response:', e);
          console.log('Raw response:', xhr.responseText);
          resolve('TRACKING-' + Date.now());
        }
      } else {
        reject(new Error(`Error al crear guía en Correos CR (Status: ${xhr.status})`));
      }
    };
    
    xhr.onerror = function() {
      reject(new Error('Error de red al crear guía en Correos CR'));
    };
    
    xhr.ontimeout = function() {
      reject(new Error('Timeout al crear guía en Correos CR'));
    };
    
    const formData = new URLSearchParams(payload).toString();
    xhr.send(formData);
  });
}

// Construir payload para Correos CR
function buildCorreosCRPayload(order, token, senderConfig) {
  const shipping = order.shipping_address;
  
  return {
    _token: token,
    
    // Datos del remitente (desde configuración)
    sender_identification_type: senderConfig.senderIdentificationType || '1',
    sender_id: senderConfig.senderId || '',
    sender_name: senderConfig.senderName || '',
    sender_phone: senderConfig.senderPhone || '',
    sender_mail: senderConfig.senderMail || '',
    provincia_sender: senderConfig.provinciaSender || '1',
    canton_sender: senderConfig.cantonSender || '1',
    distrito_sender: senderConfig.distritoSender || '1',
    sender_postal_code: senderConfig.senderPostalCode || '',
    sender_direction: senderConfig.senderDirection || '',
    
    // Datos del paquete
    box_detail: order.line_items.map(item => item.title).join(', ').substring(0, 100),
    
    // Datos del destinatario (desde pedido de Shopify)
    destination_identification_type: '1',
    destination_id: shipping.phone?.replace(/\D/g, '').substring(0, 11) || '000000000',
    destination_name: `${shipping.first_name} ${shipping.last_name}`.toUpperCase(),
    destination_phone: shipping.phone?.replace(/\D/g, '') || '00000000',
    destination_type: 'Domicilio',
    
    // Ubicación del destinatario
    provincia: '1', // TODO: Mapear provincias
    canton: '1',
    distrito: '1',
    postal_code: shipping.zip || '10101',
    destination_direction: `${shipping.address1} ${shipping.address2 || ''}`.trim(),
    
    // Dimensiones
    box_width: '0',
    box_tall: '0',
    box_long: '0'
  };
}

// Obtener token CSRF de Correos CR
async function getCSRFToken() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://sucursal.correos.go.cr/*' });
    
    if (tabs.length === 0) {
      console.error('No hay pestañas de Correos CR abiertas');
      return null;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        let tokenInput = document.querySelector('input[name="_token"]');
        if (tokenInput && tokenInput.value) {
          return tokenInput.value;
        }

        let tokenMeta = document.querySelector('meta[name="csrf-token"]');
        if (tokenMeta) {
          return tokenMeta.getAttribute('content');
        }

        return null;
      }
    });

    const token = results[0]?.result || null;
    return token;

  } catch (error) {
    console.error('Error obteniendo token:', error);
    return null;
  }
}

// Obtener configuración del remitente desde el backend
async function getSenderConfig() {
  try {
    const response = await fetch(`${API_URL}/sender-config`, {
      headers: {
        'Authorization': `Bearer ${accessKey}`
      }
    });

    const data = await response.json();

    if (!data.success) {
      return null;
    }

    return data.config;

  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    return null;
  }
}

// ============================================================================
// ACTUALIZAR SHOPIFY
// ============================================================================

async function updateShopifyTracking(orderId, trackingNumber) {
  const response = await fetch(`${API_URL}/orders/update-tracking`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: orderId,
      tracking_number: trackingNumber
    })
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Error al actualizar tracking');
  }

  return data;
}

// Marcar pedido como completado
function markOrderAsCompleted(orderId) {
  const order = orders.find(o => o.id == orderId);
  if (order) {
    order.completed = true;
  }

  const orderEl = document.querySelector(`[data-order-id="${orderId}"]`);
  if (orderEl) {
    const parentEl = orderEl.closest('.order-item');
    parentEl.classList.add('completed');
    parentEl.classList.remove('selected');
    
    const header = parentEl.querySelector('.order-header');
    header.innerHTML = `
      <label class="order-number">Pedido #${order.order_number}</label>
      <span class="check-icon">✓</span>
    `;
  }

  selectedOrders.delete(orderId.toString());
}

// ============================================================================
// UI HELPERS
// ============================================================================

function updateUI() {
  const hasSelection = selectedOrders.size > 0;
  createBtn.disabled = !hasSelection || processing;
  
  const allSelected = selectedOrders.size === document.querySelectorAll('input[type="checkbox"]:not(:disabled)').length;
  selectAllBtn.textContent = allSelected ? 'Deseleccionar Todos' : 'Seleccionar Todos';
  
  if (processing) {
    createBtn.textContent = 'Procesando...';
  } else {
    createBtn.textContent = hasSelection ? `Crear ${selectedOrders.size} Guía(s)` : 'Crear Guías';
  }
}

function showStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'flex';
  statusEl.textContent = message;
}

function hideStatus() {
  statusEl.style.display = 'none';
}

function showEmptyState() {
  ordersContainer.innerHTML = `
    <div style="text-align:center; padding:40px; color:#999;">
      <div style="font-size:48px; margin-bottom:10px;">📭</div>
      <p>No hay pedidos pendientes</p>
      <p style="font-size:11px; margin-top:5px;">
        Todos los pedidos tienen tracking asignado
      </p>
    </div>
  `;
}
