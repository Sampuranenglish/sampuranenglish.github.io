fetch('data/ssc-latest.json')
  .then(function(r){ return r.json(); })
  .then(function(data){
    if (!data || !data.title) return;
    var seen = localStorage.getItem('sscLastSeenNotice');
    var badge = document.querySelector('.icon-badge');
    var notifBtn = document.querySelector('[aria-label="Notifications"]');
    if (data.title !== seen) {
      if (badge) badge.style.display = 'block';
    } else {
      if (badge) badge.style.display = 'none';
    }
    if (notifBtn) {
      notifBtn.addEventListener('click', function(){
        localStorage.setItem('sscLastSeenNotice', data.title);
        if (badge) badge.style.display = 'none';
        window.open(data.link, '_blank');
      });
    }
  })
  .catch(function(){});
