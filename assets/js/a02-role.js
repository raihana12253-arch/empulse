// =====================================================================
// a02-role.js — A02 Role Routing (pages/role.html)
//   - The card of YOUR role continues to your home screen (E01 / M01 / H01).
//     If that screen is not built yet, a short note is shown under the card.
//   - The other two cards sign you out and open the login page with that
//     demo account's email filled in (server/docs/DECISIONS.md D-03).
//   - "Back to sign in" signs you out.
// =====================================================================

// Which card belongs to each role (executive and admin use the HR & Executive card).
const CARD_OF_ROLE = { employee: 'employee', manager: 'manager', hr: 'hr', executive: 'hr', admin: 'hr' };

document.addEventListener('DOMContentLoaded', async function () {
  // Only signed-in users may see this page.
  const user = await requireRole(['employee', 'manager', 'hr', 'executive', 'admin']);
  if (user === null) {
    return;
  }
  await loadTexts();

  const home = HOME[user.role];

  document.querySelectorAll('.card').forEach(function (card) {
    const link = card.querySelector('.continue');

    link.addEventListener('click', function (event) {
      event.preventDefault();

      if (card.dataset.card !== CARD_OF_ROLE[user.role]) {
        // Another role: sign out, then the login page with that email filled in.
        signOut(APP + 'index.html?as=' + card.dataset.demo);
      } else if (home.ready) {
        // My role, screen is built: open it.
        window.location.href = APP + home.file;
      } else {
        // My role, screen not built yet: show the note.
        card.querySelector('.soon-note').hidden = false;
      }
    });

    if (card.dataset.card !== CARD_OF_ROLE[user.role]) {
      link.title = t('a02.other_hint');
    }
  });

  document.getElementById('back-link').addEventListener('click', function (event) {
    event.preventDefault();
    signOut();
  });
});
