// models/User.js - Полностью переписанный с поддержкой платины
const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

class User {
    // Пороги для получения купонов
    static get THRESHOLDS() {
        return {
            BRONZE: 1000,
            SILVER: 2000,
            GOLD: 4000,
            PLATINUM: 8000
        };
    }

    // Создание нового пользователя
    static async create(userData) {
        const { name, email, phone, password } = userData;
        
        // Хеширование пароля
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
        const passwordHash = await bcrypt.hash(password, salt);

        const query = `
            INSERT INTO users (name, email, phone, password_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email, phone, role, game_stats, created_at
        `;

        const values = [name, email, phone, passwordHash];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Поиск пользователя по email
    static async findByEmail(email, includePassword = false) {
        const query = includePassword
            ? 'SELECT * FROM users WHERE email = $1'
            : 'SELECT id, name, email, phone, role, game_stats, is_verified, last_login, created_at, updated_at FROM users WHERE email = $1';

        try {
            const result = await pool.query(query, [email]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Поиск пользователя по ID
    static async findById(id) {
        const query = `
            SELECT id, name, email, phone, role, game_stats, is_verified, 
                   last_login, created_at, updated_at 
            FROM users 
            WHERE id = $1
        `;

        try {
            const result = await pool.query(query, [id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Обновление времени последнего входа
    static async updateLastLogin(id) {
        const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
        try {
            await pool.query(query, [id]);
        } catch (error) {
            throw error;
        }
    }

    // Проверка пароля
    static async comparePassword(userId, candidatePassword) {
        const query = 'SELECT password_hash FROM users WHERE id = $1';
        try {
            const result = await pool.query(query, [userId]);
            if (result.rows.length === 0) return false;
            
            return await bcrypt.compare(candidatePassword, result.rows[0].password_hash);
        } catch (error) {
            throw error;
        }
    }

    // Генерация купона
    static generateCoupon(type) {
        const couponTypes = {
            bronze: { 
                name: 'Бронзовый купон',
                description: 'Скидка 10% на любой напиток',
                prefix: 'BRZ'
            },
            silver: { 
                name: 'Серебряный купон',
                description: 'Кофе в подарок при покупке двух',
                prefix: 'SLV'
            },
            gold: { 
                name: 'Золотой купон',
                description: 'Любой напиток бесплатно',
                prefix: 'GLD'
            },
            platinum: { 
                name: 'Платиновый купон',
                description: 'Набор из 3 любых напитков бесплатно',
                prefix: 'PLT'
            }
        };

        const config = couponTypes[type];
        if (!config) {
            throw new Error(`Unknown coupon type: ${type}`);
        }

        return {
            type: type,
            name: config.name,
            description: config.description,
            code: `${config.prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`.toUpperCase(),
            earnedAt: new Date().toISOString(),
            used: false
        };
    }

    // Проверка наличия неиспользованного купона определённого типа
    static hasUnusedCoupon(coupons, type) {
        return coupons.some(c => c.type === type && !c.used);
    }

    // Обновление игровой статистики
    static async updateGameStats(userId, score) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Получаем текущую статистику с блокировкой
            const currentStats = await client.query(
                'SELECT game_stats FROM users WHERE id = $1 FOR UPDATE',
                [userId]
            );

            if (currentStats.rows.length === 0) {
                throw new Error('User not found');
            }

            let gameStats = currentStats.rows[0].game_stats;
            
            // Инициализация структуры, если её нет
            if (!gameStats) {
                gameStats = {
                    highestScore: 0,
                    gamesPlayed: 0,
                    coupons: []
                };
            }
            
            if (!gameStats.coupons) {
                gameStats.coupons = [];
            }

            const newCoupons = [];

            // Обновление количества игр
            gameStats.gamesPlayed = (gameStats.gamesPlayed || 0) + 1;
            
            // Обновление рекорда
            if (score > (gameStats.highestScore || 0)) {
                gameStats.highestScore = score;
            }

            // Проверка и выдача купонов по новым порогам
            // Порядок важен: от большего к меньшему, чтобы выдавался самый ценный купон
            
            // Платина - 8000м
            if (score >= this.THRESHOLDS.PLATINUM && !this.hasUnusedCoupon(gameStats.coupons, 'platinum')) {
                const coupon = this.generateCoupon('platinum');
                gameStats.coupons.push(coupon);
                newCoupons.push(coupon);
            }
            // Золото - 4000м
            else if (score >= this.THRESHOLDS.GOLD && !this.hasUnusedCoupon(gameStats.coupons, 'gold')) {
                const coupon = this.generateCoupon('gold');
                gameStats.coupons.push(coupon);
                newCoupons.push(coupon);
            }
            // Серебро - 2000м
            else if (score >= this.THRESHOLDS.SILVER && !this.hasUnusedCoupon(gameStats.coupons, 'silver')) {
                const coupon = this.generateCoupon('silver');
                gameStats.coupons.push(coupon);
                newCoupons.push(coupon);
            }
            // Бронза - 1000м
            else if (score >= this.THRESHOLDS.BRONZE && !this.hasUnusedCoupon(gameStats.coupons, 'bronze')) {
                const coupon = this.generateCoupon('bronze');
                gameStats.coupons.push(coupon);
                newCoupons.push(coupon);
            }

            // Обновление в базе данных
            const updateQuery = `
                UPDATE users 
                SET game_stats = $1::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING game_stats
            `;

            const result = await client.query(updateQuery, [JSON.stringify(gameStats), userId]);

            await client.query('COMMIT');

            return {
                gameStats: result.rows[0].game_stats,
                newCoupons: newCoupons
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Получение статистики пользователя
    static async getUserStats(userId) {
        const query = 'SELECT game_stats FROM users WHERE id = $1';
        try {
            const result = await pool.query(query, [userId]);
            return result.rows[0]?.game_stats || null;
        } catch (error) {
            throw error;
        }
    }

    // Получение только купонов пользователя
    static async getUserCoupons(userId) {
        const query = 'SELECT game_stats->\'coupons\' as coupons FROM users WHERE id = $1';
        try {
            const result = await pool.query(query, [userId]);
            const coupons = result.rows[0]?.coupons;
            return Array.isArray(coupons) ? coupons : [];
        } catch (error) {
            throw error;
        }
    }

    // Использование купона
    static async useCoupon(userId, couponCode) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const currentStats = await client.query(
                'SELECT game_stats FROM users WHERE id = $1 FOR UPDATE',
                [userId]
            );

            if (currentStats.rows.length === 0) {
                throw new Error('User not found');
            }

            let gameStats = currentStats.rows[0].game_stats;
            
            if (!gameStats.coupons) {
                throw new Error('No coupons found');
            }

            const couponIndex = gameStats.coupons.findIndex(c => c.code === couponCode && !c.used);
            
            if (couponIndex === -1) {
                throw new Error('Coupon not found or already used');
            }

            gameStats.coupons[couponIndex].used = true;
            gameStats.coupons[couponIndex].usedAt = new Date().toISOString();

            const updateQuery = `
                UPDATE users 
                SET game_stats = $1::jsonb
                WHERE id = $2
                RETURNING game_stats
            `;

            const result = await client.query(updateQuery, [JSON.stringify(gameStats), userId]);

            await client.query('COMMIT');

            return {
                success: true,
                coupon: gameStats.coupons[couponIndex],
                gameStats: result.rows[0].game_stats
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Логирование попытки входа
    static async logLoginAttempt(ip, email, success) {
        const query = `
            INSERT INTO login_attempts (ip_address, email, success)
            VALUES ($1, $2, $3)
        `;
        try {
            await pool.query(query, [ip, email, success]);
        } catch (error) {
            console.error('Error logging login attempt:', error);
        }
    }

    // Проверка количества неудачных попыток входа
    static async checkLoginAttempts(ip) {
        const query = `
            SELECT COUNT(*) as attempts
            FROM login_attempts
            WHERE ip_address = $1
                AND success = false
                AND attempt_time > NOW() - INTERVAL '15 minutes'
        `;
        
        try {
            const result = await pool.query(query, [ip]);
            return parseInt(result.rows[0].attempts);
        } catch (error) {
            console.error('Error checking login attempts:', error);
            return 0;
        }
    }

    // Сохранение refresh токена
    static async saveRefreshToken(userId, token) {
        const query = 'UPDATE users SET refresh_token = $1 WHERE id = $2';
        try {
            await pool.query(query, [token, userId]);
        } catch (error) {
            throw error;
        }
    }

    // Удаление refresh токена (при выходе)
    static async removeRefreshToken(userId) {
        const query = 'UPDATE users SET refresh_token = NULL WHERE id = $1';
        try {
            await pool.query(query, [userId]);
        } catch (error) {
            throw error;
        }
    }

    // Получение топ-игроков
    static async getLeaderboard(limit = 10) {
        const query = `
            SELECT id, name, game_stats->>'highestScore' as highest_score
            FROM users
            WHERE game_stats IS NOT NULL
            ORDER BY (game_stats->>'highestScore')::int DESC
            LIMIT $1
        `;
        
        try {
            const result = await pool.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return [];
        }
    }
}

module.exports = User;