const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : '/api';

const adminApp = {
    admin: null,

    init() {
        // Check if already logged in
        const adminData = localStorage.getItem('admin');
        if (adminData) {
            this.admin = JSON.parse(adminData);
            this.showDashboard();
        }

        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Template form
        const tplForm = document.getElementById('template-form');
        if (tplForm) {
            tplForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addTemplate();
            });
        }
    },

    async login() {
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;

        try {
            const response = await fetch(`${API_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.admin = data.admin;
                localStorage.setItem('admin', JSON.stringify(data.admin));
                this.showDashboard();
            } else {
                alert('Неверный email или пароль');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Ошибка входа');
        }
    },

    logout() {
        localStorage.removeItem('admin');
        this.admin = null;
        location.reload();
    },

    showDashboard() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        this.loadStats();
        this.loadPayments();
        this.loadAdminTemplates();
    },

    async loadStats() {
        try {
            const response = await fetch(`${API_URL}/admin/stats`);
            const data = await response.json();

            if (data.success) {
                const stats = data.stats;
                document.getElementById('stat-users').textContent = stats.totalUsers;
                document.getElementById('stat-crystals').textContent = stats.totalCrystalsSold;
                document.getElementById('stat-revenue').textContent = stats.totalRevenue.toLocaleString() + '₸';
                document.getElementById('stat-pending').textContent = stats.pendingPayments + stats.paidPayments;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    },

    async loadPayments() {
        try {
            const response = await fetch(`${API_URL}/admin/payments`);
            const data = await response.json();

            if (data.success) {
                this.displayPayments(data.payments);
            }
        } catch (error) {
            console.error('Error loading payments:', error);
        }
    },

    displayPayments(payments) {
        const container = document.getElementById('payments-list');

        if (payments.length === 0) {
            container.innerHTML = '<p class="text-dim">Нет платежей</p>';
            return;
        }

        container.innerHTML = payments.map(payment => {
            const user = payment.userId;
            const statusClass = `status-${payment.status}`;
            const statusText = {
                'pending': 'Ожидает отправки счета',
                'paid': 'Оплачено - требуется проверка',
                'confirmed': 'Подтверждено',
                'rejected': 'Отклонено'
            }[payment.status];

            const createdDate = new Date(payment.createdAt);
            const timeAgo = this.getTimeAgo(createdDate);

            return `
                <div class="payment-card" style="${payment.status === 'pending' ? 'border-left: 4px solid #eab308;' : payment.status === 'paid' ? 'border-left: 4px solid #22c55e;' : ''}">
                    <div class="payment-header">
                        <div>
                            <div style="font-weight: 600; font-size: 16px;">${user.name}</div>
                            <div class="text-dim" style="font-size: 13px;">${user.email}</div>
                        </div>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>

                    <div class="payment-info" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));">
                        <div>
                            <div class="text-dim" style="font-size: 12px;">💰 Сумма</div>
                            <div style="font-weight: 700; font-size: 18px; color: #22c55e;">${payment.amount}₸</div>
                        </div>
                        <div>
                            <div class="text-dim" style="font-size: 12px;">💎 Кристаллы</div>
                            <div style="font-weight: 700; font-size: 18px;">${payment.crystals}</div>
                        </div>
                        <div>
                            <div class="text-dim" style="font-size: 12px;">📱 Kaspi номер</div>
                            <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                ${payment.kaspiPhone}
                                <button onclick="adminApp.copyToClipboard('${payment.kaspiPhone}')" style="background: #333; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;" title="Скопировать">📋</button>
                            </div>
                        </div>
                        <div>
                            <div class="text-dim" style="font-size: 12px;">👤 Имя в Kaspi</div>
                            <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                ${payment.kaspiName || 'Не указано'}
                                <button onclick="adminApp.copyToClipboard('${payment.kaspiName}')" style="background: #333; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;" title="Скопировать">📋</button>
                            </div>
                        </div>
                        <div>
                            <div class="text-dim" style="font-size: 12px;">🕒 Создан</div>
                            <div style="font-weight: 600;">${timeAgo}</div>
                        </div>
                    </div>

                    ${payment.status === 'pending' ? `
                        <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 12px; margin-top: 15px;">
                            <p class="text-dim" style="font-size: 13px; margin: 0;">
                                ⚠️ <strong>Действие:</strong> Отправьте счет Kaspi на номер <strong>${payment.kaspiPhone}</strong> (имя: ${payment.kaspiName}) на сумму <strong>${payment.amount}₸</strong>
                            </p>
                        </div>
                        <div class="payment-actions" style="margin-top: 15px;">
                            <button class="btn btn-success" onclick="adminApp.markAsSent('${payment._id}')">
                                📨 Счет отправлен (отметить как Paid)
                            </button>
                            <button class="btn btn-danger" onclick="adminApp.rejectPayment('${payment._id}')">
                                ✗ Отклонить
                            </button>
                            <button class="btn btn-danger" style="margin-left: 5px; opacity: 0.8;" onclick="adminApp.deletePayment('${payment._id}')">
                                🗑
                            </button>
                        </div>
                    ` : payment.status === 'paid' ? `
                        <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 12px; margin-top: 15px;">
                            <p class="text-dim" style="font-size: 13px; margin: 0;">
                                ✅ Клиент отметил платеж как оплаченный. Проверьте поступление средств.
                            </p>
                        </div>
                        <div class="payment-actions" style="margin-top: 15px;">
                            <button class="btn btn-success" onclick="adminApp.confirmPayment('${payment._id}')">
                                ✓ Подтвердить и зачислить кристаллы
                            </button>
                            <button class="btn btn-danger" onclick="adminApp.rejectPayment('${payment._id}')">
                                ✗ Отклонить
                            </button>
                        </div>
                    ` : `
                        <div class="payment-actions" style="margin-top: 15px;">
                            <button class="btn btn-danger" style="opacity: 0.7; font-size: 11px;" onclick="adminApp.deletePayment('${payment._id}')">
                                🗑 Удалить навсегда
                            </button>
                        </div>
                    `}
                </div>
            `;
        }).join('');
    },

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        const intervals = {
            'год': 31536000,
            'месяц': 2592000,
            'день': 86400,
            'час': 3600,
            'минуту': 60
        };

        for (const [name, seconds_interval] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / seconds_interval);
            if (interval >= 1) {
                return `${interval} ${name} назад`;
            }
        }
        return 'только что';
    },

    async markAsSent(paymentId) {
        if (!confirm('Вы отправили счет клиенту? Статус изменится на "Оплачено".')) return;

        try {
            const response = await fetch(`${API_URL}/payments/${paymentId}/mark-paid`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                alert('Статус обновлен. Ожидайте подтверждения оплаты от клиента.');
                this.loadStats();
                this.loadPayments();
            }
        } catch (error) {
            console.error('Error marking as sent:', error);
            alert('Ошибка обновления статуса');
        }
    },

    async confirmPayment(paymentId) {
        if (!confirm('Подтвердить платеж и зачислить кристаллы?')) return;

        try {
            const response = await fetch(`${API_URL}/admin/payments/${paymentId}/confirm`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                alert('Платеж подтвержден! Кристаллы зачислены.');
                this.loadStats();
                this.loadPayments();
            }
        } catch (error) {
            console.error('Error confirming payment:', error);
            alert('Ошибка подтверждения');
        }
    },

    async rejectPayment(paymentId) {
        const note = prompt('Причина отклонения (опционально):');
        if (note === null) return;

        try {
            const response = await fetch(`${API_URL}/admin/payments/${paymentId}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note })
            });

            const data = await response.json();

            if (data.success) {
                alert('Платеж отклонен');
                this.loadStats();
                this.loadPayments();
            }
        } catch (error) {
            console.error('Error rejecting payment:', error);
            alert('Ошибка отклонения');
        }
    },

    async deletePayment(paymentId) {
        if (!confirm('!!! ВНИМАНИЕ !!!\nЭта запись о платеже будет удалена НАВСЕГДА.\nОтменить это действие нельзя.')) return;

        try {
            const response = await fetch(`${API_URL}/admin/payments/${paymentId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                alert('Запись удалена');
                this.loadStats();
                this.loadPayments();
            }
        } catch (error) {
            console.error('Error deleting payment:', error);
            alert('Ошибка удаления');
        }
    },

    async loadUsers() {
        try {
            const response = await fetch(`${API_URL}/admin/users`);
            const data = await response.json();

            if (data.success) {
                this.displayUsers(data.users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    },

    displayUsers(users) {
        const container = document.getElementById('users-list');

        container.innerHTML = users.map(user => `
            <div class="user-card">
                <img src="${user.picture}" alt="${user.name}" class="user-avatar">
                <div class="user-info">
                    <div class="user-name">${user.name}</div>
                    <div class="user-email">${user.email}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600;">💎 ${user.credits}</div>
                    <div class="text-dim" style="font-size: 12px;">кристаллов</div>
                </div>
            </div>
        `).join('');
    },

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        // Find the button that was clicked
        if (event && event.target) {
            event.target.classList.add('active');
        }

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');

        // Load data
        if (tabName === 'payments') {
            this.loadPayments();
        } else if (tabName === 'users') {
            this.loadUsers();
        } else if (tabName === 'templates') {
            this.loadAdminTemplates();
        }
    },

    async loadAdminTemplates() {
        try {
            const response = await fetch(`${API_URL}/templates`);
            const data = await response.json();

            if (data.success) {
                this.displayAdminTemplates(data.templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    },

    displayAdminTemplates(templates) {
        const container = document.getElementById('templates-list');
        const datalist = document.getElementById('category-list');

        // Populate category datalist
        if (datalist) {
            const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];
            datalist.innerHTML = categories.map(cat => `<option value="${cat}">`).join('');
        }

        if (templates.length === 0) {
            container.innerHTML = '<p class="text-dim">Шаблонов пока нет</p>';
            return;
        }

        container.innerHTML = templates.map(tpl => `
            <div class="template-card ${tpl.isHit ? 'hit-card' : ''}">
                <img src="${tpl.imageUrl}" class="template-preview" alt="${tpl.name}">
                <div class="template-content">
                    <div class="template-name">
                        ${tpl.name}
                        ${tpl.isHit ? '<span class="badge-hit">ХИТ</span>' : ''}
                        <div style="font-size: 0.7rem; color: #888;">📁 ${tpl.category || 'General'}</div>
                    </div>
                    <div class="template-prompt">${tpl.prompt}</div>
                    <div class="template-actions">
                        <button class="btn ${tpl.isHit ? 'btn-secondary' : 'btn-success'}" 
                                onclick="adminApp.toggleHit('${tpl._id}')" style="flex: 1; padding: 6px;">
                            ${tpl.isHit ? 'Убрать хит' : 'В ХИТ 🔥'}
                        </button>
                        <button class="btn btn-danger" 
                                onclick="adminApp.deleteTemplate('${tpl._id}')" style="padding: 6px;">
                            Удалить
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    async addTemplate() {
        const btn = event.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;

        const name = document.getElementById('tpl-name').value;
        const promptText = document.getElementById('tpl-prompt').value;
        const fileInput = document.getElementById('tpl-file');
        const category = document.getElementById('tpl-category').value;
        const isHit = document.getElementById('tpl-ishit').checked;

        if (!fileInput.files[0]) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        btn.innerText = 'Загрузка...';
        btn.disabled = true;

        const formData = new FormData();
        formData.append('name', name);
        formData.append('prompt', promptText);
        formData.append('image', fileInput.files[0]);
        formData.append('category', category);
        formData.append('isHit', isHit);

        try {
            const response = await fetch(`${API_URL}/templates`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert('Шаблон добавлен успешно!');
                document.getElementById('template-form').reset();
                this.loadAdminTemplates();
            } else {
                alert('Ошибка: ' + data.error);
            }
        } catch (error) {
            console.error('Error adding template:', error);
            alert('Ошибка добавления');
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    async toggleHit(id) {
        try {
            const response = await fetch(`${API_URL}/templates/${id}/hit`, { method: 'PATCH' });
            const data = await response.json();
            if (data.success) {
                this.loadAdminTemplates();
            }
        } catch (error) {
            console.error('Error toggling hit:', error);
        }
    },

    async deleteTemplate(id) {
        if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) return;

        try {
            const response = await fetch(`${API_URL}/templates/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                this.loadAdminTemplates();
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            alert('Ошибка при удалении');
        }
    },

    async cleanupTestData() {
        if (!confirm('Вы уверены, что хотите НАВСЕГДА удалить все тестовые фотографии из базы данных?')) return;

        try {
            const response = await fetch(`${API_URL}/generations/cleanup-test-data`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                alert(`Успешно удалено ${data.deletedCount} тестовых записей.`);
                location.reload(); // Refresh to show empty gallery
            } else {
                alert('Ошибка при очистке: ' + data.error);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
            alert('Сетевая ошибка при очистке');
        }
    },

    // Copy to clipboard utility
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            // Show brief confirmation
            const toast = document.createElement('div');
            toast.textContent = '✓ Скопировано!';
            toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; z-index: 9999; animation: fadeIn 0.3s;';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('Ошибка копирования');
        });
    }
};

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    adminApp.init();
});
