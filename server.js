const express = require('express');
const puppeteer = require('puppeteer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Логин и пароль из переменных окружения Render
const ATERNOS_LOGIN = process.env.ATERNOS_LOGIN;
const ATERNOS_PASSWORD = process.env.ATERNOS_PASSWORD;

app.get('/', async (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Aternos Server Starter</title>
            <style>
                body { font-family: Arial; background: #1a1a2e; color: #eee; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { background: #16213e; padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 0 30px rgba(0,255,0,0.2); }
                h1 { color: #4ecca3; }
                .status { margin: 20px 0; padding: 15px; border-radius: 10px; background: #0f3460; }
                .ip { font-size: 1.5em; color: #e94560; font-weight: bold; }
                #log { margin-top: 20px; font-family: monospace; font-size: 0.9em; color: #aaa; max-width: 500px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>🎮 TheWorldLand Server</h1>
                <div class="status">
                    <p>IP сервера:</p>
                    <div class="ip">theworldland.aternos.me:17417</div>
                </div>
                <div id="log">Запускаем сервер через Aternos...</div>
            </div>
            <script>
                // Показываем статус запуска
                const log = document.getElementById('log');
                const events = new EventSource('/start-server');
                events.onmessage = (e) => {
                    log.innerHTML += '<br>> ' + e.data;
                };
            </script>
        </body>
        </html>
    `);
    
    // Запускаем сервер в фоне (не блокируем ответ)
    startAternosServer().catch(console.error);
});

// SSE endpoint для логов
app.get('/start-server', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    startAternosServer((msg) => {
        res.write(`data: ${msg}\n\n`);
    }).then(() => {
        res.write(`data: ✅ Сервер запущен!\n\n`);
        res.end();
    }).catch((err) => {
        res.write(`data: ❌ Ошибка: ${err.message}\n\n`);
        res.end();
    });
});

async function startAternosServer(logCallback = () => {}) {
    if (!ATERNOS_LOGIN || !ATERNOS_PASSWORD) {
        throw new Error('ATERNOS_LOGIN и ATERNOS_PASSWORD не заданы в переменных окружения!');
    }

    logCallback('Запускаем браузер...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        logCallback('Открываем aternos.org...');
        
        // Идём на страницу входа
        await page.goto('https://aternos.org/go/', { waitUntil: 'networkidle2' });
        
        // Вводим логин
        logCallback('Вводим логин...');
        await page.type('input[name="user"]', ATERNOS_LOGIN);
        await page.type('input[name="password"]', ATERNOS_PASSWORD);
        
        // Жмём вход
        await page.click('.login-button');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        logCallback('Вошли в аккаунт');
        
        // Ищем кнопку запуска сервера
        // Селекторы могут меняться — проверяй в DevTools Aternos!
        const startBtn = await page.$('.server-start-button, [data-action="start"], .btn-start');
        
        if (startBtn) {
            logCallback('Нажимаем "Start"...');
            await startBtn.click();
            logCallback('Кнопка нажата, ждём запуск...');
            
            // Ждём статус "Online" или таймаут
            await page.waitForFunction(() => {
                return document.body.innerText.includes('Online') || 
                       document.body.innerText.includes('Running');
            }, { timeout: 120000 });
            
            logCallback('Сервер запущен!');
        } else {
            logCallback('Кнопка старта не найдена — возможно сервер уже запущен');
        }
        
    } finally {
        await browser.close();
    }
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
      
