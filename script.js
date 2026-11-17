const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
const citySelect = document.querySelector("#calendar-city");
const directionSelect = document.querySelector("#calendar-direction");
const monthGrid = document.querySelector("#month-grid");
const monthHeading = document.querySelector("#month-heading");
const eventList = document.querySelector("#event-list");
const eventListControls = document.querySelector("#event-list-controls");
const eventCount = document.querySelector("#event-count");
const agendaHeading = document.querySelector("#agenda-heading");
const applicationForm = document.querySelector("#application-form");

let audioContext;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[ch]));

// Телефон: мінімум 9 цифр (напр. 0501234567 або +380501234567)
const isValidPhone = (value) => String(value || "").replace(/\D/g, "").length >= 9;

const applicationOptions = {
  carbine: {
    cities: ["Київ", "Львів", "Дніпро"],
    courses: [
      ["carbine-1", "Карабін 1.0 — 4 950 ₴", 4950],
      ["carbine-2", "Карабін 2.0 — 5 500 ₴", 5500],
      ["carbine-intensive", "Карабін Інтенсив — 5 950 ₴", 5950],
      ["cqb-intensive", "CQB Інтенсив — 6 500 ₴", 6500],
      ["anti-drone", "Курс Антидрон — 4 800 ₴", 4800],
      ["night-shooting", "Нічні стрільби — 7 500 ₴", 7500],
    ],
  },
  medicine: {
    cities: ["Київ", "Львів"],
    courses: [
      ["tccc-asm", "Дводенний TCCC-ASM — 4 200 ₴", 4200],
      ["medicine-simulation", "ТакМед Симуляція — 2 500 ₴", 2500],
    ],
  },
  bootcamp: {
    cities: ["Київська область"],
    courses: [
      ["bootcamp-1", "BootCamp 1.0 — 2 дні — 6 500 ₴", 6500],
      ["bootcamp-2", "BootCamp 2.0 — 2 дні — 7 500 ₴", 7500],
    ],
  },
  pistol: {
    cities: ["Місто уточнюється координатором"],
    courses: [["pistol-1", "Базовий курс пістолета — 6 000 ₴", 6000]],
  },
  "open-storm": {
    cities: ["Львів · локація уточнюється координатором"],
    courses: [
      ["storm-own", "Квиток — власне спорядження · 1 000 ₴", 1000],
      ["storm-minimum", "Мінімум — базове спорядження без форми · 2 000 ₴", 2000],
      ["storm-optimal", "Оптимальний — базове спорядження, форма й захист · 2 350 ₴", 2350],
      ["storm-maximum", "Максимум — повний комплект зі шоломом · 2 700 ₴", 2700],
    ],
  },
  "killhouse-cqb": {
    cities: ["Локація уточнюється координатором"],
    courses: [["cqb-optimal", "Пакет Оптимальний CQB — 1 500 ₴", 1500]],
  },
};

const directionPages = {
  carbine: "carbine.html",
  medicine: "medicine.html",
  bootcamp: "bootcamp.html",
  pistol: "pistol.html",
  "open-storm": "open-storm.html",
  "killhouse-cqb": "killhouse-cqb.html",
};

function playInterfaceTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, now);
    oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.045);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.06);
  } catch {
    // Ignore audio context restrictions
  }
}

document.querySelectorAll(".button-primary").forEach((button) => {
  button.addEventListener("click", playInterfaceTone);
});

