'use strict';
/* Special admin console. No inline handlers or style attributes: the page runs under a strict CSP. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const state = { token: sessionStorage.getItem('special_admin_token') || '', user: null, me: null, page: 'overview', days: 7, pg: {}, auto: false, loginPhone: '', refocus: null };
const TITLES = { rlog: 'سجل قرارات البلاغات', appeals: 'الاعتراضات', alerts: 'التنبيهات التلقائية', overview: 'نظرة عامة', users: 'إدارة المستخدمين', posts: 'إدارة المنشورات', stories: 'إدارة الحالات والقصص', reports: 'مراجعة البلاغات', groups: 'المجموعات', conversations: 'المحادثات', sessions: 'الجلسات والأجهزة', broadcast: 'إرسال إعلان', campaigns: 'إدارة الحملات الإعلانية', backups: 'النسخ الاحتياطية', words: 'الكلمات المحظورة', audit: 'سجل الإدارة', otp: 'مراقبة رموز التحقق', admins: 'صلاحيات الإدارة', release: 'الإصدارات والتحديثات', errors: 'أخطاء الخادم', verifications: 'توثيق الحسابات', ai: 'الذكاء الاصطناعي' };
const ROLE_LABEL = { owner: 'مالك', admin: 'مدير', moderator: 'مشرف محتوى', support: 'دعم فني' };

/* ---------- helpers ---------- */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(v || 0).toLocaleString('en-US');
const when = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
};
/* Dates/phones: bidi-isolated LTR span so numbers never jumble inside RTL text. */
const whenLtr = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const wl = (v) => `<span class="text-ltr">${whenLtr(v)}</span>`;
const ago = (v) => {
  if (!v) return 'لم يظهر بعد';
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (Number.isNaN(s)) return '—';
  if (s < 90) return 'الآن';
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  return `منذ ${Math.floor(s / 86400)} يوم`;
};
const W = (html) => (state.me && state.me.canWrite ? html : ''); // admin/owner only (users, sessions, conversations, broadcasts…)
const M = (html) => (state.me && state.me.pages.includes('words') ? html : ''); // moderators and above (the server allows them to manage banned words)
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function toast(msg, error = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (error ? ' error' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  let r;
  try { r = await fetch('/api' + path, { ...opts, headers }); } catch { setLive(false); throw new Error('تعذر الاتصال بالخادم'); }
  setLive(true);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { logout(false); throw new Error('انتهت الجلسة، سجّل الدخول مجدداً'); }
  if (!r.ok) throw new Error(data.message || 'حدث خطأ في الطلب');
  return { data, total: Number(r.headers.get('X-Total-Count')) };
}
const api = async (path, opts) => (await request(path, opts)).data;
const apiList = async (path) => { const { data, total } = await request(path); return { items: Array.isArray(data) ? data : [], total: Number.isFinite(total) ? total : (Array.isArray(data) ? data.length : 0) }; };
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body || {}) });
const del = (path) => api(path, { method: 'DELETE' });

function setLive(ok) {
  const el = $('#liveDot');
  if (!el) return;
  el.textContent = ok ? 'الخادم متصل' : 'انقطع الاتصال';
  el.classList.toggle('offline', !ok);
}

/* ---------- UI building blocks ---------- */
const shell = (html) => { $('#pageContent').innerHTML = html; };
const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map((x, i) => `<th data-sort="${i}" title="اضغط للترتيب حسب هذا العمود">${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
const pill = (text, kind = '') => `<span class="pill ${kind}">${esc(text)}</span>`;
const toolbar = (title, actions = '') => `<div class="toolbar"><h2>${title}</h2><div class="toolbar-actions">${actions}</div></div>`;
const userCell = (u) => `<div class="user-cell"><div class="avatar">${esc((u.name || '?').slice(0, 1))}</div><div><b>${esc(u.name)}</b><small>@${esc(u.username || '—')}</small></div></div>`;
const empty = (msg) => `<div class="empty">${esc(msg)}</div>`;
const btn = (act, id, label, cls = '', extra = '') => `<button class="btn tiny ${cls}" data-act="${act}" data-id="${esc(id)}" ${extra}>${label}</button>`;

function closeModal() { $('#modalRoot').innerHTML = ''; }
function openModal(title, body) {
  $('#modalRoot').innerHTML = `<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true"><button class="modal-close" id="modalClose" aria-label="إغلاق">×</button><h2>${title}</h2>${body}</section></div>`;
  $('#modalClose').onclick = closeModal;
  $('#modalBackdrop').onclick = (e) => { if (e.target.id === 'modalBackdrop') closeModal(); };
}

/** Promise-based replacement for confirm()/prompt(): resolves true / {field values} on confirm, null on cancel. */
function ask({ title, message = '', confirm = 'تأكيد', danger = false, fields = [] }) {
  return new Promise((resolve) => {
    const root = $('#dialogRoot');
    const inputs = fields.map((f) => {
      const control = f.type === 'textarea'
        ? `<textarea name="${f.name}" rows="4" maxlength="${f.max || 500}" ${f.required ? 'required' : ''} placeholder="${esc(f.placeholder || '')}"></textarea>`
        : `<input name="${f.name}" maxlength="${f.max || 200}" autocomplete="off" ${f.required ? 'required' : ''} placeholder="${esc(f.placeholder || '')}">`;
      return `<div class="field"><label>${esc(f.label)}</label>${control}</div>`;
    }).join('');
    root.innerHTML = `<div class="modal-backdrop dialog-backdrop"><form class="dialog" role="alertdialog" aria-modal="true"><h2>${esc(title)}</h2>${message ? `<p class="dialog-text">${esc(message)}</p>` : ''}${inputs}<p class="dialog-error" id="dialogError"></p><div class="dialog-actions"><button type="button" class="btn ghost" id="dialogCancel">إلغاء</button><button type="submit" class="btn ${danger ? 'danger-solid' : 'primary'}">${esc(confirm)}</button></div></form></div>`;
    const form = $('form', root);
    const done = (value) => { document.removeEventListener('keydown', onKey); root.innerHTML = ''; resolve(value); };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    $('#dialogCancel').onclick = () => done(null);
    $('.dialog-backdrop', root).onclick = (e) => { if (e.target.classList.contains('dialog-backdrop')) done(null); };
    form.onsubmit = (e) => {
      e.preventDefault();
      const values = {};
      for (const f of fields) {
        const v = form.elements[f.name].value.trim();
        if (f.expect && v !== f.expect) { $('#dialogError').textContent = `اكتب «${f.expect}» بالضبط للتأكيد.`; return; }
        values[f.name] = v;
      }
      done(fields.length ? values : true);
    };
    const first = $('input,textarea', form);
    (first || $('button[type=submit]', form)).focus();
  });
}

function pager(key, total, limit) {
  const st = pg(key);
  if (total <= limit) return `<div class="pagination"><span>إجمالي النتائج: ${num(total)}</span></div>`;
  const from = Math.min(total, st.offset + 1), to = Math.min(total, st.offset + limit);
  return `<div class="pagination"><span>${num(from)}–${num(to)} من ${num(total)}</span><div class="actions"><button class="btn tiny" data-act="page" data-key="${key}" data-dir="-1" data-limit="${limit}" ${st.offset === 0 ? 'disabled' : ''}>السابق</button><button class="btn tiny" data-act="page" data-key="${key}" data-dir="1" data-limit="${limit}" ${st.offset + limit >= total ? 'disabled' : ''}>التالي</button></div></div>`;
}
const pg = (key) => state.pg[key] || (state.pg[key] = { offset: 0, q: '', f: {} });

