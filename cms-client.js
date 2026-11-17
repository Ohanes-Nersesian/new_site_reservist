(() => {
  const config = window.RESERVIST_SUPABASE_CONFIG ?? {};
  const storageKey = "reservist-admin-session";
  const demoStorageKey = "reservist-cms-demo-db-v2";

  const futureDateIso = (daysAhead, time = "09:00") => {
    const now = new Date();
    const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSat + daysAhead);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${time}:00`;
  };

  const defaultDemoData = () => {
    const ev1Date = futureDateIso(0, "09:00");
    const ev2Date = futureDateIso(1, "09:00");
    const ev3Date = futureDateIso(7, "07:50");
    const ev4Date = futureDateIso(8, "10:00");
    const ev5Date = futureDateIso(14, "09:00");
    const ev6Date = futureDateIso(21, "10:00");

    return {
      site_pages: [],
      site_theme: [
        {
          id: true,
          settings: {
            colors: {
              background: "#08090B",
              surface: "#121315",
              surfaceRaised: "#16181C",
              text: "#F1F3F7",
              muted: "#A3A6A8",
              brand: "#B7312C",
              cta: "#FF5722",
              status: "#10B981",
            },
            fonts: {
              heading: "Oswald",
              body: "system-ui",
            },
            show_reviews: false,
            contacts: {
              phone: "+380 63 734 33 29",
              footer_tagline: "ПІДГОТОВКА З ПОЗИЦІЄЮ. ПРАКТИКА З ВІДПОВІДАЛЬНІСТЮ.",
              instagram_url: "https://www.instagram.com/reservist.ua",
              telegram_url: "https://t.me/reservist.ua",
            },
          },
        },
      ],
      directions: [
        { slug: "carbine", name: "КАРАБІН", summary: "3 рівні серії · окремі формати", cities: "Київ, Львів, Дніпро", hero_image_url: null, seo_title: "Карабін — RESERVIST", seo_description: "Трирівнева серія «Карабін» для цивільних та окремі формати RESERVIST.", sort_order: 1, is_active: true },
        { slug: "medicine", name: "ТАКТИЧНА МЕДИЦИНА", summary: "TCCC-ASM · 2 дні / симуляція · 1 день", cities: "Київ, Львів", hero_image_url: null, seo_title: "Тактична медицина — RESERVIST", seo_description: "Тактична медицина — програми, тривалість і вартість RESERVIST.", sort_order: 2, is_active: true },
        { slug: "bootcamp", name: "BOOTCAMP", summary: "Польовий вишкіл · 48 годин", cities: "Київська область", hero_image_url: null, seo_title: "Bootcamp — RESERVIST", seo_description: "Дводенний Bootcamp RESERVIST: два рівні польового навчання для цивільних.", sort_order: 3, is_active: true },
        { slug: "pistol", name: "КУРС ПІСТОЛЕТ", summary: "2 етапи · перше заняття 6–8 годин", cities: "Київ", hero_image_url: null, seo_title: "Базовий курс пістолета — RESERVIST", seo_description: "Базовий курс стрільби з пістолета RESERVIST.", sort_order: 4, is_active: true },
        { slug: "open-storm", name: "OPEN STORM BATTLE", summary: "Страйкбольна гра-вишкіл · 1 день · 4 пакети", cities: "Львів", hero_image_url: null, seo_title: "Open Storm Battle — RESERVIST", seo_description: "Одноденна командна страйкбольна гра-вишкіл Open Storm Battle.", sort_order: 5, is_active: true },
        { slug: "killhouse-cqb", name: "KILLHOUSE CQB", summary: "Критий комплекс · групове заняття · 4–6 годин", cities: "Київ", hero_image_url: null, seo_title: "Killhouse CQB — RESERVIST", seo_description: "Killhouse CQB — формат участі та вартість RESERVIST.", sort_order: 6, is_active: true },
      ],
      programs: [
        { slug: "carbine-1", direction_slug: "carbine", name: "Карабін 1.0", duration_label: "6 годин", price_uah: 4950, description: "Базова програма для новачків і цивільних: теорія, вправи без пострілів і практика на стрільбищі.", image_url: null, sort_order: 1, is_active: true },
        { slug: "carbine-2", direction_slug: "carbine", name: "Карабін 2.0", duration_label: "5 годин", price_uah: 5500, description: "Наступний рівень серії для військових і власників зброї.", image_url: null, sort_order: 2, is_active: true },
        { slug: "carbine-intensive", direction_slug: "carbine", name: "Карабін Інтенсив", duration_label: "5 годин", price_uah: 5950, description: "Завершальний рівень серії з практичними Pro-вправами.", image_url: null, sort_order: 3, is_active: true },
        { slug: "cqb-intensive", direction_slug: "carbine", name: "CQB Інтенсив", duration_label: "8 годин", price_uah: 6500, description: "Окремий інтенсив із ближнього бою в приміщенні.", image_url: null, sort_order: 4, is_active: true },
        { slug: "anti-drone", direction_slug: "carbine", name: "Курс Антидрон", duration_label: "5 годин", price_uah: 4800, description: "Спеціалізований курс із протидії загрозам від безпілотників.", image_url: null, sort_order: 5, is_active: true },
        { slug: "night-shooting", direction_slug: "carbine", name: "Нічні стрільби", duration_label: "4 години", price_uah: 7500, description: "Практичне заняття зі стрільби у вечірній час.", image_url: null, sort_order: 6, is_active: true },
        { slug: "tccc-asm", direction_slug: "medicine", name: "Дводенний TCCC-ASM", duration_label: "2 дні · без ночівлі", price_uah: 4200, description: "Базовий повний курс тактичної медицини: теорія та практика.", image_url: null, sort_order: 1, is_active: true },
        { slug: "medicine-simulation", direction_slug: "medicine", name: "ТакМед Симуляція", duration_label: "1 день", price_uah: 2500, description: "Одноденний практичний формат для учасників із досвідом.", image_url: null, sort_order: 2, is_active: true },
        { slug: "bootcamp-1", direction_slug: "bootcamp", name: "BootCamp 1.0", duration_label: "2 дні", price_uah: 6500, description: "Дводенна програма для новачків і цивільних без попереднього досвіду.", image_url: null, sort_order: 1, is_active: true },
        { slug: "bootcamp-2", direction_slug: "bootcamp", name: "BootCamp 2.0", duration_label: "2 дні", price_uah: 7500, description: "Продовження польового вишколу для випускників першого рівня.", image_url: null, sort_order: 2, is_active: true },
        { slug: "pistol-1", direction_slug: "pistol", name: "Базовий курс пістолета", duration_label: "2 етапи · 6–8 годин", price_uah: 6000, description: "Поступове знайомство з короткоствольною зброєю: теорія, холощення та полігон.", image_url: null, sort_order: 1, is_active: true },
        { slug: "storm-own", direction_slug: "open-storm", name: "Квиток — власне спорядження", duration_label: "1 день", price_uah: 1000, description: "Для тих, хто приїжджає зі своїм повним комплектом для гри.", image_url: null, sort_order: 1, is_active: true },
        { slug: "storm-minimum", direction_slug: "open-storm", name: "Мінімум — базове спорядження без форми", duration_label: "1 день", price_uah: 2000, description: "Квиток, привід AK/AR, магазин, кульки, ремінь, варбелт, окуляри та маска.", image_url: null, sort_order: 2, is_active: true },
        { slug: "storm-optimal", direction_slug: "open-storm", name: "Оптимальний — базове спорядження, форма й захист", duration_label: "1 день", price_uah: 2350, description: "Базове спорядження доповнено прокатною формою та захистом колін і ліктів.", image_url: null, sort_order: 3, is_active: true },
        { slug: "storm-maximum", direction_slug: "open-storm", name: "Максимум — повний комплект зі шоломом", duration_label: "1 день", price_uah: 2700, description: "Повний комплект включно з плитоноскою та шоломом.", image_url: null, sort_order: 4, is_active: true },
        { slug: "cqb-optimal", direction_slug: "killhouse-cqb", name: "Пакет Оптимальний CQB", duration_label: "4–6 годин", price_uah: 1500, description: "Групове навчання у критому комплексі з рухомими перегородками.", image_url: null, sort_order: 1, is_active: true },
      ],
      instructors: [
        { id: "inst-1", name: "ОЛЕКСІЙ", callsign: "ПСИХОЛОГ", role: "ІНСТРУКТОР · ВЕТЕРАН «АЗОВУ»", bio: "Навчає тактичної взаємодії малих груп.", photo_url: null, sort_order: 1, is_active: true },
        { id: "inst-2", name: "ВІТАЛІЙ", callsign: "БОЙКО", role: "ГОЛОВНИЙ ІНСТРУКТОР · ВЕТЕРАН «АЗОВУ»", bio: "Відповідає за вогневу підготовку та навчання безпечного володіння зброєю.", photo_url: null, sort_order: 2, is_active: true },
        { id: "inst-3", name: "ТЕХНО", callsign: "", role: "ІНСТРУКТОР З ВОГНЕВОЇ ПІДГОТОВКИ", bio: "Допомагає цивільним опановувати військову справу.", photo_url: null, sort_order: 3, is_active: true },
      ],
      reviews: [
        { id: "rev-1", author_name: "Олександр К.", course_name: "Карабін 1.0", city: "Київ", rating: 5, text: "Прийшов взагалі без досвіду. Інструктори дуже чітко пояснюють базу безпеки та стійки, жодного хаосу. Рекомендую кожному цивільному.", sort_order: 1, is_active: false },
        { id: "rev-2", author_name: "Ірина М.", course_name: "Дводенний TCCC-ASM", city: "Львів", rating: 5, text: "Два дні максимальної практики. Відпрацювали турнікети й тампонаду до автоматизму, а симуляції наприкінці реально закріплюють навички.", sort_order: 2, is_active: false },
        { id: "rev-3", author_name: "Дмитро В.", course_name: "BootCamp 1.0", city: "Київська область", rating: 5, text: "Потужне занурення на 48 годин. Крута організація, інструктори з бойовим досвідом і командна робота, яка реально змінює мислення.", sort_order: 3, is_active: false },
      ],
      events: [
        { id: "ev-1", direction_slug: "carbine", program_slug: "carbine-1", title: "Карабін 1.0", city: "Київ", starts_at: ev1Date, price_uah: 4950, venue: "Полігон (підтверджується)", is_active: true },
        { id: "ev-2", direction_slug: "medicine", program_slug: "tccc-asm", title: "Дводенний TCCC-ASM", city: "Київ", starts_at: ev2Date, price_uah: 4200, venue: "Навчальний центр", is_active: true },
        { id: "ev-3", direction_slug: "bootcamp", program_slug: "bootcamp-1", title: "BootCamp 1.0", city: "Київська область", starts_at: ev3Date, price_uah: 6500, venue: "Виїзна локація", is_active: true },
        { id: "ev-4", direction_slug: "open-storm", program_slug: "storm-optimal", title: "Open Storm Battle", city: "Львів", starts_at: ev4Date, price_uah: 2350, venue: "Львів · полігон", is_active: true },
        { id: "ev-5", direction_slug: "carbine", program_slug: "carbine-2", title: "Карабін 2.0", city: "Дніпро", starts_at: ev5Date, price_uah: 5500, venue: "Стрільбище Дніпро", is_active: true },
        { id: "ev-6", direction_slug: "killhouse-cqb", program_slug: "cqb-optimal", title: "Пакет Оптимальний CQB", city: "Київ", starts_at: ev6Date, price_uah: 1500, venue: "Критий комплекс Killhouse", is_active: true },
      ],
      applications: [
        { id: "app-101", created_at: new Date(Date.now() - 3600_000 * 5).toISOString(), direction_slug: "carbine", program_slug: "carbine-1", course_title: "Карабін 1.0", city: "Київ", event_id: "ev-1", event_date: ev1Date.slice(0, 10), name: "Олександр Коваленко", phone: "+380 67 412 88 19", promo: "", amount_uah: 4950, status: "new", caller_name: "", notes: "Хоче уточнити, чи потрібен власний шолом" },
        { id: "app-102", created_at: new Date(Date.now() - 3600_000 * 3).toISOString(), direction_slug: "open-storm", program_slug: "storm-optimal", course_title: "Оптимальний — базове спорядження, форма й захист", city: "Львів", event_id: "ev-4", event_date: ev4Date.slice(0, 10), name: "Максим Гриценко", phone: "+380 93 115 40 22", promo: "AZOV10", amount_uah: 2350, status: "calling", caller_name: "Марія (продзвін)", notes: "Передзвонити після 18:00, їде з другом" },
        { id: "app-103", created_at: new Date(Date.now() - 3600_000 * 28).toISOString(), direction_slug: "carbine", program_slug: "carbine-1", course_title: "Карабін 1.0", city: "Київ", event_id: "ev-1", event_date: ev1Date.slice(0, 10), name: "Дмитро Бондаренко", phone: "+380 50 982 31 04", promo: "", amount_uah: 4950, status: "paid", caller_name: "Ігор (продзвін)", notes: "Оплатив на ФОП, квитанція є" },
        { id: "app-104", created_at: new Date(Date.now() - 3600_000 * 24).toISOString(), direction_slug: "carbine", program_slug: "carbine-1", course_title: "Карабін 1.0", city: "Київ", event_id: "ev-1", event_date: ev1Date.slice(0, 10), name: "Артем Савченко", phone: "+380 63 771 90 11", promo: "", amount_uah: 4950, status: "paid", caller_name: "Ігор (продзвін)", notes: "Оплата 100% підтверджена" },
        { id: "app-105", created_at: new Date(Date.now() - 3600_000 * 20).toISOString(), direction_slug: "medicine", program_slug: "tccc-asm", course_title: "Дводенний TCCC-ASM", city: "Київ", event_id: "ev-2", event_date: ev2Date.slice(0, 10), name: "Катерина Мельник", phone: "+380 97 304 55 12", promo: "", amount_uah: 4200, status: "paid", caller_name: "Марія (продзвін)", notes: "Оплачено, додана в групу" },
        { id: "app-106", created_at: new Date(Date.now() - 3600_000 * 16).toISOString(), direction_slug: "bootcamp", program_slug: "bootcamp-1", course_title: "BootCamp 1.0", city: "Київська область", event_id: "ev-3", event_date: ev3Date.slice(0, 10), name: "Владислав Ткачук", phone: "+380 66 519 20 88", promo: "", amount_uah: 6500, status: "paid", caller_name: "Ігор (продзвін)", notes: "Розмір форми L" },
      ],
      sheets_config: [
        {
          id: true,
          webhook_url: "",
          auto_sync: true,
          access_mode: "anyone_edit",
          editor_emails: "",
          drive_folder_id: "",
          cohort_sheets: {},
        },
      ],
      promo_codes: [
        { id: "promo-1", code: "RESERVIST10", discount_type: "percent", discount_value: 10, description: "Базова знижка 10% для підписників", is_active: true },
        { id: "promo-2", code: "AZOV10", discount_type: "percent", discount_value: 10, description: "Партнерська знижка 10%", is_active: true },
        { id: "promo-3", code: "STRIKE300", discount_type: "fixed", discount_value: 300, description: "Знижка 300 ₴ на страйкбольні ігри", is_active: true },
      ],
    };
  };

  const readDemoDb = () => {
    try {
      const raw = localStorage.getItem(demoStorageKey);
      if (!raw) {
        const seed = defaultDemoData();
        localStorage.setItem(demoStorageKey, JSON.stringify(seed));
        return seed;
      }
      const parsed = { ...defaultDemoData(), ...JSON.parse(raw) };
      if (parsed.site_theme?.[0]?.settings?.fonts?.heading === "JetBrains Mono") {
        parsed.site_theme[0].settings.fonts.heading = "Oswald";
      }
      return parsed;
    } catch {
      return defaultDemoData();
    }
  };

  const writeDemoDb = (db) => {
    try {
      localStorage.setItem(demoStorageKey, JSON.stringify(db));
    } catch (error) {
      console.error("Could not write demo DB.", error);
    }
  };

  const getConfig = () => {
    const rawUrl = typeof config.url === "string" ? config.url.trim().replace(/\/+$/, "") : "";
    const anonKey = typeof config.anonKey === "string" ? config.anonKey.trim() : "";
    if (!rawUrl || !anonKey) {
      throw new Error("Supabase is not configured. Add the project URL and public anon key in cms-config.js.");
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error("Supabase URL must be a valid HTTPS URL or a local development URL.");
    }
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname);
    if ((parsedUrl.protocol !== "https:" && !(localHost && parsedUrl.protocol === "http:"))
      || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
      throw new Error("Supabase URL must use HTTPS and cannot include credentials or query parameters.");
    }
    if (anonKey.startsWith("sb_secret_")) {
      throw new Error("Do not use a Supabase secret or service-role key in browser code.");
    }
    try {
      const payload = anonKey.split(".")[1];
      if (payload && JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role") {
        throw new Error("Do not use a Supabase service-role key in browser code.");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("service-role")) throw error;
    }

    return { url: parsedUrl.toString().replace(/\/+$/, ""), anonKey };
  };

  const readSession = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "null");
    } catch (error) {
      console.error("Could not read the admin session.", error);
      return null;
    }
  };

  const writeSession = (session) => {
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
    else localStorage.removeItem(storageKey);
  };

  const responseError = async (response) => {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      message = body.msg || body.message || body.error_description || body.error || message;
    } catch (error) {
      console.error("Could not parse the Supabase error response.", error);
    }
    return new Error(message);
  };

  async function refreshSession() {
    const session = readSession();
    if (!session?.refresh_token) return null;
    const { url, anonKey } = getConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!response.ok) {
      writeSession(null);
      throw await responseError(response);
    }

    const updatedSession = normalizeSession(await response.json());
    writeSession(updatedSession);
    return updatedSession;
  }

  function normalizeSession(session) {
    if (session?.expires_at || !Number.isFinite(session?.expires_in)) return session;
    return { ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in };
  }

  async function accessToken() {
    const session = readSession();
    if (!session?.access_token) return null;
    if (session.expires_at && session.expires_at * 1000 < Date.now() + 30_000) {
      const refreshedSession = await refreshSession();
      if (!refreshedSession?.access_token) {
        writeSession(null);
        throw new Error("The admin session expired. Sign in again.");
      }
      return refreshedSession.access_token;
    }
    return session.access_token;
  }

  const isSupabaseConfigured = () => {
    try {
      getConfig();
      return true;
    } catch {
      return false;
    }
  };

  const resolveApiUrl = () => {
    const base = typeof config.apiUrl === "string" && config.apiUrl.trim() ? config.apiUrl.trim() : "api.php";
    if (/^https?:\/\//i.test(base) || base.startsWith("/")) return base;
    return location.pathname.includes("/directions/") ? `../${base}` : base;
  };

  let phpProbePromise = null;
  const isPhpBackendAvailable = () => {
    if (isSupabaseConfigured() || config.backend === "demo" || location.protocol === "file:") {
      return Promise.resolve(false);
    }
    if (typeof fetch !== "function") return Promise.resolve(false);
    if (!phpProbePromise) {
      phpProbePromise = fetch(`${resolveApiUrl()}?action=ping`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return false;
          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("application/json")) return false;
          const data = await res.json();
          return data?.ok === true && data?.backend === "php-sqlite";
        })
        .catch(() => false);
    }
    return phpProbePromise;
  };

  async function phpRequest(action, params = {}, options = {}) {
    const query = new URLSearchParams({ action, ...params });
    const session = readSession();
    const headers = new Headers(options.headers ?? {});
    if (options.auth !== false && session?.access_token && !session.is_demo) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    const isRawBody = options.body instanceof FormData || options.body instanceof Blob;
    if (options.body !== undefined && !isRawBody) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${resolveApiUrl()}?${query.toString()}`, {
      method: options.method || (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: isRawBody ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Помилка сервера (${response.status}).`);
    }
    if (!response.ok) {
      if (response.status === 401 && !options.skipSignOutOn401) {
        writeSession(null);
      }
      throw new Error(data?.error || data?.message || `Помилка запиту (${response.status}).`);
    }
    return data;
  }

  async function request(path, options = {}) {
    if (await isPhpBackendAvailable()) {
      if (path.includes("is_site_page_published")) {
        const slug = options.body?.target_slug || "";
        const res = await phpRequest("is_site_page_published", { slug });
        return res?.published !== false;
      }
      if (path.includes("is_admin")) {
        const res = await phpRequest("is_admin");
        return res?.is_admin === true;
      }
      return null;
    }
    if (await isPhpBackendAvailable()) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await phpRequest("upload_image", {}, { method: "POST", body: formData });
      return location.pathname.includes("/directions/") ? `../${res.url}` : res.url;
    }

    if (!isSupabaseConfigured()) {
      if (path.includes("is_site_page_published")) {
        const db = readDemoDb();
        const slug = options.body?.target_slug;
        const page = db.site_pages.find((item) => item.slug === slug);
        return page ? page.is_published !== false : true;
      }
      if (path.includes("is_admin")) return true;
      return null;
    }
    const { url, anonKey } = getConfig();
    const token = options.auth === false ? null : await accessToken();
    const headers = new Headers(options.headers ?? {});
    headers.set("apikey", anonKey);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else if (anonKey.startsWith("sb_publishable_")) headers.delete("Authorization");
    else headers.set("Authorization", `Bearer ${anonKey}`);
    const rawBody = options.body instanceof Blob || options.body instanceof FormData;
    if (options.body !== undefined && !rawBody) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${url}${path}`, {
      ...options,
      headers,
      body: rawBody ? options.body : options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    });

    if (!response.ok) throw await responseError(response);
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function signIn(email, password) {
    if (await isPhpBackendAvailable()) {
      const result = normalizeSession(await phpRequest("login", {}, {
        method: "POST",
        auth: false,
        skipSignOutOn401: true,
        body: { email, password },
      }));
      writeSession(result);
      return result;
    }
    if (await isPhpBackendAvailable()) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await phpRequest("upload_image", {}, { method: "POST", body: formData });
      return location.pathname.includes("/directions/") ? `../${res.url}` : res.url;
    }

    if (!isSupabaseConfigured()) {
      const demoSession = {
        access_token: "demo-token",
        user: { email: email || "demo@reservist.ua" },
        is_demo: true,
      };
      writeSession(demoSession);
      return demoSession;
    }
    const result = normalizeSession(await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      auth: false,
      body: { email, password },
    }));
    writeSession(result);
    return result;
  }

  async function isAdmin() {
    if (await isPhpBackendAvailable()) {
      const res = await phpRequest("is_admin");
      return res?.is_admin === true;
    }
    if (!isSupabaseConfigured()) return true;
    return request("/rest/v1/rpc/is_admin", { method: "POST", body: {} });
  }

  async function select(table, query = {}) {
    if (await isPhpBackendAvailable()) {
      return phpRequest("select", { table, ...query });
    }
    if (await isPhpBackendAvailable()) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await phpRequest("upload_image", {}, { method: "POST", body: formData });
      return location.pathname.includes("/directions/") ? `../${res.url}` : res.url;
    }

    if (!isSupabaseConfigured()) {
      const db = readDemoDb();
      let rows = structuredClone(db[table] ?? []);
      for (const [key, filter] of Object.entries(query)) {
        if (key === "select" || key === "order" || key === "limit") continue;
        if (typeof filter === "string" && filter.startsWith("eq.")) {
          const target = filter.slice(3);
          rows = rows.filter((row) => String(row[key]) === target);
        }
      }
      if (query.order) {
        const [field, dir] = query.order.split(".");
        rows.sort((a, b) => {
          const av = a[field] ?? 0;
          const bv = b[field] ?? 0;
          return dir === "desc" ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
        });
      }
      if (query.limit) {
        rows = rows.slice(0, Number(query.limit));
      }
      return rows;
    }
    const params = new URLSearchParams({ select: "*", ...query });
    return request(`/rest/v1/${table}?${params}`);
  }

  async function upsert(table, records, conflictColumn) {
    if (await isPhpBackendAvailable()) {
      return phpRequest("upsert", { table, ...(conflictColumn ? { on_conflict: conflictColumn } : {}) }, {
        method: "POST",
        body: records,
      });
    }
    if (await isPhpBackendAvailable()) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await phpRequest("upload_image", {}, { method: "POST", body: formData });
      return location.pathname.includes("/directions/") ? `../${res.url}` : res.url;
    }

    if (!isSupabaseConfigured()) {
      const db = readDemoDb();
      const list = db[table] ?? [];
      const key = conflictColumn || "id";
      const updated = [];
      for (const record of records) {
        const index = list.findIndex((item) => String(item[key]) === String(record[key]));
        if (index >= 0) {
          list[index] = { ...list[index], ...record };
          updated.push(list[index]);
        } else {
          list.push(record);
          updated.push(record);
        }
      }
      db[table] = list;
      writeDemoDb(db);
      return structuredClone(updated);
    }
    const query = conflictColumn ? `?on_conflict=${encodeURIComponent(conflictColumn)}` : "";
    return request(`/rest/v1/${table}${query}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: records,
    });
  }

  async function insert(table, record) {
    if (await isPhpBackendAvailable()) {
      return phpRequest("insert", { table }, {
        method: "POST",
        body: record,
      });
    }
    if (await isPhpBackendAvailable()) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await phpRequest("upload_image", {}, { method: "POST", body: formData });
      return location.pathname.includes("/directions/") ? `../${res.url}` : res.url;
    }

    if (!isSupabaseConfigured()) {
      const db = readDemoDb();
      const list = db[table] ?? [];
      const newRecord = { id: record.id || crypto.randomUUID(), ...record };
      list.push(newRecord);
      db[table] = list;
      writeDemoDb(db);
      return [structuredClone(newRecord)];
    }
    return request(`/rest/v1/${table}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: record,
    });
  }

  async function update(table, id, record, key = "id") {
    if (await isPhpBackendAvailable()) {
      return phpRequest("update", { table, key, id: String(id) }, {
        method: "POST",
        body: record,
      });
    }
    if (await isPhpBackendAvailable()) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await phpRequest("upload_image", {}, { method: "POST", body: formData });
      return location.pathname.includes("/directions/") ? `../${res.url}` : res.url;
    }

    if (!isSupabaseConfigured()) {
      const db = readDemoDb();
      const list = db[table] ?? [];
      const index = list.findIndex((item) => String(item[key]) === String(id));
      if (index < 0) return [];
      list[index] = { ...list[index], ...record };
      db[table] = list;
      if (table === "directions" && key === "slug" && record.slug && record.slug !== id) {
        (db.programs ?? []).forEach((item) => {
          if (item.direction_slug === id) item.direction_slug = record.slug;
        });
        (db.events ?? []).forEach((item) => {
          if (item.direction_slug === id) item.direction_slug = record.slug;
        });
      }
      if (table === "programs" && key === "slug" && record.slug && record.slug !== id) {
        (db.events ?? []).forEach((item) => {
          if (item.program_slug === id) item.program_slug = record.slug;
        });
      }
      writeDemoDb(db);
      return [structuredClone(list[index])];
    }
    const params = new URLSearchParams({ [key]: `eq.${id}`, select: "*" });
    return request(`/rest/v1/${table}?${params}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: record,
    });
  }

  async function remove(table, id, key = "id") {
    if (await isPhpBackendAvailable()) {
      return phpRequest("remove", { table, key, id: String(id) }, { method: "POST" });
    }
    if (await isPhpBackendAvailable()) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await phpRequest("upload_image", {}, { method: "POST", body: formData });
      return location.pathname.includes("/directions/") ? `../${res.url}` : res.url;
    }

    if (!isSupabaseConfigured()) {
      const db = readDemoDb();
      db[table] = (db[table] ?? []).filter((item) => String(item[key]) !== String(id));
      writeDemoDb(db);
      return null;
    }
    const params = new URLSearchParams({ [key]: `eq.${id}` });
    return request(`/rest/v1/${table}?${params}`, { method: "DELETE" });
  }

  async function uploadImage(file) {
    const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (!(file instanceof File) || !supportedTypes.has(file.type)) {
      throw new Error("Choose a JPEG, PNG, WebP, or AVIF image.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Images must be 10 MB or smaller.");
    }

    if (await isPhpBackendAvailable()) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await phpRequest("upload_image", {}, { method: "POST", body: formData });
      return location.pathname.includes("/directions/") ? `../${res.url}` : res.url;
    }

    if (!isSupabaseConfigured()) {
      if (typeof FileReader !== "undefined") {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Не вдалося прочитати файл зображення."));
          reader.readAsDataURL(file);
        });
      }
      return URL.createObjectURL(file);
    }

    const { url } = getConfig();
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
    const objectPath = `${crypto.randomUUID()}.${extension}`;
    await request(`/storage/v1/object/site-media/${objectPath}`, {
      method: "POST",
      headers: { "Content-Type": file.type, "x-upsert": "false" },
      body: file,
    });
    return `${url}/storage/v1/object/public/site-media/${objectPath}`;
  }

  function buildCohortIdentity(application) {
    const dir = application.direction_slug && application.direction_slug !== "consultation"
      ? application.direction_slug
      : "consultation";
    const prog = (application.program_slug || application.course_title || dir || "course").trim();
    const courseTitle = (application.course_title || application.program_slug || dir || "Курс").trim();
    const city = (application.city || "Місто уточнюється").trim();
    const date = (application.event_date || "Найближчий набір").trim();
    const key = `${dir}__${prog}__${city}__${date}`;
    const title = `[${date}] ${courseTitle} · ${city}`;
    return { key, title, dir, prog, courseTitle, city, date };
  }

  async function syncToGoogleSheets(application, action = "upsert_application") {
    try {
      const configs = await select("sheets_config", { id: "eq.true", limit: "1" });
      const cfg = configs?.[0] || {
        id: true,
        webhook_url: "",
        auto_sync: true,
        access_mode: "anyone_edit",
        editor_emails: "",
        drive_folder_id: "",
        cohort_sheets: {},
      };
      const cohort = buildCohortIdentity(application);
      const cohortSheets = { ...(cfg.cohort_sheets || {}) };
      const isPaid = application.status === "paid";
      let isFirstPaidTable = false;

      if (isPaid) {
        if (!cohortSheets[cohort.key]) {
          isFirstPaidTable = true;
          cohortSheets[cohort.key] = {
            key: cohort.key,
            title: cohort.title,
            course_title: cohort.courseTitle,
            city: cohort.city,
            event_date: cohort.date,
            access_mode: cfg.access_mode || "anyone_edit",
            editor_emails: cfg.editor_emails || "",
            spreadsheet_url: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        } else {
          cohortSheets[cohort.key] = {
            ...cohortSheets[cohort.key],
            updated_at: new Date().toISOString(),
            access_mode: cfg.access_mode || cohortSheets[cohort.key].access_mode || "anyone_edit",
          };
        }
        await upsert("sheets_config", [{ ...cfg, id: true, cohort_sheets: cohortSheets }], "id");
      }

      const payload = {
        action: isPaid ? "sync_paid_participant" : action,
        only_create_on_paid: true,
        cohort,
        access_settings: {
          access_mode: cfg.access_mode || "anyone_edit",
          editor_emails: cfg.editor_emails || "",
          drive_folder_id: cfg.drive_folder_id || "",
        },
        application,
        timestamp: new Date().toISOString(),
      };

      if (await isPhpBackendAvailable()) {
        const res = await phpRequest("sync_sheets", {}, { method: "POST", body: payload });
        return {
          synced: res?.synced === true,
          isFirstPaidTable,
          cohort,
          cohortSheet: cohortSheets[cohort.key] || null,
        };
      }

      const webhookUrl = cfg.webhook_url?.trim();
      if (!webhookUrl) {
        return {
          synced: false,
          reason: "no_url",
          isFirstPaidTable,
          cohort,
          cohortSheet: cohortSheets[cohort.key] || null,
        };
      }

      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      return {
        synced: true,
        isFirstPaidTable,
        cohort,
        cohortSheet: cohortSheets[cohort.key] || null,
      };
    } catch (error) {
      console.error("Google Sheets sync failed:", error);
      return { synced: false, error: error.message };
    }
  }

  function getGoogleAppsScriptCode(customSettings = {}) {
    const defaultAccessMode = customSettings.access_mode || "anyone_edit";
    const defaultEmails = customSettings.editor_emails || "";
    const defaultFolderId = customSettings.drive_folder_id || "";
    return `/**
 * RESERVIST — Авто-створення окремих Google Таблиць під кожну Дату + Курс (ТІЛЬКИ ДЛЯ ОПЛАЧЕНИХ)
 * + Автоматичне налаштування доступу (за посиланням та за списком Email команди)
 *
 * Логіка роботи:
 * 1. Порожні таблиці НЕ створюються.
 * 2. Щойно перший учасник на конкретний [Курс + Місто + Дата] отримує статус "paid" (Оплачено):
 *    скрипт автоматично створює окремий файл Google Таблиці для цього вишколу,
 *    виставляє права доступу (Редактор/Перегляд за посиланням + Email команди)
 *    і додає туди оплачених учасників.
 */
var DEFAULT_ACCESS_MODE = "${defaultAccessMode}"; // "anyone_edit" | "anyone_view" | "restricted"
var DEFAULT_EDITOR_EMAILS = "${defaultEmails.replace(/"/g, '\\"')}";
var DEFAULT_DRIVE_FOLDER_ID = "${defaultFolderId.replace(/"/g, '\\"')}";

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var data = JSON.parse(e.postData.contents);
    var app = data.application || {};
    var cohort = data.cohort || {};
    var access = data.access_settings || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Загальний журнал для відділу продзвону (всі ліди з сайту)
    var generalSheet = getOrCreateSheet(ss, "📥 Загальні заявки (Продзвін)", [
      "ID заявки", "Дата створення", "Статус", "Менеджер продзвону",
      "Напрямок", "Курс / Програма", "Місто", "Дата вишколу",
      "Ім'я клієнта", "Телефон", "Промокод", "Сума (₴)", "Примітка"
    ]);
    upsertRowById(generalSheet, app.id, [
      app.id, formatDate(app.created_at), statusLabel(app.status), app.caller_name || "—",
      app.direction_slug, app.course_title, app.city, app.event_date || "Найближчий набір",
      app.name, app.phone, app.promo || "—", app.amount_uah || 0, app.notes || ""
    ]);

    // 2. Окрема таблиця івенту створюється і поповнюється ТІЛЬКИ коли є оплата (status === "paid")
    var cohortKey = cohort.key || ((app.direction_slug || "course") + "__" + (app.city || "Київ") + "__" + (app.event_date || "Без дати"));
    var cohortTitle = cohort.title || ("[" + (app.event_date || "Набір") + "] " + (app.course_title || "Курс") + " · " + (app.city || ""));

    if (app.status === "paid") {
      var eventSs = getOrCreateEventSpreadsheet(ss, cohortKey, cohortTitle, access);
      var rosterSheet = eventSs.getSheets()[0];
      upsertRowById(rosterSheet, app.id, [
        app.id,
        "✅ ОПЛАЧЕНО",
        app.name || "",
        app.phone || "",
        app.course_title || "",
        app.amount_uah || 0,
        app.promo || "—",
        app.city || "",
        app.event_date || "Найближчий набір",
        app.caller_name || "—",
        app.notes || "",
        formatDate(new Date().toISOString())
      ]);
    } else {
      // Якщо статус змінили з "paid" на "cancelled" або "calling" — прибираємо людину з таблиці оплачених
      removeParticipantIfEventSheetExists(ss, cohortKey, app.id);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateEventSpreadsheet(masterSs, cohortKey, cohortTitle, access) {
  var registry = getOrCreateSheet(masterSs, "🗂 Реєстр таблиць івентів", [
    "Ключ набору", "Назва таблиці івенту", "File ID", "Посилання на таблицю", "Режим доступу", "Дата створення"
  ]);
  var rows = registry.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(cohortKey) && rows[i][2]) {
      try {
        return SpreadsheetApp.openById(String(rows[i][2]));
      } catch (err) {
        // Якщо файл був видалений вручну — створимо заново нижче
      }
    }
  }

  // Створюємо нову окрему Google Таблицю під цей Івент + Дату (бо з'явився перший оплачений учасник!)
  var newSs = SpreadsheetApp.create("RESERVIST · " + cohortTitle);
  var file = DriveApp.getFileById(newSs.getId());

  // Переміщуємо в загальну папку Google Drive (якщо вказано)
  var folderId = extractFolderId(access.drive_folder_id || DEFAULT_DRIVE_FOLDER_ID);
  if (folderId) {
    try {
      var folder = DriveApp.getFolderById(folderId);
      folder.addFile(file);
    } catch (e) {}
  }

  // АВТОМАТИЧНЕ НАЛАШТУВАННЯ ДОСТУПУ (щоб не ділитися вручну)
  var mode = access.access_mode || DEFAULT_ACCESS_MODE;
  try {
    if (mode === "anyone_edit") {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    } else if (mode === "anyone_view") {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
  } catch (e) {}

  var rawEmails = access.editor_emails || DEFAULT_EDITOR_EMAILS || "";
  var emails = rawEmails.split(/[,;\\s]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.indexOf("@") > 0; });
  if (emails.length > 0) {
    try {
      newSs.addEditors(emails);
    } catch (e) {}
  }

  // Оформлюємо шапку таблиці івенту
  var sheet = newSs.getSheets()[0];
  sheet.setName("Список оплачених");
  var headers = [
    "ID заявки", "Статус", "Ім'я учасника", "Телефон", "Тариф / Пакет",
    "Сума оплати (₴)", "Промокод", "Місто", "Дата вишколу",
    "Менеджер продзвону", "Примітка / Спорядження", "Оновлено"
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#121315").setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  upsertRowById(registry, cohortKey, [
    cohortKey, cohortTitle, newSs.getId(), newSs.getUrl(), mode, formatDate(new Date().toISOString())
  ]);
  return newSs;
}

