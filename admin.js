/**
 * DONFAREz - Panel de Administración
 * JavaScript de Gestión del Catálogo y Control de Productos
 */

// Estado global de la aplicación
let isLoggedIn = false;
let allProducts = [];
let editingProductId = null;
let productPendingDeleteId = null;

// Mapa de etiquetas legibles para categorías
const CATEGORY_NAMES = {
  muebles: 'Muebles',
  electrodomesticos: 'Electrodomésticos',
  tecnologia: 'Tecnología',
  hogar: 'Hogar',
  cocina: 'Cocina',
  jardin: 'Jardín'
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkCurrentSession();
});

function setupEventListeners() {
  // Conmutar visibilidad de contraseña
  const togglePwdBtn = document.getElementById('togglePasswordBtn');
  const pwdInput = document.getElementById('loginPassword');
  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      togglePwdBtn.innerHTML = isPassword 
        ? '<i class="fa-regular fa-eye-slash"></i>' 
        : '<i class="fa-regular fa-eye"></i>';
    });
  }

  // Confirmar eliminación en el modal
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', executeDeleteProduct);
  }

  // Cerrar modales con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
    }
  });
}

/**
 * Intenta verificar si ya existe una sesión activa al cargar la página
 */
async function checkCurrentSession() {
  try {
    const res = await fetch('/api/admin/products', {
      method: 'GET',
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      isLoggedIn = true;
      showDashboardView();
      allProducts = Array.isArray(data) ? data : (data.products || []);
      updateStats();
      renderProductsTable(allProducts);
    } else {
      showLoginView();
    }
  } catch (err) {
    showLoginView();
  }
}

// ==========================================================================
// AUTENTICACIÓN
// ==========================================================================

/**
 * Iniciar sesión con contraseña administrativa
 */
async function login() {
  const passwordInput = document.getElementById('loginPassword');
  const errorBox = document.getElementById('loginErrorMsg');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!password) {
    displayLoginError('Por favor ingresa la contraseña.');
    return;
  }

  if (errorBox) errorBox.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando...';
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ password })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success !== false) {
      isLoggedIn = true;
      if (passwordInput) passwordInput.value = '';
      showDashboardView();
      showToast('¡Bienvenido al Panel de DONFAREz!', 'success');
      await loadProducts();
    } else {
      const msg = data.message || 'Contraseña incorrecta. Inténtalo nuevamente.';
      displayLoginError(msg);
      showToast(msg, 'error');
    }
  } catch (err) {
    console.error('Error durante el inicio de sesión:', err);
    displayLoginError('Error al comunicarse con el servidor.');
    showToast('Error de red al intentar iniciar sesión', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión';
    }
  }
}

function displayLoginError(msg) {
  const errorBox = document.getElementById('loginErrorMsg');
  if (errorBox) {
    errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
    errorBox.style.display = 'flex';
  }
}

/**
 * Cerrar sesión administrativa
 */
async function logout() {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    console.warn('Advertencia al cerrar sesión en servidor:', err);
  } finally {
    isLoggedIn = false;
    allProducts = [];
    showLoginView();
    showToast('Sesión cerrada correctamente', 'info');
  }
}

function showLoginView() {
  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  if (loginSection) loginSection.style.display = 'flex';
  if (dashboardSection) dashboardSection.style.display = 'none';
}

function showDashboardView() {
  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  if (loginSection) loginSection.style.display = 'none';
  if (dashboardSection) dashboardSection.style.display = 'flex';
}

// ==========================================================================
// CARGA Y RENDERIZADO DE PRODUCTOS
// ==========================================================================

/**
 * Obtener todos los productos del servidor
 */