/* CSV export of what the list currently shows (BOM keeps Arabic readable in Excel) */
const lastList = {};
function downloadCsv(name, headers, rows) {
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/** Generic searchable, filterable, paginated list. */
async function listView(cfg) {
  const st = pg(cfg.key), limit = cfg.limit || 25;
  const fetchPage = () => {
    const qs = new URLSearchParams({ limit, offset: st.offset });
    if (st.q) qs.set('q', st.q);
    for (const [k, v] of Object.entries(st.f)) if (v && v !== 'all') qs.set(k, v);
    return cfg.fetch ? cfg.fetch(qs) : apiList(`${cfg.path}?${qs}`);
  };
  let res = await fetchPage();
  if (!res.items.length && st.offset > 0) { st.offset = Math.max(0, st.offset - limit); res = await fetchPage(); }
  lastList[cfg.key] = { cfg, items: res.items };
  const filters = (cfg.filters || []).map((f) => `<select class="select-small" data-filter="${cfg.key}:${f.name}" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${o[0]}" ${(st.f[f.name] || f.options[0][0]) === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`).join('');
  const search = cfg.search ? `<input class="search-input" data-search="${cfg.key}" placeholder="${esc(cfg.search)}" value="${esc(st.q)}">` : '';
  const exportBtn = cfg.csv && res.items.length ? `<button class="btn ghost" data-act="export" data-key="${cfg.key}">تصدير CSV</button>` : '';
  shell(toolbar(`${cfg.title} <small class="muted">(${num(res.total)})</small>`, search + filters + exportBtn)
    + (cfg.above ? (typeof cfg.above === 'function' ? cfg.above(res) : cfg.above) : '')
    + (res.items.length ? table(cfg.headers, res.items.map(cfg.row).join('')) : empty(cfg.empty || 'لا توجد نتائج مطابقة.'))
    + pager(cfg.key, res.total, limit));
  if (state.refocus === cfg.key) {
    const el = $(`[data-search="${cfg.key}"]`);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    state.refocus = null;
  }
}

/* ---------- overview ---------- */
function chart(series, label) {
  const w = 640, h = 205, p = 26, vals = series.map((x) => Number(x.count)), max = Math.max(1, ...vals), realMax = Math.max(0, ...vals);
  const x = (i) => p + (i * (w - 2 * p)) / Math.max(1, vals.length - 1);
  const y = (v) => h - p - (v / max) * (h - 2 * p);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const path = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${x(vals.length - 1).toFixed(1)},${h - p} L ${x(0).toFixed(1)},${h - p} Z`;
  const grid = [0, 1, 2, 3].map((i) => { const yy = p + (i * (h - 2 * p)) / 3; return `<line class="gridline" x1="${p}" x2="${w - p}" y1="${yy}" y2="${yy}"/>`; }).join('');
  const dots = vals.length <= 14 ? pts.map((q, i) => `<circle class="dot" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.5"><title>${esc(series[i].date)}: ${vals[i]}</title></circle>`).join('') : '';
  const labels = `<text x="${p}" y="${h - 6}" text-anchor="start">${esc((series[0]?.date || '').slice(5))}</text><text x="${w - p}" y="${h - 6}" text-anchor="end">${esc((series[series.length - 1]?.date || '').slice(5))}</text><text x="${p}" y="${p - 8}" text-anchor="start">${num(max)}</text>`;
  const total = vals.reduce((a, b) => a + b, 0);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${grid}<path class="area" d="${area}"/><path class="line" d="${path}"/>${dots}${labels}</svg><div class="chart-sum">الإجمالي في الفترة: <b>${num(total)}</b> · الأعلى يومياً: <b>${num(realMax)}</b></div>`;
}

async function overview() {
  const [s, system] = await Promise.all([api(`/admin/stats?days=${state.days}`), api('/admin/system')]);
  $('#reportBadge').textContent = num(s.openReports);
  const cards = [
    ['إجمالي المستخدمين', s.totalUsers, '♙', 'users'], ['النشطون يومياً', s.activeUsers?.daily, '◉', null], ['النشطون أسبوعياً', s.activeUsers?.weekly, '◷', null], ['النشطون شهرياً', s.activeUsers?.monthly, '◫', null],
    ['الرسائل', s.totalMessages, '✉', null], ['المحادثات', s.totalConversations, '▣', 'conversations'], ['المكالمات اليوم', s.callsToday, '☎', null], ['ملفات الوسائط', s.media?.files, '▤', null],
    ['المنشورات', s.totalPosts, '▥', 'posts'], ['المجموعات', s.totalGroups, '♧', 'groups'], ['مستخدمون جدد اليوم', s.newUsersToday, '＋', null], ['بلاغات مفتوحة', s.openReports, '⚑', 'reports'],
  ];
  const ranges = [7, 14, 30, 90].map((d) => `<button class="seg ${state.days === d ? 'active' : ''}" data-act="range" data-id="${d}">${d} يوم</button>`).join('');
  const attention = [
    ['بلاغات تحتاج مراجعة', s.openReports, s.openReports > 0 ? 'reports' : null, s.openReports > 0 ? 'amber' : 'green'],
    ['حسابات محظورة', s.bannedUsers, s.bannedUsers > 0 ? 'users' : null, ''],
    ['مستخدمون متصلون الآن', s.onlineUsers, null, 'green'],
  ].map((x) => `<div class="quick-row"><span>${x[0]}</span><div class="row-end">${x[2] ? btn('go', x[2], 'فتح', 'ghost') : ''}${pill(num(x[1]), x[3])}</div></div>`).join('');
  shell(`<div class="grid stats-grid">${cards.map((c) => `<div class="stat-card ${c[3] ? 'clickable' : ''}" ${c[3] ? `data-act="go" data-id="${c[3]}" role="button" tabindex="0"` : ''}><div class="stat-head">${c[0]}<span class="stat-icon">${c[2]}</span></div><div class="stat-value">${num(c[1])}</div><div class="stat-foot">${c[3] ? 'اضغط للفتح' : 'إحصائية مباشرة من قاعدة البيانات'}</div></div>`).join('')}</div>
  <div class="toolbar"><h2>النشاط خلال الفترة</h2><div class="seg-group">${ranges}</div></div>
  <div class="grid overview-grid"><section class="panel"><div class="panel-head"><div><h2>نشاط الرسائل</h2><p>آخر ${s.days} يوم</p></div>${pill('مباشر', 'green')}</div>${chart(s.activity.messages, 'مخطط الرسائل')}</section>
  <section class="panel"><div class="panel-head"><h2>تحتاج انتباهك</h2></div><div class="quick-list">${attention}${[['رسائل اليوم', s.messagesToday], ['مكالمات اليوم', s.callsToday], ['حجم الوسائط', ((Number(s.media?.bytes || 0) / 1048576).toFixed(1)) + ' MB']].map((x) => `<div class="quick-row"><span>${x[0]}</span><b>${typeof x[1] === 'string' ? x[1] : num(x[1])}</b></div>`).join('')}</div></section></div>
  <div class="grid two-col"><section class="panel"><div class="panel-head"><div><h2>تسجيل المستخدمين</h2><p>الحسابات الجديدة يومياً</p></div></div>${chart(s.activity.users, 'مخطط التسجيل')}</section>
  <section class="panel"><div class="panel-head"><div><h2>المنشورات الجديدة</h2><p>المنشورات يومياً</p></div></div>${chart(s.activity.posts, 'مخطط المنشورات')}</section></div>
  <section class="panel"><div class="panel-head"><div><h2>حالة الخادم</h2><p>مؤشرات تشغيلية لا تتضمن أي أسرار أو بيانات اتصال</p></div>${pill(system.status === 'ok' ? 'يعمل بشكل طبيعي' : 'يحتاج مراجعة', system.status === 'ok' ? 'green' : 'red')}</div>
  <div class="grid stats-grid">${[['قاعدة البيانات', system.database], ['Redis', system.redis], ['مدة التشغيل', num(Math.floor(system.uptimeSeconds / 3600)) + ' ساعة'], ['استهلاك الذاكرة RSS', num(system.memory?.rss) + ' MB'], ['Node.js', system.nodeVersion]].map((x) => `<div class="detail-item"><small>${x[0]}</small><b>${esc(x[1])}</b></div>`).join('')}</div></section>`);
}

/* ---------- users ---------- */
const usersPage = () => listView({
  key: 'users', title: 'قائمة المستخدمين', search: 'ابحث بالاسم أو الهاتف أو البريد…', csv: true, empty: 'لا يوجد مستخدمون مطابقون.',
  filters: [{ name: 'filter', label: 'تصفية', options: [['all', 'كل المستخدمين'], ['online', 'المتصلون'], ['new', 'جدد (7 أيام)'], ['inactive', 'غير نشطين (30 يوماً)'], ['banned', 'المحظورون']] }],
  fetch: async (qs) => { const d = await api(`/admin/users?${qs}`); return { items: d.users, total: d.total }; },
  headers: ['المستخدم', 'بيانات الاتصال', 'آخر ظهور', 'الحالة', 'تاريخ التسجيل', 'الإجراءات'],
  csvRow: (u) => [u.id, u.name, u.username, u.phone, u.email, u.banned ? 'محظور' : 'نشط', u.created_at],
  csvHeaders: ['ID', 'الاسم', 'اسم المستخدم', 'الهاتف', 'البريد', 'الحالة', 'تاريخ التسجيل'],
  row: (u) => `<tr><td>${userCell(u)}</td><td><span class="text-ltr">${esc(u.phone || u.email || '—')}</span></td><td>${u.status === 'online' ? pill('متصل', 'green') : `<span class="muted">${ago(u.last_seen)}</span>`}</td><td>${u.banned ? pill('محظور', 'red') : pill('نشط', 'green')}${u.is_admin ? ' ' + pill('إدارة', 'amber') : ''}</td><td>${wl(u.created_at)}</td><td><div class="actions">${btn('user-view', u.id, 'التفاصيل')}${u.is_admin ? '' : W(btn('user-warn', u.id, 'تحذير') + btn('user-ban', u.id, u.banned ? 'إلغاء الحظر' : 'حظر', u.banned ? 'success' : 'danger', `data-banned="${u.banned}"`) + btn('user-delete', u.id, 'حذف', 'danger'))}</div></td></tr>`,
});

/* ---------- content lists ---------- */
const postsPage = () => listView({
  key: 'posts', title: 'المنشورات', path: '/admin/posts', search: 'بحث في المنشورات…', csv: true, limit: 30,
  headers: ['المنشور', 'الناشر', 'التفاعل', 'التاريخ', 'الإجراءات'],
  csvHeaders: ['ID', 'المنشور', 'الناشر', 'الإعجابات', 'التعليقات', 'التاريخ'],
  csvRow: (p) => [p.id, p.content, p.user_name, p.likes_count, p.comments_count, p.created_at],
  row: (p) => `<tr><td class="cell-wrap">${esc((p.content || '').slice(0, 220)) || '<span class="muted">بدون نص</span>'}${p.image || Number(p.image_count) ? '<br>' + pill(`${num(p.image_count || 1)} صورة`) : ''}</td><td>${esc(p.user_name)} <small class="muted">@${esc(p.username || '')}</small></td><td>${num(p.likes_count)} إعجاب · ${num(p.comments_count)} تعليق</td><td>${wl(p.created_at)}</td><td>${btn('post-delete', p.id, 'حذف', 'danger')}</td></tr>`,
});
const storiesPage = () => listView({
  key: 'stories', title: 'الحالات والقصص', path: '/admin/stories', search: 'بحث بالناشر أو المحتوى…', csv: true,
  headers: ['الناشر', 'النوع', 'المحتوى', 'الجمهور', 'المشاهدات', 'النشر والانتهاء', 'الإجراء'],
  csvHeaders: ['ID', 'الناشر', 'النوع', 'المحتوى', 'الجمهور', 'المشاهدات', 'النشر', 'الانتهاء'],
  csvRow: (s) => [s.id, s.user_name, s.media_type, s.text_content || s.caption || '', s.audience, s.views_count, s.created_at, s.expires_at],
  row: (s) => `<tr><td>${esc(s.user_name)} <small class="muted">@${esc(s.username || '')}</small></td><td>${pill(s.media_type)}</td><td class="cell-wrap">${esc(String(s.text_content || s.caption || s.media_url || '—').slice(0, 180))}</td><td>${esc(s.audience)}</td><td>${num(s.views_count)}</td><td>${wl(s.created_at)}<small class="muted block">${wl(s.expires_at)}</small></td><td>${btn('story-delete', s.id, 'حذف الحالة', 'danger')}</td></tr>`,
});
const groupsPage = () => listView({
  key: 'groups', title: 'المجموعات', path: '/admin/groups', search: 'ابحث باسم المجموعة أو المالك…', csv: true,
  headers: ['المجموعة', 'النوع', 'المالك', 'الأعضاء', 'تاريخ الإنشاء', 'الإجراء'],
  csvHeaders: ['ID', 'المجموعة', 'النوع', 'المالك', 'الأعضاء', 'تاريخ الإنشاء'],
  csvRow: (g) => [g.id, g.name, g.type, g.owner_name, g.member_count, g.created_at],
  row: (g) => `<tr><td><b>${esc(g.name)}</b><small class="muted"> #${g.id}</small></td><td>${esc(g.type)}</td><td>${esc(g.owner_name || '—')}</td><td>${num(g.member_count)}</td><td>${wl(g.created_at)}</td><td>${btn('group-delete', g.id, 'حذف المجموعة', 'danger')}</td></tr>`,
});
const conversationsPage = () => listView({
  key: 'conversations', title: 'المحادثات', path: '/admin/conversations', search: 'ابحث باسم المحادثة…', csv: true,
  filters: [{ name: 'type', label: 'النوع', options: [['all', 'كل الأنواع'], ['direct', 'مباشرة'], ['group', 'مجموعات']] }],
  headers: ['المحادثة', 'النوع', 'المشاركون', 'الرسائل', 'آخر رسالة', 'الإجراء'],
  csvHeaders: ['ID', 'الاسم', 'النوع', 'المشاركون', 'الرسائل', 'آخر رسالة'],
  csvRow: (c) => [c.id, c.name || '', c.type, c.participant_count, c.message_count, c.last_message_at || ''],
  row: (c) => `<tr><td><b>${esc(c.name) || 'محادثة #' + c.id}</b><small class="muted"> #${c.id}</small></td><td>${esc(c.type)}</td><td>${num(c.participant_count)}</td><td>${num(c.message_count)}</td><td>${wl(c.last_message_at)}</td><td>${W(btn('conv-delete', c.id, 'حذف', 'danger'))}</td></tr>`,
});
const sessionsPage = () => listView({
  key: 'sessions', title: 'الجلسات النشطة والأجهزة', path: '/admin/sessions', search: 'ابحث بالمستخدم أو الجهاز…', csv: true,
  headers: ['المستخدم', 'الجهاز', 'النظام', 'آخر نشاط', 'انتهاء الجلسة', 'الإجراء'],
  csvHeaders: ['المستخدم', 'الهاتف', 'الجهاز', 'النظام', 'آخر نشاط', 'انتهاء الجلسة'],
  csvRow: (s) => [s.user_name, s.phone || '', s.device_name, s.platform, s.last_active_at, s.expires_at],
  row: (s) => `<tr><td>${userCell({ name: s.user_name, username: s.username })}${s.is_current ? '<br>' + pill('جلستك الحالية', 'green') : ''}</td><td>${esc(s.device_name)}</td><td>${esc(s.platform)}</td><td>${ago(s.last_active_at)}</td><td>${wl(s.expires_at)}</td><td>${W(btn('session-revoke', s.id, 'إنهاء الجلسة', 'danger', s.is_current ? 'disabled' : ''))}</td></tr>`,
});
/* Translates an audit row (method + path + JSON details) into a readable Arabic action. */
const AUDIT_ACTIONS = [
  [/^\/api\/admin\/users\/(\d+)\/warn$/, (m) => `أرسل تنبيهاً إلى المستخدم #${m[1]}`],
  [/^\/api\/admin\/users\/(\d+)\/ban$/, (m, d) => (d.banned === false ? `ألغى حظر المستخدم #${m[1]}` : `حظر المستخدم #${m[1]}`)],
  [/^\/api\/admin\/users\/(\d+)\/sessions\/revoke$/, (m) => `أنهى كل جلسات المستخدم #${m[1]}`],
  [/^\/api\/admin\/users\/(\d+)$/, (m) => `حذف المستخدم #${m[1]} نهائياً`],
  [/^\/api\/admin\/posts\/(\d+)$/, (m) => `حذف المنشور #${m[1]}`],
  [/^\/api\/admin\/stories\/(\d+)$/, (m) => `حذف الحالة #${m[1]}`],
  [/^\/api\/admin\/groups\/(\d+)$/, (m) => `حذف المجموعة #${m[1]}`],
  [/^\/api\/admin\/conversations\/(\d+)$/, (m) => `حذف المحادثة #${m[1]}`],
  [/^\/api\/admin\/sessions\/[0-9a-f-]+$/i, () => 'أنهى جلسة جهاز'],
  [/^\/api\/admin\/broadcast$/, (m, d) => `أرسل إعلاناً${d.title ? ` «${d.title}»` : ''}`],
  [/^\/api\/admin\/push\/test$/, () => 'أرسل إشعاراً تجريبياً إلى جهازه'],
  [/^\/api\/admin\/banned-words$/, (m, d) => `أضاف الكلمة المحظورة «${d.word || ''}»`],
  [/^\/api\/admin\/banned-words\/(.+)$/, (m) => `حذف الكلمة المحظورة «${decodeURIComponent(m[1])}»`],
  [/^\/api\/admin\/admins$/, (m, d) => `منح المستخدم #${d.userId || '?'} صلاحية ${ROLE_LABEL[d.role] || d.role || ''}`],
  [/^\/api\/admin\/admins\/(\d+)$/, (m) => `أزال صلاحية الإدارة عن المستخدم #${m[1]}`],
  [/^\/api\/admin\/reports\/(\d+)\/resolve$/, (m, d) => `${d.status === 'dismissed' ? 'رفض' : 'حل'} البلاغ #${m[1]}${d.delete_content ? ' وحذف المحتوى' : ''}${d.banned_user ? ' وحظر صاحبه' : ''}`],
  [/^\/api\/admin\/appeals\/(\d+)\/decide$/, (m, d) => `${d.accept ? 'قبل' : 'رفض'} الاعتراض #${m[1]}`],
  [/^\/api\/admin\/verifications\/(\d+)\/decide$/, (m, d) => `${d.approve ? 'وثّق الحساب (طلب' : 'رفض طلب التوثيق'} #${m[1]}${d.approve ? ')' : ''}`],
  [/^\/api\/admin\/verifications\/user\/(\d+)$/, (m, d) => `${d.verified ? 'منح علامة التوثيق للمستخدم' : 'سحب علامة التوثيق من المستخدم'} #${m[1]}`],
  [/^\/api\/admin\/campaigns$/, (m, d) => `أنشأ الحملة «${d.name || ''}»`],
  [/^\/api\/admin\/campaigns\/(\d+)\/status$/, (m, d) => `غيّر حالة الحملة #${m[1]} إلى «${({ draft: 'مسودة', active: 'نشطة', paused: 'متوقفة', ended: 'منتهية' })[d.status] || d.status || ''}»`],
  [/^\/api\/admin\/campaigns\/(\d+)$/, (m) => `حذف الحملة #${m[1]}`],
  [/^\/api\/admin\/backups$/, () => 'أنشأ نسخة احتياطية مشفرة'],
  [/^\/api\/admin\/backups\/run$/, () => 'شغّل دورة نسخ كاملة'],
  [/^\/api\/admin\/backups\/(.+)\/verify$/, (m) => `فحص سلامة النسخة ${m[1]}`],
  [/^\/api\/admin\/backups\/(.+)\/upload$/, (m) => `رفع النسخة ${m[1]} إلى التخزين الخارجي`],
  [/^\/api\/admin\/backups\/(.+)\/restore$/, (m) => `⚠️ استعاد قاعدة البيانات من النسخة ${m[1]}`],
  [/^\/api\/admin\/backups\/(.+)$/, (m) => `حذف النسخة الاحتياطية ${m[1]}`],
];
function auditText(a) {
  let details = {};
  try { details = a.details ? JSON.parse(a.details) : {}; } catch { details = {}; }
  for (const [re, fn] of AUDIT_ACTIONS) {
    const m = re.exec(a.path || '');
    if (m) { try { return fn(m, details); } catch { break; } }
  }
  return `${a.method} ${a.path || ''}`;
}
const auditPage = () => listView({
  key: 'audit', title: 'سجل العمليات الإدارية', path: '/admin/audit', search: 'ابحث بالمسؤول أو المسار أو التفاصيل…', csv: true, limit: 50,
  filters: [{ name: 'method', label: 'نوع العملية', options: [['all', 'كل العمليات'], ['POST', 'إضافة/تنفيذ (POST)'], ['PUT', 'تعديل (PUT)'], ['DELETE', 'حذف (DELETE)']] }],
  headers: ['المسؤول', 'الإجراء', 'التفاصيل', 'التاريخ'],
  csvHeaders: ['المسؤول', 'الإجراء', 'العملية', 'المسار', 'التفاصيل', 'التاريخ'],
  csvRow: (a) => [a.admin_name, auditText(a), a.method, a.path, a.details || '', a.created_at],
  row: (a) => `<tr><td>${esc(a.admin_name)}</td><td class="cell-wrap"><b>${esc(auditText(a))}</b><br>${pill(a.method, a.method === 'DELETE' ? 'red' : '')} <small class="muted text-ltr">${esc(a.path)}</small></td><td class="cell-wide">${esc(a.details || '—')}</td><td>${wl(a.created_at)}</td></tr>`,
});

