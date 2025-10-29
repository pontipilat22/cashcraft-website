// Анимированный технологичный фон
function initTechBackground() {
    const canvas = document.getElementById('techBackground');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const particleCount = 100;
    const connectionDistance = 150;
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 2 + 1;
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    function connectParticles() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < connectionDistance) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
                    ctx.globalAlpha = (1 - distance / connectionDistance) * 0.2;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        connectParticles();
        requestAnimationFrame(animate);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// Прогресс-бар скролла
function initScrollProgress() {
    const progressBar = document.querySelector('.scroll-progress');
    
    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        
        if (progressBar) {
            progressBar.style.width = scrolled + '%';
        }
    });
}

// Переключение темы
const themeToggle = document.querySelector('.theme-toggle');
const root = document.documentElement;

// Проверяем сохраненную тему
const savedTheme = localStorage.getItem('theme') || 'light';
root.setAttribute('data-theme', savedTheme);

themeToggle?.addEventListener('click', () => {
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// Мобильное меню
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger?.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
});

// Плавная прокрутка к секциям
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = 80; // Высота навигации
            const targetPosition = target.offsetTop - offset;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
            
            // Закрываем мобильное меню при клике на ссылку
            navMenu?.classList.remove('active');
            hamburger?.classList.remove('active');
        }
    });
});

// Анимация при прокрутке
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
        }
    });
}, observerOptions);

// Наблюдаем за элементами
document.querySelectorAll('.feature-card').forEach(el => observer.observe(el));
document.querySelectorAll('.screenshot-card').forEach(el => observer.observe(el));

// Изменение навигации при прокрутке
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Анимация статистики
function animateStats() {
    const stats = document.querySelectorAll('.stat-number');
    
    stats.forEach(stat => {
        const target = stat.innerText;
        const isNumber = /^\d+/.test(target);
        
        if (isNumber && !stat.classList.contains('animated')) {
            stat.classList.add('animated');
            const number = parseInt(target.replace(/\D/g, ''));
            const suffix = target.replace(/^\d+/, '');
            const increment = number / 50;
            let current = 0;
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= number) {
                    stat.innerText = number + suffix;
                    clearInterval(timer);
                } else {
                    stat.innerText = Math.floor(current) + suffix;
                }
            }, 30);
        }
    });
}

// Запуск анимации статистики при появлении в viewport
const statsSection = document.querySelector('.app-stats');
if (statsSection) {
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateStats();
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    statsObserver.observe(statsSection);
}

// Параллакс эффект для hero секции
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// Добавляем стили для мобильного меню
const style = document.createElement('style');
style.textContent = `
    .nav-menu.active {
        display: flex;
        position: fixed;
        flex-direction: column;
        background: var(--bg-card);
        top: 70px;
        right: 20px;
        padding: 2rem;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        animation: slideIn 0.3s ease;
        border: 1px solid var(--border-color);
    }
    
    .hamburger.active span:nth-child(1) {
        transform: rotate(45deg) translate(5px, 5px);
    }
    
    .hamburger.active span:nth-child(2) {
        opacity: 0;
    }
    
    .hamburger.active span:nth-child(3) {
        transform: rotate(-45deg) translate(7px, -6px);
    }
    
    .navbar.scrolled {
        padding: 0.5rem 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    .animate {
        animation: fadeInUp 0.6s ease forwards;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .feature-card, .screenshot-card {
        opacity: 0;
    }
`;
document.head.appendChild(style);

// Обработка формы (если добавите форму контактов в будущем)
const form = document.querySelector('form');
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Здесь можно добавить логику отправки формы
        console.log('Форма отправлена');
        alert('Спасибо за ваше сообщение!');
        form.reset();
    });
}

// Добавление эффекта печатания для заголовка
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Активируем эффект печатания при загрузке страницы
window.addEventListener('load', () => {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle && false) { // Отключено по умолчанию, можно включить изменив на true
        const originalText = heroTitle.textContent;
        typeWriter(heroTitle, originalText, 50);
    }
});

