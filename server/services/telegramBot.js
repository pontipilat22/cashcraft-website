const TelegramBot = require('node-telegram-bot-api');
const Payment = require('../models/Payment');
const User = require('../models/User');

let bot = null;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID; // Ваш ID
// Токен берется из .env
const token = process.env.TELEGRAM_BOT_TOKEN;

const initBot = () => {
    if (!token) {
        console.log('TELEGRAM_BOT_TOKEN not set, skipping bot init');
        return;
    }

    // Создаем бота (polling для простоты, в продакшене лучше webhook, но polling тоже ок для админки)
    try {
        bot = new TelegramBot(token, { polling: true });
        console.log('✅ Telegram Bot started successfully!');

        bot.on('polling_error', (error) => {
            console.error('Telegram Polling Error:', error.code, error.message);
        });
    } catch (error) {
        console.error('❌ Failed to start Telegram Bot:', error);
    }

    // --- КОМАНДЫ ---

    // /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;

        // Проверка на админа
        if (ADMIN_ID && String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '❌ Доступ запрещен. Это бот для администратора.');
            return;
        }

        bot.sendMessage(chatId, `👋 Привет, Админ!

Я помогу обрабатывать заявки на оплату.

📋 *Команды:*
/next - Получить следующую заявку
/queue - Посмотреть очередь заявок

🔔 Уведомления приходят автоматически!`, {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    [{ text: '📥 Следующая заявка' }, { text: '📊 Очередь' }]
                ],
                resize_keyboard: true
            }
        });
    });

    // /next - Главная команда, берет ОДНУ старую заявку
    bot.onText(/\/next|📥 Следующая заявка/, async (msg) => {
        const chatId = msg.chat.id;
        if (ADMIN_ID && String(chatId) !== String(ADMIN_ID)) return;

        await sendNextPayment(chatId);
    });

    // /queue - Показывает статистику очереди
    bot.onText(/\/queue|📊 Очередь/, async (msg) => {
        const chatId = msg.chat.id;
        if (ADMIN_ID && String(chatId) !== String(ADMIN_ID)) return;

        await showQueueStats(chatId);
    });

    // --- ОБРАБОТКА КНОПОК ---
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const messageId = query.message.message_id;

        // data format: "approve_<PAYMENT_ID>", "reject_<PAYMENT_ID>", "mark_sent_<PAYMENT_ID>"

        try {
            if (data.startsWith('approve_')) {
                const paymentId = data.split('_')[1];
                await approvePayment(paymentId, chatId, messageId);
            } else if (data.startsWith('reject_')) {
                const paymentId = data.split('_')[1];
                await rejectPayment(paymentId, chatId, messageId);
            } else if (data.startsWith('mark_sent_')) {
                const paymentId = data.split('_')[2];
                await markAsSent(paymentId, chatId, messageId);
            }
        } catch (error) {
            console.error('Bot Error:', error);
            bot.sendMessage(chatId, '❌ Ошибка при обработке: ' + error.message);
        }

        // Обязательно отвечаем Telegram, что кнопку нажали
        bot.answerCallbackQuery(query.id);
    });
};

// Показать статистику очереди
const showQueueStats = async (chatId) => {
    try {
        const pendingCount = await Payment.countDocuments({ status: 'pending' });
        const paidCount = await Payment.countDocuments({ status: 'paid' });
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const confirmedToday = await Payment.countDocuments({
            status: 'confirmed',
            confirmedAt: { $gte: todayStart }
        });

        const message = `📊 *Очередь заявок*
━━━━━━━━━━━━━━━━━━━
🟡 Ждут счёта: *${pendingCount}*
🟢 Оплачено (проверить): *${paidCount}*
━━━━━━━━━━━━━━━━━━━
✅ Обработано сегодня: *${confirmedToday}*

${pendingCount + paidCount > 0 ? '👉 Нажми /next чтобы обработать' : '🎉 Всё обработано!'}`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Queue stats error:', error);
        bot.sendMessage(chatId, '❌ Ошибка при получении статистики');
    }
};

// Функция отправки следующей заявки
const sendNextPayment = async (chatId) => {
    try {
        // Приоритет: сначала pending (нужен счёт), потом paid (нужна проверка)
        let payment = await Payment.findOne({ status: 'pending' }).sort({ createdAt: 1 });

        if (!payment) {
            payment = await Payment.findOne({ status: 'paid' }).sort({ createdAt: 1 });
        }

        if (!payment) {
            bot.sendMessage(chatId, '🎉 Все заявки обработаны! Новых нет.');
            return;
        }

        await sendPaymentCard(chatId, payment);

    } catch (error) {
        console.error('Error fetching payment:', error);
        bot.sendMessage(chatId, 'Ошибка при поиске заявки.');
    }
};

// Отправить карточку заявки
const sendPaymentCard = async (chatId, payment, messageId = null) => {
    const isPending = payment.status === 'pending';
    const statusIcon = isPending ? '🟡' : '🟢';
    const statusText = isPending ? 'ЖДЁТ СЧЁТА' : 'ОПЛАЧЕНО - ПРОВЕРИТЬ';

    // Формируем сообщение (Mono font for easy copying)
    const message = `
${statusIcon} *${statusText}*
━━━━━━━━━━━━━━━━━━━

👤 Имя: \`${payment.kaspiName}\`
📱 Телефон: \`${payment.kaspiPhone}\`
💵 Сумма: \`${payment.amount}\` ₸
💎 Кристаллов: ${payment.crystals}

📅 Создано: ${new Date(payment.createdAt).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}
    `;

    // Кнопки зависят от статуса
    let buttons;
    if (isPending) {
        buttons = [
            [{ text: '📨 Счёт отправлен', callback_data: `mark_sent_${payment._id}` }],
            [{ text: '❌ Отклонить', callback_data: `reject_${payment._id}` }]
        ];
    } else {
        buttons = [
            [
                { text: '✅ Подтвердить', callback_data: `approve_${payment._id}` },
                { text: '❌ Отклонить', callback_data: `reject_${payment._id}` }
            ]
        ];
    }

    const options = {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    };

    if (messageId) {
        await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, ...options });
    } else {
        await bot.sendMessage(chatId, message, options);
    }
};