/* ---------- reports ---------- */
const TARGET_LABEL = { user: 'حساب مستخدم', post: 'منشور', comment: 'تعليق', message: 'رسالة', story: 'حالة' };
const REASON_LABEL = { spam: 'محتوى مزعج', harassment: 'إساءة أو تحرش', hate: 'خطاب كراهية', violence: 'عنف', nudity: 'محتوى غير لائق', scam: 'احتيال', other: 'أخرى' };
async function reportsPage() {
  const st = pg('reports'), limit = 20;
  const status = st.f.status || 'open';
  const qs = new URLSearchParams({ status, limit, offset: st.offset });
  if (st.f.type && st.f.type !== 'all') qs.set('type', st.f.type);
  const { items, total } = await apiList(`/admin/reports?${qs}`);
  if (status === 'open') $('#reportBadge').textContent = num(total);
  const opt = (cur, list) => list.map((o) => `<option value="${o[0]}" ${cur === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('');
  const cards = items.map((r) => {
    const p = r.preview;
    const content = r.target_missing
      ? '<div class="report-target gone">المحتوى المبلغ عنه لم يعد موجوداً (حُذف سابقاً).</div>'
      : r.target_type === 'message'
        ? `<div class="report-target">رسالة من <b>${esc(p?.author || '—')}</b> (${esc(p?.kind || 'text')}) — نص الرسائل الخاصة لا يظهر للإدارة.</div>`
        : r.target_type === 'user'
          ? `<div class="report-target">الحساب: <b>${esc(p?.author || '—')}</b>${p?.banned ? ' ' + pill('محظور بالفعل', 'red') : ''}</div>`
          : `<div class="report-target">من <b>${esc(p?.author || '—')}</b><p>${esc(p?.text || 'بدون نص (وسائط)')}</p></div>`;
    const authorId = r.target_type === 'user' ? r.target_id : p?.authorId;
    const open = r.status === 'open';
    return `<article class="report-card"><div class="report-top"><div><h3>بلاغ #${r.id} — ${TARGET_LABEL[r.target_type] || esc(r.target_type)} #${r.target_id}</h3><div class="report-meta">بواسطة ${esc(r.reporter_name)} (@${esc(r.reporter_username || '')}) · ${wl(r.created_at)}</div></div><div class="actions">${r.reports_on_target > 1 ? pill(`${r.reports_on_target} بلاغات على نفس الهدف`, 'red') : ''}${pill(open ? 'مفتوح' : r.status === 'resolved' ? 'تم الحل' : 'مرفوض', open ? 'amber' : 'green')}</div></div>
      <p><b>السبب:</b> ${esc(REASON_LABEL[r.reason] || r.reason)}</p>${r.details ? `<p>${esc(r.details)}</p>` : ''}${content}
      ${open && state.me.pages.includes('reports') ? `<div class="actions">${btn('report-resolve', r.id, 'حل البلاغ', 'success')}${!r.target_missing && r.target_type !== 'user' && r.target_type !== 'message' ? btn('report-delete', r.id, 'حذف المحتوى وحل البلاغ', 'danger') : ''}${!r.target_missing && r.target_type === 'message' ? btn('report-delete', r.id, 'حذف الرسالة وحل البلاغ', 'danger') : ''}${authorId && !p?.banned && state.me.canWrite ? btn('report-ban', r.id, 'حظر صاحب المحتوى وحل البلاغ', 'danger', `data-user="${authorId}"`) : ''}${btn('report-dismiss', r.id, 'رفض البلاغ')}${authorId ? btn('user-view', authorId, 'ملف صاحب المحتوى', 'ghost') : ''}</div>` : ''}</article>`;
  }).join('');
  shell(toolbar(`مراجعة بلاغات المستخدمين <small class="muted">(${num(total)})</small>`,
    `<select class="select-small" data-filter="reports:status" aria-label="الحالة">${opt(status, [['open', 'مفتوحة'], ['resolved', 'تم حلها'], ['dismissed', 'مرفوضة']])}</select><select class="select-small" data-filter="reports:type" aria-label="النوع">${opt(st.f.type || 'all', [['all', 'كل الأنواع'], ['user', 'حسابات'], ['post', 'منشورات'], ['comment', 'تعليقات'], ['message', 'رسائل'], ['story', 'حالات']])}</select>`)
    + (cards || empty('لا توجد بلاغات في هذا التصنيف.')) + pager('reports', total, limit));
}

/* ---------- announcements ---------- */
async function broadcastPage() {
  const [stats, history] = await Promise.all([
    api('/admin/push/stats').catch(() => ({ total: 0, withToken: 0, adminHasToken: false })),
    api('/admin/broadcasts').catch(() => []),
  ]);
  const pct = stats.total ? Math.round((stats.withToken / stats.total) * 100) : 0;
  const rows = history.map((h) => `<tr><td><b>${esc(h.title)}</b><small class="muted block">${esc((h.body || '').slice(0, 90))}</small></td><td>${num(h.recipients)}<small class="muted block">${num(h.push_capable)} يستقبلون Push</small></td><td>${num(h.read_count)} <small class="muted">(${h.recipients ? Math.round((h.read_count / h.recipients) * 100) : 0}%)</small></td><td>${wl(h.created_at)}</td><td>${btn('rebroadcast', h.broadcast_id, 'إعادة استخدام', 'ghost', `data-title="${esc(h.title)}" data-body="${esc(h.body)}"`)}</td></tr>`).join('');
  shell(`<div class="grid stats-grid"><div class="stat-card"><div class="stat-head">الحسابات الفعّالة<span class="stat-icon">♙</span></div><div class="stat-value">${num(stats.total)}</div><div class="stat-foot">ستصلها الإشعارات داخل التطبيق</div></div><div class="stat-card"><div class="stat-head">أجهزة تستقبل الإشعارات<span class="stat-icon">◉</span></div><div class="stat-value">${num(stats.withToken)}</div><div class="stat-foot">${pct}% من الحسابات لديها جهاز مسجّل</div></div></div>
  <div class="grid overview-grid"><section class="panel"><div class="panel-head"><div><h2>إرسال إشعار</h2><p>يصل داخل التطبيق فوراً، وكإشعار دفع للأجهزة المسجّلة.</p></div></div>
  <form id="broadcastForm"><div class="field"><label>الجمهور <small class="muted" id="audienceCount"></small></label><select name="audience"><option value="all">كل المستخدمين</option><option value="active7">النشطون خلال 7 أيام</option><option value="active30">النشطون خلال 30 يوماً</option><option value="users">مستخدمون محددون (بالمعرّف)</option></select></div>
  <div class="field hidden" id="idsField"><label>معرّفات المستخدمين (مفصولة بفاصلة)</label><input name="ids" placeholder="12, 40, 77" inputmode="numeric"></div>
  <div class="field"><label>عنوان الإعلان <small id="titleCount" class="muted">0/120</small></label><input name="title" maxlength="120" required placeholder="مثال: تحديث جديد في Special"></div>
  <div class="field"><label>نص الإعلان <small id="bodyCount" class="muted">0/1500</small></label><textarea name="body" maxlength="1500" required rows="5" placeholder="اكتب تفاصيل الإعلان…"></textarea></div>
  <div class="toolbar-actions"><button class="btn primary" type="submit">إرسال الإعلان</button><button class="btn ghost" id="testPush" type="button">إرسال اختبار لجهازي</button></div>${stats.adminHasToken ? '' : '<p class="notice">حسابك غير مسجّل على جهاز بعد؛ افتح التطبيق على هاتفك وسجّل الدخول لتجربة الإشعارات.</p>'}</form></section>
  <section class="panel"><div class="panel-head"><div><h2>المعاينة</h2><p>هكذا سيظهر الإشعار على الهاتف.</p></div></div><div class="push-preview"><div class="push-app"><span class="brand-mark small">S</span> Special <small>الآن</small></div><b id="pvTitle">عنوان الإعلان</b><p id="pvBody">نص الإعلان سيظهر هنا…</p></div></section></div>
  <section class="panel"><div class="panel-head"><h2>آخر الإعلانات</h2></div>${rows ? table(['الإعلان', 'المستلمون', 'قرأوه', 'التاريخ', ''], rows) : '<p class="muted">لم يتم إرسال أي إعلان بعد.</p>'}</section>`);
  const form = $('#broadcastForm');
  const fillFrom = (t, b) => { form.title.value = t; form.body.value = b; sync(); form.title.focus(); };
  const sync = () => { const t = form.title.value, b = form.body.value; $('#titleCount').textContent = t.length + '/120'; $('#bodyCount').textContent = b.length + '/1500'; $('#pvTitle').textContent = t.trim() || 'عنوان الإعلان'; $('#pvBody').textContent = b.trim() || 'نص الإعلان سيظهر هنا…'; };
  const parseIds = () => form.ids.value.split(/[\s,،]+/).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0);
  const refreshAudience = async () => {
    const a = form.audience.value;
    $('#idsField').classList.toggle('hidden', a !== 'users');
    if (a === 'users') { $('#audienceCount').textContent = `(${num(parseIds().length)} معرّف)`; return; }
    try { const d = await api(`/admin/broadcast/audience?audience=${a}`); $('#audienceCount').textContent = `(${num(d.count)} مستخدم)`; } catch { $('#audienceCount').textContent = ''; }
  };
  form.addEventListener('input', () => { sync(); if (form.audience.value === 'users') refreshAudience(); });
  form.audience.addEventListener('change', refreshAudience);
  refreshAudience();
  state.fillBroadcast = fillFrom;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const audience = form.audience.value;
    const userIds = audience === 'users' ? parseIds() : undefined;
    if (audience === 'users' && !userIds.length) { toast('أدخل معرّف مستخدم واحداً على الأقل', true); return; }
    const label = $('#audienceCount').textContent.replace(/[()]/g, '') || 'المستخدمين المحددين';
    if (!(await ask({ title: 'تأكيد إرسال الإعلان', message: `سيصل الإعلان «${form.title.value.trim()}» إلى ${label}. لا يمكن التراجع بعد الإرسال.`, confirm: 'إرسال الآن' }))) return;
    const submit = e.submitter; submit.disabled = true;
    try {
      const d = await post('/admin/broadcast', { title: form.title.value.trim(), body: form.body.value.trim(), audience, userIds, requestId: (form.dataset.rid ||= (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random())) });
      toast(`تم الإرسال إلى ${num(d.count)} مستخدم`); broadcastPage();
    } catch (err) { toast(err.message, true); submit.disabled = false; }
  };
  $('#testPush').onclick = async () => { try { await post('/admin/push/test'); toast('تم إرسال إشعار تجريبي إلى جهازك'); } catch (err) { toast(err.message, true); } };
}

/* ---------- tools ---------- */
async function wordsPage() {
  const d = await api('/admin/banned-words');
  shell(`<section class="panel"><div class="panel-head"><div><h2>قائمة الكلمات المحظورة</h2><p>تُستخدم لتصفية الكلمات في المنشورات والتعليقات. (${num(d.length)} كلمة)</p></div></div>${M('<form id="wordForm" class="toolbar"><input id="newWord" class="search-input" maxlength="60" placeholder="أضف كلمة جديدة…" required><button class="btn primary">إضافة كلمة</button></form>')}${d.length ? '' : empty('لا توجد كلمات محظورة.')}<div class="word-list">${d.map((w) => `<span class="word-chip">${esc(w)}${M(`<button title="حذف" data-act="word-delete" data-id="${esc(encodeURIComponent(w))}">×</button>`)}</span>`).join('')}</div></section>`);
  const f = $('#wordForm');
  if (f) f.onsubmit = async (e) => { e.preventDefault(); try { await post('/admin/banned-words', { word: $('#newWord').value.trim() }); toast('تمت إضافة الكلمة'); wordsPage(); } catch (err) { toast(err.message, true); } };
}

const AUD = { all: 'كل المستخدمين', new: 'مستخدمون جدد', active: 'مستخدمون نشطون' };
const CSTATUS = { draft: 'مسودة', active: 'نشطة', paused: 'متوقفة', ended: 'منتهية' };
async function campaignsPage() {
  const rows = await api('/admin/campaigns');
  const sel = (cur) => Object.entries(CSTATUS).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`).join('');
  const form = `<section class="panel"><div class="panel-head"><div><h2>إنشاء حملة</h2><p>إعداد الحملة والوجهة والجمهور والميزانية</p></div></div><form id="campaignForm" class="grid stats-grid"><div class="field"><label>اسم الحملة</label><input name="name" required maxlength="120"></div><div class="field"><label>العنوان</label><input name="headline" required maxlength="180"></div><div class="field"><label>رابط الوجهة</label><input name="target_url" type="url" required placeholder="https://example.com"></div><div class="field"><label>رابط صورة/وسيط</label><input name="media_url" type="url"></div><div class="field"><label>الجمهور</label><select name="audience">${Object.entries(AUD).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label>الحالة</label><select name="status"><option value="draft">مسودة</option><option value="active">نشطة</option><option value="paused">متوقفة</option></select></div><div class="field"><label>الميزانية</label><input name="budget" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>تبدأ في</label><input name="starts_at" type="datetime-local"></div><div class="field"><label>تنتهي في</label><input name="ends_at" type="datetime-local"></div><div class="field"><label>الوصف</label><textarea name="body" maxlength="5000"></textarea></div><button class="btn primary">حفظ الحملة</button></form></section>`;
  const body = rows.map((x) => { const ctr = Number(x.impressions) ? ((Number(x.clicks) / Number(x.impressions)) * 100).toFixed(1) + '%' : '—'; return `<tr><td><b>${esc(x.name)}</b></td><td class="cell-wrap">${esc(x.headline)}</td><td>${pill(CSTATUS[x.status] || x.status, x.status === 'active' ? 'green' : x.status === 'paused' ? 'amber' : '')}</td><td>${esc(AUD[x.audience] || x.audience)}</td><td>${num(x.impressions)}</td><td>${num(x.clicks)} <small class="muted">(${ctr})</small></td><td>${num(x.budget)}</td><td><div class="actions"><select class="select-small" data-campaign-status="${x.id}">${sel(x.status)}</select>${btn('campaign-delete', x.id, 'حذف', 'danger')}</div></td></tr>`; }).join('');
  shell(toolbar('إدارة الحملات الإعلانية', pill(`${rows.length} حملة`, 'green')) + form + `<section class="panel"><div class="panel-head"><h2>الحملات الحالية</h2></div>${rows.length ? table(['الحملة', 'العنوان', 'الحالة', 'الجمهور', 'المشاهدات', 'النقرات', 'الميزانية', 'الإدارة'], body) : empty('لا توجد حملات بعد.')}</section>`);
  $('#campaignForm').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    for (const k of ['starts_at', 'ends_at']) d[k] = d[k] ? new Date(d[k]).toISOString().slice(0, 19).replace('T', ' ') : null;
    d.budget = Number(d.budget || 0);
    try { await post('/admin/campaigns', d); toast('تم إنشاء الحملة'); campaignsPage(); } catch (err) { toast(err.message, true); }
  };
}