if (citySelect && directionSelect && monthGrid && monthHeading && eventList && eventCount) {
  const today = new Date();
  const maxVisibleEvents = 3;
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = null;
  let eventListExpanded = false;

  const dateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const localDate = (value) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const demoDirections = Object.keys(applicationOptions);
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
  const firstSaturday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + daysUntilSaturday,
  );
  const demoEvents = Array.from({ length: 12 }, (_, weekIndex) => {
    const dates = [0, ...(weekIndex % 3 === 1 ? [1] : [])];

    return dates.map((dayOffset, eventIndex) => {
      const eventDate = new Date(
        firstSaturday.getFullYear(),
        firstSaturday.getMonth(),
        firstSaturday.getDate() + weekIndex * 7 + dayOffset,
      );
      const eventDirection = demoDirections[(weekIndex * 5 + eventIndex) % demoDirections.length];
      const eventCourse = applicationOptions[eventDirection].courses[
        (weekIndex + eventIndex) % applicationOptions[eventDirection].courses.length
      ];
      const directionCities = applicationOptions[eventDirection].cities;
      const city = directionCities.every((value) => !value.includes("уточнюється"))
        ? directionCities[(weekIndex + eventIndex) % directionCities.length]
        : directionCities[0];

      return {
        title: eventCourse[1].split(" — ")[0],
        direction: eventDirection,
        city,
        startsAt: `${dateKey(eventDate)}T10:00:00`,
        time: "10:00",
        status: "demo",
        isDemo: true,
      };
    });
  }).flat();

  let calendarEvents = demoEvents;

  const getVisibleEvents = () =>
    calendarEvents
      .filter((event) => citySelect.value === "all" || event.city === citySelect.value)
      .filter((event) => directionSelect.value === "all" || event.direction === directionSelect.value)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  const formatEventCount = (count) => {
    const lastTwoDigits = count % 100;
    const lastDigit = count % 10;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} ПОДІЙ`;
    if (lastDigit === 1) return `${count} ПОДІЯ`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${count} ПОДІЇ`;
    return `${count} ПОДІЙ`;
  };

  const appendText = (parent, tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  };

  function renderEventList() {
    const events = getVisibleEvents();
    const listedEvents = selectedDate
      ? events.filter((event) => event.startsAt.slice(0, 10) === selectedDate)
      : events.filter((event) => new Date(event.startsAt) >= today);

    if (agendaHeading) {
      agendaHeading.textContent = selectedDate
        ? `ПОДІЇ · ${new Intl.DateTimeFormat("uk-UA", {
            day: "numeric",
            month: "long",
          }).format(localDate(selectedDate)).toLocaleUpperCase("uk-UA")}`
        : "НАЙБЛИЖЧІ ПОДІЇ";
    }
    eventCount.textContent = formatEventCount(listedEvents.length);
    eventList.replaceChildren();
    eventListControls?.replaceChildren();

    if (!listedEvents.length) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      if (selectedDate) {
        const selected = localDate(selectedDate);
        const formatted = new Intl.DateTimeFormat("uk-UA", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(selected);
        appendText(empty, "strong", "calendar-empty-title", "На цю дату подій немає");
        appendText(empty, "p", "", formatted);
      } else {
        appendText(empty, "strong", "calendar-empty-title", "Для цього фільтра подій не знайдено");
        appendText(
          empty,
          "p",
          "",
          "Змініть місто або напрямок. Точні дати вишколів підтверджує координатор.",
        );
        const link = appendText(empty, "a", "calendar-empty-link", "ПЕРЕГЛЯНУТИ НАПРЯМКИ ↗");
        link.href = "#directions";
      }
      eventList.append(empty);
      return;
    }

    listedEvents.forEach((event, index) => {
      const card = document.createElement("article");
      card.className = "event-card";
      card.hidden = !eventListExpanded && index >= maxVisibleEvents;
      const date = localDate(event.startsAt);
      const dateBlock = document.createElement("div");
      dateBlock.className = "event-card-date";
      appendText(dateBlock, "strong", "", new Intl.DateTimeFormat("uk-UA", { day: "2-digit" }).format(date));
      appendText(dateBlock, "span", "", new Intl.DateTimeFormat("uk-UA", { month: "short" }).format(date).replace(".", ""));
      card.append(dateBlock);

      const details = document.createElement("div");
      details.className = "event-card-details";
      appendText(details, "strong", "", event.title);
      const timeAndCity = [event.city, event.time].filter(Boolean).join(" · ");
      appendText(details, "span", "", timeAndCity);
      if (event.venue) appendText(details, "span", "event-card-venue", event.venue);
      card.append(details);

      const availability = event.isDemo
        ? "ПЛАНОВИЙ НАБІР"
        : "НАЙБЛИЖЧИЙ НАБІР";
      appendText(card, "span", `event-card-availability${event.isDemo ? " is-demo" : ""}`, availability);

      const page = directionPages[event.direction];
      const eventHref = event.href || (page ? `directions/${page}` : "");
      if (eventHref) {
        const link = document.createElement("a");
        link.className = "event-card-link";
        link.href = eventHref;
        link.setAttribute("aria-label", `Деталі події: ${event.title}`);
        link.textContent = "↗";
        card.append(link);
      }
      eventList.append(card);
    });

    if (listedEvents.length > maxVisibleEvents && eventListControls) {
      const toggle = appendText(
        eventListControls,
        "button",
        "event-list-toggle",
        eventListExpanded
          ? "ЗГОРНУТИ СПИСОК"
          : `ПОКАЗАТИ ВСІ ПОДІЇ · ${listedEvents.length}`,
      );
      toggle.type = "button";
      toggle.setAttribute("aria-controls", "event-list");
      toggle.setAttribute("aria-expanded", String(eventListExpanded));
      toggle.addEventListener("click", () => {
        eventListExpanded = !eventListExpanded;
        renderEventList();
      });
    }
  }

  function renderMonth() {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    monthHeading.textContent = new Intl.DateTimeFormat("uk-UA", {
      month: "long",
      year: "numeric",
    }).format(visibleMonth);

    monthGrid.replaceChildren();
    ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "НД"].forEach((day) => {
      const weekday = appendText(monthGrid, "span", "month-weekday", day);
      weekday.setAttribute("role", "columnheader");
    });

    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const events = getVisibleEvents();

    for (let blank = 0; blank < firstWeekday; blank += 1) {
      const placeholder = document.createElement("span");
      placeholder.className = "month-day-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.setAttribute("role", "gridcell");
      monthGrid.append(placeholder);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = dateKey(date);
      const dayEvents = events.filter((event) => event.startsAt.slice(0, 10) === key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "month-day";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-pressed", String(selectedDate === key));
      const accessibleDate = new Intl.DateTimeFormat("uk-UA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
      button.setAttribute(
        "aria-label",
        dayEvents.length ? `${accessibleDate}, подій: ${dayEvents.length}` : accessibleDate,
      );
      if (dateKey(today) === key) button.classList.add("is-today");
      if (selectedDate === key) button.classList.add("is-selected");
      if (dayEvents.length) button.classList.add("has-events");
      button.textContent = String(day);
      if (dayEvents.length) {
        const marker = document.createElement("span");
        marker.className = "month-day-marker";
        marker.setAttribute("aria-hidden", "true");
        button.append(marker);
      }
      button.addEventListener("click", () => {
        selectedDate = key;
        eventListExpanded = false;
        renderMonth();
        renderEventList();
      });
      monthGrid.append(button);
    }
  }

  const renderCalendar = () => {
    eventListExpanded = false;
    renderMonth();
    renderEventList();
  };

  citySelect.addEventListener("change", renderCalendar);
  directionSelect.addEventListener("change", renderCalendar);
  document.querySelector("#previous-month").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    selectedDate = null;
    eventListExpanded = false;
    renderCalendar();
  });
  document.querySelector("#next-month").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    selectedDate = null;
    eventListExpanded = false;
    renderCalendar();
  });

  renderCalendar();

  window.ReservistCalendar = {
    setEvents(events, directions = []) {
      calendarEvents = events.map((event) => {
        const params = new URLSearchParams();
        if (event.direction_slug) params.set("direction", event.direction_slug);
        if (event.program_slug) params.set("course", event.program_slug);
        if (event.city) params.set("city", event.city);
        const dateKey = String(event.starts_at || "").slice(0, 10);
        if (dateKey) params.set("date", dateKey);
        return {
          title: event.title,
          direction: event.direction_slug,
          city: event.city,
          startsAt: event.starts_at,
          time: String(event.starts_at || "").slice(11, 16),
          venue: event.venue || "",
          isDemo: false,
          href: `booking.html?${params.toString()}`,
        };
      });

      const fillSelect = (select, placeholder, options) => {
        const previous = select.value;
        select.replaceChildren(new Option(placeholder, "all"));
        options.forEach(([value, label]) => select.add(new Option(label, value)));
        select.value = options.some(([value]) => value === previous) ? previous : "all";
      };
      const cities = [...new Set(calendarEvents.map((event) => event.city).filter(Boolean))];
      fillSelect(citySelect, "Усі локації", cities.map((city) => [city, city]));
      fillSelect(
        directionSelect,
        "Усі напрямки",
        directions.map((direction) => [direction.slug, direction.name]),
      );

      document.querySelectorAll(".schedule-status.is-demo").forEach((badge) => {
        badge.textContent = "АКТУАЛЬНИЙ РОЗКЛАД";
        badge.classList.remove("is-demo");
      });
      const note = document.querySelector(".calendar-section .price-note");
      if (note) {
        note.textContent = "Дати та організаційні деталі підтверджує координатор після заявки. Близько 99% вишколів проходять у вихідні.";
      }
      const sectionIntro = document.querySelector(".calendar-section .section-heading p");
      if (sectionIntro) {
        sectionIntro.textContent = "Оберіть місто чи напрямок, знайдіть дату в календарі та залиште заявку. Близько 99% вишколів проходять у вихідні.";
      }

      const upcoming = getVisibleEvents().find((event) => new Date(event.startsAt) >= today);
      if (upcoming) {
        const date = localDate(upcoming.startsAt);
        visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      selectedDate = null;
      renderCalendar();
    },
  };
}

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(expanded));
    mainNav.classList.toggle("is-open", expanded);
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      mainNav.classList.remove("is-open");
    });
  });
}

