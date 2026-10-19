// =====================================================================
// shared.js — used by EVERY page (loaded in the <head>).
//   1. Settings
//   2. Talk to the server (PHP API)
//   3. Sign-in check for pages
//   4. English / Arabic texts
// Each page also has its own file: a01-login.js, a02-role.js, ...
// =====================================================================


// ---------- 1. Settings ----------

// The app folder on the server: http://localhost/empulse/
const APP = '/empulse/';

// The first screen of each role, and whether it is built yet.
// When a screen is finished, write its file here and set ready: true.
const HOME = {
  employee:  { screen: 'E01', file: 'pages/employee/overview.html', ready: false },
  manager:   { screen: 'M01', file: 'pages/manager/overview.html',  ready: false },
  hr:        { screen: 'H01', file: 'pages/hr/executive.html',      ready: false },
  executive: { screen: 'H01', file: 'pages/hr/executive.html',      ready: false },
  admin:     { screen: 'H01', file: 'pages/hr/executive.html',      ready: false },
};


// ---------- 2. Talk to the server ----------

// Call a PHP file in server/api/.
//   api('me.php')                  -> GET
//   api('login.php', {email: ...}) -> POST with JSON
// Returns { status: 200, data: {...} }
async function api(file, body) {
  const options = { credentials: 'same-origin' };
  if (body !== undefined) {
    options.method = 'POST';
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(APP + 'server/api/' + file, options);
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;          // the server did not answer with JSON (for example a PHP error)
  }
  return { status: response.status, data: data };
}


// ---------- 3. Sign-in check ----------

// The signed-in user, or null.
async function getUser() {
  const result = await api('me.php');
  if (result.status === 200) {
    return result.data;
  }
  return null;
}

// Use at the start of a page that needs sign-in:
//   const user = await requireRole(['employee']);
// Not signed in -> back to the login page.
// (The data itself is protected in PHP: every API file checks the role again.)
async function requireRole(roles) {
  const user = await getUser();
  if (user === null || !roles.includes(user.role)) {
    window.location.href = APP + 'index.html';
    return null;
  }
  return user;
}

// Sign out, then open a page (the login page by default).
async function signOut(nextPage) {
  await api('logout.php', {});
  window.location.href = nextPage || APP + 'index.html';
}


// ---------- 4. English / Arabic ----------
// In the HTML:  <h1 data-i18n="a01.title">See the people behind the performance.</h1>
// The English text is already in the HTML. For Arabic, the text comes from assets/lang/ar.json.
// Numbers are written in the HTML inside <bdi> so they stay left-to-right in Arabic.

let texts = {};

// The chosen language is saved in the browser.
function getLang() {
  return localStorage.getItem('lang') === 'ar' ? 'ar' : 'en';
}

function setLang(lang) {
  localStorage.setItem('lang', lang);
  window.location.reload();
}

// The text of one key (used by the page scripts, for example for error messages).
function t(key) {
  return texts[key] || key;
}

// Load the language file and put the texts into the page.
async function loadTexts() {
  try {
    const response = await fetch(APP + 'assets/lang/' + getLang() + '.json');
    texts = await response.json();
  } catch (error) {
    texts = {};            // file missing: keep the English text that is in the HTML
  }

  document.querySelectorAll('[data-i18n]').forEach(function (element) {
    const key = element.dataset.i18n;
    if (texts[key]) {
      element.textContent = texts[key];
    }
  });

  if (texts[document.body.dataset.title]) {
    document.title = texts[document.body.dataset.title];
  }

  // Language buttons "EN | العربية"
  document.querySelectorAll('.lang-switch button').forEach(function (button) {
    if (button.lang === getLang()) {
      button.classList.add('active');
    }
    button.addEventListener('click', function () {
      setLang(button.lang);
    });
  });

  document.documentElement.classList.remove('loading');   // show the page
}

// If index.html was opened by double-click (file:///C:/xampp/htdocs/empulse/index.html),
// move to the same page through Apache (http://localhost/empulse/index.html),
// because PHP (sign-in, data) only works through Apache.
// If Apache is not started, the browser will say it cannot reach localhost.
if (window.location.protocol === 'file:') {
  const path = window.location.pathname;                 // /C:/xampp/htdocs/empulse/index.html
  const start = path.toLowerCase().indexOf('/htdocs/');
  if (start !== -1) {
    window.location.replace('http://localhost/' + path.substring(start + 8) + window.location.search);
  }
}

// Runs at once: set the language and direction before the page is drawn.
document.documentElement.lang = getLang();
document.documentElement.dir = getLang() === 'ar' ? 'rtl' : 'ltr';
document.documentElement.classList.add('loading');        // hidden until the texts are ready
