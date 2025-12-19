const API_URL = 'https://www.ai-photo.kz/admin';

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
                'pending': 'Ожидает оплаты',
                'paid': 'Оплачено',
                'confirmed': 'Подтверждено',
                'rejected': 'Отклонено'
            }[payment.status];

            return `
                <div class="payment-card">
                    <div class="payment-header">
                        <div>
                            <div style="font-weight: 600;">${user.name}</div>
                            <div class="text-dim" style="font-size: 13px;">${user.email}</div>
                        </div>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="payment-info">
                        <div>
                            <div class="text-dim" style="font-size: 12px;">Сумма</div>
                            <div style="font-weight: 600;">${payment.amount}₸</div>
                        </div>
                        <div>
                            <div class="text-dim" style="font-size: 12px;">Кристаллы</div>
                            <div style="font-weight: 600;">💎 ${payment.crystals}</div>
                        </div>
                        <div>
                            <div class="text-dim" style="font-size: 12px;">Kaspi номер</div>
                            <div style="font-weight: 600;">${payment.kaspiPhone}</div>
                        </div>
                        <div>
                            <div class="text-dim" style="font-size: 12px;">Дата</div>
                            <div style="font-weight: 600;">${new Date(payment.createdAt).toLocaleDateString('ru')}</div>
                        </div>
                    </div>
                    ${payment.status === 'paid' ? `
                        <div class="payment-actions">
                            <button class="btn btn-success" onclick="adminApp.confirmPayment('${payment._id}')">
                                ✓ Подтвердить
                            </button>
                            <button class="btn btn-danger" onclick="adminApp.rejectPayment('${payment._id}')">
                                ✗ Отклонить
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
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
        event.target.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');

        // Load data
        if (tabName === 'payments') {
            this.loadPayments();
        } else if (tabName === 'users') {
            this.loadUsers();
        }
    }
};

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    adminApp.init();
});
