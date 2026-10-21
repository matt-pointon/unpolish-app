// Fieldtrip demo behaviour: tabs, menu, dialog, form states, dynamic content.
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Tabs
  var tabs = $$('[role="tab"]');
  function select(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var n = tabs[(i + d + tabs.length) % tabs.length];
      select(n); n.focus();
    });
  });

  // Sidebar navigation (hash routing keeps the page state)
  function route() {
    var h = location.hash || '#overview';
    $$('.nav-item').forEach(function (a) {
      var on = a.getAttribute('href') === h;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (h === '#schedule') select($('#tab-schedule'));
    if (h === '#budget') select($('#tab-budget'));
    if (h === '#overview') select($('#tab-overview'));
  }
  window.addEventListener('hashchange', route);
  route();

  // Account menu
  var menuBtn = $('#account-btn'), menu = $('#account-menu');
  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('[role="menuitem"]').focus();
  }
  menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('.menu-wrap')) setMenu(false); });
  menu.addEventListener('keydown', function (e) {
    var items = $$('[role="menuitem"]', menu), i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { setMenu(false); menuBtn.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  menu.addEventListener('click', function (e) { if (e.target.closest('[role="menuitem"]')) { setMenu(false); toast('Menu item chosen'); } });

  // Dialog
  var dialog = $('#book-dialog');
  $('#book-btn').addEventListener('click', function () { dialog.showModal(); });
  dialog.addEventListener('close', function () { if (dialog.returnValue === 'confirm') toast('Casa Azul booked'); });

  $('#share-btn').addEventListener('click', function () { toast('Plan link copied'); });

  // Form validation + loading state
  var form = $('#hold-form'), email = form.elements.email, err = $('#email-error');
  function validate() {
    var ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value);
    email.setAttribute('aria-invalid', String(!ok));
    err.hidden = ok;
    return ok;
  }
  email.addEventListener('input', validate);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) { email.focus(); return; }
    var btn = $('#hold-submit');
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Sending…';
    setTimeout(function () {
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      btn.textContent = 'Send request';
      toast('Hold requested for ' + form.elements.venue.value);
      addFeed('You requested a hold at ' + form.elements.venue.value);
    }, 900);
  });
  form.addEventListener('reset', function () { setTimeout(validate); });

  // Dynamic content
  function addFeed(text) {
    var li = document.createElement('li');
    li.className = 'is-new';
    li.innerHTML = '<img src="../../examples/assets/avatar-2.svg" alt="" width="28" height="28"><div><strong>Maya</strong> <span></span> <span class="time">now</span></div>';
    li.querySelector('div span').textContent = text.replace(/^You /, '');
    $('#feed').prepend(li);
  }
  var sessions = [['14:30', 'Breakout workshops', 'Rooms A–C'], ['16:00', 'Boat trip', 'Pier 4'], ['19:30', 'Team dinner', 'Old town']];
  $('#add-session').addEventListener('click', function () {
    var s = sessions.shift();
    if (!s) { toast('Day one is full'); return; }
    var li = document.createElement('li');
    li.innerHTML = '<time></time><div><strong></strong><span class="tag"></span></div>';
    li.querySelector('time').textContent = s[0];
    li.querySelector('strong').textContent = s[1];
    li.querySelector('.tag').textContent = s[2];
    $('#timeline').appendChild(li);
  });

  function toast(text) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<svg><use href="#i-check"/></svg><span></span>';
    t.querySelector('span').textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(100%)'; setTimeout(function () { t.remove(); }, 300); }, 2400);
  }
  window.fieldtripToast = toast;
})();
