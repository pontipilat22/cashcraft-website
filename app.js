const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : '/api';

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
        photoCount: 1,
        selectedTemplateImageUrl: null
    },

    // Инициализация
    init() {
        console.log("App initialized");
        this.loadUserFromStorage();
        this.loadSettings();
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

    // Save app settings
    saveSettings() {
        const settings = {
            selectedModel: this.state.selectedModel,
            selectedRatio: this.state.selectedRatio,
            photoCount: this.state.photoCount
        };
        localStorage.setItem('app_settings', JSON.stringify(settings));
    },

    // Load app settings
    loadSettings() {
        try {
            const saved = localStorage.getItem('app_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                if (settings.selectedModel) this.state.selectedModel = settings.selectedModel;
                if (settings.selectedRatio) this.state.selectedRatio = settings.selectedRatio;
                if (settings.photoCount) this.state.photoCount = settings.photoCount;
            }
        } catch (e) {
            console.error('Error loading settings', e);
        }
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

        // Reset scroll position
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;

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
            this.refreshUserCredits();
            this.loadUserTickets();
        } else if (viewName === 'payment') {
            document.getElementById('payment-methods-section').classList.remove('hidden');
            document.getElementById('kaspi-payment-section').classList.add('hidden');
            this.activePayments = [];
            this.loadActivePayments();
        } else if (viewName === 'models') {
            this.loadUserModels();
        } else if (viewName === 'templates') {
            this.loadTemplates();
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
        console.log(`[Files] Selected: ${this.state.uploadedFiles.length} files`);
        countSpan.innerText = this.state.uploadedFiles.length;

        // Enable/disable train button
        if (this.state.uploadedFiles.length >= 3 && this.state.uploadedFiles.length <= 30) {
            console.log(`[Files] Valid count. Enabling train button.`);
            trainBtn.disabled = false;
            trainBtn.style.opacity = '1';
        } else {
            console.log(`[Files] Invalid count (${this.state.uploadedFiles.length}). Button stays disabled. Нужно 3-30.`);
            trainBtn.disabled = true;
            trainBtn.style.opacity = '0.5';
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
                this.saveSettings();
            });
        });
    },

    // Update photo count and cost
    updatePhotoCount() {
        const select = document.getElementById('photo-count-select');
        this.state.photoCount = parseInt(select.value);
        this.saveSettings();
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
        this.saveSettings();
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
                                <button class="btn btn-secondary" style="width: auto; color: var(--danger);" onclick="app.deleteModel('${model._id}', '${model.name}')">🗑</button>
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

    async deleteModel(modelId, modelName) {
        if (!confirm(`Вы уверены, что хотите удалить модель "${modelName}"?`)) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/models/${modelId}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                this.loadUserModels();
            } else {
                alert('Ошибка при удалении: ' + data.error);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Ошибка при удалении');
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
        // Prevent clearing placeholders if we are currently generating
        if (this.state.isGenerating) return;

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

        this.state.isGenerating = true;

        // Show loading state placeholders with elegant animation
        results.innerHTML = Array(photoCount).fill(0).map(() => `
            <div class="placeholder-img generating">
                <div class="ai-sparkles">
                    <span class="center-icon">🎨</span>
                </div>
                <div class="loading-text">AI создаёт...</div>
                <div class="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
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
                    count: photoCount,
                    superResolution: document.getElementById('toggle-super-res').checked,
                    filmGrain: document.getElementById('toggle-film-grain').checked,
                    inpaintFaces: document.getElementById('toggle-inpaint-faces').checked,
                    templateImageUrl: this.state.selectedTemplateImageUrl
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
                const gens = await this.fetchRecentGenerations();

                // If we have new images, stop polling and show them
                if (gens && gens.length > 0) {
                    const firstGen = gens[0];
                    const isNew = !this.state.lastGenerationId || firstGen._id !== this.state.lastGenerationId;

                    if (isNew) {
                        this.state.isGenerating = false;
                        this.state.lastGenerationId = firstGen._id;
                        clearInterval(interval);
                        btn.innerHTML = originalHTML;
                        btn.disabled = false;
                        this.displayRecentGenerations(gens);
                    }
                }

                if (attempts >= maxAttempts) {
                    this.state.isGenerating = false;
                    clearInterval(interval);
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                    await this.loadRecentGenerations();
                    alert('Генерация занимает больше времени. Проверьте результат позже.');
                }
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

    // ============================================
    // TEMPLATE FUNCTIONS
    // ============================================

    async loadTemplates() {
        const grid = document.getElementById('templates-grid');
        if (grid) grid.innerHTML = '<div class="placeholder-img" style="grid-column: 1/-1; animation: bounce 1.5s infinite"><span>🤖 Загрузка стилей...</span></div>';

        try {
            const response = await fetch(`${API_URL}/templates`);
            const data = await response.json();

            if (data.success) {
                this.displayTemplates(data.templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            if (grid) grid.innerHTML = '<p class="text-dim">Ошибка загрузки шаблонов</p>';
        }
    },

    displayTemplates(templates) {
        const grid = document.getElementById('templates-grid');
        if (!grid) return;

        if (templates.length === 0) {
            grid.innerHTML = '<p class="text-dim">Шаблонов пока нет. Администратор скоро их добавит!</p>';
            return;
        }

        // Group by category
        const groups = {};
        templates.forEach(tpl => {
            const cat = tpl.category || 'Общие';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(tpl);
        });

        let html = '';
        for (const [category, items] of Object.entries(groups)) {
            html += `
                <div class="category-section" style="grid-column: 1/-1; margin-top: 20px; width: 100%;">
                    <h3 style="margin-bottom: 12px; font-size: 1.1rem; color: #fff; font-weight: 600;">
                        ${category}
                    </h3>
                    <div class="template-category-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px;">
                        ${items.map(tpl => `
                            <div class="template-item card ${tpl.isHit ? 'hit-card' : ''}" 
                                 onclick="app.selectTemplate(this)"
                                 data-prompt="${tpl.prompt.replace(/"/g, '&quot;')}"
                                 data-name="${tpl.name.replace(/"/g, '&quot;')}"
                                 data-image="${tpl.imageUrl}">
                                <div style="aspect-ratio: 1/1; margin-bottom: 10px; position: relative; border-radius: 8px; overflow: hidden;">
                                    <img src="${tpl.imageUrl}" alt="${tpl.name}" style="width:100%; height:100%; object-fit:cover;">
                                    ${tpl.isHit ? '<span class="hit-label" style="position: absolute; top: 5px; right: 5px; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">ХИТ 🔥</span>' : ''}
                                </div>
                                <span style="font-size: 0.85rem; font-weight: 500; display: block; text-align: center;">${tpl.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
        grid.style.display = 'block'; // Make sure grid container doesn't mess up layout
    },

    selectTemplate(el) {
        const promptText = el.getAttribute('data-prompt');
        const imageUrl = el.getAttribute('data-image');
        const name = el.getAttribute('data-name');

        // Switch to generation view
        this.nav('generation');

        // Set prompt
        const textarea = document.getElementById('generation-prompt');
        console.log('Template selecting:', { name, promptText, el }); // Debug info
        if (textarea) {
            textarea.value = promptText || '';
        }

        this.state.selectedTemplateImageUrl = imageUrl;
        this.state.selectedTemplateName = name;
        this.updateSelectedTemplateUI();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateSelectedTemplateUI() {
        const previewContainer = document.getElementById('selected-template-preview');
        if (!previewContainer) return;

        if (this.state.selectedTemplateImageUrl) {
            previewContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; background: rgba(var(--primary-rgb, 240, 147, 251), 0.15); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(var(--primary-rgb, 240, 147, 251), 0.3); max-width: fit-content;">
                    <span style="font-size: 0.75rem; font-weight: 600; color: #fff;">✨ Стиль: ${this.state.selectedTemplateName || 'Выбран'}</span>
                    <button onclick="app.clearSelectedTemplate()" style="background: none; border: none; color: #fff; padding: 0 0 0 4px; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; opacity: 0.7;">✕</button>
                    <img src="${this.state.selectedTemplateImageUrl}" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover;">
                </div>
            `;
            previewContainer.classList.remove('hidden');
        } else {
            previewContainer.innerHTML = '';
            previewContainer.classList.add('hidden');
        }
    },

    clearSelectedTemplate() {
        this.state.selectedTemplateImageUrl = null;
        this.state.selectedTemplateName = null;
        this.updateSelectedTemplateUI();
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

        if (this.state.uploadedFiles.length < 3 || this.state.uploadedFiles.length > 30) {
            alert('Загрузите от 3 до 30 фотографий. Рекомендуется 8-20 для лучшего сходства.');
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

        const btn = document.getElementById('train-btn');
        const orgText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "⏳ Загрузка фото...";

        try {
            // 1. Upload photos first
            const trainingImages = [];

            for (let i = 0; i < this.state.uploadedFiles.length; i++) {
                const file = this.state.uploadedFiles[i];
                const progressMsg = `⏳ Загрузка ${i + 1}/${this.state.uploadedFiles.length}...`;
                btn.innerText = progressMsg;
                console.log(`[Training] ${progressMsg}`);

                const formData = new FormData();
                formData.append('file', file);

                try {
                    const upRes = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
                    const upData = await upRes.json();

                    if (upData.success) {
                        trainingImages.push(upData.url);
                        console.log(`[Training] File ${i + 1} uploaded: ${upData.url}`);
                    } else {
                        console.error(`[Training] File ${i + 1} failed:`, upData.error);
                    }
                } catch (upErr) {
                    console.error(`[Training] Upload error for file ${i + 1}:`, upErr);
                }
            }

            console.log(`[Training] Total uploaded images: ${trainingImages.length}`);

            if (trainingImages.length < 3) {
                throw new Error(`Удалось загрузить только ${trainingImages.length} фото из ${this.state.uploadedFiles.length}. Нужно минимум 3. Проверьте интернет.`);
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
            const errorMsg = error.message.length > 200 ? error.message.substring(0, 200) + '...' : error.message;
            alert('❌ Ошибка обучения:\n' + errorMsg + '\n\nБаланс кристаллов был возвращен.');
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
        document.getElementById('payment-methods-section').classList.remove('hidden');
        document.getElementById('kaspi-payment-section').classList.add('hidden');
    },

    showKaspiSection() {
        document.getElementById('payment-methods-section').classList.add('hidden');
        document.getElementById('kaspi-payment-section').classList.remove('hidden');
    },

    selectPaymentMethod(method) {
        if (method === 'kaspi') {
            this.showKaspiSection();
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
                            <p class="text-dim" style="font-size: 12px; margin-bottom: 8px;">1. Оплатите на Kaspi по номеру (вам пришлют счет)</p>
                            <p class="text-dim" style="font-size: 12px; margin-bottom: 8px;">2. Нажмите кнопку ниже:</p>
                            <button onclick="app.markAsPaid('${payment._id}')" class="btn" style="background: var(--success); color: #fff; width: 100%; font-size: 13px; padding: 8px;">✅ Я оплатил</button>
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
        if (!confirm('Вы действительно перевели деньги?')) return;

        try {
            const response = await fetch(`${API_URL}/payments/${paymentId}/mark-paid`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                alert('Статус обновлен! Администратор скоро начислит кристаллы.');
                this.loadActivePayments();
            } else {
                alert('Ошибка: ' + (data.error || 'Server error'));
            }
        } catch (error) {
            console.error('Error marking paid:', error);
            alert('Ошибка сети');
        }
    },

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

// ============================================
// SUPPORT TICKET FUNCTIONS (inside app object would be better, but adding here for simplicity)
// ============================================

app.sendSupportMessage = async function () {
    if (!this.state.user) {
        alert('Пожалуйста, войдите в систему');
        return;
    }

    const subject = document.getElementById('support-subject').value;
    const message = document.getElementById('support-message').value.trim();

    if (!message) {
        alert('Введите сообщение');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/support/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: this.state.user.id,
                subject,
                message
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Сообщение отправлено! Мы ответим вам как можно скорее.');
            document.getElementById('support-message').value = '';
            this.loadUserTickets();
        } else {
            alert('Ошибка: ' + data.error);
        }
    } catch (error) {
        console.error('Support error:', error);
        alert('Ошибка отправки сообщения');
    }
};

app.loadUserTickets = async function () {
    if (!this.state.user) return;

    const container = document.getElementById('user-tickets');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/support/user/${this.state.user.id}`);
        const data = await response.json();

        if (data.success && data.tickets.length > 0) {
            container.innerHTML = `
                <h3 style="margin-bottom: 15px;">Мои обращения</h3>
                ${data.tickets.map(ticket => {
                const statusColors = {
                    'open': '#eab308',
                    'answered': '#22c55e',
                    'closed': '#6b7280'
                };
                const statusText = {
                    'open': 'Ожидает ответа',
                    'answered': 'Есть ответ',
                    'closed': 'Закрыто'
                };
                const date = new Date(ticket.createdAt).toLocaleDateString('ru-RU');

                return `
                        <div class="card" style="margin-bottom: 12px; border-left: 3px solid ${statusColors[ticket.status]};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <strong style="font-size: 0.95rem;">${ticket.subject}</strong>
                                <span style="font-size: 0.8rem; color: ${statusColors[ticket.status]};">${statusText[ticket.status]}</span>
                            </div>
                            <p class="text-dim" style="font-size: 0.9rem; margin-bottom: 10px;">${ticket.message}</p>
                            <div class="text-dim" style="font-size: 0.75rem;">📅 ${date}</div>
                            
                            ${ticket.adminReply ? `
                                <div style="margin-top: 15px; padding: 12px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border-left: 3px solid #22c55e;">
                                    <div style="font-size: 0.8rem; color: #22c55e; margin-bottom: 5px;">💬 Ответ поддержки:</div>
                                    <p style="font-size: 0.9rem; margin: 0;">${ticket.adminReply}</p>
                                </div>
                            ` : ''}
                        </div>
                    `;
            }).join('')}
            `;
        } else {
            container.innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
};

