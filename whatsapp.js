// ===== WHATSAPP BULK MESSAGING MODULE =====
const WhatsApp = {
  contacts: [],
  defaultTemplate: 'Hi {{name}}! 👋\n\nThank you for shopping with us at *ElectroShop*! 🎉\n\nWe have exciting new offers and products just for you. Visit us today!\n\n📍 Visit our store or call us anytime.\n\nBest regards,\nTeam ElectroShop ⚡',

  init() {
    const tmpl = document.getElementById('wa-template');
    if (tmpl) tmpl.value = this.defaultTemplate;
    this.renderContacts();
    this.setupDrag();
  },

  setupDrag() {
    const zone = document.getElementById('wa-drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag');
      const file = e.dataTransfer.files[0];
      if (file) this.processExcel(file);
    });
  },

  processExcel(file) {
    const progress = document.getElementById('wa-progress');
    if (progress) progress.style.display = 'flex';
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      this.contacts = rows.map(r => {
        const phone = String(r.Phone || r.phone || r['Phone Number'] || r.Mobile || r.mobile || '').replace(/\D/g, '');
        const name = r.Name || r.name || r['Customer Name'] || 'Customer';
        return { name, phone };
      }).filter(c => c.phone.length >= 10);
      if (progress) progress.style.display = 'none';
      document.getElementById('wa-file-name').textContent = `✅ ${file.name} — ${this.contacts.length} contacts found`;
      this.renderContacts();
      Notify.success(`${this.contacts.length} contacts loaded from Excel!`);
    };
    reader.readAsBinaryString(file);
  },

  loadFromCustomers() {
    const customers = DB.get('customers').filter(c => c.phone);
    this.contacts = customers.map(c => ({ name: c.name, phone: c.phone.replace(/\D/g, '') })).filter(c => c.phone.length >= 10);
    document.getElementById('wa-file-name').textContent = `✅ Loaded ${this.contacts.length} customers from database`;
    this.renderContacts();
    Notify.success(`${this.contacts.length} customers loaded!`);
  },

  renderContacts() {
    const el = document.getElementById('wa-contacts-list');
    if (!el) return;
    if (!this.contacts.length) {
      el.innerHTML = `<div class="empty-state" style="padding:30px"><i class="ri-group-line"></i><h3>No contacts loaded</h3><p>Upload an Excel file or load from customers</p></div>`;
      return;
    }
    const templateEl = document.getElementById('wa-template');
    const template = (templateEl && templateEl.value) || this.defaultTemplate;
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="fw-600" style="font-size:.875rem">${this.contacts.length} contacts ready</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-secondary" onclick="WhatsApp.selectAll()"><i class="ri-checkbox-multiple-line"></i> Select All</button>
          <button class="btn btn-sm btn-primary" onclick="WhatsApp.sendAll()"><i class="ri-whatsapp-line"></i> Send All</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">
        ${this.contacts.map((c, i) => {
          const msg = encodeURIComponent(template.replace(/{{name}}/gi, c.name).replace(/{{shop}}/gi, 'ElectroShop'));
          const phone = c.phone.startsWith('91') ? c.phone : '91' + c.phone.slice(-10);
          const waLink = `https://wa.me/${phone}?text=${msg}`;
          return `<div id="wa-contact-${i}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border);transition:all var(--tr)">
            <input type="checkbox" id="wa-check-${i}" style="accent-color:var(--accent);width:16px;height:16px" checked/>
            <div class="customer-avatar" style="width:36px;height:36px;font-size:.8rem">${c.name.slice(0,2).toUpperCase()}</div>
            <div style="flex:1;min-width:0">
              <div class="fw-600" style="font-size:.875rem">${Utils.escapeHtml(c.name)}</div>
              <div style="font-size:.75rem;color:var(--text2)">+${phone}</div>
            </div>
            <a href="${waLink}" target="_blank" class="btn btn-sm" style="background:#25D366;color:#fff;gap:6px;text-decoration:none;flex-shrink:0" onclick="WhatsApp.markSent(${i})">
              <i class="ri-whatsapp-line"></i> Send
            </a>
            <button class="btn-icon btn btn-sm" onclick="navigator.clipboard.writeText('${waLink}');Notify.success('Link copied!')" title="Copy link"><i class="ri-link"></i></button>
          </div>`;
        }).join('')}
      </div>
    `;
  },

  selectAll() {
    document.querySelectorAll('[id^="wa-check-"]').forEach(cb => cb.checked = true);
  },

  sendAll() {
    const templateEl = document.getElementById('wa-template');
    const template = (templateEl && templateEl.value) || this.defaultTemplate;
    const checked = this.contacts.filter((_, i) => {
      const cb = document.getElementById(`wa-check-${i}`);
      return cb && cb.checked;
    });
    if (!checked.length) { Notify.warning('Select at least one contact'); return; }
    if (checked.length > 5) {
      Notify.info(`Opening ${checked.length} WhatsApp links. Your browser may block popups — please allow them.`, 5000);
    }
    checked.forEach((c, idx) => {
      setTimeout(() => {
        const msg = encodeURIComponent(template.replace(/{{name}}/gi, c.name));
        const phone = c.phone.startsWith('91') ? c.phone : '91' + c.phone.slice(-10);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      }, idx * 800);
    });
    Notify.success(`Sending to ${checked.length} contacts!`);
  },

  markSent(i) {
    const el = document.getElementById(`wa-contact-${i}`);
    if (el) { el.style.opacity = '.5'; el.style.background = 'var(--success-bg)'; }
  },

  updatePreview() {
    const templateEl = document.getElementById('wa-template');
    const template = (templateEl && templateEl.value) || '';
    const preview = document.getElementById('wa-preview');
    if (preview) {
      const sampleName = (this.contacts && this.contacts[0] && this.contacts[0].name) || 'Rahul';
      preview.textContent = template.replace(/{{name}}/gi, sampleName).replace(/{{shop}}/gi, 'ElectroShop');
    }
  }
};

// ===== ANALYTICS MODULE =====
const Analytics = {
  charts: {},

  init() { this.render(); },

  render() {
    const months = Utils.getLastMonths(6);
    const txns  = DB.get('transactions');
    const bills = DB.get('bills');
    const products = DB.get('products');

    const salesData = months.map(m => {
      const monthBills = bills.filter(b => { const d = new Date(b.createdAt); return d.getMonth() === m.month && d.getFullYear() === m.year; });
      const fromTxns = txns.filter(t => t.type === 'sale' && new Date(t.date).getMonth() === m.month).reduce((s, t) => s + t.amount, 0);
      return monthBills.reduce((s, b) => s + b.total, 0) + fromTxns;
    });
    const purchaseData = months.map(m => txns.filter(t => t.type === 'purchase' && new Date(t.date).getMonth() === m.month).reduce((s, t) => s + t.amount, 0));
    const profitData = salesData.map((s, i) => s - purchaseData[i]);
    const labels = months.map(m => m.label);

    const totalSales = salesData.reduce((a, b) => a + b, 0);
    const totalPurchase = purchaseData.reduce((a, b) => a + b, 0);
    const totalProfit = profitData.reduce((a, b) => a + b, 0);
    const profitPct = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0;

    // Summary stats
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('an-total-sales', Utils.formatCurrency(totalSales));
    setEl('an-total-purchase', Utils.formatCurrency(totalPurchase));
    setEl('an-profit', Utils.formatCurrency(totalProfit));
    setEl('an-margin', profitPct + '%');

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    const textColor = isDark ? '#8D96C0' : '#525775';
    const opts = {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Inter', size: 11 } } },
        tooltip: { backgroundColor: isDark ? '#0F1120' : '#fff', titleColor: isDark ? '#E8EBF8' : '#0D0F1C', bodyColor: textColor, borderWidth: 1, borderColor: 'rgba(123,97,255,.2)', padding: 10, callbacks: { label: ctx => ' ₹' + ctx.raw.toLocaleString('en-IN') } }
      },
      scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => '₹' + v.toLocaleString('en-IN') } } }
    };

    // Profit/Loss chart
    const plCtx = document.getElementById('an-profit-chart');
    if (plCtx) {
      if (this.charts.pl) this.charts.pl.destroy();
      this.charts.pl = new Chart(plCtx, {
        type: 'bar',
        data: { labels, datasets: [
          { label: 'Sales', data: salesData, backgroundColor: 'rgba(123,97,255,.75)', borderRadius: 7 },
          { label: 'Purchase', data: purchaseData, backgroundColor: 'rgba(0,212,255,.75)', borderRadius: 7 },
          { label: 'Profit', data: profitData, backgroundColor: profitData.map(v => v >= 0 ? 'rgba(16,185,129,.75)' : 'rgba(239,68,68,.75)'), borderRadius: 7 }
        ]},
        options: opts
      });
    }

    // Top products
    const productSales = {};
    bills.forEach(b => b.items.forEach(item => {
      productSales[item.name] = (productSales[item.name] || 0) + item.qty;
    }));
    const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const tpCtx = document.getElementById('an-top-chart');
    if (tpCtx) {
      if (this.charts.tp) this.charts.tp.destroy();
      this.charts.tp = new Chart(tpCtx, {
        type: 'doughnut',
        data: { labels: topProducts.map(p => p[0].slice(0, 20)), datasets: [{ data: topProducts.map(p => p[1]), backgroundColor: ['#7B61FF','#00D4FF','#10B981','#F59E0B','#EF4444','#3B82F6'], borderWidth: 0, hoverOffset: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor, font: { family: 'Inter', size: 11 } } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} units` } } } }
      });
    }

    // Top products list
    const topListEl = document.getElementById('an-top-list');
    if (topListEl) {
      const maxQty = (topProducts && topProducts[0] && topProducts[0][1]) || 1;
      topListEl.innerHTML = topProducts.map(([name, qty]) => `
        <div class="stat-row">
          <div style="flex:1;min-width:0">
            <div class="fw-600" style="font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(name)}</div>
            <div class="stat-bar" style="width:${(qty/maxQty*100).toFixed(0)}%;margin-top:6px"></div>
          </div>
          <div style="font-weight:700;color:var(--accent);margin-left:16px">${qty} units</div>
        </div>
      `).join('') || '<div class="empty-state" style="padding:20px"><i class="ri-bar-chart-line"></i><h3>No sales data yet</h3></div>';
    }
  }
};