const bytes = (n) => { n = Number(n || 0); return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? (n / 1024).toFixed(0) + ' KB' : n + ' B'; };
async function backupsPage() {
  let d;
  try { d = await api('/admin/backups'); } catch (err) {
    if (/BACKUP_ENCRYPTION_KEY/.test(err.message || '')) {
      shell(toolbar('النسخ الاحتياطية المشفرة') + '<div class="notice-box">النسخ الاحتياطي غير مفعّل: مفتاح التشفير BACKUP_ENCRYPTION_KEY غير مضبوط أو غير صالح. ضع في ملف server/.env قيمة من 64 حرفاً سداسية عشرية (مثال لتوليدها: openssl rand -hex 32) ثم أعد تشغيل الخادم.</div>');
      return;
    }
    throw err;
  }
  const body = d.files.map((x) => `<tr><td class="text-ltr">${esc(x.name)}</td><td>${bytes(x.size)}</td><td>${wl(x.created_at)}</td><td><div class="actions">${btn('backup-verify', x.name, 'فحص السلامة', 'success')}${d.offhost ? btn('backup-upload', x.name, 'رفع خارجي', 'ghost') : ''}${btn('backup-restore', x.name, 'استعادة', 'danger')}${btn('backup-delete', x.name, 'حذف', 'ghost')}</div></td></tr>`).join('');
  const runs = d.runs.map((r) => `<tr><td>${wl(r.created_at)}</td><td>${{ create: 'إنشاء', upload: 'رفع خارجي', verify: 'فحص سلامة' }[r.kind] || esc(r.kind)}</td><td class="text-ltr">${esc(r.file || '—')}</td><td>${pill(r.ok ? 'نجح' : 'فشل', r.ok ? 'green' : 'red')}</td><td class="cell-wrap">${esc(r.detail || '')}</td></tr>`).join('');
  shell(toolbar('النسخ الاحتياطية المشفرة', `${pill(d.offhost ? 'نسخ خارجي مفعّل' : 'محلي فقط', d.offhost ? 'green' : 'amber')} ${pill(d.autoHours ? `تلقائي كل ${d.autoHours} ساعة` : 'بدون جدولة', d.autoHours ? 'green' : 'amber')} <button class="btn" data-act="backup-run">تشغيل دورة كاملة الآن</button> <button class="btn primary" data-act="backup-create">إنشاء نسخة</button>`)
    + '<div class="notice-box">الدورة الكاملة: إنشاء ← فحص سلامة (فك التشفير والتحقق من اكتمال الملف) ← رفع إلى التخزين الخارجي المتوافق مع S3 والتحقق من الحجم. فحص السلامة لا يلمس قاعدة البيانات الحية؛ جرّب الاستعادة الفعلية دورياً على خادم اختبار. الإعداد: BACKUP_DIR وBACKUP_ENCRYPTION_KEY وBACKUP_S3_* وBACKUP_AUTO_HOURS.</div>'
    + (d.files.length ? table(['الملف', 'الحجم', 'تاريخ الإنشاء', 'الإجراء'], body) : empty('لا توجد نسخ احتياطية بعد.'))
    + `<section class="panel"><div class="panel-head"><h2>سجل العمليات</h2></div>${runs ? table(['الوقت', 'العملية', 'الملف', 'النتيجة', 'التفاصيل'], runs) : empty('لا عمليات مسجلة.')}</section>`);
}

