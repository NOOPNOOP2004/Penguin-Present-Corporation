const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const { initDB, testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();

// Тестирование подключения к БД и инициализация
(async () => {
    const connected = await testConnection();
    if (connected) {
        await initDB();
        console.log('Database is ready');
    } else {
        console.error('Failed to connect to database');
        process.exit(1);
    }
})();

// Middleware безопасности
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        },
    },
}));

// CORS настройки
app.use(cors({
    origin: 'http://localhost:5500',
    credentials: true,
    optionsSuccessStatus: 200
}));

// Парсеры
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Статические файлы
app.use(express.static(path.join(__dirname, '../frontend')));

// Маршруты API
app.use('/api/auth', authRoutes);

// Обработка 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Маршрут не найден'
    });
});

// Централизованная обработка ошибок
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    // Ошибки PostgreSQL
    if (err.code) {
        switch (err.code) {
            case '23505': // unique violation
                return res.status(400).json({
                    success: false,
                    message: 'Запись с такими данными уже существует'
                });
            case '23503': // foreign key violation
                return res.status(400).json({
                    success: false,
                    message: 'Связанная запись не найдена'
                });
            case '42P01': // undefined table
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка базы данных'
                });
        }
    }

    res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
    });
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});