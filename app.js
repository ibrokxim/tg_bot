const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { Telegraf } = require('telegraf');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); // Для обработки загрузки файлов

const app = express();
const port = 3000;

const TOKEN = '7706158048:AAEj7phEO7qaN0fqWrJ8wgIYnYewrcVF1Fk';
const bot = new Telegraf(TOKEN);

const db = new sqlite3.Database('users.db');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Настройка multer для загрузки файлов
const upload = multer({ dest: 'uploads/' });

let messageText = `Спасибо за внимание к нашим каналам\\!\n\n[Москва Афиша](https://t.me/+etnuzDVhW2A5NmVi) \\- ваша пригласительная ссылка для вступления в канал «Москва Афиша»\\. Лучшая подборка бесплатных концертов, театров, музеев, ресторанов\\. Самые топовые локации\\!\n\n[Москва Детская](https://t.me/+nmpMGi_rfT05M2Yy) \\- ваша пригласительная ссылка для вступления в канал «Москва Детская»\\. Лучший детский канал о Москве\\. Бесплатные рестораны для детей, концерты, площадки, распродажи со скидкой до 90%\\. Советы врачей и много другого полезного контента для мамочек\\!`;

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY,
            text TEXT
        )
    `);

    // Проверяем, есть ли уже запись в таблице, если нет, добавляем начальный текст
    db.get('SELECT * FROM messages', (err, row) => {
        if (err) {
            console.error('Error checking messages table:', err);
        } else if (!row) {
            db.run('INSERT INTO messages (text) VALUES (?)', [messageText], (err) => {
                if (err) {
                    console.error('Error inserting initial message:', err);
                }
            });
        }
    });
});

app.get('/', (req, res) => {
    const limit = 25;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    db.all('SELECT COUNT(*) AS total FROM users', (err, countResult) => {
        if (err) {
            res.status(500).send('Database error');
        } else {
            const totalUsers = countResult[0].total;
            const totalPages = Math.ceil(totalUsers / limit);

            db.all(`SELECT * FROM users LIMIT ${limit} OFFSET ${offset}`, (err, rows) => {
                if (err) {
                    res.status(500).send('Database error');
                } else {
                    res.render('users', { users: rows, totalUsers, totalPages, currentPage: page });
                }
            });
        }
    });
});

app.get('/link', (req, res) => {
    res.render('link');
});

app.post('/broadcast', upload.single('photo'), async (req, res) => {
    const message = req.body.message;
    const photoPath = req.file.path;

    db.all('SELECT user_id FROM users', async (err, rows) => {
        if (err) {
            res.status(500).send('Database error');
        } else {
            for (const row of rows) {
                try {
                    await bot.telegram.sendPhoto(row.user_id, { source: photoPath }, { caption: message });
                } catch (error) {
                    console.error(`Error sending message to user ${row.user_id}:`, error);
                }
            }
            // Удаляем загруженный файл после отправки
            fs.unlinkSync(photoPath);
            res.redirect('/link');
        }
    });
});

app.get('/editMessage', (req, res) => {
    db.get('SELECT * FROM messages', (err, row) => {
        if (err) {
            res.status(500).send('Database error');
        } else {
            res.render('editMessage', { messageText: row ? row.text : '' });
        }
    });
});

app.post('/updateMessage', (req, res) => {
    const newMessageText = req.body.message;
    db.run('UPDATE messages SET text = ?', [newMessageText], (err) => {
        if (err) {
            res.status(500).send('Database error');
        } else {
            res.redirect('/editMessage');
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

function escapeMarkdownV2(text) {
    const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    return text.split('').map(char => specialChars.includes(char) ? `\\${char}` : char).join('');
}

async function sendFirstMessage(userId) {
    db.get('SELECT * FROM messages', async (err, row) => {
        if (err) {
            console.error('Error retrieving message from database:', err);
        } else {
            const messageText = row ? row.text : '';
            const escapedMessageText = escapeMarkdownV2(messageText);
            try {
                await bot.telegram.sendMessage(
                    userId,
                    escapedMessageText,
                    {
                        parse_mode: 'MarkdownV2',
                        disable_web_page_preview: true
                    }
                );
            } catch (error) {
                console.error('Error sending first message:', error);
            }
        }
    });
}