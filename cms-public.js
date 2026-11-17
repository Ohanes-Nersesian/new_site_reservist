(() => {
  const cms = window.ReservistCMSClient;
  const body = document.body;
  const main = document.querySelector("main");
  if (!cms || !main) return;

  const isCoursePage = body.dataset.cmsPage === "course";
  const pageSlug = isCoursePage
    ? new URLSearchParams(location.search).get("slug") || ""
    : body.dataset.cmsPage;
  const allowedInline = new Set(["BR", "SPAN", "STRONG", "EM", "B"]);
  const previewRequested = new URLSearchParams(location.search).has("cmsPreview");
  let previewMode = false;
  const sectionKey = (section) => section.id || [...section.classList].join(".");
  const directionRoutes = {
    carbine: "carbine.html",
    medicine: "medicine.html",
    bootcamp: "bootcamp.html",
    pistol: "pistol.html",
    "open-storm": "open-storm.html",
    "killhouse-cqb": "killhouse-cqb.html",
  };

  function getSections() {
    return [...main.children].filter((element) => element.tagName === "SECTION");
  }

  function fieldKey(section, element) {
    const path = [];
    let current = element;
    while (current && current !== section) {
      const parent = current.parentElement;
      if (!parent) return null;
      path.unshift([...parent.children].indexOf(current));
      current = parent;
    }
    return current === section ? `${sectionKey(section)}::${path.join(".")}` : null;
  }

  function findField(key) {
    const separator = key.indexOf("::");
    if (separator < 0) return null;
    const section = getSections().find((item) => sectionKey(item) === key.slice(0, separator));
    if (!section) return null;
    const path = key.slice(separator + 2);
    if (!path) return section;
    return path.split(".").reduce((element, index) => element?.children[Number(index)] ?? null, section);
  }

  function sanitizeHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = value;
    const fragment = document.createDocumentFragment();
    const walk = (source, target) => {
      source.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          target.append(document.createTextNode(node.textContent));
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          if (allowedInline.has(node.tagName)) {
            const clean = document.createElement(node.tagName.toLowerCase());
            walk(node, clean);
            target.append(clean);
          } else {
            walk(node, target);
          }
        }
      });
    };
    walk(template.content, fragment);
    return fragment;
  }

  function applyFields(content) {
    const fields = content?.fields;
    if (!fields || typeof fields !== "object") return;
    for (const [key, field] of Object.entries(fields)) {
      const element = findField(key);
      if (!element || !field || typeof field.value !== "string") continue;
      if (field.type === "image") {
        const imageHref = safeImageUrl(field.value);
        if (!imageHref) {
          console.error(`RESERVIST CMS ignored an invalid image URL for "${key}".`);
          continue;
        }
        if (element instanceof HTMLImageElement) {
          element.src = imageHref;
          element.hidden = false;
          if (typeof field.alt === "string") element.alt = field.alt;
        } else if (field.mode === "background") {
          element.style.backgroundImage = `url("${imageHref.replace(/["\\]/g, "\\$&")}")`;
        } else {
          continue;
        }
      } else if (field.type === "html") {
        element.replaceChildren(sanitizeHtml(field.value));
      } else if (field.type === "text") {
        element.textContent = field.value;
      }
    }
  }

  function applyBlocks(blocks) {
    if (!Array.isArray(blocks)) return;
    const container = main;
    const sections = getSections();
    const configById = new Map(blocks.map((block) => [block.id, block]));

    for (const section of sections) {
      if (section.id === "reviews") continue;
      const config = configById.get(sectionKey(section));
      const isVisible = config?.visible !== false;
      section.hidden = !isVisible;
      section.style.display = isVisible ? "" : "none";
    }

    const ordered = [...sections].sort((a, b) => {
      const aOrder = configById.get(sectionKey(a))?.order;
      const bOrder = configById.get(sectionKey(b))?.order;
      return (Number.isInteger(aOrder) ? aOrder : blocks.length + sections.indexOf(a))
        - (Number.isInteger(bOrder) ? bOrder : blocks.length + sections.indexOf(b));
    });
    ordered.forEach((section) => container.append(section));
  }

  function applyTheme(settings) {
    const colors = settings?.colors;
    const variables = {
      background: "--bg",
      surface: "--surface",
      surfaceRaised: "--surface-2",
      text: "--text",
      muted: "--muted",
      brand: "--red",
      cta: "--cta",
      status: "--green",
    };

    for (const [key, variable] of Object.entries(variables)) {
      const color = colors?.[key];
      if (typeof color === "string" && /^#[\da-f]{6}$/i.test(color)) {
        document.documentElement.style.setProperty(variable, color);
      }
    }
    const fonts = settings?.fonts;
    const allowedFonts = new Set(["Oswald", "JetBrains Mono", "system-ui", "Arial", "Inter"]);
    if (allowedFonts.has(fonts?.heading) && fonts.heading !== "JetBrains Mono") {
      document.documentElement.style.setProperty("--display", `"${fonts.heading}", "JetBrains Mono", sans-serif`);
    }
    if (allowedFonts.has(fonts?.body)) {
      document.documentElement.style.setProperty("--body", `"${fonts.body}", sans-serif`);
    }
    const contacts = settings?.contacts;
    if (contacts && typeof contacts === "object") {
      const footer = document.querySelector(".footer");
      if (footer) {
        if (contacts.footer_tagline) {
          const tagline = footer.querySelector(".footer-tagline, :scope > p");
          if (tagline) tagline.textContent = contacts.footer_tagline;
        }
        let nav = footer.querySelector(".footer-links");
        if (!nav && (contacts.phone || contacts.instagram_url || contacts.telegram_url)) {
          nav = document.createElement("nav");
          nav.className = "footer-links";
          nav.setAttribute("aria-label", "Контакти");
          const lastCol = footer.querySelector(".footer-col:last-child") || footer;
          lastCol.append(nav);
        }
        if (nav) {
          nav.replaceChildren();
          if (contacts.phone) {
            const tel = document.createElement("a");
            tel.href = `tel:${contacts.phone.replace(/[^\d+]/g, "")}`;
            tel.textContent = contacts.phone;
            nav.append(tel);
          }
          for (const [label, rawUrl] of [["TELEGRAM ↗", contacts.telegram_url], ["INSTAGRAM ↗", contacts.instagram_url]]) {
            const safe = safeImageUrl(rawUrl);
            if (safe && /^https?:/i.test(safe)) {
              const link = document.createElement("a");
              link.href = safe;
              link.target = "_blank";
              link.rel = "noreferrer";
              link.textContent = label;
              nav.append(link);
            }
          }
        }
        const tgModalLink = document.querySelector("[data-telegram-link]");
        const safeTg = safeImageUrl(contacts.telegram_url);
        if (tgModalLink && safeTg && /^https?:/i.test(safeTg)) {
          tgModalLink.href = safeTg;
        }
      }
    }
  }

    const targetOrigin = location.origin === "null" ? "*" : location.origin;

    function safeImageUrl(value) {
      if (typeof value !== "string" || !value) return null;
      if (/^data:image\/(jpeg|png|webp|avif);base64,/i.test(value)) return value;
      try {
        let normalized = value.trim();
        if (normalized.startsWith("assets/") && location.pathname.includes("/directions/")) {
          normalized = `../${normalized}`;
        }
        const url = new URL(normalized, location.href);
        return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "blob:" ? url.href : null;
      } catch {
        return null;
      }
    }

    function renderFooterDirections(directions) {
      if (!Array.isArray(directions) || !directions.length) return;
      const footerCols = document.querySelectorAll(".footer .footer-col");
      const dirCol = [...footerCols].find((col) => col.querySelector(".footer-col-title")?.textContent.trim().toUpperCase() === "НАПРЯМКИ");
      if (!dirCol) return;
      const titleEl = dirCol.querySelector(".footer-col-title");
      const inDirectionsFolder = location.pathname.includes("/directions/");
      const prefix = inDirectionsFolder ? "" : "directions/";
      dirCol.replaceChildren();
      if (titleEl) dirCol.append(titleEl);
      directions.forEach((direction) => {
        const a = document.createElement("a");
        const route = directionRoutes[direction.slug];
        a.href = route
          ? `${prefix}${route}`
          : `${prefix}course.html?slug=${encodeURIComponent(direction.slug)}&direction=${encodeURIComponent(direction.slug)}`;
        a.textContent = direction.name;
        dirCol.append(a);
      });
    }

    function renderDirections(directions) {
      if (pageSlug !== "home") return;
      const grid = document.querySelector(".direction-grid");
      if (!grid || !directions.length) return;
      const oldMeta = new Map([...grid.querySelectorAll(".direction-link")].map((link) => {
        const slug = link.getAttribute("href")?.match(/directions\/([^/]+)\.html/)?.[1];
        return [slug, {
          description: link.querySelector(".direction-description")?.textContent.trim() || "",
          index: link.querySelector(".direction-index")?.textContent.trim() || "",
        }];
      }));
      const fragment = document.createDocumentFragment();
      directions.forEach((direction, index) => {
        const link = document.createElement("a");
        link.className = "direction-link";
        const route = directionRoutes[direction.slug];
        link.href = route
          ? `directions/${route}`
          : `directions/course.html?slug=${encodeURIComponent(direction.slug)}&direction=${encodeURIComponent(direction.slug)}`;
        const code = document.createElement("span");
        code.className = "direction-index";
        code.textContent = oldMeta.get(direction.slug)?.index || `${String(index + 1).padStart(2, "0")} / ${direction.slug.toUpperCase()}`;
        const title = document.createElement("span");
        title.className = "direction-title";
        title.textContent = direction.name;
        const imageUrl = safeImageUrl(direction.hero_image_url);
        if (imageUrl) {
          const image = document.createElement("img");
          image.className = "direction-link-photo";
          image.src = imageUrl;
          image.alt = "";
          image.loading = "lazy";
          image.setAttribute("aria-hidden", "true");
          link.append(image);
        }
        const summary = document.createElement("span");
        summary.className = "direction-description";
        summary.textContent = direction.summary || oldMeta.get(direction.slug)?.description || "Перегляньте опис програми та умови участі.";
        const arrow = document.createElement("span");
        arrow.className = "direction-arrow";
        arrow.textContent = "↗";
        link.append(code, title, summary, arrow);
        fragment.append(link);
      });
      grid.replaceChildren(fragment);
    }

    function renderReviews(reviews, showReviews) {
      if (pageSlug !== "home") return;
      const section = document.querySelector("#reviews");
      const grid = section?.querySelector(".reviews-grid");
      if (!section || !grid) return;
      const active = (reviews || []).filter((r) => r.is_active !== false);
      if (!showReviews || !active.length) {
        section.hidden = true;
        section.style.display = "none";
        return;
      }
      section.hidden = false;
      section.style.display = "";
      const fragment = document.createDocumentFragment();
      active.forEach((rev) => {
        const card = document.createElement("article");
        card.className = "review-card";

        const top = document.createElement("div");
        top.className = "review-card-top";
        const course = document.createElement("span");
        course.className = "review-card-course";
        course.textContent = rev.course_name || "RESERVIST";
        const stars = document.createElement("span");
        stars.className = "review-card-stars";
        const rating = Math.max(1, Math.min(5, Number(rev.rating) || 5));
        stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
        top.append(course, stars);

        const text = document.createElement("p");
        text.className = "review-card-text";
        text.textContent = rev.text || "";

        const author = document.createElement("div");
        author.className = "review-card-author";
        const name = document.createElement("strong");
        name.textContent = rev.author_name || "Учасник курсу";
        const city = document.createElement("span");
        city.textContent = rev.city || "";
        author.append(name, city);

        card.append(top, text, author);
        fragment.append(card);
      });
      grid.replaceChildren(fragment);
    }

    function renderInstructors(instructors) {
      if (pageSlug !== "home" || !instructors.length) return;
      const grid = document.querySelector(".team-grid");
      if (!grid) return;
      const fragment = document.createDocumentFragment();
      instructors.forEach((instructor, index) => {
        const card = document.createElement("article");
        card.className = "team-card";
        const num = String(index + 1).padStart(2, "0");

        const header = document.createElement("div");
        header.className = "team-card-header";
        const indexLabel = document.createElement("span");
        indexLabel.className = "team-card-index";
        indexLabel.textContent = `${num} / FILE-INS-${num}`;
        const status = document.createElement("span");
        status.className = "team-card-status";
        status.innerHTML = '<span class="live-dot"></span> ACTIVE';
        header.append(indexLabel, status);
        card.append(header);

        const portrait = document.createElement("div");
        portrait.className = "team-card-portrait";
        const imageUrl = safeImageUrl(instructor.photo_url);
        if (imageUrl) {
          const image = document.createElement("img");
          image.className = "team-card-photo";
          image.src = imageUrl;
          image.alt = `Фото інструктора ${instructor.name}`;
          image.loading = "lazy";
          portrait.append(image);
        } else {
          const silhouette = document.createElement("div");
          silhouette.className = "team-card-silhouette";
          silhouette.innerHTML = `
            <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <circle cx="32" cy="22" r="11" stroke-width="1.5"/>
              <path d="M12 56c2-11 10-17 20-17s18 6 20 17" stroke-width="1.5"/>
              <line x1="32" y1="4" x2="32" y2="10" stroke-width="1.2"/>
              <line x1="4" y1="32" x2="10" y2="32" stroke-width="1.2"/>
              <line x1="54" y1="32" x2="60" y2="32" stroke-width="1.2"/>
            </svg>
          `;
          const watermark = document.createElement("span");
          watermark.className = "team-card-callsign-watermark";
          watermark.textContent = instructor.callsign ? `«${instructor.callsign}»` : instructor.name;
          const tag = document.createElement("span");
          tag.className = "team-card-dossier-tag";
          tag.textContent = "RESERVIST // INSTRUCTOR DOSSIER";
          silhouette.append(watermark, tag);
          portrait.append(silhouette);
        }
        card.append(portrait);

        const heading = document.createElement("h3");
        heading.append(document.createTextNode(instructor.name));
        if (instructor.callsign) {
          const callsign = document.createElement("span");
          callsign.textContent = ` «${instructor.callsign}»`;
          heading.append(callsign);
        }
        const role = document.createElement("p");
        role.className = "team-card-role";
        role.textContent = instructor.role;
        const bio = document.createElement("p");
        bio.className = "team-card-description";
        bio.textContent = instructor.bio;
        card.append(heading, role, bio);
        fragment.append(card);
      });
      grid.replaceChildren(fragment);
    }

    function renderReviews(reviews, showReviews) {
      if (pageSlug !== "home") return;
      const section = document.querySelector("#reviews");
      const grid = section?.querySelector(".reviews-grid");
      if (!section || !grid) return;
      const active = (reviews || []).filter((r) => r.is_active !== false);
      if (!showReviews || !active.length) {
        section.hidden = true;
        section.style.display = "none";
        return;
      }
      section.hidden = false;
      section.style.display = "";
      const fragment = document.createDocumentFragment();
      active.forEach((rev) => {
        const card = document.createElement("article");
        card.className = "review-card";

        const top = document.createElement("div");
        top.className = "review-card-top";
        const course = document.createElement("span");
        course.className = "review-card-course";
        course.textContent = rev.course_name || "RESERVIST";
        const stars = document.createElement("span");
        stars.className = "review-card-stars";
        const rating = Math.max(1, Math.min(5, Number(rev.rating) || 5));
        stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
        top.append(course, stars);

        const text = document.createElement("p");
        text.className = "review-card-text";
        text.textContent = rev.text || "";

        const author = document.createElement("div");
        author.className = "review-card-author";
        const name = document.createElement("strong");
        name.textContent = rev.author_name || "Учасник курсу";
        const city = document.createElement("span");
        city.textContent = rev.city || "";
        author.append(name, city);

        card.append(top, text, author);
        fragment.append(card);
      });
      grid.replaceChildren(fragment);
    }

    function parseSpecsRows(program) {
      const rows = [["Тривалість", program.duration_label]];
      if (typeof program.specs_text === "string" && program.specs_text.trim()) {
        program.specs_text.split(/\r?\n/).forEach((line) => {
          const separator = line.indexOf(":");
          if (separator <= 0) return;
          const term = line.slice(0, separator).trim();
          const val = line.slice(separator + 1).trim();
          if (term && val && term.toLocaleLowerCase("uk-UA") !== "тривалість") {
            rows.push([term, val]);
          }
        });
      }
      return rows;
    }

    function fillSpecsDl(dl, rows) {
      dl.replaceChildren();
      rows.forEach(([term, val]) => {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = val;
        row.append(dt, dd);
        dl.append(row);
      });
    }

    function renderFaq(faqText) {
      if (typeof faqText !== "string" || !faqText.trim()) return;
      const items = faqText
        .split(/\r?\n/)
        .map((line) => {
          const parts = line.includes("::") ? line.split("::") : line.split("—");
          if (parts.length < 2) return null;
          const question = parts[0].trim();
          const answer = parts.slice(1).join(" ").trim();
          return question && answer ? [question, answer] : null;
        })
        .filter(Boolean);
      if (!items.length) return;
      let faqList = document.querySelector("[data-course-faq], .carbine-faq-list");
      if (!faqList && pageSlug !== "home" && pageSlug !== "booking") {
        const bookingSec = document.querySelector("#direction-booking, #carbine-booking");
        if (bookingSec && bookingSec.parentElement) {
          const sec = document.createElement("section");
          sec.className = "carbine-faq";
          sec.innerHTML = `
            <div class="eyebrow"><span class="section-number">FAQ</span> КОРОТКО ПРО ГОЛОВНЕ</div>
            <h2>ЧАСТІ<br /><span>ПИТАННЯ.</span></h2>
            <div class="carbine-faq-list" data-course-faq></div>
          `;
          bookingSec.parentElement.insertBefore(sec, bookingSec);
          faqList = sec.querySelector("[data-course-faq]");
        }
      }
      if (!faqList) return;
      faqList.replaceChildren();
      items.forEach(([question, answer]) => {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = question;
        const p = document.createElement("p");
        p.textContent = answer;
        details.append(summary, p);
        faqList.append(details);
      });
      const faqSection = faqList.closest("section");
      if (faqSection) faqSection.hidden = false;
    }

    function renderHeroSensors(directions, events) {
      if (pageSlug !== "home") return;
      const sensors = document.querySelectorAll(".hero-bottom .sensor strong");
      if (sensors.length < 3) return;
      const allCities = [...new Set(
        directions
          .flatMap((d) => String(d.cities || "").split(",").map((c) => c.trim()))
          .filter((c) => c && !c.toLowerCase().includes("уточнюється")),
      )];
      if (allCities.length) {
        sensors[0].textContent = allCities.slice(0, 3).join(" · ").toUpperCase();
      }
      const dirCount = directions.length;
      const padCount = String(dirCount).padStart(2, "0");
      const dirWord = dirCount === 1 ? "НАПРЯМОК" : dirCount >= 2 && dirCount <= 4 ? "НАПРЯМКИ" : "НАПРЯМКІВ";
      sensors[1].textContent = `${padCount} ${dirWord}`;

      const nowKey = new Date().toISOString().slice(0, 10);
      const upcoming = (events || [])
        .filter((e) => e.is_active !== false && String(e.starts_at || "").slice(0, 10) >= nowKey)
        .sort((a, b) => String(a.starts_at || "").localeCompare(String(b.starts_at || "")));
      if (upcoming.length) {
        const first = upcoming[0];
        const [y, m, d] = String(first.starts_at).slice(0, 10).split("-").map(Number);
        const dateStr = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" })
          .format(new Date(y, m - 1, d))
          .replace(".", "")
          .toUpperCase();
        sensors[2].textContent = `НАЙБЛИЖЧИЙ СТАРТ · ${dateStr}`;
      }
    }

    function renderDirectionUpcomingEvents(directionSlug, events) {
      if (pageSlug === "home" || pageSlug === "booking") return;
      const nowKey = new Date().toISOString().slice(0, 10);
      const matching = (events || [])
        .filter((e) => e.is_active !== false && e.direction_slug === directionSlug && String(e.starts_at || "").slice(0, 10) >= nowKey)
        .sort((a, b) => String(a.starts_at || "").localeCompare(String(b.starts_at || "")))
        .slice(0, 4);

      let strip = document.querySelector(".direction-upcoming-strip");
      if (!matching.length) {
        if (strip) strip.hidden = true;
        return;
      }

      const targetSection = document.querySelector("#programs") || document.querySelector("#direction-booking, #carbine-booking");
      if (!targetSection || !targetSection.parentElement) return;

      if (!strip) {
        strip = document.createElement("section");
        strip.className = "direction-upcoming-strip";
        targetSection.parentElement.insertBefore(strip, targetSection);
      }
      strip.hidden = false;

      const escHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[ch]));
      const bookingAnchor = document.querySelector("#direction-booking, #carbine-booking")?.id || "direction-booking";
      const cardsHtml = matching.map((ev) => {
        const dateKey = String(ev.starts_at || "").slice(0, 10);
        const timeKey = String(ev.starts_at || "").slice(11, 16);
        const [y, m, d] = dateKey.split("-").map(Number);
        const dateFormatted = new Intl.DateTimeFormat("uk-UA", {
          weekday: "short",
          day: "numeric",
          month: "long",
        }).format(new Date(y, m - 1, d)).toUpperCase();
        const priceBadge = ev.price_uah ? `${Number(ev.price_uah).toLocaleString("uk-UA")} ₴` : "";
        return `
          <article class="direction-upcoming-card">
            <div class="direction-upcoming-meta">
              <span class="direction-upcoming-date">${dateFormatted} · ${timeKey}</span>
              <strong>${escHtml(ev.title)}</strong>
              <span class="direction-upcoming-city">${escHtml([ev.city, ev.venue, priceBadge].filter(Boolean).join(" · "))}</span>
            </div>
            <a href="#${escHtml(bookingAnchor)}" class="button button-small button-outline direction-pick-event-btn"
               data-pick-direction="${escHtml(ev.direction_slug)}"
               data-pick-course="${escHtml(ev.program_slug || "")}"
               data-pick-city="${escHtml(ev.city || "")}"
               data-pick-date="${escHtml(dateKey)}">ОБРАТИ ДАТУ <span>↓</span></a>
          </article>
        `;
      }).join("");

      strip.innerHTML = `
        <div class="direction-upcoming-header">
          <div>
            <div class="eyebrow"><span class="live-dot"></span> КАЛЕНДАР НАПРЯМКУ</div>
            <h2>НАЙБЛИЖЧІ <span>ДАТИ ВИШКОЛІВ</span></h2>
          </div>
          <p>Оберіть зручну дату зі списку нижче — програма, місто та дата автоматично підставляться у форму запису.</p>
        </div>
        <div class="direction-upcoming-grid">${cardsHtml}</div>
      `;
    }

    function applyPrograms(programs) {
      const programsBySlug = new Map(programs.map((program) => [program.slug, program]));
      document.querySelectorAll(".course-book-button[data-course]").forEach((button) => {
        const program = programsBySlug.get(button.dataset.course);
        if (!program) return;
        const card = button.closest("article") || button.parentElement;
        if (!card) return;
        card.hidden = false;
        if (Number.isInteger(program.sort_order)) card.style.order = String(program.sort_order);
        const cardImage = card.querySelector(":scope > .cms-program-image");
        const imageUrl = safeImageUrl(program.image_url);
        if (imageUrl) {
          const image = cardImage || document.createElement("img");
          image.className = "cms-program-image";
          image.src = imageUrl;
          image.alt = `Фото програми «${program.name}»`;
          image.loading = "lazy";
          if (!cardImage) card.insertBefore(image, card.firstElementChild);
        } else {
          cardImage?.remove();
        }

        const price = `${Number(program.price_uah).toLocaleString("uk-UA")} ₴`;
        const priceElement = [...card.querySelectorAll("strong, dd, span, small, p")]
          .find((element) => element.children.length === 0 && /\d[\d\s.,]*\s*₴/.test(element.textContent));
        if (priceElement) priceElement.textContent = price;

        const specsDl = card.querySelector("dl.course-specs");
        if (specsDl && program.specs_text && program.specs_text.trim()) {
          fillSpecsDl(specsDl, parseSpecsRows(program));
        } else {
          const durationRow = [...card.querySelectorAll("dt")]
            .find((element) => element.textContent.trim().toLocaleLowerCase("uk-UA").startsWith("тривалість"));
          if (durationRow?.nextElementSibling?.tagName === "DD") {
            durationRow.nextElementSibling.textContent = program.duration_label;
          }
        }
      });
      document.querySelectorAll(".course-book-button[data-course]").forEach((button) => {
        const program = programsBySlug.get(button.dataset.course);
        const card = button.closest("article") || button.parentElement;
        if (card) card.hidden = !program;
      });
      renderNewPrograms(programs);
    }

    function renderNewPrograms(programs) {
      if (pageSlug === "home" || pageSlug === "booking") return;
      const section = document.querySelector("main > section#programs");
      if (!section) return;
      const existingSlugs = new Set(
        [...section.querySelectorAll(".course-book-button[data-course]")]
          .filter((button) => !button.closest(".cms-added-programs"))
          .map((button) => button.dataset.course),
      );
      const addedPrograms = programs.filter((program) => !existingSlugs.has(program.slug));
      let grid = section.querySelector(".cms-added-programs");
      if (!addedPrograms.length) {
        grid?.remove();
        return;
      }
      if (!grid) {
        grid = document.createElement("div");
        grid.className = "detail-tariff-grid cms-added-programs";
        const priceNote = section.querySelector(":scope > .price-note");
        if (priceNote) section.insertBefore(grid, priceNote);
        else section.append(grid);
      }

      const fragment = document.createDocumentFragment();
      const bookingSection = document.querySelector("#carbine-booking, #direction-booking");
      for (const [index, program] of addedPrograms.entries()) {
        const card = document.createElement("article");
        card.className = "detail-tariff";
        card.style.order = String(program.sort_order || index);
        const code = document.createElement("span");
        code.textContent = isCoursePage
          ? `${String(index + 1).padStart(2, "0")} / ПАКЕТ УЧАСТІ`
          : `ДОДАТКОВА ПРОГРАМА / ${String(index + 1).padStart(2, "0")}`;
        card.append(code);

        if (program.image_url) {
          const imageUrl = safeImageUrl(program.image_url);
          if (imageUrl) {
            const image = document.createElement("img");
            image.className = "cms-program-image";
            image.src = imageUrl;
            image.alt = `Фото програми «${program.name}»`;
            image.loading = "lazy";
            card.append(image);
          }
        }

        const title = document.createElement("h3");
        title.textContent = program.name;
        const description = document.createElement("p");
        description.textContent = program.description || "";
        const specs = document.createElement("dl");
        specs.className = "course-specs";
        fillSpecsDl(specs, parseSpecsRows(program));
        const priceRow = document.createElement("div");
        const label = document.createElement("small");
        label.textContent = "ПОВНА ВАРТІСТЬ УЧАСТІ";
        const price = document.createElement("strong");
        price.textContent = `${Number(program.price_uah).toLocaleString("uk-UA")} ₴`;
        priceRow.append(label, price);
        const bookingLink = document.createElement("a");
        bookingLink.className = "button button-primary course-book-button";
        bookingLink.dataset.course = program.slug;
        bookingLink.href = bookingSection ? `#${bookingSection.id}` : `../booking.html?direction=${encodeURIComponent(pageSlug)}&course=${encodeURIComponent(program.slug)}`;
        bookingLink.append(document.createTextNode("ЗАЛИШИТИ ЗАЯВКУ "));
        const arrow = document.createElement("span");
        arrow.textContent = "↗";
        bookingLink.append(arrow);
        card.append(title, description, specs, priceRow, bookingLink);
        fragment.append(card);
      }
      grid.replaceChildren(fragment);
    }

    function renderReviews(reviews, showReviews) {
      if (pageSlug !== "home") return;
      const section = document.querySelector("#reviews");
      const grid = section?.querySelector(".reviews-grid");
      if (!section || !grid) return;
      const active = (reviews || []).filter((r) => r.is_active !== false);
      if (!showReviews || !active.length) {
        section.hidden = true;
        section.style.display = "none";
        return;
      }
      section.hidden = false;
      section.style.display = "";
      const fragment = document.createDocumentFragment();
      active.forEach((rev) => {
        const card = document.createElement("article");
        card.className = "review-card";

        const top = document.createElement("div");
        top.className = "review-card-top";
        const course = document.createElement("span");
        course.className = "review-card-course";
        course.textContent = rev.course_name || "RESERVIST";
        const stars = document.createElement("span");
        stars.className = "review-card-stars";
        const rating = Math.max(1, Math.min(5, Number(rev.rating) || 5));
        stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
        top.append(course, stars);

        const text = document.createElement("p");
        text.className = "review-card-text";
        text.textContent = rev.text || "";

        const author = document.createElement("div");
        author.className = "review-card-author";
        const name = document.createElement("strong");
        name.textContent = rev.author_name || "Учасник курсу";
        const city = document.createElement("span");
        city.textContent = rev.city || "";
        author.append(name, city);

        card.append(top, text, author);
        fragment.append(card);
      });
      grid.replaceChildren(fragment);
    }

    async function loadCatalog(allowPreview = false) {
      try {
        const [allDirections, allPrograms, allEvents, allPromos] = await Promise.all([
          cms.select("directions", { order: "sort_order.asc" }),
          cms.select("programs", { order: "sort_order.asc" }),
          cms.select("events", { order: "starts_at.asc" }).catch(() => []),
          cms.select("promo_codes").catch(() => []),
        ]);
        const activeDirections = allDirections.filter((direction) => direction.is_active);
        const activePrograms = allPrograms.filter((program) => program.is_active);
        const activeEvents = (allEvents || []).filter((event) => event.is_active !== false);
        const activePromos = (allPromos || []).filter((promo) => promo.is_active !== false);
        renderDirections(activeDirections);
        renderFooterDirections(activeDirections);
        renderHeroSensors(activeDirections, activeEvents);
        const currentDirection = allDirections.find((direction) => direction.slug === pageSlug);
        if (!allowPreview && (directionRoutes[pageSlug] || isCoursePage) && !currentDirection?.is_active) {
          hideUnpublishedPage();
          return;
        }
        if (isCoursePage && currentDirection) {
          const setText = (selector, text) => {
            const element = document.querySelector(selector);
            if (element) element.textContent = text;
          };
          setText("[data-course-title]", currentDirection.name);
          setText("[data-course-summary]", currentDirection.summary || "");
          setText("[data-course-description]", currentDirection.description || "");
          setText("[data-course-code]", `${currentDirection.slug.toUpperCase()} / RESERVIST`);
          const cityText = (currentDirection.cities || "").trim();
          setText("[data-course-cities]", cityText || "ЛОКАЦІЮ ПІДТВЕРДЖУЄ КООРДИНАТОР");
          if (!currentDirection.seo_title) document.title = `${currentDirection.name} — RESERVIST`;
        }
        if (currentDirection) {
          if (currentDirection.seo_title) document.title = currentDirection.seo_title;
          if (currentDirection.seo_description) {
            const description = document.querySelector('meta[name="description"]');
            if (description) description.content = currentDirection.seo_description;
          }
          const heroImage = safeImageUrl(currentDirection.hero_image_url)
            || (isCoursePage ? safeImageUrl("assets/images/open-storm-field.webp") : null);
          const heroImageElement = document.querySelector(".direction-page-hero img");
          if (heroImage && heroImageElement instanceof HTMLImageElement) {
            heroImageElement.src = heroImage;
            heroImageElement.alt = currentDirection.name || "";
            heroImageElement.hidden = false;
          }
          if (currentDirection.faq_text) {
            renderFaq(currentDirection.faq_text);
          }
          renderDirectionUpcomingEvents(currentDirection.slug, activeEvents);
        }
        if (pageSlug === "home") {
          const [instructors, reviews, themes] = await Promise.all([
            cms.select("instructors", { order: "sort_order.asc" }),
            cms.select("reviews", { order: "sort_order.asc" }).catch(() => []),
            cms.select("site_theme", { id: "eq.true", limit: "1" }).catch(() => []),
          ]);
          renderInstructors(instructors.filter((instructor) => instructor.is_active));
          const showReviews = themes?.[0]?.settings?.show_reviews === true;
          renderReviews(reviews, showReviews);
          if (activeEvents && window.ReservistCalendar) {
            window.ReservistCalendar.setEvents(activeEvents, activeDirections);
          }
        }
        const directionPrograms = activePrograms.filter((program) => program.direction_slug === pageSlug);
        applyPrograms(directionPrograms);
        if (window.ReservistApplicationCMS?.setCatalog) {
          window.ReservistApplicationCMS.setCatalog(activeDirections, activePrograms, activeEvents, activePromos);
        }
      } catch (error) {
        console.error("RESERVIST CMS could not load course or instructor data.", error);
      }
    }

  function fieldLabel(element) {
    const text = element.getAttribute("aria-label")
      || element.getAttribute("alt")
      || element.textContent.trim().replace(/\s+/g, " ");
    return text.slice(0, 90) || element.tagName.toLowerCase();
  }

  function editableElementAt(target, x, y) {
    let candidate = null;
    const caret = document.caretPositionFromPoint?.(x, y);
    if (caret?.offsetNode?.nodeType === Node.TEXT_NODE) candidate = caret.offsetNode.parentElement;
    if (!candidate) {
      const range = document.caretRangeFromPoint?.(x, y);
      if (range?.startContainer?.nodeType === Node.TEXT_NODE) candidate = range.startContainer.parentElement;
    }
    if (!candidate && target instanceof Element) {
      candidate = target.closest("img, p, h1, h2, h3, h4, li, a, button, span, strong, em, small, dt, dd, figcaption, label, summary, blockquote");
    }
    if (candidate && candidate.tagName === "SPAN" && candidate.parentElement) {
      const parent = candidate.parentElement;
      if (["H1", "H2", "H3", "H4", "P", "SUMMARY"].includes(parent.tagName)
        && [...parent.querySelectorAll("*")].every((child) => allowedInline.has(child.tagName))) {
        return parent;
      }
    }
    return candidate;
  }

  function notifySelection(target, event) {
    const targetEl = target instanceof Element ? target : null;
    const image = targetEl instanceof HTMLImageElement ? targetEl : null;
    const bgHolder = !image && targetEl instanceof HTMLElement ? targetEl : null;
    const backgroundImage = bgHolder
      ? getComputedStyle(bgHolder).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]
      : null;
    let element = image || (backgroundImage ? bgHolder : editableElementAt(targetEl, event.clientX, event.clientY));
    if (!element) return;
    const section = element.closest("main > section");
    if (!section || !main.contains(section)) return;
    let richText = !image && !backgroundImage && element.children.length > 0
      && [...element.querySelectorAll("*")].every((child) => allowedInline.has(child.tagName));
    if (!image && !backgroundImage && element.children.length && !richText) {
      const innerLeaf = targetEl?.closest("img, p, h1, h2, h3, h4, li, span, strong, em, small, dt, dd, figcaption, label, summary");
      if (innerLeaf && section.contains(innerLeaf)) {
        element = innerLeaf;
        richText = element.children.length > 0 && [...element.querySelectorAll("*")].every((child) => allowedInline.has(child.tagName));
        if (element.children.length && !richText) return;
      } else {
        return;
      }
    }

    const key = fieldKey(section, element);
    if (!key) return;
    let dynamicTab = "";
    if (element.closest(".team-grid")) dynamicTab = "team";
    else if (element.closest(".reviews-grid")) dynamicTab = "reviews";
    else if (element.closest(".calendar-hybrid, .schedule-toolbar, .direction-upcoming-strip")) dynamicTab = "events";
    else if (element.closest(".direction-grid, .detail-tariff-grid, .open-storm-package-grid")) dynamicTab = "courses";
    document.querySelectorAll(".cms-selected").forEach((item) => item.classList.remove("cms-selected"));
    element.classList.add("cms-selected");
    window.parent.postMessage({
      type: "reservist-cms-selection",
      page: pageSlug,
      key,
      kind: image || backgroundImage ? "image" : richText ? "html" : "text",
      mode: backgroundImage ? "background" : undefined,
      value: image
        ? image.getAttribute("src") || ""
        : backgroundImage || (richText ? element.innerHTML.trim() : element.textContent),
      alt: image?.alt ?? "",
      label: fieldLabel(element),
      dynamicTab,
    }, targetOrigin);
  }

  window.ReservistCMSPublic = {
    pageSlug,
    sectionKey,
    fieldKey,
    getSections,
    applyBlocks,
    refreshCatalog: loadCatalog,
  };

  function ensureEditBanner(enabled) {
    let banner = document.querySelector(".cms-edit-banner");
    if (enabled && !banner) {
      banner = document.createElement("div");
      banner.className = "cms-edit-banner";
      banner.textContent = "✏️ РЕЖИМ РЕДАГУВАННЯ УВІМКНЕНО · НАТИСНІТЬ НА ТЕКСТ ЧИ ФОТО";
      body.append(banner);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || (location.origin !== "null" && event.origin !== location.origin)) return;
    if (event.data?.type === "reservist-cms-get-sections") {
      window.parent.postMessage({
        type: "reservist-cms-sections",
        page: pageSlug,
        sections: getSections().map((section, index) => ({
          id: sectionKey(section),
          title: section.querySelector("h1, h2, h3")?.textContent.trim().replace(/\s+/g, " ") || sectionKey(section),
          order: index,
        })),
      }, targetOrigin);
    }
    if (event.data?.type === "reservist-cms-set-editing") {
      const enabled = event.data.enabled === true;
      body.classList.toggle("cms-editing", enabled);
      ensureEditBanner(enabled);
    }
    if (event.data?.type === "reservist-cms-apply") {
      applyBlocks(event.data.blocks);
      applyFields(event.data.content);
    }
  });

  body.addEventListener("click", (event) => {
    if (!body.classList.contains("cms-editing")) return;
    const targetEl = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (targetEl?.closest("[data-open-callback], [data-close-callback], #callback-modal")) return;
    event.preventDefault();
    event.stopPropagation();
    notifySelection(event.target, event);
  }, true);

  // Якщо сторінка відкрита з ?cmsPreview=1 у панелі керування, вмикаємо підсвітку редагування одразу
  if (previewRequested && window.parent !== window) {
    body.classList.add("cms-editing");
    ensureEditBanner(true);
    window.parent.postMessage({ type: "reservist-cms-ready", page: pageSlug }, targetOrigin);
  }

  if (!cms.isConfigured()) return;

  const previewAuthorization = previewRequested
    ? cms.isAdmin().then((isAdmin) => isAdmin === true).catch((error) => {
      console.error("RESERVIST CMS could not authorize this page preview.", error);
      return false;
    })
    : Promise.resolve(false);

  Promise.all([
    cms.select("site_pages", { slug: `eq.${pageSlug}`, limit: "1" }),
    cms.select("site_theme", { id: "eq.true", limit: "1" }),
    cms.request("/rest/v1/rpc/is_site_page_published", {
      method: "POST",
      body: { target_slug: pageSlug },
    }),
    previewAuthorization,
  ]).then(([pages, themes, isPublished, canPreview]) => {
    previewMode = previewRequested && canPreview;
    const page = pages[0];
    if (page) {
      applyBlocks(page.blocks);
      applyFields(page.content);
      if (page.seo_title) document.title = page.seo_title;
      if (page.seo_description) {
        const description = document.querySelector('meta[name="description"]');
        if (description) description.content = page.seo_description;
      }
    }
    if (!previewMode && !isCoursePage && (isPublished === false || (page && !page.is_published))) hideUnpublishedPage();
    if (themes[0]) applyTheme(themes[0].settings);
    loadCatalog(previewMode);
  }).catch((error) => {
    console.error(`RESERVIST CMS could not load page "${pageSlug}".`, error);
  });

  function hideUnpublishedPage() {
    main.replaceChildren();
    const message = document.createElement("p");
    message.className = "cms-unpublished-message";
    message.textContent = "Ця сторінка тимчасово недоступна.";
    main.append(message);
  }

})();
