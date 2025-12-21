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

                // Sync payments toggle
                const toggle = document.getElementById('payments-enabled-toggle');
                if (toggle) {
                    toggle.checked = stats.paymentsEnabled !== false;
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    },

    // Toggle payments enabled
    async togglePaymentsEnabled() {
        const toggle = document.getElementById('payments-enabled-toggle');
        const enabled = toggle.checked;

        try {
            const response = await fetch(`${API_URL}/admin/settings/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });

            const data = await response.json();

            if (data.success) {
                const status = data.paymentsEnabled ? 'ВКЛЮЧЁН' : 'ВЫКЛЮЧЕН';
                console.log(`[Admin] Payments ${status}`);

                // Show confirmation toast
                const toast = document.createElement('div');
                toast.textContent = data.paymentsEnabled ? '✓ Приём заявок включён' : '⚠️ Приём заявок приостановлен';
                toast.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: ${data.paymentsEnabled ? '#22c55e' : '#eab308'}; color: ${data.paymentsEnabled ? 'white' : 'black'}; padding: 12px 24px; border-radius: 8px; z-index: 9999;`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
            }
        } catch (error) {
            console.error('Toggle payments error:', error);
            // Revert toggle on error
            toggle.checked = !enabled;
            alert('Ошибка изменения настройки');
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
        } else if (tabName === 'support') {
            this.loadSupportTickets();
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
    },

    // Support Ticket Functions
    async loadSupportTickets() {
        try {
            const response = await fetch(`${API_URL}/admin/support`);
            const data = await response.json();

            if (data.success) {
                this.displaySupportTickets(data.tickets);
            }
        } catch (error) {
            console.error('Error loading support tickets:', error);
        }
    },

    displaySupportTickets(tickets) {
        const container = document.getElementById('support-list');

        if (tickets.length === 0) {
            container.innerHTML = '<p class="text-dim">Нет обращений</p>';
            return;
        }

        const statusColors = {
            'open': '#eab308',
            'answered': '#22c55e',
            'closed': '#6b7280'
        };
        const statusText = {
            'open': 'Ожидает ответа',
            'answered': 'Ответ отправлен',
            'closed': 'Закрыто'
        };

        container.innerHTML = tickets.map(ticket => {
            const user = ticket.userId || {};
            const date = new Date(ticket.createdAt).toLocaleString('ru-RU');
            const userId = user._id || '';

            return `
                <div class="payment-card" style="border-left: 4px solid ${statusColors[ticket.status]}; margin-bottom: 15px;">
                    <div class="payment-header">
                        <div>
                            <div style="font-weight: 600;">${user.name || 'Неизвестный'}</div>
                            <div class="text-dim" style="font-size: 12px;">${user.email || ''}</div>
                            <div class="text-dim" style="font-size: 10px; margin-top: 4px;">
                                ID: <code style="background: #333; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${userId}</code>
                                ${user.credits !== undefined ? `<span style="margin-left: 10px;">💎 ${user.credits} кристаллов</span>` : ''}
                            </div>
                        </div>
                        <span style="color: ${statusColors[ticket.status]}; font-size: 0.85rem;">• ${statusText[ticket.status]}</span>
                    </div>

                    <!-- Quick Actions -->
                    ${userId ? `
                        <div style="display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap;">
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <input type="number" id="crystals-${ticket._id}" placeholder="💎" value="100" min="1" 
                                    style="width: 80px; padding: 8px; background: #222; border: 1px solid #333; border-radius: 6px; color: white; text-align: center;">
                                <button class="btn btn-primary" style="padding: 8px 12px; width: auto; font-size: 12px;" 
                                    onclick="adminApp.addCrystals('${userId}', '${ticket._id}')">
                                    💎 Пополнить
                                </button>
                            </div>
                            <button class="btn btn-secondary" style="padding: 8px 12px; width: auto; font-size: 12px;" 
                                onclick="adminApp.showUserPayments('${userId}', '${user.name || 'Пользователь'}')">
                                📋 Заявки на оплату
                            </button>
                        </div>
                    ` : ''}

                    <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <div style="font-weight: 600; margin-bottom: 8px;">${ticket.subject}</div>
                        <p class="text-dim" style="margin: 0;">${ticket.message}</p>
                        <div class="text-dim" style="font-size: 11px; margin-top: 10px;">📅 ${date}</div>
                    </div>

                    ${ticket.adminReply ? `
                        <div style="background: rgba(34, 197, 94, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                            <div style="font-size: 0.8rem; color: #22c55e; margin-bottom: 5px;">✅ Ваш ответ:</div>
                            <p style="margin: 0;">${ticket.adminReply}</p>
                        </div>
                    ` : ''}

                    ${ticket.status === 'open' ? `
                        <div style="margin-top: 15px;">
                            <textarea id="reply-${ticket._id}" rows="3" placeholder="Ваш ответ..." 
                                style="width: 100%; padding: 10px; background: #222; border: 1px solid #333; border-radius: 8px; color: white; resize: vertical; margin-bottom: 10px;"></textarea>
                            <div class="flex gap-2">
                                <button class="btn btn-primary" onclick="adminApp.replySupportTicket('${ticket._id}')">💬 Ответить</button>
                                <button class="btn btn-secondary" onclick="adminApp.closeSupportTicket('${ticket._id}')">✖ Закрыть</button>
                            </div>
                        </div>
                    ` : ticket.status === 'answered' ? `
                        <button class="btn btn-secondary" style="opacity: 0.7;" onclick="adminApp.closeSupportTicket('${ticket._id}')">✖ Закрыть обращение</button>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    async replySupportTicket(ticketId) {
        const textarea = document.getElementById(`reply-${ticketId}`);
        const reply = textarea.value.trim();

        if (!reply) {
            alert('Введите ответ');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/admin/support/${ticketId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reply })
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ Ответ отправлен!');
                this.loadSupportTickets();
            } else {
                alert('Ошибка: ' + data.error);
            }
        } catch (error) {
            console.error('Reply error:', error);
            alert('Ошибка отправки ответа');
        }
    },

    async closeSupportTicket(ticketId) {
        if (!confirm('Закрыть обращение?')) return;

        try {
            const response = await fetch(`${API_URL}/admin/support/${ticketId}/close`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.loadSupportTickets();
            }
        } catch (error) {
            console.error('Close error:', error);
        }
    },

    // Add crystals to user manually
    async addCrystals(userId, ticketId) {
        const input = document.getElementById(`crystals-${ticketId}`);
        const crystals = parseInt(input.value);

        if (!crystals || crystals < 1) {
            alert('Введите количество кристаллов');
            return;
        }

        const reason = prompt('Причина пополнения (для лога):', 'Ручное пополнение - проблема с оплатой');
        if (reason === null) return; // Cancelled

        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/add-crystals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ crystals, reason })
            });

            const data = await response.json();

            if (data.success) {
                alert(`✅ ${data.message}\nНовый баланс: ${data.newBalance} 💎`);
                this.loadSupportTickets(); // Refresh to show updated balance
            } else {
                alert('Ошибка: ' + data.error);
            }
        } catch (error) {
            console.error('Add crystals error:', error);
            alert('Ошибка пополнения');
        }
    },

    // Show user's payment requests
    async showUserPayments(userId, userName) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/payments`);
            const data = await response.json();

            if (!data.success) {
                alert('Ошибка загрузки заявок');
                return;
            }

            // Create modal
            const modal = document.createElement('div');
            modal.id = 'user-payments-modal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 20px;';

            const content = document.createElement('div');
            content.style.cssText = 'background: #1a1a1a; border-radius: 16px; padding: 24px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;';

            const statusColors = {
                'pending': '#eab308',
                'paid': '#22c55e',
                'confirmed': '#22c55e',
                'rejected': '#6b7280'
            };
            const statusLabels = {
                'pending': 'Ожидает счёт',
                'paid': 'Оплачено',
                'confirmed': 'Подтверждено',
                'rejected': 'Отклонено'
            };

            const paymentsHtml = data.payments.length === 0
                ? '<p class="text-dim">Нет заявок на оплату</p>'
                : data.payments.map(p => {
                    const date = new Date(p.createdAt).toLocaleString('ru-RU');
                    return `
                        <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid ${statusColors[p.status]};">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-weight: 600;">💎 ${p.crystals} за ${p.amount}₸</span>
                                <span style="color: ${statusColors[p.status]}; font-size: 0.85rem;">● ${statusLabels[p.status]}</span>
                            </div>
                            <div class="text-dim" style="font-size: 12px;">📱 ${p.kaspiPhone} | ${p.kaspiName || '-'}</div>
                            <div class="text-dim" style="font-size: 11px; margin-top: 5px;">📅 ${date}</div>
                            ${p.status === 'pending' || p.status === 'paid' ? `
                                <button class="btn btn-danger" style="margin-top: 10px; padding: 6px 12px; font-size: 11px; width: auto;" 
                                    onclick="adminApp.deletePaymentFromModal('${p._id}')">
                                    🗑 Удалить заявку
                                </button>
                            ` : ''}
                        </div>
                    `;
                }).join('');

            content.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;">📋 Заявки: ${userName}</h3>
                    <button onclick="document.getElementById('user-payments-modal').remove()" 
                        style="background: none; border: none; color: #999; font-size: 24px; cursor: pointer;">×</button>
                </div>
                <p class="text-dim" style="margin-bottom: 15px; font-size: 12px;">ID: ${userId}</p>
                ${paymentsHtml}
            `;

            modal.appendChild(content);
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
            document.body.appendChild(modal);

        } catch (error) {
            console.error('Show payments error:', error);
            alert('Ошибка загрузки заявок');
        }
    },

    // Delete payment from modal
    async deletePaymentFromModal(paymentId) {
        if (!confirm('Удалить эту заявку на оплату? Это действие необратимо.')) return;

        try {
            const response = await fetch(`${API_URL}/admin/payments/${paymentId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ Заявка удалена');
                document.getElementById('user-payments-modal').remove();
                this.loadSupportTickets();
            } else {
                alert('Ошибка: ' + data.error);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Ошибка удаления');
        }
    }
};

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    adminApp.init();
});
