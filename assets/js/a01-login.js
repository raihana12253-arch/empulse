// =====================================================================
// a01-login.js — A01 Login (index.html)
//   1. Draw the heartbeat line
//   2. "Forgot password?" note
//   3. Sign in (sends the form to server/api/login.php)
//   4. When the page opens
// =====================================================================


// ---------- 1. Heartbeat line ----------
// Points measured from the design image. One beat every 56 px:
// up to the top of the spike, down below the line, a small bump, back to the line.
function drawHeartbeat() {
  const spikeTops = [27, 49, 18, 63, 9, 39, 51, -2, 35, 21, 49];   // smaller = higher spike
  let d = 'M0 202 L32.7 204 L40.4 219';

  for (let i = 0; i < spikeTops.length; i++) {
    const x = 46 + 56 * i;
    d += ' L' + x + ' ' + spikeTops[i];          // top of the spike
    d += ' L' + (x + 7.7) + ' 239';              // below the line
    d += ' L' + (x + 15.4) + ' 197';             // small bump
    if (i < spikeTops.length - 1) {
      d += ' L' + (x + 42.7) + ' 204 L' + (x + 50.4) + ' 219';   // back to the line, small dip
    } else {
      d += ' L' + (x + 44) + ' 204';             // end of the line
    }
  }
  document.getElementById('heartbeat').setAttribute('d', d);
}


// ---------- 2. Notes ----------
// Password reset is not real in the demo: show a short note instead.
function showNote(id) {
  document.getElementById(id).hidden = false;
}


// ---------- 3. Sign in ----------
function showError(key) {
  const box = document.getElementById('login-error');
  box.textContent = t(key);
  box.hidden = false;
}

async function signIn(event) {
  event.preventDefault();                        // stay on this page, we send the data with fetch

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const remember = document.getElementById('remember').checked;

  if (email === '' || password === '') {
    showError('a01.error_missing');
    return;
  }

  const result = await api('login.php', { email: email, password: password, remember: remember });

  if (result.status === 200) {
    window.location.href = APP + 'pages/role.html';     // A01 -> A02
  } else if (result.status === 401) {
    showError('a01.error_invalid');
  } else {
    showError('a01.error_server');               // for example MySQL is not running
  }
}


// ---------- 4. When the page opens ----------
document.addEventListener('DOMContentLoaded', async function () {
  // Connect the buttons first, so they work at once.
  document.getElementById('login-form').addEventListener('submit', signIn);
  document.getElementById('forgot-link').addEventListener('click', function (event) {
    event.preventDefault();
    showNote('forgot-note');
  });

  drawHeartbeat();
  await loadTexts();

  // Coming from A02 "Continue as Yasmin": fill that demo email (index.html?as=yasmin).
  const demoEmails = { layla: 'layla@horizon.demo', yasmin: 'yasmin@horizon.demo', rana: 'rana@horizon.demo' };
  const as = new URLSearchParams(window.location.search).get('as');
  if (demoEmails[as]) {
    document.getElementById('email').value = demoEmails[as];
    document.getElementById('password').focus();
  }
});
