(() => {
  "use strict";

  /* ============================================================
   * CONFIG — replace these with your real integration details.
   * ============================================================ */
  const CONFIG = {
    // Generic webhook endpoint (Zapier "Catch Hook", Make.com, n8n, your own API, etc.)
    // Leave as-is to run the form in demo mode (no network call, simulated success).
    WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbyJvQZgNPDcYs_FaAqn4qEHhi1POVtjvZ08YvQxxe0e_3-a7P27sFr2r1jfZ1CfK-D9Ew/exec",

    // Optional direct integrations — leave blank to skip.
    HUBSPOT_PORTAL_ID: "",
    HUBSPOT_FORM_ID: "",
    // Google Sheets via an Apps Script Web App URL (doPost handler), if used instead of a generic webhook.
    GOOGLE_SHEETS_WEBAPP_URL: "",
  };

  /* ============================================================
   * Country list (Arabic names, extend as needed)
   * ============================================================ */
  const COUNTRIES = [
    "السعودية","الإمارات العربية المتحدة","قطر","الكويت","البحرين","عُمان","مصر","الأردن","لبنان",
    "العراق","سوريا","فلسطين","اليمن","ليبيا","تونس","الجزائر","المغرب","السودان","موريتانيا","الصومال",
    "جيبوتي","جزر القمر","تركيا","المملكة المتحدة","الولايات المتحدة","كندا","أستراليا","ألمانيا","فرنسا",
    "إسبانيا","إيطاليا","هولندا","سويسرا","السويد","ماليزيا","إندونيسيا","باكستان","الهند","سنغافورة","أخرى"
  ];

  /* ============================================================
   * US States + DC (for the required "state" field)
   * ============================================================ */
  const US_STATES = [
    "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
    "District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
    "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota",
    "Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
    "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon",
    "Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah",
    "Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"
  ];

  /* ============================================================
   * Utilities
   * ============================================================ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function emailIsValid(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function phoneIsValid(value) {
    const digitsOnly = value.replace(/[\s().-]/g, "");
    return /^\+1\d{10}$/.test(digitsOnly);
  }

  function setFieldError(input, message) {
    const errEl = document.getElementById(input.getAttribute("aria-describedby"));
    if (errEl) errEl.textContent = message || "";
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  /* ============================================================
   * Build a form instance from the shared <template>, giving every
   * field a unique id/name-suffix so hero + bottom forms can coexist.
   * ============================================================ */
  function buildForm(formEl, uid) {
    const template = document.getElementById("lead-form-template");
    const fragment = template.content.cloneNode(true);

    // Replace the -ID placeholder in every id/for/name/aria-describedby with a unique suffix.
    const idAttrs = ["id", "for", "aria-describedby", "name"];
    fragment.querySelectorAll("*").forEach((el) => {
      idAttrs.forEach((attr) => {
        if (el.hasAttribute(attr)) {
          const val = el.getAttribute(attr);
          if (val && val.includes("-ID")) {
            el.setAttribute(attr, val.replace(/-ID/g, `-${uid}`));
          }
        }
      });
    });

    formEl.querySelector(".form-body")?.remove();
    formEl.appendChild(fragment);

    // Populate country select
    const countrySelect = formEl.querySelector('select[name="country"]');
    if (countrySelect) {
      COUNTRIES.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        countrySelect.appendChild(opt);
      });
    }

    // Populate US state select
    const stateSelect = formEl.querySelector('select[name="state"]');
    if (stateSelect) {
      US_STATES.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        stateSelect.appendChild(opt);
      });
    }

    return formEl;
  }

  /* ============================================================
   * Validation
   * ============================================================ */
  function validateForm(formEl) {
    let isValid = true;
    const firstInvalid = { el: null };

    const flag = (input, message) => {
      setFieldError(input, message);
      if (message && !firstInvalid.el) firstInvalid.el = input;
      if (message) isValid = false;
    };

    const fullName = formEl.querySelector('[name="fullName"]');
    if (!fullName.value.trim()) flag(fullName, "الاسم الكامل مطلوب.");
    else flag(fullName, "");

    const phone = formEl.querySelector('[name="phone"]');
    if (!phone.value.trim()) flag(phone, "رقم الهاتف مطلوب.");
    else if (!phoneIsValid(phone.value)) flag(phone, "يرجى إدخال رقم هاتف أمريكي صحيح يبدأ بـ +1، مثال: ‎+1 XXX XXX XXXX");
    else flag(phone, "");

    const email = formEl.querySelector('[name="email"]');
    if (!email.value.trim()) flag(email, "البريد الإلكتروني مطلوب.");
    else if (!emailIsValid(email.value)) flag(email, "يرجى إدخال بريد إلكتروني صحيح.");
    else flag(email, "");

    const country = formEl.querySelector('[name="country"]');
    if (!country.value.trim()) flag(country, "الدولة مطلوبة.");
    else flag(country, "");

    const state = formEl.querySelector('[name="state"]');
    if (!state.value.trim()) flag(state, "الولاية مطلوبة.");
    else flag(state, "");

    const halalRadios = formEl.querySelectorAll('input[name^="halalAccount"]');
    const halalChecked = Array.from(halalRadios).some((r) => r.checked);
    const halalGroupEl = formEl.querySelector('[role="radiogroup"][aria-label*="ربوية"]');
    const halalErrEl = document.getElementById(halalGroupEl?.getAttribute("aria-describedby"));
    if (!halalChecked) {
      if (halalErrEl) halalErrEl.textContent = "يرجى الإجابة على هذا السؤال.";
      isValid = false;
      if (!firstInvalid.el) firstInvalid.el = halalRadios[0];
    } else if (halalErrEl) {
      halalErrEl.textContent = "";
    }

    const consentPrivacy = formEl.querySelector('[name="consentPrivacy"]');
    if (!consentPrivacy.checked) flag(consentPrivacy, "يجب الموافقة على سياسة الخصوصية.");
    else flag(consentPrivacy, "");

    const consentContact = formEl.querySelector('[name="consentContact"]');
    if (!consentContact.checked) flag(consentContact, "يجب الموافقة على التواصل معك.");
    else flag(consentContact, "");

    if (firstInvalid.el) {
      firstInvalid.el.focus();
    }

    return isValid;
  }

  /* ============================================================
   * Serialize form to a plain payload object
   * ============================================================ */
  function serializeForm(formEl) {
    const data = new FormData(formEl);
    const halalRadio = formEl.querySelector('input[name^="halalAccount"]:checked');
    const payload = {
      fullName: data.get("fullName") || "",
      phone: data.get("phone") || "",
      email: data.get("email") || "",
      country: data.get("country") || "",
      city: data.get("city") || "",
      state: data.get("state") || "",
      halalAccount: halalRadio ? halalRadio.value : "",
      budget: data.get("budget") || "",
      consentPrivacy: !!formEl.querySelector('[name="consentPrivacy"]')?.checked,
      consentContact: !!formEl.querySelector('[name="consentContact"]')?.checked,
      submittedAt: new Date().toISOString(),
      sourcePage: window.location.href,
    };
    return payload;
  }

  /* ============================================================
   * Fire GA4 + Meta Conversion pixel events, if configured.
   * Safe no-ops if gtag/fbq were never loaded (see index.html).
   * ============================================================ */
  function fireTrackingEvents(payload) {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "generate_lead", {
          currency: "USD",
          value: 0,
          country: payload.country,
        });
      }
      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead", {
          content_name: "Investment Consultation Request",
        });
      }
    } catch (_) {
      /* tracking must never block the actual submission */
    }
  }

  /* ============================================================
   * Send the lead to your backend. Demo mode (default): simulates
   * a network call. Replace CONFIG.WEBHOOK_URL to go live.
   * ============================================================ */
  async function sendLead(payload) {
    const isDemo = !CONFIG.WEBHOOK_URL || CONFIG.WEBHOOK_URL.startsWith("REPLACE_WITH");

    if (isDemo) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return { ok: true, demo: true };
    }

    // text/plain avoids a CORS preflight, which Google Apps Script web apps
    // don't handle; Apps Script's doPost still reads the raw JSON body fine.
    const response = await fetch(CONFIG.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Webhook responded with ${response.status}`);
    return { ok: true, demo: false };
  }

  /* ============================================================
   * Wire up a single form instance: submit, validation, UX states.
   * ============================================================ */
  function wireForm(formEl, statusEl) {
    let isSubmitting = false;

    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      statusEl.textContent = "";
      statusEl.className = "form-status";

      if (!validateForm(formEl)) {
        statusEl.textContent = "يرجى تصحيح الحقول المميزة والمحاولة مرة أخرى.";
        statusEl.classList.add("error");
        return;
      }

      const submitBtn = formEl.querySelector(".btn-submit");
      isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");

      const payload = serializeForm(formEl);

      try {
        await sendLead(payload);
        fireTrackingEvents(payload);

        statusEl.textContent = "شكرًا لك! تم استلام طلبك بنجاح، وسيتواصل معك أحد مستشارينا في أقرب وقت.";
        statusEl.classList.add("success");
        formEl.reset();
        $$(".error-msg", formEl).forEach((el) => (el.textContent = ""));
        $$("[aria-invalid]", formEl).forEach((el) => el.setAttribute("aria-invalid", "false"));
      } catch (err) {
        statusEl.textContent = "حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى بعد قليل.";
        statusEl.classList.add("error");
      } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
      }
    });
  }

  /* ============================================================
   * Scroll-reveal animation (progressive enhancement only).
   * Cards within the same grid get a small staggered delay so
   * groups cascade in rather than popping in all at once.
   * ============================================================ */
  function setupScrollReveal() {
    const groups = [
      $$(".benefit-grid > .benefit-card"),
      $$(".testimonial-grid > .testimonial-card"),
      $$(".stats-row > .stat"),
    ];
    groups.forEach((group) => {
      group.forEach((el, i) => {
        el.setAttribute("data-animate", "");
        el.style.setProperty("--reveal-delay", `${Math.min(i * 0.08, 0.4)}s`);
      });
    });

    const standalone = $$(".section-heading");
    standalone.forEach((el) => el.setAttribute("data-animate", ""));

    const targets = [...groups.flat(), ...standalone];

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in-view"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    targets.forEach((el) => observer.observe(el));
  }

  /* ============================================================
   * Stat counters: animate each .stat-num from 0 up to its target
   * value once it scrolls into view. Parses mixed formats like
   * "+40", "+1.5M", "4.8/5", "<24h" by extracting the numeric core
   * and keeping the surrounding prefix/suffix text intact.
   * ============================================================ */
  function setupStatCounters() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const statEls = $$(".stat-num");

    function animateCount(el) {
      const raw = el.textContent.trim();
      const match = raw.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
      if (!match) return;
      const [, prefix, numStr, suffix] = match;
      const target = parseFloat(numStr);
      const decimals = (numStr.split(".")[1] || "").length;

      if (prefersReducedMotion) {
        el.textContent = `${prefix}${numStr}${suffix}`;
        return;
      }

      const duration = 1400;
      const start = performance.now();

      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = `${prefix}${(target * eased).toFixed(decimals)}${suffix}`;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    if (!("IntersectionObserver" in window)) {
      statEls.forEach(animateCount);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    statEls.forEach((el) => observer.observe(el));
  }

  /* ============================================================
   * Init
   * ============================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    const heroForm = document.getElementById("lead-form-hero");
    const bottomForm = document.getElementById("lead-form-bottom");

    buildForm(heroForm, "hero");
    buildForm(bottomForm, "bottom");

    wireForm(heroForm, document.getElementById("form-status-hero"));
    wireForm(bottomForm, document.getElementById("form-status-bottom"));

    setupScrollReveal();
    setupStatCounters();

    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });
})();
