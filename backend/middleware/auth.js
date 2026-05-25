const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Защита маршрутов
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Не авторизован'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Недействительный токен'
        });
    }
};

// Ограничение по ролям
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Нет прав для доступа'
            });
        }
        next();
    };
};

// Rate limiting для защиты от брутфорса
exports.loginRateLimiter = async (req, res, next) => {
    const ip = req.ip;
    const maxAttempts = 5;

    try {
        const attempts = await User.checkLoginAttempts(ip);
        
        if (attempts >= maxAttempts) {
            return res.status(429).json({
                success: false,
                message: 'Слишком много попыток входа. Попробуйте через 15 минут.'
            });
        }
        
        next();
    } catch (error) {
        next();
    }
};

// Санитизация ввода
exports.sanitizeInput = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                // Удаление потенциально опасных символов
                req.body[key] = req.body[key]
                    .replace(/[<>]/g, '')
                    .trim();
            }
        });
    }
    next();
};

// Валидация email
exports.validateEmail = (email) => {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
};

// Валидация телефона
exports.validatePhone = (phone) => {
    if (!phone) return true;
    const phoneRegex = /^\+?[0-9\s-()]{10,20}$/;
    return phoneRegex.test(phone);
};