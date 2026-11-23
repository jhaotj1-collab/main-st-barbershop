/* Main St Barbershop: interactions and scroll motion.
   Everything on the page is readable and usable without this script. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const BOOK_URL = "https://getsquire.com/booking/book/main-st-barbershop-pomona";

  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduceMotion = () => mqReduce.matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = () => !!(window.gsap && window.ScrollTrigger);

  const MSB = (window.MSB = window.MSB || { paused: false, revealed: false });
  const ambient = []; // looping animations that the pause button stops

  /* ------------------------------------------------------------------
     Pause animations (WCAG 2.2.2): stops every looping animation
  ------------------------------------------------------------------ */
  const MOTION_KEY = "msb-motion";
  const motionBtn = $("[data-motion-toggle]");
  function setPaused(p, save) {
    MSB.paused = p;
    root.classList.toggle("motion-paused", p);
    if (motionBtn) {
      motionBtn.setAttribute("aria-pressed", String(p));
      $(".sr-only", motionBtn).textContent = p ? "Play animations" : "Pause animations";
      motionBtn.title = p ? "Play animations" : "Pause animations";
    }
    ambient.forEach((t) => (p ? t.pause() : t.play()));
    if (save) { try { localStorage.setItem(MOTION_KEY, p ? "paused" : "on"); } catch (e) { /* ignore */ } }
    window.dispatchEvent(new CustomEvent("msb:motion"));
  }
  let savedMotion = null;
  try { savedMotion = localStorage.getItem(MOTION_KEY); } catch (e) { /* ignore */ }
  setPaused(savedMotion === "paused", false);
  if (motionBtn) motionBtn.addEventListener("click", () => setPaused(!MSB.paused, true));

  /* ------------------------------------------------------------------
     Footer year
  ------------------------------------------------------------------ */
  $$("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ------------------------------------------------------------------
     Live open / closed status and hours dial (Pacific Time)
     Hours from the shop's Google Business Profile, Nov 2026.
  ------------------------------------------------------------------ */
  const HOURS = { 0: [10, 15], 1: [10, 19], 2: [10, 19], 3: [10, 19], 4: [10, 19], 5: [10, 19], 6: [10, 18] };
  const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const fmtHour = (h) => (h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`);

  function nowInPomona() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    return { day: DAY_INDEX[get("weekday")], mins: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
  }

  function computeStatus() {
    const { day, mins } = nowInPomona();
    const [open, close] = HOURS[day];
    const base = { day, mins, open, close };
    if (mins >= open * 60 && mins < close * 60) {
      const left = close * 60 - mins;
      const short = left <= 60 ? `Open now · closes in ${left} min` : `Open now · closes ${fmtHour(close)}`;
      return { ...base, isOpen: true, short, long: `${short} (Pacific Time)`, dialSub: left <= 60 ? `${left} min left` : `until ${fmtHour(close)}` };
    }
    if (mins < open * 60) {
      const short = `Closed · opens today at ${fmtHour(open)}`;
      return { ...base, isOpen: false, short, long: `${short} (Pacific Time)`, dialSub: `opens ${fmtHour(open)}` };
    }
    const next = HOURS[(day + 1) % 7][0];
    const short = `Closed · opens tomorrow at ${fmtHour(next)}`;
    return { ...base, isOpen: false, short, long: `${short} (Pacific Time)`, dialSub: `opens ${fmtHour(next)} tomorrow` };
  }

  // dial geometry: 24-hour face, midnight at the top
  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [120 + r * Math.sin(a), 120 - r * Math.cos(a)];
  };
  const minsToDeg = (m) => (m / 1440) * 360;
  const dialArc = $("[data-dial-arc]");
  const dialHand = $("[data-dial-hand]");
  const dialTicks = $("[data-dial-ticks]");
  if (dialTicks) {
    let html = "";
    for (let h = 0; h < 24; h++) {
      const major = h % 6 === 0;
      const [x1, y1] = polar(h * 15, major ? 100 : 104);
      const [x2, y2] = polar(h * 15, 110);
      html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${major ? "is-major" : ""}"/>`;
    }
    dialTicks.innerHTML = html;
  }
  let handDeg = 0;
  function setHand(deg) {
    handDeg = deg;
    if (dialHand) dialHand.setAttribute("transform", `rotate(${deg.toFixed(2)} 120 120)`);
  }

  function renderStatus() {
    let s;
    try { s = computeStatus(); } catch (e) { return; }
    $$("[data-status]").forEach((el) => {
      el.classList.toggle("is-open", s.isOpen);
      el.classList.toggle("is-closed", !s.isOpen);
      const t = $("[data-status-text]", el);
      if (t) t.textContent = s.short;
    });
    $$("[data-status-long]").forEach((el) => { el.textContent = s.long; });
    $$(".hours tr").forEach((tr) => {
      const isToday = Number(tr.dataset.day) === s.day;
      tr.classList.toggle("is-today", isToday);
      const th = $("th", tr);
      const tag = $(".today-tag", th);
      if (isToday && !tag) th.insertAdjacentHTML("beforeend", '<span class="today-tag">· Today</span>');
      if (!isToday && tag) tag.remove();
    });
    if (dialArc) {
      const a1 = minsToDeg(s.open * 60);
      const a2 = minsToDeg(s.close * 60);
      const [x1, y1] = polar(a1, 92);
      const [x2, y2] = polar(a2, 92);
      dialArc.setAttribute("d", `M${x1.toFixed(2)} ${y1.toFixed(2)} A92 92 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`);
      $(".dial").classList.toggle("is-open", s.isOpen);
      $("[data-dial-state]").textContent = s.isOpen ? "Open" : "Closed";
      $("[data-dial-sub]").textContent = s.dialSub;
      if (!dialHand.dataset.animating) setHand(minsToDeg(s.mins));
    }
    MSB.status = s;
  }
  renderStatus();
  setInterval(renderStatus, 60 * 1000);

  /* ------------------------------------------------------------------
     Header state + mobile action bar
  ------------------------------------------------------------------ */
  const header = $(".site-header");
  const actionBar = $(".action-bar");
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 24);
    if (actionBar) actionBar.classList.toggle("is-visible", y > window.innerHeight * 0.55);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------
     Mobile menu
  ------------------------------------------------------------------ */
  const toggle = $(".menu-toggle");
  const menu = $("#mobile-menu");
  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    $(".sr-only", toggle).textContent = open ? "Close menu" : "Open menu";
    menu.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      const first = $("a", menu);
      if (first) first.focus();
      if (window.gsap && !reduceMotion()) {
        gsap.from($$("li a", menu), { yPercent: 60, opacity: 0, duration: 0.6, stagger: 0.05, ease: "expo.out" });
      }
    }
  }
  if (toggle && menu) {
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) { setMenu(false); toggle.focus(); }
    });
    window.matchMedia("(min-width: 1081px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
  }

  /* ------------------------------------------------------------------
     Screen-reader announcements
  ------------------------------------------------------------------ */
  const live = $("[data-live]");
  const announce = (msg) => { if (!live) return; live.textContent = ""; setTimeout(() => { live.textContent = msg; }, 60); };

  /* ------------------------------------------------------------------
     Price estimate ticket
  ------------------------------------------------------------------ */
  const ticket = $("[data-ticket]");
  const priceBtns = $$(".price__btn");
  const fmtMoney = (a, b) => (b === 0 ? "Free" : a === b ? `$${a}` : `$${a}–${b}`);
  const fmtDur = (m) => {
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h} hr${r ? ` ${r} min` : ""}` : `${r} min`;
  };
  const fmtDurRange = (a, b) => (a === b ? fmtDur(a) : `${fmtDur(a)} – ${fmtDur(b)}`);
  const mqMobile = window.matchMedia("(max-width: 720px)");

  function ticketTotals() {
    const sel = priceBtns.filter((b) => b.getAttribute("aria-pressed") === "true");
    const t = sel.reduce((acc, b) => {
      acc.pmin += +b.dataset.pmin; acc.pmax += +b.dataset.pmax;
      acc.tmin += +b.dataset.tmin; acc.tmax += +b.dataset.tmax;
      return acc;
    }, { pmin: 0, pmax: 0, tmin: 0, tmax: 0 });
    return { sel, ...t };
  }

  function setTicketOpen(open) {
    const tg = $("[data-ticket-toggle]");
    tg.setAttribute("aria-expanded", String(open));
    $("#ticket-body").hidden = !open;
    ticket.classList.toggle("is-collapsed", !open);
  }

  function renderTicket(changed, added) {
    if (!ticket) return;
    const { sel, pmin, pmax, tmin, tmax } = ticketTotals();
    const list = $("[data-ticket-items]");
    list.innerHTML = sel.map((b, i) => {
      const name = b.dataset.item;
      return `<li class="ticket__item"><span class="ticket__name">${name}</span><span class="ticket__price">${fmtMoney(+b.dataset.pmin, +b.dataset.pmax)}</span><button type="button" class="ticket__remove" data-remove="${priceBtns.indexOf(b)}"><span aria-hidden="true">×</span><span class="sr-only">Remove ${name}</span></button></li>`;
    }).join("");
    const total = fmtMoney(pmin, pmax);
    $("[data-ticket-total]").textContent = total;
    $("[data-ticket-time]").textContent = sel.length ? `About ${fmtDurRange(tmin, tmax)} in the chair` : "";
    $("[data-ticket-sum]").textContent = sel.length ? `${sel.length} · ${total}` : "";

    const wasHidden = ticket.hidden;
    if (sel.length && wasHidden) {
      ticket.hidden = false;
      setTicketOpen(!mqMobile.matches);
      if (window.gsap && !reduceMotion()) gsap.fromTo(ticket, { y: 60, opacity: 0, rotate: 3 }, { y: 0, opacity: 1, rotate: 0, duration: 0.8, ease: "expo.out" });
    } else if (!sel.length && !wasHidden) {
      const hide = () => { ticket.hidden = true; };
      if (window.gsap && !reduceMotion()) gsap.to(ticket, { y: 40, opacity: 0, duration: 0.35, ease: "power2.in", onComplete: hide });
      else hide();
    } else if (sel.length && window.gsap && !reduceMotion()) {
      gsap.fromTo("[data-ticket-total]", { scale: 1.25 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
    }
    if (changed) {
      const verb = added ? "added" : "removed";
      announce(sel.length
        ? `${changed} ${verb}. Estimate ${total}, about ${fmtDurRange(tmin, tmax)}.`
        : `${changed} ${verb}. Estimate cleared.`);
    }
  }

  if (ticket) {
    priceBtns.forEach((b) => b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      if (on && window.gsap && !reduceMotion()) {
        gsap.fromTo($(".price__cost", b), { y: -10 }, { y: 0, duration: 0.6, ease: "bounce.out" });
      }
      renderTicket(b.dataset.item, on);
    }));
    ticket.addEventListener("click", (e) => {
      const r = e.target.closest("[data-remove]");
      if (!r) return;
      const b = priceBtns[+r.dataset.remove];
      b.setAttribute("aria-pressed", "false");
      renderTicket(b.dataset.item, false);
      const next = $(".ticket__remove", ticket) || $("[data-ticket-clear]", ticket);
      if (next && !ticket.hidden) next.focus(); else b.focus();
    });
    $("[data-ticket-clear]").addEventListener("click", () => {
      priceBtns.forEach((b) => b.setAttribute("aria-pressed", "false"));
      renderTicket("All services", false);
      priceBtns[0].focus();
    });
    $("[data-ticket-toggle]").addEventListener("click", (e) => {
      setTicketOpen(e.currentTarget.getAttribute("aria-expanded") !== "true");
    });
  }

  /* ------------------------------------------------------------------
     Know your fade (tabs + illustration)
  ------------------------------------------------------------------ */
  const FADES = [
    { name: "Taper", desc: "Only the sideburns and neckline get shorter. The softest, most classic option.", y1: 330, y2: 372, level: 0.25 },
    { name: "Low fade", desc: "Starts low, just above the ear and along the neckline. Clean and subtle, and it works almost anywhere.", y1: 292, y2: 352, level: 0.5 },
    { name: "Mid fade", desc: "Starts halfway up the sides, between the ear and the temple. A balanced, everyday fade with more contrast.", y1: 248, y2: 330, level: 0.75 },
    { name: "High fade", desc: "Starts up near the temples, for the most contrast between the sides and the top. Bold and sharp.", y1: 198, y2: 300, level: 1 },
  ];
  const fadeTabs = $$(".fades__tab");
  const fadeGrad = $("[data-fade-grad]");
  const fadeGuide = $("[data-fade-guide]");
  const fadeTicks = $$("[data-fade-ticks] text");
  const fadePanel = $("#fade-panel");
  const fadeMeter = $("[data-fade-meter]");
  let fadeIndex = -1;

  function setFade(i, opts = {}) {
    if (i === fadeIndex || !fadeGrad) return;
    const first = fadeIndex === -1;
    fadeIndex = i;
    const f = FADES[i];
    fadeTabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    fadePanel.setAttribute("aria-labelledby", fadeTabs[i].id);
    const gap = Math.max((f.y2 - f.y1) / 3, 22); // keep guard labels readable on short fades
    const tickY = (k) => f.y1 + gap * k + 5;
    const animate = window.gsap && !reduceMotion() && !first;
    const swapText = () => {
      $("[data-fade-name]").textContent = f.name;
      $("[data-fade-desc]").textContent = f.desc;
    };
    if (animate) {
      gsap.to(fadeGrad, { attr: { y1: f.y1, y2: f.y2 }, duration: 0.9, ease: "expo.inOut" });
      gsap.to(fadeGuide, { y: f.y1, duration: 0.9, ease: "expo.inOut" });
      fadeTicks.forEach((t, k) => gsap.to(t, { attr: { y: tickY(k) }, duration: 0.9, ease: "expo.inOut", delay: k * 0.03 }));
      gsap.to(fadeMeter, { scaleX: f.level, duration: 0.9, ease: "expo.inOut" });
      gsap.timeline()
        .to("[data-fade-name], [data-fade-desc]", { y: -14, opacity: 0, duration: 0.2, ease: "power2.in", stagger: 0.03 })
        .add(swapText)
        .fromTo("[data-fade-name], [data-fade-desc]", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out", stagger: 0.05 });
      gsap.fromTo(".head__guide line", { strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.9, ease: "power2.out" });
    } else {
      fadeGrad.setAttribute("y1", f.y1);
      fadeGrad.setAttribute("y2", f.y2);
      fadeGuide.setAttribute("transform", `translate(0 ${f.y1})`);
      fadeTicks.forEach((t, k) => t.setAttribute("y", tickY(k)));
      if (fadeMeter) fadeMeter.style.transform = `scaleX(${f.level})`;
      swapText();
    }
    if (opts.announce) announce(`${f.name}. ${f.desc}`);
  }
  setFade(0);

  let fadeST = null; // set when the section is pinned on large screens
  fadeTabs.forEach((t, i) => {
    t.addEventListener("click", () => {
      if (fadeST && window.scrollY >= fadeST.start - 2 && window.scrollY <= fadeST.end + 2) {
        window.scrollTo({ top: fadeST.start + ((i + 0.5) / FADES.length) * (fadeST.end - fadeST.start), behavior: "auto" });
      }
      setFade(i);
    });
    t.addEventListener("keydown", (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let n = null;
      if (e.key in keys) n = (i + keys[e.key] + FADES.length) % FADES.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = FADES.length - 1;
      if (n === null) return;
      e.preventDefault();
      fadeTabs[n].focus();
      fadeTabs[n].click();
    });
  });

  /* ------------------------------------------------------------------
     Cookie consent + Google Map (loads only with consent)
  ------------------------------------------------------------------ */
  const CONSENT_KEY = "msb-consent-v1";
  const gpc = navigator.globalPrivacyControl === true;
  const cookie = $("[data-cookie]");
  const prefs = $("[data-cookie-prefs]");
  const mapsBox = $("[data-pref-maps]");
  const btnAccept = $("[data-cookie-accept]");
  const btnReject = $("[data-cookie-reject]");
  const btnCustom = $("[data-cookie-custom]");
  const btnSave = $("[data-cookie-save]");
  let returnFocusTo = null;

  function readConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY)); } catch (e) { return null; }
  }
  function writeConsent(maps) {
    const value = { maps: !!maps, date: new Date().toISOString(), gpc };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
    applyConsent(value);
  }

  const mapEl = $("[data-map]");
  const mapPlaceholder = $("[data-map-placeholder]");
  function loadMap() {
    if (!mapEl || $("iframe", mapEl)) return;
    const f = document.createElement("iframe");
    f.src = "https://www.google.com/maps?q=Main+St+Barbershop,+101+S+Main+St,+Pomona,+CA+91766&output=embed";
    f.title = "Google Map showing Main St Barbershop at 101 S Main St, Pomona";
    f.loading = "lazy";
    f.referrerPolicy = "strict-origin-when-cross-origin";
    mapEl.appendChild(f);
    mapPlaceholder.hidden = true;
  }
  function unloadMap() {
    const f = mapEl && $("iframe", mapEl);
    if (f) f.remove();
    if (mapPlaceholder) mapPlaceholder.hidden = false;
  }
  function applyConsent(c) { if (c && c.maps) loadMap(); else unloadMap(); }

  function showPrefs(show) {
    prefs.hidden = !show;
    btnSave.hidden = !show;
    btnAccept.hidden = show;
    btnReject.hidden = show;
    btnCustom.hidden = show;
    btnCustom.setAttribute("aria-expanded", String(show));
  }
  function openCookie({ withPrefs = false, focus = false } = {}) {
    const c = readConsent();
    mapsBox.checked = c ? !!c.maps : false;
    $("[data-gpc]").hidden = !gpc;
    showPrefs(withPrefs);
    cookie.hidden = false;
    if (window.gsap && !reduceMotion()) {
      // opacity (not autoAlpha) so the card stays focusable while it fades in
      gsap.fromTo(cookie, { y: 40, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: "expo.out" });
    }
    if (focus) (withPrefs ? mapsBox : btnAccept).focus();
  }
  function closeCookie() {
    const done = () => {
      cookie.hidden = true;
      if (returnFocusTo) { returnFocusTo.focus(); returnFocusTo = null; }
    };
    if (window.gsap && !reduceMotion()) gsap.to(cookie, { y: 30, opacity: 0, duration: 0.35, ease: "power2.in", onComplete: done });
    else done();
  }
  if (cookie) {
    btnAccept.addEventListener("click", () => { writeConsent(true); closeCookie(); });
    btnReject.addEventListener("click", () => { writeConsent(false); closeCookie(); });
    btnCustom.addEventListener("click", () => { showPrefs(true); mapsBox.focus(); });
    btnSave.addEventListener("click", () => { writeConsent(mapsBox.checked); closeCookie(); });
    cookie.addEventListener("keydown", (e) => { if (e.key === "Escape" && readConsent()) closeCookie(); });
    $$("[data-open-cookies]").forEach((b) => b.addEventListener("click", () => {
      returnFocusTo = b;
      openCookie({ withPrefs: true, focus: true });
    }));
    $$("[data-load-map]").forEach((b) => b.addEventListener("click", () => {
      writeConsent(true);
      if (!cookie.hidden) closeCookie();
    }));
    const existing = readConsent();
    if (existing) applyConsent(existing);
  }
  function maybeAskCookies() {
    if (cookie && !readConsent()) setTimeout(() => openCookie(), 700);
  }

  /* ------------------------------------------------------------------
     Text splitting (screen readers get the plain text)
  ------------------------------------------------------------------ */
  $$("[data-split]").forEach((el) => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(" ");
  });
  $$(".display").forEach((el) => {
    const text = el.textContent.trim();
    const visual = text.split(" ").map((word) =>
      `<span class="cw">${Array.from(word).map((ch) => `<span class="c">${ch}</span>`).join("")}</span>`
    ).join(" ");
    el.innerHTML = `<span class="sr-only">${text}</span><span aria-hidden="true">${visual}</span>`;
  });
  $$(".footer__word").forEach((el) => {
    el.innerHTML = Array.from(el.textContent).map((ch) => `<span class="footer__l">${ch}</span>`).join("");
  });
  $$(".nav__list a").forEach((a) => {
    const t = a.textContent;
    a.innerHTML = `<span class="roll"><span class="roll__a">${t}</span><span class="roll__b" aria-hidden="true">${t}</span></span>`;
  });

  /* ------------------------------------------------------------------
     No GSAP? Everything above still works; stop here.
  ------------------------------------------------------------------ */
  const reveal = () => {
    if (MSB.revealed) return;
    MSB.revealed = true;
    window.dispatchEvent(new CustomEvent("msb:reveal"));
    maybeAskCookies();
  };
  if (!hasGsap()) { reveal(); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------
     Custom cursor ring + magnetic buttons (mouse users only)
  ------------------------------------------------------------------ */
  if (finePointer && !reduceMotion()) {
    const ring = document.createElement("div");
    ring.className = "cursor";
    ring.setAttribute("aria-hidden", "true");
    ring.innerHTML = '<span class="cursor__label"></span>';
    document.body.appendChild(ring);
    const label = $(".cursor__label", ring);
    const xTo = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" });
    const yTo = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });
    let shown = false;
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      if (!shown) { gsap.set(ring, { x: e.clientX, y: e.clientY }); ring.classList.add("is-on"); shown = true; }
      xTo(e.clientX); yTo(e.clientY);
    }, { passive: true });
    root.addEventListener("mouseleave", () => { ring.classList.remove("is-on"); shown = false; });
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("a, button, [data-cursor], .pole");
      ring.classList.toggle("is-hover", !!t);
      const txt = t && (t.dataset.cursor || (t.classList.contains("pole") ? "Spin" : ""));
      ring.classList.toggle("has-label", !!txt);
      if (txt) label.textContent = txt;
      ring.classList.toggle("is-hidden", !!e.target.closest("iframe, .map iframe"));
    });
    document.addEventListener("pointerdown", () => ring.classList.add("is-down"));
    document.addEventListener("pointerup", () => ring.classList.remove("is-down"));

    $$("[data-magnetic]").forEach((el) => {
      const mx = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
      const my = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * 0.28);
        my((e.clientY - (r.top + r.height / 2)) * 0.38);
      });
      el.addEventListener("pointerleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.35)" });
      });
    });
  }

  /* ------------------------------------------------------------------
     Scroll motion
  ------------------------------------------------------------------ */
  const mm = gsap.matchMedia();
  mm.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      desktop: "(min-width: 721px)",
      pinnable: "(min-width: 721px) and (min-height: 700px)",
    },
    (ctx) => {
      const { motion, desktop, pinnable } = ctx.conditions;
      if (!motion) { reveal(); return; }
      root.classList.add("js-motion");

      /* progress bar */
      gsap.to(".progress__bar", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

      /* hero entrance (plays after the preloader) */
      const intro = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
      intro
        .from(".site-header__inner > *", { y: -24, opacity: 0, duration: 0.9, stagger: 0.07 }, 0.05)
        .from(".hero__ghost", { opacity: 0, scale: 1.25, duration: 2.4 }, 0)
        .from(".hero__title .line__in", { yPercent: 115, rotate: 4, duration: 1.4, stagger: 0.13 }, 0.1)
        .from(".status", { y: 18, opacity: 0, duration: 0.9 }, 0.3)
        .from([".hero__lede", ".hero__actions"], { y: 28, opacity: 0, duration: 1.1, stagger: 0.09 }, 0.5)
        .from(".pole__css", { y: 120, opacity: 0, duration: 1.6 }, 0.2)
        .from(".badge", { scale: 0, rotate: -180, duration: 1.4, ease: "back.out(1.6)" }, 0.7)
        .from(".hero__facts .fact", { y: 40, opacity: 0, rotateX: -50, transformOrigin: "50% 100%", duration: 1.1, stagger: 0.09 }, 0.6);

      const playIntro = () => { intro.play(); reveal(); };

      /* preloader: once per visit */
      let seen = false;
      try { seen = sessionStorage.getItem("msb-intro") === "1"; } catch (e) { /* ignore */ }
      if (!seen) {
        try { sessionStorage.setItem("msb-intro", "1"); } catch (e) { /* ignore */ }
        const pre = document.createElement("div");
        pre.className = "preloader";
        pre.setAttribute("aria-hidden", "true");
        pre.innerHTML = '<div class="preloader__cols"><span></span><span></span><span></span><span></span><span></span></div>' +
          '<div class="preloader__inner"><p class="preloader__count"><span data-pre-count>0</span></p>' +
          '<p class="preloader__name">Main St Barbershop · Pomona</p><div class="preloader__bar"><span></span></div></div>';
        document.body.appendChild(pre);
        document.body.style.overflow = "hidden";
        const done = () => {
          if (!pre.isConnected) return;
          pre.remove();
          document.body.style.overflow = "";
          playIntro();
        };
        const failsafe = setTimeout(done, 5000);
        const cnt = { v: 0 };
        const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        fontsReady.then(() => {
          gsap.timeline({ onComplete: () => { clearTimeout(failsafe); done(); } })
            .to(cnt, { v: 100, duration: 1.15, ease: "power2.inOut", onUpdate: () => { $("[data-pre-count]", pre).textContent = String(Math.round(cnt.v)); } })
            .to(".preloader__bar span", { scaleX: 1, duration: 1.15, ease: "power2.inOut" }, 0)
            .to(".preloader__inner", { yPercent: -40, opacity: 0, duration: 0.5, ease: "power3.in" }, "+=0.1")
            .to(".preloader__cols span", { yPercent: -100, duration: 0.9, ease: "expo.inOut", stagger: 0.06 }, "-=0.2")
            .add(() => playIntro(), "-=0.55");
        });
      } else {
        playIntro();
      }

      /* hero parallax */
      const heroST = () => ({ trigger: ".hero", start: "top top", end: "bottom top", scrub: true });
      gsap.to(".hero__copy", { y: -110, ease: "none", scrollTrigger: heroST() });
      gsap.to(".hero__ghost", { y: -260, scale: 1.1, ease: "none", scrollTrigger: heroST() });
      gsap.to(".pole", { y: -160, ease: "none", scrollTrigger: heroST() });
      gsap.to(".badge", { rotate: 200, ease: "none", scrollTrigger: heroST() });
      gsap.to(".hero__facts", { y: -40, opacity: 0.35, ease: "none", scrollTrigger: { trigger: ".hero__facts", start: "top 60%", end: "bottom top", scrub: true } });

      /* CSS-pole fallback stripes follow scroll if the 3D pole didn't load */
      const stripes = $(".pole__stripes");
      const poleEl = $(".pole");
      if (stripes) {
        const period = 88 / Math.cos((35 * Math.PI) / 180);
        const setY = gsap.quickSetter(stripes, "y", "px");
        let current = 0;
        const tick = () => {
          if (poleEl.classList.contains("is-3d")) return;
          current += (window.scrollY * 0.55 - current) * 0.12;
          setY(-(current % period));
        };
        gsap.ticker.add(tick);
        ctx.add(() => () => gsap.ticker.remove(tick));
      }

      /* crossed marquees: loop forever, speed and direction follow scroll */
      const loops = [];
      $$("[data-marquee]").forEach((track) => {
        if (!track.dataset.doubled) { track.innerHTML += track.innerHTML; track.dataset.doubled = "1"; } // two identical halves loop seamlessly
        const dir = Number(track.dataset.marquee) || 1;
        const t = gsap.fromTo(track, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 38, ease: "none", repeat: -1 });
        loops.push(t);
        ambient.push(t);
        if (MSB.paused) t.pause();
      });
      const skewTo = gsap.quickTo(".marquee__track", "skewX", { duration: 0.5, ease: "power3" });
      ScrollTrigger.create({
        trigger: ".marquees", start: "top bottom", end: "bottom top",
        onUpdate: (self) => {
          const v = self.getVelocity();
          if (MSB.paused) return;
          const boost = 1 + Math.min(4, Math.abs(v) / 400);
          loops.forEach((t) => gsap.to(t, { timeScale: boost, duration: 0.25, overwrite: true }));
          skewTo(gsap.utils.clamp(-10, 10, v / -180));
          clearTimeout(self._settle);
          self._settle = setTimeout(() => {
            loops.forEach((t) => gsap.to(t, { timeScale: 1, duration: 1.2 }));
            skewTo(0);
          }, 120);
        },
      });
      gsap.from(".marquee--brass", { rotate: 0, scale: 1.1, ease: "none", scrollTrigger: { trigger: ".marquees", start: "top bottom", end: "center center", scrub: true } });
      gsap.from(".marquee--wine", { rotate: 0, scale: 1.1, ease: "none", scrollTrigger: { trigger: ".marquees", start: "top bottom", end: "center center", scrub: true } });

      /* badge idles slowly (pausable) */
      const badgeSpin = gsap.to(".badge__text", { rotate: 360, svgOrigin: "100 100", duration: 24, ease: "none", repeat: -1 });
      ambient.push(badgeSpin);
      if (MSB.paused) badgeSpin.pause();

      /* display headings: letters rise from a mask, with a little tilt */
      $$(".display").forEach((h) => {
        gsap.from($$(".c", h), {
          yPercent: 110, rotate: 8, duration: 1.1, ease: "expo.out", stagger: 0.022,
          scrollTrigger: { trigger: h, start: "top 86%", once: true },
        });
      });

      /* about: words light up as you read */
      gsap.to(".about__statement .w", {
        color: "#f3e9dc", ease: "none", stagger: 0.1,
        scrollTrigger: { trigger: ".about__statement", start: "top 80%", end: "bottom 45%", scrub: true },
      });
      gsap.set(".about__points li", { y: 40, opacity: 0 });
      ScrollTrigger.batch(".about__points li", {
        start: "top 88%", once: true,
        onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 1, stagger: 0.09, ease: "expo.out" }),
      });

      /* generic reveals */
      $$("[data-reveal]").forEach((el) => {
        gsap.from(el, { y: 32, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });

      /* menu rows */
      gsap.set([".menu__cat", ".price"], { x: -36, opacity: 0 });
      ScrollTrigger.batch([".menu__cat", ".price"], {
        start: "top 92%", once: true,
        onEnter: (b) => gsap.to(b, { x: 0, opacity: 1, duration: 0.9, stagger: 0.06, ease: "expo.out" }),
      });

      /* know your fade: pinned on large screens, scroll walks through the four fades */
      if (pinnable) {
        fadeST = ScrollTrigger.create({
          trigger: ".fades__stage", start: "top top", end: "+=220%", pin: true, anticipatePin: 1,
          onUpdate: (self) => setFade(Math.min(FADES.length - 1, Math.floor(self.progress * FADES.length * 0.999))),
        });
        gsap.fromTo(".head", { rotate: -4, scale: 0.94 }, {
          rotate: 3, scale: 1, ease: "none",
          scrollTrigger: { trigger: ".fades__stage", start: "top top", end: "+=220%", scrub: true },
        });
        ctx.add(() => () => { fadeST = null; });
      } else {
        ScrollTrigger.create({ trigger: ".fades__fig", start: "top 70%", once: true, onEnter: () => setFade(1) });
      }
      gsap.from(".head__halo", { scale: 0.6, opacity: 0, transformOrigin: "50% 50%", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".fades__fig", start: "top 80%", once: true } });
      gsap.from(".fades__tab", { y: 20, opacity: 0, stagger: 0.06, duration: 0.8, ease: "expo.out", scrollTrigger: { trigger: ".fades__tabs", start: "top 90%", once: true } });

      /* guard bars grow */
      gsap.set(".guard__bar span", { scaleX: 0 });
      ScrollTrigger.batch(".guard", {
        start: "top 92%", once: true,
        onEnter: (b) => gsap.to(b.map((g) => $(".guard__bar span", g)), { scaleX: 1, duration: 1.2, stagger: 0.08, ease: "expo.out" }),
      });

      /* reviews: horizontal ride on tall screens */
      const track = $("[data-track]");
      if (track && pinnable) {
        root.classList.add("reviews-pinned");
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const ride = gsap.to(track, {
          x: () => -dist(), ease: "none",
          scrollTrigger: { trigger: ".reviews", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 },
        });
        const onFocus = (e) => {
          const card = e.target.closest(".quote, .score-card");
          const st = ride.scrollTrigger;
          if (!card || !st) return;
          const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
          const p = gsap.utils.clamp(0, 1, (card.offsetLeft - pad) / (dist() || 1));
          window.scrollTo({ top: st.start + p * (st.end - st.start), behavior: "auto" });
        };
        track.addEventListener("focusin", onFocus);
        ctx.add(() => () => { track.removeEventListener("focusin", onFocus); root.classList.remove("reviews-pinned"); });
        $$(".quote", track).forEach((q) => {
          gsap.from(q, { rotate: 6, yPercent: 12, scale: 0.9, ease: "none", scrollTrigger: { trigger: q, containerAnimation: ride, start: "left right", end: "left 45%", scrub: true } });
          gsap.fromTo($(".quote__mark", q), { xPercent: 40 }, { xPercent: -40, ease: "none", scrollTrigger: { trigger: q, containerAnimation: ride, start: "left right", end: "right left", scrub: true } });
        });
      } else if (track) {
        gsap.set($$(".score-card, .quote", track), { y: 50, opacity: 0, rotate: 2 });
        ScrollTrigger.batch($$(".score-card, .quote", track), {
          start: "top 90%", once: true,
          onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, rotate: 0, duration: 1, stagger: 0.1, ease: "expo.out" }),
        });
      }

      /* rating counters + stars */
      $$("[data-count]").forEach((el) => {
        const end = parseFloat(el.dataset.count);
        const dec = Number(el.dataset.decimals || 0);
        const o = { v: 0 };
        gsap.to(o, { v: end, duration: 1.6, ease: "power3.out", onUpdate: () => { el.textContent = o.v.toFixed(dec); }, scrollTrigger: { trigger: el, start: "top 92%", once: true } });
      });

      /* booking rows */
      gsap.set(".way", { y: 46, opacity: 0 });
      ScrollTrigger.batch(".way", {
        start: "top 92%", once: true,
        onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: "expo.out" }),
      });

      /* hours dial: arc draws, hand sweeps from midnight to now */
      if (dialArc) {
        const len = dialArc.getTotalLength ? dialArc.getTotalLength() : 300;
        gsap.set(dialArc, { strokeDasharray: len, strokeDashoffset: len });
        dialHand.dataset.animating = "1";
        setHand(0);
        ScrollTrigger.create({
          trigger: ".dial", start: "top 85%", once: true,
          onEnter: () => {
            const target = MSB.status ? minsToDeg(MSB.status.mins) : 0;
            const p = { d: 0 };
            gsap.to(dialArc, { strokeDashoffset: 0, duration: 1.6, ease: "expo.inOut" });
            gsap.to(p, { d: target, duration: 2, ease: "expo.inOut", onUpdate: () => setHand(p.d), onComplete: () => { delete dialHand.dataset.animating; renderStatus(); } });
            gsap.from(".dial__ticks line", { opacity: 0, stagger: 0.025, duration: 0.4 });
          },
        });
      }
      gsap.set([".hours tr", ".hours__title", ".hours__status"], { y: 18, opacity: 0 });
      ScrollTrigger.batch([".hours__title", ".hours__status", ".hours tr"], {
        start: "top 94%", once: true,
        onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 0.8, stagger: 0.05, ease: "expo.out" }),
      });

      /* map */
      gsap.from(".map", { clipPath: "inset(14% 14% 14% 14% round 24px)", scale: 1.05, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".map", start: "top 85%", once: true } });
      gsap.to(".map__pulse", { scale: 1.7, opacity: 0, transformOrigin: "50% 50%", duration: 1.6, ease: "power2.out", repeat: 2, scrollTrigger: { trigger: ".map", start: "top 70%", once: true } });

      /* footer name: letters rise with scroll */
      gsap.from(".footer__l", {
        yPercent: 90, rotate: 6, ease: "none", stagger: 0.06,
        scrollTrigger: { trigger: ".footer", start: "top bottom", end: "top 20%", scrub: 1 },
      });

      ctx.add(() => () => { ambient.length = 0; });
    }
  );

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
