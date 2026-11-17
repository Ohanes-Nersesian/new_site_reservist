<?php
/**
 * RESERVIST — Налаштування сервера (PHP + SQLite)
 * Перед завантаженням на хостинг ukraine.com.ua обов'язково змініть пароль адміністратора та секретний ключ!
 */
return [
    // Логін (email) та пароль для входу в admin.html
    'admin_email' => 'admin@reservist.ua',
    // Можна вказати звичайний пароль або хеш password_hash('...', PASSWORD_DEFAULT)
    'admin_password' => 'Reservist2026!',

    // Секретний ключ для підпису токенів сесії (вкажіть будь-який довгий випадковий рядок)
    'token_secret' => 'change-this-to-a-long-random-secret-key-reservist-2026',
    'token_ttl_seconds' => 60 * 60 * 24 * 7, // 7 днів

    // Шлях до файлу бази SQLite та папки для завантажених фото
    'db_path' => __DIR__ . '/data/reservist.sqlite',
    'upload_dir' => __DIR__ . '/uploads',
    'upload_public_prefix' => 'uploads',

    // (Необов'язково) Сповіщення про нові заявки в Telegram-бот
    // Створіть бота через @BotFather, додайте його в чат/групу і впишіть токен та ID чату:
    'telegram_bot_token' => '',
    'telegram_chat_id' => '',
];
