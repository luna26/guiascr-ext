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
let senderConfig = null;

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
      //loader
      showLoader()
      accessKey = result.accessKey;
      showMainScreen();
      await loadOrders();
      await getSenderConfig();
      fillSenderForm()
    } else {
      showConfigScreen();
    }
  });
}

// Guardar access key
saveKeyBtn.addEventListener('click', async () => {
  const key = accessKeyInput.value.trim();

  if (!key) {
    notification('Por favor ingresa un access key', false)
    // alert('Por favor ingresa un access key');
    return;
  }

  if (!key.startsWith('sk_')) {
    notification('El access key debe comenzar con "sk_"', false)
    // alert('El access key debe comenzar con "sk_"');
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
      notification('Access key inválido', false)
      throw new Error('Access key inválido');
    }

    saveKeyBtn.textContent = 'Guardar y Conectar';
    saveKeyBtn.disabled = false;

    // Guardar
    chrome.storage.sync.set({ accessKey: key }, async () => {
      accessKey = key;
      showMainScreen();
      loadOrders();
      await getSenderConfig();
      fillSenderForm()
    });

    notification('¡Conectado a tu tienda correctamente!')

  } catch (error) {
    notification(`Error: ${error.message}. Verifica tu access key.`, false)
    // alert(`Error: ${error.message}. Verifica tu access key.`);
    saveKeyBtn.disabled = false;
    saveKeyBtn.textContent = 'Guardar y Conectar';
  }
});

//cambiar tipo de destino
document.addEventListener("change", (e) => {
  const target = e.target

  if (target.matches('select[name="destination_type"]')) {
    const orderId = target.getAttribute('order-id')

    orders.filter(({ order_number }) => parseInt(order_number) === parseInt(orderId)).forEach(order => {
      order.destination_type = target.value;
    });
  }
})

function showSenderForm() {
  document.querySelector('.container').classList.add('hidden')
  document.querySelector('.sender-info').classList.remove('hidden')
}

function showContainer() {
  document.querySelector('.container').classList.remove('hidden')
  document.querySelector('.sender-info').classList.add('hidden')
}

//cambiar a pantalla de sender
document.addEventListener("click", (e) => {
  const target = e.target

  if (target.matches('#configSender')) showSenderForm()
  if (target.matches('#back-container')) showContainer()
})

