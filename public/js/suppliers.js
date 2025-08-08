// ============================
// VARIABLES GLOBALES PARA SUPPLIERS
// ============================
let suppliers = [];
let filteredSuppliers = [];
let currentSupplier = null;
let currentProduct = null;
let isEditMode = false;

// ============================
// FUNCIONES DE INICIALIZACIÓN
// ============================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Suppliers module initialized');
    initializeSuppliers();
    setupEventListeners();
});

function initializeSuppliers() {
    loadSuppliers();
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // Sort functionality
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', handleSort);
    }
    
    // Modal event listeners
    setupModalListeners();
    
    // Form event listeners
    setupFormListeners();
}

function setupModalListeners() {
    // Close modals when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            if (e.target.id === 'supplier-modal') closeSupplierModal();
            if (e.target.id === 'products-modal') closeProductsModal();
            if (e.target.id === 'product-modal') closeProductModal();
        }
    });
    
    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeSupplierModal();
            closeProductsModal();
            closeProductModal();
        }
    });
}

function setupFormListeners() {
    // Supplier form
    const supplierForm = document.getElementById('supplier-form');
    if (supplierForm) {
        supplierForm.addEventListener('submit', handleSupplierSubmit);
    }
    
    // Product form
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', handleProductSubmit);
    }
}

// ============================
// FUNCIONES DE CARGA DE DATOS
// ============================
async function loadSuppliers() {
    try {
        showLoading();
        const response = await fetchAPI('/suppliers');
        suppliers = response.suppliers || [];
        filteredSuppliers = [...suppliers];
        renderSuppliers();
    } catch (error) {
        console.error('Error loading suppliers:', error);
        showNotification('Error al cargar los proveedores', 'error');
        showEmptyState();
    } finally {
        hideLoading();
    }
}

async function loadSupplierProducts(supplierId) {
    try {
        const response = await fetchAPI(`/suppliers/${supplierId}/products`);
        return response.products || [];
    } catch (error) {
        console.error('Error loading supplier products:', error);
        showNotification('Error al cargar los productos', 'error');
        return [];
    }
}

// ============================
// FUNCIONES DE RENDERIZADO
// ============================
function renderSuppliers() {
    const grid = document.getElementById('suppliers-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (!grid) return;
    
    if (filteredSuppliers.length === 0) {
        grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    grid.innerHTML = filteredSuppliers.map(supplier => createSupplierCard(supplier)).join('');
}

function createSupplierCard(supplier) {
    const productCount = supplier.product_count || 0;
    
    return `
        <div class="supplier-card" data-supplier-id="${supplier.id}">
            <div class="supplier-header">
                <div class="supplier-info">
                    <h3>${escapeHtml(supplier.name)}</h3>
                    ${supplier.contact_person ? 
                        `<div class="contact-person">
                            <i class="fas fa-user"></i>
                            ${escapeHtml(supplier.contact_person)}
                        </div>` : ''
                    }
                </div>
                <div class="supplier-actions">
                    <button class="btn-icon" onclick="openEditSupplierModal(${supplier.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteSupplier(${supplier.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="supplier-details">
                ${supplier.email ? 
                    `<div class="detail-row">
                        <i class="fas fa-envelope"></i>
                        <span>${escapeHtml(supplier.email)}</span>
                    </div>` : ''
                }
                ${supplier.phone ? 
                    `<div class="detail-row">
                        <i class="fas fa-phone"></i>
                        <span>${escapeHtml(supplier.phone)}</span>
                    </div>` : ''
                }
                ${supplier.city && supplier.country ? 
                    `<div class="detail-row">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHtml(supplier.city)}, ${escapeHtml(supplier.country)}</span>
                    </div>` : ''
                }
                ${supplier.payment_terms ? 
                    `<div class="detail-row">
                        <i class="fas fa-credit-card"></i>
                        <span>${escapeHtml(supplier.payment_terms)}</span>
                    </div>` : ''
                }
            </div>
            
            <div class="supplier-stats">
                <div class="products-count">
                    <i class="fas fa-box"></i>
                    <span class="count">${productCount}</span>
                    <span>productos</span>
                </div>
                <button class="view-products-btn" onclick="openProductsModal(${supplier.id})">
                    <i class="fas fa-eye"></i>
                    Ver Productos
                </button>
            </div>
        </div>
    `;
}

function showEmptyState() {
    const grid = document.getElementById('suppliers-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (grid) grid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
}

// ============================
// FUNCIONES DE BÚSQUEDA Y FILTRADO
// ============================
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
        filteredSuppliers = [...suppliers];
    } else {
        filteredSuppliers = suppliers.filter(supplier => 
            supplier.name.toLowerCase().includes(query) ||
            (supplier.contact_person && supplier.contact_person.toLowerCase().includes(query)) ||
            (supplier.email && supplier.email.toLowerCase().includes(query)) ||
            (supplier.city && supplier.city.toLowerCase().includes(query)) ||
            (supplier.country && supplier.country.toLowerCase().includes(query))
        );
    }
    
    renderSuppliers();
}