/* ---------- report decision log, appeals, alerts ---------- */
const ACTION_LABEL = { none: 'بدون إجراء', deleted_content: 'حذف المحتوى', banned_user: 'حظر المستخدم' };
async function rlogPage() {
  const st = pg('rlog'), limit = 30;
  const { items, total } = await apiList(`/admin/reports-log?${new URLSearchParams({ limit, offset: st.offset })}`);
  const rows = items.map((d) => `<tr><td>${wl(d.created_at)}</td><td>#${d.report_id} · ${esc(TARGET_LABEL[d.target_type] || d.target_type || '')}</td><td>${pill(d.decision === 'resolved' ? 'تم الحل' : 'مرفوض', d.decision === 'resolved' ? 'green' : '')}</td><td>${esc(ACTION_LABEL[d.action] || d.action)}</td><td>${esc(d.admin_name || '—')}</td><td class="cell-wrap">${esc(d.note || '—')}</td></tr>`).join('');
  shell(toolbar('سجل قرارات البلاغات') + (rows ? table(['الوقت', 'البلاغ', 'القرار', 'الإجراء', 'المشرف', 'الملاحظة'], rows) : empty('لا توجد قرارات مسجلة بعد.')) + pager('rlog', total, limit));
}
async function appealsPage() {
  const st = pg('appeals'), limit = 20;
  const status = st.f.status || 'pending';
  const { items, total } = await apiList(`/admin/appeals?${new URLSearchParams({ status, limit, offset: st.offset })}`);
  const rows = items.map((a) => `<tr><td>${userCell(a)}${a.banned ? ' ' + pill('محظور', 'red') : ''}</td><td>${a.kind === 'account' ? 'حظر الحساب' : 'قرار على محتوى'}</td><td class="cell-wrap">${esc(a.message)}</td><td>${wl(a.created_at)}</td><td>${a.status === 'pending' ? btn('appeal-accept', a.id, 'قبول', 'success') + ' ' + btn('appeal-deny', a.id, 'رفض', 'danger') : pill(a.status === 'accepted' ? 'مقبول' : 'مرفوض', a.status === 'accepted' ? 'green' : 'red') + (a.review_note ? `<br><small class="muted">${esc(a.review_note)}</small>` : '')}</td></tr>`).join('');
  shell(toolbar('اعتراضات المستخدمين', `<select class="select-small" data-filter="appeals:status" aria-label="الحالة"><option value="pending" ${status === 'pending' ? 'selected' : ''}>قيد المراجعة</option><option value="accepted" ${status === 'accepted' ? 'selected' : ''}>مقبولة</option><option value="denied" ${status === 'denied' ? 'selected' : ''}>مرفوضة</option></select>`)
    + '<div class="notice-box">قبول اعتراض على حظر حساب يلغي الحظر تلقائياً. اعتراضات الحسابات المحظورة تصل من شاشة الدخول ولا يمكن التحقق من هوية صاحبها إلا عبر تواصل لاحق، فراجعها بحذر.</div>'
    + (rows ? table(['المستخدم', 'النوع', 'الرسالة', 'التاريخ', 'القرار'], rows) : empty('لا توجد اعتراضات.')) + pager('appeals', total, limit));
}
async function alertsPage() {
  const d = await api('/admin/alerts');
  const m = d.metrics, t = d.thresholds;
  const rows = d.items.map((a) => `<tr><td>${wl(a.created_at)}</td><td>${pill({ error_rate: 'معدل الأخطاء', latency: 'زمن الاستجابة', backup: 'النسخ الاحتياطي' }[a.kind] || a.kind, 'amber')}</td><td class="cell-wrap">${esc(a.message)}</td></tr>`).join('');
  shell(toolbar('التنبيهات التلقائية', pill(d.webhook ? 'Webhook مفعّل' : 'Webhook غير مُعدّ', d.webhook ? 'green' : 'amber'))
    + `<div class="stat-grid"><div class="stat-card"><span>طلبات (آخر ${Math.round(m.windowSeconds / 60)} د)</span><b>${num(m.requests)}</b></div><div class="stat-card"><span>نسبة الأخطاء</span><b>${(m.errorRate * 100).toFixed(1)}%</b></div><div class="stat-card"><span>p50 / p95</span><b>${num(m.p50)} / ${num(m.p95)} ms</b></div><div class="stat-card"><span>حدود التنبيه</span><b>${(t.errorRate * 100).toFixed(0)}% · ${num(t.p95Ms)}ms</b></div></div>`
    + '<div class="notice-box">تُرسل التنبيهات لمالكي الإدارة داخل التطبيق وكإشعار دفع، وإلى ALERT_WEBHOOK_URL إن وُجد، بحد أقصى تنبيه كل 30 دقيقة لكل نوع. المقاييس داخل ذاكرة العملية وتُصفَّر عند إعادة التشغيل.</div>'
    + (rows ? table(['الوقت', 'النوع', 'الرسالة'], rows) : empty('لا توجد تنبيهات. كل شيء يعمل بشكل طبيعي.')));
}

async function errorsPage() {
  const rows = await api('/admin/errors?limit=100');
  shell(toolbar('سجل أخطاء الخادم', pill(`${rows.length} خطأ في الذاكرة`, rows.length ? 'amber' : 'green')) + '<div class="notice-box">يعرض آخر 100 خطأ منذ آخر تشغيل للخادم. السجل مؤقت داخل الذاكرة ولا يحل محل Sentry أو نظام تجميع سجلات دائم.</div>' + (rows.length ? table(['الوقت', 'المصدر', 'الرسالة', 'تفاصيل مختصرة'], rows.map((x) => `<tr><td>${wl(x.at)}</td><td>${esc(x.source)}</td><td class="cell-wrap">${esc(x.message)}</td><td class="cell-wide">${esc(x.stack || '—')}</td></tr>`).join('')) : empty('لا توجد أخطاء مسجلة. 🎉')));
}

