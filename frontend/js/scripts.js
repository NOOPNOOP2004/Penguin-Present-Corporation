// Проверка авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    const authService = new AuthService();
    
    // Проверка авторизации
    if (authService.isAuthenticated()) {
        const user = authService.getUser();
        
        // Обновление навигации
        updateNavigation(user);
        
        // Проверка актуальности данных
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
            localStorage.setItem('user', JSON.stringify(currentUser));
        }
    } else {
        // Обновление навигации для неавторизованных
        updateNavigation(null);
    }
});

function updateNavigation(user) {
    const nav = document.querySelector('nav ul');
    if (!nav) return;

    if (user) {
        // Замена ссылки "Вход" на профиль
        const loginLink = nav.querySelector('a[href="register.html"]');
        if (loginLink) {
            const li = loginLink.parentElement;
            li.innerHTML = `
                <a href="#" id="profileLink">
                    <i class="fas fa-user"></i> ${user.name}
                </a>
                <div class="profile-dropdown" style="display: none;">
                    <a href="#profile">Профиль</a>
                    <a href="#" id="logoutBtn">Выход</a>
                </div>
            `;
        }
    }

    // Обработчик выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await authService.logout();
        });
    }

    // Показ/скрытие дропдауна
    const profileLink = document.getElementById('profileLink');
    if (profileLink) {
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            const dropdown = document.querySelector('.profile-dropdown');
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
    }
}