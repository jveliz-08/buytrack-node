// Advanced Budget Management System
class BudgetsAdvanced {
    constructor() {
        this.budgets = [];
        this.costCenters = [];
        this.orders = [];
        this.filteredBudgets = [];
        this.currentPeriod = new Date().toISOString().substr(0, 7);
        this.currentPage = 1;
        this.pageSize = 10;
        this.currentSort = { field: 'center_name', direction: 'asc' };
        this.filters = {};
        this.charts = {};
        this.selectedBudgets = new Set();
        
        this.init();
    }

    async init() {
        this.showLoading(true);
        await this.loadData();
        this.setupEventListeners();
        this.initializeCharts();
        this.updateExecutiveDashboard();
        this.generateInsights();
        this.renderBudgetTable();
        this.showLoading(false);
    }

    setupEventListeners() {
        // Period navigation
        document.getElementById('period-input').value = this.currentPeriod;
        document.getElementById('period-input').addEventListener('change', (e) => {
            this.currentPeriod = e.target.value;
            this.changePeriod('custom');
        });

        // Filters
        document.getElementById('currency-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('status-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('department-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('search-filter').addEventListener('input', 
            this.debounce(() => this.applyFilters(), 300));

        // Table controls
        document.getElementById('items-per-page').addEventListener('change', () => this.changePageSize());
        document.getElementById('select-all-budgets').addEventListener('change', (e) => 
            this.toggleSelectAll(e.target.checked));

        // Chart controls
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchChart(e.target.dataset.chart));
        });

        // Form submission
        document.getElementById('budgetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveBudget();
        });

        // Tab switching in modals
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Sort functionality
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                const direction = this.currentSort.field === field && 
                    this.currentSort.direction === 'asc' ? 'desc' : 'asc';
                this.sort(field, direction);
            });
        });
    }

    async loadData() {
        try {
            const [budgetsResponse, centersResponse, ordersResponse] = await Promise.all([
                fetch('/api/budgets'),
                fetch('/api/cost-centers'),
                fetch('/api/orders')
            ]);

            this.budgets = await budgetsResponse.json();
            this.costCenters = await centersResponse.json();
            this.orders = await ordersResponse.json();

            // Enrich budgets with spending data and analytics
            this.budgets = this.budgets.map(budget => {
                const center = this.costCenters.find(c => c.id === budget.cost_center_id);
                const periodOrders = this.orders.filter(o => 
                    o.cost_center_id === budget.cost_center_id && 
                    o.order_date && o.order_date.startsWith(budget.period)
                );

                const spent = periodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
                const utilization = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
                const remaining = budget.amount - spent;
                
                // Calculate projection based on spending trends
                const daysInMonth = new Date(budget.period.split('-')[0], budget.period.split('-')[1], 0).getDate();
                const currentDay = new Date().getDate();
                const monthProgress = Math.min(currentDay / daysInMonth, 1);
                const projectedSpent = monthProgress > 0 ? spent / monthProgress : spent;

                return {
                    ...budget,
                    center_name: center ? center.name : 'Centro Desconocido',
                    center_code: center ? center.code : 'N/A',
                    department: center ? center.department : '',
                    spent: spent,
                    utilization: utilization,
                    remaining: remaining,
                    projectedSpent: projectedSpent,
                    projectedRemaining: budget.amount - projectedSpent,
                    ordersCount: periodOrders.length,
                    status: this.calculateBudgetStatus(utilization, remaining),
                    efficiency: this.calculateEfficiency(spent, budget.amount, monthProgress),
                    lastModified: budget.updated_at || budget.created_at
                };
            });

            // Filter to current period
            this.filteredBudgets = this.budgets.filter(b => b.period === this.currentPeriod);
            
            // Populate filter dropdowns
            this.populateFilterDropdowns();

        } catch (error) {
            console.error('Error loading budget data:', error);
            this.showError('Error al cargar los datos de presupuestos');
        }
    }

    calculateBudgetStatus(utilization, remaining) {
        if (utilization > 100) return 'exceeded';
        if (utilization > 95) return 'critical';
        if (utilization > 80) return 'warning';
        return 'normal';
    }

    calculateEfficiency(spent, budget, monthProgress) {
        if (monthProgress === 0 || budget === 0) return 100;
        const expectedSpent = budget * monthProgress;
        if (expectedSpent === 0) return 100;
        return Math.max(0, 100 - Math.abs((spent - expectedSpent) / expectedSpent) * 100);
    }

    populateFilterDropdowns() {
        // Department filter
        const departments = [...new Set(this.budgets.map(b => b.department).filter(d => d))];
        const departmentFilter = document.getElementById('department-filter');
        departmentFilter.innerHTML = '<option value="">Todos los Departamentos</option>' +
            departments.map(dept => `<option value="${dept}">${dept}</option>`).join('');

        // Cost center options for budget creation
        const centerSelect = document.getElementById('budget-cost-center');
        centerSelect.innerHTML = '<option value="">Seleccionar centro...</option>' +
            this.costCenters.map(center => 
                `<option value="${center.id}">${center.code} - ${center.name}</option>`
            ).join('');
    }

    updateExecutiveDashboard() {
        const currentBudgets = this.budgets.filter(b => b.period === this.currentPeriod);
        
        const totalBudget = currentBudgets.reduce((sum, b) => sum + (b.amount || 0), 0);
        const totalSpent = currentBudgets.reduce((sum, b) => sum + (b.spent || 0), 0);
        const availableBudget = totalBudget - totalSpent;
        const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        // Update main metrics
        document.getElementById('total-budget-amount').textContent = this.formatCurrency(totalBudget);
        document.getElementById('total-spent').textContent = this.formatCurrency(totalSpent);
        document.getElementById('available-budget').textContent = this.formatCurrency(availableBudget);
        document.getElementById('current-period').textContent = this.formatPeriod(this.currentPeriod);
        document.getElementById('centers-count').textContent = `${currentBudgets.length} centros`;

        // Update progress bar
        document.getElementById('spent-fill').style.width = `${Math.min(spentPercentage, 100)}%`;
        document.getElementById('spent-percentage').textContent = `${Math.round(spentPercentage)}%`;

        // Update alerts
        const alerts = this.calculateAlerts(currentBudgets);
        document.getElementById('active-alerts').textContent = alerts.total;
        
        const alertBreakdown = document.getElementById('alert-breakdown');
        alertBreakdown.innerHTML = `
            <div class="alert-item critical">${alerts.critical} Críticas</div>
            <div class="alert-item warning">${alerts.warning} Advertencias</div>
            <div class="alert-item exceeded">${alerts.exceeded} Excedidas</div>
        `;

        // Update period label
        document.getElementById('period-label').textContent = this.formatPeriod(this.currentPeriod);

        // Update quick stats
        const avgEfficiency = currentBudgets.reduce((sum, b) => sum + b.efficiency, 0) / currentBudgets.length;
        const monthProjection = currentBudgets.reduce((sum, b) => sum + b.projectedSpent, 0);
        const potentialSavings = currentBudgets.reduce((sum, b) => sum + Math.max(0, b.remaining), 0);

        document.getElementById('avg-efficiency').textContent = `${Math.round(avgEfficiency)}%`;
        document.getElementById('month-projection').textContent = this.formatCurrency(monthProjection);
        document.getElementById('potential-savings').textContent = this.formatCurrency(potentialSavings);
    }

    calculateAlerts(budgets) {
        return {
            critical: budgets.filter(b => b.status === 'critical').length,
            warning: budgets.filter(b => b.status === 'warning').length,
            exceeded: budgets.filter(b => b.status === 'exceeded').length,
            total: budgets.filter(b => ['critical', 'warning', 'exceeded'].includes(b.status)).length
        };
    }

    initializeCharts() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        this.charts.spending = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Gasto Acumulado',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Presupuesto',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderDash: [5, 5],
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${this.formatCurrency(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value, true)
                        }
                    }
                }
            }
        });

        this.updateChart('spending-trend');
    }

    updateChart(chartType) {
        const currentBudgets = this.budgets.filter(b => b.period === this.currentPeriod);
        
        if (chartType === 'spending-trend') {
            // Generate spending trend data
            const trendData = this.generateSpendingTrendData(currentBudgets);
            this.charts.spending.data.labels = trendData.labels;
            this.charts.spending.data.datasets[0].data = trendData.spending;
            this.charts.spending.data.datasets[1].data = trendData.budget;
            this.charts.spending.update();
        }
    }

    generateSpendingTrendData(budgets) {
        // Generate daily spending trend for the current month
        const year = parseInt(this.currentPeriod.split('-')[0]);
        const month = parseInt(this.currentPeriod.split('-')[1]);
        const daysInMonth = new Date(year, month, 0).getDate();
        
        const labels = [];
        const spending = [];
        const budget = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            labels.push(day);
            
            // Calculate cumulative spending up to this day
            const dailySpending = this.orders
                .filter(o => o.order_date && o.order_date.startsWith(date.substr(0, 10)))
                .reduce((sum, o) => sum + (o.total_amount || 0), 0);
            
            const cumulativeSpending = spending.length > 0 ? 
                spending[spending.length - 1] + dailySpending : dailySpending;
            
            spending.push(cumulativeSpending);
            
            // Calculate proportional budget
            const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
            const proportionalBudget = (totalBudget / daysInMonth) * day;
            budget.push(proportionalBudget);
        }
        
        return { labels, spending, budget };
    }

    generateInsights() {
        const currentBudgets = this.budgets.filter(b => b.period === this.currentPeriod);
        const insights = [];

        // Budget utilization insights
        const overUtilized = currentBudgets.filter(b => b.utilization > 90);
        if (overUtilized.length > 0) {
            insights.push({
                type: 'warning',
                title: 'Presupuestos Casi Agotados',
                message: `${overUtilized.length} presupuesto(s) han utilizado más del 90% de sus fondos`,
                action: 'Considere ajustar los presupuestos o revisar los gastos',
                priority: 'high'
            });
        }

        // Efficiency insights
        const lowEfficiency = currentBudgets.filter(b => b.efficiency < 60);
        if (lowEfficiency.length > 0) {
            insights.push({
                type: 'info',
                title: 'Oportunidades de Optimización',
                message: `${lowEfficiency.length} centro(s) muestran baja eficiencia presupuestaria`,
                action: 'Analizar patrones de gasto y redistribuir recursos',
                priority: 'medium'
            });
        }

        // Projection insights
        const currentDay = new Date().getDate();
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const monthProgress = currentDay / daysInMonth;

        const overProjected = currentBudgets.filter(b => b.projectedSpent > b.amount * 1.1);
        if (overProjected.length > 0 && monthProgress < 0.8) {
            insights.push({
                type: 'danger',
                title: 'Proyección de Sobregasto',
                message: `${overProjected.length} presupuesto(s) proyectan exceder sus límites`,
                action: 'Implementar controles de gasto inmediatos',
                priority: 'critical'
            });
        }

        // Underutilization insights
        const underUtilized = currentBudgets.filter(b => b.utilization < 20 && monthProgress > 0.5);
        if (underUtilized.length > 0) {
            insights.push({
                type: 'success',
                title: 'Recursos Subutilizados',
                message: `${underUtilized.length} presupuesto(s) muestran baja utilización`,
                action: 'Evaluar redistribución de fondos a áreas de mayor demanda',
                priority: 'low'
            });
        }

        // Savings opportunities
        const totalSavings = currentBudgets.reduce((sum, b) => sum + Math.max(0, b.remaining), 0);
        if (totalSavings > 0) {
            insights.push({
                type: 'success',
                title: 'Potencial de Ahorro',
                message: `Se pueden ahorrar ${this.formatCurrency(totalSavings)} optimizando gastos`,
                action: 'Implementar estrategias de ahorro y eficiencia',
                priority: 'medium'
            });
        }

        this.renderInsights(insights);
    }

    renderInsights(insights) {
        const container = document.getElementById('budget-insights');
        
        if (insights.length === 0) {
            container.innerHTML = `
                <div class="insight-item success">
                    <i class="fas fa-check-circle"></i>
                    <div class="insight-content">
                        <h4>Gestión Óptima</h4>
                        <p>Todos los presupuestos están siendo gestionados eficientemente</p>
                        <small class="insight-action">Continúe monitoreando el desempeño</small>
                    </div>
                </div>
            `;
            return;
        }

        // Sort by priority
        const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        insights.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

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
        const searchTerm = document.getElementById('search-filter').value.toLowerCase();
        const currencyFilter = document.getElementById('currency-filter').value;
        const statusFilter = document.getElementById('status-filter').value;
        const departmentFilter = document.getElementById('department-filter').value;

        this.filteredBudgets = this.budgets.filter(budget => {
            const periodMatch = budget.period === this.currentPeriod;
            
            const searchMatch = !searchTerm || 
                budget.center_name.toLowerCase().includes(searchTerm) ||
                budget.center_code.toLowerCase().includes(searchTerm) ||
                (budget.department && budget.department.toLowerCase().includes(searchTerm));

            const currencyMatch = !currencyFilter || budget.currency === currencyFilter;
            const statusMatch = !statusFilter || budget.status === statusFilter;
            const departmentMatch = !departmentFilter || budget.department === departmentFilter;

            return periodMatch && searchMatch && currencyMatch && statusMatch && departmentMatch;
        });

        this.currentPage = 1;
        this.renderBudgetTable();
        this.updateTableSummary();
    }

    sort(field, direction) {
        this.currentSort = { field, direction };
        
        this.filteredBudgets.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

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

        this.renderBudgetTable();
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

    renderBudgetTable() {
        const tbody = document.getElementById('budgets-table-body');
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredBudgets.slice(startIndex, endIndex);

        tbody.innerHTML = pageData.map(budget => `
            <tr class="table-row ${budget.status}">
                <td>
                    <input type="checkbox" class="budget-checkbox" value="${budget.id}" 
                           onchange="budgetManager.toggleBudgetSelection(${budget.id}, this.checked)">
                </td>
                <td>
                    <div class="center-info">
                        <strong>${budget.center_name}</strong>
                        <small class="text-muted">${budget.center_code}</small>
                        ${budget.department ? `<br><small class="text-muted">${budget.department}</small>` : ''}
                    </div>
                </td>
                <td class="font-mono">${this.formatPeriod(budget.period)}</td>
                <td class="text-right">
                    ${this.formatCurrency(budget.amount)}
                    <small class="currency-code">${budget.currency}</small>
                </td>
                <td class="text-right">
                    ${this.formatCurrency(budget.spent)}
                    <small class="text-muted">(${budget.ordersCount} órdenes)</small>
                </td>
                <td>
                    <div class="utilization-cell">
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getUtilizationClass(budget.utilization)}" 
                                 style="width: ${Math.min(budget.utilization, 100)}%"></div>
                        </div>
                        <span class="utilization-text">${Math.round(budget.utilization)}%</span>
                    </div>
                </td>
                <td class="text-right ${budget.remaining < 0 ? 'text-danger' : 'text-muted'}">
                    ${this.formatCurrency(budget.remaining)}
                </td>
                <td class="text-right">
                    <div class="projection-info">
                        ${this.formatCurrency(budget.projectedSpent)}
                        <small class="text-muted">
                            (${budget.projectedRemaining < 0 ? '-' : ''}${this.formatCurrency(Math.abs(budget.projectedRemaining))})
                        </small>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${budget.status}">
                        ${this.getStatusLabel(budget.status)}
                    </span>
                    ${budget.efficiency < 70 ? '<br><small class="text-warning">Baja eficiencia</small>' : ''}
                </td>
                <td class="text-muted">
                    ${this.formatDate(budget.lastModified)}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="budgetManager.viewBudgetDetails(${budget.id})" 
                                title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="budgetManager.editBudget(${budget.id})" 
                                title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="budgetManager.duplicateBudget(${budget.id})" 
                                title="Duplicar">
                            <i class="fas fa-copy"></i>
                        </button>
                        <div class="dropdown">
                            <button class="btn-icon dropdown-toggle" onclick="budgetManager.toggleDropdown(this)">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="dropdown-menu">
                                <a href="#" onclick="budgetManager.adjustBudget(${budget.id})">Ajustar Presupuesto</a>
                                <a href="#" onclick="budgetManager.viewOrders(${budget.id})">Ver Órdenes</a>
                                <a href="#" onclick="budgetManager.exportBudget(${budget.id})">Exportar</a>
                                <hr>
                                <a href="#" onclick="budgetManager.deleteBudget(${budget.id})" class="text-danger">Eliminar</a>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');

        this.renderPagination();
    }

    getUtilizationClass(utilization) {
        if (utilization > 100) return 'danger';
        if (utilization > 95) return 'critical';
        if (utilization > 80) return 'warning';
        if (utilization > 50) return 'info';
        return 'success';
    }

    getStatusLabel(status) {
        const labels = {
            'normal': 'Normal',
            'warning': 'Advertencia',
            'critical': 'Crítico',
            'exceeded': 'Excedido'
        };
        return labels[status] || status;
    }

    updateTableSummary() {
        const totalBudgeted = this.filteredBudgets.reduce((sum, b) => sum + (b.amount || 0), 0);
        const totalExecuted = this.filteredBudgets.reduce((sum, b) => sum + (b.spent || 0), 0);
        const totalAvailable = totalBudgeted - totalExecuted;

        document.getElementById('summary-budgeted').textContent = this.formatCurrency(totalBudgeted);
        document.getElementById('summary-executed').textContent = this.formatCurrency(totalExecuted);
        document.getElementById('summary-available').textContent = this.formatCurrency(totalAvailable);
    }

    renderPagination() {
        const container = document.getElementById('budget-pagination');
        const totalPages = Math.ceil(this.filteredBudgets.length / this.pageSize);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let pagination = `
            <button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                    onclick="budgetManager.goToPage(${this.currentPage - 1})"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                pagination += `
                    <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                            onclick="budgetManager.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                pagination += '<span class="page-ellipsis">...</span>';
            }
        }

        pagination += `
            <button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" 
                    onclick="budgetManager.goToPage(${this.currentPage + 1})"
                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        container.innerHTML = pagination;
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredBudgets.length / this.pageSize);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderBudgetTable();
        }
    }

    changePageSize() {
        this.pageSize = parseInt(document.getElementById('items-per-page').value);
        this.currentPage = 1;
        this.renderBudgetTable();
    }

    toggleSelectAll(checked) {
        const checkboxes = document.querySelectorAll('.budget-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            this.toggleBudgetSelection(parseInt(cb.value), checked);
        });
        this.updateBulkActions();
    }

    toggleBudgetSelection(budgetId, selected) {
        if (selected) {
            this.selectedBudgets.add(budgetId);
        } else {
            this.selectedBudgets.delete(budgetId);
        }
        this.updateBulkActions();
    }

    updateBulkActions() {
        const bulkAction = document.getElementById('bulk-action');
        const bulkExecute = document.getElementById('bulk-execute');
        const hasSelection = this.selectedBudgets.size > 0;
        
        bulkAction.disabled = !hasSelection;
        bulkExecute.disabled = !hasSelection;
    }

    // Modal functions
    openCreateBudgetModal() {
        document.getElementById('budget-modal-title').textContent = 'Nuevo Presupuesto';
        document.getElementById('budgetForm').reset();
        
        // Set default period to current
        document.getElementById('budget-period').value = this.currentPeriod;
        
        // Switch to first tab
        this.switchTab('basic');
        
        document.getElementById('budgetModal').classList.add('active');
    }

    closeBudgetModal() {
        document.getElementById('budgetModal').classList.remove('active');
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}-tab`);
        });
    }

    switchChart(chartType) {
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.chart === chartType);
        });
        
        this.updateChart(chartType);
    }

    changePeriod(direction) {
        const current = new Date(this.currentPeriod + '-01');
        
        if (direction === 'previous') {
            current.setMonth(current.getMonth() - 1);
        } else if (direction === 'next') {
            current.setMonth(current.getMonth() + 1);
        } else if (direction === 'custom') {
            // Period already updated from input
        }
        
        if (direction !== 'custom') {
            this.currentPeriod = current.toISOString().substr(0, 7);
            document.getElementById('period-input').value = this.currentPeriod;
        }
        
        this.applyFilters();
        this.updateExecutiveDashboard();
        this.updateChart('spending-trend');
        this.generateInsights();
    }

    async saveBudget() {
        try {
            this.showLoading(true);
            
            const formData = {
                cost_center_id: document.getElementById('budget-cost-center').value,
                period: document.getElementById('budget-period').value,
                amount: parseFloat(document.getElementById('budget-amount').value),
                currency: document.getElementById('budget-currency').value,
                category: document.getElementById('budget-category').value,
                description: document.getElementById('budget-description').value,
                priority: document.getElementById('budget-priority').value,
                approver: document.getElementById('budget-approver').value,
                warning_threshold: parseInt(document.getElementById('warning-threshold').value),
                critical_threshold: parseInt(document.getElementById('critical-threshold').value),
                overspend_limit: parseInt(document.getElementById('overspend-limit').value),
                auto_adjust: document.getElementById('auto-adjust').checked,
                rollover_unused: document.getElementById('rollover-unused').checked,
                require_approval: document.getElementById('require-approval').checked,
                email_alerts: document.getElementById('email-alerts').checked
            };

            const response = await fetch('/api/budgets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showSuccess('Presupuesto creado exitosamente');
                this.closeBudgetModal();
                await this.loadData();
                this.updateExecutiveDashboard();
                this.renderBudgetTable();
            } else {
                throw new Error('Error al crear el presupuesto');
            }
        } catch (error) {
            console.error('Error saving budget:', error);
            this.showError('Error al guardar el presupuesto');
        } finally {
            this.showLoading(false);
        }
    }

    // Utility functions
    formatCurrency(amount, abbreviated = false) {
        if (abbreviated && amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        } else if (abbreviated && amount >= 1000) {
            return `$${(amount / 1000).toFixed(1)}K`;
        }
        
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatPeriod(period) {
        const [year, month] = period.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('es-CL', { year: 'numeric', month: 'long' });
    }

    formatDate(dateString) {
        const date = new Date(dateString);
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
        console.log(`${type.toUpperCase()}: ${message}`);
        // You can implement a proper notification system here
    }

    // Advanced features placeholder methods
    async viewBudgetDetails(budgetId) { /* Implementation */ }
    async editBudget(budgetId) { /* Implementation */ }
    async duplicateBudget(budgetId) { /* Implementation */ }
    async adjustBudget(budgetId) { /* Implementation */ }
    async deleteBudget(budgetId) { /* Implementation */ }
    async generateForecast() { /* Implementation */ }
    async exportBudgetReport() { /* Implementation */ }
    async importBudgets() { /* Implementation */ }
    openBulkUpdateModal() { /* Implementation */ }
    executeBulkAction() { /* Implementation */ }
    toggleDropdown(button) {
        const dropdown = button.closest('.dropdown');
        dropdown.classList.toggle('active');
    }
}

// Initialize the advanced budget system
let budgetManager;
document.addEventListener('DOMContentLoaded', () => {
    budgetManager = new BudgetsAdvanced();
});

// Global functions for HTML access
function logout() {
    if (confirm('¿Está seguro de que desea cerrar sesión?')) {
        window.location.href = '/login';
    }
}

function openCreateBudgetModal() {
    budgetManager.openCreateBudgetModal();
}

function closeBudgetModal() {
    budgetManager.closeBudgetModal();
}

function openBulkUpdateModal() {
    budgetManager.openBulkUpdateModal();
}

function applyFilters() {
    budgetManager.applyFilters();
}

function changePeriod(direction) {
    budgetManager.changePeriod(direction);
}

function refreshBudgetData() {
    budgetManager.init();
}

function generateForecast() {
    budgetManager.generateForecast();
}

function exportBudgetReport() {
    budgetManager.exportBudgetReport();
}

function importBudgets() {
    budgetManager.importBudgets();
}