if (applicationForm) {
  const directionField = applicationForm.querySelector("#application-direction");
  const cityField = applicationForm.querySelector("#application-city");
  const courseField = applicationForm.querySelector("#application-course");
  const promoInput = applicationForm.querySelector("#application-promo");
  const feedback = applicationForm.querySelector(".form-feedback");
  let catalogEvents = [];
  let catalogPromos = [
    { code: "RESERVIST10", discount_type: "percent", discount_value: 10, is_active: true },
    { code: "AZOV10", discount_type: "percent", discount_value: 10, is_active: true },
    { code: "STRIKE300", discount_type: "fixed", discount_value: 300, is_active: true },
  ];

  let dateField = applicationForm.querySelector("#application-date");
  if (!dateField && cityField) {
    const dateLabel = document.createElement("label");
    dateLabel.htmlFor = "application-date";
    dateLabel.textContent = "ДАТА ВИШКОЛУ";
    dateField = document.createElement("select");
    dateField.id = "application-date";
    dateField.name = "event_date";
    dateField.disabled = true;
    dateField.add(new Option("Найближчий набір · дату підтвердить координатор", "any", true, true));
    cityField.insertAdjacentElement("afterend", dateField);
    cityField.insertAdjacentElement("afterend", dateLabel);
  }

  let pricePreviewBox = applicationForm.querySelector(".form-price-preview");
  if (!pricePreviewBox && promoInput) {
    pricePreviewBox = document.createElement("div");
    pricePreviewBox.className = "form-price-preview";
    pricePreviewBox.hidden = true;
    promoInput.insertAdjacentElement("afterend", pricePreviewBox);
  }

  const getSelectedPriceInfo = () => {
    const selectedDir = applicationOptions[directionField.value];
    const courseTuple = selectedDir?.courses?.find(([slug]) => slug === courseField.value);
    const basePrice = Number(courseTuple?.[2] || 0);
    const rawPromo = (promoInput?.value || "").trim().toUpperCase();
    const matchedPromo = rawPromo
      ? catalogPromos.find((p) => p.is_active !== false && String(p.code || "").toUpperCase() === rawPromo)
      : null;
    let finalPrice = basePrice;
    let discountLabel = "";
    if (basePrice > 0 && matchedPromo) {
      if (matchedPromo.discount_type === "fixed") {
        finalPrice = Math.max(0, basePrice - Number(matchedPromo.discount_value || 0));
        discountLabel = `−${Number(matchedPromo.discount_value).toLocaleString("uk-UA")} ₴ (${matchedPromo.code})`;
      } else {
        const pct = Number(matchedPromo.discount_value || 0);
        finalPrice = Math.max(0, Math.round(basePrice * (1 - pct / 100)));
        discountLabel = `−${pct}% (${matchedPromo.code})`;
      }
    }
    return { basePrice, finalPrice, matchedPromo, rawPromo, discountLabel };
  };

  const updatePricePreview = () => {
    if (!pricePreviewBox) return;
    const { basePrice, finalPrice, matchedPromo, rawPromo, discountLabel } = getSelectedPriceInfo();
    if (!basePrice) {
      pricePreviewBox.hidden = true;
      return;
    }
    pricePreviewBox.hidden = false;
    if (matchedPromo) {
      pricePreviewBox.innerHTML = `<span>ВАРТІСТЬ УЧАСТІ З ПРОМОКОДОМ <strong>${discountLabel}</strong>:</span><strong><s>${basePrice.toLocaleString("uk-UA")} ₴</s> → ${finalPrice.toLocaleString("uk-UA")} ₴</strong>`;
    } else if (rawPromo) {
      pricePreviewBox.innerHTML = `<span>ВАРТІСТЬ УЧАСТІ (промокод «${escapeHtml(rawPromo)}» перевірить координатор):</span><strong>${basePrice.toLocaleString("uk-UA")} ₴</strong>`;
    } else {
      pricePreviewBox.innerHTML = `<span>ОРІЄНТОВНА ВАРТІСТЬ ОБРАНОГО ПАКЕТА:</span><strong>${basePrice.toLocaleString("uk-UA")} ₴</strong>`;
    }
  };

  const populateOptions = (field, placeholder, options) => {
    field.replaceChildren(new Option(placeholder, "", true, true));
    options.forEach(([value, label]) => field.add(new Option(label, value)));
    field.disabled = options.length === 0;
  };

  const formatEventOptionLabel = (event) => {
    const raw = String(event.starts_at || "");
    const dateKey = raw.slice(0, 10);
    const timeKey = raw.slice(11, 16);
    const parts = dateKey.split("-").map(Number);
    const formattedDate = parts.length === 3 && !parts.some(Number.isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
      : dateKey;
    return [formattedDate, timeKey, event.city, event.title].filter(Boolean).join(" · ");
  };

  const updateDateOptions = () => {
    if (!dateField) return;
    const previousValue = dateField.value;
    const selectedDirection = directionField.value;
    const selectedCourse = courseField.value;
    const selectedCity = cityField.value;
    dateField.replaceChildren(
      new Option("Найближчий набір · дату підтвердить координатор", "any", true, true),
    );
    if (!selectedDirection) {
      dateField.disabled = true;
      return;
    }
    const nowKey = new Date().toISOString().slice(0, 10);
    const matchingEvents = catalogEvents
      .filter((event) => {
        if (event.is_active === false) return false;
        if (event.direction_slug !== selectedDirection) return false;
        const dateKey = String(event.starts_at || "").slice(0, 10);
        if (dateKey && dateKey < nowKey) return false;
        if (selectedCourse && event.program_slug && event.program_slug !== selectedCourse) return false;
        if (selectedCity && event.city && event.city !== selectedCity) return false;
        return true;
      })
      .sort((a, b) => String(a.starts_at || "").localeCompare(String(b.starts_at || "")));

    matchingEvents.forEach((event) => {
      const value = String(event.starts_at || "").slice(0, 10) || event.id;
      dateField.add(new Option(formatEventOptionLabel(event), value));
    });
    dateField.disabled = !selectedDirection;
    if (previousValue && [...dateField.options].some((opt) => opt.value === previousValue)) {
      dateField.value = previousValue;
    }
  };

  const applyUrlSelections = () => {
    const params = new URLSearchParams(window.location.search);
    const requestedCourse = params.get("course");
    const requestedCity = params.get("city");
    const requestedDate = params.get("date");
    const selected = applicationOptions[directionField.value];
    if (!selected) return;
    if (requestedCourse && selected.courses.some(([slug]) => slug === requestedCourse)) {
      courseField.value = requestedCourse;
      cityField.disabled = false;
    } else if (selected.courses.length === 1) {
      courseField.value = selected.courses[0][0];
      cityField.disabled = false;
    }
    if (requestedCity && [...cityField.options].some((opt) => opt.value === requestedCity)) {
      cityField.value = requestedCity;
      cityField.disabled = false;
    } else if (selected.cities.length === 1 && courseField.value) {
      cityField.value = selected.cities[0];
    }
    updateDateOptions();
    if (requestedDate && dateField && [...dateField.options].some((opt) => opt.value === requestedDate)) {
      dateField.value = requestedDate;
      dateField.disabled = false;
    }
    updatePricePreview();
  };

  const updateApplicationOptions = () => {
    const selected = applicationOptions[directionField.value];
    if (!selected) {
      populateOptions(cityField, "Спочатку оберіть напрямок", []);
      populateOptions(courseField, "Спочатку оберіть напрямок", []);
      updateDateOptions();
      updatePricePreview();
      return;
    }

    populateOptions(cityField, "Оберіть місто", selected.cities.map((city) => [city, city]));
    populateOptions(courseField, "Оберіть курс або пакет", selected.courses);
    if (selected.courses.length === 1) {
      courseField.value = selected.courses[0][0];
    }
    cityField.disabled = selected.cities.length === 0;
    if (selected.cities.length === 1) {
      cityField.value = selected.cities[0];
    }
    updateDateOptions();
    updatePricePreview();
  };

  window.ReservistApplicationCMS = {
    setCatalog(directions, programs, events = [], promos = []) {
      catalogEvents = Array.isArray(events) ? events : [];
      if (Array.isArray(promos) && promos.length) catalogPromos = promos;
      const selectedDirection = directionField.value
        || new URLSearchParams(window.location.search).get("direction")
        || new URLSearchParams(window.location.search).get("slug")
        || "";
      const citiesByDirection = new Map(
        Object.entries(applicationOptions).map(([slug, options]) => [slug, options.cities]),
      );
      Object.keys(applicationOptions).forEach((slug) => delete applicationOptions[slug]);
      directions.forEach((direction) => {
        let directionPrograms = programs
          .filter((program) => program.direction_slug === direction.slug && program.is_active)
          .map((program) => [
            program.slug,
            `${program.name} — ${Number(program.price_uah).toLocaleString("uk-UA")} ₴`,
            program.price_uah,
          ]);
        if (!directionPrograms.length) {
          directionPrograms = [[`${direction.slug}-base`, `${direction.name} — Базовий пакет`, 1500]];
        }
        const eventCities = catalogEvents
          .filter((event) => event.direction_slug === direction.slug && event.is_active !== false && event.city)
          .map((event) => event.city.trim());
        const dirCities = (direction.cities || "").split(",").map((city) => city.trim()).filter(Boolean);
        const mergedCities = [...new Set([...dirCities, ...eventCities])];
        applicationOptions[direction.slug] = {
          cities: mergedCities.length
            ? mergedCities
            : citiesByDirection.get(direction.slug) || ["Місто уточнюється координатором"],
          courses: directionPrograms,
        };
      });

      const activeDirections = directions.filter((direction) => applicationOptions[direction.slug]);
      populateOptions(
        directionField,
        "Оберіть напрямок",
        activeDirections.map((direction) => [direction.slug, direction.name]),
      );
      if (applicationOptions[selectedDirection]) {
        directionField.value = selectedDirection;
        updateApplicationOptions();
        applyUrlSelections();
      }
    },
  };

  directionField.addEventListener("change", updateApplicationOptions);
  promoInput?.addEventListener("input", updatePricePreview);

  const requestedDirection = new URLSearchParams(window.location.search).get("direction");
  if (requestedDirection && applicationOptions[requestedDirection]) {
    directionField.value = requestedDirection;
    updateApplicationOptions();
    applyUrlSelections();
  } else if (directionField.value && applicationOptions[directionField.value]) {
    updateApplicationOptions();
    applyUrlSelections();
  }

  document.addEventListener("click", (clickEvent) => {
    const pickBtn = clickEvent.target.closest?.(".direction-pick-event-btn");
    if (pickBtn) {
      const dir = pickBtn.dataset.pickDirection || directionField.value;
      if (applicationOptions[dir] && directionField.value !== dir) {
        directionField.value = dir;
        updateApplicationOptions();
      }
      if (pickBtn.dataset.pickCourse && [...courseField.options].some((o) => o.value === pickBtn.dataset.pickCourse)) {
        courseField.value = pickBtn.dataset.pickCourse;
      } else if (!courseField.value && courseField.options.length > 1) {
        courseField.selectedIndex = 1;
      }
      cityField.disabled = false;
      if (pickBtn.dataset.pickCity && [...cityField.options].some((o) => o.value === pickBtn.dataset.pickCity)) {
        cityField.value = pickBtn.dataset.pickCity;
      } else if (!cityField.value && cityField.options.length > 1) {
        cityField.selectedIndex = 1;
      }
      updateDateOptions();
      if (pickBtn.dataset.pickDate && dateField && [...dateField.options].some((o) => o.value === pickBtn.dataset.pickDate)) {
        dateField.value = pickBtn.dataset.pickDate;
      }
      updatePricePreview();
      return;
    }

    const button = clickEvent.target.closest?.(".course-book-button[data-course]");
    if (!button) return;
    const direction = button.dataset.direction || directionField.value;
    if (!applicationOptions[direction]) return;
    if (directionField.value !== direction) {
      directionField.value = direction;
      updateApplicationOptions();
    }
    courseField.value = button.dataset.course;
    cityField.disabled = false;
    if (!cityField.value && cityField.options.length === 2) {
      cityField.selectedIndex = 1;
    }
    updateDateOptions();
    updatePricePreview();
  });

  courseField.addEventListener("change", () => {
    cityField.disabled = !courseField.value;
    if (courseField.value && !cityField.value && cityField.options.length === 2) {
      cityField.selectedIndex = 1;
    }
    updateDateOptions();
    updatePricePreview();
  });

  cityField.addEventListener("change", () => {
    updateDateOptions();
  });

  applicationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!applicationForm.reportValidity()) return;
    const submitBtn = applicationForm.querySelector(".form-submit");
    if (submitBtn?.disabled) return;
    const phoneInputEl = applicationForm.elements.phone;
    if (!isValidPhone(phoneInputEl.value)) {
      phoneInputEl.setCustomValidity("Вкажіть коректний номер телефону (мінімум 9 цифр).");
      phoneInputEl.reportValidity();
      phoneInputEl.setCustomValidity("");
      return;
    }
    if (submitBtn) submitBtn.disabled = true;

    const direction = directionField.selectedOptions[0]?.textContent || "";
    const city = cityField.selectedOptions[0]?.textContent || "";
    const course = courseField.selectedOptions[0]?.textContent || "";
    const eventDateValue = dateField?.value && dateField.value !== "any" ? dateField.value : "";
    const eventDateLabel = dateField?.selectedOptions[0]?.textContent || "Найближчий набір";
    const name = applicationForm.elements.name.value.trim();
    const phone = applicationForm.elements.phone.value.trim();
    const promo = applicationForm.elements.promo.value.trim();
    const { finalPrice, discountLabel } = getSelectedPriceInfo();

    let savedToCms = false;
    const cms = window.ReservistCMSClient;
    if (cms?.isConfigured?.() && cms?.insert) {
      try {
        const inserted = await cms.insert("applications", {
          created_at: new Date().toISOString(),
          direction_slug: directionField.value,
          program_slug: courseField.value,
          course_title: course.split(" — ")[0] || course,
          city: cityField.value,
          event_date: eventDateValue,
          name,
          full_name: name,
          phone,
          promo,
          promo_code: promo,
          status: "new",
          amount_uah: finalPrice,
          paid_amount: finalPrice,
          notes: discountLabel ? `Промокод застосовано: ${discountLabel}` : "",
        });
        if (inserted?.[0]) cms.syncToGoogleSheets?.(inserted[0]);
        savedToCms = true;
      } catch (err) {
        console.warn("Application save warning:", err);
      }
    }

    const summary = [
      savedToCms ? "✓ Заявку прийнято та передано у відділ продзвону:" : "Чернетку заявки сформовано на цій сторінці:",
      `${direction} · ${city}`,
      course,
      finalPrice ? `До сплати: ${finalPrice.toLocaleString("uk-UA")} ₴${discountLabel ? ` (${discountLabel})` : ""}` : "",
      `Дата: ${eventDateLabel}`,
      `Ім’я: ${name}`,
      `Телефон: ${phone}`,
      "",
      "Координатор відділу продзвону зв’яжеться з вами для підтвердження участі та деталей збору.",
    ].filter(Boolean);

    feedback.textContent = summary.join("\n");
    playInterfaceTone();
    if (submitBtn) setTimeout(() => { submitBtn.disabled = false; }, 4000);
    if (savedToCms) {
      applicationForm.elements.name.value = "";
      applicationForm.elements.phone.value = "";
      applicationForm.elements.promo.value = "";
      updatePricePreview();
    }
  });
}

