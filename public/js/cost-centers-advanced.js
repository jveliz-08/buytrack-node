// Cost Centers Advanced Management
class CostCentersAdvanced {
    constructor() {
        this.centers = [];
        this.filteredCenters = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.currentSort = { field: 'name', direction: 'asc' };
        this.filters = {};
        this.charts = {};
        this.editingId = null;
        
        this.init();
    }

    async init() {
        await this.loadCenters();
        this.setupEventListeners();
        this.initializeCharts();
        this.updateMetrics();
        this.generateInsights();
        this.renderTable();
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('search-input').addEventListener('input', 
            this.debounce(() => this.applyFilters(), 300));

        // Filter controls
        document.getElementById('period-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('status-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('type-filter').addEventListener('change', () => this.applyFilters());

        // Sort controls (use value directly)
        const sortSel = document.getElementById('sort-by');
        if (sortSel) {
            sortSel.addEventListener('change', (e) => {
                const field = e.target.value;
                this.sort(field, 'asc');
            });
        }

        // View toggle (use currentTarget to avoid icon clicks issue)
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e.currentTarget.dataset.view));
        });

        // Chart controls
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchChart(e.currentTarget.dataset.chart));
        });

        // Table sorting
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                const direction = this.currentSort.field === field && this.currentSort.direction === 'asc' ? 'desc' : 'asc';
                this.sort(field, direction);
            });
        });

        // Modal events
        document.getElementById('costCenterForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCostCenter();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
        });
    }

    async loadCenters() {
        try {
            this.showLoading(true);
            
            const [centersResponse, budgetsResponse, ordersResponse] = await Promise.all([
                fetch('/api/cost-centers'),
                fetch('/api/budgets'),
                fetch('/api/orders')
            ]);

            const centersJson = await centersResponse.json();
            const budgetsJson = await budgetsResponse.json();
            const ordersJson = await ordersResponse.json();

            const centers = Array.isArray(centersJson) ? centersJson : (centersJson.data || centersJson.centers || []);
            const budgets = Array.isArray(budgetsJson) ? budgetsJson : (budgetsJson.data || budgetsJson.budgets || []);
            const orders = Array.isArray(ordersJson) ? ordersJson : (ordersJson.orders || []);

            const currentMonth = new Date().toISOString().substr(0, 7);

            // Enrich centers with budget and spending data
            this.centers = centers.map(center => {
                const currency = center.currency || 'CLP';
                const centerBudgets = budgets.filter(b => b.cost_center_id === center.id && (b.currency || 'CLP') === currency);
                const centerOrders = orders.filter(o => o.cost_center_id === center.id && (o.currency || 'CLP') === currency);
                
                const currentBudget = centerBudgets.find(b => (b.month || b.period) === currentMonth);
                
                const spent = centerOrders
                    .filter(o => (o.order_date || o.created_at || '').startsWith(currentMonth))
                    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

                const budgetAmount = currentBudget ? Number(currentBudget.amount) || 0 : 0;
                const utilization = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

                return {
                    ...center,
                    currency,
                    currentBudget: budgetAmount,
                    spent,
                    utilization,
                    remaining: budgetAmount - spent,
                    ordersCount: centerOrders.length,
                    lastActivity: this.getLastActivity(centerOrders),
                    status: this.calculateStatus(center, utilization, budgetAmount)
                };
            });

            this.filteredCenters = [...this.centers];
            
        } catch (error) {
            console.error('Error loading cost centers:', error);
            this.showError('Error al cargar los centros de costo');
        } finally {
            this.showLoading(false);
        }
    }

    calculateStatus(center, utilization, budget) {
        if (!center.is_active) return 'inactive';
        if (utilization > 100) return 'overbudget';
        if (utilization < 20 && budget > 0) return 'underutilized';
        return 'active';
    }

    getLastActivity(orders) {
        if (!orders || orders.length === 0) return null;
        const sortedOrders = orders.slice().sort((a, b) => new Date(b.created_at || b.order_date) - new Date(a.created_at || a.order_date));
        return sortedOrders[0].created_at || sortedOrders[0].order_date;
    }

    updateMetrics() {
        const totalCenters = this.centers.length || 1;
        const activeCenters = this.centers.filter(c => c.is_active).length;
        const totalBudget = this.centers.reduce((sum, c) => sum + (c.currentBudget || 0), 0);
        const avgUtilization = this.centers.reduce((sum, c) => sum + (c.utilization || 0), 0) / totalCenters;
        const overbudgetCenters = this.centers.filter(c => c.utilization > 100).length;

        document.getElementById('active-centers-count').textContent = activeCenters;
        document.getElementById('total-budget-amount').textContent = this.formatCurrency(totalBudget);
        document.getElementById('avg-utilization').textContent = `${Math.round(avgUtilization)}%`;
        document.getElementById('overbudget-centers').textContent = overbudgetCenters;

        // Update utilization bar
        document.getElementById('utilization-fill').style.width = `${Math.min(avgUtilization, 100)}%`;
        
        // Add color coding
        const utilizationBar = document.getElementById('utilization-fill');
        utilizationBar.className = 'utilization-fill';
        if (avgUtilization > 90) utilizationBar.classList.add('danger');
        else if (avgUtilization > 70) utilizationBar.classList.add('warning');
        else utilizationBar.classList.add('success');
    }

    initializeCharts() {
        const ctx = document.getElementById('utilizationChart').getContext('2d');
        
        this.charts.utilization = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Utilizado', 'Disponible', 'Excedido'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#4ade80', '#e5e7eb', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        this.updateChart('utilization');
    }

    updateChart(chartType) {
        if (chartType === 'utilization') {
            const totalBudget = this.centers.reduce((sum, c) => sum + (c.currentBudget || 0), 0);
            const totalSpent = this.centers.reduce((sum, c) => sum + (c.spent || 0), 0);
            const totalOverbudget = this.centers.reduce((sum, c) => 
                sum + Math.max(0, (c.spent || 0) - (c.currentBudget || 0)), 0);
            
            const available = Math.max(0, totalBudget - totalSpent);
            const used = Math.max(0, totalSpent - totalOverbudget);

            this.charts.utilization.data.datasets[0].data = [used, available, totalOverbudget];
            this.charts.utilization.update();
        }
    }

    generateInsights() {
        const insights = [];
        
        // Análisis de utilización
        const highUtilization = this.centers.filter(c => c.utilization > 90 && c.utilization <= 100);
        if (highUtilization.length > 0) {
            insights.push({
                type: 'warning',
                title: 'Centros cerca del límite',
                message: `${highUtilization.length} centro(s) han utilizado más del 90% de su presupuesto`,
                action: 'Revisar y considerar ajustes presupuestarios'
            });
        }

        // Centros subutilizados
        const underutilized = this.centers.filter(c => c.utilization < 20 && c.currentBudget > 0);
        if (underutilized.length > 0) {
            insights.push({
                type: 'info',
                title: 'Oportunidad de reasignación',
                message: `${underutilized.length} centro(s) han utilizado menos del 20% de su presupuesto`,
                action: 'Considerar redistribuir presupuesto a otros centros'
            });
        }

        // Centros sobre presupuesto
        const overbudget = this.centers.filter(c => c.utilization > 100);
        if (overbudget.length > 0) {
            insights.push({
                type: 'danger',
                title: 'Exceso presupuestario',
                message: `${overbudget.length} centro(s) han excedido su presupuesto asignado`,
                action: 'Requiere aprobación para gastos adicionales'
            });
        }

        // Centros sin actividad
        const noActivity = this.centers.filter(c => !c.lastActivity);
        if (noActivity.length > 0) {
            insights.push({
                type: 'warning',
                title: 'Centros sin actividad',
                message: `${noActivity.length} centro(s) no tienen órdenes registradas`,
                action: 'Verificar si estos centros siguen siendo necesarios'
            });
        }

        this.renderInsights(insights);
    }

    renderInsights(insights) {
        const container = document.getElementById('insights-list');
        
        if (insights.length === 0) {
            container.innerHTML = `
                <div class="insight-item success">
                    <i class="fas fa-check-circle"></i>
                    <div class="insight-content">
                        <h4>Todo en orden</h4>
                        <p>No se detectaron problemas en los centros de costo</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = insights.map(insight => `
            <div class="insight-item ${insight.type}">
                <i class="fas fa-${this.getInsightIcon(insight.type)}"></i>
                <div class="insight-content">
                    <h4>${insight.title}</h4>
                    <p>${insight.message}</p>
                    <small class="insight-action">${insight.action}</small>
                </div>
            </div>
        `).join('');
    }

    getInsightIcon(type) {
        const icons = {
            'success': 'check-circle',
            'info': 'info-circle',
            'warning': 'exclamation-triangle',
            'danger': 'exclamation-circle'
        };
        return icons[type] || 'info-circle';
    }

    applyFilters() {
        const searchTerm = (document.getElementById('search-input').value || '').toLowerCase();
        const statusFilter = document.getElementById('status-filter').value;
        const typeFilter = document.getElementById('type-filter').value;

        this.filteredCenters = this.centers.filter(center => {
            const matchesSearch = !searchTerm || 
                (center.name || '').toLowerCase().includes(searchTerm) ||
                (center.code || '').toLowerCase().includes(searchTerm) ||
                ((center.manager || '').toLowerCase().includes(searchTerm));

            const matchesStatus = !statusFilter || center.status === statusFilter;
            const matchesType = !typeFilter || center.type === typeFilter;

            return matchesSearch && matchesStatus && matchesType;
        });

        this.currentPage = 1;
        this.renderTable();
        this.updateMetrics();
    }

    sort(field, direction) {
        this.currentSort = { field, direction };
        
        this.filteredCenters.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            // Handle undefined and different data types
            if (aVal == null) aVal = '';
            if (bVal == null) bVal = '';
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (direction === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });

        this.renderTable();
        this.updateSortIndicators(field, direction);
    }

    updateSortIndicators(field, direction) {
        document.querySelectorAll('.sortable i').forEach(i => {
            i.className = 'fas fa-sort';
        });

        const activeHeader = document.querySelector(`[data-sort="${field}"] i`);
        if (activeHeader) {
            activeHeader.className = `fas fa-sort-${direction === 'asc' ? 'up' : 'down'}`;
        }
    }

    renderTable() {
        const tbody = document.getElementById('centers-table-body');
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredCenters.slice(startIndex, endIndex);

        tbody.innerHTML = pageData.map(center => `
            <tr class="table-row ${center.status}">
                <td>
                    <input type="checkbox" class="row-checkbox" value="${center.id}">
                </td>
                <td class="font-mono">${center.code}</td>
                <td>
                    <div class="center-info">
                        <strong>${center.name}</strong>
                        <small class="text-muted">${center.department || 'Sin departamento'}</small>
                    </div>
                </td>
                <td>${center.manager || 'Sin asignar'}</td>
                <td class="text-right">
                    ${this.formatCurrency(center.currentBudget || 0)}
                    <small class="currency-code">${center.currency || 'CLP'}</small>
                </td>
                <td class="text-right">
                    ${this.formatCurrency(center.spent || 0)}
                </td>
                <td>
                    <div class="utilization-cell">
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getUtilizationClass(center.utilization)}" 
                                 style="width: ${Math.min(center.utilization, 100)}%"></div>
                        </div>
                        <span class="utilization-text">${Math.round(center.utilization || 0)}%</span>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${center.status}">
                        ${this.getStatusLabel(center.status)}
                    </span>
                </td>
                <td class="text-muted">
                    ${center.lastActivity ? this.formatDate(center.lastActivity) : 'Sin actividad'}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="costCenters.viewDetails(${center.id})" 
                                title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="costCenters.editCenter(${center.id})" 
                                title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="costCenters.toggleStatus(${center.id})" 
                                title="${center.is_active ? 'Desactivar' : 'Activar'}">
                            <i class="fas fa-${center.is_active ? 'pause' : 'play'}"></i>
                        </button>
                        <div class="dropdown">
                            <button class="btn-icon dropdown-toggle">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="dropdown-menu">
                                <a href="#" onclick="costCenters.viewBudgets && costCenters.viewBudgets(${center.id})">Ver Presupuestos</a>
                                <a href="#" onclick="costCenters.viewOrders && costCenters.viewOrders(${center.id})">Ver Órdenes</a>
                                <a href="#" onclick="costCenters.exportData && costCenters.exportData(${center.id})">Exportar Datos</a>
                                <hr>
                                <a href="#" onclick="costCenters.deleteCenter(${center.id})" class="text-danger">${center.is_active ? 'Desactivar' : 'Activar'}</a>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');

        this.updateTableInfo();
        this.renderPagination();
    }

    getUtilizationClass(utilization) {
        if (utilization > 100) return 'danger';
        if (utilization > 90) return 'warning';
        if (utilization > 70) return 'info';
        return 'success';
    }

    getStatusLabel(status) {
        const labels = {
            'active': 'Activo',
            'inactive': 'Inactivo',
            'overbudget': 'Sobre Presupuesto',
            'underutilized': 'Subutilizado'
        };
        return labels[status] || status;
    }

    updateTableInfo() {
        const total = this.filteredCenters.length;
        const startIndex = (this.currentPage - 1) * this.pageSize + 1;
        const endIndex = Math.min(startIndex + this.pageSize - 1, total);
        
        document.getElementById('showing-info').textContent = 
            `Mostrando ${total === 0 ? 0 : startIndex}-${total === 0 ? 0 : endIndex} de ${total} centros`;
    }

    renderPagination() {
        const container = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredCenters.length / this.pageSize);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let pagination = '';
        
        // Previous button
        pagination += `
            <button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                    onclick="costCenters.goToPage(${this.currentPage - 1})"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                pagination += `
                    <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                            onclick="costCenters.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                pagination += '<span class="page-ellipsis">...</span>';
            }
        }

        // Next button
        pagination += `
            <button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" 
                    onclick="costCenters.goToPage(${this.currentPage + 1})"
                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        container.innerHTML = pagination;
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredCenters.length / this.pageSize);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderTable();
        }
    }

    // Modal functions
    openCreateCenterModal() {
        document.getElementById('modal-title').textContent = 'Nuevo Centro de Costo';
        document.getElementById('costCenterForm').reset();
        document.getElementById('is-active').checked = true;
        this.editingId = null;
        document.getElementById('costCenterModal').classList.add('active');
    }

    closeCostCenterModal() {
        document.getElementById('costCenterModal').classList.remove('active');
        this.editingId = null;
    }

    async saveCostCenter() {
        try {
            this.showLoading(true);
            
            const formData = {
                code: document.getElementById('center-code').value,
                name: document.getElementById('center-name').value,
                type: document.getElementById('center-type').value,
                manager: document.getElementById('center-manager').value,
                email: document.getElementById('center-email').value,
                department: document.getElementById('center-department').value,
                currency: document.getElementById('default-currency').value,
                approval_limit: document.getElementById('approval-limit').value ? Number(document.getElementById('approval-limit').value) : null,
                description: document.getElementById('center-description').value,
                is_active: document.getElementById('is-active').checked ? 1 : 0,
                requires_approval: document.getElementById('requires-approval').checked ? 1 : 0
            };

            let url = '/api/cost-centers';
            let method = 'POST';
            if (this.editingId) {
                url = `/api/cost-centers/${this.editingId}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showSuccess(this.editingId ? 'Centro de costo actualizado' : 'Centro de costo creado');
                this.closeCostCenterModal();
                await this.loadCenters();
                this.updateMetrics();
                this.renderTable();
            } else {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Error al guardar el centro de costo');
            }
        } catch (error) {
            console.error('Error saving cost center:', error);
            this.showError('Error al guardar el centro de costo');
        } finally {
            this.showLoading(false);
        }
    }

    // Additional methods for advanced features
    async viewDetails(centerId) {
        const center = this.centers.find(c => c.id === centerId);
        if (!center) return;
        // Rellenar contenido mínimo del modal de detalles
        const title = document.getElementById('details-title');
        const overview = document.getElementById('overview-tab');
        if (title) title.textContent = `${center.code} - ${center.name}`;
        if (overview) {
            overview.innerHTML = `
                <div class="details-grid">
                    <div><strong>Responsable:</strong> ${center.manager || '—'}</div>
                    <div><strong>Depto:</strong> ${center.department || '—'}</div>
                    <div><strong>Moneda:</strong> ${center.currency || 'CLP'}</div>
                    <div><strong>Presupuesto:</strong> ${this.formatCurrency(center.currentBudget || 0)}</div>
                    <div><strong>Gastado:</strong> ${this.formatCurrency(center.spent || 0)}</div>
                    <div><strong>Utilización:</strong> ${Math.round(center.utilization || 0)}%</div>
                </div>
                <p style="margin-top:8px">${center.description || ''}</p>
            `;
        }
        document.getElementById('centerDetailsModal').classList.add('active');
    }

    async editCenter(centerId) {
        const center = this.centers.find(c => c.id === centerId);
        if (!center) return;
        this.editingId = centerId;
        document.getElementById('modal-title').textContent = 'Editar Centro de Costo';
        document.getElementById('center-code').value = center.code || '';
        document.getElementById('center-name').value = center.name || '';
        document.getElementById('center-type').value = center.type || 'operational';
        document.getElementById('center-manager').value = center.manager || '';
        document.getElementById('center-email').value = center.email || '';
        document.getElementById('center-department').value = center.department || '';
        document.getElementById('default-currency').value = center.currency || 'CLP';
        document.getElementById('approval-limit').value = center.approval_limit || '';
        document.getElementById('center-description').value = center.description || '';
        document.getElementById('is-active').checked = !!center.is_active;
        document.getElementById('requires-approval').checked = !!center.requires_approval;
        document.getElementById('costCenterModal').classList.add('active');
    }

    async toggleStatus(centerId) {
        try {
            this.showLoading(true);
            const resp = await fetch(`/api/cost-centers/${centerId}`, { method: 'DELETE' });
            if (!resp.ok) throw new Error('No se pudo actualizar el estado');
            await this.loadCenters();
            this.updateMetrics();
            this.renderTable();
            this.showSuccess('Estado actualizado');
        } catch (e) {
            console.error(e);
            this.showError('Error al actualizar estado');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteCenter(centerId) {
        // En este sistema, eliminar alterna el estado activo
        return this.toggleStatus(centerId);
    }

    toggleView(viewType) {
        const tableView = document.getElementById('table-view');
        const cardsView = document.getElementById('cards-view');
        
        if (viewType === 'cards') {
            tableView.classList.add('hidden');
            cardsView.classList.remove('hidden');
            this.renderCards();
        } else {
            cardsView.classList.add('hidden');
            tableView.classList.remove('hidden');
        }
        
        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewType);
        });
    }

    renderCards() {
        const container = document.getElementById('centers-grid');
        
        container.innerHTML = this.filteredCenters.map(center => `
            <div class="center-card ${center.status}">
                <div class="card-header">
                    <h3>${center.name}</h3>
                    <span class="center-code">${center.code}</span>
                </div>
                <div class="card-body">
                    <div class="card-metrics">
                        <div class="metric">
                            <label>Presupuesto:</label>
                            <span>${this.formatCurrency(center.currentBudget || 0)}</span>
                        </div>
                        <div class="metric">
                            <label>Gastado:</label>
                            <span>${this.formatCurrency(center.spent || 0)}</span>
                        </div>
                        <div class="metric">
                            <label>Utilización:</label>
                            <span class="${this.getUtilizationClass(center.utilization)}">
                                ${Math.round(center.utilization || 0)}%
                            </span>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getUtilizationClass(center.utilization)}" 
                             style="width: ${Math.min(center.utilization, 100)}%"></div>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="status-badge ${center.status}">
                        ${this.getStatusLabel(center.status)}
                    </span>
                    <div class="card-actions">
                        <button onclick="costCenters.viewDetails(${center.id})" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="costCenters.editCenter(${center.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    switchChart(chartType) {
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.chart === chartType);
        });
        
        this.updateChart(chartType);
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}-tab`);
        });
    }

    async refreshAll() {
        await this.loadCenters();
        this.updateMetrics();
        this.generateInsights();
        this.updateChart('utilization');
        this.renderTable();
        this.showSuccess('Datos actualizados');
    }

    async exportReport() {
        const csvData = this.generateCSVData();
        this.downloadCSV(csvData, 'centros_costo_reporte.csv');
    }

    generateCSVData() {
        const headers = ['Código', 'Nombre', 'Tipo', 'Manager', 'Presupuesto', 'Gastado', 'Utilización %', 'Estado'];
        const rows = this.filteredCenters.map(center => [
            center.code,
            center.name,
            center.type || '',
            center.manager || '',
            center.currentBudget || 0,
            center.spent || 0,
            Math.round(center.utilization || 0),
            this.getStatusLabel(center.status)
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    downloadCSV(data, filename) {
        const blob = new Blob([data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    formatCurrency(amount, currency = 'CLP') {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: currency === 'UF' ? 'CLP' : currency,
            minimumFractionDigits: currency === 'UF' ? 4 : 0
        }).format(Number(amount) || 0);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
        });
    }

    debounce(func, wait) {
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

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Simple fallback notification
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// Initialize the advanced cost centers system
let costCenters;
document.addEventListener('DOMContentLoaded', () => {
    costCenters = new CostCentersAdvanced();
});

// Utility functions for global access
function logout() {
    if (confirm('¿Está seguro de que desea cerrar sesión?')) {
        window.location.href = '/login';
    }
}

function openCreateCenterModal() {
    costCenters.openCreateCenterModal();
}

function closeCostCenterModal() {
    costCenters.closeCostCenterModal();
}

function applyAdvancedFilters() {
    costCenters.applyFilters();
}

function refreshAll() {
    costCenters.refreshAll();
}

function exportReport() {
    costCenters.exportReport();
}

function printReport() {
    window.print();
}
