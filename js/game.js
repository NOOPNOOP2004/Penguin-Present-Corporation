// Игра "Пингвин-скалолаз" - Расширенная версия

class PenguinGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Размеры канваса
        this.canvas.width = 800;
        this.canvas.height = 500;
        
        // Состояние игры
        this.gameRunning = false;
        this.gameOver = false;
        this.gameWin = false;
        this.score = 0;
        this.height = 0;
        this.record = localStorage.getItem('penguinRecord') || 0;
        this.maxHeight = 1000; // Цель - 1000 метров (очень длинная игра)
        
        // Параметры пингвина
        this.penguin = {
            x: 100,
            y: this.canvas.height - 100,
            width: 35,
            height: 40,
            vx: 0,
            vy: 0,
            gravity: 0.4,
            jumpPower: -10,
            moveSpeed: 5,
            onGround: true,
            facingRight: true,
            animationFrame: 0
        };
        
        // Управление
        this.keys = {
            left: false,
            right: false,
            space: false
        };
        
        // Мир игры
        this.ledges = [];
        this.obstacles = [];
        this.collectibles = [];
        this.particles = [];
        
        this.ledgeWidth = 80;
        this.ledgeHeight = 10;
        this.minLedgeY = 50;
        this.maxLedgeY = this.canvas.height - 100;
        
        // Камера
        this.cameraY = 0;
        this.cameraX = 0;
        this.worldWidth = 2000; // Широкий мир для исследования
        
        // Элементы DOM
        this.initDOM();
        
        // Инициализация
        this.init();
    }
    
    initDOM() {
        this.heightSpan = document.getElementById('height');
        this.scoreSpan = document.getElementById('score');
        this.recordSpan = document.getElementById('record');
        this.overlay = document.getElementById('gameOverlay');
        this.overlayTitle = document.getElementById('overlayTitle');
        this.overlayMessage = document.getElementById('overlayMessage');
        this.overlayBtn = document.getElementById('overlayBtn');
        this.startBtn = document.getElementById('startBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        // Купоны
        this.coupons = {
            bronze: false,
            silver: false,
            gold: false
        };
    }
    
    init() {
        // Создаем большой мир
        this.generateWorld();
        
        // Обновляем рекорд
        this.recordSpan.textContent = this.record;
        
        // Обработчики событий
        this.overlayBtn.addEventListener('click', () => this.startGame());
        this.startBtn.addEventListener('click', () => this.startGame());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        
        // Управление с клавиатуры
        document.addEventListener('keydown', (e) => {
            if (!this.gameRunning || this.gameOver || this.gameWin) return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.keys.space = true;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    e.preventDefault();
                    this.keys.left = true;
                    this.penguin.facingRight = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    e.preventDefault();
                    this.keys.right = true;
                    this.penguin.facingRight = true;
                    break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'Space':
                    this.keys.space = false;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = false;
                    break;
            }
        });
        
        // Управление кликом (прыжок)
        this.canvas.addEventListener('click', () => {
            if (this.gameRunning && !this.gameOver && !this.gameWin) {
                this.keys.space = true;
                setTimeout(() => this.keys.space = false, 100);
            }
        });
        
        // Стартуем анимацию
        this.animate();
    }
    
    generateWorld() {
        this.ledges = [];
        this.obstacles = [];
        this.collectibles = [];
        
        let y = this.canvas.height - 50;
        let x = 50;
        
        // Генерируем 200 уступов на разных высотах (для длинной игры)
        for (let i = 0; i < 200; i++) {
            // Основной уступ
            const ledge = {
                x: x,
                y: y,
                width: 80 + Math.random() * 120,
                height: 12,
                color: this.getLedgeColor(y),
                slippery: Math.random() < 0.1 ? 0.7 : 0, // Скользкие уступы (10%)
                breakable: Math.random() < 0.05 // Ломающиеся уступы (5%)
            };
            this.ledges.push(ledge);
            
            // Добавляем препятствия на некоторых уступах
            if (Math.random() < 0.3) { // 30% уступов имеют препятствия
                this.obstacles.push({
                    x: ledge.x + ledge.width / 2 - 15,
                    y: ledge.y - 30,
                    width: 30,
                    height: 30,
                    type: Math.random() < 0.5 ? 'rock' : 'ice',
                    active: true
                });
            }
            
            // Добавляем collectibles (рыбки для очков)
            if (Math.random() < 0.2) { // 20% шанс появления рыбки
                this.collectibles.push({
                    x: ledge.x + ledge.width / 2 - 10,
                    y: ledge.y - 25,
                    width: 20,
                    height: 15,
                    collected: false,
                    value: 50
                });
            }
            
            // Сдвигаем позицию для следующего уступа
            x += 100 + Math.random() * 150;
            y -= 25 + Math.random() * 30;
            
            // Если уходим слишком далеко вправо, возвращаемся левее
            if (x > this.worldWidth - 200) {
                x = 50;
                y -= 40; // Поднимаемся выше
            }
            
            // Не даем уйти слишком низко
            if (y > this.canvas.height - 100) {
                y = this.canvas.height - 150;
            }
            
            // Не даем уйти слишком высоко
            if (y < 30) {
                y = 50;
                x += 200;
            }
        }
        
        // Добавляем финальный уступ (вершина)
        this.ledges.push({
            x: this.worldWidth / 2 - 100,
            y: 30,
            width: 200,
            height: 20,
            color: '#FFD700',
            isSummit: true
        });
    }
    
    getLedgeColor(y) {
        const heightPercent = 1 - (y / this.canvas.height);
        if (heightPercent < 0.2) return '#8B4513'; // Коричневый (подножие)
        if (heightPercent < 0.4) return '#A0522D'; // Светло-коричневый
        if (heightPercent < 0.6) return '#D2B48C'; // Очень светло-коричневый
        if (heightPercent < 0.8) return '#87CEEB'; // Ледяной голубой
        return '#F0F8FF'; // Белый (вершина)
    }
    
    startGame() {
        this.gameRunning = true;
        this.gameOver = false;
        this.gameWin = false;
        this.overlay.style.display = 'none';
        this.resetGame();
    }
    
    resetGame() {
        this.penguin.x = 100;
        this.penguin.y = this.canvas.height - 100;
        this.penguin.vx = 0;
        this.penguin.vy = 0;
        this.penguin.onGround = true;
        this.height = 0;
        this.score = 0;
        this.cameraY = 0;
        this.cameraX = 0;
        this.particles = [];
        
        // Сбрасываем collectibles
        this.collectibles.forEach(c => c.collected = false);
        
        // Скрываем купоны
        document.getElementById('couponBronze').style.display = 'none';
        document.getElementById('couponSilver').style.display = 'none';
        document.getElementById('couponGold').style.display = 'none';
        
        this.coupons = {
            bronze: false,
            silver: false,
            gold: false
        };
        
        this.updateDisplay();
    }
    
    handleInput() {
        // Горизонтальное движение
        if (this.keys.left) {
            this.penguin.vx = -this.penguin.moveSpeed;
        } else if (this.keys.right) {
            this.penguin.vx = this.penguin.moveSpeed;
        } else {
            this.penguin.vx *= 0.8; // Трение
        }
        
        // Прыжок
        if (this.keys.space && this.penguin.onGround) {
            this.penguin.vy = this.penguin.jumpPower;
            this.penguin.onGround = false;
            this.keys.space = false; // Однократный прыжок
            
            // Эффект прыжка
            this.createDustParticles();
        }
    }
    
    createDustParticles() {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: this.penguin.x + this.penguin.width / 2,
                y: this.penguin.y + this.penguin.height,
                vx: (Math.random() - 0.5) * 2,
                vy: Math.random() * 2,
                life: 1,
                maxLife: 1
            });
        }
    }
    
    update() {
        if (!this.gameRunning || this.gameOver || this.gameWin) return;
        
        // Управление
        this.handleInput();
        
        // Физика
        this.penguin.vx = Math.max(-8, Math.min(8, this.penguin.vx));
        this.penguin.x += this.penguin.vx;
        
        // Гравитация
        this.penguin.vy += this.penguin.gravity;
        this.penguin.y += this.penguin.vy;
        
        // Границы мира
        this.penguin.x = Math.max(10, Math.min(this.worldWidth - this.penguin.width - 10, this.penguin.x));
        
        // Проверка столкновений
        this.checkCollisions();
        
        // Проверка падения
        if (this.penguin.y > this.canvas.height + 200) {
            this.gameOver = true;
            this.gameRunning = false;
            this.showGameOver('Ты сорвался в пропасть! 😢');
        }
        
        // Проверка победы
        if (this.height >= this.maxHeight || this.checkSummit()) {
            this.gameWin = true;
            this.gameRunning = false;
            this.showVictory();
        }
        
        // Обновление камеры
        this.updateCamera();
        
        // Обновление высоты
        this.height = Math.floor((this.canvas.height - this.penguin.y) / 2 + this.cameraY);
        if (this.height < 0) this.height = 0;
        
        // Обновление рекорда
        if (this.height > this.record) {
            this.record = this.height;
            localStorage.setItem('penguinRecord', this.record);
        }
        
        // Обновление collectibles
        this.updateCollectibles();
        
        // Обновление частиц
        this.updateParticles();
        
        // Проверка купонов
        this.checkCoupons();
        
        // Анимация
        this.penguin.animationFrame = (this.penguin.animationFrame + 1) % 60;
        
        this.updateDisplay();
    }
    
    checkCollisions() {
        this.penguin.onGround = false;
        
        // Сортируем уступы по близости к игроку для оптимизации
        const nearbyLedges = this.ledges.filter(ledge => 
            Math.abs(ledge.y - this.penguin.y) < 100 &&
            Math.abs(ledge.x - this.penguin.x) < 300
        );
        
        for (let ledge of nearbyLedges) {
            // Проверка столкновения с уступом
            if (this.penguin.vy > 0 && // Падает вниз
                this.penguin.y + this.penguin.height > ledge.y &&
                this.penguin.y + this.penguin.height < ledge.y + 20 &&
                this.penguin.x + this.penguin.width > ledge.x &&
                this.penguin.x < ledge.x + ledge.width) {
                
                this.penguin.y = ledge.y - this.penguin.height;
                this.penguin.vy = 0;
                this.penguin.onGround = true;
                
                // Скользкий уступ
                if (ledge.slippery > 0) {
                    this.penguin.vx *= ledge.slippery;
                }
                
                // Ломающийся уступ
                if (ledge.breakable && Math.random() < 0.1) {
                    ledge.width -= 5;
                    if (ledge.width <= 20) {
                        this.ledges = this.ledges.filter(l => l !== ledge);
                        this.createBreakParticles(ledge.x, ledge.y);
                    }
                }
                
                break;
            }
        }
        
        // Проверка столкновения с препятствиями
        for (let obstacle of this.obstacles) {
            if (!obstacle.active) continue;
            
            if (this.penguin.x < obstacle.x + obstacle.width &&
                this.penguin.x + this.penguin.width > obstacle.x &&
                this.penguin.y < obstacle.y + obstacle.height &&
                this.penguin.y + this.penguin.height > obstacle.y) {
                
                // Столкновение с препятствием
                if (obstacle.type === 'rock') {
                    // Отбрасываем пингвина
                    if (this.penguin.x + this.penguin.width / 2 < obstacle.x + obstacle.width / 2) {
                        this.penguin.x = obstacle.x - this.penguin.width - 5;
                        this.penguin.vx = -5;
                    } else {
                        this.penguin.x = obstacle.x + obstacle.width + 5;
                        this.penguin.vx = 5;
                    }
                    
                    // Штраф за удар
                    this.score = Math.max(0, this.score - 20);
                    this.createHitParticles(obstacle.x, obstacle.y);
                } else if (obstacle.type === 'ice') {
                    // Скользкий лед - проскальзываем
                    this.penguin.vx *= 1.5;
                }
            }
        }
    }
    
    createBreakParticles(x, y) {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x + Math.random() * 80,
                y: y,
                vx: (Math.random() - 0.5) * 5,
                vy: -Math.random() * 5,
                life: 1,
                maxLife: 1,
                color: '#8B4513'
            });
        }
    }
    
    createHitParticles(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x + 15,
                y: y + 15,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 0.8,
                maxLife: 0.8,
                color: '#FF0000'
            });
        }
    }
    
    updateCollectibles() {
        for (let item of this.collectibles) {
            if (item.collected) continue;
            
            if (this.penguin.x < item.x + item.width &&
                this.penguin.x + this.penguin.width > item.x &&
                this.penguin.y < item.y + item.height &&
                this.penguin.y + this.penguin.height > item.y) {
                
                item.collected = true;
                this.score += item.value;
                
                // Эффект сбора
                for (let i = 0; i < 5; i++) {
                    this.particles.push({
                        x: item.x + 10,
                        y: item.y + 7,
                        vx: (Math.random() - 0.5) * 3,
                        vy: -Math.random() * 3,
                        life: 0.6,
                        maxLife: 0.6,
                        color: '#FFD700'
                    });
                }
            }
        }
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    updateCamera() {
        // Камера следует за пингвином по вертикали
        const targetCameraY = Math.max(0, this.penguin.y - this.canvas.height / 2);
        this.cameraY += (targetCameraY - this.cameraY) * 0.1;
        
        // Камера следует по горизонтали
        const targetCameraX = Math.max(0, Math.min(this.worldWidth - this.canvas.width, 
            this.penguin.x - this.canvas.width / 2));
        this.cameraX += (targetCameraX - this.cameraX) * 0.1;
    }
    
    checkSummit() {
        for (let ledge of this.ledges) {
            if (ledge.isSummit && 
                this.penguin.y <= ledge.y + 10 &&
                this.penguin.x + this.penguin.width > ledge.x &&
                this.penguin.x < ledge.x + ledge.width) {
                return true;
            }
        }
        return false;
    }
    
    checkCoupons() {
        // Бронзовый купон (200м)
        if (this.height >= 200 && !this.coupons.bronze) {
            this.coupons.bronze = true;
            document.getElementById('couponBronze').style.display = 'flex';
            this.showNotification('🥉 Бронзовый купон получен! Скидка 15%');
        }
        
        // Серебряный купон (500м)
        if (this.height >= 500 && !this.coupons.silver) {
            this.coupons.silver = true;
            document.getElementById('couponSilver').style.display = 'flex';
            this.showNotification('🥈 Серебряный купон получен! Напиток в подарок');
        }
        
        // Золотой купон (800м)
        if (this.height >= 800 && !this.coupons.gold) {
            this.coupons.gold = true;
            document.getElementById('couponGold').style.display = 'flex';
            this.showNotification('🏆 Золотой купон получен! Неделя бесплатного кофе!');
        }
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.innerHTML = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #f39c12, #e74c3c);
            color: white;
            padding: 1rem 2rem;
            border-radius: 50px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideInRight 0.5s ease, pulse 2s infinite;
            font-weight: bold;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    showGameOver(message) {
        this.overlay.style.display = 'flex';
        this.overlayTitle.textContent = 'Игра окончена! 😢';
        this.overlayMessage.textContent = `${message} Высота: ${this.height}м, Очки: ${this.score}`;
        this.overlayBtn.innerHTML = '<i class="fas fa-redo"></i> Покорить снова';
    }
    
    showVictory() {
        this.overlay.style.display = 'flex';
        this.overlayTitle.textContent = '🎉 ПОБЕДА! 🎉';
        this.overlayMessage.textContent = `Ты покорил вершину! Высота: ${this.height}м, Очки: ${this.score}`;
        this.overlayBtn.innerHTML = '<i class="fas fa-trophy"></i> Играть снова';
        
        // Даем золотой купон за победу, если еще не получили
        if (!this.coupons.gold) {
            this.coupons.gold = true;
            document.getElementById('couponGold').style.display = 'flex';
            this.showNotification('🏆 Золотой купон за покорение вершины!');
        }
    }
    
    updateDisplay() {
        this.heightSpan.textContent = this.height;
        this.scoreSpan.textContent = this.score;
        this.recordSpan.textContent = this.record;
    }
    
    draw() {
        // Очистка с эффектом размытия для следа
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Применяем камеру
        this.ctx.save();
        this.ctx.translate(-this.cameraX, -this.cameraY);
        
        // Рисуем фон (градиент в зависимости от высоты)
        this.drawBackground();
        
        // Рисуем уступы
        this.ledges.forEach(ledge => this.drawLedge(ledge));
        
        // Рисуем препятствия
        this.obstacles.forEach(obs => this.drawObstacle(obs));
        
        // Рисуем collectibles
        this.collectibles.forEach(item => this.drawCollectible(item));
        
        // Рисуем частицы
        this.particles.forEach(p => this.drawParticle(p));
        
        // Рисуем пингвина
        this.drawPenguin();
        
        this.ctx.restore();
        
        // Рисуем интерфейс
        this.drawUI();
    }
    
    drawBackground() {
        // Небо меняется с высотой
        const skyGradient = this.ctx.createLinearGradient(0, this.cameraY, 0, this.cameraY + this.canvas.height);
        
        if (this.height < 200) {
            skyGradient.addColorStop(0, '#87CEEB');
            skyGradient.addColorStop(1, '#E0F6FF');
        } else if (this.height < 500) {
            skyGradient.addColorStop(0, '#4A90E2');
            skyGradient.addColorStop(1, '#87CEEB');
        } else {
            skyGradient.addColorStop(0, '#1A237E');
            skyGradient.addColorStop(0.5, '#283593');
            skyGradient.addColorStop(1, '#3949AB');
            
            // Рисуем звезды на большой высоте
            this.ctx.fillStyle = 'white';
            for (let i = 0; i < 20; i++) {
                this.ctx.beginPath();
                this.ctx.arc(
                    100 + i * 70 + Math.sin(Date.now() / 1000 + i) * 10,
                    50 + i * 30,
                    2, 0, Math.PI * 2
                );
                this.ctx.fill();
            }
        }
        
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.worldWidth, this.canvas.height + 500);
        
        // Рисуем облака
        this.drawClouds();
    }
    
    drawLedge(ledge) {
        // Тень
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fillRect(ledge.x + 3, ledge.y + 3, ledge.width, ledge.height);
        
        // Сам уступ
        this.ctx.fillStyle = ledge.color;
        this.ctx.fillRect(ledge.x, ledge.y, ledge.width, ledge.height);
        
        // Детали
        this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(ledge.x, ledge.y);
        this.ctx.lineTo(ledge.x + ledge.width, ledge.y);
        this.ctx.stroke();
        
        // Если уступ ломающийся
        if (ledge.breakable) {
            this.ctx.fillStyle = 'rgba(255,0,0,0.3)';
            this.ctx.fillRect(ledge.x, ledge.y, ledge.width, 3);
        }
        
        // Если скользкий
        if (ledge.slippery > 0) {
            this.ctx.fillStyle = 'rgba(0,255,255,0.3)';
            for (let i = 0; i < 3; i++) {
                this.ctx.fillRect(ledge.x + i * 20, ledge.y - 5, 5, 5);
            }
        }
        
        // Вершина
        if (ledge.isSummit) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillText('🏔️ ВЕРШИНА 🏔️', ledge.x + 20, ledge.y - 30);
        }
    }
    
    drawObstacle(obs) {
        if (!obs.active) return;
        
        if (obs.type === 'rock') {
            // Камень
            this.ctx.fillStyle = '#696969';
            this.ctx.beginPath();
            this.ctx.ellipse(obs.x + 15, obs.y + 15, 15, 10, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Тени
            this.ctx.fillStyle = '#4A4A4A';
            this.ctx.beginPath();
            this.ctx.ellipse(obs.x + 10, obs.y + 20, 5, 3, 0, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Ледяная глыба
            this.ctx.fillStyle = '#E0F2FE';
            this.ctx.shadowColor = '#ADD8E6';
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.moveTo(obs.x, obs.y + 30);
            this.ctx.lineTo(obs.x + 15, obs.y);
            this.ctx.lineTo(obs.x + 30, obs.y + 30);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
    }
    
    drawCollectible(item) {
        if (item.collected) return;
        
        // Рыбка
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.moveTo(item.x, item.y + 7);
        this.ctx.lineTo(item.x + 20, item.y);
        this.ctx.lineTo(item.x + 20, item.y + 15);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Глаз
        this.ctx.fillStyle = 'black';
        this.ctx.beginPath();
        this.ctx.arc(item.x + 5, item.y + 7, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Анимация
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 10 + Math.sin(Date.now() / 200) * 5;
    }
    
    drawParticle(p) {
        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle = p.color || '#FFFFFF';
        this.ctx.fillRect(p.x, p.y, 3, 3);
        this.ctx.globalAlpha = 1;
    }
    
    drawPenguin() {
        const p = this.penguin;
        
        // Тень
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(p.x + 17, p.y + 38, 15, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.save();
        
        // Разворот пингвина
        if (!p.facingRight) {
            this.ctx.translate(p.x + p.width, p.y);
            this.ctx.scale(-1, 1);
        } else {
            this.ctx.translate(p.x, p.y);
        }
        
        // Тело
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.beginPath();
        this.ctx.ellipse(17, 17, 15, 20, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Животик
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.ellipse(17, 20, 9, 14, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Глаза (с анимацией)
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(10, 12, 4, 0, Math.PI * 2);
        this.ctx.arc(24, 12, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Зрачки (смотрят в сторону движения)
        const eyeOffset = this.penguin.vx > 1 ? 2 : (this.penguin.vx < -1 ? -2 : 0);
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.beginPath();
        this.ctx.arc(10 + eyeOffset, 12, 2, 0, Math.PI * 2);
        this.ctx.arc(24 + eyeOffset, 12, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Клюв
        this.ctx.fillStyle = '#f39c12';
        this.ctx.beginPath();
        this.ctx.moveTo(17, 15);
        this.ctx.lineTo(22, 19);
        this.ctx.lineTo(17, 19);
        this.ctx.fill();
        
        // Крылья (анимация движения)
        const wingAngle = Math.sin(this.penguin.animationFrame * 0.3) * 0.2;
        this.ctx.fillStyle = '#1e2b38';
        this.ctx.beginPath();
        this.ctx.ellipse(5, 20, 5, 10, wingAngle, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawClouds() {
        const time = Date.now() / 1000;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        
        // Облака на разных высотах
        for (let i = 0; i < 5; i++) {
            const cloudY = this.cameraY + 100 + i * 150;
            
            this.ctx.beginPath();
            this.ctx.arc(100 + Math.sin(time + i) * 50, cloudY, 40, 0, Math.PI * 2);
            this.ctx.arc(150 + Math.sin(time + i) * 50, cloudY - 10, 30, 0, Math.PI * 2);
            this.ctx.arc(60 + Math.sin(time + i) * 50, cloudY - 10, 30, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.arc(500 + Math.cos(time + i) * 40, cloudY + 50, 35, 0, Math.PI * 2);
            this.ctx.arc(550 + Math.cos(time + i) * 40, cloudY + 40, 25, 0, Math.PI * 2);
            this.ctx.arc(460 + Math.cos(time + i) * 40, cloudY + 40, 25, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawUI() {
        // Прогресс бар
        const progress = (this.height / this.maxHeight) * 100;
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(10, 10, 200, 20);
        
        const gradient = this.ctx.createLinearGradient(0, 0, 200, 0);
        gradient.addColorStop(0, '#cd7f32');
        gradient.addColorStop(0.5, '#C0C0C0');
        gradient.addColorStop(1, '#FFD700');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(10, 10, progress * 2, 20);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText(`${Math.min(100, progress)}%`, 90, 27);
        
        // Подсказки управления
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(this.canvas.width - 200, 10, 190, 60);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('← → : движение', this.canvas.width - 190, 30);
        this.ctx.fillText('Пробел/клик : прыжок', this.canvas.width - 190, 50);
    }
    
    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// Запуск игры
document.addEventListener('DOMContentLoaded', () => {
    new PenguinGame();
});