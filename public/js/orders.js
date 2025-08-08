// ============================
// VARIABLES GLOBALES PARA ORDERS
// ============================
let orders = [];
let filteredOrders = [];
let suppliers = [];
let availableProducts = [];
let orderItems = [];
let currentOrder = null;
let costCenters = [];

// ============================
// FUNCIONES DE INICIALIZACIÓN
// ============================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Orders module initialized');
    initializeOrders();
    setupEventListeners();
});

function initializeOrders() {
    loadOrders();
    loadSuppliers();
    loadAvailableProducts();
    loadCostCenters();
}

function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // Filter functionality
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', handleFilter);
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
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            if (e.target.id === 'order-modal') closeOrderModal();
            if (e.target.id === 'view-order-modal') closeViewOrderModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeOrderModal();
            closeViewOrderModal();
        }
    });
}

function setupFormListeners() {
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
    }
    const currencySelect = document.getElementById('currency');
    if (currencySelect) {
        currencySelect.addEventListener('change', () => {
            const newCurrency = getSelectedCurrency();
            if (orderItems.some(it => it.currency && it.currency !== newCurrency)) {
                showNotification(`Hay items con moneda distinta a ${newCurrency}. Vuelve a agregarlos o ajusta la moneda.`, 'info');
            }
            renderOrderItems();
            updateOrderTotals();
        });
    }

    const ccSelect = document.getElementById('cost_center_id');
    if (ccSelect) {
        ccSelect.addEventListener('change', handleCostCenterChange);
    }
}

function getSelectedCurrency() {
    const el = document.getElementById('currency');
    return el && el.value ? el.value : 'CLP';
}

// ============================
// FUNCIONES DE CARGA DE DATOS
// ============================
async function loadOrders() {
    try {
        showLoading();
        const response = await fetchAPI('/orders');
        orders = response.orders || [];
        filteredOrders = [...orders];
        renderOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Error al cargar las órdenes', 'error');
        showEmptyState();
    } finally {
        hideLoading();
    }
}

async function loadSuppliers() {
    try {
        const response = await fetchAPI('/suppliers');
        suppliers = response.suppliers || [];
        populateSupplierSelect();
    } catch (error) {
        console.error('Error loading suppliers:', error);
        showNotification('Error al cargar los proveedores', 'error');
    }
}

async function loadAvailableProducts() {
    try {
        const response = await fetchAPI('/orders/products/available');
        availableProducts = response.products || [];
        populateProductSelect();
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Error al cargar los productos', 'error');
    }
}

async function loadCostCenters() {
    try {
        const response = await fetchAPI('/cost-centers');
        costCenters = (response && response.data) ? response.data.filter(cc => cc.is_active) : [];
        populateCostCenterSelect();
    } catch (error) {
        console.error('Error loading cost centers:', error);
        showNotification('Error al cargar los centros de costo', 'error');
    }
}

function populateSupplierSelect() {
    const select = document.getElementById('supplier_id');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar proveedor...</option>';
    suppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        select.appendChild(option);
    });
}

function populateCostCenterSelect() {
    const select = document.getElementById('cost_center_id');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar centro...</option>';
    costCenters.forEach(cc => {
        const option = document.createElement('option');
        option.value = cc.id;
        option.textContent = `${cc.code} - ${cc.name}`;
        select.appendChild(option);
    });
}

