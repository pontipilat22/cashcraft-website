// API Configuration
const API_URL = 'http://localhost:3000/api'; // Change to your Railway URL in production

const app = {
    state: {
        currentView: 'demo',
        isLoggedIn: false,
        user: null,
        generations: []
    },

    // Инициализация
    init() {
        console.log("App initialized");
        this.loadUserFromStorage();
    },

    // ============================================
    // AUTH FUNCTIONS
    // ============================================

    // Load user from localStorage
    loadUserFromStorage() {
        const userData = localStorage.getItem('user');
        if (userData) {
            this.state.user = JSON.parse(userData);
            this.state.isLoggedIn = true;
            this.showMainApp();
            this.loadUserGenerations();
        }
    },

    // Save user to localStorage
    saveUserToStorage(user) {
        localStorage.setItem('user', JSON.stringify(user));
    },

    // Show main app (hide landing)
    showMainApp() {
        const landing = document.getElementById('page-landing');
        const mainApp = document.getElementById('app');

        landing.style.opacity = '0';
        landing.style.transition = 'opacity 0.5s';

        setTimeout(() => {
            landing.classList.add('hidden');
            mainApp.classList.remove('hidden');
            this.state.isLoggedIn = true;
            this.updateUserProfile(); // Show user profile
        }, 500);
    },

    // Update user profile display
    updateUserProfile() {
        if (!this.state.user) return;

        // Sidebar profile
        const profileDiv = document.getElementById('user-profile');
        const avatar = document.getElementById('user-avatar');
        const name = document.getElementById('user-name');
        const email = document.getElementById('user-email');
        const credits = document.getElementById('user-credits-count');

        if (profileDiv) profileDiv.classList.remove('hidden');
        if (avatar) avatar.src = this.state.user.picture || '';
        if (name) name.textContent = this.state.user.name || '';
        if (email) email.textContent = this.state.user.email || '';
        if (credits) credits.textContent = this.state.user.credits || 120;

        // Settings page profile
        const settingsAvatar = document.getElementById('settings-avatar');
        const settingsName = document.getElementById('settings-name');
        const settingsEmail = document.getElementById('settings-email');
        const settingsCredits = document.getElementById('settings-credits');

        if (settingsAvatar) settingsAvatar.src = this.state.user.picture || '';
        if (settingsName) settingsName.textContent = this.state.user.name || '';
        if (settingsEmail) settingsEmail.textContent = this.state.user.email || '';
        if (settingsCredits) settingsCredits.textContent = this.state.user.credits || 120;
    },

    // Logout
    logout() {
        localStorage.removeItem('user');
        this.state.user = null;
        this.state.isLoggedIn = false;
        location.reload();
    },

    // ============================================
    // NAVIGATION
    // ============================================

    nav(viewName) {
        // Скрыть все view
        document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));

        // Показать нужный view
        let targetId = 'view-' + viewName;
        if (viewName === 'generator') targetId = 'view-generator';

        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.remove('hidden');

        // Обновить активный класс в меню
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        const navIndex = ['demo', 'models', 'create', 'gallery', 'settings'].indexOf(viewName);
        if (navIndex >= 0) {
            const navItems = document.querySelectorAll('.mobile-nav .nav-item');
            if (navItems[navIndex]) navItems[navIndex].classList.add('active');
        }

        this.state.currentView = viewName;

        // Load data for specific views
        if (viewName === 'gallery') {
            this.loadUserGenerations();
        } else if (viewName === 'buy-crystals') {
            this.loadActivePayments();
        }
    },

    // ============================================
    // API CALLS
    // ============================================

    // Load user's generations from database
    async loadUserGenerations() {
        if (!this.state.user) return;

        try {
            const response = await fetch(`${API_URL}/generations/${this.state.user.id}`);
            const data = await response.json();

            if (data.success) {
                this.state.generations = data.generations;
                this.displayGenerations();
            }
        } catch (error) {
            console.error('Error loading generations:', error);
        }
    },

    // Display generations in gallery
    displayGenerations() {
        const gallery = document.querySelector('#view-gallery .image-grid');
        if (!gallery) return;

        if (this.state.generations.length === 0) {
            gallery.innerHTML = '<p class="text-dim">У вас пока нет сгенерированных изображений</p>';
            return;
        }

        gallery.innerHTML = this.state.generations.map(gen => `
            <div class="placeholder-img">
                <img src="${gen.imageUrl}" alt="${gen.prompt}">
            </div>
        `).join('');
    },

    // Save generation to database
    async saveGeneration(prompt, imageUrl, aspectRatio = '2:3', modelName = 'Demo') {
        if (!this.state.user) return;

        try {
            const response = await fetch(`${API_URL}/generations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.state.user.id,
                    prompt,
                    imageUrl,
                    aspectRatio,
                    modelName
                })
            });

            const data = await response.json();
            if (data.success) {
                this.state.generations.unshift(data.generation);
                console.log('Generation saved!');
            }
        } catch (error) {
            console.error('Error saving generation:', error);
        }
    },

    // ============================================
    // FILE HANDLING
    // ============================================

    handleFiles(input) {
        const countSpan = document.getElementById('file-count');
        if (input.files) {
            countSpan.innerText = input.files.length;
        }
    },

    // ============================================
    // GENERATION FUNCTIONS
    // ============================================

    openGenerator(modelName) {
        this.nav('generator');
    },

    async generateDemo() {
        const results = document.getElementById('demo-results');
        const textarea = document.querySelector('#view-demo textarea');
        const prompt = textarea.value || 'AI generated portrait';

        // Show loading state
        results.innerHTML = `
            <div class="placeholder-img" style="animation: fadeIn 0.5s">
                <span>Генерация...</span>
            </div>
            <div class="placeholder-img" style="animation: fadeIn 0.5s">
                <span>Генерация...</span>
            </div>
        `;

        // Simulate generation (replace with actual AI API call)
        setTimeout(async () => {
            const img1 = `https://picsum.photos/200/300?random=${Math.random()}`;
            const img2 = `https://picsum.photos/200/300?random=${Math.random()}`;

            results.innerHTML = `
                <div class="placeholder-img" style="animation: fadeIn 0.5s">
                    <img src="${img1}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="placeholder-img" style="animation: fadeIn 0.5s">
                    <img src="${img2}" style="width:100%; height:100%; object-fit:cover;">
                </div>
            `;

            // Save to database if user is logged in
            if (this.state.user) {
                await this.saveGeneration(prompt, img1);
                await this.saveGeneration(prompt, img2);
            }
        }, 2000);
    },

    async generateReal() {
        const btn = event.target;
        const originalText = btn.innerText;
        const textarea = document.querySelector('#view-generator textarea');
        const prompt = textarea.value || 'AI generated portrait';

        btn.innerText = "Генерация...";
        btn.disabled = true;

        // Simulate generation
        setTimeout(async () => {
            const imageUrl = `https://picsum.photos/200/300?random=${Math.random()}`;

            // Save to database
            if (this.state.user) {
                await this.saveGeneration(prompt, imageUrl, '2:3', 'Anna Flux');
            }

            btn.innerText = originalText;
            btn.disabled = false;
            this.nav('gallery');
        }, 2000);
    },

    async startTraining() {
        if (!this.state.user) {
            alert('Пожалуйста, войдите в систему');
            return;
        }

        alert('Началось создание модели! Мы пришлем уведомление через 20 минут.');
        this.nav('models');
    },

    // ============================================
    // MODAL FUNCTIONS
    // ============================================

    confirmDelete() {
        document.getElementById('modal-confirm').classList.add('open');
    },

    closeModal() {
        document.getElementById('modal-confirm').classList.remove('open');
    },

    // ============================================
    // PAYMENT FUNCTIONS
    // ============================================

    selectedPackage: null,

    selectPackage(crystals, amount) {
        this.selectedPackage = { crystals, amount };
        document.getElementById('selected-package').textContent = `💎 ${crystals} кристаллов за ${amount}₸`;
        document.getElementById('payment-form').classList.remove('hidden');
    },

    async createPayment() {
        if (!this.state.user) {
            alert('Пожалуйста, войдите в систему');
            return;
        }

        if (!this.selectedPackage) {
            alert('Выберите пакет');
            return;
        }

        const kaspiPhone = document.getElementById('kaspi-phone').value;
        if (!kaspiPhone) {
            alert('Введите номер Kaspi');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/payments/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.state.user.id,
                    amount: this.selectedPackage.amount,
                    crystals: this.selectedPackage.crystals,
                    kaspiPhone
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Запрос создан! Ожидайте счет от администратора на указанный номер Kaspi.');
                document.getElementById('payment-form').classList.add('hidden');
                document.getElementById('kaspi-phone').value = '';
                this.loadActivePayments();
            }
        } catch (error) {
            console.error('Error creating payment:', error);
            alert('Ошибка создания запроса');
        }
    },

    async loadActivePayments() {
        if (!this.state.user) return;

        try {
            const response = await fetch(`${API_URL}/payments/user/${this.state.user.id}`);
            const data = await response.json();

            if (data.success) {
                this.displayActivePayments(data.payments);
            }
        } catch (error) {
            console.error('Error loading payments:', error);
        }
    },

    displayActivePayments(payments) {
        const container = document.getElementById('active-payments');
        const activePayments = payments.filter(p => p.status !== 'confirmed' && p.status !== 'rejected');

        if (activePayments.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = '<h3 style="margin-top: 30px;">Активные запросы</h3>' + activePayments.map(payment => {
            const statusText = {
                'pending': 'Ожидает оплаты',
                'paid': 'Ожидает подтверждения'
            }[payment.status];

            return `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: 600;">💎 ${payment.crystals} кристаллов</div>
                            <div class="text-dim" style="font-size: 13px;">${payment.amount}₸</div>
                        </div>
                        <span style="padding: 4px 12px; background: #eab308; color: #000; border-radius: 12px; font-size: 12px; font-weight: 600;">${statusText}</span>
                    </div>
                    <div class="text-dim" style="font-size: 13px; margin-bottom: 10px;">
                        Kaspi: ${payment.kaspiPhone}
                    </div>
                    ${payment.status === 'pending' ? `
                        <button class="btn btn-primary" onclick="app.markAsPaid('${payment._id}')">
                            Я оплатил
                        </button>
                    ` : '<p class="text-dim" style="font-size: 13px;">Администратор проверяет платеж...</p>'}
                </div>
            `;
        }).join('');
    },

    async markAsPaid(paymentId) {
        if (!confirm('Вы уверены, что оплатили счет?')) return;

        try {
            const response = await fetch(`${API_URL}/payments/${paymentId}/mark-paid`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                alert('Спасибо! Администратор проверит платеж и зачислит кристаллы.');
                this.loadActivePayments();
            }
        } catch (error) {
            console.error('Error marking as paid:', error);
            alert('Ошибка');
        }
    }
};

// ============================================
// GOOGLE SIGN-IN CALLBACK
// ============================================

async function handleGoogleSignIn(response) {
    try {
        // Send token to backend
        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: response.credential
            })
        });

        const data = await res.json();

        if (data.success) {
            app.state.user = data.user;
            app.saveUserToStorage(data.user);
            app.showMainApp();
            app.loadUserGenerations();
        } else {
            alert('Ошибка авторизации');
        }
    } catch (error) {
        console.error('Sign-in error:', error);
        alert('Ошибка при входе');
    }
}

// Initialize app when page loads
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