function handleSort(e) {
    const sortBy = e.target.value;
    
    filteredSuppliers.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'created_at':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'product_count':
                return (b.product_count || 0) - (a.product_count || 0);
            default:
                return 0;
        }
    });
    
    renderSuppliers();
}

function refreshSuppliers() {
    loadSuppliers();
    showNotification('Lista de proveedores actualizada', 'success');
}

// ============================
// FUNCIONES DEL MODAL DE PROVEEDORES
// ============================
function openAddSupplierModal() {
    currentSupplier = null;
    isEditMode = false;
    
    document.getElementById('modal-title').textContent = 'Nuevo Proveedor';
    document.getElementById('supplier-form').reset();
    
    showModal('supplier-modal');
}

function openEditSupplierModal(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
        showNotification('Proveedor no encontrado', 'error');
        return;
    }
    
    currentSupplier = supplier;
    isEditMode = true;
    
    document.getElementById('modal-title').textContent = 'Editar Proveedor';
    fillSupplierForm(supplier);
    
    showModal('supplier-modal');
}

function closeSupplierModal() {
    hideModal('supplier-modal');
    currentSupplier = null;
    isEditMode = false;
}

function fillSupplierForm(supplier) {
    const form = document.getElementById('supplier-form');
    const fields = ['name', 'contact_person', 'email', 'phone', 'address', 'city', 'country', 'tax_id', 'payment_terms'];
    
    fields.forEach(field => {
        const input = form.querySelector(`[name="${field}"]`);
        if (input && supplier[field]) {
            input.value = supplier[field];
        }
    });
}

