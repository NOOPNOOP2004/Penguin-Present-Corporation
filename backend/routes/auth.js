const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { 
    protect, 
    loginRateLimiter, 
    sanitizeInput,
    validateEmail,
    validatePhone 
} = require('../middleware/auth');
const { pool } = require('../config/database');

// Генерация JWT токена
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// @route   POST /api/auth/register
// @desc    Регистрация пользователя
router.post('/register', sanitizeInput, async (req, res) => {
    try {
        const { name, email, phone, password, confirmPassword } = req.body;

        // Валидация
        const errors = [];

        if (!name || name.length < 2 || name.length > 50) {
            errors.push({ field: 'name', message: 'Имя должно содержать от 2 до 50 символов' });
        }

        if (!validateEmail(email)) {
            errors.push({ field: 'email', message: 'Введите корректный email' });
        }

        if (!validatePhone(phone)) {
            errors.push({ field: 'phone', message: 'Введите корректный номер телефона' });
        }

        if (!password || password.length < 6) {
            errors.push({ field: 'password', message: 'Пароль должен содержать минимум 6 символов' });
        } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
            errors.push({ field: 'password', message: 'Пароль должен содержать хотя бы одну букву и одну цифру' });
        }

        if (password !== confirmPassword) {
            errors.push({ field: 'confirmPassword', message: 'Пароли не совпадают' });
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors
            });
        }

        // Проверка существующего пользователя
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Пользователь с таким email уже существует'
            });
        }

        // Создание пользователя
        const user = await User.create({
            name,
            email,
            phone,
            password
        });

        // Генерация токена
        const token = generateToken(user.id);

        // Установка cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
        });

        res.status(201).json({
            success: true,
            token,
            user
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Проверка на уникальность email (дубликат)
        if (error.code === '23505') { // PostgreSQL unique violation
            return res.status(400).json({
                success: false,
                message: 'Пользователь с таким email уже существует'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Ошибка при регистрации'
        });
    }
});

// @route   POST /api/auth/login
// @desc    Вход пользователя
router.post('/login', loginRateLimiter, sanitizeInput, async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        const ip = req.ip;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Введите email и пароль'
            });
        }

        // Поиск пользователя
        const user = await User.findByEmail(email, true);
        
        if (!user) {
            await User.logLoginAttempt(ip, email, false);
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }

        // Проверка пароля
        const isPasswordValid = await User.comparePassword(user.id, password);
        
        if (!isPasswordValid) {
            await User.logLoginAttempt(ip, email, false);
            return res.status(401).json({
                success: false,
                message: 'Неверный email или пароль'
            });
        }

        // Успешный вход
        await User.logLoginAttempt(ip, email, true);
        await User.updateLastLogin(user.id);

        // Генерация токена
        const token = generateToken(user.id);

        // Установка cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
        });

        // Удаляем password_hash из ответа
        delete user.password_hash;

        res.json({
            success: true,
            token,
            user
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при входе'
        });
    }
});

// @route   GET /api/auth/me
// @desc    Получение данных текущего пользователя
router.get('/me', protect, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении данных'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Выход пользователя
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Выход выполнен успешно'
    });
});

// @route   POST /api/auth/update-game-stats
// @desc    Обновление игровой статистики
router.post('/update-game-stats', protect, async (req, res) => {
    try {
        const { score } = req.body;
        
        if (typeof score !== 'number' || score < 0) {
            return res.status(400).json({
                success: false,
                message: 'Некорректное значение очков'
            });
        }

        const result = await User.updateGameStats(req.user.id, score);

        res.json({
            success: true,
            gameStats: result.gameStats,
            newCoupons: result.newCoupons
        });

    } catch (error) {
        console.error('Update game stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при обновлении статистики'
        });
    }
});

// @route   GET /api/auth/stats
// @desc    Получение игровой статистики
router.get('/stats', protect, async (req, res) => {
    try {
        const stats = await User.getUserStats(req.user.id);
        
        res.json({
            success: true,
            gameStats: stats
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении статистики'
        });
    }
});

// @route   GET /api/auth/coupons
// @desc    Получение купонов пользователя
router.get('/coupons', protect, async (req, res) => {
    try {
        const stats = await User.getUserStats(req.user.id);
        const coupons = stats?.coupons || [];
        
        res.json({
            success: true,
            coupons
        });
    } catch (error) {
        console.error('Get coupons error:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении купонов'
        });
    }
});

module.exports = router;