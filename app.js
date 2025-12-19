// API Configuration
const API_URL = 'https://www.ai-photo.kz/api'; // Change to your Railway URL in production

const app = {
    state: {
        currentView: 'generation',
        isLoggedIn: false,
        user: null,
        generations: [],
        selectedModel: 'demo',
        selectedRatio: '2:3',
        selectedGender: 'man',
        uploadedFiles: []
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
        const navIndex = ['generation', 'models', 'create', 'gallery', 'settings'].indexOf(viewName);
        if (navIndex >= 0) {
            const navItems = document.querySelectorAll('.mobile-nav .nav-item');
            if (navItems[navIndex]) navItems[navIndex].classList.add('active');
        }

        this.state.currentView = viewName;

        // Load data for specific views
        if (viewName === 'buy-crystals') {
            this.nav('settings');
            return;
        }

        // Load data for specific views
        if (viewName === 'generation') {
            this.loadUserModels();
            this.loadRecentGenerations();
            this.initRatioButtons();
        } else if (viewName === 'gallery') {
            this.loadUserGenerations();
        } else if (viewName === 'settings') {
            this.activePayments = []; // Reset to avoid duplicates before load
            this.loadActivePayments();

            // Reset payment UI state
            if (document.getElementById('start-payment-container')) {
                document.getElementById('start-payment-container').classList.remove('hidden');
                document.getElementById('payment-methods-section').classList.add('hidden');
                document.getElementById('kaspi-payment-section').classList.add('hidden');
            }
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

    selectGender(gender) {
        this.state.selectedGender = gender;
        // Update button states
        document.querySelectorAll('[data-gender]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-gender') === gender) {
                btn.classList.add('active');
            }
        });
    },

    handleFiles(input) {
        const countSpan = document.getElementById('file-count');
        const previewDiv = document.getElementById('photo-preview');
        const trainBtn = document.getElementById('train-btn');

        if (!input.files) return;

        this.state.uploadedFiles = Array.from(input.files);
        countSpan.innerText = this.state.uploadedFiles.length;

        // Enable/disable train button
        if (this.state.uploadedFiles.length >= 10 && this.state.uploadedFiles.length <= 20) {
            trainBtn.disabled = false;
        } else {
            trainBtn.disabled = true;
        }

        // Show preview
        previewDiv.innerHTML = '';
        this.state.uploadedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgWrapper = document.createElement('div');
                imgWrapper.style.cssText = 'position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 2px solid var(--border-color);';

                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '×';
                removeBtn.style.cssText = 'position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 18px; line-height: 1;';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.removeFile(index);
                };

                imgWrapper.appendChild(img);
                imgWrapper.appendChild(removeBtn);
                previewDiv.appendChild(imgWrapper);
            };
            reader.readAsDataURL(file);
        });
    },

    removeFile(index) {
        this.state.uploadedFiles.splice(index, 1);
        const dt = new DataTransfer();
        this.state.uploadedFiles.forEach(file => dt.items.add(file));
        document.getElementById('file-input').files = dt.files;

        // Update count and preview
        document.getElementById('file-count').innerText = this.state.uploadedFiles.length;
        const trainBtn = document.getElementById('train-btn');
        if (this.state.uploadedFiles.length >= 10 && this.state.uploadedFiles.length <= 20) {
            trainBtn.disabled = false;
        } else {
            trainBtn.disabled = true;
        }

        // Rebuild preview
        const input = document.getElementById('file-input');
        this.handleFiles(input);
    },

    // ============================================
    // GENERATION FUNCTIONS
    // ============================================

    openGenerator(modelName) {
        this.nav('generator');
    },

    // Initialize ratio button handlers
    initRatioButtons() {
        const ratioButtons = document.querySelectorAll('.ratio-btn');
        ratioButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                ratioButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.selectedRatio = btn.getAttribute('data-ratio');
            });
        });
    },

    // Update model selection
    updateModelSelection() {
        const select = document.getElementById('generation-model-select');
        this.state.selectedModel = select.value;
    },

    // Load user models for selection
    async loadUserModels() {
        if (!this.state.user) return;

        try {
            const response = await fetch(`${API_URL}/models/${this.state.user.id}`);
            const data = await response.json();

            if (data.success && data.models.length > 0) {
                const select = document.getElementById('generation-model-select');
                // Clear existing options except demo
                select.innerHTML = '<option value="demo">Демо модель (без обучения)</option>';

                // Add user models
                data.models.forEach(model => {
                    if (model.status === 'ready') {
                        const option = document.createElement('option');
                        option.value = model._id;
                        option.textContent = model.name;
                        select.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading models:', error);
        }
    },

    // Load recent generations for display
    async loadRecentGenerations() {
        if (!this.state.user) return;

        try {
            const response = await fetch(`${API_URL}/generations/${this.state.user.id}`);
            const data = await response.json();

            if (data.success) {
                this.displayRecentGenerations(data.generations.slice(0, 6));
            }
        } catch (error) {
            console.error('Error loading generations:', error);
        }
    },

    // Display recent generations
    displayRecentGenerations(generations) {
        const resultsDiv = document.getElementById('generation-results');
        if (!resultsDiv) return;

        if (generations.length === 0) {
            resultsDiv.innerHTML = '<p class="text-dim">Здесь появятся ваши сгенерированные изображения</p>';
            return;
        }

        resultsDiv.innerHTML = generations.map(gen => `
            <div class="placeholder-img" style="animation: fadeIn 0.5s">
                <img src="${gen.imageUrl}" alt="${gen.prompt}" style="width:100%; height:100%; object-fit:cover;">
            </div>
        `).join('');
    },

    // Main generation function
    async generateImage() {
        if (!this.state.user) {
            alert('Пожалуйста, войдите в систему');
            return;
        }

        const textarea = document.getElementById('generation-prompt');
        const prompt = textarea.value.trim();

        if (!prompt) {
            alert('Введите описание для генерации');
            return;
        }

        // Check credits
        if (this.state.user.credits < 10) {
            alert('Недостаточно кредитов. Пополните баланс.');
            this.nav('settings');
            return;
        }

        const results = document.getElementById('generation-results');
        const btn = event.target;
        const originalText = btn.innerText;

        btn.innerText = "Генерация...";
        btn.disabled = true;

        // Show loading state
        results.innerHTML = `
            <div class="placeholder-img" style="animation: fadeIn 0.5s">
                <span>Генерация...</span>
            </div>
        `;

        // Simulate generation (replace with actual Astria API call)
        setTimeout(async () => {
            const imageUrl = `https://picsum.photos/400/600?random=${Math.random()}`;

            // Save to database
            await this.saveGeneration(prompt, imageUrl, this.state.selectedRatio, this.state.selectedModel);

            // Deduct credits
            this.state.user.credits -= 10;
            this.updateUserProfile();

            // Reload recent generations
            await this.loadRecentGenerations();

            btn.innerText = originalText;
            btn.disabled = false;

            alert('Генерация завершена! 🎉');
        }, 3000);
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

        const modelName = document.getElementById('model-name').value.trim();
        if (!modelName) {
            alert('Введите название модели');
            return;
        }

        if (this.state.uploadedFiles.length < 10 || this.state.uploadedFiles.length > 20) {
            alert('Загрузите от 10 до 20 фотографий');
            return;
        }

        // Check credits
        if (this.state.user.credits < 500) {
            alert('Недостаточно кредитов. Пополните баланс.');
            this.nav('settings');
            return;
        }

        if (!confirm(`Начать обучение модели "${modelName}"?\nБудет списано 500 💎`)) {
            return;
        }

        // TODO: Upload files to Cloudinary and get URLs
        // For now, simulate with placeholder
        const trainingImages = this.state.uploadedFiles.map((file, i) => `uploaded_image_${i}.jpg`);

        try {
            const response = await fetch(`${API_URL}/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.state.user.id,
                    name: modelName,
                    gender: this.state.selectedGender,
                    trainingImages
                })
            });

            const data = await response.json();

            if (data.success) {
                // Deduct credits
                this.state.user.credits -= 500;
                this.updateUserProfile();

                alert('✅ Обучение модели началось!\n\nМодель будет готова примерно через 20 минут.\nВы получите уведомление после завершения.');

                // Reset form
                document.getElementById('model-name').value = '';
                document.getElementById('file-input').value = '';
                document.getElementById('photo-preview').innerHTML = '';
                document.getElementById('file-count').innerText = '0';
                this.state.uploadedFiles = [];

                this.nav('models');
            }
        } catch (error) {
            console.error('Error starting training:', error);
            alert('Ошибка при создании модели');
        }
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

    showPaymentMethods() {
        document.getElementById('start-payment-container').classList.add('hidden');
        document.getElementById('payment-methods-section').classList.remove('hidden');
    },

    selectPaymentMethod(method) {
        if (method === 'kaspi') {
            document.getElementById('payment-methods-section').classList.add('hidden');
            document.getElementById('kaspi-payment-section').classList.remove('hidden');
        } else {
            alert('Данный метод оплаты временно недоступен. Пожалуйста, используйте Kaspi.');
        }
    },

    selectedPackage: null,

    selectPackage(crystals, amount, element) {
        this.selectedPackage = { crystals, amount };

        // Remove active class from all packages
        document.querySelectorAll('.package-card').forEach(card => {
            card.style.borderColor = 'var(--border-color)';
            card.style.transform = 'scale(1)';
            card.style.boxShadow = 'none';
        });

        // Add active styling to selected package
        if (element) {
            element.style.borderColor = '#fff';
            element.style.transform = 'scale(1.05)';
            element.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)';
        }

        document.getElementById('selected-package').textContent = `💎 ${crystals} кристаллов за ${amount}₸`;
        document.getElementById('payment-form').classList.remove('hidden');

        // Smooth scroll to payment form
        document.getElementById('payment-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    async createPayment() {
        console.log('=== createPayment called ==='); // Debug
        console.log('User:', this.state.user); // Debug
        console.log('Selected package:', this.selectedPackage); // Debug

        if (!this.state.user) {
            alert('Пожалуйста, войдите в систему');
            return;
        }

        if (!this.selectedPackage) {
            alert('Сначала выберите пакет кристаллов выше');
            return;
        }

        const kaspiPhone = document.getElementById('kaspi-phone').value.trim();
        const kaspiName = document.getElementById('kaspi-name').value.trim();

        console.log('Phone:', kaspiPhone, 'Name:', kaspiName); // Debug

        if (!kaspiPhone) {
            alert('Введите номер телефона Kaspi');
            return;
        }

        if (!kaspiName) {
            alert('Введите имя, как оно указано в Kaspi');
            return;
        }

        const btn = event.target;
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Отправка...';

        try {
            console.log('Sending request to:', `${API_URL}/payments/create`); // Debug

            const response = await fetch(`${API_URL}/payments/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.state.user.id,
                    amount: this.selectedPackage.amount,
                    crystals: this.selectedPackage.crystals,
                    kaspiPhone,
                    kaspiName
                })
            });

            console.log('Response status:', response.status); // Debug
            const data = await response.json();
            console.log('Response data:', data); // Debug

            if (data.success) {
                alert('✅ Запрос отправлен!\n\nАдминистратор вышлет счет на указанный номер Kaspi.\nПосле оплаты кристаллы будут автоматически зачислены.');
                document.getElementById('payment-form').classList.add('hidden');
                document.getElementById('kaspi-phone').value = '';
                document.getElementById('kaspi-name').value = '';
                this.selectedPackage = null;

                // Reset package selection
                document.querySelectorAll('.package-card').forEach(card => {
                    card.style.borderColor = 'var(--border-color)';
                    card.style.transform = 'scale(1)';
                    card.style.boxShadow = 'none';
                });

                this.loadActivePayments();
            } else {
                alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error creating payment:', error);
            alert('Ошибка создания запроса: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
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
                'pending': 'Ожидает отправки счета',
                'paid': 'Ожидает подтверждения'
            }[payment.status];

            const statusColor = {
                'pending': '#eab308',
                'paid': '#22c55e'
            }[payment.status];

            return `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: 600;">💎 ${payment.crystals} кристаллов</div>
                            <div class="text-dim" style="font-size: 13px;">${payment.amount}₸</div>
                        </div>
                        <span style="padding: 4px 12px; background: ${statusColor}; color: ${payment.status === 'pending' ? '#000' : '#fff'}; border-radius: 12px; font-size: 12px; font-weight: 600;">${statusText}</span>
                    </div>
                    <div class="text-dim" style="font-size: 13px; margin-bottom: 5px;">
                        <strong>Телефон:</strong> ${payment.kaspiPhone}
                    </div>
                    <div class="text-dim" style="font-size: 13px; margin-bottom: 10px;">
                        <strong>Имя:</strong> ${payment.kaspiName}
                    </div>
                    ${payment.status === 'pending' ? `
                        <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 10px; margin-top: 10px;">
                            <p class="text-dim" style="font-size: 12px;">⏳ Ожидайте, администратор вышлет счет на указанный номер Kaspi</p>
                        </div>
                    ` : `
                        <button class="btn btn-primary" onclick="app.markAsPaid('${payment._id}')" disabled style="opacity: 0.6;">
                            Оплачено (проверяется)
                        </button>
                    `}
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
            console.error('Auth failed:', data);
            alert('Ошибка авторизации: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Sign-in error:', error);
        alert('Ошибка при входе: ' + error.message);
    }
}

// Initialize app when page loads
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
