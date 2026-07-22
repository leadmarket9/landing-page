(() => {
  "use strict";

  /* ============================================================
   * CONFIG — replace these with your real integration details.
   * ============================================================ */
  const CONFIG = {
    // Generic webhook endpoint (Zapier "Catch Hook", Make.com, n8n, your own API, etc.)
    // Leave as-is to run the form in demo mode (no network call, simulated success).
    WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbzjRNTp01HLUSJ8LQgZOm1gbKXxpdJ8oEXj5JzFuzuZheNajIrCbPQsgIucLwxiH0jQHQ/exec",

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
   * Utilities
   * ============================================================ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function emailIsValid(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function phoneIsValid(value) {
    const digitsOnly = value.replace(/[\s().-]/g, "");
    return /^\+?[1-9]\d{7,14}$/.test(digitsOnly);
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
    else if (!phoneIsValid(phone.value)) flag(phone, "يرجى إدخال رقم هاتف صحيح، مثال: ‎+966 5X XXX XXXX");
    else flag(phone, "");

    const email = formEl.querySelector('[name="email"]');
    if (!email.value.trim()) flag(email, "البريد الإلكتروني مطلوب.");
    else if (!emailIsValid(email.value)) flag(email, "يرجى إدخال بريد إلكتروني صحيح.");
    else flag(email, "");

    const country = formEl.querySelector('[name="country"]');
    if (!country.value.trim()) flag(country, "الدولة مطلوبة.");
    else flag(country, "");

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
   * Scroll-reveal animation (progressive enhancement only)
   * ============================================================ */
  function setupScrollReveal() {
    const targets = $$(".benefit-card, .testimonial-card, .stat, .section-heading");
    targets.forEach((el) => el.setAttribute("data-animate", ""));

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

    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });
})();
