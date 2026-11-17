<?php
/**
 * RESERVIST — REST API (PHP 8+ / PDO SQLite)
 * Працює на стандартному віртуальному хостингу ukraine.com.ua без сторонніх сервісів.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$config = file_exists(__DIR__ . '/api-config.php')
    ? require __DIR__ . '/api-config.php'
    : [];

$dbPath = $config['db_path'] ?? (__DIR__ . '/data/reservist.sqlite');
$uploadDir = $config['upload_dir'] ?? (__DIR__ . '/uploads');
$uploadPrefix = rtrim((string)($config['upload_public_prefix'] ?? 'uploads'), '/');
$tokenSecret = (string)($config['token_secret'] ?? 'reservist-default-secret');
$tokenTtl = (int)($config['token_ttl_seconds'] ?? 604800);

function jsonResponse($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function errorResponse(string $message, int $status = 400): void {
    jsonResponse(['error' => $message, 'message' => $message], $status);
}

function getRequestBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function createToken(string $email, string $secret, int $ttl): array {
    $expiresAt = time() + $ttl;
    $payload = base64UrlEncode(json_encode(['email' => $email, 'exp' => $expiresAt], JSON_UNESCAPED_UNICODE));
    $sig = base64UrlEncode(hash_hmac('sha256', $payload, $secret, true));
    return ['access_token' => $payload . '.' . $sig, 'expires_at' => $expiresAt];
}

function verifyBearerToken(string $secret): ?array {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$auth && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (!preg_match('/Bearer\s+(.+)/i', $auth, $m)) return null;
    $parts = explode('.', trim($m[1]));
    if (count($parts) !== 2) return null;
    [$payload, $sig] = $parts;
    $expected = base64UrlEncode(hash_hmac('sha256', $payload, $secret, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64UrlDecode($payload), true);
    if (!is_array($data) || empty($data['exp']) || (int)$data['exp'] < time()) return null;
    return $data;
}

function uuid4(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function initDatabase(string $dbPath): PDO {
    $dir = dirname($dbPath);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        errorResponse('Не вдалося створити директорію для бази даних.', 500);
    }
    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL;');
    $pdo->exec('PRAGMA foreign_keys = ON;');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS site_pages (
            slug TEXT PRIMARY KEY,
            name TEXT,
            is_published INTEGER DEFAULT 1,
            seo_title TEXT,
            seo_description TEXT,
            blocks TEXT,
            content TEXT
        );
        CREATE TABLE IF NOT EXISTS site_theme (
            id INTEGER PRIMARY KEY,
            settings TEXT
        );
        CREATE TABLE IF NOT EXISTS directions (
            slug TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            summary TEXT,
            cities TEXT,
            description TEXT,
            faq_text TEXT,
            hero_image_url TEXT,
            seo_title TEXT,
            seo_description TEXT,
            sort_order INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS programs (
            slug TEXT PRIMARY KEY,
            direction_slug TEXT NOT NULL,
            name TEXT NOT NULL,
            duration_label TEXT,
            price_uah INTEGER DEFAULT 0,
            description TEXT,
            specs_text TEXT,
            image_url TEXT,
            sort_order INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS instructors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            callsign TEXT,
            role TEXT,
            bio TEXT,
            photo_url TEXT,
            sort_order INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            author_name TEXT NOT NULL,
            course_name TEXT,
            city TEXT,
            rating INTEGER DEFAULT 5,
            text TEXT NOT NULL,
            sort_order INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            direction_slug TEXT NOT NULL,
            program_slug TEXT,
            title TEXT NOT NULL,
            city TEXT,
            starts_at TEXT NOT NULL,
            price_uah INTEGER,
            venue TEXT,
            is_active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            direction_slug TEXT,
            program_slug TEXT,
            course_title TEXT,
            city TEXT,
            event_id TEXT,
            event_date TEXT,
            name TEXT NOT NULL,
            full_name TEXT,
            phone TEXT NOT NULL,
            promo TEXT,
            promo_code TEXT,
            status TEXT DEFAULT "new",
            caller_name TEXT,
            amount_uah INTEGER DEFAULT 0,
            paid_amount INTEGER DEFAULT 0,
            notes TEXT
        );
        CREATE TABLE IF NOT EXISTS promo_codes (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            discount_type TEXT DEFAULT "percent",
            discount_value REAL DEFAULT 10,
            description TEXT,
            is_active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS sheets_config (
            id INTEGER PRIMARY KEY,
            webhook_url TEXT,
            auto_sync INTEGER DEFAULT 1,
            access_mode TEXT DEFAULT "anyone_edit",
            editor_emails TEXT,
            drive_folder_id TEXT,
            cohort_sheets TEXT
        );
    ');

    seedInitialData($pdo);
    return $pdo;
}

function seedInitialData(PDO $pdo): void {
    $count = (int)$pdo->query('SELECT COUNT(*) FROM directions')->fetchColumn();
    if ($count > 0) return;

    $theme = [
        'colors' => [
            'background' => '#08090B',
            'surface' => '#121315',
            'surfaceRaised' => '#16181C',
            'text' => '#F1F3F7',
            'muted' => '#A3A6A8',
            'brand' => '#B7312C',
            'cta' => '#FF5722',
            'status' => '#10B981',
        ],
        'fonts' => ['heading' => 'Oswald', 'body' => 'system-ui'],
        'show_reviews' => false,
        'contacts' => [
            'phone' => '+380 63 734 33 29',
            'footer_tagline' => 'ПІДГОТОВКА З ПОЗИЦІЄЮ. ПРАКТИКА З ВІДПОВІДАЛЬНІСТЮ.',
            'instagram_url' => 'https://www.instagram.com/reservist.ua',
            'telegram_url' => 'https://t.me/reservist.ua',
        ],
    ];
    $pdo->prepare('INSERT OR IGNORE INTO site_theme (id, settings) VALUES (1, ?)')
        ->execute([json_encode($theme, JSON_UNESCAPED_UNICODE)]);

    $pdo->prepare('INSERT OR IGNORE INTO sheets_config (id, webhook_url, auto_sync, access_mode, editor_emails, drive_folder_id, cohort_sheets) VALUES (1, "", 1, "anyone_edit", "", "", "{}")')
        ->execute();

    $dirs = [
        ['carbine', 'КАРАБІН', '3 рівні серії · окремі формати', 'Київ, Львів, Дніпро', '', '', null, 'Карабін — RESERVIST', 'Трирівнева серія «Карабін» для цивільних та окремі формати RESERVIST.', 1, 1],
        ['medicine', 'ТАКТИЧНА МЕДИЦИНА', 'TCCC-ASM · 2 дні / симуляція · 1 день', 'Київ, Львів', '', '', null, 'Тактична медицина — RESERVIST', 'Тактична медицина — програми, тривалість і вартість RESERVIST.', 2, 1],
        ['bootcamp', 'BOOTCAMP', 'Польовий вишкіл · 48 годин', 'Київська область', '', '', null, 'Bootcamp — RESERVIST', 'Дводенний Bootcamp RESERVIST: два рівні польового навчання для цивільних.', 3, 1],
        ['pistol', 'КУРС ПІСТОЛЕТ', '2 етапи · перше заняття 6–8 годин', 'Київ', '', '', null, 'Базовий курс пістолета — RESERVIST', 'Базовий курс стрільби з пістолета RESERVIST.', 4, 1],
        ['open-storm', 'OPEN STORM BATTLE', 'Страйкбольна гра-вишкіл · 1 день · 4 пакети', 'Львів', '', '', null, 'Open Storm Battle — RESERVIST', 'Одноденна командна страйкбольна гра-вишкіл Open Storm Battle.', 5, 1],
        ['killhouse-cqb', 'KILLHOUSE CQB', 'Критий комплекс · групове заняття · 4–6 годин', 'Київ', '', '', null, 'Killhouse CQB — RESERVIST', 'Killhouse CQB — формат участі та вартість RESERVIST.', 6, 1],
    ];
    $dirStmt = $pdo->prepare('INSERT INTO directions (slug, name, summary, cities, description, faq_text, hero_image_url, seo_title, seo_description, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    foreach ($dirs as $d) $dirStmt->execute($d);

    $progs = [
        ['carbine-1', 'carbine', 'Карабін 1.0', '6 годин', 4950, 'Базова програма для новачків і цивільних: теорія, вправи без пострілів і практика на стрільбищі.', '', null, 1, 1],
        ['carbine-2', 'carbine', 'Карабін 2.0', '5 годин', 5500, 'Наступний рівень серії для військових і власників зброї.', '', null, 2, 1],
        ['carbine-intensive', 'carbine', 'Карабін Інтенсив', '5 годин', 5950, 'Завершальний рівень серії з практичними Pro-вправами.', '', null, 3, 1],
        ['cqb-intensive', 'carbine', 'CQB Інтенсив', '8 годин', 6500, 'Окремий інтенсив із ближнього бою в приміщенні.', '', null, 4, 1],
        ['anti-drone', 'carbine', 'Курс Антидрон', '5 годин', 4800, 'Спеціалізований курс із протидії загрозам від безпілотників.', '', null, 5, 1],
        ['night-shooting', 'carbine', 'Нічні стрільби', '4 години', 7500, 'Практичне заняття зі стрільби у вечірній час.', '', null, 6, 1],
        ['tccc-asm', 'medicine', 'Дводенний TCCC-ASM', '2 дні · без ночівлі', 4200, 'Базовий повний курс тактичної медицини: теорія та практика.', '', null, 1, 1],
        ['medicine-simulation', 'medicine', 'ТакМед Симуляція', '1 день', 2500, 'Одноденний практичний формат для учасників із досвідом.', '', null, 2, 1],
        ['bootcamp-1', 'bootcamp', 'BootCamp 1.0', '2 дні', 6500, 'Дводенна програма для новачків і цивільних без попереднього досвіду.', '', null, 1, 1],
        ['bootcamp-2', 'bootcamp', 'BootCamp 2.0', '2 дні', 7500, 'Продовження польового вишколу для випускників першого рівня.', '', null, 2, 1],
        ['pistol-1', 'pistol', 'Базовий курс пістолета', '2 етапи · 6–8 годин', 6000, 'Поступове знайомство з короткоствольною зброєю: теорія, холощення та полігон.', '', null, 1, 1],
        ['storm-own', 'open-storm', 'Квиток — власне спорядження', '1 день', 1000, 'Для тих, хто приїжджає зі своїм повним комплектом для гри.', '', null, 1, 1],
        ['storm-minimum', 'open-storm', 'Мінімум — базове спорядження без форми', '1 день', 2000, 'Квиток, привід AK/AR, магазин, кульки, ремінь, варбелт, окуляри та маска.', '', null, 2, 1],
        ['storm-optimal', 'open-storm', 'Оптимальний — базове спорядження, форма й захист', '1 день', 2350, 'Базове спорядження доповнено прокатною формою та захистом колін і ліктів.', '', null, 3, 1],
        ['storm-maximum', 'open-storm', 'Максимум — повний комплект зі шоломом', '1 день', 2700, 'Повний комплект включно з плитоноскою та шоломом.', '', null, 4, 1],
        ['cqb-optimal', 'killhouse-cqb', 'Пакет Оптимальний CQB', '4–6 годин', 1500, 'Групове навчання у критому комплексі з рухомими перегородками.', '', null, 1, 1],
    ];
    $progStmt = $pdo->prepare('INSERT INTO programs (slug, direction_slug, name, duration_label, price_uah, description, specs_text, image_url, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?,?,?)');
    foreach ($progs as $p) $progStmt->execute($p);

    $insts = [
        ['inst-1', 'ОЛЕКСІЙ', 'ПСИХОЛОГ', 'ІНСТРУКТОР · ВЕТЕРАН «АЗОВУ»', 'Навчає тактичної взаємодії малих груп.', null, 1, 1],
        ['inst-2', 'ВІТАЛІЙ', 'БОЙКО', 'ГОЛОВНИЙ ІНСТРУКТОР · ВЕТЕРАН «АЗОВУ»', 'Відповідає за вогневу підготовку та навчання безпечного володіння зброєю.', null, 2, 1],
        ['inst-3', 'ТЕХНО', '', 'ІНСТРУКТОР З ВОГНЕВОЇ ПІДГОТОВКИ', 'Допомагає цивільним опановувати військову справу.', null, 3, 1],
    ];
    $instStmt = $pdo->prepare('INSERT INTO instructors (id, name, callsign, role, bio, photo_url, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?)');
    foreach ($insts as $i) $instStmt->execute($i);

    $revs = [
        ['rev-1', 'Олександр К.', 'Карабін 1.0', 'Київ', 5, 'Прийшов взагалі без досвіду. Інструктори дуже чітко пояснюють базу безпеки та стійки, жодного хаосу. Рекомендую кожному цивільному.', 1, 0],
        ['rev-2', 'Ірина М.', 'Дводенний TCCC-ASM', 'Львів', 5, 'Два дні максимальної практики. Відпрацювали турнікети й тампонаду до автоматизму, а симуляції наприкінці реально закріплюють навички.', 2, 0],
        ['rev-3', 'Дмитро В.', 'BootCamp 1.0', 'Київська область', 5, 'Потужне занурення на 48 годин. Крута організація, інструктори з бойовим досвідом і командна робота, яка реально змінює мислення.', 3, 0],
    ];
    $revStmt = $pdo->prepare('INSERT INTO reviews (id, author_name, course_name, city, rating, text, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?)');
    foreach ($revs as $r) $revStmt->execute($r);

    $sat = strtotime('next Saturday');
    $evStmt = $pdo->prepare('INSERT INTO events (id, direction_slug, program_slug, title, city, starts_at, price_uah, venue, is_active) VALUES (?,?,?,?,?,?,?,?,?)');
    $evStmt->execute(['ev-1', 'carbine', 'carbine-1', 'Карабін 1.0', 'Київ', date('Y-m-d', $sat) . 'T09:00:00', 4950, 'Полігон (підтверджується)', 1]);
    $evStmt->execute(['ev-2', 'medicine', 'tccc-asm', 'Дводенний TCCC-ASM', 'Київ', date('Y-m-d', $sat + 86400) . 'T09:00:00', 4200, 'Навчальний центр', 1]);
    $evStmt->execute(['ev-3', 'bootcamp', 'bootcamp-1', 'BootCamp 1.0', 'Київська область', date('Y-m-d', $sat + 7 * 86400) . 'T07:50:00', 6500, 'Виїзна локація', 1]);
    $evStmt->execute(['ev-4', 'open-storm', 'storm-optimal', 'Open Storm Battle', 'Львів', date('Y-m-d', $sat + 8 * 86400) . 'T10:00:00', 2350, 'Львів · полігон', 1]);

    $promoStmt = $pdo->prepare('INSERT INTO promo_codes (id, code, discount_type, discount_value, description, is_active) VALUES (?,?,?,?,?,?)');
    $promoStmt->execute(['promo-1', 'RESERVIST10', 'percent', 10, 'Базова знижка 10% для підписників', 1]);
    $promoStmt->execute(['promo-2', 'AZOV10', 'percent', 10, 'Партнерська знижка 10%', 1]);
    $promoStmt->execute(['promo-3', 'STRIKE300', 'fixed', 300, 'Знижка 300 ₴ на страйкбольні ігри', 1]);
}

$action = (string)($_GET['action'] ?? '');

if ($action === 'ping') {
    jsonResponse(['ok' => true, 'backend' => 'php-sqlite']);
}

$pdo = initDatabase($dbPath);
$adminPayload = verifyBearerToken($tokenSecret);
$isAdmin = $adminPayload !== null;

if ($action === 'login') {
    $body = getRequestBody();
    $email = trim((string)($body['email'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $cfgEmail = (string)($config['admin_email'] ?? '');
    $cfgPass = (string)($config['admin_password'] ?? '');
    $passOk = str_starts_with($cfgPass, '$2y$') || str_starts_with($cfgPass, '$argon2')
        ? password_verify($password, $cfgPass)
        : hash_equals($cfgPass, $password);
    if (!$email || !hash_equals(strtolower($cfgEmail), strtolower($email)) || !$passOk) {
        errorResponse('Невірний email або пароль адміністратора.', 401);
    }
    $tok = createToken($cfgEmail, $tokenSecret, $tokenTtl);
    jsonResponse([
        'access_token' => $tok['access_token'],
        'expires_at' => $tok['expires_at'],
        'user' => ['email' => $cfgEmail],
    ]);
}

if ($action === 'is_admin') {
    jsonResponse(['is_admin' => $isAdmin]);
}

if ($action === 'is_site_page_published') {
    $slug = (string)($_GET['slug'] ?? '');
    $stmt = $pdo->prepare('SELECT is_published FROM site_pages WHERE slug = ? LIMIT 1');
    $stmt->execute([$slug]);
    $row = $stmt->fetch();
    jsonResponse(['published' => $row ? ((int)$row['is_published'] !== 0) : true]);
}

const ALLOWED_TABLES = [
    'site_pages' => ['pk' => 'slug', 'bools' => ['is_published'], 'json' => ['blocks', 'content'], 'adminOnly' => false],
    'site_theme' => ['pk' => 'id', 'bools' => [], 'json' => ['settings'], 'adminOnly' => false],
    'directions' => ['pk' => 'slug', 'bools' => ['is_active'], 'json' => [], 'adminOnly' => false],
    'programs' => ['pk' => 'slug', 'bools' => ['is_active'], 'json' => [], 'adminOnly' => false],
    'instructors' => ['pk' => 'id', 'bools' => ['is_active'], 'json' => [], 'adminOnly' => false],
    'reviews' => ['pk' => 'id', 'bools' => ['is_active'], 'json' => [], 'adminOnly' => false],
    'events' => ['pk' => 'id', 'bools' => ['is_active'], 'json' => [], 'adminOnly' => false],
    'applications' => ['pk' => 'id', 'bools' => [], 'json' => [], 'adminOnly' => true],
    'promo_codes' => ['pk' => 'id', 'bools' => ['is_active'], 'json' => [], 'adminOnly' => false],
    'sheets_config' => ['pk' => 'id', 'bools' => ['auto_sync'], 'json' => ['cohort_sheets'], 'adminOnly' => true],
];

function decodeRow(array $row, array $meta): array {
    foreach ($meta['bools'] as $b) {
        if (array_key_exists($b, $row)) $row[$b] = ((int)$row[$b]) !== 0;
    }
    foreach ($meta['json'] as $j) {
        if (array_key_exists($j, $row) && is_string($row[$j]) && $row[$j] !== '') {
            $decoded = json_decode($row[$j], true);
            $row[$j] = $decoded !== null ? $decoded : null;
        }
    }
    if (array_key_exists('id', $row) && $meta['pk'] === 'id' && $row['id'] === 1 && $meta['json'] === ['settings']) {
        $row['id'] = true;
    }
    if (array_key_exists('id', $row) && $meta['json'] === ['cohort_sheets']) {
        $row['id'] = true;
    }
    if (isset($row['sort_order'])) $row['sort_order'] = (int)$row['sort_order'];
    if (isset($row['rating'])) $row['rating'] = (int)$row['rating'];
    if (isset($row['price_uah']) && $row['price_uah'] !== null) $row['price_uah'] = (int)$row['price_uah'];
    if (isset($row['amount_uah'])) $row['amount_uah'] = (int)$row['amount_uah'];
    if (isset($row['paid_amount'])) $row['paid_amount'] = (int)$row['paid_amount'];
    return $row;
}

function encodeValue($val, string $col, array $meta) {
    if ($col === 'id' && is_bool($val)) return $val ? 1 : 0;
    if (in_array($col, $meta['bools'], true)) return $val ? 1 : 0;
    if (in_array($col, $meta['json'], true)) return json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return $val;
}

function sendTelegramNotification(array $config, array $app): void {
    $token = trim((string)($config['telegram_bot_token'] ?? ''));
    $chatId = trim((string)($config['telegram_chat_id'] ?? ''));
    if (!$token || !$chatId) return;

    $lines = [
        "🆕 <b>Нова заявка RESERVIST</b>",
        "👤 <b>Ім'я:</b> " . htmlspecialchars((string)($app['name'] ?? ''), ENT_QUOTES, 'UTF-8'),
        "📞 <b>Телефон:</b> " . htmlspecialchars((string)($app['phone'] ?? ''), ENT_QUOTES, 'UTF-8'),
        "🎯 <b>Курс:</b> " . htmlspecialchars((string)($app['course_title'] ?? $app['direction_slug'] ?? ''), ENT_QUOTES, 'UTF-8'),
        "📍 <b>Місто:</b> " . htmlspecialchars((string)($app['city'] ?? 'Уточнюється'), ENT_QUOTES, 'UTF-8'),
    ];
    if (!empty($app['event_date'])) {
        $lines[] = "📅 <b>Дата:</b> " . htmlspecialchars((string)$app['event_date'], ENT_QUOTES, 'UTF-8');
    }
    if (!empty($app['amount_uah'])) {
        $lines[] = "💰 <b>Сума:</b> " . (int)$app['amount_uah'] . " ₴";
    }
    if (!empty($app['notes'])) {
        $lines[] = "📝 <b>Примітка:</b> " . htmlspecialchars((string)$app['notes'], ENT_QUOTES, 'UTF-8');
    }

    $url = "https://api.telegram.org/bot{$token}/sendMessage";
    postJsonNonBlocking($url, ['chat_id' => $chatId, 'text' => implode("\n", $lines), 'parse_mode' => 'HTML']);
}

function postJsonNonBlocking(string $url, array $payload): void {
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 4,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        @curl_exec($ch);
        @curl_close($ch);
    } else {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $json,
                'timeout' => 4,
            ],
        ]);
        @file_get_contents($url, false, $ctx);
    }
}

if ($action === 'select') {
    $table = (string)($_GET['table'] ?? '');
    if (!isset(ALLOWED_TABLES[$table])) errorResponse('Невідома таблиця.', 400);
    $meta = ALLOWED_TABLES[$table];
    if ($meta['adminOnly'] && !$isAdmin) errorResponse('Необхідна авторизація адміністратора.', 401);

    $colsStmt = $pdo->query("PRAGMA table_info({$table})");
    $validCols = array_column($colsStmt->fetchAll(), 'name');

    $where = [];
    $params = [];
    if (!$isAdmin) {
        if (in_array('is_active', $validCols, true)) $where[] = 'is_active = 1';
        if ($table === 'site_pages') $where[] = 'is_published = 1';
    }
    foreach ($_GET as $k => $v) {
        if (in_array($k, ['action', 'table', 'order', 'limit', 'select'], true)) continue;
        if (in_array($k, $validCols, true) && is_string($v) && str_starts_with($v, 'eq.')) {
            $target = substr($v, 3);
            if ($target === 'true') $target = '1';
            elseif ($target === 'false') $target = '0';
            $where[] = "{$k} = ?";
            $params[] = $target;
        }
    }

    $sql = "SELECT * FROM {$table}";
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    if (!empty($_GET['order']) && is_string($_GET['order'])) {
        [$orderCol, $orderDir] = array_pad(explode('.', $_GET['order']), 2, 'asc');
        if (in_array($orderCol, $validCols, true)) {
            $dir = strtolower($orderDir) === 'desc' ? 'DESC' : 'ASC';
            $sql .= " ORDER BY {$orderCol} {$dir}";
        }
    }
    if (!empty($_GET['limit']) && is_numeric($_GET['limit'])) {
        $sql .= ' LIMIT ' . max(1, min(1000, (int)$_GET['limit']));
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = array_map(fn($r) => decodeRow($r, $meta), $stmt->fetchAll());
    jsonResponse($rows);
}

if ($action === 'insert') {
    $table = (string)($_GET['table'] ?? '');
    if (!isset(ALLOWED_TABLES[$table])) errorResponse('Невідома таблиця.', 400);
    $meta = ALLOWED_TABLES[$table];
    $body = getRequestBody();

    // Публічна вставка дозволена ТІЛЬКИ для заявок із сайту
    if (!$isAdmin) {
        if ($table !== 'applications') errorResponse('Необхідна авторизація адміністратора.', 401);
        // Honeypot захист від ботів
        if (!empty($body['_hp']) || !empty($body['website'])) {
            jsonResponse([['id' => uuid4(), 'status' => 'new']]);
        }
        $phoneDigits = preg_replace('/\D/', '', (string)($body['phone'] ?? ''));
        $name = trim((string)($body['name'] ?? $body['full_name'] ?? ''));
        if ($name === '' || strlen($phoneDigits) < 9) {
            errorResponse('Вкажіть коректне ім’я та номер телефону.', 400);
        }
        $body['status'] = 'new'; // Публічно можна створити лише нову заявку
        $body['created_at'] = gmdate('c');
    }

    $colsStmt = $pdo->query("PRAGMA table_info({$table})");
    $validCols = array_column($colsStmt->fetchAll(), 'name');

    if ($meta['pk'] === 'id' && empty($body['id']) && $table !== 'site_theme' && $table !== 'sheets_config') {
        $body['id'] = uuid4();
    }

    $insertCols = [];
    $insertVals = [];
    foreach ($body as $col => $val) {
        if (!in_array($col, $validCols, true)) continue;
        $insertCols[] = $col;
        $insertVals[] = encodeValue($val, $col, $meta);
    }
    if (!$insertCols) errorResponse('Немає даних для збереження.', 400);

    $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
    $sql = "INSERT INTO {$table} (" . implode(',', $insertCols) . ") VALUES ({$placeholders})";
    $pdo->prepare($sql)->execute($insertVals);

    $pkVal = $body[$meta['pk']] ?? $pdo->lastInsertId();
    $sel = $pdo->prepare("SELECT * FROM {$table} WHERE {$meta['pk']} = ? LIMIT 1");
    $sel->execute([encodeValue($pkVal, $meta['pk'], $meta)]);
    $created = $sel->fetch();
    $decoded = $created ? decodeRow($created, $meta) : $body;

    if ($table === 'applications') {
        sendTelegramNotification($config, $decoded);
        // Серверна синхронізація із загальним листом Google Таблиць (якщо вказаний webhook_url)
        $scRow = $pdo->query('SELECT * FROM sheets_config WHERE id = 1 LIMIT 1')->fetch();
        if ($scRow && !empty($scRow['webhook_url'])) {
            postJsonNonBlocking((string)$scRow['webhook_url'], [
                'action' => 'upsert_application',
                'only_create_on_paid' => true,
                'application' => $decoded,
                'timestamp' => gmdate('c'),
            ]);
        }
    }

    jsonResponse([$decoded]);
}

// Усі дії нижче — лише для авторизованого адміністратора
if (!$isAdmin) {
    errorResponse('Необхідна авторизація адміністратора.', 401);
}

if ($action === 'upsert') {
    $table = (string)($_GET['table'] ?? '');
    if (!isset(ALLOWED_TABLES[$table])) errorResponse('Невідома таблиця.', 400);
    $meta = ALLOWED_TABLES[$table];
    $records = getRequestBody();
    if (!isset($records[0]) || !is_array($records[0])) $records = [$records];

    $colsStmt = $pdo->query("PRAGMA table_info({$table})");
    $validCols = array_column($colsStmt->fetchAll(), 'name');
    $pk = $meta['pk'];
    $saved = [];

    foreach ($records as $record) {
        $cols = [];
        $vals = [];
        $updates = [];
        foreach ($record as $col => $val) {
            if (!in_array($col, $validCols, true)) continue;
            $cols[] = $col;
            $vals[] = encodeValue($val, $col, $meta);
            if ($col !== $pk) $updates[] = "{$col} = excluded.{$col}";
        }
        if (!$cols) continue;
        $placeholders = implode(',', array_fill(0, count($cols), '?'));
        $sql = "INSERT INTO {$table} (" . implode(',', $cols) . ") VALUES ({$placeholders})";
        if ($updates) $sql .= " ON CONFLICT({$pk}) DO UPDATE SET " . implode(', ', $updates);
        $pdo->prepare($sql)->execute($vals);

        $pkVal = encodeValue($record[$pk] ?? 1, $pk, $meta);
        $sel = $pdo->prepare("SELECT * FROM {$table} WHERE {$pk} = ? LIMIT 1");
        $sel->execute([$pkVal]);
        if ($row = $sel->fetch()) $saved[] = decodeRow($row, $meta);
    }
    jsonResponse($saved);
}

if ($action === 'update') {
    $table = (string)($_GET['table'] ?? '');
    $key = (string)($_GET['key'] ?? 'id');
    $id = (string)($_GET['id'] ?? '');
    if (!isset(ALLOWED_TABLES[$table])) errorResponse('Невідома таблиця.', 400);
    $meta = ALLOWED_TABLES[$table];
    $body = getRequestBody();

    $colsStmt = $pdo->query("PRAGMA table_info({$table})");
    $validCols = array_column($colsStmt->fetchAll(), 'name');
    if (!in_array($key, $validCols, true)) errorResponse('Некоректний ключ.', 400);

    $sets = [];
    $vals = [];
    foreach ($body as $col => $val) {
        if (!in_array($col, $validCols, true)) continue;
        $sets[] = "{$col} = ?";
        $vals[] = encodeValue($val, $col, $meta);
    }
    if (!$sets) errorResponse('Немає полів для оновлення.', 400);
    $vals[] = $id;
    $pdo->prepare("UPDATE {$table} SET " . implode(', ', $sets) . " WHERE {$key} = ?")->execute($vals);

    if ($table === 'directions' && $key === 'slug' && !empty($body['slug']) && $body['slug'] !== $id) {
        $pdo->prepare('UPDATE programs SET direction_slug = ? WHERE direction_slug = ?')->execute([$body['slug'], $id]);
        $pdo->prepare('UPDATE events SET direction_slug = ? WHERE direction_slug = ?')->execute([$body['slug'], $id]);
    }
    if ($table === 'programs' && $key === 'slug' && !empty($body['slug']) && $body['slug'] !== $id) {
        $pdo->prepare('UPDATE events SET program_slug = ? WHERE program_slug = ?')->execute([$body['slug'], $id]);
    }

    $newId = (string)($body[$key] ?? $id);
    $sel = $pdo->prepare("SELECT * FROM {$table} WHERE {$key} = ? LIMIT 1");
    $sel->execute([$newId]);
    $row = $sel->fetch();
    jsonResponse($row ? [decodeRow($row, $meta)] : []);
}

if ($action === 'remove') {
    $table = (string)($_GET['table'] ?? '');
    $key = (string)($_GET['key'] ?? 'id');
    $id = (string)($_GET['id'] ?? '');
    if (!isset(ALLOWED_TABLES[$table])) errorResponse('Невідома таблиця.', 400);
    $colsStmt = $pdo->query("PRAGMA table_info({$table})");
    $validCols = array_column($colsStmt->fetchAll(), 'name');
    if (!in_array($key, $validCols, true)) errorResponse('Некоректний ключ.', 400);

    $pdo->prepare("DELETE FROM {$table} WHERE {$key} = ?")->execute([$id]);
    jsonResponse(['ok' => true]);
}

if ($action === 'upload_image') {
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        errorResponse('Файл зображення не завантажено.', 400);
    }
    $file = $_FILES['file'];
    if ($file['size'] > 10 * 1024 * 1024) {
        errorResponse('Зображення має бути не більше 10 МБ.', 400);
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $extMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/avif' => 'avif',
    ];
    if (!isset($extMap[$mime])) {
        errorResponse('Підтримуються лише формати JPEG, PNG, WebP або AVIF.', 400);
    }
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        errorResponse('Не вдалося створити папку для завантажень.', 500);
    }
    $filename = uuid4() . '.' . $extMap[$mime];
    $dest = $uploadDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        errorResponse('Не вдалося зберегти файл зображення.', 500);
    }
    jsonResponse(['url' => $uploadPrefix . '/' . $filename]);
}

if ($action === 'sync_sheets') {
    $body = getRequestBody();
    $scRow = $pdo->query('SELECT * FROM sheets_config WHERE id = 1 LIMIT 1')->fetch();
    $webhookUrl = trim((string)($scRow['webhook_url'] ?? ''));
    if ($webhookUrl) {
        postJsonNonBlocking($webhookUrl, $body);
        jsonResponse(['synced' => true]);
    }
    jsonResponse(['synced' => false, 'reason' => 'no_url']);
}

errorResponse('Невідома дія API.', 404);
