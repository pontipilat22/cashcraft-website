// API Configuration
const API_URL = 'https://www.ai-photo.kz/api'; // Change to your Railway URL in production

const app = {
    state: {
        currentView: 'generation',
        isLoggedIn: false,
        user: null,
        generations: [],
        selectedModel: '3783799',
        selectedRatio: '2:3',
        selectedGender: 'man',
        uploadedFiles: [],
        photoCount: 1
    },

    // Инициализация
    init() {
        console.log("App initialized");
        this.loadUserFromStorage();
        this.startCreditRefresh(); // Start automatic credit refresh
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

    // Refresh user credits from server
    async refreshUserCredits() {
        if (!this.state.user) return;

        try {
            const response = await fetch(`${API_URL}/user/${this.state.user.id}`);
            const data = await response.json();

            if (data.success) {
                this.state.user.credits = data.user.credits;
                this.saveUserToStorage(this.state.user);
                this.updateUserProfile();
            }
        } catch (error) {
            console.error('Error refreshing credits:', error);
        }
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
        const navIndex = ['generation', 'models', 'templates', 'gallery', 'settings'].indexOf(viewName);
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
            // Set default photo count
            this.state.photoCount = 4;
            const select = document.getElementById('photo-count-select');
            if (select) select.value = '4';
            this.updatePhotoCount();
        } else if (viewName === 'gallery') {
            this.loadUserGenerations();
        } else if (viewName === 'settings') {
            this.activePayments = []; // Reset to avoid duplicates before load
            this.refreshUserCredits(); // Refresh credits when opening settings
            this.loadActivePayments();

            // Reset payment UI state
            if (document.getElementById('start-payment-container')) {
                document.getElementById('start-payment-container').classList.remove('hidden');
                document.getElementById('payment-methods-section').classList.add('hidden');
                document.getElementById('kaspi-payment-section').classList.add('hidden');
            }
        }
    },

    // Start periodic credit refresh
    startCreditRefresh() {
        // Refresh credits every 30 seconds when user is logged in
        setInterval(() => {
            if (this.state.user) {
                this.refreshUserCredits();
            }
        }, 30000);
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

        const filteredGens = this.state.generations.filter(gen => {
            const url = gen.imageUrl.toLowerCase();
            return !url.includes('picsum.photos') && !url.includes('unsplash.com');
        });

        if (filteredGens.length === 0) {
            gallery.innerHTML = '<p class="text-dim">У вас пока нет сгенерированных изображений</p>';
            return;
        }

        gallery.innerHTML = filteredGens.map(gen => `
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

    // Update photo count and cost
    updatePhotoCount() {
        const select = document.getElementById('photo-count-select');
        this.state.photoCount = parseInt(select.value);
        const cost = this.state.photoCount * 3; // 3 crystals per photo

        const costSpan = document.getElementById('generation-cost');
        if (costSpan) {
            costSpan.textContent = `${this.state.photoCount} фото — ${cost} 💎`;
        }
    },

    // Update model selection
    updateModelSelection() {
        const select = document.getElementById('generation-model-select');
        this.state.selectedModel = select.value;
    },

    // Navigates to generation and selects a model
    openGenerator(modelId) {
        this.nav('generation');
        const select = document.getElementById('generation-model-select');
        if (select) {
            // Find option with this value or text
            let found = false;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === modelId || select.options[i].text === modelId) {
                    select.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found) {
                // If not found, try to select by ID directly if it's the demo
                if (modelId === 'Anna Flux' || modelId === 'demo') {
                    select.value = '3783799';
                }
            }
            this.updateModelSelection();
        }
    },

    // Load user models for selection
    async loadUserModels() {
        if (!this.state.user) return;

        try {
            const response = await fetch(`${API_URL}/models/${this.state.user.id}`);
            const data = await response.json();

            const select = document.getElementById('generation-model-select');
            const modelsList = document.getElementById('user-models-list');

            // Clear existing
            if (select) select.innerHTML = '<option value="3783799">Anna Flux (Demo)</option>';
            if (modelsList) modelsList.innerHTML = '';

            if (data.success && data.models.length > 0) {
                data.models.forEach(model => {
                    // Add to select if ready
                    if (model.status === 'ready' && select) {
                        const option = document.createElement('option');
                        option.value = model._id;
                        option.textContent = model.name;
                        select.appendChild(option);
                    }

                    // Add to Models list view
                    if (modelsList) {
                        const statusColor = model.status === 'ready' ? '#22c55e' : '#eab308';
                        const statusText = model.status === 'ready' ? 'Готова к работе' : 'В обработке...';

                        const card = document.createElement('div');
                        card.className = 'card';
                        card.innerHTML = `
                            <div class="flex justify-between items-center">
                                <div>
                                    <h3>${model.name}</h3>
                                    <span style="color: ${statusColor}; font-size: 0.8rem;">● ${statusText}</span>
                                </div>
                                <div style="width: 40px; height: 40px; background: #333; border-radius: 50%; overflow: hidden;">
                                    ${model.trainingImages && model.trainingImages[0] ? `<img src="${model.trainingImages[0]}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                                </div>
                            </div>
                            <div class="flex gap-2" style="margin-top: 15px;">
                                <button class="btn btn-primary" ${model.status !== 'ready' ? 'disabled' : ''} onclick="app.openGenerator('${model._id}')">Генерировать</button>
                                <button class="btn btn-secondary" style="width: auto;">⋮</button>
                            </div>
                        `;
                        modelsList.appendChild(card);
                    }
                });
            } else if (modelsList) {
                modelsList.innerHTML = '<p class="text-dim">У вас пока нет созданных моделей</p>';
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

        const filteredGens = generations.filter(gen => {
            const url = gen.imageUrl.toLowerCase();
            return !url.includes('picsum.photos') && !url.includes('unsplash.com');
        });

        if (filteredGens.length === 0) {
            resultsDiv.innerHTML = '<p class="text-dim">Здесь появятся ваши сгенерированные изображения</p>';
            return;
        }

        resultsDiv.innerHTML = filteredGens.map(gen => `
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

        const photoCount = this.state.photoCount || 4;
        const totalCost = photoCount * 3; // 3 crystals per photo

        // Check credits
        if (this.state.user.credits < totalCost) {
            alert(`Недостаточно кредитов. Нужно ${totalCost} 💎, у вас ${this.state.user.credits} 💎\n\nПополните баланс в разделе Профиль.`);
            this.nav('settings');
            return;
        }

        const results = document.getElementById('generation-results');
        const btn = event.target;
        const originalHTML = btn.innerHTML;

        btn.innerHTML = "⏳ Генерация...";
        btn.disabled = true;

        // Show loading state placeholders
        results.innerHTML = Array(photoCount).fill(0).map(() => `
            <div class="placeholder-img" style="animation: bounce 1.5s infinite">
                <span>🤖 Думаем...</span>
            </div>
        `).join('');

        try {
            // 1. Call Generation API (Start Job)
            const response = await fetch(`${API_URL}/generations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.state.user.id,
                    prompt: prompt,
                    modelId: this.state.selectedModel,
                    aspectRatio: this.state.selectedRatio,
                    count: photoCount
                })
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Server error');
            }

            // 2. Poll for results (Wait for Webhook)
            // Deduct credits visually (optimistic)
            // Deduct credits visually (optimistic) or from server
            if (this.state.user) {
                if (data.remainingCredits !== undefined) {
                    this.state.user.credits = data.remainingCredits;
                } else {
                    this.state.user.credits -= totalCost;
                }
                this.saveUserToStorage(this.state.user);
                this.updateUserProfile();
            }

            let attempts = 0;
            const maxAttempts = 20; // 20 * 3s = 60 seconds

            const interval = setInterval(async () => {
                attempts++;
                await this.loadRecentGenerations();

                // Check if placeholders are gone (i.e., we have real images)
                // Actually loadRecentGenerations replaces innerHTML. 
                // We just hope new images are at top.
                // We can't easily distinguish "new" vs "old" unless we track IDs.
                // But generally fine for UI feedback.

                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                    alert('Генерация занимает больше времени. Проверьте результат позже.');
                }

                // If we see images that match our prompt? Too complex.
                // Just stop polling after some time or if we see new items count increased?
                // Let's just poll for 30s fixed for now, user sees updates.
            }, 4000);

            // Stop polling after success? No, just let it run a bit.
            setTimeout(() => {
                clearInterval(interval);
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                alert(`✅ Запрос отправлен! Изображения скоро появятся.`);
            }, 20000); // Stop UI loading state after 20s, let background polling continue?
            // Actually better to keep button disabled? No, user might want to try again.

        } catch (error) {
            console.error('Generation Error:', error);
            alert('Ошибка: ' + error.message);
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            this.loadRecentGenerations(); // Restore old ones
        }
    },

    async generateReal() {
        const btn = event.target;
        const originalText = btn.innerText;
        const textarea = document.querySelector('#view-generator textarea');
        const prompt = textarea.value || 'AI generated portrait';

        btn.innerText = "Генерация...";
        btn.disabled = true;

        // Simulation disabled - just show alert
        setTimeout(() => {
            alert('Эта функция (Studio) временно ограничена. Используйте вкладку "Генерация".');
            btn.innerText = originalText;
            btn.disabled = false;
        }, 1000);
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
        const trainingCost = 50; // 50 crystals for training
        if (this.state.user.credits < trainingCost) {
            alert(`Недостаточно кредитов. Нужно ${trainingCost} 💎, у вас ${this.state.user.credits} 💎\n\nПополните баланс в разделе Профиль.`);
            this.nav('settings');
            return;
        }

        if (!confirm(`Начать обучение модели "${modelName}"?\nБудет списано ${trainingCost} 💎`)) {
            return;
        }

        const btn = event.target;
        const orgText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "⏳ Загрузка фото...";

        try {
            // 1. Upload photos first
            const trainingImages = [];

            for (let i = 0; i < this.state.uploadedFiles.length; i++) {
                const file = this.state.uploadedFiles[i];
                btn.innerText = `⏳ Загрузка ${i + 1}/${this.state.uploadedFiles.length}...`;

                const formData = new FormData();
                formData.append('file', file);

                const upRes = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
                const upData = await upRes.json();

                if (upData.success) {
                    trainingImages.push(upData.url);
                }
            }

            if (trainingImages.length < 5) { // At least some must succeed
                throw new Error("Не удалось загрузить фотографии на сервер");
            }

            btn.innerText = "🚀 Запуск обучения...";

            // 2. Start Training
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
                // Deduct credits locally (server handles real logic? No, server is simple api proxy mostly)
                // Actually server logic should deduct credits. 
                // But current server implementation didn't deduct credits in model route.
                // We'll deduct locally for UI sync, assume server does it or we add it later.
                if (this.state.user) {
                    if (data.remainingCredits !== undefined) {
                        this.state.user.credits = data.remainingCredits;
                    } else {
                        this.state.user.credits -= trainingCost;
                    }
                    this.saveUserToStorage(this.state.user);
                    this.updateUserProfile();
                }

                alert(`✅ Обучение модели началось!\n\nМодель будет готова примерно через 20-30 минут.\nВам придет уведомление (или обновите страницу).`);

                // Reset form
                document.getElementById('model-name').value = '';
                document.getElementById('file-input').value = '';
                document.getElementById('photo-preview').innerHTML = '';
                document.getElementById('file-count').innerText = '0';
                this.state.uploadedFiles = [];

                btn.innerText = orgText;
                btn.disabled = false;

                this.nav('models');
            } else {
                throw new Error(data.error || 'Ошибка сервера');
            }
        } catch (error) {
            console.error('Error starting training:', error);
            alert('Ошибка: ' + error.message);
            btn.innerText = orgText;
            btn.disabled = false;
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

    // Show aspect ratio modal
    showRatioModal() {
        document.getElementById('modal-ratio').classList.add('open');
    },

    // Select aspect ratio and update UI
    selectRatio(ratio) {
        this.state.selectedRatio = ratio;

        // Update icon aspect ratio
        const icon = document.getElementById('ratio-icon');
        const label = document.getElementById('ratio-label');

        const ratioMap = {
            '2:3': { aspect: '2/3', label: '2:3', description: 'Портрет' },
            '1:1': { aspect: '1/1', label: '1:1', description: 'Квадрат' },
            '16:9': { aspect: '16/9', label: '16:9', description: 'Широкий' },
            '9:16': { aspect: '9/16', label: '9:16', description: 'Вертикальный' }
        };

        if (icon && ratioMap[ratio]) {
            icon.style.aspectRatio = ratioMap[ratio].aspect;
            label.textContent = ratioMap[ratio].label;
        }

        this.closeRatioModal();
    },

    // Close ratio modal
    closeRatioModal() {
        document.getElementById('modal-ratio').classList.remove('open');
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
    },

    selectTemplate(prompt) {
        document.getElementById('generation-prompt').value = prompt;
        this.nav('generation');

        // Scroll to textarea
        document.getElementById('generation-prompt').scrollIntoView({ behavior: 'smooth' });
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
