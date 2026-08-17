// Shows the SSC notification bell badge on every page that includes header.html.
// On pages that also have a #ssc-notification-banner element (Home page),
// it also fills in and reveals that visible banner.
function initNotifications() {
  fetch('data/ssc-latest.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.title) return;

      var seen = localStorage.getItem('sscLastSeenNotice');
      var badge = document.querySelector('.icon-badge');
      var notifBtn = document.querySelector('[aria-label="Notifications"]');
      var banner = document.getElementById('ssc-notification-banner');
      var bannerText = document.getElementById('ssc-notification-text');

      // Home page banner: always show the latest notice while it's current.
      if (banner && bannerText) {
        bannerText.textContent = data.title;
        banner.href = data.link;
        banner.style.display = 'flex';
      }

      // Bell badge: only show a red dot if this notice hasn't been opened yet.
      if (badge) {
        badge.style.display = (data.title !== seen) ? 'block' : 'none';
      }

      if (notifBtn) {
        notifBtn.addEventListener('click', function () {
          localStorage.setItem('sscLastSeenNotice', data.title);
          if (badge) badge.style.display = 'none';
          window.open(data.link, '_blank', 'noopener');
        });
      }
    })
    .catch(function () { /* fail silently, no notice shown */ });
}
