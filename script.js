/* ============================================
   DONFAREz — JavaScript (conectado al servidor)
   ============================================ */

// ========== STATE ==========
let products = [];
let cart = JSON.parse(localStorage.getItem('donfarez_cart')) || [];
let modalQty = 1;
let currentModalProduct = null;

// ========== DOM ==========
const productsGrid = document.getElementById('productsGrid');
const cartBtn = document.getElementById('cartBtn');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');
const cartItems = document.getElementById('cartItems');
const cartFooter = document.getElementById('cartFooter');
const cartCount = document.getElementById('cartCount');
const totalAmount = document.getElementById('totalAmount');
const scrollTopBtn = document.getElementById('scrollTop');
const navbar = document.getElementById('navbar');
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
const productModal = document.getElementById('productModal');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('searchInput');

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    updateCartUI();
    startCountdown();
    setupEventListeners();
});

// ========== LOAD PRODUCTS FROM SERVER ==========
async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        if (res.ok) {
            products = await res.json();
        } else {
            console.error('Error cargando productos');
            products = [];
        }
    } catch (err) {
        console.error('Error de conexión:', err);
        products = [];
    }
    renderProducts('todos');
}

// ========== RENDER PRODUCTS ==========
function getProductImage(p) {
    if (p.image) {
        return `<img src="/uploads/${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">`;
    }
    return `<span style="font-size:4rem">${p.emoji || '📦'}</span>`;
}

function renderProducts(filter) {
    const filtered = filter === 'todos' ? products : products.filter(p => p.category === filter);

    if (filtered.length === 0) {
        productsGrid.innerHTML = '<p style="text-align:center;grid-column:1/-1;padding:60px 20px;color:#718096;font-size:1.1rem;">No hay productos disponibles en esta categoría.</p>';
        return;
    }

    productsGrid.innerHTML = filtered.map(p => `
        <div class="product-card" data-id="${p.id}" data-category="${p.category}">
            <div class="product-image">
                ${p.badge ? `<span class="product-badge badge-${p.badge}">${p.badgeText}</span>` : ''}
                ${getProductImage(p)}
                <div class="product-actions">
                    <button class="product-action-btn" onclick="event.stopPropagation(); openModal(${p.id})" title="Vista rápida">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="product-action-btn" onclick="event.stopPropagation(); addToCart(${p.id})" title="Agregar al carrito">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <div class="product-category">${getCategoryLabel(p.category)}</div>
                <div class="product-name">${p.name}</div>
                <div class="product-rating">
                    <span class="stars">${'★'.repeat(p.rating)}${'☆'.repeat(5 - p.rating)}</span>
                    <span>(${p.reviews})</span>
                </div>
                <div class="product-price">
                    <span class="current-price">${formatPrice(p.price)}</span>
                    ${p.originalPrice ? `<span class="original-price">${formatPrice(p.originalPrice)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    // Click on card opens modal
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = parseInt(card.dataset.id);
            openModal(id);
        });
    });
}

function getCategoryLabel(cat) {
    const labels = {
        muebles: 'Muebles',
        electrodomesticos: 'Electrodomésticos',
        tecnologia: 'Tecnología',
        hogar: 'Hogar y Decoración',
        cocina: 'Cocina',
        jardin: 'Jardín'
    };
    return labels[cat] || cat;
}

function formatPrice(n) {
    return 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ========== FILTERS ==========
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderProducts(btn.dataset.filter);
    });
});

// ========== CATEGORY CARDS ==========
document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
        const cat = card.dataset.category;
        document.getElementById('productos').scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const target = document.querySelector(`.filter-btn[data-filter="${cat}"]`);
            if (target) {
                target.classList.add('active');
                renderProducts(cat);
            }
        }, 500);
    });
});

// ========== CART ==========
function addToCart(id, qty = 1) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            emoji: product.emoji,
            image: product.image,
            qty
        });
    }

    saveCart();
    updateCartUI();
    showToast(`${product.name} agregado al carrito`);
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
}

function updateCartQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(id);
        return;
    }
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('donfarez_cart', JSON.stringify(cart));
}

function getCartItemThumb(item) {
    if (item.image) {
        return `<img src="/uploads/${item.image}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
    }
    return item.emoji || '📦';
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    cartCount.textContent = totalItems;

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-bag"></i>
                <p>Tu carrito está vacío</p>
                <a href="#productos" class="btn btn-outline" onclick="closeCart()">Ver Productos</a>
            </div>`;
        cartFooter.style.display = 'none';
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-image">${getCartItemThumb(item)}</div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${formatPrice(item.price)}</div>
                    <div class="cart-item-qty">
                        <button onclick="updateCartQty(${item.id}, -1)">−</button>
                        <span>${item.qty}</span>
                        <button onclick="updateCartQty(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `).join('');
        cartFooter.style.display = 'block';

        const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        totalAmount.textContent = formatPrice(total);
    }
}