async function adminsPage() {
  const d = await api('/admin/admins');
  const rows = (d.admins || []).map((a) => `<tr><td>${esc(a.name)} <small class="muted">@${esc(a.username || '')}</small></td><td><span class="text-ltr">${esc(a.phone || '—')}</span></td><td>${pill(ROLE_LABEL[a.role] || a.role, a.role === 'admin' ? 'green' : a.role === 'moderator' ? 'amber' : '')}</td><td>${wl(a.created_at)}</td><td>${btn('admin-remove', a.user_id, 'إزالة الصلاحية', 'danger')}</td></tr>`).join('');
  shell(toolbar('إدارة صلاحيات المشرفين') + `<section class="panel panel-narrow"><div class="panel-head"><div><h2>إضافة مشرف</h2><p>ابحث عن المستخدم بالاسم أو الهاتف واختره من النتائج، ثم اختر أقل صلاحية لازمة.</p></div></div><form id="adminRoleForm"><div class="field"><label>المستخدم</label><input id="adminUserSearch" class="search-input" placeholder="اكتب الاسم أو رقم الهاتف…" autocomplete="off"><input type="hidden" name="userId" id="adminUserId"><div id="adminUserResults" class="user-pick-list"></div><div id="adminUserChosen" class="muted"></div></div><div class="field"><label>الدور</label><select name="role" required><option value="support">الدعم الفني — قراءة فقط</option><option value="moderator">مشرف محتوى وبلاغات</option><option value="admin">مدير — إدارة كاملة دون إدارة المالكين</option></select></div><button class="btn primary">حفظ الصلاحية</button></form></section><section class="panel"><div class="panel-head"><h2>المشرفون الحاليون</h2></div>${rows ? table(['المستخدم', 'الهاتف', 'الدور', 'تاريخ الإضافة', 'الإجراء'], rows) : empty('لا يوجد مشرفون إضافيون.')}</section>`);
  const searchBox = $('#adminUserSearch'), results = $('#adminUserResults'), chosen = $('#adminUserChosen'), idField = $('#adminUserId');
  const pick = (u) => { idField.value = u.id; results.innerHTML = ''; searchBox.value = ''; chosen.innerHTML = `المحدد: <b>${esc(u.name)}</b> <span class="text-ltr">${esc(u.phone || '')}</span> <small>(#${u.id})</small>`; };
  searchBox.addEventListener('input', debounce(async () => {
    const q = searchBox.value.trim();
    if (q.length < 2) { results.innerHTML = ''; return; }
    try {
      const d = await api(`/admin/users?q=${encodeURIComponent(q)}&limit=8`);
      results.innerHTML = (d.users || []).map((u) => `<button type="button" class="user-pick" data-uid="${u.id}"><div class="avatar">${esc((u.name || '?').slice(0, 1))}</div><div><b>${esc(u.name)}</b> <small>@${esc(u.username || '—')} · #${u.id}</small><br><small class="text-ltr">${esc(u.phone || u.email || '')}</small></div></button>`).join('') || '<div class="muted">لا نتائج مطابقة.</div>';
      $$('.user-pick', results).forEach((b) => { b.onclick = () => { const u = d.users.find((x) => String(x.id) === b.dataset.uid); if (u) pick(u); }; });
    } catch { results.innerHTML = ''; }
  }, 300));
  $('#adminRoleForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!idField.value) { toast('اختر المستخدم من نتائج البحث أولاً', true); searchBox.focus(); return; }
    try { await post('/admin/admins', { userId: Number(f.get('userId')), role: f.get('role') }); toast('تم حفظ الصلاحية'); adminsPage(); } catch (err) { toast(err.message, true); }
  };
}

async function releasePage() {
  const r = await api('/admin/release');
  const rows = [['إصدار الخادم', r.serverVersion], ['إصدار حزمة الموبايل', r.mobileVersion], ['إصدار التطبيق', r.appVersion], ['Commit النشر', r.commit || 'غير متاح'], ['Node.js', r.nodeVersion], ['بيئة التشغيل', r.environment], ['وقت الفحص', when(r.checkedAt)]];
  shell(`<section class="panel"><div class="panel-head"><div><h2>الإصدارات المنشورة</h2><p>بيانات الإصدار الذي يعمل حاليًا على هذا الخادم.</p></div>${pill('تم الفحص', 'green')}</div><div class="quick-list">${rows.map((x) => `<div class="quick-row"><span>${esc(x[0])}</span><b class="text-ltr">${esc(x[1])}</b></div>`).join('')}</div><p class="muted">هذه الصفحة تعرض بيانات النشر الحالية؛ لا تنفذ تحديثات تلقائية أو تغيّر إصدار التطبيق المثبت.</p></section>`);
}

/* ---------- user profile modal ---------- */
async function showUser(id) {
  const u = await api('/admin/users/' + id);
  const items = [['الاسم', u.name], ['اسم المستخدم', u.username && '@' + u.username], ['الهاتف', u.phone], ['البريد', u.email], ['الحالة', u.banned ? 'محظور' : u.status === 'online' ? 'متصل الآن' : 'نشط'], ['آخر ظهور', ago(u.last_seen)], ['تاريخ التسجيل', when(u.created_at)], ['جلسات نشطة', num(u.stats.activeSessions)], ['المنشورات', num(u.stats.posts)], ['الرسائل المرسلة', num(u.stats.messages)], ['المتابعون', num(u.stats.followers)], ['يتابع', num(u.stats.following)], ['بلاغات ضده', num(u.stats.reportsAgainst)], ['نبذة', u.bio]];
  const posts = (u.recentPosts || []).map((p) => `<div class="quick-row"><span class="cell-wrap">${esc(String(p.content || '(بدون نص)').slice(0, 120))}</span><small class="muted">${wl(p.created_at)}</small></div>`).join('');
  const actions = u.is_admin ? '' : W(`<div class="actions modal-actions">${btn('user-warn', u.id, 'إرسال تحذير')}${btn('user-sessions', u.id, 'تسجيل خروج من كل الأجهزة')}${btn('user-verify', u.id, u.verified ? 'سحب التوثيق' : 'توثيق الحساب', u.verified ? 'danger' : 'success', `data-on="${u.verified ? 0 : 1}"`)}${btn('user-ban', u.id, u.banned ? 'إلغاء الحظر' : 'حظر الحساب', u.banned ? 'success' : 'danger', `data-banned="${u.banned}"`)}</div>`);
  openModal('ملف المستخدم', `<div class="detail-grid">${items.map((x) => `<div class="detail-item"><small>${x[0]}</small><b>${esc(x[1] ?? '—')}</b></div>`).join('')}</div>${posts ? `<h3 class="modal-sub">آخر المنشورات</h3><div class="quick-list">${posts}</div>` : ''}${actions}`);
}

