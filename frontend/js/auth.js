// auth.js - Полностью переписанный с поддержкой платинового купона
class AuthService {
    constructor() {
        this.baseURL = 'http://localhost:5000/api';
        this.token = localStorage.getItem('token');
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.baseURL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    throw { validation: true, errors: data.errors };
                }
                throw new Error(data.message || 'Ошибка регистрации');
            }

            if (data.token) {
                this.token = data.token;
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            return data;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, rememberMe }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Слишком много попыток входа. Попробуйте через 15 минут.');
                }
                throw new Error(data.message || 'Ошибка входа');
            }

            if (data.token) {
                this.token = data.token;
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await fetch(`${this.baseURL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.token = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/register.html';
        }
    }

    async getCurrentUser() {
        try {
            const response = await fetch(`${this.baseURL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);
            }

            return data.user;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    async updateGameStats(score) {
        try {
            const response = await fetch(`${this.baseURL}/auth/update-game-stats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ score }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);
            }

            if (data.gameStats) {
                const user = this.getUser();
                if (user) {
                    user.gameStats = data.gameStats;
                    localStorage.setItem('user', JSON.stringify(user));
                }
            }

            return data;
        } catch (error) {
            console.error('Update game stats error:', error);
            throw error;
        }
    }

    async getCoupons() {
        try {
            const response = await fetch(`${this.baseURL}/auth/coupons`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);
            }

            return data.coupons || [];
        } catch (error) {
            console.error('Get coupons error:', error);
            return [];
        }
    }

    isAuthenticated() {
        return !!this.token;
    }

    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }
}

// Инициализация
const authService = new AuthService();

// Функция показа уведомлений
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Обработчики форм
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginFormElement');
    const registerForm = document.getElementById('registerFormElement');

    // Очистка предыдущих ошибок
    function clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        document.querySelectorAll('.form-group.error').forEach(el => {
            el.classList.remove('error');
        });
    }

    // Показ ошибок
    function showErrors(errors) {
        clearErrors();
        
        errors.forEach(error => {
            const fieldMap = {
                'name': 'regName',
                'email': 'regEmail',
                'phone': 'regPhone',
                'password': 'regPassword',
                'confirmPassword': 'regConfirmPassword'
            };

            const fieldId = fieldMap[error.field];
            if (fieldId) {
                const input = document.getElementById(fieldId);
                if (input) {
                    const formGroup = input.closest('.form-group');
                    formGroup.classList.add('error');
                    
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'error-message';
                    errorDiv.textContent = error.message;
                    formGroup.appendChild(errorDiv);
                }
            }
        });
    }

    // Регистрация
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearErrors();

            const formData = {
                name: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                phone: document.getElementById('regPhone').value,
                password: document.getElementById('regPassword').value,
                confirmPassword: document.getElementById('regConfirmPassword').value
            };

            try {
                const result = await authService.register(formData);
                
                if (result.success) {
                    showNotification('Регистрация прошла успешно!', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                }
            } catch (error) {
                if (error.validation) {
                    showErrors(error.errors);
                } else {
                    showNotification(error.message, 'error');
                }
            }
        });
    }

    // Вход
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearErrors();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.querySelector('#loginForm input[type="checkbox"]')?.checked || false;

            try {
                const result = await authService.login(email, password, rememberMe);
                
                if (result.success) {
                    showNotification('Вход выполнен успешно!', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                }
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }

    // Валидация в реальном времени
    const passwordInput = document.getElementById('regPassword');
    const confirmInput = document.getElementById('regConfirmPassword');

    if (passwordInput && confirmInput) {
        [passwordInput, confirmInput].forEach(input => {
            input.addEventListener('input', function() {
                if (confirmInput.value && passwordInput.value !== confirmInput.value) {
                    confirmInput.closest('.form-group').classList.add('error');
                    let errorDiv = confirmInput.parentElement.querySelector('.error-message');
                    if (!errorDiv) {
                        errorDiv = document.createElement('div');
                        errorDiv.className = 'error-message';
                        confirmInput.parentElement.appendChild(errorDiv);
                    }
                    errorDiv.textContent = 'Пароли не совпадают';
                } else {
                    confirmInput.closest('.form-group').classList.remove('error');
                    const errorDiv = confirmInput.parentElement.querySelector('.error-message');
                    if (errorDiv) errorDiv.remove();
                }
            });
        });
    }
});