// Загрузка данных из админ панели
function loadSiteData() {
    const savedData = localStorage.getItem('cashcraftSiteData');
    if (savedData) {
        try {
            const siteData = JSON.parse(savedData);
            
            // Обновляем основные элементы
            const appNameElements = document.querySelectorAll('.brand-name');
            appNameElements.forEach(el => el.textContent = siteData.general.appName);
            
            const heroTitle = document.querySelector('.hero-title');
            if (heroTitle) {
                heroTitle.innerHTML = siteData.general.appSlogan.replace(/\s+(\S+)$/, ' <span class="gradient-text">$1</span>');
            }
            
            const heroDescription = document.querySelector('.hero-description');
            if (heroDescription) {
                heroDescription.textContent = siteData.general.appDescription;
            }
            
            // Обновляем статистику
            const stats = document.querySelectorAll('.stat');
            if (stats.length >= 3) {
                stats[0].querySelector('.stat-number').textContent = siteData.general.stats.users;
                stats[0].querySelector('.stat-label').textContent = 'Пользователей';
                stats[1].querySelector('.stat-number').textContent = siteData.general.stats.rating;
                stats[1].querySelector('.stat-label').textContent = 'Рейтинг';
                stats[2].querySelector('.stat-number').textContent = siteData.general.stats.third;
                stats[2].querySelector('.stat-label').textContent = siteData.general.stats.thirdLabel;
            }
            
            // Обновляем особенности
            const featuresGrid = document.querySelector('.features-grid');
            if (featuresGrid && siteData.features) {
                featuresGrid.innerHTML = siteData.features.map(feature => `
                    <div class="feature-card">
                        <div class="feature-icon">${feature.icon}</div>
                        <h3>${feature.title}</h3>
                        <p>${feature.description}</p>
                    </div>
                `).join('');
            }
            
            // Обновляем скриншоты
            const screenshotsSlider = document.querySelector('.screenshots-slider');
            if (screenshotsSlider && siteData.screenshots) {
                screenshotsSlider.innerHTML = siteData.screenshots.map(screenshot => `
                    <div class="screenshot-card">
                        <img src="${screenshot.url}" alt="${screenshot.title}">
                        <p>${screenshot.title}</p>
                    </div>
                `).join('');
            }
            
            // Обновляем обновления
            const updatesList = document.getElementById('updatesList');
            if (updatesList && siteData.updates) {
                const sortedUpdates = siteData.updates.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
                updatesList.innerHTML = sortedUpdates.map(update => `
                    <div class="update-card">
                        <div class="update-header">
                            <span class="update-version">v${update.version}</span>
                            <span class="update-date">${new Date(update.date).toLocaleDateString('ru-RU')}</span>
                        </div>
                        <p class="update-description">${update.description}</p>
                    </div>
                `).join('');
            }
            
            // Обновляем планы
            const plansList = document.getElementById('plansList');
            if (plansList && siteData.plans) {
                const statusClasses = {
                    'В разработке': 'status-dev',
                    'Планируется': 'status-planned',
                    'Исследование': 'status-research'
                };
                
                plansList.innerHTML = siteData.plans.slice(0, 3).map(plan => `
                    <div class="plan-card">
                        <div class="plan-header">
                            <span class="plan-title">${plan.title}</span>
                            <span class="plan-status ${statusClasses[plan.status] || 'status-planned'}">${plan.status}</span>
                        </div>
                        <p class="plan-description">${plan.description}</p>
                    </div>
                `).join('');
            }
            
            // Обновляем контакты
            const emailElements = document.querySelectorAll('.footer-contact p:first-of-type');
            emailElements.forEach(el => {
                if (siteData.general.contact.email) {
                    el.innerHTML = `📧 ${siteData.general.contact.email}`;
                }
            });
            
            const phoneElements = document.querySelectorAll('.footer-contact p:nth-of-type(2)');
            phoneElements.forEach(el => {
                if (siteData.general.contact.phone) {
                    el.innerHTML = `📱 ${siteData.general.contact.phone}`;
                }
            });
            
            // Обновляем ссылки на магазины
            const storeButtons = document.querySelectorAll('.store-btn');
            if (storeButtons.length >= 2) {
                if (siteData.links.stores.googlePlay) {
                    storeButtons[0].href = siteData.links.stores.googlePlay;
                }
                if (siteData.links.stores.appStore) {
                    storeButtons[1].href = siteData.links.stores.appStore;
                }
            }
            
            // Обновляем социальные сети
            const socialLinks = document.querySelector('.social-links');
            if (socialLinks && siteData.links.social) {
                const socialIcons = {
                    facebook: '📘',
                    twitter: '🐦',
                    instagram: '📷',
                    linkedin: '💼'
                };
                
                socialLinks.innerHTML = Object.entries(siteData.links.social)
                    .filter(([key, value]) => value)
                    .map(([key, value]) => `
                        <a href="${value}" aria-label="${key}" target="_blank">${socialIcons[key] || '🔗'}</a>
                    `).join('');
            }
            
            // Обновляем SEO
            if (siteData.seo.title) {
                document.title = siteData.seo.title;
            }
            
            console.log('Данные сайта загружены из админ панели');
        } catch (e) {
            console.error('Ошибка загрузки данных:', e);
        }
    }
}

