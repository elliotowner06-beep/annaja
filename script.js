/* ============================================================
   WhatsApp Web wrapper – launcher logic
   - Tidak membaca/mengubah isi WhatsApp Web
   - Tidak menyimpan credential/session
   - Hanya: loading state, cek koneksi, viewport, error + retry
   ============================================================ */
(function () {
  'use strict';

  var TARGET = 'https://web.whatsapp.com/';
  var MIN_SPLASH_MS = 700;      // splash minimal agar tidak berkedip
  var PROBE_TIMEOUT_MS = 10000; // batas waktu cek koneksi
  var SLOW_HINT_MS = 15000;     // munculkan "Open directly" jika terlalu lama

  /* ---------- i18n sederhana (id / en) ---------- */

  var STRINGS = {
    en: {
      connecting: 'Connecting...',
      retry: 'Try again',
      openDirect: 'Open directly',
      offlineTitle: 'No internet connection',
      offlineText: 'Check your Wi-Fi or mobile data, then try again.',
      timeoutTitle: 'Connection timed out',
      timeoutText: 'WhatsApp Web is taking too long to respond. Try again in a moment.',
      networkTitle: "Couldn't reach WhatsApp Web",
      networkText: 'Check your connection and try again.'
    },
    id: {
      connecting: 'Connecting...',
      retry: 'Coba lagi',
      openDirect: 'Buka langsung',
      offlineTitle: 'Tidak ada koneksi internet',
      offlineText: 'Periksa Wi-Fi atau data seluler, lalu coba lagi.',
      timeoutTitle: 'Koneksi habis waktu',
      timeoutText: 'WhatsApp Web terlalu lama merespons. Coba lagi sebentar lagi.',
      networkTitle: 'WhatsApp Web tidak dapat dijangkau',
      networkText: 'Periksa koneksi Anda, lalu coba lagi.'
    }
  };

  var lang = ((navigator.language || 'en').slice(0, 2) === 'id') ? 'id' : 'en';
  var t = function (key) { return STRINGS[lang][key]; };

  function applyI18n() {
    document.documentElement.lang = lang;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
  }

  /* ---------- Elemen ---------- */

  var screenEl = document.querySelector('.screen');
  var errorTitle = document.getElementById('errorTitle');
  var errorText = document.getElementById('errorText');
  var retryBtn = document.getElementById('retryBtn');
  var slowLink = document.getElementById('openSlow');

  /* ---------- Viewport (keyboard Android, rotasi, notch) ---------- */

  function setViewportHeight() {
    var vv = window.visualViewport;
    var h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', Math.round(h) + 'px');
  }

  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', setViewportHeight);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setViewportHeight);
  }

  /* ---------- State UI ---------- */

  var slowTimer = null;

  function setConnecting() {
    screenEl.setAttribute('data-state', 'connecting');
    slowLink.hidden = true;
    clearTimeout(slowTimer);
    slowTimer = setTimeout(function () { slowLink.hidden = false; }, SLOW_HINT_MS);
  }

  function showError(reason) {
    clearTimeout(slowTimer);
    var key = reason === 'offline' ? 'offline' : reason === 'timeout' ? 'timeout' : 'network';
    errorTitle.textContent = t(key + 'Title');
    errorText.textContent = t(key + 'Text');
    screenEl.setAttribute('data-state', 'error');
    try { retryBtn.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
  }

  /* ---------- Cek koneksi ke WhatsApp Web ----------
     Request "no-cors" hanya untuk mengetahui server bisa dijangkau.
     Responsnya opaque: isinya tidak bisa dan tidak akan dibaca. */

  function probe() {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      if (ctrl) ctrl.abort();
    }, PROBE_TIMEOUT_MS);

    return fetch(TARGET, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function () {
      clearTimeout(timer);
      return { ok: true };
    }).catch(function () {
      clearTimeout(timer);
      return { ok: false, timeout: timedOut };
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ---------- Alur utama ---------- */

  var attempt = 0;

  function connect() {
    var id = ++attempt;
    var started = Date.now();
    setConnecting();

    if (navigator.onLine === false) {
      return delay(MIN_SPLASH_MS).then(function () {
        if (id === attempt) showError('offline');
      });
    }

    return probe().then(function (result) {
      var wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started));
      return delay(wait).then(function () {
        if (id !== attempt) return;
        if (!result.ok) {
          showError(result.timeout ? 'timeout' : 'network');
          return;
        }
        // replace(): halaman launcher tidak masuk history,
        // jadi tombol Back tidak kembali ke splash.
        window.location.replace(TARGET);
      });
    });
  }

  /* ---------- Event ---------- */

  retryBtn.addEventListener('click', connect);

  // Koneksi kembali saat layar error offline tampil → coba otomatis
  window.addEventListener('online', function () {
    if (screenEl.getAttribute('data-state') === 'error') connect();
  });

  // Kembali ke halaman ini dari bfcache → mulai ulang
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) connect();
  });

  applyI18n();
  connect();
})();