async function loadProducts() {
  const tbody = document.getElementById('productsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="table-loading">
          <i class="fa-solid fa-spinner fa-spin"></i> Cargando productos...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch('/api/admin/products', {
      method: 'GET',
      credentials: 'include'
    });

    if (res.status === 401 || res.status === 403) {
      showToast('Sesión expirada o no autorizada', 'warning');
      logout();
      return;
    }

    if (!res.ok) {
      throw new Error(`Error en servidor (${res.status})`);
    }

    const data = await res.json();
    allProducts = Array.isArray(data) ? data : (data.products || []);
    
    updateStats();
    handleFilterChange();
  } catch (err) {
    console.error('Error al cargar productos:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty">
            <i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i>
            <p>No se pudo obtener el catálogo de productos.</p>
            <button class="btn btn-secondary btn-sm" onclick="loadProducts()" style="margin-top:0.75rem;">
              <i class="fa-solid fa-rotate"></i> Reintentar
            </button>
          </td>
        </tr>
      `;
    }
    showToast('Error al cargar productos desde el servidor', 'error');
  }
}

/**
 * Renderizar filas de la tabla de productos
 */
function renderProductsTable(products) {
  const tbody = document.getElementById('productsTableBody');
  const countLabel = document.getElementById('tableRecordCount');

  if (!tbody) return;

  if (countLabel) {
    const totalCount = products ? products.length : 0;
    countLabel.textContent = `Mostrando ${totalCount} de ${allProducts.length} productos`;
  }

  if (!products || products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">
          <i class="fa-solid fa-box-open"></i>
          <p>No se encontraron productos registrados o coincidentes con los filtros.</p>
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = products.map(product => {
    const id = product.id ?? product._id;
    const name = escapeHtml(product.name || 'Sin nombre');
    const categoryKey = (product.category || '').toLowerCase();
    const categoryLabel = CATEGORY_NAMES[categoryKey] || product.category || 'General';
    const price = Number(product.price) || 0;
    const originalPrice = product.original_price || product.originalPrice;
    const hasOriginal = originalPrice && Number(originalPrice) > price;
    const isActive = product.is_active !== false && product.active !== false && product.isActive !== false;
    const emoji = product.emoji ? escapeHtml(product.emoji) : '📦';
    const desc = escapeHtml(product.description || '');

    // Resolución de imagen
    let imageSrc = null;
    const rawImage = product.image || product.image_url || product.imageUrl;
    if (rawImage) {
      if (rawImage.startsWith('http://') || rawImage.startsWith('https://') || rawImage.startsWith('/uploads/') || rawImage.startsWith('data:')) {
        imageSrc = rawImage;
      } else {
        imageSrc = `/uploads/${rawImage}`;
      }
    }

    // Badge
    const badgeType = product.badge;
    const badgeCustomText = product.badge_text || product.badgeText;
    let badgeHtml = '';
    if (badgeType && badgeType !== 'none') {
      let badgeLabel = badgeCustomText;
      if (!badgeLabel) {
        if (badgeType === 'sale') badgeLabel = 'Oferta';
        else if (badgeType === 'new') badgeLabel = 'Nuevo';
        else if (badgeType === 'hot') badgeLabel = 'Popular';
        else badgeLabel = badgeType;
      }
      badgeHtml = `<span class="product-badge-pill badge-${escapeHtml(badgeType)}">${escapeHtml(badgeLabel)}</span>`;
    }

    return `
      <tr data-id="${id}">
        <!-- Visual -->
        <td>
          <div class="product-visual-cell">
            ${imageSrc 
              ? `<img src="${imageSrc}" alt="${name}" class="product-thumb" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'product-emoji\\'>${emoji}</span>';">`
              : `<span class="product-emoji">${emoji}</span>`
            }
          </div>
        </td>

        <!-- Nombre e Info -->
        <td>
          <div class="product-name-info">
            <span class="product-name-title">${name}</span>
            ${desc ? `<span class="product-desc-snippet" title="${desc}">${desc}</span>` : ''}
            ${badgeHtml}
          </div>
        </td>

        <!-- Categoría -->
        <td>
          <span class="category-tag">
            <i class="fa-solid fa-tag"></i> ${escapeHtml(categoryLabel)}
          </span>
        </td>

        <!-- Precio Actual -->
        <td>
          <span class="price-current">${formatPrice(price)}</span>
        </td>

        <!-- Precio Original -->
        <td>
          ${hasOriginal ? `<span class="price-original">${formatPrice(originalPrice)}</span>` : '<span style="color:var(--text-light); font-size:0.85rem;">—</span>'}
        </td>

        <!-- Estado / Toggle -->
        <td style="text-align: center;">
          <div class="status-badge-wrap">
            <label class="switch-container" title="${isActive ? 'Desactivar producto' : 'Activar producto'}">
              <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleActive('${id}', this)">
              <span class="switch-slider"></span>
            </label>
            <span class="status-label-text ${isActive ? 'status-label-active' : 'status-label-inactive'}">
              ${isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </td>

        <!-- Acciones -->
        <td style="text-align: right;">
          <div class="action-buttons">
            <button type="button" class="btn-action btn-edit" title="Editar producto" onclick="openEditModal('${id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button type="button" class="btn-action btn-delete" title="Eliminar producto" onclick="deleteProduct('${id}')">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}

/**
 * Actualizar las tarjetas de estadísticas superiores
 */
function updateStats() {
  const totalProducts = allProducts.length;
  const activeProducts = allProducts.filter(p => p.is_active !== false && p.active !== false && p.isActive !== false).length;
  
  const categoriesSet = new Set();
  let saleCount = 0;

  allProducts.forEach(p => {
    if (p.category) {
      categoriesSet.add(p.category.toLowerCase().trim());
    }
    const hasDiscount = (p.original_price && Number(p.original_price) > Number(p.price)) ||
                        (p.originalPrice && Number(p.originalPrice) > Number(p.price)) ||
                        p.badge === 'sale';
    if (hasDiscount) {
      saleCount++;
    }
  });

  const totalEl = document.getElementById('statTotalProducts');
  const activeEl = document.getElementById('statActiveProducts');
  const catEl = document.getElementById('statCategories');
  const saleEl = document.getElementById('statSaleProducts');

  if (totalEl) totalEl.textContent = totalProducts;
  if (activeEl) activeEl.textContent = activeProducts;
  if (catEl) catEl.textContent = categoriesSet.size;
  if (saleEl) saleEl.textContent = saleCount;
}

// ==========================================================================
// FILTROS Y BÚSQUEDA
// ==========================================================================

function handleFilterChange() {
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const clearBtn = document.getElementById('clearSearchBtn');

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
  const selectedStatus = statusFilter ? statusFilter.value : 'all';

  if (clearBtn) {
    clearBtn.style.display = query.length > 0 ? 'inline-block' : 'none';
  }

  const filtered = allProducts.filter(p => {
    // Filtro por búsqueda
    const nameMatch = (p.name || '').toLowerCase().includes(query);
    const descMatch = (p.description || '').toLowerCase().includes(query);
    if (query && !nameMatch && !descMatch) {
      return false;
    }

    // Filtro por categoría
    if (selectedCategory !== 'all') {
      const pCat = (p.category || '').toLowerCase();
      if (pCat !== selectedCategory) return false;
    }

    // Filtro por estado
    const isActive = p.is_active !== false && p.active !== false && p.isActive !== false;
    if (selectedStatus === 'active' && !isActive) return false;
    if (selectedStatus === 'inactive' && isActive) return false;

    return true;
  });

  renderProductsTable(filtered);
}

function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    handleFilterChange();
    searchInput.focus();
  }
}

// ==========================================================================
// MODAL DE PRODUCTO (AGREGAR / EDITAR)
// ==========================================================================

/**
 * Abrir modal en modo Agregar
 */
function openAddModal() {
  editingProductId = null;
  resetProductForm();

  const titleEl = document.getElementById('modalTitle');
  const iconEl = document.getElementById('modalHeaderIcon');
  if (titleEl) titleEl.textContent = 'Agregar Nuevo Producto';
  if (iconEl) iconEl.className = 'fa-solid fa-circle-plus';

  showModal();
}

/**
 * Abrir modal en modo Editar con datos cargados
 */
function openEditModal(id) {
  const product = allProducts.find(p => String(p.id ?? p._id) === String(id));
  if (!product) {
    showToast('No se encontró el producto a editar', 'error');
    return;
  }

  editingProductId = id;
  resetProductForm();

  const titleEl = document.getElementById('modalTitle');
  const iconEl = document.getElementById('modalHeaderIcon');
  if (titleEl) titleEl.textContent = 'Editar Producto';
  if (iconEl) iconEl.className = 'fa-solid fa-pen-to-square';

  // Llenar campos
  setValue('prodName', product.name || '');
  setValue('prodCategory', (product.category || '').toLowerCase());
  setValue('prodEmoji', product.emoji || '');
  setValue('prodPrice', product.price ?? '');
  setValue('prodOriginalPrice', product.original_price ?? product.originalPrice ?? '');
  setValue('prodBadge', product.badge || '');
  setValue('prodBadgeText', product.badge_text || product.badgeText || '');
  setValue('prodDescription', product.description || '');

  const isActive = product.is_active !== false && product.active !== false && product.isActive !== false;
  const activeCheckbox = document.getElementById('prodActive');
  if (activeCheckbox) activeCheckbox.checked = isActive;

  // Vista previa de imagen existente
  const rawImage = product.image || product.image_url || product.imageUrl;
  if (rawImage) {
    let src = rawImage;
    if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/uploads/') && !src.startsWith('data:')) {
      src = `/uploads/${src}`;
    }
    setExistingImagePreview(src);
  }

  showModal();
}

function showModal() {
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    const firstInput = document.getElementById('prodName');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }
}