async function handleSupplierSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const supplierData = Object.fromEntries(formData.entries());
    
    // Validaciones
    if (!supplierData.name.trim()) {
        showNotification('El nombre del proveedor es requerido', 'error');
        return;
    }
    
    try {
        showLoading();
        
        if (isEditMode && currentSupplier) {
            await fetchAPI(`/suppliers/${currentSupplier.id}`, {
                method: 'PUT',
                body: JSON.stringify(supplierData)
            });
            showNotification('Proveedor actualizado exitosamente', 'success');
        } else {
            await fetchAPI('/suppliers', {
                method: 'POST',
                body: JSON.stringify(supplierData)
            });
            showNotification('Proveedor creado exitosamente', 'success');
        }
        
        closeSupplierModal();
        loadSuppliers();
        
    } catch (error) {
        console.error('Error saving supplier:', error);
        showNotification('Error al guardar el proveedor', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteSupplier(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    if (!confirm(`¿Estás seguro de que deseas eliminar el proveedor "${supplier.name}"?`)) {
        return;
    }
    
    try {
        showLoading();
        await fetchAPI(`/suppliers/${supplierId}`, { method: 'DELETE' });
        showNotification('Proveedor eliminado exitosamente', 'success');
        loadSuppliers();
    } catch (error) {
        console.error('Error deleting supplier:', error);
        showNotification('Error al eliminar el proveedor', 'error');
    } finally {
        hideLoading();
    }
}

// ============================
// FUNCIONES DEL MODAL DE PRODUCTOS
// ============================
async function openProductsModal(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
        showNotification('Proveedor no encontrado', 'error');
        return;
    }
    
    currentSupplier = supplier;
    document.getElementById('products-modal-title').textContent = `Productos de ${supplier.name}`;
    
    showModal('products-modal');
    
    // Cargar productos
    showLoading();
    try {
        const products = await loadSupplierProducts(supplierId);
        renderProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
    } finally {
        hideLoading();
    }
}

function closeProductsModal() {
    hideModal('products-modal');
    currentSupplier = null;
}

function renderProducts(products) {
    const productsList = document.getElementById('products-list');
    if (!productsList) return;
    
    if (products.length === 0) {
        productsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box"></i>
                <h3>No hay productos registrados</h3>
                <p>Agrega productos para este proveedor</p>
            </div>
        `;
        return;
    }
    
    productsList.innerHTML = products.map(product => createProductItem(product)).join('');
}

function createProductItem(product) {
    return `
        <div class="product-item" data-product-id="${product.id}">
            <div class="product-header">
                <div class="product-info">
                    <h4>${escapeHtml(product.product_name)}</h4>
                    ${product.product_code ? `<span class="product-code">${escapeHtml(product.product_code)}</span>` : ''}
                </div>
                <div class="product-actions">
                    <button class="btn-icon" onclick="openEditProductModal(${product.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteProduct(${product.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            ${product.description ? `<p style="color: var(--text-light); margin-bottom: 1rem;">${escapeHtml(product.description)}</p>` : ''}
            
            <div class="product-details">
                ${product.unit_price ? 
                    `<div class="product-detail">
                        <label>Precio</label>
                        <span>${window.BuyTrack.formatCurrency(parseFloat(product.unit_price), product.currency || 'CLP')}</span>
                    </div>` : ''
                }
                ${product.unit_of_measure ? 
                    `<div class="product-detail">
                        <label>Unidad</label>
                        <span>${escapeHtml(product.unit_of_measure)}</span>
                    </div>` : ''
                }
                <div class="product-detail">
                    <label>Estado</label>
                    <span class="status-badge status-${product.availability_status}">
                        ${getStatusText(product.availability_status)}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// ============================
// FUNCIONES DEL MODAL DE PRODUCTOS INDIVIDUALES
// ============================
function openAddProductModal() {
    if (!currentSupplier) {
        showNotification('Error: No hay proveedor seleccionado', 'error');
        return;
    }
    
    currentProduct = null;
    isEditMode = false;
    
    document.getElementById('product-modal-title').textContent = 'Nuevo Producto';
    document.getElementById('product-form').reset();
    
    // Establecer estado por defecto como "Disponible"
    const statusSelect = document.getElementById('availability_status');
    if (statusSelect) {
        statusSelect.value = 'available';
    }
    
    // Mostrar el código que se asignará automáticamente
    showAutoGeneratedCode();
    
    showModal('product-modal');
}

async function openEditProductModal(productId) {
    if (!currentSupplier) {
        showNotification('Error: No hay proveedor seleccionado', 'error');
        return;
    }
    
    try {
        const products = await loadSupplierProducts(currentSupplier.id);
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            showNotification('Producto no encontrado', 'error');
            return;
        }
        
        currentProduct = product;
        isEditMode = true;
        
        document.getElementById('product-modal-title').textContent = 'Editar Producto';
        fillProductForm(product);
        
        // Actualizar texto de ayuda para modo edición
        const statusInput = document.getElementById('availability_status');
        const statusHelpText = statusInput.nextElementSibling;
        if (statusHelpText && statusHelpText.classList.contains('form-help')) {
            statusHelpText.textContent = `Puedes cambiar el estado del producto según su disponibilidad`;
        }
        
        showModal('product-modal');
    } catch (error) {
        console.error('Error loading product:', error);
        showNotification('Error al cargar el producto', 'error');
    }
}

function closeProductModal() {
    hideModal('product-modal');
    currentProduct = null;
    isEditMode = false;
}

function fillProductForm(product) {
    const form = document.getElementById('product-form');
    const fields = ['product_name', 'product_code', 'description', 'unit_price', 'currency', 'unit_of_measure', 'availability_status'];
    
    fields.forEach(field => {
        const input = form.querySelector(`[name="${field}"]`);
        if (input && product[field] !== undefined && product[field] !== null) {
            input.value = product[field];
        }
    });
    
    // Asegurar que el campo de código permanezca de solo lectura
    const codeInput = document.getElementById('product_code');
    if (codeInput) {
        codeInput.readOnly = true;
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    
    if (!currentSupplier) {
        showNotification('Error: No hay proveedor seleccionado', 'error');
        return;
    }
    
    const formData = new FormData(e.target);
    const productData = Object.fromEntries(formData.entries());
    
    // Validaciones
    if (!productData.product_name.trim()) {
        showNotification('El nombre del producto es requerido', 'error');
        return;
    }
    
    // Para productos nuevos, remover el campo product_code ya que se genera automáticamente
    if (!isEditMode) {
        delete productData.product_code;
    }
    
    try {
        showLoading();
        
        if (isEditMode && currentProduct) {
            await fetchAPI(`/suppliers/${currentSupplier.id}/products/${currentProduct.id}`, {
                method: 'PUT',
                body: JSON.stringify(productData)
            });
            showNotification('Producto actualizado exitosamente', 'success');
        } else {
            const response = await fetchAPI(`/suppliers/${currentSupplier.id}/products`, {
                method: 'POST',
                body: JSON.stringify(productData)
            });
            
            // Mostrar código generado automáticamente
            if (response.product_code) {
                showNotification(`Producto creado exitosamente con código: ${response.product_code}`, 'success');
            } else {
                showNotification('Producto creado exitosamente', 'success');
            }
        }
        
        closeProductModal();
        
        // Recargar productos del proveedor actual
        const products = await loadSupplierProducts(currentSupplier.id);
        renderProducts(products);
        
        // Recargar lista de proveedores para actualizar conteo
        loadSuppliers();
        
    } catch (error) {
        console.error('Error saving product:', error);
        showNotification('Error al guardar el producto', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteProduct(productId) {
    if (!currentSupplier) {
        showNotification('Error: No hay proveedor seleccionado', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        return;
    }
    
    try {
        showLoading();
        await fetchAPI(`/suppliers/${currentSupplier.id}/products/${productId}`, { method: 'DELETE' });
        showNotification('Producto eliminado exitosamente', 'success');
        
        // Recargar productos
        const products = await loadSupplierProducts(currentSupplier.id);
        renderProducts(products);
        
        // Recargar lista de proveedores para actualizar conteo
        loadSuppliers();
        
    } catch (error) {
        console.error('Error deleting product:', error);
        showNotification('Error al eliminar el producto', 'error');
    } finally {
        hideLoading();
    }
}

async function showAutoGeneratedCode() {
    try {
        // Obtener productos actuales para calcular el próximo número
        const products = await loadSupplierProducts(currentSupplier.id);
        const nextNumber = (products.length + 1).toString().padStart(3, '0');
        const previewCode = `PROV${currentSupplier.id}-PROD${nextNumber}`;
        
        // Mostrar el código directamente en el campo
        const codeInput = document.getElementById('product_code');
        codeInput.value = previewCode;
        codeInput.placeholder = '';
        
        // Actualizar texto de ayuda
        const helpText = codeInput.nextElementSibling;
        if (helpText && helpText.classList.contains('form-help')) {
            helpText.textContent = `Este será el código asignado al producto`;
        }
        
        // También actualizar el texto de ayuda del estado si estamos en modo de agregar
        if (!isEditMode) {
            const statusInput = document.getElementById('availability_status');
            const statusHelpText = statusInput.nextElementSibling;
            if (statusHelpText && statusHelpText.classList.contains('form-help')) {
                statusHelpText.textContent = `Los productos nuevos se crean como "Disponible" por defecto`;
            }
        }
    } catch (error) {
        console.log('No se pudo obtener el código automático');
        const codeInput = document.getElementById('product_code');
        codeInput.value = '';
        codeInput.placeholder = 'Se generará automáticamente';
    }
}

async function previewAutoGeneratedCode() {
    try {
        // Obtener productos actuales para calcular el próximo número
        const products = await loadSupplierProducts(currentSupplier.id);
        const nextNumber = (products.length + 1).toString().padStart(3, '0');
        const previewCode = `PROV${currentSupplier.id}-PROD${nextNumber}`;
        
        const codeInput = document.getElementById('product_code');
        const helpText = codeInput.nextElementSibling;
        if (helpText && helpText.classList.contains('form-help')) {
            helpText.textContent = `El código se generará automáticamente: ${previewCode}`;
        }
        
        // También actualizar el texto de ayuda del estado si estamos en modo de agregar
        if (!isEditMode) {
            const statusInput = document.getElementById('availability_status');
            const statusHelpText = statusInput.nextElementSibling;
            if (statusHelpText && statusHelpText.classList.contains('form-help')) {
                statusHelpText.textContent = `Los productos nuevos se crean como "Disponible" por defecto`;
            }
        }
    } catch (error) {
        console.log('No se pudo obtener preview del código automático');
    }
}

// ============================
// FUNCIONES DE UTILIDAD
// ============================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusText(status) {
    const statusMap = {
        'available': 'Disponible',
        'out_of_stock': 'Agotado',
        'discontinued': 'Descontinuado'
    };
    return statusMap[status] || status;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
