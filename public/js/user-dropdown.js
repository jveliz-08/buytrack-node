// ============================
// USER DROPDOWN FUNCTIONALITY
// ============================

// Funciones del dropdown de usuario
function toggleUserDropdown() {
    const dropdown = document.getElementById('user-dropdown-menu');
    const arrow = document.querySelector('.dropdown-arrow');
    if (dropdown && arrow) {
        dropdown.classList.toggle('show');
        arrow.classList.toggle('rotated');
    }
}

function openProfileSettings() {
    alert('Funcionalidad de configuración en desarrollo');
    toggleUserDropdown();
}

function viewActivity() {
    alert('Historial de actividad en desarrollo');
    toggleUserDropdown();
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    toggleUserDropdown();
    
    // Guardar preferencia del tema
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('darkTheme', isDark);
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('user-dropdown-menu');
    const userInfo = document.getElementById('user-info');
    
    if (dropdown && userInfo && 
        !userInfo.contains(event.target) && 
        !dropdown.contains(event.target)) {
        dropdown.classList.remove('show');
        const arrow = document.querySelector('.dropdown-arrow');
        if (arrow) arrow.classList.remove('rotated');
    }
});

// Inicializar información del usuario
function initUserInfo() {
    const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // Actualizar nombre en el header
    const headerName = document.getElementById('user-name');
    if(headerName) headerName.textContent = u.name || u.username || 'Usuario';
    
    // Actualizar información en el dropdown
    const dropdownName = document.getElementById('dropdown-user-name');
    if(dropdownName) dropdownName.textContent = u.name || u.username || 'Usuario';
    
    const dropdownEmail = document.getElementById('dropdown-user-email');
    if(dropdownEmail) dropdownEmail.textContent = u.email || 'jose.veliz@oycservicios.cl';
    
    const dropdownRole = document.getElementById('dropdown-user-role');
    if(dropdownRole) dropdownRole.textContent = u.role || 'Administrador';
    
    // Aplicar tema guardado
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') {
        document.body.classList.add('dark-theme');
    }
}

// Inicializar automáticamente cuando se carga el DOM
document.addEventListener('DOMContentLoaded', initUserInfo);

// También ejecutar inmediatamente si el DOM ya está cargado
if (document.readyState === 'loading') {
    // El DOM aún se está cargando
} else {
    // El DOM ya está listo
    initUserInfo();
}