function closeModal() {
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
  editingProductId = null;
  resetProductForm();
}

function handleModalBackdropClick(event) {
  if (event.target && event.target.id === 'productModal') {
    closeModal();
  }
}

function resetProductForm() {
  const form = document.getElementById('productForm');
  if (form) form.reset();

  const activeCheckbox = document.getElementById('prodActive');
  if (activeCheckbox) activeCheckbox.checked = true;

  clearImagePreview();
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function handleBadgeSelectChange() {
  const badgeSelect = document.getElementById('prodBadge');
  const badgeTextInput = document.getElementById('prodBadgeText');
  if (!badgeSelect || !badgeTextInput) return;

  if (badgeSelect.value === 'sale' && !badgeTextInput.value) {
    badgeTextInput.placeholder = 'Ej. ¡20% OFF!';
  } else if (badgeSelect.value === 'new' && !badgeTextInput.value) {
    badgeTextInput.placeholder = 'Ej. Recién llegado';
  } else if (badgeSelect.value === 'hot' && !badgeTextInput.value) {
    badgeTextInput.placeholder = 'Ej. Más vendido';
  }
}

// ==========================================================================
// MANEJO DE IMÁGENES (PREVIEW & UPLOAD)
// ==========================================================================

function handleImagePreview(input) {
  if (!input || !input.files || input.files.length === 0) {
    return;
  }

  const file = input.files[0];
  if (!file.type.startsWith('image/')) {
    showToast('El archivo seleccionado debe ser una imagen válida', 'warning');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    displayImagePreview(e.target.result);
  };
  reader.readAsDataURL(file);
}

function displayImagePreview(src) {
  const previewContainer = document.getElementById('imagePreviewContainer');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const previewImg = document.getElementById('imagePreview');

  if (previewImg) previewImg.src = src;
  if (previewContainer) previewContainer.style.display = 'inline-block';
  if (dropzonePrompt) dropzonePrompt.style.display = 'none';
}

function setExistingImagePreview(src) {
  displayImagePreview(src);
}

function clearImagePreview() {
  const previewContainer = document.getElementById('imagePreviewContainer');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const previewImg = document.getElementById('imagePreview');
  const fileInput = document.getElementById('prodImage');

  if (fileInput) fileInput.value = '';
  if (previewImg) previewImg.src = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (dropzonePrompt) dropzonePrompt.style.display = 'flex';
}

function removeImageSelection(e) {
  if (e) e.stopPropagation();
  clearImagePreview();
}

// ==========================================================================
// GUARDAR / CREAR / EDITAR PRODUCTO (API)
// ==========================================================================

async function saveProduct() {
  const name = (document.getElementById('prodName')?.value || '').trim();
  const category = document.getElementById('prodCategory')?.value || '';
  const price = document.getElementById('prodPrice')?.value;
  const originalPrice = document.getElementById('prodOriginalPrice')?.value;
  const description = (document.getElementById('prodDescription')?.value || '').trim();
  const badge = document.getElementById('prodBadge')?.value || '';
  const badgeText = (document.getElementById('prodBadgeText')?.value || '').trim();
  const emoji = (document.getElementById('prodEmoji')?.value || '').trim();
  const isActive = document.getElementById('prodActive')?.checked;
  const imageInput = document.getElementById('prodImage');
  const saveBtn = document.getElementById('saveProductBtn');

  // Validaciones
  if (!name) {
    showToast('El nombre del producto es obligatorio', 'warning');
    return;
  }
  if (!category) {
    showToast('Debes seleccionar una categoría', 'warning');
    return;
  }
  if (price === '' || isNaN(price) || Number(price) < 0) {
    showToast('Ingresa un precio de venta válido', 'warning');
    return;
  }

  // Construir FormData para multipart
  const formData = new FormData();
  formData.append('name', name);
  formData.append('category', category);
  formData.append('price', price);
  if (originalPrice !== '' && !isNaN(originalPrice)) {
    formData.append('original_price', originalPrice);
    formData.append('originalPrice', originalPrice);
  }
  formData.append('description', description);
  formData.append('badge', badge);
  formData.append('badge_text', badgeText);
  formData.append('badgeText', badgeText);
  formData.append('emoji', emoji);
  formData.append('is_active', isActive ? 'true' : 'false');
  formData.append('active', isActive ? 'true' : 'false');

  if (imageInput && imageInput.files && imageInput.files[0]) {
    formData.append('image', imageInput.files[0]);
  }

  const isEditing = editingProductId !== null;
  const url = isEditing ? `/api/admin/products/${editingProductId}` : '/api/admin/products';
  const method = isEditing ? 'PUT' : 'POST';

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const res = await fetch(url, {
      method: method,
      credentials: 'include',
      body: formData
    });

    if (res.status === 401 || res.status === 403) {
      showToast('Sesión no autorizada o expirada', 'error');
      logout();
      return;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Error del servidor (${res.status})`);
    }

    const message = isEditing ? 'Producto actualizado correctamente' : 'Producto creado exitosamente';
    showToast(message, 'success');
    closeModal();
    await loadProducts();
  } catch (err) {
    console.error('Error al guardar producto:', err);
    showToast(`Error al guardar: ${err.message}`, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Producto';
    }
  }
}

// ==========================================================================
// ELIMINAR PRODUCTO (MODAL Y API)
// ==========================================================================

function deleteProduct(id) {
  const product = allProducts.find(p => String(p.id ?? p._id) === String(id));
  const productName = product ? product.name : 'este producto';

  productPendingDeleteId = id;
  const nameEl = document.getElementById('deleteProductName');
  if (nameEl) nameEl.textContent = `"${productName}"`;

  const deleteModal = document.getElementById('deleteConfirmModal');
  if (deleteModal) {
    deleteModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeDeleteModal() {
  const deleteModal = document.getElementById('deleteConfirmModal');
  if (deleteModal) {
    deleteModal.style.display = 'none';
    document.body.style.overflow = '';
  }
  productPendingDeleteId = null;
}

async function executeDeleteProduct() {
  if (!productPendingDeleteId) return;

  const btn = document.getElementById('confirmDeleteBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Eliminando...';
  }

  try {
    const res = await fetch(`/api/admin/products/${productPendingDeleteId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (res.status === 401 || res.status === 403) {
      showToast('Sesión expirada o no autorizada', 'error');
      logout();
      return;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al eliminar el producto');
    }

    showToast('Producto eliminado exitosamente', 'success');
    closeDeleteModal();
    await loadProducts();
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    showToast(`Error al eliminar: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Eliminar';
    }
  }
}

// ==========================================================================
// CONMUTAR ESTADO ACTIVO/INACTIVO DIRECTAMENTE
// ==========================================================================

async function toggleActive(id, checkboxEl) {
  const product = allProducts.find(p => String(p.id ?? p._id) === String(id));
  if (!product) return;

  const newStatus = checkboxEl ? checkboxEl.checked : !product.is_active;

  // Actualizar UI optimistamente
  product.is_active = newStatus;
  product.active = newStatus;
  updateStats();

  try {
    const formData = new FormData();
    formData.append('is_active', newStatus ? 'true' : 'false');
    formData.append('active', newStatus ? 'true' : 'false');

    // Mantener campos existentes si la API requiere payload
    if (product.name) formData.append('name', product.name);
    if (product.category) formData.append('category', product.category);
    if (product.price) formData.append('price', product.price);

    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData
    });

    if (!res.ok) {
      throw new Error('No se pudo actualizar el estado');
    }

    showToast(newStatus ? 'Producto marcado como Activo' : 'Producto desactivado', 'info');
  } catch (err) {
    console.error('Error al cambiar estado activo:', err);
    // Revertir checkbox
    if (checkboxEl) checkboxEl.checked = !newStatus;
    product.is_active = !newStatus;
    product.active = !newStatus;
    updateStats();
    showToast('Error al actualizar disponibilidad del producto', 'error');
  }
}

// ==========================================================================
// UTILIDADES: TOAST, FORMATEO Y SEGURIDAD
// ==========================================================================

/**
 * Mostrar notificación Toast en pantalla
 * @param {string} msg 
 * @param {'success'|'error'|'warning'|'info'} type 
 */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `admin-toast ${type}`;

  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'success') iconClass = 'fa-solid fa-circle-check';
  else if (type === 'error') iconClass = 'fa-solid fa-triangle-exclamation';
  else if (type === 'warning') iconClass = 'fa-solid fa-circle-exclamation';

  toast.innerHTML = `
    <i class="${iconClass}"></i>
    <span class="admin-toast-message">${escapeHtml(msg)}</span>
  `;

  container.appendChild(toast);

  // Trigger animación
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remover tras 3.5 segundos
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3500);
}

/**
 * Formatear número como Soles Peruanos (PEN / S/)
 * @param {number|string} n 
 * @returns {string}
 */
function formatPrice(n) {
  const num = Number(n) || 0;
  return 'S/ ' + num.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Escapar cadenas para prevenir XSS
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