/* ---------- actions (one delegated handler; every destructive action asks first) ---------- */
/* ---------- verification (blue check) ---------- */
const VCAT = { person: 'شخصية عامة', creator: 'صانع محتوى', business: 'نشاط تجاري', organization: 'منظمة' };
const VSTATUS = { pending: ['قيد المراجعة', 'amber'], approved: ['موثّق', 'green'], rejected: ['مرفوض', 'red'] };
const checkMark = '<span class="vbadge" title="حساب موثّق" aria-label="حساب موثّق">✓</span>';
async function verificationsPage() {
  const st = pg('verifications'), limit = 20;
  const status = st.f.status || 'pending';
  const { items, total } = await apiList(`/admin/verifications?${new URLSearchParams({ status, limit, offset: st.offset })}`);
  const opt = (cur, list) => list.map((o) => `<option value="${o[0]}" ${cur === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('');
  const rows = items.map((v) => { const [label, kind] = VSTATUS[v.status] || [v.status, '']; return `<tr><td>${userCell(v)}${v.verified ? checkMark : ''}</td><td>${esc(VCAT[v.category] || v.category)}</td><td class="cell-wrap">${esc(v.reason || '—')}${v.link ? `<br><small class="muted">${esc(v.link)}</small>` : ''}</td><td>${num(v.followers)} متابع · ${num(v.posts)} منشور</td><td>${pill(label, kind)}${v.review_note ? `<br><small class="muted">${esc(v.review_note)}</small>` : ''}</td><td>${wl(v.created_at)}</td><td>${v.status === 'pending' ? btn('verify-approve', v.id, 'توثيق', 'success') + ' ' + btn('verify-reject', v.id, 'رفض', 'danger') : ''}</td></tr>`; }).join('');
  shell(toolbar('طلبات التوثيق', `<select class="select-small" data-filter="verifications:status" aria-label="الحالة">${opt(status, [['pending', 'قيد المراجعة'], ['approved', 'مقبولة'], ['rejected', 'مرفوضة']])}</select>`)
    + '<div class="notice-box">يمكنك أيضاً منح أو سحب العلامة مباشرة من نافذة المستخدم. يصل المستخدم إشعار بالنتيجة.</div>'
    + (rows ? table(['المستخدم', 'الفئة', 'السبب', 'النشاط', 'الحالة', 'التاريخ', 'الإجراء'], rows) : empty('لا توجد طلبات في هذا التصنيف.')) + pager('verifications', total, limit));
}

/* ---------- AI usage ---------- */
async function aiPage() {
  const d = await api('/admin/ai/usage');
  const t = d.totals;
  const days = (d.daily || []).slice(-14).map((x) => `<tr><td>${esc(String(x.day).slice(0, 10))}</td><td>${num(x.requests)}</td><td>${num(x.tokens)}</td><td>${num(x.users)}</td></tr>`).join('');
  const top = (d.top || []).map((u) => `<tr><td>${userCell(u)}</td><td>${num(u.requests)}</td><td>${num(u.tokens)}</td></tr>`).join('');
  shell(toolbar('استخدام الذكاء الاصطناعي', pill(d.configured ? 'المزوّد مُعدّ' : 'غير مُعدّ', d.configured ? 'green' : 'amber'))
    + `<div class="stat-grid"><div class="stat-card"><span>طلبات (30 يوماً)</span><b>${num(t.requests)}</b></div><div class="stat-card"><span>توكنات</span><b>${num(t.tokens)}</b></div><div class="stat-card"><span>التكلفة التقديرية</span><b>${t.costPer1k ? '$' + t.estimatedCost : 'غير محدد'}</b></div><div class="stat-card"><span>الحد اليومي لكل مستخدم</span><b>${num(d.limits.requests)} طلب</b></div></div>`
    + '<div class="notice-box">الحدود اليومية تُضبط بمتغيرات AI_DAILY_REQUESTS و AI_DAILY_TOKENS، وتقدير التكلفة بـ AI_COST_PER_1K_TOKENS.</div>'
    + `<section class="panel"><div class="panel-head"><h2>آخر 14 يوماً</h2></div>${days ? table(['اليوم', 'الطلبات', 'التوكنات', 'المستخدمون'], days) : empty('لا يوجد استخدام بعد.')}</section>`
    + `<section class="panel"><div class="panel-head"><h2>الأعلى استخداماً</h2></div>${top ? table(['المستخدم', 'الطلبات', 'التوكنات'], top) : empty('—')}</section>`);
}

/* ---------- OTP delivery monitor (events only; codes are never stored or shown) ---------- */
const OTP_EVENT_LABEL = { sent: ['أُرسل بنجاح', 'green'], send_failed: ['فشل الإرسال', 'red'], verified: ['تم التحقق', 'green'], rejected: ['رمز خاطئ/منتهي', 'amber'], blocked: ['محاولات كثيرة', 'red'] };
const OTP_DETAIL_LABEL = { cooldown: 'طلب إعادة إرسال مبكر', max_attempts: 'تجاوز حد المحاولات', wrong_code: 'رمز غير صحيح', expired: 'رمز منتهي الصلاحية', whatsapp: 'عبر واتساب', login: 'تسجيل دخول', register: 'تسجيل حساب جديد', NOT_ON_WHATSAPP: 'الرقم غير مسجل في واتساب', NOT_READY: 'واتساب غير متصل', SEND_FAILED: 'فشل الإرسال' };
const otpPage = () => listView({
  key: 'otp', title: 'سجل أحداث رموز التحقق', search: 'ابحث بالرقم…', csv: true, limit: 50, empty: 'لا توجد أحداث مسجلة بعد. ستظهر هنا عمليات إرسال الرموز والتحقق منها.',
  filters: [{ name: 'event', label: 'الحدث', options: [['all', 'كل الأحداث'], ['sent', 'أُرسل بنجاح'], ['send_failed', 'فشل الإرسال'], ['verified', 'تم التحقق'], ['rejected', 'رمز خاطئ/منتهي'], ['blocked', 'محاولات كثيرة']] }],
  fetch: async (qs) => { const { data, total } = await request(`/admin/otp-events?${qs}`); state.otpMeta = data; return { items: data.items || [], total }; },
  above: () => {
    const d = state.otpMeta || {}; const t = d.today || {}; const w = d.whatsapp || {};
    const waCard = w.ready
      ? ['واتساب متصل', `الحساب ${w.account || ''}`.trim(), 'green']
      : ['واتساب غير متصل', 'الإرسال متوقف — راجع إعداد واتساب', 'red'];
    const rate = t.sent ? Math.round((Number(t.verified || 0) / Number(t.sent)) * 100) : 0;
    return `<div class="grid stats-grid"><div class="stat-card"><div class="stat-head">حالة واتساب</div><div class="stat-value small">${pill(waCard[0], waCard[2])}</div><div class="stat-foot">${esc(waCard[1])}</div></div><div class="stat-card"><div class="stat-head">رموز اليوم</div><div class="stat-value">${num(t.total)}</div><div class="stat-foot">أُرسل ${num(t.sent)} · فشل ${num(t.failed)}</div></div><div class="stat-card"><div class="stat-head">تُحقق منها اليوم</div><div class="stat-value">${num(t.verified)}</div><div class="stat-foot">${rate}% من المرسلة</div></div><div class="stat-card"><div class="stat-head">فشل الإرسال اليوم</div><div class="stat-value">${num(t.failed)}</div><div class="stat-foot">${Number(t.failed) ? 'راجع الأحداث بالأسفل' : 'لا مشاكل'}</div></div></div><div class="notice-box">هذه الصفحة تعرض أحداث الإرسال والتحقق فقط (الرقم والنتيجة والوقت). رموز التحقق نفسها لا تُحفظ ولا تظهر هنا إطلاقاً.</div>`;
  },
  headers: ['الرقم', 'الحدث', 'التفاصيل', 'الوقت'],
  csvHeaders: ['الرقم', 'الحدث', 'التفاصيل', 'الوقت'],
  csvRow: (e) => [e.phone, e.event, e.detail || '', e.created_at],
  row: (e) => { const [label, kind] = OTP_EVENT_LABEL[e.event] || [e.event, '']; return `<tr><td><span class="text-ltr">${esc(e.phone)}</span></td><td>${pill(label, kind)}</td><td>${esc(OTP_DETAIL_LABEL[e.detail] || e.detail || '—')}</td><td>${wl(e.created_at)}</td></tr>`; },
});

const PAGES = { overview, users: usersPage, posts: postsPage, stories: storiesPage, reports: reportsPage, groups: groupsPage, conversations: conversationsPage, sessions: sessionsPage, broadcast: broadcastPage, campaigns: campaignsPage, backups: backupsPage, words: wordsPage, audit: auditPage, admins: adminsPage, release: releasePage, errors: errorsPage, verifications: verificationsPage, ai: aiPage, otp: otpPage, rlog: rlogPage, appeals: appealsPage, alerts: alertsPage };
const reload = () => loadPage(state.page, { keepScroll: true });
const ACTIONS = {
  'user-view': (id) => showUser(id),
  'user-warn': async (id) => { const v = await ask({ title: 'تنبيه إداري', message: 'سيصل التنبيه للمستخدم داخل التطبيق وكإشعار دفع.', confirm: 'إرسال التنبيه', fields: [{ name: 'message', label: 'نص التنبيه', type: 'textarea', required: true, max: 500, placeholder: 'اكتب سبب التنبيه…' }] }); if (!v) return; await post(`/admin/users/${id}/warn`, { message: v.message }); toast('تم إرسال التنبيه للمستخدم'); },
  'user-ban': async (id, el) => { const banned = el.dataset.banned !== 'true'; if (!(await ask({ title: banned ? 'حظر المستخدم' : 'إلغاء الحظر', message: banned ? 'سيُسجَّل خروجه من كل الأجهزة ولن يتمكن من الدخول.' : 'سيتمكن المستخدم من الدخول مجدداً.', confirm: banned ? 'حظر' : 'إلغاء الحظر', danger: banned }))) return; await post(`/admin/users/${id}/ban`, { banned }); toast('تم تحديث حالة المستخدم'); closeModal(); reload(); },
  'user-delete': async (id) => { if (!(await ask({ title: 'حذف المستخدم نهائياً', message: 'سيُحذف الحساب وكل بياناته المرتبطة ولا يمكن التراجع.', confirm: 'حذف نهائي', danger: true, fields: [{ name: 'c', label: 'اكتب «حذف» للتأكيد', expect: 'حذف', required: true }] }))) return; await del('/admin/users/' + id); toast('تم حذف المستخدم'); reload(); },
  'user-sessions': async (id) => { if (!(await ask({ title: 'تسجيل الخروج من كل الأجهزة', message: 'سيحتاج المستخدم لتسجيل الدخول من جديد على كل أجهزته.', confirm: 'إنهاء الجلسات', danger: true }))) return; const d = await post(`/admin/users/${id}/sessions/revoke`); toast(`تم إنهاء ${num(d.revoked)} جلسة`); },
  'post-delete': async (id) => { if (!(await ask({ title: 'حذف المنشور', message: 'سيُحذف المنشور نهائياً.', confirm: 'حذف', danger: true }))) return; await del('/admin/posts/' + id); toast('تم حذف المنشور'); reload(); },
  'story-delete': async (id) => { if (!(await ask({ title: 'حذف الحالة', message: 'ستُحذف هذه الحالة نهائياً.', confirm: 'حذف', danger: true }))) return; await del('/admin/stories/' + id); toast('تم حذف الحالة'); reload(); },
  'group-delete': async (id) => { if (!(await ask({ title: 'حذف المجموعة', message: 'ستُحذف المجموعة ومحادثتها.', confirm: 'حذف', danger: true }))) return; await del('/admin/groups/' + id); toast('تم حذف المجموعة'); reload(); },
  'conv-delete': async (id) => { if (!(await ask({ title: 'حذف المحادثة', message: 'ستُحذف المحادثة وجميع رسائلها نهائياً.', confirm: 'حذف', danger: true }))) return; await del('/admin/conversations/' + id); toast('تم حذف المحادثة'); reload(); },
  'session-revoke': async (id) => { if (!(await ask({ title: 'إنهاء الجلسة', message: 'سيُسجَّل خروج هذا الجهاز فوراً.', confirm: 'إنهاء', danger: true }))) return; await del('/admin/sessions/' + id); toast('تم إنهاء الجلسة'); reload(); },
  'word-delete': async (id) => { await del('/admin/banned-words/' + id); toast('تم حذف الكلمة'); reload(); },
  'admin-remove': async (id) => { if (!(await ask({ title: 'إزالة الصلاحية', message: 'سيفقد هذا المستخدم الوصول إلى لوحة التحكم.', confirm: 'إزالة', danger: true }))) return; await del('/admin/admins/' + id); toast('تمت إزالة الصلاحية'); reload(); },
  'campaign-delete': async (id) => { if (!(await ask({ title: 'حذف الحملة', message: 'ستُحذف الحملة نهائياً.', confirm: 'حذف', danger: true }))) return; await del('/admin/campaigns/' + id); toast('تم حذف الحملة'); reload(); },
  'backup-create': async () => { if (!(await ask({ title: 'نسخة احتياطية', message: 'سيتم إنشاء نسخة احتياطية مشفرة الآن.', confirm: 'إنشاء' }))) return; await post('/admin/backups'); toast('تم إنشاء النسخة'); reload(); },
  'backup-delete': async (id) => { if (!(await ask({ title: 'حذف النسخة الاحتياطية', message: id, confirm: 'حذف', danger: true }))) return; await del('/admin/backups/' + encodeURIComponent(id)); toast('تم حذف النسخة'); reload(); },
  'backup-restore': async (id) => { const v = await ask({ title: 'استعادة قاعدة البيانات', message: 'الاستعادة تستبدل قاعدة البيانات الحالية بالكامل. اكتب اسم قاعدة البيانات للتأكيد.', confirm: 'استعادة', danger: true, fields: [{ name: 'confirmDatabase', label: 'اسم قاعدة البيانات', required: true }] }); if (!v) return; await post(`/admin/backups/${encodeURIComponent(id)}/restore`, { confirmDatabase: v.confirmDatabase }); toast('اكتملت استعادة قاعدة البيانات'); },
  'report-resolve': (id) => settleReport(id, 'resolved', false, false, 'حل البلاغ', 'سيُغلق البلاغ كمحلول دون أي إجراء إضافي.'),
  'report-dismiss': (id) => settleReport(id, 'dismissed', false, false, 'رفض البلاغ', 'سيُغلق البلاغ كمرفوض.'),
  'report-delete': (id) => settleReport(id, 'resolved', true, false, 'حذف المحتوى', 'سيُحذف المحتوى المبلغ عنه نهائياً ويُغلق البلاغ.'),
  'report-ban': (id, el) => settleReport(id, 'resolved', false, el.dataset.user, 'حظر صاحب المحتوى', 'سيُحظر الحساب ويُغلق البلاغ.'),
  'verify-approve': async (id) => { if (!(await ask({ title: 'توثيق الحساب', message: 'ستظهر علامة التحقق بجانب اسم الحساب.', confirm: 'توثيق' }))) return; await post(`/admin/verifications/${id}/decide`, { approve: true }); toast('تم توثيق الحساب'); reload(); },
  'verify-reject': async (id) => { const v = await ask({ title: 'رفض طلب التوثيق', message: 'سيُرسل السبب للمستخدم.', confirm: 'رفض', danger: true, fields: [{ name: 'note', label: 'سبب الرفض', required: true }] }); if (!v) return; await post(`/admin/verifications/${id}/decide`, { approve: false, note: v.note }); toast('تم رفض الطلب'); reload(); },
  'user-verify': async (id, el) => { const on = el.dataset.on === '1'; if (!(await ask({ title: on ? 'منح علامة التحقق' : 'سحب علامة التحقق', message: on ? 'سيظهر الحساب كموثّق.' : 'ستُزال علامة التحقق من الحساب.', confirm: on ? 'منح' : 'سحب', danger: !on }))) return; await post(`/admin/verifications/user/${id}`, { verified: on }); toast('تم التحديث'); closeModal(); reload(); },
  'backup-run': async () => { if (!(await ask({ title: 'دورة نسخ كاملة', message: 'إنشاء نسخة، فحص سلامتها، ثم رفعها خارج الخادم إن كان مُعدّاً.', confirm: 'تشغيل' }))) return; const r = await post('/admin/backups/run'); toast(r.ok ? 'اكتملت الدورة بنجاح' : 'فشلت الدورة: ' + (r.detail || ''), !r.ok); reload(); },
  'backup-verify': async (id) => { const r = await post(`/admin/backups/${encodeURIComponent(id)}/verify`); toast(r.ok ? 'النسخة سليمة: ' + r.detail : 'النسخة غير سليمة: ' + r.detail, !r.ok); reload(); },
  'backup-upload': async (id) => { await post(`/admin/backups/${encodeURIComponent(id)}/upload`); toast('تم الرفع والتحقق'); reload(); },
  'appeal-accept': async (id) => { const v = await ask({ title: 'قبول الاعتراض', message: 'سيُرفع القرار ويُبلَّغ المستخدم.', confirm: 'قبول', fields: [{ name: 'note', label: 'ملاحظة للمستخدم', max: 300 }] }); if (!v) return; await post(`/admin/appeals/${id}/decide`, { accept: true, note: v.note }); toast('تم قبول الاعتراض'); reload(); },
  'appeal-deny': async (id) => { const v = await ask({ title: 'رفض الاعتراض', message: 'سيُرسل السبب للمستخدم.', confirm: 'رفض', danger: true, fields: [{ name: 'note', label: 'سبب الرفض', required: true, max: 300 }] }); if (!v) return; await post(`/admin/appeals/${id}/decide`, { accept: false, note: v.note }); toast('تم رفض الاعتراض'); reload(); },
  go: (id) => navigate(id),
  range: (id) => { state.days = Number(id); reload(); },
  rebroadcast: (id, el) => { if (state.fillBroadcast) state.fillBroadcast(el.dataset.title, el.dataset.body); },
  export: (key) => { const l = lastList[key]; if (!l) return; downloadCsv(key, l.cfg.csvHeaders, l.items.map(l.cfg.csvRow)); },
  page: (id, el) => { const st = pg(el.dataset.key); st.offset = Math.max(0, st.offset + Number(el.dataset.dir) * Number(el.dataset.limit)); reload(); window.scrollTo({ top: 0 }); },
};
async function settleReport(id, status, deleteContent, banUser, title, message) {
  const v = await ask({ title, message, confirm: title, danger: !!(deleteContent || banUser), fields: [{ name: 'note', label: 'ملاحظة القرار (تُحفظ في السجل)', max: 300 }] });
  if (!v) return;
  if (banUser) await post(`/admin/users/${banUser}/ban`, { banned: true });
  await post(`/admin/reports/${id}/resolve`, { status, delete_content: deleteContent, banned_user: !!banUser, note: v ? v.note : '' });
  toast('تم تحديث البلاغ'); reload();
}

/* Sortable column headers: sorts the rows currently shown on screen (the loaded page only). */
const cellSortKey = (td) => {
  const t = (td ? td.textContent : '').trim();
  if (/^[\s\d.,%$+\-]*$/.test(t)) {
    const m = t.match(/-?[\d,]+(\.\d+)?/);
    if (m) return Number(m[0].replace(/,/g, ''));
  }
  return t;
};
document.addEventListener('click', (e) => {
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  const tableEl = th.closest('table');
  const tbody = tableEl && tableEl.tBodies[0];
  if (!tbody || tbody.rows.length < 2) return;
  const col = Number(th.dataset.sort);
  const dir = th.classList.contains('sort-asc') ? -1 : 1;
  $$('th', tableEl).forEach((h) => h.classList.remove('sort-asc', 'sort-desc'));
  th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
  const sorted = Array.from(tbody.rows).sort((r1, r2) => {
    const a = cellSortKey(r1.cells[col]);
    const b = cellSortKey(r2.cells[col]);
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
    return String(a).localeCompare(String(b), 'ar') * dir;
  });
  sorted.forEach((r) => tbody.appendChild(r));
});

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  el.disabled = true;
  try { await fn(el.dataset.id, el); } catch (err) { toast(err.message, true); } finally { el.disabled = false; }
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.stat-card.clickable')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.matches('[data-campaign-status]')) { try { await api(`/admin/campaigns/${el.dataset.campaignStatus}/status`, { method: 'PUT', body: JSON.stringify({ status: el.value }) }); toast('تم تحديث حالة الحملة'); } catch (err) { toast(err.message, true); reload(); } return; }
  if (el.matches('[data-filter]')) { const [key, name] = el.dataset.filter.split(':'); const st = pg(key); st.f[name] = el.value; st.offset = 0; reload(); }
});
document.addEventListener('input', debounce((e) => {
  const el = e.target;
  if (!el.matches('[data-search]')) return;
  const st = pg(el.dataset.search); st.q = el.value.trim(); st.offset = 0; state.refocus = el.dataset.search; reload();
}, 350));

/* ---------- navigation & lifecycle ---------- */
let loadToken = 0;
async function loadPage(page, { keepScroll = false } = {}) {
  if (!PAGES[page]) page = 'overview';
  const mine = ++loadToken, y = window.scrollY;
  state.page = page;
  $('#pageTitle').textContent = TITLES[page] || 'لوحة التحكم';
  $$('.nav-item').forEach((x) => x.classList.toggle('active', x.dataset.page === page));
  if (!keepScroll) shell('<div class="loading">جارٍ تحميل البيانات…</div>');
  try { await PAGES[page](); if (mine === loadToken && keepScroll) window.scrollTo({ top: y }); }
  catch (err) { if (mine === loadToken) { shell(`<div class="empty">${esc(err.message)}</div>`); toast(err.message, true); } }
}
function navigate(page) {
  if (state.me && !state.me.pages.includes(page)) { toast('ليست لديك صلاحية لفتح هذه الصفحة', true); return; }
  if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page);
  $('#sidebar').classList.remove('open');
  loadPage(page);
}
$('#navigation').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) navigate(b.dataset.page); });
window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (state.me && p && p !== state.page && state.me.pages.includes(p)) loadPage(p); });

const showLogin = () => { $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); stopAuto(); };
async function showApp(user) {
  state.user = user;
  state.me = await api('/admin/me').catch(() => ({ role: 'owner', pages: Object.keys(PAGES), canWrite: true, name: user?.name }));
  $('#adminName').textContent = state.me.name || user?.name || 'مدير النظام';
  $('#adminRole').textContent = ROLE_LABEL[state.me.role] || state.me.role;
  $('#adminAvatar').textContent = (state.me.name || 'A').slice(0, 1);
  // Hide navigation the role cannot open (the server enforces it as well)
  $$('.nav-item').forEach((x) => x.classList.toggle('hidden', !state.me.pages.includes(x.dataset.page)));
  $$('.side-label.separated').forEach((x) => x.classList.toggle('hidden', !['broadcast', 'campaigns', 'backups', 'words', 'audit', 'admins', 'errors', 'release', 'otp', 'settings'].some((p) => state.me.pages.includes(p))));
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  const first = location.hash.slice(1);
  loadPage(state.me.pages.includes(first) ? first : 'overview');
  startAuto();
}
async function logout(show = true) {
  const token = state.token;
  if (show && token) { try { await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }); } catch { /* ignore */ } }
  state.token = ''; state.user = null; state.me = null; sessionStorage.removeItem('special_admin_token');
  showLogin(); closeModal(); $('#dialogRoot').innerHTML = '';
  $('#otpForm').classList.add('hidden'); $('#phoneForm').classList.remove('hidden');
  if (show) toast('تم تسجيل الخروج');
}

/* Live data: refresh the overview and the report badge quietly while the tab is visible */
let autoTimer = null;
function startAuto() {
  stopAuto();
  autoTimer = setInterval(async () => {
    if (document.hidden || !state.token) return;
    try {
      if (state.page === 'overview' && !$('#modalRoot').innerHTML && !$('#dialogRoot').innerHTML) await loadPage('overview', { keepScroll: true });
      else { const s = await api('/admin/stats'); $('#reportBadge').textContent = num(s.openReports); }
    } catch { /* offline indicator already updated */ }
  }, 60000);
}
const stopAuto = () => { clearInterval(autoTimer); autoTimer = null; };

/* ---------- login ---------- */
$('#phoneForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = $('#phone').value.trim(); if (!phone) return;
  const b = e.submitter; b.disabled = true; $('#loginMessage').textContent = 'جارٍ إرسال الرمز…';
  try {
    const r = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || 'تعذر إرسال الرمز');
    state.loginPhone = phone; $('#phoneForm').classList.add('hidden'); $('#otpForm').classList.remove('hidden');
    $('#loginMessage').textContent = 'تم طلب رمز التحقق. أدخل الرمز المرسل إليك.'; $('#otp').focus();
  } catch (err) { $('#loginMessage').textContent = err.message; } finally { b.disabled = false; }
});
$('#otpForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = e.submitter; b.disabled = true; $('#loginMessage').textContent = 'جارٍ التحقق…';
  try {
    const r = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: state.loginPhone, code: $('#otp').value.trim(), ...($('#totp').value.trim() ? { totp: $('#totp').value.trim() } : {}) }) });
    const d = await r.json().catch(() => ({}));
    if (d.twoFactorRequired) { $('#totpWrap').classList.remove('hidden'); $('#totp').focus(); }
    if (!r.ok) throw new Error(d.message || 'رمز غير صحيح');
    if (!d.userExists || !d.token) throw new Error('هذا الرقم غير مرتبط بحساب مسجل.');
    state.token = d.token;
    await api('/admin/me'); // proves the account has an admin role before storing the token
    sessionStorage.setItem('special_admin_token', state.token);
    $('#otp').value = ''; $('#totp').value = ''; $('#totpWrap').classList.add('hidden'); $('#loginMessage').textContent = '';
    await showApp(d.user);
  } catch (err) { state.token = ''; $('#loginMessage').textContent = err.message === 'Admin access required' ? 'هذا الحساب لا يملك صلاحية الدخول للوحة.' : err.message; } finally { b.disabled = false; }
});
$('#backToPhone').onclick = () => { $('#otpForm').classList.add('hidden'); $('#phoneForm').classList.remove('hidden'); $('#loginMessage').textContent = ''; };
$('#logoutBtn').onclick = () => logout();
$('#themeToggle').onclick = () => { document.body.classList.toggle('dark'); try { localStorage.setItem('special_admin_theme', document.body.classList.contains('dark') ? 'dark' : 'light'); } catch { /* private mode */ } };
try { if (localStorage.getItem('special_admin_theme') === 'dark') document.body.classList.add('dark'); } catch { /* ignore */ }
$('#menuToggle').onclick = () => $('#sidebar').classList.toggle('open');
$('#refreshBtn').onclick = () => loadPage(state.page, { keepScroll: true });

(async function boot() {
  if (!state.token) { showLogin(); return; }
  try { const me = await api('/admin/me'); await showApp({ name: me.name }); } catch { logout(false); }
})();