// ===== SETTINGS MODULE =====
const Settings = {
  init() {
    this.load();
    this.bindThemeToggle();
  },

  load() {
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const el = id => document.getElementById(id);
    if (el('set-name'))  el('set-name').value  = session.name || '';
    if (el('set-shop'))  el('set-shop').value  = session.shop || '';
    if (el('set-email')) el('set-email').value = session.email || '';
    if (el('set-phone')) el('set-phone').value = session.phone || '';
    if (el('set-address')) el('set-address').value = localStorage.getItem('shopapp_address') || '';
    if (el('set-state')) el('set-state').value = localStorage.getItem('shopapp_state') || '';
    if (el('set-currency')) el('set-currency').value = localStorage.getItem('shopapp_currency') || '₹';
    if (el('set-gst'))  el('set-gst').value   = localStorage.getItem('shopapp_gst') || '';
    // Bill settings
    if (el('set-bank')) el('set-bank').value = localStorage.getItem('shopapp_bank') || '';
    if (el('set-bank-acc')) el('set-bank-acc').value = localStorage.getItem('shopapp_bank_acc') || '';
    if (el('set-bank-ifsc')) el('set-bank-ifsc').value = localStorage.getItem('shopapp_bank_ifsc') || '';
    if (el('set-upi')) el('set-upi').value = localStorage.getItem('shopapp_upi') || '';
    if (el('set-terms')) el('set-terms').value = localStorage.getItem('shopapp_terms') || 'All disputes subject to local jurisdiction only. Goods once sold will not be taken back or exchanged. Warranty as per manufacturer terms.';
    // QR preview
    const qrData = localStorage.getItem('shopapp_qr_base64');
    const qrImg = el('qr-preview-img');
    const qrIcon = el('qr-placeholder-icon');
    if (qrImg && qrData) { qrImg.src = qrData; qrImg.style.display = 'block'; if (qrIcon) qrIcon.style.display = 'none'; }
    // Logo preview
    const logoData = localStorage.getItem('shopapp_logo_base64');
    const logoImg = el('logo-preview-img');
    const logoIcon = el('logo-placeholder-icon');
    if (logoImg && logoData) { logoImg.src = logoData; logoImg.style.display = 'block'; if (logoIcon) logoIcon.style.display = 'none'; }
    // Theme toggle state
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const themeInput = el('theme-toggle-input');
    if (themeInput) themeInput.checked = isDark;
  },

  bindThemeToggle() {
    const input = document.getElementById('theme-toggle-input');
    if (!input) return;
    input.addEventListener('change', () => {
      const theme = input.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('shopapp_theme', theme);
      // Update navbar icon
      const icon = document.getElementById('navbar-theme-icon');
      if (icon) icon.className = theme === 'dark' ? 'ri-moon-line' : 'ri-sun-line';
      // Redraw charts
      Dashboard.renderCharts();
      Analytics.render();
    });
  },

  saveProfile() {
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const el = id => document.getElementById(id);
    const nEl = el('set-name'); const name = (nEl && nEl.value.trim()) || session.name;
    const sEl = el('set-shop'); const shop = (sEl && sEl.value.trim()) || session.shop;
    const pEl = el('set-phone'); const phone = (pEl && pEl.value.trim()) || session.phone;
    const aEl = el('set-address'); const address = (aEl && aEl.value.trim()) || '';
    const stEl = el('set-state'); const state = (stEl && stEl.value.trim()) || '';
    Object.assign(session, { name, shop, phone });
    localStorage.setItem('shopapp_session', JSON.stringify(session));
    localStorage.setItem('shopapp_address', address);
    localStorage.setItem('shopapp_state', state);
    // Update UI
    document.getElementById('nav-user-name').textContent = name.split(' ')[0];
    document.getElementById('sidebar-user-name').textContent = name;
    document.getElementById('sidebar-user-role').textContent = shop;
    document.getElementById('nav-avatar').textContent = name.slice(0, 2).toUpperCase();
    document.getElementById('sidebar-avatar').textContent = name.slice(0, 2).toUpperCase();
    Notify.success('Profile updated successfully!');
  },

  saveBillSettings() {
    const el = id => document.getElementById(id);
    const bEl = el('set-bank'); localStorage.setItem('shopapp_bank', (bEl && bEl.value.trim()) || '');
    const baEl = el('set-bank-acc'); localStorage.setItem('shopapp_bank_acc', (baEl && baEl.value.trim()) || '');
    const biEl = el('set-bank-ifsc'); localStorage.setItem('shopapp_bank_ifsc', (biEl && biEl.value.trim()) || '');
    const uEl = el('set-upi'); localStorage.setItem('shopapp_upi', (uEl && uEl.value.trim()) || '');
    const tEl = el('set-terms'); localStorage.setItem('shopapp_terms', (tEl && tEl.value.trim()) || '');
    Notify.success('Bill settings saved! Your next invoice will use these details.');
  },

  uploadQR(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = e.target.result;
      localStorage.setItem('shopapp_qr_base64', base64);
      const img = document.getElementById('qr-preview-img');
      const icon = document.getElementById('qr-placeholder-icon');
      if (img) { img.src = base64; img.style.display = 'block'; }
      if (icon) icon.style.display = 'none';
      Notify.success('QR code uploaded! It will appear on your bill PDF.');
    };
    reader.readAsDataURL(file);
  },

  removeQR() {
    localStorage.removeItem('shopapp_qr_base64');
    const img = document.getElementById('qr-preview-img');
    const icon = document.getElementById('qr-placeholder-icon');
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (icon) icon.style.display = '';
    Notify.info('QR code removed');
  },

  uploadLogo(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const imgObj = new Image();
      imgObj.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 300;
        let w = imgObj.width, h = imgObj.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h * maxSize) / w; w = maxSize; }
          else { w = (w * maxSize) / h; h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        ctx.drawImage(imgObj, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);

        try {
          localStorage.setItem('shopapp_logo_base64', base64);
          const img = document.getElementById('logo-preview-img');
          const icon = document.getElementById('logo-placeholder-icon');
          if (img) { img.src = base64; img.style.display = 'block'; }
          if (icon) icon.style.display = 'none';
          Notify.success('Logo uploaded and resized! It will appear on your bill.');
        } catch (err) {
          Notify.error('Storage full! Delete old data before uploading.');
        }
      };
      imgObj.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  removeLogo() {
    localStorage.removeItem('shopapp_logo_base64');
    const img = document.getElementById('logo-preview-img');
    const icon = document.getElementById('logo-placeholder-icon');
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (icon) icon.style.display = '';
    Notify.info('Shop logo removed');
  },

  savePreferences() {
    const cEl = document.getElementById('set-currency');
    const currency = (cEl && cEl.value) || '₹';
    const gEl = document.getElementById('set-gst');
    const gst = (gEl && gEl.value) || '';
    localStorage.setItem('shopapp_currency', currency);
    localStorage.setItem('shopapp_gst', gst);
    Notify.success('Preferences saved!');
  },

  switchSection(id) {
    document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === id));
    document.querySelectorAll('.settings-section').forEach(el => el.classList.toggle('active', el.id === 'settings-' + id));
  },

  exportBackup() {
    const backup = {
      products: DB.get('products'),
      bills: DB.get('bills'),
      customers: DB.get('customers'),
      transactions: DB.get('transactions'),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'electroshop_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(url);
    Notify.success('Backup downloaded!');
  },

  importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.products) DB.set('products', data.products);
        if (data.bills) DB.set('bills', data.bills);
        if (data.customers) DB.set('customers', data.customers);
        if (data.transactions) DB.set('transactions', data.transactions);
        Notify.success('Backup restored! Reloading...');
        setTimeout(() => window.location.reload(), 1500);
      } catch(e) { Notify.error('Invalid backup file'); }
    };
    reader.readAsText(file);
  },

  clearData() {
    if (!confirm('⚠️ This will delete ALL data permanently. Continue?')) return;
    ['products','bills','customers','transactions'].forEach(c => DB.clear(c));
    Notify.success('All data cleared. Reloading...');
    setTimeout(() => window.location.reload(), 1500);
  }
};
