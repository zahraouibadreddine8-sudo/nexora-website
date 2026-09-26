(() => {
  "use strict";
  const contactEndpoint = "https://api.web3forms.com/submit";
  const contactAccessKey = "32b2e5f2-5b4f-456c-be87-1b58b6057fdc";
  const legalVersion = "2026-09-26";
  const attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function cleanAttributionValue(value, maxLength = 180) {
    return String(value || "")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  function captureCampaignAttribution() {
    const params = new URLSearchParams(location.search);
    const tagged = {};
    attributionKeys.forEach(key => {
      const value = cleanAttributionValue(params.get(key));
      if (value) tagged[key] = value;
    });

    let referrerHost = "";
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer && referrer.hostname !== location.hostname) referrerHost = cleanAttributionValue(referrer.hostname, 120);
    } catch {}

    let saved = {};
    try {
      saved = JSON.parse(sessionStorage.getItem("nexora_campaign_attribution") || "{}");
      if (!saved || typeof saved !== "object") saved = {};
    } catch {
      saved = {};
    }

    const hasTaggedParams = attributionKeys.some(key => tagged[key]);
    if (!saved.first && (hasTaggedParams || referrerHost)) {
      saved.first = {
        ...tagged,
        referrer_host: referrerHost || "",
        landing_path: cleanAttributionValue(location.pathname, 240),
        captured_at: new Date().toISOString()
      };
    }

    if (hasTaggedParams) {
      saved.latest = {
        ...tagged,
        landing_path: cleanAttributionValue(location.pathname, 240),
        captured_at: new Date().toISOString()
      };
    }

    try {
      if (saved.first || saved.latest) sessionStorage.setItem("nexora_campaign_attribution", JSON.stringify(saved));
    } catch {}

    return saved;
  }

  const campaignAttribution = captureCampaignAttribution();

  function attributionFields() {
    const first = campaignAttribution.first || {};
    return {
      marketing_source: first.utm_source || "Not tagged",
      marketing_medium: first.utm_medium || "Not tagged",
      marketing_campaign: first.utm_campaign || "Not tagged",
      marketing_content: first.utm_content || "Not tagged",
      marketing_term: first.utm_term || "Not tagged",
      marketing_referrer: first.referrer_host || "Direct / unavailable",
      marketing_landing_path: first.landing_path || location.pathname
    };
  }
  const arrowIcon = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-arrow-up-right\" aria-hidden=\"true\"><path d=\"M7 7h10v10\"></path><path d=\"M7 17 17 7\"></path></svg>";
  const loadingIcon = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-loader-circle loading-icon\" aria-hidden=\"true\"><path d=\"M21 12a9 9 0 1 1-6.219-8.56\"></path></svg>";
  const pages = Array.from(document.querySelectorAll("[data-page]"));
  const main = document.getElementById("main-content");
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const menu = document.getElementById("mobile-navigation");
  const menuButton = document.querySelector(".menu-trigger");
  const titles = {
    home: "Nexora — The right people for the right marketing opportunity.",
    "for-brands": "For brands — Creator partnerships built around your campaign | Nexora",
    "for-creators": "For creators — Partnerships that fit your content | Nexora",
    faq: "FAQ — Questions about working with Nexora | Nexora",
    "review-us": "Review Nexora — Share your experience | Nexora",
    contact: "Contact — Start a conversation | Nexora"
  };
  const descriptions = {
    home: "Nexora helps brands find the right creators, specialists, agencies, brands, and partners for marketing opportunities, then helps coordinate the collaboration.",
    "for-brands": "Find the right people and partners for your marketing goal. Nexora researches, qualifies, and helps coordinate the collaboration.",
    "for-creators": "Connect with relevant paid brand opportunities. Nexora coordinates the campaign and commercial details; you decide which partnerships to accept.",
    faq: "Answers to common questions about Nexora campaigns, creators, response times, payments, usage rights, and how working together starts.",
    "review-us": "Worked with Nexora? Share a genuine public review. Your email is kept private and is not displayed with the review.",
    contact: "Tell Nexora about your campaign, introduce your creator channel, or ask a question about working together."
  };
  const pageUrls = {
    home: "/",
    "for-brands": "/brands/",
    "for-creators": "/creators/",
    faq: "/faq/",
    "review-us": "/reviews/",
    contact: "/contact/"
  };
  const pathPages = {
    "/": "home",
    "/brands": "for-brands",
    "/creators": "for-creators",
    "/faq": "faq",
    "/reviews": "review-us",
    "/contact": "contact"
  };
  let activePage = "home";
  let activeType = "brand";

  function chooseType(type, focus = false) {
    if (!["brand", "creator", "other"].includes(type)) return;
    activeType = type;
    tabs.forEach(tab => {
      const selected = tab.dataset.type === type;
      tab.setAttribute("aria-selected", String(selected));
      tab.setAttribute("tabindex", selected ? "0" : "-1");
      tab.dataset.state = selected ? "active" : "inactive";
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      panel.hidden = !selected;
      panel.dataset.state = selected ? "active" : "inactive";
      if (selected && focus) tab.focus();
    });
    document.querySelector(".contact-mobile-next").textContent = type === "creator"
      ? "We review your content and follow up by email when there’s a relevant opportunity."
      : "We review your enquiry and follow up by email with questions or next steps.";
  }

  function closeMenu() {
    if (menu.open) menu.close();
  }

  function showRoute(initial = false) {
    const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
    const pathPage = pathPages[normalizedPath] || "";
    let fragment;
    try { fragment = decodeURIComponent(location.hash.slice(1)); } catch { fragment = ""; }
    if (!fragment && pathPage) fragment = pathPage;
    if (!fragment) fragment = "home";
    const contactMatch = fragment.match(/^contact(?:\/(brand|creator|other))?$/);
    const target = document.getElementById(fragment);
    const page = contactMatch ? "contact" : target?.closest("[data-page]")?.dataset.page || (pages.some(item => item.id === fragment) ? fragment : fragment === "main-content" ? activePage : "home");
    const changed = page !== activePage;
    activePage = page;
    pages.forEach(element => { element.hidden = element.dataset.page !== page; });
    if (contactMatch?.[1]) chooseType(contactMatch[1]);
    if (initial && page === "contact" && !contactMatch?.[1]) {
      const queryType = new URLSearchParams(location.search).get("type");
      if (queryType) chooseType(queryType);
    }
    document.title = titles[page];
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) document.querySelector(selector).content = descriptions[page];
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) document.querySelector(selector).content = titles[page];
    const canonicalUrl = new URL(pageUrls[page] || "/", location.origin).href;
    const canonical = document.querySelector('link[rel="canonical"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (canonical) canonical.href = canonicalUrl;
    if (ogUrl) ogUrl.content = canonicalUrl;
    document.querySelectorAll(".site-header a,.mobile-menu a,.site-footer nav a").forEach(link => {
      const href = link.getAttribute("href");
      if (href === pageUrls[page] && page !== "home") link.setAttribute("aria-current", "page");
      else if (href === "/" && page === "home" && !["about","how-it-works","our-approach"].includes(fragment)) link.setAttribute("aria-current", "page");
      else if (href === `/#${fragment}` && ["about", "how-it-works", "our-approach"].includes(fragment)) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    closeMenu();
    requestAnimationFrame(() => {
      if (target && !pages.includes(target) && fragment !== "main-content") {
        target.scrollIntoView({ block: "start", behavior: initial || matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      } else if (fragment === "main-content") {
        main.focus();
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      if (changed && !initial) main.focus({ preventScroll: true });
    });
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href^='#']");
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (link.hash === location.hash || (link.hash === "#home" && !location.hash)) {
      event.preventDefault();
      showRoute();
    }
  });
  window.addEventListener("hashchange", () => showRoute());
  menuButton.addEventListener("click", () => {
    menu.showModal();
    menuButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("navigation-open");
  });
  document.querySelector(".menu-close").addEventListener("click", closeMenu);
  menu.addEventListener("close", () => {
    menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("navigation-open");
  });
  menu.addEventListener("click", event => {
    if (event.target === menu) {
      const bounds = menu.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeMenu();
    }
  });
  matchMedia("(min-width: 960px)").addEventListener("change", event => { if (event.matches) closeMenu(); });
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      chooseType(tab.dataset.type);
      history.replaceState(null, "", `/contact/?type=${activeType}`);
    });
    tab.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      chooseType(tabs[next].dataset.type, true);
      history.replaceState(null, "", `/contact/?type=${activeType}`);
    });
  });

  function setError(control, message) {
    const errorId = control.dataset.errorId || `${control.id}-error`;
    const error = document.getElementById(errorId);
    if (!error) return;
    control.setAttribute("aria-invalid", String(Boolean(message)));
    const radioGroup = control.type === "radio" ? control.closest('[role="radiogroup"]') : null;
    if (radioGroup) {
      radioGroup.setAttribute("aria-invalid", String(Boolean(message)));
      radioGroup.querySelectorAll('input[type="radio"]').forEach(input => input.setAttribute("aria-invalid", String(Boolean(message))));
    }
    error.textContent = message;
    error.hidden = !message;
    if (message) control.setAttribute("aria-describedby", error.id);
    else control.removeAttribute("aria-describedby");
  }

  document.querySelectorAll("form[data-enquiry]").forEach(form => {
    const type = form.dataset.enquiry;
    const panel = form.closest('[role="tabpanel"]');
    const success = panel.querySelector(".form-success");
    const feedback = form.querySelector(".form-error");
    const status = form.querySelector(".submission-status");
    const button = form.querySelector(".submit-button");
    const fieldset = form.querySelector("fieldset");
    const legalCheckbox = form.querySelector('input[name="legal_acknowledgement"]');
    const controls = Array.from(form.querySelectorAll("input,textarea,select")).filter(control => control.name !== "botcheck");
    let sending = false;
    const syncSubmitState = () => {
      const legalReady = !legalCheckbox || legalCheckbox.checked;
      button.disabled = sending || !legalReady;
      button.setAttribute("aria-disabled", String(button.disabled));
    };
    if (legalCheckbox) legalCheckbox.addEventListener("change", syncSubmitState);
    syncSubmitState();
    controls.forEach(control => {
      control.addEventListener("input", () => setError(control, ""));
      control.addEventListener("change", () => setError(control, ""));
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (sending) return;
      let firstInvalid = null;
      for (const control of controls) {
        if (control.type !== "checkbox") control.value = control.value.trim();
        let message = "";
        if (control.required && ((control.type === "checkbox" && !control.checked) || (control.type !== "checkbox" && !control.value))) message = control.name === "legal_acknowledgement" ? "Please accept the Terms of Use and acknowledge the Privacy Policy before sending." : control.name === "platform" ? "Please choose your main platform." : "Please complete this field.";
        else if (control.validity.typeMismatch) message = control.type === "email" ? "Please enter a valid email address." : "Please use a complete link starting with https://.";
        else if (control.type === "url" && control.value && !/^https?:\/\//i.test(control.value)) message = "Please use a complete http:// or https:// link.";
        else if (!control.validity.valid) message = "Please check this field.";
        setError(control, message);
        if (message && !firstInvalid) firstInvalid = control;
      }
      if (firstInvalid) { firstInvalid.focus(); return; }
      const values = Object.fromEntries(new FormData(form).entries());
      if (values.botcheck) return;
      sending = true;
      fieldset.disabled = true;
      button.disabled = true;
      form.setAttribute("aria-busy", "true");
      feedback.hidden = true;
      button.innerHTML = `<span>Sending enquiry</span>${loadingIcon}`;
      status.textContent = "Sending your enquiry.";
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(contactEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            ...values,
            access_key: contactAccessKey,
            subject: type === "brand" ? "New Nexora Campaign Request" : type === "creator" ? "New Nexora Creator Enquiry" : "New Nexora General Enquiry",
            from_name: "Nexora website",
            type,
            replyto: values.email,
            platform: values.platform || "Not specified",
            submittedAt: new Date().toISOString(),
            legalAcknowledgedAt: new Date().toISOString(),
            termsVersion: legalVersion,
            privacyPolicyVersion: legalVersion,
            ...attributionFields()
          }),
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok || !result || typeof result !== "object" || result.success !== true) throw new Error("Submission unavailable");
        form.reset();
        syncSubmitState();
        form.hidden = true;
        success.hidden = false;
        status.textContent = "";
        if (!panel.hidden && activePage === "contact") success.focus();
      } catch {
        feedback.hidden = false;
        status.textContent = "";
        if (!panel.hidden && activePage === "contact") feedback.focus();
      } finally {
        window.clearTimeout(timeout);
        sending = false;
        fieldset.disabled = false;
        syncSubmitState();
        form.removeAttribute("aria-busy");
        button.innerHTML = `<span>Send enquiry</span>${arrowIcon}`;
      }
    });
    panel.querySelector(".reset-enquiry").addEventListener("click", () => {
      success.hidden = true;
      form.hidden = false;
      feedback.hidden = true;
      controls.forEach(control => setError(control, ""));
      syncSubmitState();
      controls[0].focus();
    });
  });

  const REVIEW_API_URL = "/api/reviews";
  const reviewsList = document.querySelector("[data-reviews-list]");
  const reviewsEmpty = document.querySelector("[data-review-empty]");
  const reviewsError = document.querySelector("[data-reviews-error]");

  const formatReviewDate = value => {
    try {
      return new Intl.DateTimeFormat(undefined, { year:"numeric", month:"short", day:"numeric" }).format(new Date(value));
    } catch { return ""; }
  };

  const makeReviewCard = item => {
    const article = document.createElement("article");
    article.className = "review-card";
    article.dataset.reviewId = item.id;

    const meta = document.createElement("div");
    meta.className = "review-card-meta";

    const stars = document.createElement("div");
    stars.className = "review-card-stars";
    stars.setAttribute("aria-label", item.rating + " out of 5 stars");
    stars.textContent = "★".repeat(Number(item.rating)) + "☆".repeat(5 - Number(item.rating));

    const name = document.createElement("div");
    name.className = "review-card-name";
    name.textContent = item.name;

    const context = document.createElement("div");
    context.className = "review-card-context";
    context.textContent = [item.relationship, item.company_or_channel].filter(Boolean).join(" · ");

    meta.append(stars, name, context);

    const body = document.createElement("div");
    const copy = document.createElement("p");
    copy.className = "review-card-copy";
    copy.textContent = item.review;

    const date = document.createElement("time");
    date.className = "review-card-date";
    date.dateTime = item.created_at || "";
    date.textContent = formatReviewDate(item.created_at);

    body.append(copy, date);
    article.append(meta, body);
    return article;
  };

  const loadReviews = async () => {
    if (!reviewsList) return;
    reviewsError.hidden = true;
    try {
      const response = await fetch(REVIEW_API_URL, {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("Review load failed");
      const result = await response.json();
      const data = Array.isArray(result?.reviews) ? result.reviews : [];
      reviewsList.replaceChildren(...data.map(makeReviewCard));
      reviewsEmpty.hidden = Boolean(data.length);
    } catch {
      reviewsError.hidden = false;
    }
  };

  loadReviews();

  const reviewDialog = document.getElementById("review-dialog");
  if (reviewDialog) {
    const reviewDialogOpeners = Array.from(document.querySelectorAll("[data-open-review-dialog]"));
    const reviewDialogClose = reviewDialog.querySelector("[data-close-review-dialog]");

    const openReviewDialog = () => {
      if (!reviewDialog.open) reviewDialog.showModal();
      window.setTimeout(() => reviewDialogClose?.focus(), 0);
    };

    reviewDialogOpeners.forEach(button => button.addEventListener("click", openReviewDialog));
    reviewDialogClose?.addEventListener("click", () => reviewDialog.close());
    reviewDialog.addEventListener("click", event => {
      if (event.target === reviewDialog) reviewDialog.close();
    });
  }

  const reviewForm = document.querySelector("form[data-review]");
  if (reviewForm) {
    const reviewButton = reviewForm.querySelector(".review-submit-button");
    const reviewLegal = reviewForm.querySelector("#review-legal");
    const reviewFeedback = reviewForm.querySelector(".form-error");
    const reviewStatus = reviewForm.querySelector(".submission-status");
    const reviewFieldset = reviewForm.querySelector("fieldset");
    const reviewSuccess = reviewForm.parentElement.querySelector(".review-success");
    const reviewControls = Array.from(reviewForm.querySelectorAll("input,textarea,select")).filter(control => control.name !== "botcheck" && control.name !== "rating");
    const ratingInputs = Array.from(reviewForm.querySelectorAll('input[name="rating"]'));
    const ratingError = document.getElementById("review-rating-error");
    const ratingHint = document.getElementById("review-rating-hint");
    let reviewSending = false;

    const updateRatingUI = () => {
      const selected = reviewForm.querySelector('input[name="rating"]:checked');
      const value = selected ? Number(selected.value) : 0;
      reviewForm.querySelector(".star-rating")?.setAttribute("data-rating", String(value));
      if (ratingHint) ratingHint.textContent = value ? `${value} star${value === 1 ? "" : "s"} selected.` : "Hover or use the keyboard to choose 1–5 stars.";
      if (ratingError) {
        ratingError.textContent = "";
        ratingError.hidden = true;
      }
    };

    const syncReviewSubmit = () => {
      reviewButton.disabled = reviewSending || !reviewLegal.checked;
      reviewButton.setAttribute("aria-disabled", String(reviewButton.disabled));
    };

    reviewLegal.addEventListener("change", syncReviewSubmit);
    ratingInputs.forEach(input => input.addEventListener("change", updateRatingUI));
    reviewControls.forEach(control => {
      control.addEventListener("input", () => setError(control, ""));
      control.addEventListener("change", () => setError(control, ""));
    });
    syncReviewSubmit();

    reviewForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (reviewSending) return;
      let firstInvalid = null;

      for (const control of reviewControls) {
        if (!["checkbox", "radio"].includes(control.type)) control.value = control.value.trim();
        let message = "";
        const radioMissing = control.type === "radio" && control.required && !reviewForm.querySelector(`input[name="${control.name}"]:checked`);
        if (control.required && ((control.type === "checkbox" && !control.checked) || radioMissing || (!["checkbox", "radio"].includes(control.type) && !control.value))) {
          message = control.name === "legal_acknowledgement"
            ? "Please confirm the review statement and acknowledge the legal terms before sending."
            : control.name === "relationship"
              ? "Please choose how you worked with Nexora."
              : "Please complete this field.";
        } else if (control.validity.typeMismatch) {
          message = control.type === "email" ? "Please enter a valid email address." : "Please check this field.";
        } else if (!control.validity.valid) {
          message = control.name === "relationship" ? "Please choose how you worked with Nexora." : "Please check this field.";
        }
        setError(control, message);
        if (message && !firstInvalid) firstInvalid = control;
      }

      const selectedRating = reviewForm.querySelector('input[name="rating"]:checked');
      if (!selectedRating) {
        if (ratingError) {
          ratingError.textContent = "Please choose a star rating before sending.";
          ratingError.hidden = false;
        }
        if (!firstInvalid) firstInvalid = ratingInputs[0];
      }

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const values = Object.fromEntries(new FormData(reviewForm).entries());
      if (values.botcheck) return;

      reviewSending = true;
      reviewFieldset.disabled = true;
      reviewButton.disabled = true;
      reviewForm.setAttribute("aria-busy", "true");
      reviewFeedback.hidden = true;
      reviewButton.innerHTML = `<span>Sending review</span>${loadingIcon}`;
      reviewStatus.textContent = "Sending your review.";

      try {
        const publishResponse = await fetch(REVIEW_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(values)
        });
        const publishResult = await publishResponse.json().catch(() => ({}));
        if (!publishResponse.ok || !publishResult?.success) {
          throw new Error(publishResult?.error || "Review could not be published");
        }

        fetch(contactEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            ...values,
            access_key: contactAccessKey,
            subject: "New Nexora Review",
            from_name: "Nexora website",
            type: "review",
            replyto: values.email,
            public_status: "PUBLISHED AUTOMATICALLY",
            submittedAt: new Date().toISOString(),
            legalAcknowledgedAt: new Date().toISOString(),
            termsVersion: legalVersion,
            privacyPolicyVersion: legalVersion
          })
        }).catch(() => {});

        await loadReviews();
        reviewForm.reset();
        updateRatingUI();
        syncReviewSubmit();
        reviewForm.hidden = true;
        reviewSuccess.hidden = false;
        reviewStatus.textContent = "";
        if (activePage === "review-us") reviewSuccess.focus();
      } catch {
        reviewFeedback.querySelector("strong").textContent = "We couldn’t publish your review.";
        reviewFeedback.querySelector("p").textContent = "Your review is still here. Please try again in a moment.";
        reviewFeedback.hidden = false;
        reviewStatus.textContent = "";
        if (activePage === "review-us") reviewFeedback.focus();
      } finally {
        reviewSending = false;
        reviewFieldset.disabled = false;
        syncReviewSubmit();
        reviewForm.removeAttribute("aria-busy");
        reviewButton.innerHTML = `<span>Send review</span>${arrowIcon}`;
      }
    });

    reviewForm.parentElement.querySelector(".reset-review").addEventListener("click", () => {
      reviewSuccess.hidden = true;
      reviewForm.hidden = false;
      reviewFeedback.hidden = true;
      reviewControls.forEach(control => setError(control, ""));
      updateRatingUI();
      syncReviewSubmit();
      reviewControls[0].focus();
    });
  }

  document.querySelectorAll("[data-year]").forEach(element => { element.textContent = String(new Date().getFullYear()); });
  window.nexoraAnalyticsStatus = () => ({
    analyticsFunctionReady: typeof window.va === "function",
    analyticsScriptPresent: Boolean(document.querySelector('script[src*="vercel"][src*="insights"],script[src*="/_vercel/insights/"]')),
    analyticsQueueLength: Array.isArray(window.vaq) ? window.vaq.length : 0,
    host: location.host
  });
  showRoute(true);
})();

