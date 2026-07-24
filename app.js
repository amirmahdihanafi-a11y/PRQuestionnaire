(() => {
  "use strict";

  const survey = window.SURVEY_DATA;
  const config = window.SURVEY_CONFIG || {};
  const app = document.getElementById("app");
  const headerMeta = document.getElementById("headerMeta");
  const sectionCounter = document.getElementById("sectionCounter");
  const answeredCounter = document.getElementById("answeredCounter");
  const progressWrap = document.getElementById("progressWrap");
  const progressBar = document.getElementById("progressBar");
  const STORAGE_KEY = "tehran-personality-research-v1";
  const TOTAL_QUESTIONS = survey.sections.reduce((sum, section) => sum + (section.items?.length || section.groups?.length || 0), 0);

  const sectionById = Object.fromEntries(survey.sections.map(section => [section.id, section]));

  const makeId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const freshState = () => ({
    responseId: makeId(),
    createdAt: new Date().toISOString(),
    view: "intro",
    order: shuffle(survey.sections.map(section => section.id)),
    sectionIndex: 0,
    pageIndex: 0,
    answers: {},
    demographics: {},
    finished: false,
    submissionAttempted: false
  });

  let state = loadState();

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const random = new Uint32Array(1);
      if (window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(random);
      } else {
        random[0] = Math.floor(Math.random() * 2 ** 32);
      }
      const j = random[0] % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function loadState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      const validOrder = saved?.order?.length === survey.sections.length && saved.order.every(id => sectionById[id]);
      if (saved && validOrder) return saved;
    } catch (error) {
      console.warn("Could not restore session state", error);
    }
    return freshState();
  }

  function persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Session storage is unavailable; progress will not survive a refresh.", error);
    }
  }

  function answerKey(sectionId, itemIndex) {
    return `${sectionId}.${itemIndex}`;
  }

  function getAnswer(sectionId, itemIndex) {
    return state.answers[answerKey(sectionId, itemIndex)];
  }

  function setAnswer(sectionId, itemIndex, value) {
    state.answers[answerKey(sectionId, itemIndex)] = Number(value);
    persist();
    updateHeader();
  }

  function answeredCount() {
    return Object.keys(state.answers).length;
  }

  function updateHeader() {
    const isIntro = state.view === "intro";
    const isResult = state.view === "results";
    headerMeta.hidden = isIntro || isResult;
    progressWrap.hidden = isIntro;

    const progress = isResult ? 100 : Math.round((answeredCount() / TOTAL_QUESTIONS) * 100);
    progressBar.style.width = `${progress}%`;

    if (state.view === "demographics") {
      sectionCounter.textContent = "اطلاعات جمعیت‌شناختی";
    } else if (state.view === "questions") {
      sectionCounter.textContent = `بخش ${toFa(state.sectionIndex + 1)} از ${toFa(state.order.length)}`;
    }
    answeredCounter.textContent = `${toFa(answeredCount())} از ${toFa(TOTAL_QUESTIONS)} پاسخ`;
  }

  function toFa(value) {
    return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    updateHeader();
    if (state.finished || state.view === "results") {
      state.view = "results";
      renderResults();
      return;
    }
    if (state.view === "intro") renderIntro();
    else if (state.view === "demographics") renderDemographics();
    else renderQuestionPage();
  }

  function renderIntro() {
    const ownerBits = [config.institution, config.researcherName && `پژوهشگر: ${config.researcherName}`, config.ethicsCode && `کد اخلاق: ${config.ethicsCode}`, config.researcherContact && `راه ارتباطی: ${config.researcherContact}`].filter(Boolean);
    const externalButton = config.googleFormUrl
      ? `<a class="btn btn-secondary" href="${escapeAttr(config.googleFormUrl)}" target="_blank" rel="noopener">تکمیل در فرم بیرونی</a>`
      : "";

    app.innerHTML = `
      <section class="hero">
        <span class="eyebrow">پژوهش دانشگاهی · بی‌نام و داوطلبانه</span>
        <h1>${survey.meta.title}</h1>
        <p class="lead">${survey.meta.intro}</p>

        <div class="intro-grid">
          <article class="mini-card"><strong>حدود ۲۰ دقیقه</strong><span>پاسخ‌گویی مرحله‌به‌مرحله و قابل توقف است.</span></article>
          <article class="mini-card"><strong>بدون نام و ایمیل</strong><span>هیچ شناسه‌ی مستقیمی از شما پرسیده نمی‌شود.</span></article>
          <article class="mini-card"><strong>بازخورد شخصی</strong><span>در پایان یک جمع‌بندی غیرتشخیصی دریافت می‌کنید.</span></article>
        </div>

        <div class="consent-box">
          <label class="check-row">
            <input id="consent" type="checkbox" />
            <span>متن بالا را خوانده‌ام، ۱۸ تا ۴۰ سال دارم و با شرکت داوطلبانه در این پژوهش موافقم.</span>
          </label>
          ${ownerBits.length ? `<p class="owner-meta">${ownerBits.join(" · ")}</p>` : ""}
          <div id="introError" class="inline-error">برای شروع، تأیید آگاهانه‌ی بالا لازم است.</div>
          <div class="nav-row">
            <button id="startBtn" class="btn btn-primary">شروع پرسش‌نامه <span aria-hidden="true">←</span></button>
            ${externalButton}
          </div>
        </div>
        <p class="owner-meta">این ابزار برای پژوهش و خودبازتابی طراحی شده است و تشخیص پزشکی یا روان‌شناختی ارائه نمی‌کند.</p>
      </section>`;

    document.getElementById("startBtn").addEventListener("click", () => {
      if (!document.getElementById("consent").checked) {
        document.getElementById("introError").classList.add("show");
        return;
      }
      state.view = "demographics";
      persist();
      render();
      scrollTop();
    });
  }

  function renderDemographics() {
    const d = state.demographics;
    app.innerHTML = `
      <section class="panel">
        <div class="section-head">
          <div>
            <div class="section-kicker">پیش از شروع بخش‌ها</div>
            <h2>اطلاعات جمعیت‌شناختی</h2>
            <p class="section-description">${survey.meta.demographicIntro}</p>
          </div>
          <span class="page-chip">بی‌نام</span>
        </div>

        <form id="demographicForm" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="age">سن</label>
              <input id="age" name="age" type="number" min="18" max="40" inputmode="numeric" value="${escapeAttr(d.age ?? "")}" required />
              <small>عدد بین ۱۸ تا ۴۰</small>
            </div>

            <fieldset class="field">
              <legend>جنسیت</legend>
              <div class="option-row">
                ${radioPill("gender", "woman", "زن", d.gender)}
                ${radioPill("gender", "man", "مرد", d.gender)}
              </div>
            </fieldset>

            <label for="degree">مدرک تحصیلی</label>
              ${selectField("degree", ["پایین‌تر از دیپلم", "دیپلم", "کارشناسی", "کارشناسی ارشد", "دکترا", "ترجیح می‌دهم نگویم"], d.degree)}
            <div class="field">
            
              <label for="parentEducation">بالاترین مدرک تحصیلی بین پدر و مادر شما چیست؟</label>
              ${selectField("parentEducation", ["زیر دیپلم", "دیپلم", "کارشناسی", "کارشناسی ارشد", "دکترا یا بالاتر", "نمی‌دانم"], d.parentEducation)}
            </div>

            <fieldset class="field full">
              <legend>تصور کنید نردبانی ۱۰ پله‌ای وجود دارد که موقعیت اجتماعی-اقتصادی خانواده‌ها را از پایین به بالا نشان می‌دهد؛ با توجه به خانواده‌ای که در آن بزرگ شده‌اید، در کدام پله قرار می‌گیرید؟</legend>
              <div class="ladder">
                ${Array.from({length:10}, (_, i) => radioPill("socioeconomicLadder", String(i + 1), toFa(i + 1), String(d.socioeconomicLadder ?? ""))).join("")}
              </div>
              <div class="ladder-labels"><span>پایین‌ترین جایگاه</span><span>بالاترین جایگاه</span></div>
            </fieldset>

            <fieldset class="field">
              <legend>آیا تا کنون سابقه‌ی اقدام به خودکشی داشته‌اید؟</legend>
              <div class="option-row">
                ${radioPill("suicideHistory", "yes", "بله", d.suicideHistory)}
                ${radioPill("suicideHistory", "no", "خیر", d.suicideHistory)}
              </div>
            </fieldset>

            <fieldset class="field">
              <legend>آیا تا کنون سابقه‌ی اعتیاد به مواد مخدر، الکل یا دارو داشته‌اید؟</legend>
              <div class="option-row">
                ${radioPill("addictionHistory", "yes", "بله", d.addictionHistory)}
                ${radioPill("addictionHistory", "no", "خیر", d.addictionHistory)}
              </div>
            </fieldset>
          </div>
         <div id="demoError" class="inline-error">لطفاً همه‌ی اطلاعات این صفحه را تکمیل کنید. سن باید بین ۱۸ تا ۴۰ سال باشد.</div>
          <div class="nav-row">
            <button type="button" id="demoBack" class="btn btn-secondary"><span aria-hidden="true">→</span> بازگشت</button>
            <button type="submit" class="btn btn-primary">ورود به بخش اول <span aria-hidden="true">←</span></button>
          </div>
        </form>
      </section>`;

    document.getElementById("demoBack").addEventListener("click", () => {
      saveDemographics(false);
      state.view = "intro";
      persist();
      render();
      scrollTop();
    });

    document.getElementById("demographicForm").addEventListener("submit", event => {
      event.preventDefault();
      if (!saveDemographics(true)) return;
      state.view = "questions";
      state.sectionIndex = 0;
      state.pageIndex = 0;
      persist();
      render();
      scrollTop();
    });
  }

  function saveDemographics(requireComplete) {
    const form = document.getElementById("demographicForm");
    if (!form) return true;
    const formData = new FormData(form);
    const next = Object.fromEntries(formData.entries());
    state.demographics = { ...state.demographics, ...next };
    persist();

    const age = Number(next.age);
const required = ["age", "gender", "degree", "parentEducation", "socioeconomicLadder", "suicideHistory", "addictionHistory"];
    const complete = required.every(key => String(next[key] ?? "").trim()) && Number.isInteger(age) && age >= 18 && age <= 40;
    if (requireComplete && !complete) {
      document.getElementById("demoError").classList.add("show");
      return false;
    }
    return true;
  }

  function radioPill(name, value, label, selected) {
    const checked = String(selected ?? "") === String(value) ? "checked" : "";
    return `<label class="option-pill"><input type="radio" name="${escapeAttr(name)}" value="${escapeAttr(value)}" ${checked} />${label}</label>`;
  }

  function selectField(name, options, selected) {
    return `<select id="${name}" name="${name}" required>
      <option value="">انتخاب کنید</option>
      ${options.map(option => `<option value="${escapeAttr(option)}" ${selected === option ? "selected" : ""}>${option}</option>`).join("")}
    </select>`;
  }

  function renderQuestionPage() {
    const sectionId = state.order[state.sectionIndex];
    const section = sectionById[sectionId];
    const totalItems = section.items?.length || section.groups.length;
    const totalPages = Math.ceil(totalItems / section.chunkSize);
    state.pageIndex = Math.min(state.pageIndex, totalPages - 1);
    const start = state.pageIndex * section.chunkSize;
    const end = Math.min(start + section.chunkSize, totalItems);

    const cards = [];
    for (let index = start; index < end; index += 1) {
      cards.push(renderQuestionCard(section, index));
    }

    app.innerHTML = `
      <section class="panel">
        <div class="section-head">
          <div>
            <div class="section-kicker">بخش ${toFa(state.sectionIndex + 1)} از ${toFa(state.order.length)}</div>
            <h2>لطفاً بر اساس تجربه‌ی واقعی خود پاسخ دهید</h2>
            <p class="section-description">${section.instruction}</p>
          </div>
          <span class="page-chip">صفحه ${toFa(state.pageIndex + 1)} از ${toFa(totalPages)}</span>
        </div>
        <div class="question-list">${cards.join("")}</div>
        <div id="pageError" class="inline-error">برای ادامه، لطفاً به همه‌ی عبارت‌های این صفحه پاسخ دهید.</div>
        <div class="nav-row">
          <button id="pageBack" class="btn btn-secondary"><span aria-hidden="true">→</span> بازگشت</button>
          <button id="pageNext" class="btn btn-primary">${nextButtonLabel(totalPages)} <span aria-hidden="true">←</span></button>
        </div>
      </section>`;

    document.querySelectorAll("input[data-answer]").forEach(input => {
      input.addEventListener("change", event => {
        const { sectionId: id, itemIndex } = event.target.dataset;
        setAnswer(id, Number(itemIndex), event.target.value);
        event.target.closest(".question-card")?.classList.remove("is-missing");
      });
    });

    document.getElementById("pageBack").addEventListener("click", previousPage);
    document.getElementById("pageNext").addEventListener("click", () => nextPage(section, start, end, totalPages));
  }

  function nextButtonLabel(totalPages) {
    if (state.pageIndex < totalPages - 1) return "ادامه";
    if (state.sectionIndex < state.order.length - 1) return "بخش بعدی";
    return "مشاهده‌ی نتیجه";
  }

  function renderQuestionCard(section, index) {
    const current = getAnswer(section.id, index);
    const inputName = `answer-${section.id}-${index}`;
    const data = `data-answer data-section-id="${section.id}" data-item-index="${index}"`;

    if (section.type === "grouped") {
      const group = section.groups[index];
      return `<article class="question-card" data-card-index="${index}">
        <div class="question-topic">${group.title}</div>
        <div class="group-options">
          ${group.options.map((option, optionIndex) => `
            <label class="group-option">
              <input type="radio" name="${inputName}" value="${option.value}" ${Number(current) === option.value ? "checked" : ""} ${data} />
              <span class="score-dot" aria-hidden="true">${toFa(option.value)}</span>
              <span>${option.text}</span>
            </label>`).join("")}
        </div>
      </article>`;
    }

    const text = section.items[index];
    if (section.type === "linear") {
      const points = Array.from({length: section.max - section.min + 1}, (_, i) => section.min + i);
      return `<article class="question-card" data-card-index="${index}">
        <div class="question-text">${text}</div>
        <div class="linear-scale">
          <div class="scale-points" style="--points:${points.length}">
            ${points.map(value => `<label class="scale-point"><input type="radio" name="${inputName}" value="${value}" ${Number(current) === value ? "checked" : ""} ${data} /><span>${toFa(value)}</span></label>`).join("")}
          </div>
          <div class="scale-endpoints"><span>${section.minLabel}</span><span>${section.maxLabel}</span></div>
        </div>
      </article>`;
    }

    return `<article class="question-card" data-card-index="${index}">
      <div class="question-text">${text}</div>
      <div class="option-row">
        ${section.options.map(option => `<label class="option-pill"><input type="radio" name="${inputName}" value="${option.value}" ${Number(current) === option.value ? "checked" : ""} ${data} />${option.label}</label>`).join("")}
      </div>
    </article>`;
  }

  function validateCurrentPage(section, start, end) {
    let valid = true;
    for (let index = start; index < end; index += 1) {
      if (getAnswer(section.id, index) === undefined) {
        valid = false;
        document.querySelector(`[data-card-index="${index}"]`)?.classList.add("is-missing");
      }
    }
    if (!valid) {
      document.getElementById("pageError").classList.add("show");
      document.querySelector(".question-card.is-missing")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return valid;
  }

  function nextPage(section, start, end, totalPages) {
    if (!validateCurrentPage(section, start, end)) return;

    if (state.pageIndex < totalPages - 1) {
      state.pageIndex += 1;
    } else if (state.sectionIndex < state.order.length - 1) {
      state.sectionIndex += 1;
      state.pageIndex = 0;
    } else {
      state.finished = true;
      state.view = "results";
    }
    persist();
    render();
    scrollTop();
  }

  function previousPage() {
    if (state.pageIndex > 0) {
      state.pageIndex -= 1;
    } else if (state.sectionIndex > 0) {
      state.sectionIndex -= 1;
      const previousSection = sectionById[state.order[state.sectionIndex]];
      const count = previousSection.items?.length || previousSection.groups.length;
      state.pageIndex = Math.ceil(count / previousSection.chunkSize) - 1;
    } else {
      state.view = "demographics";
    }
    persist();
    render();
    scrollTop();
  }

  function calculateScores() {
    const anxietyAnswers = arrayAnswers("anxiety", 21);
    const worryAnswers = arrayAnswers("worry", 16);
    const depressionAnswers = arrayAnswers("depression", 21);
    const objectAnswers = arrayAnswers("objectRelations", 45);
    const schemaAnswers = arrayAnswers("emotionalSchemas", 28);
    const characterAnswers = arrayAnswers("characterPatterns", 90);

    const baiTotal = sum(anxietyAnswers);
    const worrySection = sectionById.worry;
    const pswqTotal = sum(worryAnswers.map((value, index) => worrySection.reverse.includes(index + 1) ? 6 - value : value));
    const bdiTotal = sum(depressionAnswers);

    const objectSection = sectionById.objectRelations;
    const objectScored = objectAnswers.map((value, index) => objectSection.reverse.includes(index + 1) ? 1 - value : value);
    const objectRelations = mapSubscales(objectSection.subscales, objectScored, true);

    const schemaSection = sectionById.emotionalSchemas;
    const emotionalSchemas = {};
    Object.entries(schemaSection.dimensions).forEach(([key, definition]) => {
      const values = definition.items.map(itemNumber => {
        const raw = schemaAnswers[itemNumber - 1];
        return definition.reverse.includes(itemNumber) ? 7 - raw : raw;
      });
      const average = sum(values) / values.length;
      emotionalSchemas[key] = { average, normalized: clamp((average - 1) / 5) };
    });

    const characterSection = sectionById.characterPatterns;
    const characterPatterns = mapSubscales(characterSection.subscales, characterAnswers, true);

    const objectMean = mean(Object.values(objectRelations).map(item => item.normalized));
    const schemaMean = mean(Object.values(emotionalSchemas).map(item => item.normalized));
    const features = {
      anxiety: mean([baiTotal / 63, (pswqTotal - 16) / 64, emotionalSchemas.lossControl.normalized, emotionalSchemas.duration.normalized, emotionalSchemas.rumination.normalized]),
      lowMood: bdiTotal / 63,
      relationshipSensitivity: mean([objectRelations.insecureAttachment.normalized, characterPatterns.hysteroid.normalized, characterPatterns.hysterical.normalized, objectRelations.egocentric.normalized * .65]),
      withdrawal: mean([objectRelations.alienation.normalized, objectRelations.socialIncompetence.normalized, characterPatterns.schizoid.normalized, emotionalSchemas.numbness.normalized, emotionalSchemas.lowExpression.normalized]),
      control: mean([characterPatterns.obsessiveCompulsive.normalized, emotionalSchemas.overlyRational.normalized, emotionalSchemas.nonAcceptance.normalized, emotionalSchemas.simplistic.normalized]),
      selfCriticism: mean([bdiTotal / 63, emotionalSchemas.guilt.normalized, emotionalSchemas.rumination.normalized, characterPatterns.masochistic.normalized, emotionalSchemas.devalued.normalized]),
      emotionalIntensity: mean([characterPatterns.hysteroid.normalized, characterPatterns.hysterical.normalized, emotionalSchemas.lossControl.normalized, emotionalSchemas.duration.normalized]),
      recognition: mean([characterPatterns.narcissistic.normalized, objectRelations.egocentric.normalized, emotionalSchemas.invalidation.normalized, emotionalSchemas.lowConsensus.normalized])
    };
    features.balance = clamp(1 - mean([features.anxiety, features.lowMood, features.relationshipSensitivity, features.withdrawal, features.control, features.selfCriticism, features.emotionalIntensity, features.recognition, objectMean * .5, schemaMean * .5]));

    return {
      baiTotal,
      baiLabel: baiLabel(baiTotal),
      pswqTotal,
      worryLabel: worryLabel(pswqTotal),
      bdiTotal,
      bdiLabel: bdiLabel(bdiTotal),
      objectRelations,
      emotionalSchemas,
      characterPatterns,
      features,
      currentSelfHarmThought: depressionAnswers[8] || 0,
      historicalSelfHarm: characterAnswers[29] === 1 || state.demographics.suicideHistory === "yes"
    };
  }

  function arrayAnswers(sectionId, length) {
    return Array.from({length}, (_, index) => Number(getAnswer(sectionId, index)));
  }

  function mapSubscales(definitions, scoredAnswers, percentages) {
    const result = {};
    Object.entries(definitions).forEach(([key, items]) => {
      const raw = sum(items.map(itemNumber => scoredAnswers[itemNumber - 1]));
      result[key] = {
        raw,
        maximum: items.length,
        normalized: percentages ? raw / items.length : raw
      };
    });
    return result;
  }

  function sum(values) { return values.reduce((total, value) => total + Number(value || 0), 0); }
  function mean(values) { return values.length ? sum(values) / values.length : 0; }
  function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }

  function baiLabel(score) {
    if (score <= 7) return "حداقل";
    if (score <= 15) return "خفیف";
    if (score <= 25) return "متوسط";
    return "شدید";
  }

  function bdiLabel(score) {
    if (score <= 13) return "حداقل";
    if (score <= 19) return "خفیف";
    if (score <= 28) return "متوسط";
    return "شدید";
  }

  function worryLabel(score) {
    if (score < 40) return "پایین‌تر در دامنه‌ی ابزار";
    if (score < 62) return "میانه تا بالا در دامنه‌ی ابزار";
    return "بالا در دامنه‌ی ابزار";
  }

  const objectLabels = {
    egocentric: "تمرکز بر نیازهای خود در رابطه",
    alienation: "احساس بیگانگی و فاصله",
    insecureAttachment: "حساسیت به طرد و ناایمنی پیوند",
    socialIncompetence: "دشواری در آسودگی اجتماعی"
  };

  const schemaLabels = {
    invalidation: "احساس نادیده‌گرفته‌شدن",
    incomprehensibility: "دشواری در فهم هیجان",
    guilt: "شرم و گناه هیجانی",
    simplistic: "نگاه صفر و یکی به هیجان",
    devalued: "فاصله از ارزش‌های شخصی",
    lossControl: "ترس از فقدان کنترل",
    numbness: "بی‌حسی هیجانی",
    overlyRational: "عقلانی‌سازی افراطی",
    duration: "نگرانی از ماندگاری هیجان",
    lowConsensus: "احساس متفاوت‌بودن",
    nonAcceptance: "نپذیرفتن احساسات",
    rumination: "نشخوار ذهنی",
    lowExpression: "دشواری در ابراز احساس",
    blame: "نسبت‌دادن هیجان به دیگران"
  };

  const characterLabels = {
    schizoid: "فاصله‌گیری و خودبسندگی",
    hysteroid: "شدت و نوسان هیجانی",
    narcissistic: "نیاز به دیده‌شدن و خودارزش",
    masochistic: "خودانتقادی و فداکاری افراطی",
    obsessiveCompulsive: "نظم، کنترل و کمال‌گرایی",
    hysterical: "بیان هیجانی و حساسیت رابطه‌ای"
  };

  const profiles = [
    {
      id: "balance", icon: "🌿", title: "تعادل‌جوی انعطاف‌پذیر",
      description: "الگوی کلی پاسخ‌ها نشان می‌دهد معمولاً می‌توانید میان فکر، احساس و رابطه تعادل برقرار کنید و در برابر فشارها چند راه متفاوت را امتحان کنید.",
      strengths: ["توان بازگشت به تعادل", "انعطاف در رابطه و تصمیم‌گیری", "ظرفیت پذیرش تجربه‌های متفاوت"],
      focus: "تعادل به معنای نبودن دشواری نیست؛ حفظ خواب، ارتباط امن و زمان استراحت می‌تواند این ظرفیت را پایدارتر کند."
    },
    {
      id: "anxiety", icon: "🧭", title: "ذهن آینده‌نگر و آماده‌باش",
      description: "ذهن شما به‌سرعت احتمال‌ها و سناریوهای آینده را بررسی می‌کند. این آمادگی می‌تواند در برنامه‌ریزی مفید باشد، اما گاهی بدن و ذهن را در حالت آماده‌باش نگه می‌دارد.",
      strengths: ["پیش‌بینی خطرها", "مسئولیت‌پذیری", "توجه به پیامدها"],
      focus: "تمرین جداکردن «مسئله‌ی قابل حل» از «احتمال ذهنی»، تنفس آهسته و تعیین زمان مشخص برای نگرانی می‌تواند فشار را کمتر کند."
    },
    {
      id: "relationshipSensitivity", icon: "🤝", title: "پیوندجوی حساس",
      description: "رابطه‌های نزدیک برای شما اهمیت زیادی دارند و تغییر در توجه، فاصله یا اطمینان دیگران ممکن است سریع‌تر از معمول بر احساس امنیت شما اثر بگذارد.",
      strengths: ["وفاداری و اهمیت‌دادن به رابطه", "حساسیت به نیازهای دیگران", "ظرفیت صمیمیت عمیق"],
      focus: "بیان مستقیم نیازها، تحمل فاصله‌های کوتاه و بررسی شواهد پیش از نتیجه‌گیری درباره‌ی طردشدن می‌تواند رابطه‌ها را آرام‌تر کند."
    },
    {
      id: "withdrawal", icon: "🏕️", title: "خلوت‌گزین محافظ",
      description: "برای حفظ آرامش یا جلوگیری از آسیب، ممکن است به خلوت، فاصله یا کنترل بیشتر مرزهای شخصی تکیه کنید. این راهبرد گاهی محافظت‌کننده و گاهی جداکننده است.",
      strengths: ["استقلال", "توان تمرکز در خلوت", "مرزبندی با فشار بیرونی"],
      focus: "ارتباط‌های کوچک اما منظم، گفت‌وگو با یک فرد امن و توجه به زمان‌هایی که خلوت به انزوا تبدیل می‌شود، مفید است."
    },
    {
      id: "control", icon: "🧩", title: "سامان‌دهنده‌ی دقیق",
      description: "ساختار، منطق و درست انجام دادن کارها برای شما آرامش‌بخش است. در شرایط مبهم ممکن است نیاز به کنترل یا قطعیت بیشتر شود.",
      strengths: ["دقت و وجدان کاری", "توان برنامه‌ریزی", "پایبندی به استانداردها"],
      focus: "تعریف «به‌اندازه‌ی کافی خوب»، واگذارکردن بخش‌های کوچک و تمرین ماندن در ابهام می‌تواند از فرسودگی جلوگیری کند."
    },
    {
      id: "selfCriticism", icon: "🌧️", title: "منتقدِ درونی خسته",
      description: "هنگام فشار یا ناکامی، صدای منتقد درونی ممکن است پررنگ شود و انرژی، امید یا احساس ارزشمندی را کاهش دهد.",
      strengths: ["مسئولیت‌پذیری", "توان دیدن خطاها", "اهمیت‌دادن به رشد"],
      focus: "همان لحن دلسوزانه‌ای را که برای یک دوست به کار می‌برید، با خودتان تمرین کنید و موفقیت‌های کوچک را به‌طور آگاهانه ثبت کنید."
    },
    {
      id: "emotionalIntensity", icon: "🌊", title: "موج‌سوار هیجان",
      description: "احساسات ممکن است با سرعت یا شدت بیشتری ظاهر شوند و گاهی تصمیم‌گیری را تحت تأثیر قرار دهند؛ در عوض، تجربه‌ی عاطفی شما می‌تواند زنده و پرمعنا باشد.",
      strengths: ["شور و درگیری عاطفی", "توان همدلی", "بیان زنده‌ی تجربه‌ها"],
      focus: "نام‌گذاری احساس، مکث کوتاه پیش از واکنش و تنظیم بدن از طریق حرکت، آب، خواب و تنفس می‌تواند موج را قابل مدیریت‌تر کند."
    },
    {
      id: "recognition", icon: "✨", title: "جست‌وجوگر ارزش و دیده‌شدن",
      description: "احساس ارزشمندی شما ممکن است تا حدی به بازخورد، توجه یا کیفیت عملکرد وابسته شود. دیده‌شدن برایتان انرژی‌بخش است، اما نبود آن می‌تواند آسیب‌پذیرکننده باشد.",
      strengths: ["انگیزه برای پیشرفت", "توان اثرگذاری اجتماعی", "توجه به تصویر و کیفیت ارائه"],
      focus: "جداکردن ارزش شخصی از عملکرد، پذیرش بازخوردهای معمولی و ساختن معیارهای درونی می‌تواند ثبات بیشتری ایجاد کند."
    }
  ];

  function profileRanking(features) {
    return profiles
      .map(profile => ({...profile, score: clamp(features[profile.id] || 0)}))
      .sort((a, b) => b.score - a.score);
  }

  function renderResults() {
    updateHeader();
    progressWrap.hidden = false;
    progressBar.style.width = "100%";
    const scores = calculateScores();
    const rankedProfiles = profileRanking(scores.features);
    const primary = rankedProfiles[0];
    const secondary = rankedProfiles.slice(1, 3);
    const currentRisk = scores.currentSelfHarmThought;
    const historicalRisk = scores.historicalSelfHarm;

    const riskCard = currentRisk > 0
      ? `<section class="safety-card"><h3>یک نکته‌ی مهم درباره‌ی ایمنی شما</h3><p>پاسخ‌های شما نشان می‌دهد در دو هفته‌ی اخیر افکاری درباره‌ی آسیب‌زدن به خود داشته‌اید. این نتیجه تشخیص نیست، اما مهم است آن را جدی بگیرید. امروز با روان‌شناس، روان‌پزشک یا یک فرد قابل اعتماد صحبت کنید. اگر احتمال می‌دهید به خود آسیب بزنید، تنها نمانید، ابزارهای آسیب را از دسترس دور کنید و با خدمات اورژانسی محل زندگی تماس بگیرید.</p></section>`
      : historicalRisk
        ? `<section class="safety-card warning"><h3>توجه به سابقه‌ی خودآسیبی</h3><p>در پاسخ‌ها نشانه‌ای از سابقه‌ی اقدام یا خودآسیبی دیده می‌شود. حتی اگر اکنون در خطر نیستید، گفت‌وگو با یک متخصص سلامت روان می‌تواند برای ساختن برنامه‌ی ایمنی و حمایت بلندمدت مفید باشد.</p></section>`
        : "";

    const broadAxes = [
      ["آماده‌باش و نگرانی", scores.features.anxiety],
      ["افت خلق و انرژی", scores.features.lowMood],
      ["حساسیت رابطه‌ای", scores.features.relationshipSensitivity],
      ["فاصله‌گیری", scores.features.withdrawal],
      ["نیاز به کنترل", scores.features.control],
      ["شدت هیجانی", scores.features.emotionalIntensity]
    ];

    const topObject = topEntries(scores.objectRelations, 4);
    const topSchemas = topEntries(scores.emotionalSchemas, 5);
    const topCharacter = topEntries(scores.characterPatterns, 5);

    app.innerHTML = `
      ${riskCard}
      <section class="result-hero">
        <span class="eyebrow">بازخورد شخصی · غیرتشخیصی</span>
        <h1>تصویری کلی از الگوی پاسخ‌های شما</h1>
        <p class="lead">این جمع‌بندی از کنار هم گذاشتن نشانه‌های هیجانی، نگرانی، کیفیت رابطه و الگوهای معمول منش ساخته شده است. هیچ پروفایلی «خوب» یا «بد» نیست و نتیجه جایگزین گفت‌وگو با متخصص نیست.</p>
        <div class="disclaimer">درصد شباهت فقط یک شاخص داخلی برای مقایسه‌ی پروفایل‌های همین سایت است و هنجار بالینی یا تشخیص شخصیت محسوب نمی‌شود.</div>
      </section>

      <div class="result-grid">
        <section class="profile-card">
          <div class="profile-icon" aria-hidden="true">${primary.icon}</div>
          <span class="match-badge">بیشترین انطباق: ${toFa(Math.round(primary.score * 100))}٪</span>
          <h2>${primary.title}</h2>
          <p>${primary.description}</p>
          <h3>ظرفیت‌های احتمالی</h3>
          <ul>${primary.strengths.map(item => `<li>${item}</li>`).join("")}</ul>
          <h3>نقطه‌ی تمرکز</h3>
          <p>${primary.focus}</p>
        </section>

        <section class="profile-card">
          <h3>گرایش‌های همراه</h3>
          <div class="secondary-profiles">
            ${secondary.map(profile => `<div class="secondary-profile"><span class="icon" aria-hidden="true">${profile.icon}</span><div><strong>${profile.title}</strong><small>${toFa(Math.round(profile.score * 100))}٪ انطباق</small></div></div>`).join("")}
          </div>
          <div class="disclaimer">پروفایل اصلی خلاصه‌ای از چند محور است، نه برچسب ثابت. وضعیت خواب، فشارهای اخیر و محیط رابطه‌ای می‌توانند پاسخ‌ها را تغییر دهند.</div>
        </section>
      </div>

      <section class="score-panel">
        <h2>سه نشانگر اصلی</h2>
        <div class="metric-grid">
          ${metricCard("نشانه‌های اضطرابی", `${toFa(scores.baiTotal)} از ۶۳`, scores.baiLabel)}
          ${metricCard("نگرانی پایدار", `${toFa(scores.pswqTotal)} از ۸۰`, scores.worryLabel)}
          ${metricCard("خلق و انرژی", `${toFa(scores.bdiTotal)} از ۶۳`, scores.bdiLabel)}
        </div>
      </section>

      <section class="detail-panel">
        <h2>محورهای کلی</h2>
        ${barList(broadAxes)}
      </section>

      <div class="detail-grid">
        <section class="detail-panel">
          <h2>الگوهای رابطه‌ای</h2>
          <p class="section-description">نمره‌ی بالاتر یعنی آن مضمون در پاسخ‌های شما بیشتر دیده شده است؛ این نمره تشخیص نیست.</p>
          ${barList(topObject.map(([key, value]) => [objectLabels[key], value.normalized]))}
        </section>
        <section class="detail-panel">
          <h2>شیوه‌ی مواجهه با هیجان</h2>
          <p class="section-description">پنج مضمون برجسته‌تر در پاسخ‌های یک ماه گذشته.</p>
          ${barList(topSchemas.map(([key, value]) => [schemaLabels[key], value.normalized]))}
        </section>
      </div>

      <section class="detail-panel">
        <h2>گرایش‌های منش</h2>
        <p class="section-description">نام‌ها به زبان توصیفی و غیرآسیب‌شناختی نمایش داده شده‌اند. درصدها میزان تأیید عبارت‌های هر خوشه را نشان می‌دهند.</p>
        ${barList(topCharacter.map(([key, value]) => [characterLabels[key], value.normalized]))}
      </section>

      <section class="score-panel">
        <h2>برداشت عملی</h2>
        <p>برای استفاده‌ی مفید از نتیجه، یک محور با نمره‌ی بالاتر را انتخاب کنید و فقط یک تغییر کوچک و قابل اندازه‌گیری برای دو هفته‌ی آینده در نظر بگیرید؛ برای مثال ثبت زمان نگرانی، یک گفت‌وگوی مستقیم، یا یک وقفه‌ی کوتاه پیش از واکنش.</p>
        <div class="result-actions">
          <button id="printResult" class="btn btn-primary">چاپ یا ذخیره‌ی نتیجه</button>
          <button id="restartSurvey" class="btn btn-danger">پاک‌کردن پاسخ‌ها و شروع دوباره</button>
        </div>
        <p id="submissionState" class="submission-state">${config.submissionEndpoint ? "در حال ارسال پاسخ پژوهشی…" : "نسخه‌ی نمایشی: پاسخ‌ها فقط در همین مرورگر محاسبه شده‌اند و در جایی ثبت نشده‌اند."}</p>
      </section>`;

    document.getElementById("printResult").addEventListener("click", () => window.print());
    document.getElementById("restartSurvey").addEventListener("click", () => {
      const confirmed = window.confirm("همه‌ی پاسخ‌های این جلسه پاک شوند؟");
      if (!confirmed) return;
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (error) { console.warn(error); }
      state = freshState();
      render();
      scrollTop();
    });

    if (config.submissionEndpoint && !state.submissionAttempted) {
      state.submissionAttempted = true;
      persist();
      submitResearchData(scores);
    }
  }

  function metricCard(label, value, note) {
    return `<article class="metric"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></article>`;
  }

  function barList(entries) {
    return `<div class="bar-list">${entries.map(([label, normalized]) => {
      const percent = Math.round(clamp(normalized) * 100);
      return `<div class="bar-row"><span class="bar-label">${label}</span><div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div><span class="bar-value">${toFa(percent)}٪</span></div>`;
    }).join("")}</div>`;
  }

  function topEntries(object, count) {
    return Object.entries(object).sort((a, b) => b[1].normalized - a[1].normalized).slice(0, count);
  }

  async function submitResearchData(scores) {
    const status = document.getElementById("submissionState");
    const payload = {
      version: "1.0.0",
      responseId: state.responseId,
      clientCreatedAt: state.createdAt,
      submittedAt: new Date().toISOString(),
      randomizedSectionOrder: state.order,
      demographics: state.demographics,
      answers: state.answers,
      scores
    };

    try {
      await fetch(config.submissionEndpoint, {
        method: "POST",
        mode: "no-cors",
        cache: "no-store",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      if (status) {
        status.textContent = "درخواست ثبت پاسخ‌ها ارسال شد. نتیجه‌ی شخصی شما فقط در همین صفحه نمایش داده می‌شود.";
        status.className = "submission-state success";
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.textContent = "ارسال پاسخ پژوهشی با خطا روبه‌رو شد. نتیجه‌ی شخصی همچنان قابل مشاهده است؛ لطفاً اتصال اینترنت را بررسی کنید.";
        status.className = "submission-state warning";
      }
    }
  }

  function escapeAttr(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function runDemoMode() {
    if (!new URLSearchParams(location.search).has("demo") || state.finished) return false;
    state.demographics = {
      age: "24", gender: "woman", degree: "کارشناسی ارشد",
      parentEducation: "کارشناسی", socioeconomicLadder: "6", suicideHistory: "no", addictionHistory: "no"
    };
    survey.sections.forEach(section => {
      const length = section.items?.length || section.groups.length;
      for (let index = 0; index < length; index += 1) {
        let value;
        if (section.type === "linear") value = section.min + Math.floor(Math.random() * (section.max - section.min + 1));
        else if (section.type === "grouped") value = Math.floor(Math.random() * 4);
        else if (section.type === "binary") value = Math.round(Math.random());
        else value = Math.floor(Math.random() * section.options.length);
        state.answers[answerKey(section.id, index)] = value;
      }
    });
    state.finished = true;
    state.view = "results";
    persist();
    return true;
  }

  document.querySelector(".brand").addEventListener("click", event => {
    event.preventDefault();
    if (state.finished) return;
    state.view = "intro";
    persist();
    render();
  });

  if (!survey?.sections?.length) {
    app.innerHTML = `<section class="safety-card"><h3>خطا در بارگذاری</h3><p>داده‌های پرسش‌نامه در دسترس نیست.</p></section>`;
    return;
  }

  runDemoMode();
  render();
})();
