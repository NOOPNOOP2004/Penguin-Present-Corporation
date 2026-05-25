// game.js - Финальная версия с новыми порогами (1000, 2000, 4000, 8000)
class PenguinGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Размеры платформ
        this.platformWidth = 70;
        this.platformHeight = 15;
        this.platformStart = this.canvas.height - 60;
        
        // БАЗОВЫЕ значения физики (НЕИЗМЕННЫЕ)
        this.BASE_GRAVITY = 0.22;
        this.BASE_DRAG = 0.12;
        this.BASE_BOUNCE_VELOCITY = -9.0;
        this.BASE_MOVE_SPEED = 3.2;
        
        // ТЕКУЩИЕ значения физики
        this.gravity = this.BASE_GRAVITY;
        this.drag = this.BASE_DRAG;
        this.bounceVelocity = this.BASE_BOUNCE_VELOCITY;
        this.moveSpeed = this.BASE_MOVE_SPEED;
        
        // Расстояние между платформами
        this.platformSpace = 55;
        
        // Пороги для купонов
        this.THRESHOLDS = {
            BRONZE: 1000,
            SILVER: 2000,
            GOLD: 4000,
            PLATINUM: 8000
        };
        
        // Персонаж
        this.doodle = {
            width: 35,
            height: 35,
            x: this.canvas.width / 2 - 17.5,
            y: this.platformStart - 35,
            dx: 0,
            dy: 0
        };
        
        // Платформы
        this.platforms = [];
        this.prevDoodleY = this.doodle.y;
        
        // Состояние игры
        this.gameStarted = false;
        this.gameOver = false;
        this.score = 0;
        this.height = 0;
        
        // Для отслеживания посещённых платформ
        this.visitedPlatforms = new Set();
        
        // Для отслеживания hits по ломающимся платформам
        this.brokenPlatformHits = new Map();
        
        // Управление
        this.leftPressed = false;
        this.rightPressed = false;
        this.jumpCooldown = false;
        
        // Достижения
        this.bronzeAchieved = false;
        this.silverAchieved = false;
        this.goldAchieved = false;
        this.platinumAchieved = false;
        
        // ID анимации
        this.animationInterval = null;
        this.gameLoopId = null;
        
        // Загрузка рекорда
        this.record = 0;
        
        // Инициализация
        this.init();
    }
    
    async init() {
        await this.loadRecord();
        await this.loadUserCoupons();
        this.setupEventListeners();
        this.showStartOverlay();
        this.startMovingPlatformsAnimation();
        this.draw();
        this.gameLoop();
    }
    
    startMovingPlatformsAnimation() {
        if (this.animationInterval) clearInterval(this.animationInterval);
        
        this.animationInterval = setInterval(() => {
            if (!this.gameStarted || this.gameOver) return;
            
            this.platforms.forEach(platform => {
                if (platform.type === 'moving') {
                    if (platform.offset === undefined) platform.offset = 0;
                    if (platform.direction === undefined) platform.direction = 1;
                    
                    platform.offset += platform.direction * 2.2;
                    
                    const minX = 10;
                    const maxX = this.canvas.width - this.platformWidth - 10;
                    
                    if (platform.originalX === undefined) {
                        platform.originalX = platform.x;
                    }
                    
                    let newX = platform.originalX + platform.offset;
                    
                    if (newX <= minX) {
                        newX = minX;
                        platform.direction = 1;
                        platform.originalX = minX;
                        platform.offset = 0;
                    } else if (newX >= maxX) {
                        newX = maxX;
                        platform.direction = -1;
                        platform.originalX = maxX;
                        platform.offset = 0;
                    }
                    
                    platform.currentX = newX;
                    platform.x = newX;
                }
            });
        }, 16);
    }
    
    showStartOverlay() {
        const overlay = document.getElementById('gameOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.getElementById('overlayTitle').textContent = '🐧 Пингвин-скалолаз';
            document.getElementById('overlayMessage').innerHTML = 'Нажимай ПРОБЕЛ или КЛИКАЙ, чтобы прыгать!<br>Стрелки ← → для движения<br>🏆 Достижения: 1000м, 2000м, 4000м, 8000м!';
            document.getElementById('overlayBtn').innerHTML = '<i class="fas fa-play"></i> Начать восхождение';
        }
    }
    
    async loadRecord() {
        if (typeof authService !== 'undefined' && authService.isAuthenticated()) {
            const user = authService.getUser();
            if (user && user.gameStats && user.gameStats.highestScore) {
                this.record = user.gameStats.highestScore;
                this.updateDisplay();
            }
        } else {
            const saved = localStorage.getItem('penguinRecord');
            this.record = saved ? parseInt(saved) : 0;
            this.updateDisplay();
        }
    }
    
    async loadUserCoupons() {
        if (typeof authService !== 'undefined' && authService.isAuthenticated()) {
            try {
                const coupons = await authService.getCoupons();
                this.displayCoupons(coupons);
            } catch (error) {
                console.error('Error loading coupons:', error);
            }
        }
    }
    
    displayCoupons(coupons) {
        const bronzeCoupon = document.getElementById('couponBronze');
        const silverCoupon = document.getElementById('couponSilver');
        const goldCoupon = document.getElementById('couponGold');
        const platinumCoupon = document.getElementById('couponPlatinum');
        
        if (!coupons || coupons.length === 0) {
            if (bronzeCoupon) bronzeCoupon.style.display = 'none';
            if (silverCoupon) silverCoupon.style.display = 'none';
            if (goldCoupon) goldCoupon.style.display = 'none';
            if (platinumCoupon) platinumCoupon.style.display = 'none';
            return;
        }
        
        coupons.forEach(coupon => {
            if (!coupon.used) {
                switch(coupon.type) {
                    case 'bronze':
                        if (bronzeCoupon) {
                            bronzeCoupon.style.display = 'flex';
                            const codeEl = document.getElementById('bronzeCode');
                            if (codeEl) codeEl.textContent = coupon.code;
                        }
                        break;
                    case 'silver':
                        if (silverCoupon) {
                            silverCoupon.style.display = 'flex';
                            const codeEl = document.getElementById('silverCode');
                            if (codeEl) codeEl.textContent = coupon.code;
                        }
                        break;
                    case 'gold':
                        if (goldCoupon) {
                            goldCoupon.style.display = 'flex';
                            const codeEl = document.getElementById('goldCode');
                            if (codeEl) codeEl.textContent = coupon.code;
                        }
                        break;
                    case 'platinum':
                        if (platinumCoupon) {
                            platinumCoupon.style.display = 'flex';
                            const codeEl = document.getElementById('platinumCode');
                            if (codeEl) codeEl.textContent = coupon.code;
                        }
                        break;
                }
            }
        });
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (!this.gameStarted || this.gameOver) return;
                this.jump();
            }
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.leftPressed = true;
            }
            
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.rightPressed = true;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft') this.leftPressed = false;
            if (e.key === 'ArrowRight') this.rightPressed = false;
        });
        
        if (this.canvas) {
            this.canvas.addEventListener('click', () => {
                if (!this.gameStarted || this.gameOver) return;
                this.jump();
            });
        }
        
        const startBtn = document.getElementById('startBtn');
        const resetBtn = document.getElementById('resetBtn');
        const overlayBtn = document.getElementById('overlayBtn');
        
        if (startBtn) startBtn.addEventListener('click', () => this.startGame());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetGame());
        if (overlayBtn) overlayBtn.addEventListener('click', () => this.startGame());
    }
    
    jump() {
        if (this.jumpCooldown) return;
        
        let onPlatform = false;
        for (let platform of this.platforms) {
            const platformX = (platform.type === 'moving' && platform.currentX !== undefined) ? platform.currentX : platform.x;
            
            if (Math.abs(this.doodle.y + this.doodle.height - platform.y) <= 10 &&
                this.doodle.x + this.doodle.width > platformX &&
                this.doodle.x < platformX + this.platformWidth) {
                onPlatform = true;
                break;
            }
        }
        
        if (onPlatform) {
            this.doodle.dy = this.bounceVelocity;
            this.jumpCooldown = true;
            setTimeout(() => {
                this.jumpCooldown = false;
            }, 150);
        }
    }
    
    random(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    resetAllParameters() {
        this.gravity = this.BASE_GRAVITY;
        this.drag = this.BASE_DRAG;
        this.bounceVelocity = this.BASE_BOUNCE_VELOCITY;
        this.moveSpeed = this.BASE_MOVE_SPEED;
        
        this.doodle = {
            width: 35,
            height: 35,
            x: this.canvas.width / 2 - 17.5,
            y: this.platformStart - 35,
            dx: 0,
            dy: 0
        };
        
        this.score = 0;
        this.height = 0;
        this.leftPressed = false;
        this.rightPressed = false;
        this.visitedPlatforms.clear();
        this.brokenPlatformHits.clear();
        
        this.bronzeAchieved = false;
        this.silverAchieved = false;
        this.goldAchieved = false;
        this.platinumAchieved = false;
    }
    
    generateInitialPlatforms() {
        const platforms = [];
        this.visitedPlatforms.clear();
        this.brokenPlatformHits.clear();
        
        platforms.push({
            x: this.canvas.width / 2 - this.platformWidth / 2,
            y: this.platformStart,
            type: 'normal',
            id: 'start_platform'
        });
        this.visitedPlatforms.add('start_platform');
        
        for (let i = 1; i <= 20; i++) {
            const y = this.platformStart - (this.platformHeight + this.platformSpace) * i;
            
            let type = 'normal';
            const rand = Math.random();
            if (rand < 0.15) type = 'moving';
            else if (rand < 0.22) type = 'broken';
            else if (rand < 0.28) type = 'disappearing';
            
            let x = this.random(30, this.canvas.width - 30 - this.platformWidth);
            
            const platform = {
                x: x,
                y: y,
                type: type,
                id: `platform_${i}_${Date.now()}_${Math.random()}`
            };
            
            if (type === 'moving') {
                platform.originalX = x;
                platform.offset = 0;
                platform.direction = Math.random() > 0.5 ? 1 : -1;
                platform.currentX = x;
            }
            
            platforms.push(platform);
        }
        
        return platforms;
    }
    
    startGame() {
        this.resetAllParameters();
        
        this.gameStarted = true;
        this.gameOver = false;
        
        this.platforms = this.generateInitialPlatforms();
        this.prevDoodleY = this.doodle.y;
        this.visitedPlatforms.add('start_platform');
        
        const overlay = document.getElementById('gameOverlay');
        if (overlay) overlay.style.display = 'none';
        
        this.updateDisplay();
    }
    
    resetGame() {
        this.resetAllParameters();
        
        this.gameStarted = false;
        this.gameOver = false;
        
        this.platforms = this.generateInitialPlatforms();
        this.visitedPlatforms.add('start_platform');
        
        this.showStartOverlay();
        this.updateDisplay();
        this.draw();
    }
    
    update() {
        if (!this.gameStarted || this.gameOver) return;
        
        if (this.leftPressed) {
            this.doodle.dx = -this.moveSpeed;
        } else if (this.rightPressed) {
            this.doodle.dx = this.moveSpeed;
        } else {
            if (this.doodle.dx > 0) {
                this.doodle.dx -= this.drag;
                if (this.doodle.dx < 0) this.doodle.dx = 0;
            } else if (this.doodle.dx < 0) {
                this.doodle.dx += this.drag;
                if (this.doodle.dx > 0) this.doodle.dx = 0;
            }
        }
        
        this.doodle.dy += this.gravity;
        
        if (this.doodle.y < this.canvas.height / 2.5 && this.doodle.dy < 0) {
            this.platforms.forEach(platform => {
                platform.y += -this.doodle.dy;
            });
            
            const lastPlatform = this.platforms[this.platforms.length - 1];
            if (lastPlatform && lastPlatform.y > 0) {
                const newY = lastPlatform.y - (this.platformHeight + this.platformSpace);
                
                let type = 'normal';
                const rand = Math.random();
                if (rand < 0.15) type = 'moving';
                else if (rand < 0.22) type = 'broken';
                else if (rand < 0.28) type = 'disappearing';
                
                let newX = this.random(30, this.canvas.width - 30 - this.platformWidth);
                
                const newPlatform = {
                    x: newX,
                    y: newY,
                    type: type,
                    id: `new_${Date.now()}_${Math.random()}`
                };
                
                if (type === 'moving') {
                    newPlatform.originalX = newX;
                    newPlatform.offset = 0;
                    newPlatform.direction = Math.random() > 0.5 ? 1 : -1;
                    newPlatform.currentX = newX;
                }
                
                this.platforms.push(newPlatform);
            }
        } else {
            this.doodle.y += this.doodle.dy;
        }
        
        this.doodle.x += this.doodle.dx;
        
        if (this.doodle.x + this.doodle.width < 0) {
            this.doodle.x = this.canvas.width;
        } else if (this.doodle.x > this.canvas.width) {
            this.doodle.x = -this.doodle.width;
        }
        
        for (let i = 0; i < this.platforms.length; i++) {
            const platform = this.platforms[i];
            const platformX = (platform.type === 'moving' && platform.currentX !== undefined) ? platform.currentX : platform.x;
            
            const collision = (
                this.doodle.dy > 0 &&
                this.prevDoodleY + this.doodle.height <= platform.y + 8 &&
                this.doodle.x + this.doodle.width > platformX &&
                this.doodle.x < platformX + this.platformWidth &&
                this.doodle.y + this.doodle.height > platform.y
            );
            
            if (collision) {
                if (!this.visitedPlatforms.has(platform.id)) {
                    this.visitedPlatforms.add(platform.id);
                    
                    switch(platform.type) {
                        case 'broken': this.score += 5; break;
                        case 'disappearing': this.score += 10; break;
                        case 'moving': this.score += 15; break;
                        default: this.score += 8;
                    }
                }
                
                if (platform.type === 'broken') {
                    let hitCount = this.brokenPlatformHits.get(platform.id) || 0;
                    hitCount++;
                    this.brokenPlatformHits.set(platform.id, hitCount);
                    
                    if (hitCount >= 2) {
                        this.platforms.splice(i, 1);
                        this.doodle.dy = this.bounceVelocity * 0.8;
                        this.doodle.y = platform.y - this.doodle.height;
                    } else {
                        this.doodle.dy = this.bounceVelocity * 0.9;
                        this.doodle.y = platform.y - this.doodle.height;
                        platform.cracked = true;
                    }
                }
                else if (platform.type === 'disappearing') {
                    this.platforms.splice(i, 1);
                    this.doodle.dy = this.bounceVelocity;
                    this.doodle.y = platform.y - this.doodle.height;
                }
                else if (platform.type === 'moving') {
                    this.doodle.dy = this.bounceVelocity;
                    this.doodle.y = platform.y - this.doodle.height;
                }
                else {
                    this.doodle.dy = this.bounceVelocity;
                    this.doodle.y = platform.y - this.doodle.height;
                }
                
                const newHeight = Math.floor((this.platformStart - platform.y) / 1.8);
                if (newHeight > this.height) {
                    this.height = newHeight;
                }
                break;
            }
        }
        
        if (this.doodle.y + this.doodle.height > this.canvas.height) {
            this.gameOver = true;
            this.handleGameOver();
        }
        
        this.prevDoodleY = this.doodle.y;
        this.platforms = this.platforms.filter(p => p.y < this.canvas.height + 100);
        
        this.updateDisplay();
        this.checkAchievements();
    }
    
    async checkAchievements() {
        if (typeof authService === 'undefined' || !authService.isAuthenticated()) return;
        
        // НОВЫЕ ПОРОГИ: 1000, 2000, 4000, 8000
        if (this.height >= this.THRESHOLDS.PLATINUM && !this.platinumAchieved) {
            this.platinumAchieved = true;
            try {
                const result = await authService.updateGameStats(this.height);
                if (result.newCoupons && result.newCoupons.length > 0) {
                    this.showCouponNotification(result.newCoupons[0]);
                    this.loadUserCoupons();
                }
            } catch(e) { console.error(e); }
        } 
        else if (this.height >= this.THRESHOLDS.GOLD && !this.goldAchieved) {
            this.goldAchieved = true;
            try {
                const result = await authService.updateGameStats(this.height);
                if (result.newCoupons && result.newCoupons.length > 0) {
                    this.showCouponNotification(result.newCoupons[0]);
                    this.loadUserCoupons();
                }
            } catch(e) { console.error(e); }
        } 
        else if (this.height >= this.THRESHOLDS.SILVER && !this.silverAchieved) {
            this.silverAchieved = true;
            try {
                const result = await authService.updateGameStats(this.height);
                if (result.newCoupons && result.newCoupons.length > 0) {
                    this.showCouponNotification(result.newCoupons[0]);
                    this.loadUserCoupons();
                }
            } catch(e) { console.error(e); }
        } 
        else if (this.height >= this.THRESHOLDS.BRONZE && !this.bronzeAchieved) {
            this.bronzeAchieved = true;
            try {
                const result = await authService.updateGameStats(this.height);
                if (result.newCoupons && result.newCoupons.length > 0) {
                    this.showCouponNotification(result.newCoupons[0]);
                    this.loadUserCoupons();
                }
            } catch(e) { console.error(e); }
        }
    }
    
    showCouponNotification(coupon) {
        const names = { 
            bronze: '🥉 Бронзовый купон (скидка 10%)', 
            silver: '🥈 Серебряный купон (2+1)', 
            gold: '🥇 Золотой купон (бесплатно!)',
            platinum: '💎 ПЛАТИНОВЫЙ КУПОН (3 напитка бесплатно!) 💎'
        };
        
        if (typeof showNotification === 'function') {
            showNotification(`🎉 ${names[coupon.type]} Код: ${coupon.code}`, 'success');
        } else {
            alert(`🎉 ${names[coupon.type]}! Код: ${coupon.code}`);
        }
    }
    
    async handleGameOver() {
        const overlay = document.getElementById('gameOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.getElementById('overlayTitle').textContent = '💀 Игра окончена! 💀';
            document.getElementById('overlayMessage').innerHTML = `Высота: <strong>${Math.floor(this.height)}м</strong><br>Очки: ${this.score}`;
            document.getElementById('overlayBtn').innerHTML = '<i class="fas fa-play"></i> Играть снова';
        }
        
        if (this.height > this.record) {
            this.record = this.height;
            if (typeof authService !== 'undefined' && authService.isAuthenticated()) {
                try { await authService.updateGameStats(this.height); } catch(e) {}
            } else {
                localStorage.setItem('penguinRecord', this.record);
            }
        }
        this.updateDisplay();
        this.draw();
    }
    
    updateDisplay() {
        const h = document.getElementById('height');
        const s = document.getElementById('score');
        const r = document.getElementById('record');
        if (h) h.textContent = Math.floor(this.height);
        if (s) s.textContent = this.score;
        if (r) r.textContent = Math.floor(this.record);
    }
    
    draw() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        grad.addColorStop(0, '#87CEEB');
        grad.addColorStop(1, '#E0F6FF');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawClouds();
        
        this.platforms.forEach(p => {
            const drawX = (p.type === 'moving' && p.currentX !== undefined) ? p.currentX : p.x;
            
            switch(p.type) {
                case 'moving': this.ctx.fillStyle = '#4CAF50'; break;
                case 'broken': 
                    this.ctx.fillStyle = p.cracked ? '#8B6914' : '#9E9E9E';
                    break;
                case 'disappearing': this.ctx.fillStyle = '#E91E63'; break;
                default: this.ctx.fillStyle = '#8B4513';
            }
            this.ctx.fillRect(drawX, p.y, this.platformWidth, this.platformHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(drawX, p.y - 3, this.platformWidth, 4);
            
            if (p.type === 'moving') {
                this.ctx.fillStyle = '#2E7D32';
                this.ctx.fillRect(drawX + 5, p.y + 5, 10, 4);
                this.ctx.fillRect(drawX + this.platformWidth - 15, p.y + 5, 10, 4);
            } else if (p.type === 'broken') {
                if (p.cracked) {
                    this.ctx.fillStyle = '#4a2a0a';
                    this.ctx.fillRect(drawX + 15, p.y + 5, 3, 8);
                    this.ctx.fillRect(drawX + 35, p.y + 7, 3, 6);
                    this.ctx.fillRect(drawX + 50, p.y + 4, 3, 9);
                } else {
                    this.ctx.fillStyle = '#616161';
                    this.ctx.fillRect(drawX + 10, p.y + 6, 5, 5);
                    this.ctx.fillRect(drawX + this.platformWidth - 15, p.y + 6, 5, 5);
                }
            } else if (p.type === 'disappearing') {
                this.ctx.fillStyle = '#AD1457';
                this.ctx.fillRect(drawX + 5, p.y + 5, this.platformWidth - 10, 3);
            }
        });
        
        this.drawPenguin(this.doodle.x, this.doodle.y);
        
        if (!this.gameStarted || this.gameOver) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    drawClouds() {
        this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
        this.ctx.beginPath();
        this.ctx.ellipse(100, 50, 40, 30, 0, 0, Math.PI*2);
        this.ctx.ellipse(130, 45, 35, 28, 0, 0, Math.PI*2);
        this.ctx.ellipse(70, 55, 30, 25, 0, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(650, 70, 45, 32, 0, 0, Math.PI*2);
        this.ctx.ellipse(690, 65, 38, 30, 0, 0, Math.PI*2);
        this.ctx.ellipse(620, 75, 32, 28, 0, 0, Math.PI*2);
        this.ctx.fill();
    }
    
    drawPenguin(x, y) {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 17.5, y + 17.5, 16, 20, 0, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 17.5, y + 20.5, 10, 13, 0, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(x + 10, y + 12, 4, 0, Math.PI*2);
        this.ctx.arc(x + 25, y + 12, 4, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(x + 10, y + 12, 2, 0, Math.PI*2);
        this.ctx.arc(x + 25, y + 12, 2, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(x + 9, y + 11, 1, 0, Math.PI*2);
        this.ctx.arc(x + 24, y + 11, 1, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.fillStyle = '#FFA500';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 15, y + 17);
        this.ctx.lineTo(x + 20, y + 17);
        this.ctx.lineTo(x + 17.5, y + 22);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.fillRect(x + 8, y + 32, 6, 4);
        this.ctx.fillRect(x + 21, y + 32, 6, 4);
    }
    
    gameLoop() {
        if (!this.gameStarted || this.gameOver) {
            this.draw();
            requestAnimationFrame(() => this.gameLoop());
            return;
        }
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new PenguinGame();
});