(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  document.documentElement.classList.add("motion-ready");

  const sectionSelectors = [
    "[data-page] > section",
    "[data-page] > .privacy-note",
    ".site-footer"
  ];
  const itemSelectors = [
    ".process-list li",
    ".service-list article",
    ".three-principles article",
    ".creator-steps li",
    ".qualification-table tbody tr",
    ".contact-next li"
  ];
  const imageSelectors = [
    ".studio-photo",
    ".hero-visual"
  ];

  const sections = Array.from(document.querySelectorAll(sectionSelectors.join(",")));
  const items = Array.from(document.querySelectorAll(itemSelectors.join(",")));
  const images = Array.from(document.querySelectorAll(imageSelectors.join(",")));

  sections.forEach(el => el.classList.add("motion-section"));
  images.forEach(el => el.classList.add("motion-image"));

  items.forEach((el,index) => {
    el.classList.add("motion-item");
    const group = el.parentElement;
    const siblings = group ? Array.from(group.children).filter(node => node.matches?.("li,article,tr")) : [];
    const localIndex = Math.max(0,siblings.indexOf(el));
    el.style.setProperty("--motion-delay", Math.min(localIndex * 55, 220) + "ms");
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {rootMargin:"0px 0px -8% 0px",threshold:0.08});

  [...sections,...items,...images].forEach(el => observer.observe(el));

  // Give page-route changes a short, consistent entrance.
  const pageObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== "attributes" || mutation.attributeName !== "hidden") continue;
      const page = mutation.target;
      if (page.hidden || !page.matches("[data-page]")) continue;
      page.classList.remove("page-entering");
      requestAnimationFrame(() => {
        page.classList.add("page-entering");
        window.setTimeout(() => page.classList.remove("page-entering"), 600);
      });
    }
  });

  document.querySelectorAll("[data-page]").forEach(page => {
    pageObserver.observe(page,{attributes:true,attributeFilter:["hidden"]});
  });
})();
