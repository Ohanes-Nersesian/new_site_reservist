(() => {
  const cms = window.ReservistCMSClient;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  // Дані заявок приходять від відвідувачів сайту — завжди екрануємо перед вставкою в HTML.
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
  // Захист від формульних ін’єкцій в Excel/Google Sheets (=, +, -, @ на початку клітинки).
  const csvSafe = (value) => {
    const text = String(value ?? "");
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  };
  const pageRoutes = {
    home: "index.html",
    booking: "booking.html",
    carbine: "directions/carbine.html",
    medicine: "directions/medicine.html",
    bootcamp: "directions/bootcamp.html",
    pistol: "directions/pistol.html",
    "open-storm": "directions/open-storm.html",
    "killhouse-cqb": "directions/killhouse-cqb.html",
  };
  const pageNames = {
    home: "Головна",
    booking: "Запис",
    carbine: "Карабін",
    medicine: "Тактична медицина",
    bootcamp: "Bootcamp",
    pistol: "Курс пістолет",
    "open-storm": "Open Storm Battle",
    "killhouse-cqb": "Killhouse CQB",
  };

  const loginView = $("#cms-login-view");
  const workspace = $("#cms-workspace");
  const loginForm = $("#cms-login-form");
  const loginMessage = $("#cms-login-message");
  const preview = $("#cms-preview");
  const pageSelect = $("#cms-page-select");
  const blocksList = $("#cms-block-list");
  const pageMessage = $("#cms-page-message");
  const sectionState = { sections: [], blocks: [], fields: {} };
  let activePage = pageSelect.value;
  let activeField = null;
  let directions = [];
  let instructors = [];
  let reviews = [];
  let activeDirectionSlug = "";
  let activeProgramSlug = "";
  let activeInstructorId = "";
  let activeReviewId = "";
  let activeEventId = "";
  let activeApplicationId = "";
  let activePromoId = "";
  let programs = [];
  let events = [];
  let applications = [];
  let promoCodes = [];
  let sheetsConfig = {
    id: true,
    webhook_url: "",
    auto_sync: true,
    access_mode: "anyone_edit",
    editor_emails: "",
    drive_folder_id: "",
    cohort_sheets: {},
  };
  let catalogDirty = false;

  const ukTranslitMap = {
    а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z",
    и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
    р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
    ь: "", ю: "iu", я: "ia", ы: "y", э: "e", ё: "io", ъ: "",
  };

  function slugifyUk(value) {
    const raw = String(value || "")
      .toLowerCase()
      .split("")
      .map((ch) => (ch in ukTranslitMap ? ukTranslitMap[ch] : ch))
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return raw || `course-${Date.now().toString(36).slice(-4)}`;
  }

  function switchTab(tabName) {
    $$(".cms-tabs [data-cms-tab]").forEach((item) => item.classList.toggle("is-active", item.dataset.cmsTab === tabName));
    $$(".cms-panel[data-cms-panel]").forEach((panel) => {
      const selected = panel.dataset.cmsPanel === tabName;
      panel.classList.toggle("is-active", selected);
      panel.hidden = !selected;
    });
  }

  function feedback(element, message, type = "") {
    element.textContent = message;
    element.classList.toggle("is-error", type === "error");
    element.classList.toggle("is-success", type === "success");
  }

  function setAuthenticated(isAuthenticated) {
    loginView.hidden = isAuthenticated;
    workspace.hidden = !isAuthenticated;
    $("#cms-signout").hidden = !isAuthenticated;
  }

  function assertSafeImageUrl(value) {
    if (!value) return "";
    if (/^data:image\/(jpeg|png|webp|avif);base64,/i.test(value)) return value;
    let url;
    try {
      url = new URL(value, location.href);
    } catch {
      throw new Error("Вкажіть коректну URL-адресу зображення.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:" && url.protocol !== "blob:") {
      throw new Error("Для зображення дозволені лише HTTP(S) адреси.");
    }
    return value;
  }

  function previewUrl(slug) {
    const route = pageRoutes[slug] || `directions/course.html?slug=${encodeURIComponent(slug)}&direction=${encodeURIComponent(slug)}`;
    return `${route}${route.includes("?") ? "&" : "?"}cmsPreview=1`;
  }

  function syncPageSelectWithDirections() {
    const previous = pageSelect.value || activePage;
    const basePages = [
      ["home", "Головна"],
      ["booking", "Запис"],
    ];
    directions.forEach((direction) => {
      if (!pageRoutes[direction.slug]) {
        pageRoutes[direction.slug] = `directions/course.html?slug=${encodeURIComponent(direction.slug)}&direction=${encodeURIComponent(direction.slug)}`;
      }
      pageNames[direction.slug] = direction.name;
      basePages.push([direction.slug, direction.name]);
    });
    pageSelect.replaceChildren(...basePages.map(([value, label]) => new Option(label, value)));
    if (basePages.some(([value]) => value === previous)) {
      pageSelect.value = previous;
    }
  }

  const targetOrigin = location.origin === "null" ? "*" : location.origin;

  async function checkAdmin() {
    if (!cms.currentSession()) {
      setAuthenticated(false);
      return;
    }
    try {
      if (await cms.isAdmin()) {
        setAuthenticated(true);
        await initializeWorkspace();
      } else {
        cms.signOut();
        feedback(loginMessage, "Для цього акаунта не надано роль адміністратора.", "error");
        setAuthenticated(false);
      }
    } catch (error) {
      cms.signOut();
      feedback(loginMessage, error.message, "error");
      setAuthenticated(false);
    }
  }

  async function initializeWorkspace() {
    await Promise.all([loadDirections(), loadInstructors(), loadReviews(), loadTheme()]);
    renderEventDirectionOptions();
    if (!eventForm.elements.date.value) resetEventForm();
    const qlForm = $("#cms-quick-launch-form");
    if (qlForm && !qlForm.elements.event_date.value) {
      qlForm.elements.event_date.value = dateString(nextSaturday());
    }
    await Promise.all([loadEvents(), loadSheetsConfig(), loadApplications(), loadPromoCodes()]);
    loadPreview(activePage);
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("button[type=submit]", loginForm);
    button.disabled = true;
    feedback(loginMessage, "Перевіряємо доступ…");
    try {
      const email = $("#cms-email").value.trim();
      const password = $("#cms-password").value;
      await cms.signIn(email, password);
      if (!(await cms.isAdmin())) {
        cms.signOut();
        throw new Error("Для цього акаунта не надано роль адміністратора.");
      }
      loginForm.reset();
      setAuthenticated(true);
      await initializeWorkspace();
    } catch (error) {
      feedback(loginMessage, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#cms-signout").addEventListener("click", () => {
    cms.signOut();
    setAuthenticated(false);
    feedback(loginMessage, "Сеанс завершено.");
  });

  $$(".cms-tabs [data-cms-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".cms-tabs [data-cms-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
      $$(".cms-panel[data-cms-panel]").forEach((panel) => {
        const selected = panel.dataset.cmsPanel === button.dataset.cmsTab;
        panel.classList.toggle("is-active", selected);
        panel.hidden = !selected;
      });
      if (button.dataset.cmsTab === "pages" && catalogDirty) {
        catalogDirty = false;
        preview.contentWindow?.location.reload();
      }
    });
  });

  $$(".cms-device-switch [data-device]").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".cms-device-switch [data-device]").forEach((item) => item.classList.toggle("is-active", item === button));
      preview.classList.toggle("is-tablet", button.dataset.device === "tablet");
      preview.classList.toggle("is-mobile", button.dataset.device === "mobile");
    });
  });

  function confirmDelete(message) {
    return window.confirm(message);
  }

  function loadPreview(slug) {
    activePage = slug;
    activeField = null;
    sectionState.sections = [];
    sectionState.blocks = [];
    sectionState.fields = {};
    blocksList.replaceChildren();
    $("#cms-field-editor").hidden = true;
    $("#cms-selection-empty").hidden = false;
    $("#cms-save-page").disabled = true;
    $("#cms-save-field").disabled = true;
    $("#cms-clear-field").disabled = true;
    $("#cms-edit-mode").checked = true;
    feedback(pageMessage, "Завантажуємо сторінку…");
    preview.src = previewUrl(slug);
  }

  pageSelect.addEventListener("change", () => loadPreview(pageSelect.value));

  function syncEditModeToPreview() {
    const enabled = $("#cms-edit-mode").checked;
    try {
      const doc = preview.contentDocument;
      if (doc?.body) doc.body.classList.toggle("cms-editing", enabled);
    } catch {
      // Ignore cross-origin frame access
    }
    preview.contentWindow?.postMessage({
      type: "reservist-cms-set-editing",
      enabled,
    }, targetOrigin);
  }

  preview.addEventListener("load", () => {
    preview.contentWindow?.postMessage({ type: "reservist-cms-get-sections" }, targetOrigin);
    syncEditModeToPreview();
  });

  $("#cms-edit-mode").addEventListener("change", () => {
    syncEditModeToPreview();
  });

  window.addEventListener("message", async (event) => {
    if (event.source !== preview.contentWindow || (location.origin !== "null" && event.origin !== location.origin)) return;
    if (event.data?.type === "reservist-cms-ready") {
      preview.contentWindow?.postMessage({ type: "reservist-cms-get-sections" }, targetOrigin);
      syncEditModeToPreview();
    }
    if (event.data?.type === "reservist-cms-sections" && event.data.page === activePage) {
      await loadPageRecord(event.data.sections);
    }
    if (event.data?.type === "reservist-cms-selection" && event.data.page === activePage) {
      selectField(event.data);
    }
  });

  async function loadPageRecord(sections) {
    const targetPage = activePage;
    try {
      const result = await cms.select("site_pages", { slug: `eq.${targetPage}`, limit: "1" });
      if (targetPage !== activePage) return;
      const record = result[0];
      sectionState.sections = sections;
      sectionState.blocks = Array.isArray(record?.blocks)
        ? record.blocks.filter((block) => sections.some((section) => section.id === block.id))
        : sections.map((section) => ({ id: section.id, visible: true, order: section.order }));
      sectionState.blocks = sections.map((section, index) => {
        const existing = sectionState.blocks.find((block) => block.id === section.id);
        return { id: section.id, visible: existing?.visible !== false, order: index };
      }).sort((a, b) => {
        const storedOrder = record?.blocks?.find((block) => block.id === a.id)?.order;
        const otherOrder = record?.blocks?.find((block) => block.id === b.id)?.order;
        return (Number.isInteger(storedOrder) ? storedOrder : a.order)
          - (Number.isInteger(otherOrder) ? otherOrder : b.order);
      });
      sectionState.fields = record?.content?.fields && typeof record.content.fields === "object"
        ? structuredClone(record.content.fields)
        : {};
      $("#cms-seo-title").value = record?.seo_title || "";
      $("#cms-seo-description").value = record?.seo_description || "";
      $("#cms-page-published").checked = record?.is_published !== false;
      if (!record) {
        try {
          const pageDocument = preview.contentDocument;
          $("#cms-seo-title").value = pageDocument?.title || "";
          $("#cms-seo-description").value = pageDocument?.querySelector('meta[name="description"]')?.content || "";
        } catch {
          // Ignore cross-origin frame access when opened via file://
        }
      }
      renderBlocks();
      $("#cms-save-page").disabled = sections.length === 0;
      feedback(pageMessage, record ? "Налаштування сторінки завантажено." : "Для цієї сторінки ще немає налаштувань CMS.");
    } catch (error) {
      if (targetPage !== activePage) return;
      $("#cms-save-page").disabled = true;
      feedback(pageMessage, `Не вдалося завантажити сторінку: ${error.message}`, "error");
    }
  }

  function renderBlocks() {
    blocksList.replaceChildren();
    sectionState.blocks.forEach((block, index) => {
      const section = sectionState.sections.find((item) => item.id === block.id);
      const item = document.createElement("li");
      item.className = "cms-block-item";

      const name = document.createElement("span");
      name.className = "cms-block-name";
      name.textContent = section?.title || block.id;
      item.append(name);

      const actions = document.createElement("span");
      actions.className = "cms-block-actions";
      for (const [label, offset] of [["↑", -1], ["↓", 1]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("aria-label", `${label === "↑" ? "Перемістити вгору" : "Перемістити вниз"}: ${name.textContent}`);
        button.disabled = index + offset < 0 || index + offset >= sectionState.blocks.length;
        button.addEventListener("click", () => {
          const next = index + offset;
          [sectionState.blocks[index], sectionState.blocks[next]] = [sectionState.blocks[next], sectionState.blocks[index]];
          sectionState.blocks.forEach((item, order) => { item.order = order; });
          renderBlocks();
          applyPreviewState();
        });
        actions.append(button);
      }
      item.append(actions);

      const visibility = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = block.visible !== false;
      checkbox.addEventListener("change", () => {
        block.visible = checkbox.checked;
        applyPreviewState();
      });
      visibility.append(checkbox, document.createTextNode(" ПОКАЗ"));
      item.append(visibility);
      blocksList.append(item);
    });
  }

  function applyPreviewState() {
    preview.contentWindow?.postMessage({
      type: "reservist-cms-apply",
      blocks: sectionState.blocks,
      content: { fields: sectionState.fields },
    }, targetOrigin);
  }

  const dynamicTabMeta = {
    team: ["⚡ Ця картка інструктора генерується з бази вкладки «КОМАНДА».", "ПЕРЕЙТИ ДО ВКЛАДКИ «КОМАНДА» ↗"],
    reviews: ["⚡ Блок відгуків керується у вкладці «ВІДГУКИ».", "ПЕРЕЙТИ ДО ВКЛАДКИ «ВІДГУКИ» ↗"],
    events: ["⚡ Розклад та івенти генеруються з бази вкладки «КАЛЕНДАР / ІВЕНТИ».", "ПЕРЕЙТИ ДО ВКЛАДКИ «КАЛЕНДАР / ІВЕНТИ» ↗"],
    courses: ["⚡ Картки напрямків і тарифів генеруються з бази вкладки «НАПРЯМКИ Й ПРОГРАМИ».", "ПЕРЕЙТИ ДО ВКЛАДКИ «НАПРЯМКИ Й ПРОГРАМИ» ↗"],
  };

  $("#cms-dynamic-tab-jump")?.addEventListener("click", () => {
    if (activeField?.dynamicTab) switchTab(activeField.dynamicTab);
  });

  function selectField(field) {
    activeField = field;
    $("#cms-selection-empty").hidden = true;
    $("#cms-field-editor").hidden = false;
    const dynNotice = $("#cms-dynamic-tab-notice");
    if (dynNotice) {
      const meta = field.dynamicTab ? dynamicTabMeta[field.dynamicTab] : null;
      dynNotice.hidden = !meta;
      if (meta) {
        $("#cms-dynamic-tab-text").textContent = meta[0];
        $("#cms-dynamic-tab-jump").textContent = meta[1];
      }
    }
    $("#cms-field-label").textContent = `ВИБРАНО: ${field.label}`;
    const stored = sectionState.fields[field.key];
    $("#cms-field-value").value = stored?.value ?? field.value;
    const isImage = field.kind === "image";
    const isHtml = field.kind === "html";
    $("#cms-field-value").hidden = isImage;
    $("#cms-field-value").rows = isHtml ? 5 : 3;
    $("#cms-image-alt-wrap").hidden = !isImage;
    $("#cms-image-upload-wrap").hidden = !isImage;
    $("#cms-save-field").textContent = isImage ? "ЗБЕРЕГТИ ЗОБРАЖЕННЯ" : "ЗБЕРЕГТИ ТЕКСТ";
    if (isHtml) {
      $("#cms-field-label").textContent = `ВИБРАНО: ${field.label} · дозволені теги: <br> <span> <strong> <em>`;
    }
    $("#cms-field-value").setAttribute("aria-label", field.label);
    $("#cms-image-alt").value = stored?.alt ?? field.alt ?? "";
    $("#cms-field-value").dataset.value = stored?.value ?? field.value;
    $("#cms-save-field").disabled = false;
    $("#cms-clear-field").disabled = false;
    $("#cms-field-editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (!isImage) $("#cms-field-value").focus({ preventScroll: true });
  }

  $("#cms-image-upload").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const url = await cms.uploadImage(file);
      $("#cms-field-value").dataset.value = url;
      $("#cms-image-alt").value ||= activeField?.alt || "";
      feedback(pageMessage, "Зображення завантажено. Збережіть його, щоб застосувати.", "success");
    } catch (error) {
      feedback(pageMessage, `Не вдалося завантажити зображення: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  });

  $("#cms-save-field").addEventListener("click", async () => {
    if (!activeField) return;
    const isImage = activeField.kind === "image";
    const value = isImage ? $("#cms-field-value").dataset.value || activeField.value : $("#cms-field-value").value;
    try {
      sectionState.fields[activeField.key] = isImage
        ? {
          type: "image",
          mode: activeField.mode,
          value: assertSafeImageUrl(value),
          alt: $("#cms-image-alt").value.trim(),
        }
        : { type: activeField.kind === "html" ? "html" : "text", value };
      await savePage();
      applyPreviewState();
      feedback(pageMessage, "Зміни елемента збережено.", "success");
    } catch (error) {
      feedback(pageMessage, `Не вдалося зберегти елемент: ${error.message}`, "error");
    }
  });

  $("#cms-clear-field").addEventListener("click", async () => {
    if (!activeField) return;
    delete sectionState.fields[activeField.key];
    try {
      await savePage();
      preview.src = previewUrl(activePage);
      $("#cms-field-editor").hidden = true;
      $("#cms-selection-empty").hidden = false;
      feedback(pageMessage, "Власне значення прибрано; відновлено оригінал сторінки.", "success");
    } catch (error) {
      feedback(pageMessage, `Не вдалося скинути значення: ${error.message}`, "error");
    }
  });

  $("#cms-reset-page").addEventListener("click", async () => {
    if (!confirmDelete(`Скинути всі зміни тексту та порядку блоків на сторінці «${pageNames[activePage] || activePage}» до оригіналу?`)) return;
    try {
      sectionState.fields = {};
      sectionState.blocks = sectionState.sections.map((section, index) => ({
        id: section.id,
        visible: true,
        order: index,
      }));
      $("#cms-page-published").checked = true;
      await cms.remove("site_pages", activePage, "slug");
      loadPreview(activePage);
      feedback(pageMessage, "Сторінку відновлено до початкового стану.", "success");
    } catch (error) {
      feedback(pageMessage, `Не вдалося скинути сторінку: ${error.message}`, "error");
    }
  });

  async function savePage() {
    const page = {
      slug: activePage,
      name: pageNames[activePage],
      is_published: $("#cms-page-published").checked,
      seo_title: $("#cms-seo-title").value.trim(),
      seo_description: $("#cms-seo-description").value.trim(),
      blocks: sectionState.blocks.map((block, order) => ({ id: block.id, visible: block.visible !== false, order })),
      content: { fields: sectionState.fields },
    };
    await cms.upsert("site_pages", [page], "slug");
  }

  $("#cms-save-page").addEventListener("click", async () => {
    try {
      await savePage();
      applyPreviewState();
      feedback(pageMessage, "Сторінку збережено.", "success");
    } catch (error) {
      feedback(pageMessage, `Не вдалося зберегти сторінку: ${error.message}`, "error");
    }
  });

  async function loadDirections() {
    try {
      directions = await cms.select("directions", { order: "sort_order.asc" });
      if (!activeDirectionSlug && directions[0]) {
        activeDirectionSlug = directions[0].slug;
        fillForm($("#cms-direction-form"), {
          ...directions[0],
          existing_slug: directions[0].slug,
          is_active: directions[0].is_active,
        });
      }
      renderDirections();
      renderDirectionOptions();
      renderEventDirectionOptions();
      syncPageSelectWithDirections();
      if (activeDirectionSlug && directions.some((item) => item.slug === activeDirectionSlug)) {
        await loadPrograms(activeDirectionSlug);
      }
    } catch (error) {
      feedback($("#cms-direction-form .cms-feedback"), `Не вдалося завантажити напрямки: ${error.message}`, "error");
    }
  }

  function renderDirections() {
    const list = $("#cms-direction-list");
    list.replaceChildren();
    directions.forEach((direction) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `cms-record-button${direction.slug === activeDirectionSlug ? " is-active" : ""}`;
      const name = document.createElement("strong");
      name.textContent = direction.name;
      const info = document.createElement("span");
      info.textContent = `${direction.slug} · ${direction.is_active ? "активний" : "вимкнений"}`;
      button.append(name, info);
      button.addEventListener("click", async () => {
        activeDirectionSlug = direction.slug;
        fillForm($("#cms-direction-form"), {
          ...direction,
          existing_slug: direction.slug,
          is_active: direction.is_active,
        });
        renderDirections();
        await loadPrograms(direction.slug);
      });
      list.append(button);
    });
  }

  function renderDirectionOptions() {
    const select = $('#cms-program-form [name="direction_slug"]');
    const previous = select.value || activeDirectionSlug;
    select.replaceChildren();
    directions.forEach((direction) => {
      const option = new Option(direction.name, direction.slug);
      select.add(option);
    });
    if (directions.some((item) => item.slug === previous)) select.value = previous;
  }

  $('#cms-program-form [name="direction_slug"]')?.addEventListener("change", async (event) => {
    const nextDirSlug = event.target.value;
    if (!nextDirSlug || nextDirSlug === activeDirectionSlug) return;
    activeDirectionSlug = nextDirSlug;
    const dir = directions.find((d) => d.slug === nextDirSlug);
    if (dir) {
      fillForm($("#cms-direction-form"), {
        ...dir,
        existing_slug: dir.slug,
        is_active: dir.is_active,
      });
    }
    renderDirections();
    await loadPrograms(nextDirSlug);
  });

  function fillForm(form, record) {
    for (const [name, value] of Object.entries(record)) {
      const field = form.elements.namedItem(name);
      if (!field) continue;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value ?? "";
    }
  }

  function clearRecordForm(form, defaults = {}) {
    form.reset();
    const existingSlugField = form.elements.namedItem("existing_slug");
    if (existingSlugField) {
      existingSlugField.value = "";
      existingSlugField.setAttribute("value", "");
    }
    const idField = form.elements.namedItem("id");
    if (idField) {
      idField.value = "";
      idField.setAttribute("value", "");
    }
    for (const [name, value] of Object.entries(defaults)) {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    }
    const status = $(".cms-feedback", form);
    if (status) feedback(status, "");
  }

  $("#cms-direction-form").elements.hero_image_file?.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const form = $("#cms-direction-form");
    try {
      form.elements.hero_image_url.value = await cms.uploadImage(file);
      feedback($(".cms-feedback", form), "Фото завантажено; натисніть «Зберегти напрямок».", "success");
    } catch (error) {
      feedback($(".cms-feedback", form), `Не вдалося завантажити фото: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  });

  $("#cms-program-form").elements.image_file?.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const form = $("#cms-program-form");
    try {
      form.elements.image_url.value = await cms.uploadImage(file);
      feedback($(".cms-feedback", form), "Фото завантажено; натисніть «Зберегти програму».", "success");
    } catch (error) {
      feedback($(".cms-feedback", form), `Не вдалося завантажити фото: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  });

  $("#cms-direction-form").elements.name.addEventListener("input", () => {
    const form = $("#cms-direction-form");
    if (!form.elements.existing_slug.value) {
      form.elements.slug.value = slugifyUk(form.elements.name.value);
      form.elements.seo_title.value = `${form.elements.name.value.trim()} — RESERVIST`;
    }
  });

  $("#cms-program-form").elements.name.addEventListener("input", () => {
    const form = $("#cms-program-form");
    if (!form.elements.existing_slug.value) {
      form.elements.slug.value = slugifyUk(form.elements.name.value);
    }
  });

  function setQuickLaunchOpen(open) {
    const card = $("#cms-quick-launch-card");
    const toggleBtn = $("#cms-toggle-quick-launch");
    if (!card) return;
    card.hidden = !open;
    if (toggleBtn) {
      toggleBtn.textContent = open
        ? "✕ ЗГОРНУТИ МАЙСТЕР ШВИДКОГО ЗАПУСКУ"
        : "⚡ СТВОРИТИ НОВИЙ КУРС / ГРУ В 1 КРОК";
    }
    if (open) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#cms-toggle-quick-launch")?.addEventListener("click", () => {
    const card = $("#cms-quick-launch-card");
    if (!card) return;
    setQuickLaunchOpen(card.hidden);
  });

  $("#cms-close-quick-launch")?.addEventListener("click", () => {
    setQuickLaunchOpen(false);
  });

  $("#cms-open-wizard-from-events")?.addEventListener("click", () => {
    switchTab("courses");
    setQuickLaunchOpen(true);
  });

  $("#cms-preset-airsoft")?.addEventListener("click", () => {
    const qf = $("#cms-quick-launch-form");
    if (!qf) return;
    qf.elements.name.value = "СТРАЙКБОЛ НА ВІДКРИТОМУ ПОЛІГОНІ";
    qf.elements.summary.value = "Відкритий полігон · 1 день · власне спорядження або прокат";
    qf.elements.cities.value = "Київ, Львів";
    qf.elements.duration_label.value = "1 день · Відкритий полігон";
    qf.elements.description.value = "Динамічна тактична страйкбольна гра на відкритому полігоні під керівництвом інструкторів RESERVIST. Сценарії штурму й оборони, робота в малих групах, радіозв’язок і післяматчевий розбір. Долучитися можна як із власним комплектом, так і з повним прокатним спорядженням.";
    qf.elements.hero_image_url.value = "assets/images/open-storm-field.webp";
    qf.elements.tariffs_text.value = [
      "Власне спорядження :: 1000 :: Квиток на полігон для гравців зі своїм комплектом та захистом",
      "Базовий прокат :: 2000 :: Квиток, страйкбольний привід AK/AR, магазин, кульки, ремінь та захист очей",
      "Повний прокат (Максимум) :: 2500 :: Усе включено: привід, форма, захист колін/ліктів, плитоноска та шолом",
    ].join("\n");
    qf.elements.event_date.value = dateString(nextSaturday());
    qf.elements.event_time.value = "09:00";
    qf.elements.event_venue.value = "Відкритий полігон (точку збору надає координатор)";
    qf.elements.repeat_weeks.value = "0";
    feedback($("#cms-quick-launch-feedback"), "Шаблон заповнено! Перевірте ціни/міста та натисніть «Створити курс, тарифи та подію в календарі».", "success");
  });

  $("#cms-quick-launch-form")?.elements.hero_image_file?.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const qf = $("#cms-quick-launch-form");
    try {
      qf.elements.hero_image_url.value = await cms.uploadImage(file);
      feedback($("#cms-quick-launch-feedback"), "Фото завантажено!", "success");
    } catch (error) {
      feedback($("#cms-quick-launch-feedback"), `Не вдалося завантажити фото: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  });

  $("#cms-quick-launch-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const qf = event.currentTarget;
    const status = $("#cms-quick-launch-feedback");
    try {
      const rawName = qf.elements.name.value.trim();
      if (!rawName) throw new Error("Введіть назву курсу або гри.");
      let dirSlug = slugifyUk(rawName);
      if (directions.some((d) => d.slug === dirSlug)) {
        dirSlug = `${dirSlug}-${Date.now().toString(36).slice(-3)}`;
      }
      const nextOrder = Math.max(0, ...directions.map((item) => Number(item.sort_order) || 0)) + 1;
      const cities = qf.elements.cities.value.trim() || "Київ";
      const durationLabel = qf.elements.duration_label.value.trim() || "1 день";
      const summary = qf.elements.summary.value.trim() || `${durationLabel} · ${cities}`;
      const description = qf.elements.description.value.trim() || summary;
      const heroUrl = assertSafeImageUrl(qf.elements.hero_image_url.value.trim()) || "assets/images/open-storm-field.webp";
      const defaultFaq = [
        "Чи можна взяти участь без попереднього досвіду? :: Так, перед початком інструктори проводять детальний брифінг із безпеки та правил взаємодії.",
        "Де саме проходить захід? :: Точну геолокацію полігону та час збору координатор надсилає підтвердженим учасникам.",
        "Як відбувається запис та оплата? :: Залиште заявку на сторінці — координатор відділу продзвону зв’яжеться з вами та підтвердить участь.",
      ].join("\n");

      const directionRecord = {
        slug: dirSlug,
        name: rawName.toUpperCase(),
        summary,
        cities,
        description,
        faq_text: defaultFaq,
        hero_image_url: heroUrl,
        seo_title: `${rawName} — RESERVIST`,
        seo_description: summary,
        sort_order: nextOrder,
        is_active: true,
      };
      await cms.upsert("directions", [directionRecord], "slug");

      const tariffLines = qf.elements.tariffs_text.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const parsedTariffs = tariffLines.length
        ? tariffLines.map((line, index) => {
          const parts = line.split("::").map((p) => p.trim());
          const tName = parts[0] || `Пакет ${index + 1}`;
          const tPrice = Number(String(parts[1] || "1500").replace(/[^\d]/g, "")) || 1500;
          const tDesc = parts[2] || description;
          return { name: tName, price_uah: tPrice, description: tDesc, sort_order: index + 1 };
        })
        : [{ name: rawName, price_uah: 1500, description, sort_order: 1 }];

      const createdPrograms = [];
      for (const tariff of parsedTariffs) {
        let progSlug = `${dirSlug}-${slugifyUk(tariff.name)}`;
        if (programs.some((p) => p.slug === progSlug) || createdPrograms.some((p) => p.slug === progSlug)) {
          progSlug = `${progSlug}-${tariff.sort_order}`;
        }
        const progRecord = {
          slug: progSlug,
          direction_slug: dirSlug,
          name: tariff.name,
          duration_label: durationLabel,
          price_uah: tariff.price_uah,
          description: tariff.description,
          specs_text: `Тривалість: ${durationLabel}\nЛокація: ${cities}\nСупровід: Інструктори RESERVIST`,
          image_url: heroUrl,
          sort_order: tariff.sort_order,
          is_active: true,
        };
        await cms.upsert("programs", [progRecord], "slug");
        createdPrograms.push(progRecord);
      }

      const eventDate = qf.elements.event_date.value;
      const eventTime = qf.elements.event_time.value || "09:00";
      const firstCity = cities.split(",")[0]?.trim() || "Київ";
      let createdEventsCount = 0;
      if (eventDate) {
        const repeats = Math.max(0, Math.min(12, Number(qf.elements.repeat_weeks.value) || 0));
        for (let week = 0; week <= repeats; week += 1) {
          const day = new Date(`${eventDate}T00:00:00`);
          day.setDate(day.getDate() + week * 7);
          await cms.insert("events", {
            direction_slug: dirSlug,
            program_slug: createdPrograms[0]?.slug || null,
            title: rawName,
            city: firstCity,
            starts_at: `${dateString(day)}T${eventTime}:00`,
            price_uah: createdPrograms[0]?.price_uah || 1500,
            venue: qf.elements.event_venue.value.trim() || "Локацію підтверджує координатор",
            is_active: true,
          });
          createdEventsCount += 1;
        }
      }

      activeDirectionSlug = dirSlug;
      catalogDirty = true;
      await loadDirections();
      await loadPrograms(dirSlug);
      await loadEvents();

      const courseUrl = `directions/course.html?slug=${encodeURIComponent(dirSlug)}&direction=${encodeURIComponent(dirSlug)}`;
      status.className = "cms-feedback is-success";
      status.innerHTML = `Готово! Створено напрямок «<strong>${esc(rawName)}</strong>», тарифів: ${createdPrograms.length}${createdEventsCount ? `, подій у календарі: ${createdEventsCount}` : ""}. <a href="${esc(courseUrl)}" target="_blank" rel="noreferrer" style="color:var(--cta);text-decoration:underline;margin-left:8px;">ВІДКРИТИ СТОРІНКУ КУРСУ ↗</a>`;
    } catch (error) {
      feedback(status, `Помилка швидкого створення: ${error.message}`, "error");
    }
  });

  $("#cms-new-direction").addEventListener("click", () => {
    const nextOrder = Math.max(0, ...directions.map((item) => Number(item.sort_order))) + 1;
    clearRecordForm($("#cms-direction-form"), { sort_order: nextOrder });
    $("#cms-direction-form").elements.is_active.checked = true;
    activeDirectionSlug = "";
    $("#cms-program-list").replaceChildren();
    renderDirections();
  });

  $("#cms-direction-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $(".cms-feedback", form);
    const existingSlug = form.elements.existing_slug.value;
    try {
      const nameVal = form.elements.name.value.trim();
      if (!nameVal) throw new Error("Введіть назву напрямку.");
      const slugVal = slugifyUk(form.elements.slug.value.trim() || nameVal);
      form.elements.slug.value = slugVal;
      const sortOrderVal = Math.max(1, Number(form.elements.sort_order.value) || directions.length + 1);
      form.elements.sort_order.value = sortOrderVal;
      const record = {
        slug: slugVal,
        name: nameVal,
        summary: form.elements.summary.value.trim() || "Практична програма підготовки RESERVIST",
        cities: form.elements.cities.value.trim() || "Київ",
        description: form.elements.description.value.trim(),
        faq_text: form.elements.faq_text.value.trim(),
        hero_image_url: assertSafeImageUrl(form.elements.hero_image_url.value.trim()) || null,
        seo_title: form.elements.seo_title.value.trim() || `${nameVal} — RESERVIST`,
        seo_description: form.elements.seo_description.value.trim() || form.elements.summary.value.trim(),
        sort_order: sortOrderVal,
        is_active: form.elements.is_active.checked,
      };
      const result = existingSlug
        ? await cms.update("directions", existingSlug, record, "slug")
        : await cms.upsert("directions", [record], "slug");
      if (!result?.length) throw new Error("Напрямок не знайдено або запис не збережено.");

      await loadAllPrograms();
      const hasAnyProgram = programs.some((p) => p.direction_slug === record.slug);
      if (!hasAnyProgram) {
        await cms.upsert("programs", [{
          slug: `${record.slug}-base`,
          direction_slug: record.slug,
          name: `${record.name} — Базовий пакет`,
          duration_label: "1 день",
          price_uah: 1500,
          description: record.summary || "Базовий пакет участі у програмі.",
          specs_text: `Локації: ${record.cities}\nФормат: Практичний вишкіл`,
          image_url: record.hero_image_url,
          sort_order: 1,
          is_active: true,
        }], "slug");
      }

      activeDirectionSlug = record.slug;
      catalogDirty = true;
      feedback(status, "Напрямок збережено.", "success");
      await loadDirections();
      await loadPrograms(record.slug);
    } catch (error) {
      feedback(status, `Помилка збереження напрямку: ${error.message}`, "error");
    }
  });

  $("#cms-delete-direction").addEventListener("click", async () => {
    const form = $("#cms-direction-form");
    const status = $(".cms-feedback", form);
    const slug = form.elements.existing_slug.value;
    if (!slug) return feedback(status, "Спочатку оберіть напрямок зі списку.", "error");
    const hasPrograms = programs.some((program) => program.direction_slug === slug);
    if (hasPrograms) {
      return feedback(status, "У напрямку є програми. Видаліть їх або просто вимкніть напрямок (галочка «Активний»).", "error");
    }
    if (!confirmDelete(`Видалити напрямок «${slug}»? Цю дію не можна скасувати.`)) return;
    try {
      await cms.remove("directions", slug, "slug");
      activeDirectionSlug = "";
      clearRecordForm(form, { sort_order: directions.length });
      catalogDirty = true;
      await loadDirections();
      feedback(status, "Напрямок видалено.", "success");
    } catch (error) {
      feedback(status, `Не вдалося видалити: ${error.message}`, "error");
    }
  });

  async function loadAllPrograms() {
    programs = await cms.select("programs", { order: "sort_order.asc" });
  }

  async function loadPrograms(directionSlug) {
    activeDirectionSlug = directionSlug;
    const select = $('#cms-program-form [name="direction_slug"]');
    if (directions.some((item) => item.slug === directionSlug)) select.value = directionSlug;
    const list = $("#cms-program-list");
    list.replaceChildren();
    if (!directionSlug) return;
    try {
      await loadAllPrograms();
      const directionPrograms = programs.filter((program) => program.direction_slug === directionSlug);
      const current = directionPrograms.find((program) => program.slug === activeProgramSlug) || directionPrograms[0];
      if (current) {
        activeProgramSlug = current.slug;
        fillForm($("#cms-program-form"), { ...current, existing_slug: current.slug });
      } else {
        activeProgramSlug = "";
        clearRecordForm($("#cms-program-form"), { direction_slug: directionSlug, sort_order: 1 });
        $("#cms-program-form").elements.is_active.checked = true;
      }
      directionPrograms.forEach((program) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `cms-record-button${program.slug === activeProgramSlug ? " is-active" : ""}`;
        const name = document.createElement("strong");
        name.textContent = program.name;
        const info = document.createElement("span");
        info.textContent = `${Number(program.price_uah).toLocaleString("uk-UA")} ₴ · ${program.duration_label}${program.is_active ? "" : " · вимкнена"}`;
        button.append(name, info);
        button.addEventListener("click", () => {
          activeProgramSlug = program.slug;
          fillForm($("#cms-program-form"), { ...program, existing_slug: program.slug });
          $(".cms-feedback", $("#cms-program-form")).textContent = "";
          list.querySelectorAll(".cms-record-button").forEach((item) => item.classList.toggle("is-active", item === button));
        });
        list.append(button);
      });
      renderEventProgramOptions();
    } catch (error) {
      const message = document.createElement("p");
      message.className = "cms-feedback is-error";
      message.textContent = `Не вдалося завантажити програми: ${error.message}`;
      list.append(message);
    }
  }

  $("#cms-new-program").addEventListener("click", () => {
    const fallbackDir = activeDirectionSlug || directions[0]?.slug || "";
    const count = programs.filter((program) => program.direction_slug === fallbackDir).length;
    activeProgramSlug = "";
    clearRecordForm($("#cms-program-form"), {
      direction_slug: fallbackDir,
      sort_order: count + 1,
    });
    $("#cms-program-form").elements.is_active.checked = true;
    $$("#cms-program-list .cms-record-button").forEach((item) => item.classList.remove("is-active"));
  });

  $("#cms-program-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $(".cms-feedback", form);
    const existingSlug = form.elements.existing_slug.value;
    try {
      const nameVal = form.elements.name.value.trim();
      if (!nameVal) throw new Error("Введіть назву програми або пакета.");
      const slugVal = slugifyUk(form.elements.slug.value.trim() || nameVal);
      form.elements.slug.value = slugVal;
      const sortOrderVal = Math.max(1, Number(form.elements.sort_order.value) || 1);
      form.elements.sort_order.value = sortOrderVal;
      const record = {
        slug: slugVal,
        direction_slug: form.elements.direction_slug.value || activeDirectionSlug || directions[0]?.slug || "",
        name: nameVal,
        duration_label: form.elements.duration_label.value.trim(),
        price_uah: Number(form.elements.price_uah.value),
        description: form.elements.description.value.trim(),
        specs_text: form.elements.specs_text.value.trim(),
        image_url: assertSafeImageUrl(form.elements.image_url.value.trim()) || null,
        sort_order: sortOrderVal,
        is_active: form.elements.is_active.checked,
      };
      const result = existingSlug
        ? await cms.update("programs", existingSlug, record, "slug")
        : await cms.upsert("programs", [record], "slug");
      if (!result?.length) throw new Error("Програму не знайдено або запис не збережено.");
      activeProgramSlug = record.slug;
      catalogDirty = true;
      feedback(status, "Програму збережено.", "success");
      await loadPrograms(record.direction_slug);
    } catch (error) {
      feedback(status, `Помилка збереження програми: ${error.message}`, "error");
    }
  });

  $("#cms-delete-program").addEventListener("click", async () => {
    const form = $("#cms-program-form");
    const status = $(".cms-feedback", form);
    const slug = form.elements.existing_slug.value;
    if (!slug) return feedback(status, "Спочатку оберіть програму зі списку.", "error");
    if (!confirmDelete(`Видалити програму «${form.elements.name.value}»? Краще просто вимкнути її, якщо на неї є заявки.`)) return;
    try {
      await cms.remove("programs", slug, "slug");
      activeProgramSlug = "";
      catalogDirty = true;
      clearRecordForm(form, { direction_slug: activeDirectionSlug });
      await loadPrograms(activeDirectionSlug);
      feedback(status, "Програму видалено.", "success");
    } catch (error) {
      feedback(status, `Не вдалося видалити: ${error.message}`, "error");
    }
  });

  async function loadInstructors() {
    try {
      instructors = await cms.select("instructors", { order: "sort_order.asc" });
      if (!activeInstructorId && instructors[0]) {
        activeInstructorId = instructors[0].id;
        fillForm($("#cms-instructor-form"), instructors[0]);
      }
      renderInstructors();
    } catch (error) {
      feedback($(".cms-feedback", $("#cms-instructor-form")), `Не вдалося завантажити команду: ${error.message}`, "error");
    }
  }

  function renderInstructors() {
    const list = $("#cms-instructor-list");
    list.replaceChildren();
    instructors.forEach((instructor) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `cms-record-button${instructor.id === activeInstructorId ? " is-active" : ""}`;
      const name = document.createElement("strong");
      name.textContent = instructor.callsign ? `${instructor.name} / ${instructor.callsign}` : instructor.name;
      const details = document.createElement("span");
      details.textContent = `${instructor.role || "Без зазначеної ролі"}${instructor.is_active ? "" : " · прихований"}`;
      button.append(name, details);
      button.addEventListener("click", () => {
        activeInstructorId = instructor.id;
        fillForm($("#cms-instructor-form"), instructor);
        $(".cms-feedback", $("#cms-instructor-form")).textContent = "";
        list.querySelectorAll(".cms-record-button").forEach((item) => item.classList.toggle("is-active", item === button));
      });
      list.append(button);
    });
  }

  $("#cms-delete-instructor").addEventListener("click", async () => {
    const form = $("#cms-instructor-form");
    const status = $(".cms-feedback", form);
    const id = form.elements.id.value;
    if (!id) return feedback(status, "Спочатку оберіть інструктора зі списку.", "error");
    if (!confirmDelete(`Видалити профіль «${form.elements.name.value}»?`)) return;
    try {
      await cms.remove("instructors", id);
      activeInstructorId = "";
      catalogDirty = true;
      clearRecordForm(form, { sort_order: instructors.length });
      form.elements.id.value = "";
      await loadInstructors();
      feedback(status, "Профіль видалено.", "success");
    } catch (error) {
      feedback(status, `Не вдалося видалити: ${error.message}`, "error");
    }
  });

  $("#cms-new-instructor").addEventListener("click", () => {
    activeInstructorId = "";
    clearRecordForm($("#cms-instructor-form"), { sort_order: instructors.length });
    $("#cms-instructor-form").elements.is_active.checked = true;
    $("#cms-instructor-form").elements.id.value = "";
    $$("#cms-instructor-list .cms-record-button").forEach((item) => item.classList.remove("is-active"));
  });

  $("#cms-instructor-form").elements.photo_file.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      $("#cms-instructor-form").elements.photo_url.value = await cms.uploadImage(file);
      feedback($(".cms-feedback", $("#cms-instructor-form")), "Фото завантажено; збережіть профіль.", "success");
    } catch (error) {
      feedback($(".cms-feedback", $("#cms-instructor-form")), `Не вдалося завантажити фото: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  });

  $("#cms-instructor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $(".cms-feedback", form);
    const id = form.elements.id.value;
    try {
      const record = {
        name: form.elements.name.value.trim(),
        callsign: form.elements.callsign.value.trim(),
        role: form.elements.role.value.trim(),
        bio: form.elements.bio.value.trim(),
        photo_url: assertSafeImageUrl(form.elements.photo_url.value.trim()) || null,
        sort_order: Number(form.elements.sort_order.value),
        is_active: form.elements.is_active.checked,
      };
      const result = id
        ? await cms.update("instructors", id, record)
        : await cms.insert("instructors", record);
      if (!result?.length) throw new Error("Профіль не збережено.");
      activeInstructorId = result[0]?.id || id;
      form.elements.id.value = activeInstructorId;
      catalogDirty = true;
      feedback(status, "Профіль збережено.", "success");
      await loadInstructors();
    } catch (error) {
      feedback(status, `Помилка збереження профілю: ${error.message}`, "error");
    }
  });

  // ---------- ВІДГУКИ ----------
  const reviewForm = $("#cms-review-form");
  const reviewListEl = $("#cms-review-list");

  async function loadReviews() {
    if (!reviewForm) return;
    try {
      reviews = await cms.select("reviews", { order: "sort_order.asc" });
      if (!activeReviewId && reviews[0]) {
        activeReviewId = reviews[0].id;
        fillForm(reviewForm, reviews[0]);
      }
      renderReviewsList();
    } catch (error) {
      reviews = [];
    }
  }

  function renderReviewsList() {
    if (!reviewListEl) return;
    reviewListEl.replaceChildren();
    reviews.forEach((rev) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cms-record-button${rev.id === activeReviewId ? " is-active" : ""}`;
      const title = document.createElement("strong");
      title.textContent = `${rev.author_name} · ${rev.course_name || "RESERVIST"}`;
      const meta = document.createElement("span");
      meta.textContent = `${"★".repeat(rev.rating || 5)} · ${rev.city || "—"}${rev.is_active ? " · активний" : " · прихований"}`;
      btn.append(title, meta);
      btn.addEventListener("click", () => {
        activeReviewId = rev.id;
        fillForm(reviewForm, rev);
        $(".cms-feedback", reviewForm).textContent = "";
        renderReviewsList();
      });
      reviewListEl.append(btn);
    });
  }

  $("#cms-new-review")?.addEventListener("click", () => {
    activeReviewId = "";
    clearRecordForm(reviewForm, { rating: 5, sort_order: reviews.length + 1 });
    reviewForm.elements.is_active.checked = true;
    reviewForm.elements.id.value = "";
    renderReviewsList();
  });

  reviewForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = reviewForm.elements;
    const status = $(".cms-feedback", reviewForm);
    try {
      const record = {
        author_name: f.author_name.value.trim(),
        course_name: f.course_name.value.trim(),
        city: f.city.value.trim(),
        rating: Math.max(1, Math.min(5, Number(f.rating.value) || 5)),
        text: f.text.value.trim(),
        sort_order: Math.max(1, Number(f.sort_order.value) || 1),
        is_active: f.is_active.checked,
      };
      const id = f.id.value;
      const result = id ? await cms.update("reviews", id, record) : await cms.insert("reviews", record);
      if (!result?.length) throw new Error("Відгук не збережено.");
      activeReviewId = result[0]?.id || id;
      f.id.value = activeReviewId;
      catalogDirty = true;
      await loadReviews();
      feedback(status, "Відгук збережено.", "success");
    } catch (error) {
      feedback(status, `Помилка збереження відгуку: ${error.message}`, "error");
    }
  });

  $("#cms-delete-review")?.addEventListener("click", async () => {
    const id = reviewForm?.elements.id.value;
    const status = $(".cms-feedback", reviewForm);
    if (!id) return feedback(status, "Спочатку оберіть відгук зі списку.", "error");
    if (!confirmDelete("Видалити цей відгук?")) return;
    try {
      await cms.remove("reviews", id);
      activeReviewId = "";
      clearRecordForm(reviewForm, { rating: 5, sort_order: reviews.length });
      reviewForm.elements.id.value = "";
      catalogDirty = true;
      await loadReviews();
      feedback(status, "Відгук видалено.", "success");
    } catch (error) {
      feedback(status, `Не вдалося видалити: ${error.message}`, "error");
    }
  });

  $("#cms-reviews-visible")?.addEventListener("change", async (e) => {
    const show = e.target.checked;
    try {
      const records = await cms.select("site_theme", { id: "eq.true", limit: "1" });
      const currentSettings = records[0]?.settings ?? {};
      await cms.upsert("site_theme", [{
        id: true,
        settings: { ...currentSettings, show_reviews: show },
      }], "id");
      catalogDirty = true;
      preview.contentWindow?.location.reload();
      feedback($(".cms-feedback", reviewForm), show ? "✓ Блок відгуків увімкнено на головній!" : "Блок відгуків приховано з головної.", "success");
    } catch (error) {
      feedback($(".cms-feedback", reviewForm), `Не вдалося змінити видимість: ${error.message}`, "error");
    }
  });

  async function loadTheme() {
    try {
      const records = await cms.select("site_theme", { id: "eq.true", limit: "1" });
      const settings = records[0]?.settings ?? {};
      const colors = {
        background: "#08090B",
        surface: "#121315",
        surfaceRaised: "#16181C",
        text: "#F1F3F7",
        muted: "#A3A6A8",
        brand: "#B7312C",
        cta: "#FF5722",
        status: "#10B981",
        ...settings.colors,
      };
      const form = $("#cms-theme-form");
      for (const [key, color] of Object.entries(colors)) {
        if (!/^#[\da-f]{6}$/i.test(color)) continue;
        form.elements[key].value = color;
        form.elements[`${key}_text`].value = color;
      }
      form.elements.heading.value = settings.fonts?.heading || "Oswald";
      form.elements.body.value = settings.fonts?.body || "system-ui";
      form.elements.phone.value = settings.contacts?.phone ?? "+380 63 734 33 29";
      form.elements.footer_tagline.value = settings.contacts?.footer_tagline ?? "ПІДГОТОВКА З ПОЗИЦІЄЮ. ПРАКТИКА З ВІДПОВІДАЛЬНІСТЮ.";
      form.elements.instagram_url.value = settings.contacts?.instagram_url ?? "https://www.instagram.com/reservist.ua";
      form.elements.telegram_url.value = settings.contacts?.telegram_url ?? "https://t.me/reservist_ua";
      const reviewsToggle = $("#cms-reviews-visible");
      if (reviewsToggle) reviewsToggle.checked = settings.show_reviews === true;
    } catch (error) {
      feedback($("#cms-theme-message"), `Не вдалося завантажити тему: ${error.message}`, "error");
    }
  }

  const themeForm = $("#cms-theme-form");
  $$("[data-color-text]", themeForm).forEach((input) => {
    const key = input.dataset.colorText;
    const colorPicker = themeForm.elements[key];
    colorPicker.addEventListener("input", () => { input.value = colorPicker.value.toUpperCase(); });
    input.addEventListener("input", () => {
      if (/^#[\da-f]{6}$/i.test(input.value)) colorPicker.value = input.value;
    });
  });

  $("#cms-save-theme").addEventListener("click", async () => {
    const colors = {};
    for (const key of ["background", "surface", "surfaceRaised", "text", "muted", "brand", "cta", "status"]) {
      const value = themeForm.elements[`${key}_text`].value.trim();
      if (!/^#[\da-f]{6}$/i.test(value)) {
        feedback($("#cms-theme-message"), `Колір «${key}» має бути у форматі #RRGGBB.`, "error");
        return;
      }
      colors[key] = value.toUpperCase();
    }
    try {
      const existingTheme = (await cms.select("site_theme", { id: "eq.true", limit: "1" }))?.[0]?.settings ?? {};
      await cms.upsert("site_theme", [{
        id: true,
        settings: {
          ...existingTheme,
          colors,
          fonts: {
            heading: themeForm.elements.heading.value,
            body: themeForm.elements.body.value,
          },
          show_reviews: $("#cms-reviews-visible")?.checked ?? existingTheme.show_reviews ?? false,
          contacts: {
            phone: themeForm.elements.phone.value.trim(),
            footer_tagline: themeForm.elements.footer_tagline.value.trim(),
            instagram_url: themeForm.elements.instagram_url.value.trim(),
            telegram_url: themeForm.elements.telegram_url.value.trim(),
          },
        },
      }], "id");
      catalogDirty = true;
      preview.contentWindow?.location.reload();
      feedback($("#cms-theme-message"), "Тему збережено й застосовано до перегляду.", "success");
    } catch (error) {
      feedback($("#cms-theme-message"), `Не вдалося зберегти тему: ${error.message}`, "error");
    }
  });

  const defaultThemeColors = {
    background: "#08090B",
    surface: "#121315",
    surfaceRaised: "#16181C",
    text: "#F1F3F7",
    muted: "#A3A6A8",
    brand: "#B7312C",
    cta: "#FF5722",
    status: "#10B981",
  };

  $("#cms-reset-theme").addEventListener("click", () => {
    for (const [key, color] of Object.entries(defaultThemeColors)) {
      themeForm.elements[key].value = color;
      themeForm.elements[`${key}_text`].value = color;
    }
    themeForm.elements.heading.value = "Oswald";
    themeForm.elements.body.value = "system-ui";
    themeForm.elements.phone.value = "+380 63 734 33 29";
    themeForm.elements.footer_tagline.value = "ПІДГОТОВКА З ПОЗИЦІЄЮ. ПРАКТИКА З ВІДПОВІДАЛЬНІСТЮ.";
    themeForm.elements.instagram_url.value = "";
    themeForm.elements.telegram_url.value = "";
    feedback($("#cms-theme-message"), "Стандартні значення підставлено. Натисніть «Зберегти тему», щоб застосувати.", "success");
  });

  // ---------- КАЛЕНДАР / ІВЕНТИ ----------
  const eventForm = $("#cms-event-form");
  const eventListEl = $("#cms-event-list");
  const eventStatus = $(".cms-feedback", eventForm);
  const pad2 = (value) => String(value).padStart(2, "0");
  const dateString = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  function nextSaturday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  }

  function directionName(slug) {
    return directions.find((item) => item.slug === slug)?.name || slug;
  }

  function renderEventProgramOptions() {
    const select = eventForm.elements.program_slug;
    const previous = select.value;
    const list = programs.filter((program) => program.direction_slug === eventForm.elements.direction_slug.value);
    select.replaceChildren(new Option("— без конкретної програми —", ""), ...list.map((program) => new Option(program.name, program.slug)));
    select.value = list.some((program) => program.slug === previous) ? previous : "";
  }

  function renderEventCities() {
    const direction = directions.find((item) => item.slug === eventForm.elements.direction_slug.value);
    const cities = (direction?.cities || "").split(",").map((city) => city.trim()).filter(Boolean);
    $("#cms-event-cities").replaceChildren(...cities.map((city) => {
      const option = document.createElement("option");
      option.value = city;
      return option;
    }));
  }

  function renderEventDirectionOptions() {
    const select = eventForm.elements.direction_slug;
    const previous = select.value;
    select.replaceChildren(
      ...directions.map((direction) => new Option(direction.name, direction.slug)),
      new Option("⚡ + Створити новий напрямок / гру прямо тут…", "__new__"),
    );
    select.value = directions.some((item) => item.slug === previous) || previous === "__new__"
      ? previous
      : directions[0]?.slug || "__new__";
    const newDirWrap = $("#cms-event-new-direction-wrap");
    if (newDirWrap) newDirWrap.hidden = select.value !== "__new__";
    const filter = $("#cms-event-filter-direction");
    const previousFilter = filter.value;
    filter.replaceChildren(new Option("Усі", "all"), ...directions.map((direction) => new Option(direction.name, direction.slug)));
    filter.value = directions.some((item) => item.slug === previousFilter) ? previousFilter : "all";
    renderEventProgramOptions();
    renderEventCities();
  }

  function renderEvents() {
    eventListEl.replaceChildren();
    const directionFilter = $("#cms-event-filter-direction").value;
    const timeFilter = $("#cms-event-filter-time").value;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const filtered = events
      .filter((item) => directionFilter === "all" || item.direction_slug === directionFilter)
      .filter((item) => {
        const isPast = new Date(item.starts_at) < startOfToday;
        return timeFilter === "all" || (timeFilter === "past" ? isPast : !isPast);
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    if (timeFilter === "past") filtered.reverse();

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "cms-note";
      empty.textContent = "Івентів не знайдено. Натисніть «+ Новий івент».";
      eventListEl.append(empty);
      return;
    }

    filtered.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      const isPast = new Date(item.starts_at) < startOfToday;
      button.className = `cms-record-button${item.id === activeEventId ? " is-active" : ""}${isPast ? " is-past" : ""}${item.is_active === false ? " is-hidden-record" : ""}`;
      const when = new Intl.DateTimeFormat("uk-UA", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
        .format(new Date(item.starts_at));
      const date = document.createElement("span");
      date.className = "cms-event-date";
      date.textContent = `${when.toUpperCase()} · ${String(item.starts_at).slice(11, 16)}`;
      const name = document.createElement("strong");
      name.textContent = item.title;
      const info = document.createElement("span");
      info.textContent = `${item.city} · ${directionName(item.direction_slug)}${item.price_uah ? ` · ${Number(item.price_uah).toLocaleString("uk-UA")} ₴` : ""}`;
      button.append(date, name, info);
      button.addEventListener("click", () => {
        activeEventId = item.id;
        fillEventForm(item);
        renderEvents();
      });
      eventListEl.append(button);
    });
  }

  function fillEventForm(item) {
    eventForm.elements.direction_slug.value = item.direction_slug;
    const newDirWrap = $("#cms-event-new-direction-wrap");
    if (newDirWrap) newDirWrap.hidden = true;
    renderEventProgramOptions();
    renderEventCities();
    fillForm(eventForm, {
      ...item,
      program_slug: item.program_slug || "",
      date: String(item.starts_at).slice(0, 10),
      time: String(item.starts_at).slice(11, 16),
      repeat_weeks: 0,
    });
    feedback(eventStatus, "");
  }

  function resetEventForm() {
    activeEventId = "";
    eventForm.reset();
    eventForm.elements.id.value = "";
    eventForm.elements.date.value = dateString(nextSaturday());
    eventForm.elements.time.value = "09:00";
    eventForm.elements.repeat_weeks.value = 0;
    eventForm.elements.is_active.checked = true;
    const newDirWrap = $("#cms-event-new-direction-wrap");
    if (newDirWrap) newDirWrap.hidden = true;
    renderEventDirectionOptions();
    feedback(eventStatus, "");
  }

  let eventsAutoSelected = false;
  async function loadEvents() {
    try {
      events = await cms.select("events", { order: "starts_at.asc" });
      if (!eventsAutoSelected && !activeEventId) {
        eventsAutoSelected = true;
        const todayKey = dateString(new Date());
        const firstUpcoming = events.find((ev) => String(ev.starts_at || "").slice(0, 10) >= todayKey);
        if (firstUpcoming) {
          activeEventId = firstUpcoming.id;
          fillEventForm(firstUpcoming);
        }
      }
    } catch (error) {
      events = [];
      feedback(eventStatus, `Не вдалося завантажити івенти: ${error.message}`, "error");
    }
    renderEvents();
    renderAppEventQuickPick();
  }

  eventForm.elements.direction_slug.addEventListener("change", () => {
    const isNew = eventForm.elements.direction_slug.value === "__new__";
    const newDirWrap = $("#cms-event-new-direction-wrap");
    if (newDirWrap) newDirWrap.hidden = !isNew;
    renderEventProgramOptions();
    renderEventCities();
  });

  eventForm.elements.new_direction_name?.addEventListener("input", () => {
    if (!eventForm.elements.title.value || eventForm.elements.direction_slug.value === "__new__") {
      eventForm.elements.title.value = eventForm.elements.new_direction_name.value;
    }
  });

  eventForm.elements.program_slug.addEventListener("change", () => {
    const program = programs.find((item) => item.slug === eventForm.elements.program_slug.value);
    if (!program) return;
    eventForm.elements.title.value = program.name;
    eventForm.elements.price_uah.value = program.price_uah;
  });

  $("#cms-event-filter-direction").addEventListener("change", renderEvents);
  $("#cms-event-filter-time").addEventListener("change", renderEvents);
  $("#cms-new-event").addEventListener("click", () => {
    resetEventForm();
    renderEvents();
  });

  eventForm.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const f = eventForm.elements;
    try {
      let targetDirectionSlug = f.direction_slug.value;
      let targetProgramSlug = f.program_slug.value || null;
      const eventCity = f.city.value.trim() || "Київ";
      const eventPrice = f.price_uah.value === "" ? 1500 : Number(f.price_uah.value);

      if (targetDirectionSlug === "__new__") {
        const newDirName = (f.new_direction_name?.value || f.title.value || "").trim();
        if (!newDirName) throw new Error("Введіть назву нового напрямку або гри.");
        let dirSlug = slugifyUk(newDirName);
        if (directions.some((d) => d.slug === dirSlug)) {
          dirSlug = `${dirSlug}-${Date.now().toString(36).slice(-3)}`;
        }
        const summary = f.new_direction_summary?.value.trim() || `Відкритий полігон · ${eventCity}`;
        const nextOrder = Math.max(0, ...directions.map((item) => Number(item.sort_order) || 0)) + 1;
        await cms.upsert("directions", [{
          slug: dirSlug,
          name: newDirName.toUpperCase(),
          summary,
          cities: eventCity,
          description: summary,
          faq_text: [
            "Чи можна взяти участь без попереднього досвіду? :: Так, перед початком інструктори проводять детальний брифінг із безпеки та правил.",
            "Де саме проходить захід? :: Точну геолокацію та час збору координатор надсилає підтвердженим учасникам.",
          ].join("\n"),
          hero_image_url: "assets/images/open-storm-field.webp",
          seo_title: `${newDirName} — RESERVIST`,
          seo_description: summary,
          sort_order: nextOrder,
          is_active: true,
        }], "slug");

        const progSlug = `${dirSlug}-ticket`;
        await cms.upsert("programs", [{
          slug: progSlug,
          direction_slug: dirSlug,
          name: f.title.value.trim() || newDirName,
          duration_label: "1 день",
          price_uah: eventPrice || 1500,
          description: summary,
          specs_text: `Локація: ${eventCity}\nСупровід: Інструктори RESERVIST`,
          image_url: "assets/images/open-storm-field.webp",
          sort_order: 1,
          is_active: true,
        }], "slug");

        targetDirectionSlug = dirSlug;
        targetProgramSlug = progSlug;
        await loadDirections();
        await loadAllPrograms();
        f.direction_slug.value = dirSlug;
        const newDirWrap = $("#cms-event-new-direction-wrap");
        if (newDirWrap) newDirWrap.hidden = true;
      }

      if (!targetDirectionSlug) throw new Error("Спочатку створіть напрямок.");
      const base = {
        direction_slug: targetDirectionSlug,
        program_slug: targetProgramSlug,
        title: f.title.value.trim(),
        city: eventCity,
        price_uah: f.price_uah.value === "" ? null : Number(f.price_uah.value),
        venue: f.venue.value.trim(),
        is_active: f.is_active.checked,
      };
      const id = f.id.value;
      let message;
      if (id) {
        const result = await cms.update("events", id, { ...base, starts_at: `${f.date.value}T${f.time.value}:00` });
        if (!result?.length) throw new Error("Івент не знайдено або не збережено.");
        message = "Івент збережено.";
      } else {
        const repeats = Math.max(0, Math.min(26, Number(f.repeat_weeks.value) || 0));
        const created = [];
        for (let week = 0; week <= repeats; week += 1) {
          const day = new Date(`${f.date.value}T00:00:00`);
          day.setDate(day.getDate() + week * 7);
          const result = await cms.insert("events", { ...base, starts_at: `${dateString(day)}T${f.time.value}:00` });
          created.push(result?.[0]);
        }
        activeEventId = created[0]?.id || "";
        f.id.value = activeEventId;
        f.repeat_weeks.value = 0;
        message = created.length > 1 ? `Створено івентів: ${created.length}.` : "Івент створено.";
      }
      if (id) activeEventId = id;
      catalogDirty = true;
      await loadEvents();
      feedback(eventStatus, message, "success");
    } catch (error) {
      feedback(eventStatus, `Помилка збереження івенту: ${error.message}`, "error");
    }
  });

  $("#cms-duplicate-event").addEventListener("click", () => {
    const f = eventForm.elements;
    if (!f.title.value) return feedback(eventStatus, "Спочатку оберіть або заповніть івент.", "error");
    const day = new Date(`${f.date.value || dateString(nextSaturday())}T00:00:00`);
    day.setDate(day.getDate() + 7);
    f.id.value = "";
    activeEventId = "";
    f.date.value = dateString(day);
    renderEvents();
    feedback(eventStatus, "Створено чернетку копії (+7 днів). Змініть дані за потреби й натисніть «Зберегти івент».", "success");
  });

  $("#cms-delete-event").addEventListener("click", async () => {
    const id = eventForm.elements.id.value;
    if (!id) return feedback(eventStatus, "Спочатку оберіть івент зі списку.", "error");
    if (!confirmDelete("Видалити цей івент із календаря?")) return;
    try {
      await cms.remove("events", id);
      catalogDirty = true;
      resetEventForm();
      await loadEvents();
      feedback(eventStatus, "Івент видалено.", "success");
    } catch (error) {
      feedback(eventStatus, `Не вдалося видалити: ${error.message}`, "error");
    }
  });

  // ---------- ЗАЯВКИ, СПИСКИ ГРУП (ФІНАНСИСТ) ТА ПРОМОКОДИ ----------
  const appForm = $("#cms-application-form");
  const appListEl = $("#cms-application-list");
  const promoForm = $("#cms-promo-form");
  const promoListEl = $("#cms-promo-list");

  const statusLabels = {
    new: "Нова (потрібен дзвінок)",
    calling: "У роботі (продзвін)",
    paid: "Підтверджено / Оплачено",
    cancelled: "Скасовано",
  };

  $$(".cms-subview-btn[data-apps-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".cms-subview-btn[data-apps-view]").forEach((item) => item.classList.toggle("is-active", item === btn));
      const view = btn.dataset.appsView;
      $("#cms-apps-view-callcenter").hidden = view !== "callcenter";
      $("#cms-apps-view-finance").hidden = view !== "finance";
      const sheetsView = $("#cms-apps-view-sheets");
      if (sheetsView) sheetsView.hidden = view !== "sheets";
      $("#cms-apps-view-promos").hidden = view !== "promos";
      if (view === "finance") renderFinanceRoster();
      if (view === "sheets") updateGasCodePreview();
    });
  });

  const accessModeLabels = {
    anyone_edit: "🔓 Доступ за посиланням: РЕДАКТОР",
    anyone_view: "👁 Доступ за посиланням: ПЕРЕГЛЯД",
    restricted: "🔒 Закритий доступ (за Email команди)",
  };

  async function loadSheetsConfig() {
    try {
      const rows = await cms.select("sheets_config", { id: "eq.true", limit: "1" });
      if (rows?.[0]) {
        sheetsConfig = {
          id: true,
          webhook_url: "",
          auto_sync: true,
          access_mode: "anyone_edit",
          editor_emails: "",
          drive_folder_id: "",
          cohort_sheets: {},
          ...rows[0],
        };
      }
      const form = $("#cms-sheets-config-form");
      if (form) {
        form.elements.access_mode.value = sheetsConfig.access_mode || "anyone_edit";
        form.elements.editor_emails.value = sheetsConfig.editor_emails || "";
        form.elements.drive_folder_id.value = sheetsConfig.drive_folder_id || "";
        form.elements.webhook_url.value = sheetsConfig.webhook_url || "";
      }
      updateGasCodePreview();
    } catch (error) {
      console.warn("Could not load sheets_config:", error);
    }
  }

  function updateGasCodePreview() {
    const previewEl = $("#cms-gas-code-preview");
    const form = $("#cms-sheets-config-form");
    if (!previewEl || !cms.getGoogleAppsScriptCode) return;
    const settings = {
      access_mode: form?.elements.access_mode?.value || sheetsConfig.access_mode || "anyone_edit",
      editor_emails: form?.elements.editor_emails?.value?.trim() ?? sheetsConfig.editor_emails ?? "",
      drive_folder_id: form?.elements.drive_folder_id?.value?.trim() ?? sheetsConfig.drive_folder_id ?? "",
    };
    previewEl.value = cms.getGoogleAppsScriptCode(settings);
  }

  $("#cms-sheets-config-form")?.addEventListener("input", updateGasCodePreview);
  $("#cms-sheets-config-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const statusEl = $("#cms-sheets-config-feedback");
    try {
      sheetsConfig = {
        ...sheetsConfig,
        id: true,
        access_mode: form.elements.access_mode.value || "anyone_edit",
        editor_emails: form.elements.editor_emails.value.trim(),
        drive_folder_id: form.elements.drive_folder_id.value.trim(),
        webhook_url: form.elements.webhook_url.value.trim(),
      };
      await cms.upsert("sheets_config", [sheetsConfig], "id");
      updateGasCodePreview();
      renderFinanceRoster();
      feedback(statusEl, "✓ Налаштування доступу збережено! Кожна нова таблиця івенту після першої оплати отримуватиме ці доступи автоматично.", "success");
    } catch (error) {
      feedback(statusEl, `Помилка збереження: ${error.message}`, "error");
    }
  });

  $("#cms-copy-gas-code")?.addEventListener("click", async () => {
    updateGasCodePreview();
    const previewEl = $("#cms-gas-code-preview");
    const statusEl = $("#cms-gas-copy-feedback");
    if (!previewEl) return;
    try {
      await navigator.clipboard.writeText(previewEl.value);
      feedback(statusEl, "✓ Код Google Apps Script скопійовано в буфер обміну!", "success");
    } catch {
      previewEl.select();
      feedback(statusEl, "Код виділено — натисніть Cmd+C (або Ctrl+C), щоб скопіювати.", "success");
    }
  });

  function normalizeApp(item) {
    return {
      ...item,
      name: item.name || item.full_name || "Без імені",
      promo: item.promo ?? item.promo_code ?? "",
      amount_uah: Number(item.amount_uah ?? item.paid_amount ?? 0),
      status: item.status || "new",
    };
  }

  function renderAppsStats() {
    const statsEl = $("#cms-apps-stats");
    if (!statsEl) return;
    const total = applications.length;
    const newCount = applications.filter((a) => a.status === "new").length;
    const callingCount = applications.filter((a) => a.status === "calling").length;
    const paidApps = applications.filter((a) => a.status === "paid");
    const totalPaidUah = paidApps.reduce((sum, a) => sum + (Number(a.amount_uah) || 0), 0);

    const badge = $("#cms-new-apps-badge");
    if (badge) {
      badge.textContent = String(newCount);
      badge.hidden = newCount === 0;
    }

    statsEl.innerHTML = `
      <div class="cms-stat-card is-accent"><span>НОВІ ЗАЯВКИ (ОЧІКУЮТЬ ДЗВІНКА)</span><strong>${newCount}</strong></div>
      <div class="cms-stat-card"><span>У РОБОТІ (ВІДДІЛ ПРОДЗВОНУ)</span><strong>${callingCount}</strong></div>
      <div class="cms-stat-card is-green"><span>ПІДТВЕРДЖЕНО / ОПЛАЧЕНО</span><strong>${paidApps.length}</strong></div>
      <div class="cms-stat-card is-green"><span>КАСА ПІДТВЕРДЖЕНИХ НАБОРІВ</span><strong>${totalPaidUah.toLocaleString("uk-UA")} ₴</strong></div>
      <div class="cms-stat-card"><span>УСЬОГО ЗАЯВОК У БАЗІ</span><strong>${total}</strong></div>
    `;
  }

  function renderAppDirectionOptions() {
    if (!appForm) return;
    const select = appForm.elements.direction_slug;
    const previous = select.value;
    select.replaceChildren(
      new Option("📞 Консультація / Підбір курсу", "consultation"),
      ...directions.map((d) => new Option(d.name, d.slug)),
    );
    if (previous) select.value = previous;

    const filter = $("#cms-app-filter-direction");
    if (filter) {
      const prevFilter = filter.value;
      filter.replaceChildren(
        new Option("Усі напрямки та консультації", "all"),
        new Option("📞 Лише запити на консультацію", "consultation"),
        ...directions.map((d) => new Option(d.name, d.slug)),
      );
      if (prevFilter) filter.value = prevFilter;
    }
    renderAppProgramOptions();
  }

  function renderAppProgramOptions() {
    if (!appForm) return;
    const select = appForm.elements.program_slug;
    const previous = select.value;
    const dirSlug = appForm.elements.direction_slug.value;
    const list = programs.filter((p) => p.direction_slug === dirSlug);
    select.replaceChildren(
      new Option("— Не обрано / Загальна консультація —", ""),
      ...list.map((p) => new Option(`${p.name} (${Number(p.price_uah).toLocaleString("uk-UA")} ₴)`, p.slug)),
    );
    if (list.some((p) => p.slug === previous)) select.value = previous;
    renderAppEventQuickPick();
  }

  function renderAppEventQuickPick() {
    if (!appForm || !appForm.elements.quick_event_pick) return;
    const pickSelect = appForm.elements.quick_event_pick;
    const dirSlug = appForm.elements.direction_slug.value;
    const nowKey = dateString(new Date());
    const matchingEvents = events
      .filter((ev) => {
        if (ev.is_active === false) return false;
        const dKey = String(ev.starts_at || "").slice(0, 10);
        if (dKey && dKey < nowKey) return false;
        if (dirSlug && dirSlug !== "consultation" && ev.direction_slug !== dirSlug) return false;
        return true;
      })
      .sort((a, b) => String(a.starts_at || "").localeCompare(String(b.starts_at || "")));

    pickSelect.replaceChildren(
      new Option(
        matchingEvents.length
          ? "— Оберіть заплановану дату з календаря (підставить місто, дату і суму) —"
          : "— Для цього напрямку немає майбутніх дат у календарі (вкажіть нижче вручну) —",
        "",
      ),
      ...matchingEvents.map((ev) => {
        const dKey = String(ev.starts_at || "").slice(0, 10);
        const tKey = String(ev.starts_at || "").slice(11, 16);
        const priceStr = ev.price_uah ? ` · ${Number(ev.price_uah).toLocaleString("uk-UA")} ₴` : "";
        return new Option(`${dKey} (${tKey}) · ${ev.city} · ${ev.title}${priceStr}`, ev.id);
      }),
    );
  }

  appForm?.elements.quick_event_pick?.addEventListener("change", () => {
    const evId = appForm.elements.quick_event_pick.value;
    const ev = events.find((item) => String(item.id) === String(evId));
    if (!ev) return;
    if (ev.direction_slug && appForm.elements.direction_slug.value !== ev.direction_slug) {
      appForm.elements.direction_slug.value = ev.direction_slug;
      renderAppProgramOptions();
    }
    if (ev.program_slug && [...appForm.elements.program_slug.options].some((o) => o.value === ev.program_slug)) {
      appForm.elements.program_slug.value = ev.program_slug;
    }
    if (ev.city) appForm.elements.city.value = ev.city;
    const dKey = String(ev.starts_at || "").slice(0, 10);
    if (dKey) appForm.elements.event_date.value = dKey;
    const prog = programs.find((p) => p.slug === appForm.elements.program_slug.value);
    const price = Number(ev.price_uah || prog?.price_uah || 0);
    if (price > 0) appForm.elements.amount_uah.value = price;
  });

  appForm?.elements.direction_slug?.addEventListener("change", renderAppProgramOptions);
  appForm?.elements.program_slug?.addEventListener("change", () => {
    const prog = programs.find((p) => p.slug === appForm.elements.program_slug.value);
    if (prog && (!appForm.elements.amount_uah.value || Number(appForm.elements.amount_uah.value) === 0)) {
      appForm.elements.amount_uah.value = prog.price_uah;
    }
  });

  function renderApplicationsList() {
    if (!appListEl) return;
    appListEl.replaceChildren();
    const statusFilter = $("#cms-app-filter-status")?.value || "all";
    const dirFilter = $("#cms-app-filter-direction")?.value || "all";
    const searchQuery = ($("#cms-app-search")?.value || "").trim().toLowerCase();

    const filtered = applications.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (dirFilter !== "all" && (item.direction_slug || "consultation") !== dirFilter) return false;
      if (searchQuery) {
        const hay = `${item.name} ${item.phone} ${item.city || ""} ${item.notes || ""}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "cms-note";
      empty.textContent = "Заявок за цим фільтром не знайдено.";
      appListEl.append(empty);
      return;
    }

    filtered.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cms-record-button${item.id === activeApplicationId ? " is-active" : ""}`;
      const pill = document.createElement("span");
      pill.className = `cms-status-pill is-${item.status || "new"}`;
      pill.textContent = statusLabels[item.status] || item.status;
      const strong = document.createElement("strong");
      strong.textContent = `${item.name} · ${item.phone}`;
      const meta = document.createElement("span");
      const dirLabel = item.direction_slug && item.direction_slug !== "consultation"
        ? directionName(item.direction_slug)
        : "Консультація / Підбір курсу";
      meta.textContent = [
        dirLabel,
        item.city,
        item.event_date ? `Дата: ${item.event_date}` : "",
        item.amount_uah ? `${Number(item.amount_uah).toLocaleString("uk-UA")} ₴` : "",
      ].filter(Boolean).join(" · ");
      btn.append(pill, strong, meta);
      btn.addEventListener("click", () => {
        activeApplicationId = item.id;
        fillApplicationForm(item);
        renderApplicationsList();
      });
      appListEl.append(btn);
    });
  }

  function fillApplicationForm(item) {
    if (!appForm) return;
    renderAppDirectionOptions();
    appForm.elements.direction_slug.value = item.direction_slug || "consultation";
    renderAppProgramOptions();
    fillForm(appForm, {
      id: item.id,
      name: item.name,
      phone: item.phone,
      status: item.status || "new",
      caller_name: item.caller_name || "",
      direction_slug: item.direction_slug || "consultation",
      program_slug: item.program_slug || "",
      city: item.city || "",
      event_date: item.event_date || "",
      amount_uah: item.amount_uah ?? 0,
      promo: item.promo || "",
      notes: item.notes || "",
    });
    feedback($(".cms-feedback", appForm), "");
  }

  function resetApplicationForm() {
    if (!appForm) return;
    activeApplicationId = "";
    appForm.reset();
    appForm.elements.id.value = "";
    renderAppDirectionOptions();
    appForm.elements.status.value = "new";
    appForm.elements.amount_uah.value = 0;
    feedback($(".cms-feedback", appForm), "");
  }

  async function loadApplications() {
    try {
      const raw = await cms.select("applications", { order: "created_at.desc" });
      applications = raw.map(normalizeApp);
      renderAppsStats();
      renderAppDirectionOptions();
      if (!activeApplicationId && applications[0]) {
        activeApplicationId = applications[0].id;
        fillApplicationForm(applications[0]);
      }
      renderApplicationsList();
      renderFinanceRoster();
    } catch (error) {
      applications = [];
      console.warn("Could not load applications:", error);
    }
  }

  $("#cms-app-filter-status")?.addEventListener("change", renderApplicationsList);
  $("#cms-app-filter-direction")?.addEventListener("change", renderApplicationsList);
  $("#cms-app-search")?.addEventListener("input", renderApplicationsList);
  $("#cms-new-application")?.addEventListener("click", () => {
    resetApplicationForm();
    renderApplicationsList();
  });

  async function saveApplicationFromForm(forceStatus = null) {
    const f = appForm.elements;
    const statusEl = $(".cms-feedback", appForm);
    try {
      if (forceStatus) f.status.value = forceStatus;
      const prog = programs.find((p) => p.slug === f.program_slug.value);
      let eventDateVal = f.event_date.value || "";
      if (f.status.value === "paid" && !eventDateVal && f.direction_slug.value !== "consultation") {
        const nowKey = dateString(new Date());
        const nearestEv = events
          .filter((ev) => ev.is_active !== false
            && ev.direction_slug === f.direction_slug.value
            && (!f.program_slug.value || !ev.program_slug || ev.program_slug === f.program_slug.value)
            && (!f.city.value.trim() || !ev.city || ev.city === f.city.value.trim())
            && String(ev.starts_at || "").slice(0, 10) >= nowKey)
          .sort((a, b) => String(a.starts_at || "").localeCompare(String(b.starts_at || "")))[0];
        if (nearestEv) {
          eventDateVal = String(nearestEv.starts_at).slice(0, 10);
          f.event_date.value = eventDateVal;
        }
      }
      const amountVal = Number(f.amount_uah.value) || (prog?.price_uah ? Number(prog.price_uah) : 0);
      if (f.status.value === "paid" && Number(f.amount_uah.value) === 0 && amountVal > 0) {
        f.amount_uah.value = amountVal;
      }

      const record = {
        name: f.name.value.trim(),
        full_name: f.name.value.trim(),
        phone: f.phone.value.trim(),
        status: f.status.value,
        caller_name: f.caller_name.value.trim(),
        direction_slug: f.direction_slug.value,
        program_slug: f.program_slug.value || "",
        course_title: prog?.name || (f.direction_slug.value === "consultation" ? "Консультація" : directionName(f.direction_slug.value)),
        city: f.city.value.trim() || "Київ",
        event_date: eventDateVal,
        amount_uah: amountVal,
        paid_amount: amountVal,
        promo: f.promo.value.trim(),
        promo_code: f.promo.value.trim(),
        notes: f.notes.value.trim(),
      };
      const id = f.id.value;
      let savedRecord;
      if (id) {
        const updated = await cms.update("applications", id, record);
        savedRecord = updated?.[0] || { id, ...record };
      } else {
        const created = await cms.insert("applications", {
          ...record,
          created_at: new Date().toISOString(),
        });
        savedRecord = created?.[0] || record;
        activeApplicationId = savedRecord.id || "";
      }

      const syncRes = await cms.syncToGoogleSheets?.(savedRecord);
      await loadSheetsConfig();
      await loadApplications();

      if (record.status === "paid") {
        const cohortTitle = formatCohortTitle(getCohortKey(savedRecord));
        const modeLabel = accessModeLabels[sheetsConfig.access_mode || "anyone_edit"];
        if (syncRes?.isFirstPaidTable) {
          feedback(statusEl, `✓ Перша оплата по набору «${cohortTitle}»! Автоматично створено окрему таблицю івенту (${modeLabel}).`, "success");
        } else {
          feedback(statusEl, `✓ Оплату підтверджено! Учасника автоматично додано в таблицю «${cohortTitle}».`, "success");
        }
      } else {
        feedback(statusEl, "Заявку збережено.", "success");
      }
    } catch (error) {
      feedback(statusEl, `Помилка збереження заявки: ${error.message}`, "error");
    }
  }

  appForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveApplicationFromForm(null);
  });

  $("#cms-mark-paid-btn")?.addEventListener("click", async () => {
    if (!appForm.reportValidity()) return;
    await saveApplicationFromForm("paid");
  });

  $("#cms-delete-application")?.addEventListener("click", async () => {
    const id = appForm?.elements.id.value;
    const statusEl = $(".cms-feedback", appForm);
    if (!id) return feedback(statusEl, "Спочатку оберіть заявку зі списку.", "error");
    if (!confirmDelete("Видалити цю заявку з бази?")) return;
    try {
      await cms.remove("applications", id);
      activeApplicationId = "";
      resetApplicationForm();
      await loadApplications();
      feedback(statusEl, "Заявку видалено.", "success");
    } catch (error) {
      feedback(statusEl, `Не вдалося видалити: ${error.message}`, "error");
    }
  });

  // ---------- ФІНАНСИСТ (СПИСКИ ГРУП ПО НАБОРАХ І ДАТАХ) ----------
  function getCohortKey(app) {
    if (cms.buildCohortIdentity) {
      const prog = programs.find((p) => p.slug === app.program_slug);
      return cms.buildCohortIdentity({
        ...app,
        course_title: prog?.name || app.course_title || directionName(app.direction_slug || ""),
      }).key;
    }
    const dir = app.direction_slug && app.direction_slug !== "consultation" ? app.direction_slug : "consultation";
    const prog = (app.program_slug || app.course_title || dir || "course").trim();
    const city = (app.city || "Місто уточнюється").trim();
    const date = (app.event_date || "Найближчий набір").trim();
    return `${dir}__${prog}__${city}__${date}`;
  }

  function formatCohortTitle(key) {
    const parts = key.split("__");
    const [dir, progOrCity, maybeCity, maybeDate] = parts.length >= 4
      ? parts
      : [parts[0], parts[0], parts[1] || "Місто уточнюється", parts[2] || "Найближчий набір"];
    const progObj = programs.find((p) => p.slug === progOrCity);
    const courseLabel = dir === "consultation"
      ? "Консультації (без курсу)"
      : progObj?.name || (progOrCity !== dir ? progOrCity : directionName(dir));
    return `[${maybeDate}] ${courseLabel} · ${maybeCity}`;
  }

  function exportCohortCsv(cohortKey, groupApps) {
    const title = formatCohortTitle(cohortKey);
    const rows = [
      ["№", "ID заявки", "Статус", "Ім'я учасника", "Телефон", "Тариф / Пакет", "Сума оплати (₴)", "Промокод", "Місто", "Дата вишколу", "Менеджер продзвону", "Примітки"],
      ...groupApps.map((a, idx) => [
        idx + 1,
        a.id,
        statusLabels[a.status] || a.status,
        a.name,
        a.phone,
        programs.find((p) => p.slug === a.program_slug)?.name || a.course_title || "",
        a.amount_uah || 0,
        a.promo || "",
        a.city || "",
        a.event_date || "",
        a.caller_name || "",
        a.notes || "",
      ]),
    ];
    const csvContent = "\uFEFF" + rows.map((r) => r.map((cell) => `"${csvSafe(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = title.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "");
    link.download = `RESERVIST_${safeName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderFinanceRoster() {
    const wrap = $("#cms-finance-roster-wrap");
    const cohortSelect = $("#cms-finance-cohort-select");
    const statusFilter = $("#cms-finance-status-filter")?.value || "paid";
    if (!wrap || !cohortSelect) return;

    // Правило: таблиця створюється і існує ТІЛЬКИ для івентів, де є хоча б 1 оплачений лід (щоб не було пустих таблиць)
    const paidCohortKeysSet = new Set(
      applications
        .filter((app) => app.status === "paid" && app.direction_slug !== "consultation")
        .map(getCohortKey),
    );
    const allCohortKeys = [...paidCohortKeysSet].sort();
    const prevCohort = cohortSelect.value || "all";
    cohortSelect.replaceChildren(
      new Option(`Усі створені таблиці оплачених івентів (${allCohortKeys.length})`, "all"),
      ...allCohortKeys.map((key) => new Option(formatCohortTitle(key), key)),
    );
    if (allCohortKeys.includes(prevCohort)) cohortSelect.value = prevCohort;

    const filteredApps = applications.filter((app) => {
      const key = getCohortKey(app);
      if (!paidCohortKeysSet.has(key)) return false;
      if (cohortSelect.value !== "all" && key !== cohortSelect.value) return false;
      if (statusFilter === "paid") return app.status === "paid";
      if (statusFilter === "active") return app.status === "paid" || app.status === "calling" || app.status === "new";
      return true;
    });

    const grouped = new Map();
    filteredApps.forEach((app) => {
      const key = getCohortKey(app);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(app);
    });

    wrap.replaceChildren();
    if (!grouped.size) {
      const empty = document.createElement("p");
      empty.className = "cms-note";
      empty.textContent = "Поки немає жодного набору з підтвердженою оплатою (порожні таблиці не створюються). Щойно ви позначите першу заявку як «Оплачено» у Відділі продзвону — таблиця під цей курс і дату створиться тут автоматично.";
      wrap.append(empty);
      return;
    }

    const defaultAccessBadge = accessModeLabels[sheetsConfig.access_mode || "anyone_edit"];

    for (const [key, groupApps] of grouped.entries()) {
      const card = document.createElement("section");
      card.className = "cms-cohort-card";
      const paidInGroup = groupApps.filter((a) => a.status === "paid");
      const totalCash = paidInGroup.reduce((sum, a) => sum + (Number(a.amount_uah) || 0), 0);
      const sheetMeta = sheetsConfig.cohort_sheets?.[key] || {};
      const sheetUrl = sheetMeta.spreadsheet_url || "";
      const accessBadge = accessModeLabels[sheetMeta.access_mode || sheetsConfig.access_mode || "anyone_edit"] || defaultAccessBadge;

      const header = document.createElement("div");
      header.className = "cms-cohort-header";
      header.innerHTML = `
        <div>
          <span class="cms-eyebrow">АВТО-ТАБЛИЦЯ ІВЕНТУ · ${esc(accessBadge)}</span>
          <h3>${esc(formatCohortTitle(key))}</h3>
        </div>
        <div class="cms-cohort-badges">
          <span>ОПЛАЧЕНО: ${paidInGroup.length}</span>
          <span class="is-cash">КАСА НАБОРУ: ${totalCash.toLocaleString("uk-UA")} ₴</span>
          <button type="button" class="cms-button cms-button-quiet" data-export-cohort style="padding:6px 11px;font-size:10px;">⬇ СКАЧАТИ ТАБЛИЦЮ (EXCEL/CSV)</button>
        </div>
      `;
      card.append(header);

      const sheetBar = document.createElement("div");
      sheetBar.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.02);font:11px var(--mono);";
      const safeSheetUrl = /^https?:\/\//i.test(sheetUrl) ? sheetUrl : "";
      sheetBar.innerHTML = `
        <span style="color:var(--muted);">📊 Посилання на Google Таблицю цього набору:</span>
        <input type="url" data-cohort-sheet-url value="${esc(safeSheetUrl)}" placeholder="Авто-створюється через Google Script або вставте посилання…" style="flex:1 1 240px;height:32px;padding:0 10px;background:#0b0c0e;color:var(--text);border:1px solid var(--line);font:11px var(--body);" />
        ${safeSheetUrl ? `<a href="${esc(safeSheetUrl)}" target="_blank" rel="noreferrer" class="cms-button cms-button-primary" style="padding:6px 12px;font-size:10px;">ВІДКРИТИ ТАБЛИЦЮ ↗</a>` : ""}
        <button type="button" class="cms-button cms-button-quiet" data-save-cohort-url style="padding:6px 12px;font-size:10px;">ЗБЕРЕГТИ / СКОПІЮВАТИ</button>
      `;
      card.append(sheetBar);

      header.querySelector("[data-export-cohort]")?.addEventListener("click", () => {
        exportCohortCsv(key, groupApps);
      });

      sheetBar.querySelector("[data-save-cohort-url]")?.addEventListener("click", async (ev) => {
        const inp = sheetBar.querySelector("[data-cohort-sheet-url]");
        const val = inp?.value.trim() || "";
        if (val && !/^https?:\/\//i.test(val)) {
          inp.setCustomValidity("Вставте повне посилання, що починається з https://");
          inp.reportValidity();
          inp.setCustomValidity("");
          return;
        }
        const nextSheets = {
          ...(sheetsConfig.cohort_sheets || {}),
          [key]: {
            ...(sheetsConfig.cohort_sheets?.[key] || {}),
            key,
            title: formatCohortTitle(key),
            spreadsheet_url: val,
            access_mode: sheetsConfig.access_mode || "anyone_edit",
            updated_at: new Date().toISOString(),
          },
        };
        sheetsConfig = { ...sheetsConfig, id: true, cohort_sheets: nextSheets };
        await cms.upsert("sheets_config", [sheetsConfig], "id");
        if (val) {
          try { await navigator.clipboard.writeText(val); } catch {}
        }
        const btn = ev.currentTarget;
        btn.textContent = val ? "✓ ЗБЕРЕЖЕНО І СКОПІЙОВАНО" : "✓ ЗБЕРЕЖЕНО";
        setTimeout(() => renderFinanceRoster(), 900);
      });

      const tableWrap = document.createElement("div");
      tableWrap.className = "cms-roster-table-wrap";
      const table = document.createElement("table");
      table.className = "cms-roster-table";
      table.innerHTML = `
        <thead>
          <tr>
            <th>№</th>
            <th>УЧАСНИК</th>
            <th>ТЕЛЕФОН</th>
            <th>ТАРИФ / ПАКЕТ</th>
            <th>СТАТУС</th>
            <th>СУМА ОПЛАТИ, ₴</th>
            <th>КОМЕНТАР / РЕКВІЗИТИ</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = $("tbody", table);

      groupApps.forEach((app, idx) => {
        const tr = document.createElement("tr");
        const progName = programs.find((p) => p.slug === app.program_slug)?.name || app.course_title || "—";
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td><strong>${esc(app.name)}</strong></td>
          <td>${esc(app.phone)}</td>
          <td>${esc(progName)}${app.promo ? ` <small style="color:var(--cta)">(${esc(app.promo)})</small>` : ""}</td>
          <td>
            <select data-roster-status>
              <option value="new" ${app.status === "new" ? "selected" : ""}>Нова</option>
              <option value="calling" ${app.status === "calling" ? "selected" : ""}>Продзвін</option>
              <option value="paid" ${app.status === "paid" ? "selected" : ""}>Оплачено ✓</option>
              <option value="cancelled" ${app.status === "cancelled" ? "selected" : ""}>Скасовано</option>
            </select>
          </td>
          <td>
            <input type="number" min="0" step="50" value="${Number(app.amount_uah) || 0}" data-roster-amount style="width:105px" />
          </td>
          <td>
            <input type="text" value="${esc(app.notes || "")}" data-roster-notes placeholder="Примітка фінансиста…" />
          </td>
        `;
        tr.dataset.appId = app.id;
        tbody.append(tr);
      });

      table.addEventListener("change", async (e) => {
        const row = e.target.closest?.("tr[data-app-id]");
        if (!row) return;
        const appId = row.dataset.appId;
        const app = applications.find((a) => String(a.id) === String(appId));
        if (!app) return;
        const statusSel = row.querySelector("[data-roster-status]");
        const amountInp = row.querySelector("[data-roster-amount]");
        const notesInp = row.querySelector("[data-roster-notes]");
        const updated = await cms.update("applications", appId, {
          status: statusSel.value,
          amount_uah: Number(amountInp.value) || 0,
          paid_amount: Number(amountInp.value) || 0,
          notes: notesInp.value.trim(),
        });
        if (updated?.[0]) {
          await cms.syncToGoogleSheets?.(updated[0]);
          await loadSheetsConfig();
        }
        await loadApplications();
      });

      tableWrap.append(table);
      card.append(tableWrap);
      wrap.append(card);
    }
  }

  $("#cms-finance-cohort-select")?.addEventListener("change", renderFinanceRoster);
  $("#cms-finance-status-filter")?.addEventListener("change", renderFinanceRoster);

  $("#cms-export-apps-csv")?.addEventListener("click", () => {
    const rows = [
      ["ID", "Дата створення", "Ім'я", "Телефон", "Напрямок", "Програма", "Місто", "Дата вишколу", "Статус", "Сума (₴)", "Промокод", "Оператор", "Примітки"],
      ...applications.map((a) => [
        a.id,
        a.created_at || "",
        a.name,
        a.phone,
        directionName(a.direction_slug || ""),
        a.course_title || a.program_slug || "",
        a.city || "",
        a.event_date || "",
        statusLabels[a.status] || a.status,
        a.amount_uah || 0,
        a.promo || "",
        a.caller_name || "",
        a.notes || "",
      ]),
    ];
    const csvContent = "\uFEFF" + rows.map((r) => r.map((cell) => `"${csvSafe(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reservist-applications-${dateString(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });

  // ---------- ПРОМОКОДИ ----------
  function renderPromoCodes() {
    if (!promoListEl) return;
    promoListEl.replaceChildren();
    promoCodes.forEach((promo) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cms-record-button${promo.id === activePromoId ? " is-active" : ""}`;
      const strong = document.createElement("strong");
      const discountLabel = promo.discount_type === "fixed" ? `−${promo.discount_value} ₴` : `−${promo.discount_value}%`;
      strong.textContent = `${promo.code} (${discountLabel})`;
      const span = document.createElement("span");
      span.textContent = `${promo.description || "Промокод на навчання"}${promo.is_active === false ? " · вимкнений" : " · активний"}`;
      btn.append(strong, span);
      btn.addEventListener("click", () => {
        activePromoId = promo.id;
        fillForm(promoForm, promo);
        renderPromoCodes();
      });
      promoListEl.append(btn);
    });
  }

  async function loadPromoCodes() {
    try {
      promoCodes = await cms.select("promo_codes");
      if (!activePromoId && promoCodes[0] && promoForm) {
        activePromoId = promoCodes[0].id;
        fillForm(promoForm, promoCodes[0]);
      }
      renderPromoCodes();
    } catch (error) {
      promoCodes = [];
    }
  }

  $("#cms-new-promo")?.addEventListener("click", () => {
    activePromoId = "";
    promoForm?.reset();
    if (promoForm) {
      promoForm.elements.id.value = "";
      promoForm.elements.is_active.checked = true;
    }
    renderPromoCodes();
  });

  promoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = promoForm.elements;
    const statusEl = $(".cms-feedback", promoForm);
    try {
      const record = {
        code: f.code.value.trim().toUpperCase(),
        discount_type: f.discount_type.value,
        discount_value: Number(f.discount_value.value) || 10,
        description: f.description.value.trim(),
        is_active: f.is_active.checked,
      };
      if (f.id.value) {
        await cms.update("promo_codes", f.id.value, record);
      } else {
        const created = await cms.insert("promo_codes", record);
        activePromoId = created?.[0]?.id || "";
      }
      await loadPromoCodes();
      feedback(statusEl, "Промокод збережено.", "success");
    } catch (error) {
      feedback(statusEl, `Помилка збереження промокоду: ${error.message}`, "error");
    }
  });

  $("#cms-delete-promo")?.addEventListener("click", async () => {
    const id = promoForm?.elements.id.value;
    const statusEl = $(".cms-feedback", promoForm);
    if (!id) return feedback(statusEl, "Спочатку оберіть промокод зі списку.", "error");
    if (!confirmDelete("Видалити цей промокод?")) return;
    try {
      await cms.remove("promo_codes", id);
      activePromoId = "";
      promoForm.reset();
      promoForm.elements.id.value = "";
      await loadPromoCodes();
      feedback(statusEl, "Промокод видалено.", "success");
    } catch (error) {
      feedback(statusEl, `Не вдалося видалити промокод: ${error.message}`, "error");
    }
  });

  if (!cms.isConfigured()) {
    feedback(loginMessage, cms.configurationError(), "error");
    $("button[type=submit]", loginForm).disabled = true;
  } else {
    Promise.resolve(cms.isPhpAvailable?.()).then((phpActive) => {
      const note = $(".cms-workspace-heading > p");
      if (phpActive && note) {
        note.textContent = "СЕРВЕРНИЙ РЕЖИМ (PHP + SQLite): Усі зміни та заявки зберігаються у базі на вашому хостингу.";
      } else if (!phpActive && cms.isDemoMode?.() && note) {
        note.textContent = "ДЕМО-РЕЖИМ (ЛОКАЛЬНО): Зміни зберігаються у вашому браузері та одразу застосовуються на сайті.";
      }
      if (phpActive) {
        const loginNote = $("#cms-login-view > p");
        if (loginNote) {
          loginNote.textContent = "Увійдіть за email та паролем адміністратора (задаються у файлі api-config.php на вашому хостингу).";
        }
      }
    });
    checkAdmin();
  }
})();