function populateProductSelect() {
    const select = document.getElementById('available-products');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar producto para agregar...</option>';
    
    const groupedProducts = {};
    availableProducts.forEach(product => {
        if (!groupedProducts[product.supplier_name]) {
            groupedProducts[product.supplier_name] = [];
        }
        groupedProducts[product.supplier_name].push(product);
    });
    
    Object.keys(groupedProducts).forEach(supplierName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = supplierName;
        
        groupedProducts[supplierName].forEach(product => {
            const option = document.createElement('option');
            option.value = JSON.stringify(product);
            const currency = product.currency || 'CLP';
            option.textContent = `${product.product_name} - ${window.BuyTrack.formatCurrency(parseFloat(product.unit_price || 0), currency)}`;
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    });
}

// ============================
// FUNCIONES DE RENDERIZADO
// ============================
function renderOrders() {
    const grid = document.getElementById('orders-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (!grid) return;
    
    if (filteredOrders.length === 0) {
        grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    grid.innerHTML = filteredOrders.map(order => createOrderCard(order)).join('');
}

function createOrderCard(order) {
    const totalAmount = parseFloat(order.total_amount || 0);
    const orderDate = new Date(order.order_date).toLocaleDateString('es-ES');
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('es-ES') : 'No especificada';
    const currency = order.currency || 'CLP';
    
    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-header">
                <div class="order-info">
                    <h3>
                        <i class="fas fa-file-invoice"></i>
                        <span class="order-number">${order.order_number}</span>
                    </h3>
                    <div class="supplier-name">
                        <i class="fas fa-building"></i>
                        ${escapeHtml(order.supplier_name || 'Sin proveedor')}
                    </div>
                </div>
                <div class="order-actions">
                    <button class="btn-icon" onclick="viewOrder(${order.id})" title="Ver orden">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="downloadPDF(${order.id})" title="Descargar PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="btn-icon" onclick="changeOrderStatus(${order.id})" title="Cambiar estado">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteOrder(${order.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="order-body">
                <div class="order-details">
                    <div class="detail-item">
                        <span class="detail-label">Fecha de Orden</span>
                        <span class="detail-value">${orderDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Fecha de Entrega</span>
                        <span class="detail-value">${deliveryDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Items</span>
                        <span class="detail-value">${order.items_count || 0} productos</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Moneda</span>
                        <span class="detail-value">${currency}</span>
                    </div>
                </div>
                
                ${order.notes ? `
                    <div class="order-notes">
                        <strong>Notas:</strong> ${escapeHtml(order.notes)}
                    </div>
                ` : ''}
            </div>
            
            <div class="order-footer">
                <div class="order-total">
                    Total: ${window.BuyTrack.formatCurrency(totalAmount, currency)}
                </div>
                <div class="order-status">
                    <span class="status-badge status-${order.status}">
                        ${getStatusText(order.status)}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function showEmptyState() {
    const grid = document.getElementById('orders-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (grid) grid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
}

// ============================
// FUNCIONES DE BÚSQUEDA Y FILTRADO
// ============================
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    applyFilters();
}

function handleFilter() {
    applyFilters();
}

function handleSort(e) {
    const sortBy = e.target.value;
    
    filteredOrders.sort((a, b) => {
        switch (sortBy) {
            case 'order_number':
                return a.order_number.localeCompare(b.order_number);
            case 'total_amount':
                return (b.total_amount || 0) - (a.total_amount || 0);
            case 'supplier_name':
                return (a.supplier_name || '').localeCompare(b.supplier_name || '');
            case 'created_at':
            default:
                return new Date(b.created_at) - new Date(a.created_at);
        }
    });
    
    renderOrders();
}

function applyFilters() {
    const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
    const statusFilter = document.getElementById('status-filter').value;
    
    filteredOrders = orders.filter(order => {
        // Search filter
        const matchesSearch = !searchQuery || 
            order.order_number.toLowerCase().includes(searchQuery) ||
            (order.supplier_name && order.supplier_name.toLowerCase().includes(searchQuery)) ||
            (order.notes && order.notes.toLowerCase().includes(searchQuery));
        
        // Status filter
        const matchesStatus = !statusFilter || order.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    renderOrders();
}

function refreshOrders() {
    loadOrders();
    showNotification('Lista de órdenes actualizada', 'success');
}

function refreshProducts() {
    loadAvailableProducts();
    showNotification('Lista de productos actualizada', 'success');
}

// ============================
// FUNCIONES DEL MODAL DE ORDEN
// ============================
function openCreateOrderModal() {
    orderItems = [];
    currentOrder = null;
    
    document.getElementById('order-form').reset();
    renderOrderItems();
    updateOrderTotals();
    
    showModal('order-modal');
}

function closeOrderModal() {
    hideModal('order-modal');
    orderItems = [];
    currentOrder = null;
}

function addProductToOrder() {
    const select = document.getElementById('available-products');
    const selectedValue = select.value;
    
    if (!selectedValue) return;
    
    try {
        const product = JSON.parse(selectedValue);
        const orderCurrency = getSelectedCurrency();
        const productCurrency = product.currency || orderCurrency;
        
        if (productCurrency !== orderCurrency) {
            const confirmSwitch = confirm(`La moneda del producto es ${productCurrency} y la orden está en ${orderCurrency}.\n\n¿Deseas cambiar la moneda de la orden a ${productCurrency}?`);
            if (confirmSwitch) {
                const currencySelect = document.getElementById('currency');
                if (currencySelect) currencySelect.value = productCurrency;
            } else {
                showNotification('El producto no fue agregado por diferencia de moneda.', 'error');
                select.value = '';
                return;
            }
        }
        
        // Verificar si el producto ya está en la orden
        const existingItem = orderItems.find(item => item.product_id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
            existingItem.total_price = existingItem.quantity * existingItem.unit_price;
        } else {
            orderItems.push({
                product_id: product.id,
                product_name: product.product_name,
                product_code: product.product_code,
                description: product.description,
                unit_price: parseFloat(product.unit_price),
                quantity: 1,
                unit_of_measure: product.unit_of_measure,
                total_price: parseFloat(product.unit_price),
                currency: product.currency || orderCurrency
            });
        }
        
        select.value = '';
        renderOrderItems();
        updateOrderTotals();
        
    } catch (error) {
        console.error('Error adding product:', error);
        showNotification('Error al agregar el producto', 'error');
    }
}

function renderOrderItems() {
    const container = document.getElementById('order-items');
    if (!container) return;
    const currency = getSelectedCurrency();
    
    if (orderItems.length === 0) {
        container.innerHTML = `
            <div class="empty-items-message">
                <i class="fas fa-box-open"></i>
                <p>No hay productos agregados a la orden</p>
                <p>Selecciona productos del catálogo disponible</p>
            </div>
        `;
        container.classList.remove('has-items');
        return;
    }
    
    container.classList.add('has-items');
    container.innerHTML = orderItems.map((item, index) => `
        <div class="order-item" data-index="${index}">
            <div class="item-info">
                <h5>${escapeHtml(item.product_name)}</h5>
                ${item.product_code ? `<span class="item-code">${escapeHtml(item.product_code)}</span>` : ''}
                ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
            </div>
            <input type="number" class="quantity-input" value="${item.quantity}" min="1" 
                   onchange="updateItemQuantity(${index}, this.value)">
            <div class="unit-price">${window.BuyTrack.formatCurrency(item.unit_price, currency)}</div>
            <div class="total-price">${window.BuyTrack.formatCurrency(item.total_price, currency)}</div>
            <button type="button" class="remove-item" onclick="removeOrderItem(${index})" title="Eliminar">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function updateItemQuantity(index, quantity) {
    const qty = parseInt(quantity) || 1;
    if (qty < 1) return;
    
    orderItems[index].quantity = qty;
    orderItems[index].total_price = qty * orderItems[index].unit_price;
    
    renderOrderItems();
    updateOrderTotals();
}

function removeOrderItem(index) {
    orderItems.splice(index, 1);
    renderOrderItems();
    updateOrderTotals();
}

function updateOrderTotals() {
    const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
    const tax = subtotal * 0.19; // 19% IVA
    const total = subtotal + tax;
    const currency = getSelectedCurrency();
    
    document.getElementById('subtotal-display').textContent = window.BuyTrack.formatCurrency(subtotal, currency);
    document.getElementById('tax-display').textContent = window.BuyTrack.formatCurrency(tax, currency);
    document.getElementById('total-display').textContent = window.BuyTrack.formatCurrency(total, currency);

    // Intentar mostrar estado de presupuesto si hay centro y moneda seleccionados
    updateBudgetStatus();
}

async function handleOrderSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const orderData = Object.fromEntries(formData.entries());
    
    // Validaciones
    if (!orderData.supplier_id) {
        showNotification('Debe seleccionar un proveedor', 'error');
        return;
    }
    if (!orderData.cost_center_id) {
        showNotification('Debe seleccionar un centro de costo', 'error');
        return;
    }
    
    if (orderItems.length === 0) {
        showNotification('Debe agregar al menos un producto a la orden', 'error');
        return;
    }

    // Validar presupuesto (opcional con confirmación)
    const proceed = await checkBudgetBeforeSubmit(orderData.cost_center_id, getSelectedCurrency());
    if (!proceed) return;
    
    orderData.items = orderItems;
    
    try {
        showLoading();
        const response = await fetchAPI('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        showNotification('Orden de compra creada exitosamente', 'success');
        closeOrderModal();
        loadOrders();
        
    } catch (error) {
        console.error('Error creating order:', error);
        showNotification(error?.message || 'Error al crear la orden de compra', 'error');
    } finally {
        hideLoading();
    }
}

// Helpers de presupuesto
function calculateOrderTotals() {
    const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
    const tax = subtotal * 0.19;
    const total = subtotal + tax;
    return { subtotal, tax, total };
}

async function fetchBudgetSummaryForCurrentMonth(costCenterId) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const result = await fetchAPI(`/cost-centers/usage?month=${encodeURIComponent(ym)}`);
    return (result && result.data) ? result.data.filter(s => String(s.cost_center_id) === String(costCenterId)) : [];
}

async function checkBudgetBeforeSubmit(costCenterId, currency) {
    try {
        const { total } = calculateOrderTotals();
        const summaries = await fetchBudgetSummaryForCurrentMonth(costCenterId);
        const s = summaries.find(x => x.currency === currency);
        if (!s) {
            return confirm('No hay presupuesto definido para este centro/moneda este mes. ¿Desea continuar?');
        }
        const remaining = Number(s.remaining) || 0;
        if (total > remaining) {
            return confirm(`Esta orden (${window.BuyTrack.formatCurrency(total, currency)}) excede el presupuesto restante (${window.BuyTrack.formatCurrency(remaining, currency)}). ¿Desea continuar?`);
        }
        return true;
    } catch (err) {
        console.warn('No se pudo validar presupuesto antes de enviar:', err);
        return true; // No bloquear por error de validación opcional
    }
}

// ============================
// PRESUPUESTOS Y CENTROS DE COSTO (UI)
// ============================
async function handleCostCenterChange() {
    updateBudgetStatus();
}

async function updateBudgetStatus() {
    const ccSelect = document.getElementById('cost_center_id');
    const budgetHelp = document.getElementById('budget-status');
    const currency = getSelectedCurrency();

    if (!ccSelect || !budgetHelp) return;

    const ccId = ccSelect.value;
    if (!ccId) {
        budgetHelp.textContent = '';
        return;
    }

    try {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const result = await fetchAPI(`/cost-centers/usage?month=${encodeURIComponent(ym)}`);
        const summaries = (result && result.data) ? result.data : [];

        // Buscar el registro para este CC y moneda
        const summary = summaries.find(s => String(s.cost_center_id) === String(ccId) && s.currency === currency);

        if (summary) {
            const remaining = Number(summary.remaining) || 0;
            const budget = Number(summary.budget) || 0;
            const spent = Number(summary.spent) || 0;
            const text = `Presupuesto ${window.BuyTrack.formatCurrency(budget, currency)} · Usado ${window.BuyTrack.formatCurrency(spent, currency)} · Restante ${window.BuyTrack.formatCurrency(remaining, currency)}`;
            budgetHelp.textContent = text;
            budgetHelp.style.color = remaining < 0 ? '#e74c3c' : '#555';
        } else {
            budgetHelp.textContent = 'No hay presupuesto cargado para este centro/moneda en el mes actual';
            budgetHelp.style.color = '#f39c12';
        }
    } catch (err) {
        console.warn('No se pudo obtener el estado de presupuesto:', err);
        budgetHelp.textContent = '';
    }
}

// ============================
// FUNCIONES DE ACCIONES DE ORDEN
// ============================
async function viewOrder(orderId) {
    try {
        showLoading();
        const response = await fetchAPI(`/orders/${orderId}`);
        const order = response.order;
        const items = response.items;
        
        currentOrder = order;
        
        document.getElementById('view-order_title').textContent = `Orden ${order.order_number}`;
        renderOrderView(order, items);
        showModal('view-order-modal');
        
    } catch (error) {
        console.error('Error loading order:', error);
        showNotification('Error al cargar la orden', 'error');
    } finally {
        hideLoading();
    }
}

function renderOrderView(order, items) {
    const container = document.getElementById('order-view-content');
    if (!container) return;
    
    const orderDate = new Date(order.order_date).toLocaleDateString('es-ES');
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('es-ES') : 'No especificada';
    const currency = order.currency || 'CLP';
    
    container.innerHTML = `
        <div class="order-view-header">
            <div class="order-view-section">
                <h4><i class="fas fa-info-circle"></i> Información de la Orden</h4>
                <div class="order-view-details">
                    <div class="order-view-detail">
                        <span class="label">Número de Orden:</span>
                        <span class="value">${order.order_number}</span>
                    </div>
                    <div class="order-view-detail">
                        <span class="label">Fecha de Orden:</span>
                        <span class="value">${orderDate}</span>
                    </div>
                    <div class="order-view-detail">
                        <span class="label">Fecha de Entrega:</span>
                        <span class="value">${deliveryDate}</span>
                    </div>
                    <div class="order-view-detail">
                        <span class="label">Estado:</span>
                        <span class="value">
                            <span class="status-badge status-${order.status}">
                                ${getStatusText(order.status)}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="order-view-section">
                <h4><i class="fas fa-building"></i> Información del Proveedor</h4>
                <div class="order-view-details">
                    <div class="order-view-detail">
                        <span class="label">Empresa:</span>
                        <span class="value">${escapeHtml(order.supplier_name || '')}</span>
                    </div>
                    <div class="order-view-detail">
                        <span class="label">Contacto:</span>
                        <span class="value">${escapeHtml(order.contact_person || '')}</span>
                    </div>
                    <div class="order-view-detail">
                        <span class="label">Email:</span>
                        <span class="value">${escapeHtml(order.supplier_email || '')}</span>
                    </div>
                    <div class="order-view-detail">
                        <span class="label">Términos de Pago:</span>
                        <span class="value">${escapeHtml(order.payment_terms || '')}</span>
                    </div>
                </div>
            </div>
        </div>
        
        ${order.notes ? `
            <div class="order-view-section">
                <h4><i class="fas fa-sticky-note"></i> Notas</h4>
                <p>${escapeHtml(order.notes)}</p>
            </div>
        ` : ''}
        
        <div class="order-view-section">
            <h4><i class="fas fa-box"></i> Productos</h4>
            <table class="order-items-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                        <th>Precio Unit.</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${escapeHtml(item.product_code || '')}</td>
                            <td><strong>${escapeHtml(item.product_name)}</strong></td>
                            <td>${escapeHtml(item.description || '')}</td>
                            <td>${item.quantity} ${escapeHtml(item.unit_of_measure || '')}</td>
                            <td>${window.BuyTrack.formatCurrency(parseFloat(item.unit_price), currency)}</td>
                            <td><strong>${window.BuyTrack.formatCurrency(parseFloat(item.total_price), currency)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="order-totals">
                <div class="totals-grid">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>${window.BuyTrack.formatCurrency(parseFloat(order.subtotal), currency)}</span>
                    </div>
                    <div class="total-row">
                        <span>Impuestos (19%):</span>
                        <span>${window.BuyTrack.formatCurrency(parseFloat(order.tax_amount), currency)}</span>
                    </div>
                    <div class="total-row total-final">
                        <span>Total:</span>
                        <span>${window.BuyTrack.formatCurrency(parseFloat(order.total_amount), currency)}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="order-view-actions">
            <button class="btn-pdf" onclick="downloadPDF(${order.id})">
                <i class="fas fa-file-pdf"></i> Descargar PDF
            </button>
            <button class="btn-view" onclick="previewPDF(${order.id})">
                <i class="fas fa-eye"></i> Vista Previa
            </button>
            <button class="btn-status" onclick="changeOrderStatus(${order.id})">
                <i class="fas fa-edit"></i> Cambiar Estado
            </button>
        </div>
    `;
}

function closeViewOrderModal() {
    hideModal('view-order-modal');
    currentOrder = null;
}

async function downloadPDF(orderId) {
    try {
        showLoading();
        const response = await fetch(`/api/pdf/order/${orderId}`);
        
        if (!response.ok) {
            throw new Error('Error al generar el PDF');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const order = orders.find(o => o.id === orderId) || currentOrder;
        const suggestedName = order && order.order_number ? `orden-compra-${order.order_number}.pdf` : `orden-compra-${orderId}.pdf`;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('PDF descargado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showNotification('Error al descargar el PDF', 'error');
    } finally {
        hideLoading();
    }
}

function previewPDF(orderId) {
    const url = `/api/pdf/order/${orderId}?disposition=inline`;
    window.open(url, '_blank');
}

async function changeOrderStatus(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const statuses = [
        { value: 'pending', label: 'Pendiente', color: '#856404' },
        { value: 'approved', label: 'Aprobada', color: '#155724' },
        { value: 'sent', label: 'Enviada', color: '#004085' },
        { value: 'received', label: 'Recibida', color: '#0c5460' },
        { value: 'cancelled', label: 'Cancelada', color: '#721c24' }
    ];
    
    const newStatus = await showStatusSelector(order.status, statuses);
    if (!newStatus || newStatus === order.status) return;
    
    try {
        showLoading();
        await fetchAPI(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        showNotification('Estado actualizado exitosamente', 'success');
        loadOrders();
        
        if (currentOrder && currentOrder.id === orderId) {
            viewOrder(orderId); // Refresh view if open
        }
        
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Error al actualizar el estado', 'error');
    } finally {
        hideLoading();
    }
}

function showStatusSelector(currentStatus, statuses) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Cambiar Estado de la Orden</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove(); resolve(null)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 2rem;">
                    <p>Selecciona el nuevo estado para la orden:</p>
                    <div class="status-change-buttons">
                        ${statuses.map(status => `
                            <div class="status-option ${status.value === currentStatus ? 'selected' : ''}" 
                                 data-status="${status.value}" 
                                 style="border-color: ${status.color}">
                                <strong>${status.label}</strong>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-actions" style="margin-top: 2rem;">
                        <button class="btn-secondary" onclick="this.closest('.modal').remove(); resolve(null)">
                            Cancelar
                        </button>
                        <button class="btn-primary" onclick="confirmStatusChange()">
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        let selectedStatus = currentStatus;
        
        modal.querySelectorAll('.status-option').forEach(option => {
            option.addEventListener('click', function() {
                modal.querySelectorAll('.status-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                selectedStatus = this.dataset.status;
            });
        });
        
        window.confirmStatusChange = function() {
            modal.remove();
            resolve(selectedStatus);
        };
    });
}

async function deleteOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    if (!confirm(`¿Estás seguro de que deseas eliminar la orden "${order.order_number}"?`)) {
        return;
    }
    
    try {
        showLoading();
        await fetchAPI(`/orders/${orderId}`, { method: 'DELETE' });
        showNotification('Orden eliminada exitosamente', 'success');
        loadOrders();
        
        if (currentOrder && currentOrder.id === orderId) {
            closeViewOrderModal();
        }
        
    } catch (error) {
        console.error('Error deleting order:', error);
        showNotification('Error al eliminar la orden', 'error');
    } finally {
        hideLoading();
    }
}

// ============================
// FUNCIONES DE UTILIDAD
// ============================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
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
        'pending': 'Pendiente',
        'approved': 'Aprobada',
        'sent': 'Enviada',
        'received': 'Recibida',
        'cancelled': 'Cancelada'
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