function openCart() {
    cartSidebar.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    cartSidebar.classList.remove('active');
    cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ========== PRODUCT MODAL ==========
function openModal(id) {
    const p = products.find(pr => pr.id === id);
    if (!p) return;
    currentModalProduct = p;
    modalQty = 1;

    const imgHTML = p.image
        ? `<img src="/uploads/${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">`
        : `<span style="font-size:6rem">${p.emoji || '📦'}</span>`;

    document.getElementById('modalImage').innerHTML = imgHTML;
    document.getElementById('modalCategory').textContent = getCategoryLabel(p.category);
    document.getElementById('modalName').textContent = p.name;
    document.getElementById('modalRating').textContent = '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating) + `  (${p.reviews} reseñas)`;
    document.getElementById('modalDescription').textContent = p.description;
    document.getElementById('modalPrice').textContent = formatPrice(p.price);
    document.getElementById('modalOriginal').textContent = p.originalPrice ? formatPrice(p.originalPrice) : '';
    document.getElementById('qtyValue').textContent = modalQty;

    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    productModal.classList.remove('active');
    document.body.style.overflow = '';
    currentModalProduct = null;
}

// ========== COUNTDOWN ==========
function startCountdown() {
    const target = new Date();
    target.setDate(target.getDate() + 7);

    function update() {
        const now = new Date();
        const diff = target - now;
        if (diff <= 0) return;

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('days').textContent = String(d).padStart(2, '0');
        document.getElementById('hours').textContent = String(h).padStart(2, '0');
        document.getElementById('minutes').textContent = String(m).padStart(2, '0');
        document.getElementById('seconds').textContent = String(s).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
}

// ========== TOAST ==========
function showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ========== SEARCH ==========
function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
        renderProducts('todos');
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="todos"]').classList.add('active');
        return;
    }
    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
    );

    productsGrid.innerHTML = filtered.length ? filtered.map(p => `
        <div class="product-card" data-id="${p.id}" data-category="${p.category}">
            <div class="product-image">
                ${p.badge ? `<span class="product-badge badge-${p.badge}">${p.badgeText}</span>` : ''}
                ${getProductImage(p)}
                <div class="product-actions">
                    <button class="product-action-btn" onclick="event.stopPropagation(); openModal(${p.id})"><i class="fas fa-eye"></i></button>
                    <button class="product-action-btn" onclick="event.stopPropagation(); addToCart(${p.id})"><i class="fas fa-cart-plus"></i></button>
                </div>
            </div>
            <div class="product-info">
                <div class="product-category">${getCategoryLabel(p.category)}</div>
                <div class="product-name">${p.name}</div>
                <div class="product-rating">
                    <span class="stars">${'★'.repeat(p.rating)}${'☆'.repeat(5 - p.rating)}</span>
                    <span>(${p.reviews})</span>
                </div>
                <div class="product-price">
                    <span class="current-price">${formatPrice(p.price)}</span>
                    ${p.originalPrice ? `<span class="original-price">${formatPrice(p.originalPrice)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('') : '<p style="text-align:center;grid-column:1/-1;padding:40px;color:#718096;">No se encontraron productos.</p>';

    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => openModal(parseInt(card.dataset.id)));
    });

    document.getElementById('productos').scrollIntoView({ behavior: 'smooth' });
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Cart
    cartBtn.addEventListener('click', openCart);
    cartClose.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    // Checkout con WhatsApp
    document.getElementById('checkoutBtn').addEventListener('click', () => {
        if (cart.length === 0) return;
        let total = 0;
        let msg = '¡Hola DONFAREz! Deseo realizar el siguiente pedido:%0A%0A';
        cart.forEach((item, index) => {
            const subtotal = item.price * item.qty;
            total += subtotal;
            msg += `${index + 1}. *${encodeURIComponent(item.name)}* x${item.qty} - ${encodeURIComponent(formatPrice(subtotal))}%0A`;
        });
        msg += `%0A*Total:* ${encodeURIComponent(formatPrice(total))}%0A%0APor favor, confirmarme la disponibilidad y opciones de entrega.`;
        window.open(`https://wa.me/51996664703?text=${msg}`, '_blank');
        showToast('¡Redirigiendo a WhatsApp para confirmar tu pedido!');
        cart = [];
        saveCart();
        updateCartUI();
        setTimeout(closeCart, 1500);
    });

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeModal();
    });

    document.getElementById('qtyMinus').addEventListener('click', () => {
        if (modalQty > 1) {
            modalQty--;
            document.getElementById('qtyValue').textContent = modalQty;
        }
    });

    document.getElementById('qtyPlus').addEventListener('click', () => {
        modalQty++;
        document.getElementById('qtyValue').textContent = modalQty;
    });

    document.getElementById('modalAddCart').addEventListener('click', () => {
        if (currentModalProduct) {
            addToCart(currentModalProduct.id, modalQty);
            closeModal();
        }
    });

    // Navbar scroll
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
        scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
    });

    // Scroll top
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Mobile menu
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => navLinks.classList.remove('active'));
    });

    // Search
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    document.querySelector('.search-btn').addEventListener('click', handleSearch);

    // Newsletter
    document.getElementById('newsletterForm').addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('¡Suscripción exitosa! Revisa tu correo.');
        e.target.reset();
    });

    // Contact
    document.getElementById('contactForm').addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('¡Mensaje enviado! Te responderemos pronto.');
        e.target.reset();
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeCart();
        }
    });
}