// Добавление индикатора загрузки
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    loadSiteData(); // Загружаем данные при загрузке страницы
    initTechBackground(); // Инициализируем технологичный фон
    initScrollProgress(); // Инициализируем прогресс-бар
    initAdvancedAnimations(); // Инициализируем дополнительные анимации
});

// Дополнительные анимации и эффекты
function initAdvancedAnimations() {
    // Анимация чисел
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };
    
    const numberObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                animateValue(entry.target);
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.stat-number').forEach(el => {
        numberObserver.observe(el);
    });
    
    // Добавляем задержку анимации для feature-карточек
    document.querySelectorAll('.feature-card').forEach((card, index) => {
        card.style.setProperty('--delay', `${index * 0.2}s`);
    });
    
    // Parallax эффект для орбов
    document.addEventListener('mousemove', (e) => {
        const orbs = document.querySelectorAll('.orb');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        orbs.forEach((orb, index) => {
            const speed = (index + 1) * 20;
            orb.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
    });
    
    // Typing эффект для заголовка (если нужен)
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle && false) { // Включить, изменив на true
        const text = heroTitle.textContent;
        heroTitle.textContent = '';
        typeWriter(heroTitle, text, 50);
    }
}

// Анимация чисел
function animateValue(obj) {
    const target = obj.textContent;
    const hasPlus = target.includes('+');
    const hasPercent = target.includes('%');
    const hasDot = target.includes('.');
    
    let end = parseFloat(target.replace(/[^0-9.]/g, ''));
    if (isNaN(end)) return;
    
    const duration = 2000;
    const start = 0;
    const increment = end / (duration / 16);
    let current = start;
    
    obj.classList.add('animated');
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            let display = hasDot ? current.toFixed(1) : Math.floor(current);
            if (hasPlus) display += '+';
            if (hasPercent) display += '%';
            obj.textContent = display;
            clearInterval(timer);
        } else {
            let display = hasDot ? current.toFixed(1) : Math.floor(current);
            if (hasPlus) display += '+';
            if (hasPercent) display += '%';
            obj.textContent = display;
        }
    }, 16);
}

// Typing эффект
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            if (text.substring(i, i+6) === '<span ') {
                const spanEnd = text.indexOf('</span>', i) + 7;
                element.innerHTML += text.substring(i, spanEnd);
                i = spanEnd;
            } else {
                element.innerHTML += text.charAt(i);
                i++;
            }
            setTimeout(type, speed);
        }
    }
    
    type();
}

console.log('Cashcraft сайт успешно загружен!');
