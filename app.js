const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { Telegraf } = require('telegraf');
const path = require('path');

const app = express();
const port = 3000;

const TOKEN = '7706158048:AAEj7phEO7qaN0fqWrJ8wgIYnYewrcVF1Fk';
const bot = new Telegraf(TOKEN);

const db = new sqlite3.Database('users.db');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

let messageText = `Спасибо за внимание к нашим каналам\\!\n\n[Москва Афиша](https://t.me/+etnuzDVhW2A5NmVi) \\- ваша пригласительная ссылка для вступления в канал «Москва Афиша»\\. Лучшая подборка бесплатных концертов, театров, музеев, ресторанов\\. Самые топовые локации\\!\n\n[Москва Детская](https://t.me/+nmpMGi_rfT05M2Yy) \\- ваша пригласительная ссылка для вступления в канал «Москва Детская»\\. Лучший детский канал о Москве\\. Бесплатные рестораны для детей, концерты, площадки, распродажи со скидкой до 90%\\. Советы врачей и много другого полезного контента для мамочек\\!`;

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

app.post('/broadcast', async (req, res) => {
    const message = req.body.message;

    db.all('SELECT user_id FROM users', async (err, rows) => {
        if (err) {
            res.status(500).send('Database error');
        } else {
            for (const row of rows) {
                try {
                    await bot.telegram.sendMessage(row.user_id, message, { parse_mode: 'MarkdownV2' });
                } catch (error) {
                    console.error(`Error sending message to user ${row.user_id}:`, error);
                }
            }
            res.redirect('/link');
        }
    });
});

app.get('/editMessage', (req, res) => {
    res.render('editMessage', { messageText });
});

app.post('/updateMessage', (req, res) => {
    messageText = req.body.message;
    res.redirect('/editMessage');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});