// Cambiar access key
changeKeyLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.storage.sync.remove('accessKey', () => {
    accessKey = null;
    currentShop = null;
    showConfigScreen();
  });
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

    orders = data.orders.map((order) => ({ ...order, destination_type: "Domicilio" }));
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
    notification(error.message, false)
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

  console.log('--- order', order)

  let location = ''
  const canCreate = order.note_attributes.length > 0

  order.note_attributes.forEach(({ name, value }, index) => {
    if (name === "province_id" || name === "county_id" || name === "district_id") return
    location = `${location}${index === 1 ? '' : ', '}${value}`
  })

  div.innerHTML = `
    <div class="order-header">
      <div class="order-header-info">
          ${!isCompleted ? `
          <input ${!canCreate ? 'disabled' : ''} type="checkbox" id="order-${order.id}" data-order-id="${order.id}">
        ` : ''}
        <label for="order-${order.id}" class="order-number">
          Pedido #${order.order_number}
        </label>
        ${isCompleted ? '<span class="check-icon">✓</span>' : ''}
      </div>
      <div>
        <select name="destination_type" id="destination_type" class="form-control" order-id="${order.order_number}">
          <option ${order.destination_type === "Domicilio" ? 'selected' : ''} value="Domicilio">Domicilio</option> 
          <option ${order.destination_type === "Sucursal" ? 'selected' : ''} value="Sucursal">Sucursal</option> 
          <option ${order.destination_type === "PuntoCorreos" ? 'selected' : ''} value="PuntoCorreos">Punto Correos</option>
        </select>
      </div>
    </div>
    <div class="order-details">
      <div class="customer-name">${order.customer.name}</div>
      <div>${location !== '' ? location : 'Pedido no cuenta con provincia, cantón y distrito'}</div>
      <div>${order.shipping_address?.city || 'N/A'} | 
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
      await createGuideInCorreosCR(order);

      // Actualizar Shopify con el tracking
      // await updateShopifyTracking(orderId, tracking);

      // Marcar como completado
      markOrderAsCompleted(orderId);
      completed++;

    } catch (error) {
      notification(`Error processing order ${orderId}: ${error}`)
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
  // const senderConfig = await getSenderConfig();

  // Construir payload
  const payload = buildCorreosCRPayload(order, token);

  console.log('-------- payload', await payload)

  if (!senderConfig) {
    throw new Error('Configura los datos del remitente en la app de Shopify primero.');
  }

  // Hacer POST con XMLHttpRequest
  // return new Promise((resolve, reject) => {
  //   const xhr = new XMLHttpRequest();
  //   xhr.open('POST', CORREOS_CR_URL, true);
  //   xhr.withCredentials = true;
  //   xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

  //   xhr.onload = function() {
  //     if (xhr.status >= 200 && xhr.status < 300) {
  //       try {
  //         const result = JSON.parse(xhr.responseText);
  //         const trackingNumber = result.tracking_number || result.guide_number || result.id || 'TRACKING-' + Date.now();
  //         resolve(trackingNumber);
  //       } catch (e) {
  //         console.error('Error parsing response:', e);
  //         console.log('Raw response:', xhr.responseText);
  //         resolve('TRACKING-' + Date.now());
  //       }
  //     } else {
  //       reject(new Error(`Error al crear guía en Correos CR (Status: ${xhr.status})`));
  //     }
  //   };

  //   xhr.onerror = function() {
  //     reject(new Error('Error de red al crear guía en Correos CR'));
  //   };

  //   xhr.ontimeout = function() {
  //     reject(new Error('Timeout al crear guía en Correos CR'));
  //   };

  //   const formData = new URLSearchParams(payload).toString();
  //   xhr.send(formData);
  // });
}

async function getxsrfToken() {
  console.log('🔵 Solicitando cookie...');

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'getCookie', name: 'XSRF-TOKEN' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Chrome error:', chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
          return;
        }

        if (!response) {
          console.error('❌ No hay respuesta del background');
          reject(new Error('No response from background'));
          return;
        }

        if (response.value) {
          console.log('✅ Token obtenido:', response.value);
          resolve(response.value);
        } else {
          console.log('❌ No se obtuvo el token');
          console.log('Cookies disponibles:', response.available);
          reject(new Error(response.error || 'Cookie not found'));
        }
      }
    );
  });
}

async function getCounties(provinceCode) {
  return await getData('https://sucursal.correos.go.cr/web/canton', `{ "provincia": "${provinceCode}"}`)
}

async function getDistricts(provinceCode, county) {
  return await getData('https://sucursal.correos.go.cr/web/distrito', `{"provincia":"${provinceCode}","canton":"${county}","tip":""}`)
}

async function getPostalCode(province, county, district) {
  return await getData('https://sucursal.correos.go.cr/web/codigo', `{"provincia":"${province}","distrito":"${district}","canton":"${county}"}`)
}


//mapea el canton con el id de correos
async function mapCounty(note_attributes) {
  let countyCode = null
  let provinceCode = null

  note_attributes.filter(({ name, value }) => {
    if (name === 'county_id') countyCode = value
    if (name === 'province_id') provinceCode = value
  })

  if (countyCode && provinceCode) {
    const counties = await getCounties(provinceCode)
    return counties.filter(({ cod_canton }) => parseInt(cod_canton) === parseInt(countyCode))
  }
}

//mapea el distrito con el id de correos
async function mapDistrict(note_attributes, county) {
  let districtCode = null
  let provinceCode = null

  note_attributes.filter(({ name, value }) => {
    if (name === 'district_id') districtCode = value
    if (name === 'province_id') provinceCode = value
  })

  if (county && provinceCode) {
    const districts = await getDistricts(provinceCode, county)
    return districts.filter(({ postal_code }) => parseInt(postal_code) === parseInt(districtCode))
  }
}

async function getData(url, payload) {
  const token = await getCSRFToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('accept', 'application/json, text/plain, */*');
    xhr.setRequestHeader('x-requested-with', 'XMLHttpRequest');
    xhr.setRequestHeader('x-csrf-token', token);

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch (e) {
          notification('Error al cargar info', false)
          console.error('Error parsing response:', e);
          console.log('Raw response:', xhr.responseText);
        }
      } else {
        notification('Error al cargar info', false)
        reject(new Error(`Error al cargar info`));
      }
    };

    xhr.onerror = function () {
      notification('Error al cargar info', false)
      reject(new Error('Error al cargar info'));
    };

    xhr.ontimeout = function () {
      notification('Error al cargar info', false)
      reject(new Error('Timeout al cargar info'));
    };

    xhr.send(payload);
  });
}

// Construir payload para Correos CR
async function buildCorreosCRPayload(order, token) {
  const shipping = order.shipping_address;
  const county = await mapCounty(order.note_attributes)
  const district = await mapDistrict(order.note_attributes, county[0].id)
  const provinceId = order.note_attributes.filter(({ name, value }) => name === 'province_id' ? value : null)
  const zipCode = order.note_attributes.filter(({ name, value }) => name === 'district_id' ? value : null)

  if (!zipCode[0] || !provinceId[0] || !county[0] || !district[0]) {
    notification('Problema al mapear provincia, cantón o distrito', false)
    // alert('Problema al mapear provincia, cantón o distrito')
  }

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
    destination_id: '',
    destination_name: `${shipping.first_name} ${shipping.last_name}`.toUpperCase(),
    destination_phone: order.customer.phone,
    destination_type: order.destination_type,

    // Ubicación del destinatario
    provincia: provinceId[0].value,
    canton: county[0].id,
    distrito: district[0].id,
    postal_code: zipCode[0].value,
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
    const tabs = await chrome.tabs.query({
      url: 'https://sucursal.correos.go.cr/*',
      active: true,
      currentWindow: true
    });

    if (tabs.length === 0) {
      notification('No hay pestañas de Correos CR abiertas', false)
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
    notification('No se encuentra logueado en correos de CR', false)
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

async function getSenderConfig() {
  try {
    const response = await fetch(`${API_URL}/sender-config`, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${accessKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      notification('Verifique o complete la información', false)
      showSenderForm()

      throw new Error('Error al obtener información de remitente');
    }

    const data = await response.json();
    senderConfig = data.config
    showLoader(false)

  } catch (error) {
    showLoader(false)
    notification(error.message, false)
  }
}

//update sender
document.querySelector('#sender-info-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  // Obtener TODOS los valores del form
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  const { provinciaSender, cantonSender, distritoSender } = data
  const zipCode = await getPostalCode(provinciaSender, cantonSender, distritoSender)

  data.senderPostalCode = zipCode.postal_code

  //loading 
  document.querySelector('#send-sender').textContent = 'Guardando'

  // Enviar
  try {
    const response = await fetch(`${API_URL}/sender-config`, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${accessKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      notification('Error al guardar información', false)
      throw new Error('Error al guardar información');
    }

    notification('Información actualizada')
    showContainer()
    getSenderConfig()

  } catch (error) {
    notification(error.message, false)
  }

  document.querySelector('#send-sender').textContent = 'Enviar'
});

/**
 * Modulo para popular dropdowns con provincia, canton y distrito
 */

document.addEventListener("change", (e) => {
  const target = e.target

  if (target.matches('select#provinciaSender')) {
    const provinceId = target.value
    populateCantones(provinceId)
  }

  if (target.matches('select#cantonSender')) {
    const cantonId = target.value
    const province_id = document.querySelector('select#provinciaSender').value

    populateDistritos(province_id, cantonId)
  }
})

// Poblar cantones según provincia seleccionada
async function populateCantones(provinciaId) {
  const select = document.getElementById('cantonSender');
  select.disabled = false;

  //limpiamos cantones
  select.innerHTML = ''

  const cantones = await getCounties(provinciaId)

  cantones.forEach(canton => {
    const option = document.createElement('option');
    option.value = canton.id;
    option.textContent = canton.name;
    select.appendChild(option);
  });

  // Resetear distrito
  const distritoSelect = document.getElementById('distritoSender');
  distritoSelect.innerHTML = '<option value="">Primero selecciona un cantón</option>';
  distritoSelect.disabled = true;
}

async function populateDistritos(provinciaId, cantonId) {
  const select = document.getElementById('distritoSender');
  select.innerHTML = '<option value="">Selecciona un distrito</option>';
  select.disabled = false;

  //limpiamos
  select.innerHTML = ''

  const distritos = await getDistricts(provinciaId, cantonId)

  distritos.forEach(distrito => {
    const option = document.createElement('option');
    option.value = distrito.id;
    option.textContent = distrito.name;
    select.appendChild(option);
  });

  selectedDistrito = null;
}

/**
 * Rellenar formulario de remitente
 */
async function fillSenderForm() {
  if (senderConfig) {
    await populateCantones(senderConfig.provinciaSender)
    await populateDistritos(senderConfig.provinciaSender, senderConfig.cantonSender)

    Object.keys(senderConfig).forEach((key) => {
      const input = document.querySelector(`[name="${key}"]`)

      if (input) input.value = senderConfig[key]
    })
  }
}

//loader
function showLoader(show = true) {
  document.querySelector('.overlay-loader').classList[show ? 'remove' : 'add']('hidden')
}

//notifications
function notification(text, success = true) {
  const randomNumber = Math.floor(Math.random() * 10000) + 1
  const selector = `notification-${randomNumber}`

  document.querySelectorAll('.notification').forEach((notification) => notification.remove())

  document.body.insertAdjacentHTML('afterbegin', `<div class="notification ${selector} ${success ? 'success' : 'error'}">
      <p>${text}</p>
    </div>`)

  setTimeout(() => {
    const notification = document.querySelector(`.${selector}`)
    if (notification) notification.remove()
  }, 3000)
}