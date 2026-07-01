/* shared-layout.js — injected into admin pages */
(async function () {
  // Fetch current user from session via a lightweight endpoint
  let user = { name: 'Staff', role: 'admin' };
  try {
    const r = await fetch('/api/me');
    if (r.ok) user = (await r.json()).data;
  } catch (_) {}

  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const page = window.location.pathname;
  const link = (href, icon, label) =>
    `<a class="nav-link ${page === href || page.startsWith(href + '/') ? 'active' : ''}" href="${href}">
      <span class="icon">${icon}</span>${label}
    </a>`;

  const sidebar = `
    <aside class="sidebar" id="sidebar">
      <a class="sidebar-brand" href="/"><span class="dot">▶</span> ShipTrack Pro</a>
      <nav class="sidebar-nav">
        <div class="nav-section">Operations</div>
        ${link('/admin', '📦', 'Shipments')}
        ${link('/admin/couriers', '🛵', 'Couriers')}
        <div class="nav-section">Management</div>
        ${link('/admin/users', '👤', 'Staff Accounts')}
        <div class="nav-section">Public</div>
        ${link('/', '🏠', 'Homepage')}
        ${link('/track', '🔍', 'Track Page')}
      </nav>
      <div class="sidebar-footer">
        <div class="user-pill">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${user.name}</div>
            <div class="user-role">${user.role}</div>
          </div>
        </div>
        <form action="/auth/logout" method="POST" style="margin:0">
          <button type="submit" class="btn" style="width:100%;justify-content:center;background:rgba(255,255,255,.08);color:rgba(255,255,255,.7);font-size:.8rem;padding:.5rem">Sign out</button>
        </form>
      </div>
    </aside>`;

  document.body.insertAdjacentHTML('afterbegin', sidebar);

  // mobile toggle
  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }
})();