(() => {
  const navActions = document.querySelector(".topbar .nav-actions");
  if (navActions && !navActions.querySelector("[data-open-callback]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button button-small button-primary";
    btn.setAttribute("data-open-callback", "");
    btn.innerHTML = 'ЗВОРОТНИЙ ДЗВІНОК <span>↗</span>';
    navActions.append(btn);
  }

  let modal = document.querySelector("#callback-modal");
  if (!modal && document.body && !document.body.classList.contains("cms-admin-page")) {
    modal = document.createElement("div");
    modal.id = "callback-modal";
    modal.className = "callback-modal";
    modal.hidden = true;
    modal.style.cssText = "position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:20px;";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "callback-modal-title");
    modal.innerHTML = `
      <div class="callback-modal-backdrop" data-close-callback style="position:absolute;inset:0;background:rgba(6,7,9,.84);backdrop-filter:blur(5px);"></div>
      <div class="callback-modal-dialog" style="position:relative;z-index:1;width:min(540px,100%);max-height:92vh;overflow-y:auto;padding:28px 30px;border:1px solid rgba(255,255,255,.12);background:#101113;box-shadow:0 24px 64px rgba(0,0,0,.78);">
        <div class="callback-modal-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px;">
          <div>
            <div class="eyebrow"><span class="live-dot"></span> RESERVIST / ВІДДІЛ ПРОДЗВОНУ</div>
            <h2 id="callback-modal-title" style="margin:10px 0 0;font:700 clamp(26px,3.5vw,36px)/1 var(--display);">ЗВОРОТНИЙ <span style="color:var(--muted)">ДЗВІНОК</span></h2>
          </div>
          <button type="button" class="callback-modal-close" data-close-callback aria-label="Закрити вікно" style="width:34px;height:34px;flex:0 0 34px;border:1px solid var(--line);background:#0b0c0e;color:var(--muted);cursor:pointer;">✕</button>
        </div>
        <p class="callback-modal-lead" style="margin:0 0 20px;color:var(--muted);font-size:13px;line-height:1.7;">Залиште контакти та напишіть, що саме вас цікавить — координатор зателефонує, відповість на питання й допоможе підібрати курс або дату.</p>
        <form id="callback-modal-form" class="booking-form callback-modal-form" style="padding:0;border:0;background:transparent;">
          <div class="form-two-columns">
            <div>
              <label for="callback-name">ІМ’Я</label>
              <input id="callback-name" name="name" autocomplete="name" placeholder="Як до вас звертатися" required />
            </div>
            <div>
              <label for="callback-phone">НОМЕР ТЕЛЕФОНУ</label>
              <input id="callback-phone" name="phone" type="tel" autocomplete="tel" placeholder="+380…" required />
            </div>
          </div>
          <label for="callback-city">МІСТО</label>
          <input id="callback-city" name="city" placeholder="Напр. Київ, Львів, Дніпро" />
          <label for="callback-question">ПИТАННЯ АБО КУРС, ЯКИЙ ЦІКАВИТЬ</label>
          <textarea id="callback-question" name="question" rows="3" placeholder="Напр. Хочу підібрати курс з нуля або дізнатися про найближчі дати" style="width:100%;padding:11px 12px;margin:0 0 18px;background:#0b0c0e;color:var(--text);border:1px solid rgba(255,255,255,.11);border-radius:0;font:13px/1.6 var(--body);resize:vertical;"></textarea>
          <button type="submit" class="button button-primary form-submit">ЗАМОВИТИ ДЗВІНОК <span>↗</span></button>
          <div class="form-feedback" aria-live="polite"></div>
          <div class="callback-direct-links">
            <span>Зручніше написати в месенджер?</span>
            <a href="https://t.me/reservist_ua" target="_blank" rel="noreferrer" data-telegram-link>НАПИСАТИ В TELEGRAM ↗</a>
          </div>
        </form>
      </div>
    `;
    document.body.append(modal);
  }

  const openModal = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!modal) return;
    modal.hidden = false;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    modal.querySelector("#callback-name")?.focus();
    playInterfaceTone();
  };

  const closeModal = (e) => {
    if (e) e.preventDefault();
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.style.display = "none";
    document.body.style.overflow = "";
  };

  window.openCallbackModal = openModal;
  window.closeCallbackModal = closeModal;

  document.querySelectorAll("[data-open-callback]").forEach((el) => {
    el.addEventListener("click", openModal);
  });

  document.querySelectorAll("[data-close-callback]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("click", (e) => {
    const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement;
    if (!targetEl) return;
    if (targetEl.closest("[data-open-callback]")) {
      openModal(e);
      return;
    }
    if (targetEl.closest("[data-close-callback]")) {
      closeModal(e);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  const form = modal?.querySelector("#callback-modal-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const phoneEl = form.elements.phone;
    if (!isValidPhone(phoneEl.value)) {
      phoneEl.setCustomValidity("Вкажіть коректний номер телефону (мінімум 9 цифр).");
      phoneEl.reportValidity();
      phoneEl.setCustomValidity("");
      return;
    }
    const cbSubmit = form.querySelector(".form-submit");
    if (cbSubmit?.disabled) return;
    if (cbSubmit) cbSubmit.disabled = true;
    const name = form.elements.name.value.trim();
    const phone = form.elements.phone.value.trim();
    const city = form.elements.city.value.trim() || "Уточнюється";
    const question = form.elements.question.value.trim();
    const feedbackEl = form.querySelector(".form-feedback");

    const cms = window.ReservistCMSClient;
    if (cms?.isConfigured?.() && cms?.insert) {
      try {
        const inserted = await cms.insert("applications", {
          created_at: new Date().toISOString(),
          direction_slug: "consultation",
          program_slug: "",
          course_title: "Зворотний дзвінок",
          city,
          event_date: "",
          name,
          full_name: name,
          phone,
          promo: "",
          status: "new",
          amount_uah: 0,
          notes: question ? `Питання: ${question}` : "Запит на зворотний дзвінок із шапки сайту",
        });
        if (inserted?.[0]) cms.syncToGoogleSheets?.(inserted[0]);
      } catch (err) {
        console.warn("Callback save warning:", err);
      }
    }

    if (feedbackEl) {
      feedbackEl.textContent = `✓ Дякуємо, ${name}! Запит передано у відділ продзвону — координатор зателефонує на номер ${phone}.`;
    }
    form.reset();
    playInterfaceTone();
    if (cbSubmit) setTimeout(() => { cbSubmit.disabled = false; }, 4000);
  });
})();