// Отметить что счёт отправлен (pending -> paid)
const markAsSent = async (paymentId, chatId, messageId) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
        bot.editMessageText('❌ Заявка не найдена.', { chat_id: chatId, message_id: messageId });
        return;
    }

    if (payment.status !== 'pending') {
        bot.editMessageText(`⚠️ Заявка уже имеет статус: ${payment.status}`, { chat_id: chatId, message_id: messageId });
        return;
    }

    payment.status = 'paid';
    payment.paidAt = new Date();
    await payment.save();

    await bot.editMessageText(
        `📨 *СЧЁТ ОТПРАВЛЕН*\n\n👤 ${payment.kaspiName}\n💵 ${payment.amount}₸\n\n⏳ Ожидаем оплату от клиента...`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );

    // Показать следующую заявку через 1 сек
    setTimeout(() => sendNextPayment(chatId), 1000);
};

// Логика Подтверждения
const approvePayment = async (paymentId, chatId, messageId) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
        bot.editMessageText('❌ Заявка не найдена (возможно, уже удалена).', { chat_id: chatId, message_id: messageId });
        return;
    }

    if (payment.status !== 'paid' && payment.status !== 'pending') {
        bot.editMessageText(`⚠️ Эта заявка уже имеет статус: ${payment.status}`, { chat_id: chatId, message_id: messageId });
        return;
    }

    // 1. Обновляем статус
    payment.status = 'confirmed';
    payment.confirmedAt = new Date();
    await payment.save();

    // 2. Начисляем кристаллы пользователю
    const user = await User.findById(payment.userId);
    if (user) {
        user.credits += payment.crystals;
        await user.save();
        console.log(`Credited ${payment.crystals} to user ${user.email}`);
    }

    // 3. Редактируем сообщение (убираем кнопки, ставим галочку)
    await bot.editMessageText(
        `✅ *ПОДТВЕРЖДЕНО*\n\n👤 ${payment.kaspiName}\n💎 +${payment.crystals} кристаллов\n\n✅ Зачислено!`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );

    // 4. Сразу присылаем следующую! (Фокус-режим)
    setTimeout(() => sendNextPayment(chatId), 1000);
};

// Логика Отклонения
const rejectPayment = async (paymentId, chatId, messageId) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) return;

    payment.status = 'rejected';
    payment.rejectedAt = new Date();
    await payment.save();

    await bot.editMessageText(
        `❌ *ОТКЛОНЕНО*\n\n👤 ${payment.kaspiName}\n💵 ${payment.amount}₸`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );

    // Тоже присылаем следующую
    setTimeout(() => sendNextPayment(chatId), 1000);
};

// Функция для уведомления админа о НОВОЙ заявке (pending - когда пользователь создал заявку)
const notifyAdminNewRequest = async (payment) => {
    if (!bot) {
        console.error('❌ Cannot notify admin: Bot is not initialized');
        return;
    }
    if (!ADMIN_ID) {
        console.error('❌ Cannot notify admin: TELEGRAM_ADMIN_ID is not set');
        return;
    }

    try {
        console.log(`🔔 Sending NEW REQUEST notification to Admin (${ADMIN_ID}) for payment ${payment._id}`);

        const message = `🆕 *НОВАЯ ЗАЯВКА*
━━━━━━━━━━━━━━━━━━━

👤 Имя: \`${payment.kaspiName}\`
📱 Телефон: \`${payment.kaspiPhone}\`
💵 Сумма: \`${payment.amount}\` ₸
💎 Кристаллов: ${payment.crystals}

⚡ *Отправьте счёт на Kaspi!*`;

        await bot.sendMessage(ADMIN_ID, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📨 Счёт отправлен', callback_data: `mark_sent_${payment._id}` }],
                    [{ text: '❌ Отклонить', callback_data: `reject_${payment._id}` }]
                ]
            }
        });
    } catch (e) {
        console.error('❌ Telegram Notification Failed:', e.message);
    }
};

// Функция для уведомления админа о ОПЛАТЕ (когда юзер жмет "Я оплатил")
const notifyAdminNewPayment = async (payment) => {
    if (!bot) {
        console.error('❌ Cannot notify admin: Bot is not initialized');
        return;
    }
    if (!ADMIN_ID) {
        console.error('❌ Cannot notify admin: TELEGRAM_ADMIN_ID is not set');
        return;
    }

    try {
        console.log(`🔔 Sending PAYMENT notification to Admin (${ADMIN_ID}) for payment ${payment._id}`);

        const message = `💰 *КЛИЕНТ ОПЛАТИЛ!*
━━━━━━━━━━━━━━━━━━━

👤 Имя: \`${payment.kaspiName}\`
📱 Телефон: \`${payment.kaspiPhone}\`
💵 Сумма: \`${payment.amount}\` ₸
💎 Кристаллов: ${payment.crystals}

✅ *Проверьте поступление и подтвердите!*`;

        await bot.sendMessage(ADMIN_ID, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Подтвердить', callback_data: `approve_${payment._id}` },
                        { text: '❌ Отклонить', callback_data: `reject_${payment._id}` }
                    ]
                ]
            }
        });
    } catch (e) {
        console.error('❌ Telegram Notification Failed:', e.message);
    }
};

module.exports = { initBot, notifyAdminNewRequest, notifyAdminNewPayment };

