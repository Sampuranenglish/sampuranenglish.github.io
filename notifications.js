// Shows the SSC notification bell badge + dropdown on every page that
// includes header.html (i.e. every page with a #site-header div).
//
// - Fetches the latest notice(s) from data/ssc-latest.json.
//   Accepts either a single notice object { "title": "...", "link": "..." }
//   or an array of notice objects, so more notices can be added later
//   without any code changes.
// - Shows a red dot on the bell icon while there is an unread notice.
// - Clicking the bell opens a dropdown listing the notice(s).
// - Clicking a notice in the dropdown marks it as read, hides the red dot,
//   and opens the SSC website in a new tab.
function initNotifications() {
  var SSC_SITE = 'https://ssc.gov.in/';

  fetch('data/ssc-latest.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data) return;

      // Normalize to an array of notices.
      var notices = Array.isArray(data) ? data : [data];
      notices = notices.filter(function (n) { return n && n.title; });
      if (!notices.length) return;

      var badge = document.querySelector('.icon-badge');
      var notifBtn = document.getElementById('notifBtn');
      var dropdown = document.getElementById('notifDropdown');
      var list = document.getElementById('notifList');
      if (!notifBtn || !dropdown || !list) return;

      var seen = [];
      try {
        seen = JSON.parse(localStorage.getItem('sscSeenNotices') || '[]');
      } catch (e) {
        seen = [];
      }

      function isUnseen(notice) {
        return seen.indexOf(notice.title) === -1;
      }

      function markSeen(notice) {
        if (isUnseen(notice)) {
          seen.push(notice.title);
          localStorage.setItem('sscSeenNotices', JSON.stringify(seen));
        }
      }

      function updateBadge() {
        var hasUnseen = notices.some(isUnseen);
        if (badge) badge.style.display = hasUnseen ? 'block' : 'none';
      }

      function closeDropdown() {
        dropdown.classList.remove('open');
        notifBtn.setAttribute('aria-expanded', 'false');
      }

      function renderList() {
        list.innerHTML = '';
        notices.forEach(function (notice) {
          var li = document.createElement('li');
          li.textContent = notice.title;
          li.addEventListener('click', function () {
            markSeen(notice);
            updateBadge();
            closeDropdown();
            window.open(SSC_SITE, '_blank', 'noopener');
          });
          list.appendChild(li);
        });
      }

      renderList();
      updateBadge();

      notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = dropdown.classList.toggle('open');
        notifBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Close the dropdown when clicking anywhere else on the page.
      document.addEventListener('click', function (e) {
        if (!dropdown.contains(e.target) && e.target !== notifBtn) {
          closeDropdown();
        }
      });
    })
    .catch(function () { /* fail silently, no notice shown */ });
}
