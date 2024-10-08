const { Telegraf } = require('telegraf');
const { Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = '7706158048:AAEj7phEO7qaN0fqWrJ8wgIYnYewrcVF1Fk';
const CHANNEL_ID = -1002364532419;
const ADMIN_ID = 289116384;

const bot = new Telegraf(TOKEN);

let usersStarted = new Set();
let verificationInProgress = new Map();
let isEditingMessage = false;
//let firstMessageText = `Спасибо за внимание к нашим каналам!\n\n[Москва Афиша](https://t.me/+etnuzDVhW2A5NmVi) - ваша пригласительная ссылка для вступления в канал «Москва Афиша». Лучшая подборка бесплатных концертов, театров, музеев, ресторанов. Самые топовые локации!\n\n[Москва Детская](https://t.me/+nmpMGi_rfT05M2Yy) - ваша пригласительная ссылка для вступления в канал «Москва Детская». Лучший детский канал о Москве. Бесплатные рестораны для детей, концерты, площадки, распродажи со скидкой до 90%. Советы врачей и много другого полезного контента для мамочек!`;

const db = new sqlite3.Database('users.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            user_id INTEGER UNIQUE,
            first_name TEXT,
            last_name TEXT,
            username TEXT
        )
    `);
});

function userHasStarted(userId) {
    return usersStarted.has(userId);
}

function markUserAsStarted(userId) {
    usersStarted.add(userId);
}

function isVerificationInProgress(userId) {
    return verificationInProgress.has(userId);
}

function startVerification(userId) {
    verificationInProgress.set(userId, true);
}

function stopVerification(userId) {
    verificationInProgress.delete(userId);
}

async function sendBroadcast(message) {
    for (const userId of usersStarted) {
        try {
            await bot.telegram.sendMessage(userId, escapeMarkdownV2(message), { parse_mode: 'MarkdownV2' });
        } catch (error) {
            console.error(`Error sending message to user ${userId}:`, error);
        }
    }
}

async function sendFirstMessage(userId) {
  //  const messageText = `Спасибо за внимание к нашим каналам!\n\n[Москва Афиша](https://t.me/+etnuzDVhW2A5NmVi)\n\n - ваша пригласительная ссылка для вступления в канал «Москва Афиша». Лучшая подборка бесплатных концертов, театров, музеев, ресторанов. Самые топовые локации!\n\n[Москва Детская](https://t.me/+nmpMGi_rfT05M2Yy)\n\n - ваша пригласительная ссылка для вступления в канал «Москва Детская». Лучший детский канал о Москве. Бесплатные рестораны для детей, концерты, площадки, распродажи со скидкой до 90%. Советы врачей и много другого полезного контента для мамочек!`;
    try {
        await bot.telegram.sendMessage(
            userId,
            `Спасибо за внимание к нашим каналам\\!\n\n[Москва Афиша](https://t.me/+etnuzDVhW2A5NmVi) \\- ваша пригласительная ссылка для вступления в канал «Москва Афиша»\\. Лучшая подборка бесплатных концертов, театров, музеев, ресторанов\\. Самые топовые локации\\!\n\n[Москва Детская](https://t.me/+nmpMGi_rfT05M2Yy) \\- ваша пригласительная ссылка для вступления в канал «Москва Детская»\\. Лучший детский канал о Москве\\. Бесплатные рестораны для детей, концерты, площадки, распродажи со скидкой до 90%\\. Советы врачей и много другого полезного контента для мамочек\\!`,
            {
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true
            }

        );
    } catch (error) {
        console.error('Error sending first message:', error);
    }
}

async function sendVerificationMessage(userId) {
    try {
        const msg = await bot.telegram.sendMessage(
            userId,
            'Подтвердите, что Вы человек.',
            Markup.keyboard([['Я человек✅']]).resize().oneTime()
        );

        setTimeout(async () => {
            if (isVerificationInProgress(userId)) {
                try {
                    await bot.telegram.deleteMessage(userId, msg.message_id);
                } catch (error) {
                    console.error(`Error deleting message: ${error.response.description}`); // Ловим ошибку, если не удалось удалить
                }
                await sendVerificationMessage(userId);
            }
        }, 5000);
    } catch (error) {
        console.error('Error sending verification message:', error);
    }
}

bot.on('chat_join_request', async (ctx) => {
    const userId = ctx.update.chat_join_request.from.id;
    try {
        await ctx.telegram.approveChatJoinRequest(CHANNEL_ID, userId, {hide_requester:true});
        await sendFirstMessage(userId);
        startVerification(userId); // Начинаем проверку
        await sendVerificationMessage(userId);
    } catch (error) {
        console.error('Error approving chat join request:', error);
    }
});

// Обработка команды /start
bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    markUserAsStarted(userId);
    await ctx.reply('✅ Подтвердите, что Вы человек.', Markup.keyboard([['Я человек✅']]).resize().oneTime());
});

bot.hears('Я человек✅', async (ctx) => {
    const userId = ctx.from.id;
    markUserAsStarted(userId);
    stopVerification(userId); // Останавливаем проверку

    // Сохраняем данные пользователя в базу данных
    db.run(`
        INSERT OR REPLACE INTO users (user_id, first_name, last_name, username)
        VALUES (?, ?, ?, ?)
    `, [userId, ctx.from.first_name, ctx.from.last_name, ctx.from.username], (err) => {
        if (err) {
            console.error('Error saving user data:', err);
        } else {
            console.log('User data saved:', userId);
        }
    });

    await ctx.reply('✅ Спасибо за подтверждение. Не убирайте этот Бот из диалогов, иначе придется заново проходить процедуру повторной модерации!', Markup.removeKeyboard());
});

bot.command('broadcast', async (ctx) => {
    const userId = ctx.from.id;
    if (userId === ADMIN_ID) {
        const message = ctx.message.text.split(' ').slice(1).join(' '); // Текст после команды
        if (!message) {
            return ctx.reply('Пожалуйста, введите сообщение для рассылки после команды /broadcast.');
        }

        await sendBroadcast(message);
        await ctx.reply('Сообщение успешно отправлено всем пользователям.');
    } else {
        await ctx.reply('Извините, эта команда доступна только администратору.');
    }
});

bot.launch().then(() => {
    console.log('Bot started...');
}).catch((err) => {
    console.error('Error starting bot:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

function escapeMarkdownV2(text) {
    const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    const escapedText = text.split('').map(char =>
        specialChars.includes(char) ? `\\${char}` : char).join('');
    return escapedText;
}