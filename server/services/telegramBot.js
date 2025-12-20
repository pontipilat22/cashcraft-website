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

        bot.sendMessage(chatId, '👋 Привет, Админ!\n\nЯ помогу обрабатывать заявки на выплату.\nНажми /next чтобы получить старейшую заявку.', {
            reply_markup: {
                keyboard: [
                    [{ text: '📥 Обработать следующую (/next)' }]
                ],
                resize_keyboard: true
            }
        });
    });

    // /next - Главная команда, берет ОДНУ старую заявку
    bot.onText(/\/next|📥 Обработать следующую/, async (msg) => {
        const chatId = msg.chat.id;
        if (ADMIN_ID && String(chatId) !== String(ADMIN_ID)) return;

        await sendNextPayment(chatId);
    });

    // --- ОБРАБОТКА КНОПОК ---
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const messageId = query.message.message_id;

        // data format: "approve_<PAYMENT_ID>" or "reject_<PAYMENT_ID>"

        try {
            if (data.startsWith('approve_')) {
                const paymentId = data.split('_')[1];
                await approvePayment(paymentId, chatId, messageId);
            } else if (data.startsWith('reject_')) {
                const paymentId = data.split('_')[1];
                await rejectPayment(paymentId, chatId, messageId);
            }
        } catch (error) {
            console.error('Bot Error:', error);
            bot.sendMessage(chatId, '❌ Ошибка при обработке: ' + error.message);
        }

        // Обязательно отвечаем Telegram, что кнопку нажали
        bot.answerCallbackQuery(query.id);
    });
};

// Функция отправки следующей заявки
const sendNextPayment = async (chatId) => {
    try {
        // Ищем самую старую (сортировка по дате создания) заявку со статусом 'paid'
        // 'paid' означает, что юзер нажал "Я оплатил", но админ еще не подтвердил
        const payment = await Payment.findOne({ status: 'paid' }).sort({ createdAt: 1 });

        if (!payment) {
            bot.sendMessage(chatId, '🎉 Все заявки обработаны! Новых нет.');
            return;
        }

        // Формируем сообщение (Mono font for easy copying)
        const message = `
💰 *Новая заявка*
------------------
👤 Имя: \`${payment.kaspiName}\`
📱 Телефон: \`${payment.kaspiPhone}\`
💸 Сумма: \`${payment.amount}\`
💎 Кристаллов: ${payment.crystals}

ID: \`${payment._id}\`
        `;

        // Отправляем с кнопками
        await bot.sendMessage(chatId, message, {
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

    } catch (error) {
        console.error('Error fetching payment:', error);
        bot.sendMessage(chatId, 'Ошибка при поиске заявки.');
    }
};

// Логика Подтверждения
const approvePayment = async (paymentId, chatId, messageId) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
        bot.editMessageText('❌ Заявка не найдена (возможно, уже удалена).', { chat_id: chatId, message_id: messageId });
        return;
    }

    if (payment.status !== 'paid') {
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
        `✅ **ОБРАБОТАНО: ПОДТВЕРЖДЕНО**\n\n👤 ${payment.kaspiName} (+${payment.crystals} 💎)\n✅ Выполнено!`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );

    // 4. Сразу присылаем следующую! (Фокус-режим)
    setTimeout(() => sendNextPayment(chatId), 1000); // Небольшая задержка для плавности
};

// Логика Отклонения
const rejectPayment = async (paymentId, chatId, messageId) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) return;

    payment.status = 'rejected';
    payment.rejectedAt = new Date();
    await payment.save();

    await bot.editMessageText(
        `❌ **ОБРАБОТАНО: ОТКЛОНЕНО**\n\n👤 ${payment.kaspiName}\n❌ Отказано.`,
        {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );

    // Тоже присылаем следующую
    setTimeout(() => sendNextPayment(chatId), 1000);
};

// Функция для уведомления админа о НОВОЙ заявке (вызывается из index.js, когда юзер жмет "Я оплатил")
const notifyAdminNewPayment = async (payment) => {
    if (!bot) {
        console.error('❌ Cannot notify admin: Bot is not initialized');
        return;
    }
    if (!ADMIN_ID) {
        console.error('❌ Cannot notify admin: TELEGRAM_ADMIN_ID is not set');
        return;
    }

    // Можно просто написать "Поступила новая заявка! Нажми /next"
    // Не присылаем сразу карточку, чтобы не сбивать "очередь", если админ сейчас занят
    try {
        console.log(`🔔 Sending notification to Admin (${ADMIN_ID}) for payment ${payment._id}`);
        await bot.sendMessage(ADMIN_ID, `🔔 *Поступила новая оплата!*\n👤 \`${payment.kaspiName}\` (\`${payment.amount}\` ₸)\n\nНажми /next или кнопку ниже, чтобы обработать.`, {
            parse_mode: 'Markdown'
        });
    } catch (e) {
        console.error('❌ Telegram Notification Failed:', e.message);
    }
};

module.exports = { initBot, notifyAdminNewPayment };