function removeParticipantIfEventSheetExists(masterSs, cohortKey, appId) {
  var registry = masterSs.getSheetByName("🗂 Реєстр таблиць івентів");
  if (!registry) return;
  var rows = registry.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(cohortKey) && rows[i][2]) {
      try {
        var eventSs = SpreadsheetApp.openById(String(rows[i][2]));
        var sheet = eventSs.getSheets()[0];
        var data = sheet.getDataRange().getValues();
        for (var r = data.length - 1; r >= 1; r--) {
          if (String(data[r][0]) === String(appId)) {
            sheet.deleteRow(r + 1);
          }
        }
      } catch (e) {}
    }
  }
}

function extractFolderId(input) {
  if (!input) return "";
  var match = String(input).match(/[-\\w]{25,}/);
  return match ? match[0] : "";
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#121315").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertRowById(sheet, id, rowValues) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

function statusLabel(st) {
  if (st === "paid") return "✅ Оплачено (У таблиці івенту)";
  if (st === "calling") return "📞 У роботі (Продзвін)";
  if (st === "cancelled" || st === "canceled") return "❌ Скасовано";
  return "🆕 Нова заявка";
}

function formatDate(iso) {
  if (!iso) return "";
  return Utilities.formatDate(new Date(iso), "Europe/Kyiv", "dd.MM.yyyy HH:mm");
}`;
  }

  const demoAllowed = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname)
    || location.hostname.endsWith(".github.io");
  const phpOriginAllowed = location.protocol === "http:" || location.protocol === "https:";

  window.ReservistCMSClient = {
    isConfigured: () => isSupabaseConfigured() || demoAllowed || phpOriginAllowed,
    isDemoMode: () => !isSupabaseConfigured() && demoAllowed,
    isPhpAvailable: isPhpBackendAvailable,
    resetDemoDb: () => {
      localStorage.removeItem(demoStorageKey);
      return readDemoDb();
    },
    configurationError: () => {
      try {
        getConfig();
        return "";
      } catch (error) {
        return error.message;
      }
    },
    signIn,
    signOut: () => writeSession(null),
    currentSession: () => readSession() || (!isSupabaseConfigured() ? { access_token: "demo-token", is_demo: true } : null),
    isAdmin,
    request,
    select,
    upsert,
    insert,
    update,
    remove,
    uploadImage,
    buildCohortIdentity,
    syncToGoogleSheets,
    getGoogleAppsScriptCode,
  };
})();
