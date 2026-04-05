// ===== BILLING / POS MODULE (GST Invoice) =====
const Billing = {
  cart: [],
  customer: { name: '', mobile: '', address: '', gstin: '', isNew: false },

  init() {
    this.cart = [];
    this.populatePOSCategoryFilter();
    this.renderProductList();
    this.renderCustomerSearchList();
    this.renderBillHistory();
    this.updateCart();
    this.updateCustomerDisplay();
  },

  // ===== CUSTOMER =====
  renderCustomerSearchList() {
    const list = document.getElementById('customer-search-list');
    if (!list) return;
    const customers = DB.get('customers');
    list.innerHTML = customers.map(c => `<option value="${Utils.escapeHtml(c.name)} - ${Utils.escapeHtml(c.mobile || c.phone || 'No Mobile')}" data-id="${c.id}"></option>`).join('');
  },

  onCustomerSearchInput() {
    const val = document.getElementById('bill-customer-search').value;
    const list = document.getElementById('customer-search-list');
    if (!list) return;

    // Find if exact match exists in the datalist options
    const option = Array.from(list.options).find(opt => opt.value === val);
    if (option) {
      const id = option.getAttribute('data-id');
      const c = DB.findOne('customers', x => x.id === id);
      if (c) {
        this.customer = { id: c.id, name: c.name, mobile: c.mobile || c.phone || '', address: c.address || '', gstin: c.gstin || '', isNew: false };
        document.getElementById('bill-customer-id').value = c.id;
        document.getElementById('bill-cust-name').value = c.name;
        document.getElementById('bill-cust-mobile').value = c.mobile || c.phone || '';
        document.getElementById('bill-cust-address').value = c.address || '';
        document.getElementById('bill-cust-gstin').value = c.gstin || '';
      }
    } else {
      // Clear tracking id, means manual entry
      document.getElementById('bill-customer-id').value = '';
      this.customer.id = '';
      
      // If user clears the search completely, clear the fields too
      if (!val.trim()) {
        document.getElementById('bill-cust-name').value = '';
        document.getElementById('bill-cust-mobile').value = '';
        document.getElementById('bill-cust-address').value = '';
        document.getElementById('bill-cust-gstin').value = '';
      }
    }
    this.updateCustomerDisplay();
  },

  updateCustomerDisplay() {
    const nEl = document.getElementById('bill-cust-name');
    this.customer.name = (nEl && nEl.value.trim()) || 'Walk-in Customer';
    const mEl = document.getElementById('bill-cust-mobile');
    this.customer.mobile = (mEl && mEl.value.trim()) || '';
    const aEl = document.getElementById('bill-cust-address');
    this.customer.address = (aEl && aEl.value.trim()) || '';
    const gEl = document.getElementById('bill-cust-gstin');
    this.customer.gstin = (gEl && gEl.value.trim()) || '';
  },

  autoSaveCustomerInfo() {
    const name = this.customer.name;
    const mobile = this.customer.mobile;
    const address = this.customer.address;
    const gstin = this.customer.gstin;

    if (!name || name === 'Walk-in Customer') return ''; // Don't save empty walk-ins

    let existing = null;
    if (this.customer.id) {
      existing = DB.findOne('customers', c => c.id === this.customer.id);
    } else if (mobile) {
      existing = DB.findOne('customers', c => c.mobile === mobile && c.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
         existing = DB.findOne('customers', c => c.mobile === mobile);
      }
    }

    if (!existing) {
      existing = DB.add('customers', { name, mobile, phone: mobile, address, gstin, udhar: 0, totalPurchases: 0 });
    } else {
      DB.update('customers', existing.id, { 
        name: name,
        address: address || existing.address,
        gstin: gstin || existing.gstin
      });
    }

    this.customer.id = existing.id;
    this.renderCustomerSearchList();
    return existing.id;
  },

  // ===== PRODUCTS =====
  renderProductList() {
    const el = document.getElementById('pos-products');
    if (!el) return;
    const products = DB.get('products');
    const sEl = document.getElementById('pos-search');
    const q = (sEl && sEl.value && sEl.value.toLowerCase()) || '';
    const cEl = document.getElementById('pos-category-filter');
    const catF = (cEl && cEl.value) || '';
    const filtered = products.filter(p => {
      const avail = (p.serialNumbers || []).filter(s => !s.sold).length || p.quantity || 0;
      if (avail <= 0) return false;
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.model||'').toLowerCase().includes(q);
      const matchCat = !catF || p.category === catF;
      return matchQ && matchCat;
    });

    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state" style="padding:30px 14px"><i class="ri-tv-2-line"></i><h3>No products available</h3><p>Add products in Inventory first</p></div>`;
      return;
    }

    el.innerHTML = filtered.map(p => {
      const avail = (p.serialNumbers || []).filter(s => !s.sold).length || p.quantity || 0;
      return `<div onclick="Billing.addToCart('${p.id}')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer;transition:all .18s;background:var(--card-bg);margin-bottom:8px" onmouseover="this.style.borderColor='var(--accent)';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
        <div style="width:42px;height:42px;border-radius:10px;background:var(--gradient-soft);display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:var(--accent);flex-shrink:0"><i class="ri-tv-2-line"></i></div>
        <div style="flex:1;min-width:0">
          <div class="fw-600" style="font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(p.name)}</div>
          <div style="font-size:.72rem;color:var(--text2)">Model: ${p.model||'-'} &nbsp;·&nbsp; ${avail} available</div>
        </div>
        <div class="fw-700" style="color:var(--accent);white-space:nowrap;font-size:.9rem">${Utils.formatCurrency(p.price)}</div>
      </div>`;
    }).join('');
  },

  populatePOSCategoryFilter() {
    const sel = document.getElementById('pos-category-filter');
    if (!sel) return;
    const cats = [...new Set(DB.get('products').map(p => p.category).filter(Boolean))];
    sel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  addToCart(productId) {
    const p = DB.findOne('products', x => x.id === productId);
    if (!p) return;
    const availSNs = (p.serialNumbers || []).filter(s => !s.sold);
    const hasSNs = availSNs.length > 0;

    if (hasSNs) {
      // Show SN selection modal
      this._pendingProductId = productId;
      this.showSNPicker(p, availSNs);
    } else {
      // No SNs, just add directly
      if (!p.quantity || p.quantity <= 0) { Notify.warning('Out of stock!'); return; }
      const existing = this.cart.find(i => i.productId === productId && !i.sn);
      if (existing) { existing.qty++; existing.total = existing.qty * existing.price; }
      else { this.cart.push({ productId, name: p.name, model: p.model||'', category: p.category||'', qty: 1, price: p.price, total: p.price, sn: '' }); }
      this.updateCart();
      Notify.success(p.name + ' added', 1200);
    }
  },

  showSNPicker(p, availSNs) {
    const modal = document.getElementById('sn-picker-modal');
    document.getElementById('sn-picker-title').textContent = p.name + (p.model ? ` — Model: ${p.model}` : '');
    document.getElementById('sn-picker-list').innerHTML = availSNs.map(s => `
      <div onclick="Billing.selectSN('${p.id}','${s.sn.replace(/'/g,'\\\'')}')" style="display:flex;align-items:center;gap:12px;padding:13px 16px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer;transition:all .15s;background:var(--bg3)" onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--gradient-soft)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg3)'">
        <i class="ri-barcode-line" style="font-size:1.3rem;color:var(--accent)"></i>
        <div>
          <div class="fw-600" style="font-size:.9rem">${Utils.escapeHtml(s.sn)}</div>
          <div style="font-size:.75rem;color:var(--success)">✓ Available</div>
        </div>
        <i class="ri-arrow-right-line" style="margin-left:auto;color:var(--text3)"></i>
      </div>
    `).join('');
    modal.classList.add('open');
  },

  selectSN(productId, sn) {
    const p = DB.findOne('products', x => x.id === productId);
    if (!p) return;
    const existing = this.cart.find(i => i.sn === sn);
    if (existing) { Notify.warning('This serial number is already in cart'); return; }
    this.cart.push({ productId, name: p.name, model: p.model||'', category: p.category||'', qty: 1, price: p.price, total: p.price, sn });
    document.getElementById('sn-picker-modal').classList.remove('open');
    this.updateCart();
    Notify.success(`Added: SN ${sn}`, 1500);
  },

  updateCart() {
    const el = document.getElementById('cart-items');
    const countEl = document.getElementById('cart-count');
    if (!el) return;

    if (!this.cart.length) {
      el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text2)">
        <i class="ri-shopping-cart-line" style="font-size:2.5rem;color:var(--text3);display:block;margin-bottom:10px"></i>
        <div style="font-size:.875rem">Cart is empty<br/>Click a product to add</div>
      </div>`;
    } else {
      el.innerHTML = this.cart.map((item, i) => `
        <div class="cart-item-row">
          <div style="flex:1;min-width:0">
            <div style="font-size:.825rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(item.name)}</div>
            <div style="font-size:.72rem;color:var(--text2)">${item.model ? `Model: ${item.model}` : ''}${item.sn ? ` · SN: ${item.sn}` : ''}</div>
            <div style="font-size:.75rem;color:var(--text2)">${Utils.formatCurrency(item.price)} each</div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
            ${item.sn ? `<span class="badge badge-blue" style="font-size:.68rem">1 unit</span>` : `
              <button class="qty-btn" onclick="Billing.changeQty(${i},-1)"><i class="ri-subtract-line"></i></button>
              <span class="qty-input" style="display:flex;align-items:center;justify-content:center">${item.qty}</span>
              <button class="qty-btn" onclick="Billing.changeQty(${i},1)"><i class="ri-add-line"></i></button>
            `}
          </div>
          <div style="font-weight:700;color:var(--accent);min-width:70px;text-align:right">${Utils.formatCurrency(item.total)}</div>
          <button onclick="Billing.removeFromCart(${i})" style="color:var(--danger);font-size:1rem;margin-left:4px"><i class="ri-delete-bin-line"></i></button>
        </div>
      `).join('');
    }

    const subtotal = this.cart.reduce((s, i) => s + i.total, 0);
    const dAmtEl = document.getElementById('bill-discount-amt');
    const discountAmt = parseFloat(dAmtEl && dAmtEl.value) || 0;
    const dPctEl = document.getElementById('bill-discount-pct');
    const discountPct = parseFloat(dPctEl && dPctEl.value) || 0;
    const tEl = document.getElementById('bill-tax');
    const taxPct = parseFloat(tEl && tEl.value) || 0;
    const discountFromPct = subtotal * discountPct / 100;
    const totalDiscount = discountAmt + discountFromPct;
    const afterDiscount = subtotal - totalDiscount;
    const tax = afterDiscount * taxPct / 100;
    const total = afterDiscount + tax;
    const totalQty = this.cart.reduce((s, i) => s + i.qty, 0);

    document.getElementById('cart-subtotal').textContent = Utils.formatCurrency(subtotal);
    document.getElementById('cart-discount-val').textContent = totalDiscount > 0 ? `-${Utils.formatCurrency(totalDiscount)}` : '₹0.00';
    document.getElementById('cart-tax-val').textContent = Utils.formatCurrency(tax);
    document.getElementById('cart-total').textContent = Utils.formatCurrency(total);
    if (countEl) countEl.textContent = totalQty;

    return { subtotal, totalDiscount, tax, total, taxPct, totalQty };
  },

  changeQty(idx, delta) {
    const item = this.cart[idx];
    if (!item || item.sn) return;
    const newQty = item.qty + delta;
    if (newQty < 1) { this.removeFromCart(idx); return; }
    item.qty = newQty;
    item.total = item.qty * item.price;
    this.updateCart();
  },

  removeFromCart(idx) { this.cart.splice(idx, 1); this.updateCart(); },
  clearCart() { this.cart = []; this.updateCart(); },

  saveBill(status = 'paid') {
    if (!this.cart.length) { Notify.warning('Cart is empty!'); return; }
    this.updateCustomerDisplay();
    const custId = this.autoSaveCustomerInfo(); // Auto-dedupe/save here
    const custName = this.customer.name || 'Walk-in Customer';
    const vals = this.updateCart();
    const subtotal = this.cart.reduce((s, i) => s + i.total, 0);
    const dAmtEl = document.getElementById('bill-discount-amt');
    const discountAmt = parseFloat(dAmtEl && dAmtEl.value) || 0;
    const dPctEl = document.getElementById('bill-discount-pct');
    const discountPct = parseFloat(dPctEl && dPctEl.value) || 0;
    const tEl = document.getElementById('bill-tax');
    const taxPct = parseFloat(tEl && tEl.value) || 0;
    const discountFromPct = subtotal * discountPct / 100;
    const totalDiscount = discountAmt + discountFromPct;
    const afterDiscount = subtotal - totalDiscount;
    const tax = afterDiscount * taxPct / 100;
    const total = afterDiscount + tax;
    const notes = document.getElementById('bill-notes')?.value || '';

    const bill = DB.add('bills', {
      billNumber: Utils.generateBillNumber(),
      customerId: custId || '',
      customerName: custName,
      customerMobile: this.customer.mobile,
      customerAddress: this.customer.address,
      customerGstin: this.customer.gstin,
      items: this.cart.map(i => ({ ...i })),
      subtotal, totalDiscount, discountAmt, discountPct,
      taxPct, tax, total,
      totalQty: this.cart.reduce((s, i) => s + i.qty, 0),
      status, notes
    });

    // Mark SNs as sold
    this.cart.forEach(item => {
      if (item.sn) {
        const p = DB.findOne('products', x => x.id === item.productId);
        if (p) {
          const sns = p.serialNumbers || [];
          const snObj = sns.find(s => s.sn === item.sn);
          if (snObj) { snObj.sold = true; snObj.billNumber = bill.billNumber; snObj.soldAt = new Date().toISOString(); }
          DB.update('products', item.productId, { serialNumbers: sns, quantity: sns.filter(s => !s.sold).length });
        }
      } else {
        const p = DB.findOne('products', x => x.id === item.productId);
        if (p) DB.update('products', item.productId, { quantity: Math.max(0, p.quantity - item.qty) });
      }
    });

    // Update customer udhar
    if (this.customer.id && status === 'unpaid') {
      const c = DB.findOne('customers', x => x.id === this.customer.id);
      if (c) DB.update('customers', c.id, { udhar: (c.udhar||0) + total, totalPurchases: (c.totalPurchases||0) + total });
    } else if (this.customer.id) {
      const c = DB.findOne('customers', x => x.id === this.customer.id);
      if (c) DB.update('customers', c.id, { totalPurchases: (c.totalPurchases||0) + total });
    }

    DB.add('transactions', { type: 'sale', amount: total, description: `Bill ${bill.billNumber}`, date: new Date().toISOString() });

    Notify.success(`Bill ${bill.billNumber} saved!`);
    this.clearCart();
    this.renderProductList();
    this.renderBillHistory();
    Dashboard.renderKPIs();
    Dashboard.renderActivity();
    Dashboard.renderLowStockAlert();
    Inventory.load();

    // Download PDF
    this.downloadGSTPDF(bill);

    // Show WhatsApp option
    if (this.customer.mobile) {
      setTimeout(() => {
        const send = confirm(`Send WhatsApp message to ${custName} (${this.customer.mobile})?`);
        if (send) this.sendWhatsApp(bill);
      }, 800);
    }
  },

  sendWhatsApp(bill) {
    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const shopName = session.shop || 'Our Shop';
    const msg = `*${shopName}*\n*GST TAX INVOICE*\n\n`
      + `Bill No: *${bill.billNumber}*\nDate: ${Utils.formatDate(bill.createdAt)}\n\n`
      + `Dear *${bill.customerName}*,\nThank you for your purchase!\n\n`
      + `*Items Purchased:*\n`
      + bill.items.map((i, idx) => `${idx+1}. ${i.name}${i.model ? ` (${i.model})` : ''}${i.sn ? `\n   SN: ${i.sn}` : ''}\n   Qty: ${i.qty} × ₹${i.price.toLocaleString('en-IN')} = *₹${i.total.toLocaleString('en-IN')}*`).join('\n')
      + `\n\n${bill.totalDiscount > 0 ? `Cash Discount: -₹${bill.totalDiscount.toLocaleString('en-IN')}\n` : ''}`
      + `*Total Amount: ₹${bill.total.toLocaleString('en-IN')}*\n\n`
      + `_Thank you for shopping with us!_`;

    const phone = (bill.customerMobile && bill.customerMobile.replace(/\D/g,'')) || '';
    const intlPhone = phone.startsWith('91') ? phone : (phone.length === 10 ? '91' + phone : phone);
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  },

  renderBillHistory() {
    const el = document.getElementById('bill-history-body');
    if (!el) return;
    
    let bills = DB.get('bills').reverse();
    
    // Parse filters
    const qEl = document.getElementById('bill-search');
    const q = (qEl && qEl.value && qEl.value.toLowerCase()) || '';
    const dateFrom = document.getElementById('bill-date-from')?.value;
    const dateTo = document.getElementById('bill-date-to')?.value;

    bills = bills.filter(b => {
      // 1. Text Search: Bill No, Name, Phone, or Amount
      if (q) {
        const amtStr = b.total.toString();
        const matchesQuery = b.billNumber.toLowerCase().includes(q) 
                          || b.customerName.toLowerCase().includes(q) 
                          || (b.customerMobile||'').includes(q) 
                          || amtStr.includes(q);
        if (!matchesQuery) return false;
      }
      
      // 2. Date From
      const bDate = new Date(b.createdAt).toISOString().split('T')[0];
      if (dateFrom && bDate < dateFrom) return false;
      
      // 3. Date To
      if (dateTo && bDate > dateTo) return false;
      
      return true;
    });

    if (!bills.length) {
      el.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ri-receipt-line"></i><h3>No bills yet</h3></div></td></tr>`;
      return;
    }
    
    el.innerHTML = bills.map(b => `
      <tr>
        <td><span class="fw-600" style="color:var(--accent)">${b.billNumber}</span></td>
        <td><div class="fw-600" style="font-size:.875rem">${Utils.escapeHtml(b.customerName)}</div><div style="font-size:.75rem;color:var(--text2)">${b.customerMobile||''}</div></td>
        <td>${b.items.length} item(s)</td>
        <td class="fw-600">${Utils.formatCurrency(b.total)}</td>
        <td><span class="badge ${b.status==='paid'?'badge-green':'badge-orange'}">${b.status}</span></td>
        <td>${Utils.formatDateTime(b.createdAt)}</td>
        <td><div style="display:flex;gap:6px">
          <button class="btn-icon btn" onclick="Billing.downloadGSTPDF(null,'${b.id}')" title="PDF"><i class="ri-file-pdf-line"></i></button>
          <button class="btn-icon btn" onclick="Billing.viewBill('${b.id}')" title="View"><i class="ri-eye-line"></i></button>
          <button class="btn-icon btn" onclick="Billing.sendWhatsAppById('${b.id}')" title="WhatsApp" style="color:#25D366;border-color:rgba(37,211,102,.3)"><i class="ri-whatsapp-line"></i></button>
        </div></td>
      </tr>
    `).join('');
  },

  exportBillExcel() {
    // Collect the exact filtered list currently displayed
    const qEl = document.getElementById('bill-search');
    const q = (qEl && qEl.value && qEl.value.toLowerCase()) || '';
    const dateFrom = document.getElementById('bill-date-from')?.value;
    const dateTo = document.getElementById('bill-date-to')?.value;

    let bills = DB.get('bills').reverse();
    bills = bills.filter(b => {
      if (q) {
        const amtStr = b.total.toString();
        const matchesQuery = b.billNumber.toLowerCase().includes(q) 
                          || b.customerName.toLowerCase().includes(q) 
                          || (b.customerMobile||'').includes(q) 
                          || amtStr.includes(q);
        if (!matchesQuery) return false;
      }
      const bDate = new Date(b.createdAt).toISOString().split('T')[0];
      if (dateFrom && bDate < dateFrom) return false;
      if (dateTo && bDate > dateTo) return false;
      return true;
    });

    if (!bills.length) { Notify.warning('No bills to export'); return; }

    const data = bills.map(b => {
      const itemsList = b.items.map(i => `${i.name} (Qty: ${i.qty})`).join(', ');
      return { 
        'Bill No': b.billNumber, 
        'Date': Utils.formatDateTime(b.createdAt), 
        'Customer': b.customerName, 
        'Phone': b.customerMobile || '',
        'Amount': b.total,
        'Status': b.status,
        'Items': itemsList
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bills History');
    XLSX.writeFile(wb, 'billing_history.xlsx');
    Notify.success('Billing History exported!');
  },

  sendWhatsAppById(id) {
    const bill = DB.findOne('bills', b => b.id === id);
    if (bill) this.sendWhatsApp(bill);
  },

  // ===== GST PDF (Matching screenshot format) =====
  downloadGSTPDF(bill, id) {
    if (!bill && id) bill = DB.findOne('bills', b => b.id === id);
    if (!bill) return;

    const session = JSON.parse(localStorage.getItem('shopapp_session') || '{}');
    const qrData = localStorage.getItem('shopapp_qr_base64');
    const shopAddr = localStorage.getItem('shopapp_address') || '';
    const shopState = localStorage.getItem('shopapp_state') || '';
    const bankName = localStorage.getItem('shopapp_bank') || 'N/A';
    const bankAcc = localStorage.getItem('shopapp_bank_acc') || '';
    const bankIfsc = localStorage.getItem('shopapp_bank_ifsc') || '';
    const terms = localStorage.getItem('shopapp_terms') || 'All disputes subject to local jurisdiction only. Goods once sold will not be taken back or exchanged. Warranty as per manufacturer terms.';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pW = 210, pH = 297, mg = 8;

    // Helpers
    const line = (x1,y1,x2,y2) => { doc.line(x1,y1,x2,y2); };
    const rect = (x,y,w,h) => { doc.rect(x,y,w,h); };

    doc.setLineWidth(0.6);
    doc.setDrawColor(0, 0, 0);
    rect(mg, mg, pW-2*mg, pH-2*mg); // thick outer border

    // ---- e-Invoice header row ----
    let y = mg + 5;
    doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text('e-Invoice', mg+2, y);
    doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('GST TAX INVOICE', pW/2, y, {align:'center'});
    doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text('(ORIGINAL FOR RECIPIENT)', pW-mg-2, y, {align:'right'});
    line(mg, y+2, pW-mg, y+2);

    // ---- Shop info (left) | Invoice details (right) ----
    y += 5;
    const midX = mg + (pW-2*mg)*0.56;
    const infoH = 38;

    // Shop name (with Logo if available)
    const logoData = localStorage.getItem('shopapp_logo_base64');
    let textX = mg + 3;
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', mg+3, y+2, 22, 22); textX += 28; } catch(e) {}
    }
    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.text((session.shop||'SHOP NAME').toUpperCase(), textX, y+6);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    if (shopAddr) doc.text(shopAddr, textX, y+13);
    doc.text(`MOB: ${session.phone||''}`, textX, y+17);
    doc.text(`GSTIN/UIN: ${localStorage.getItem('shopapp_gst')||''}`, textX, y+23);
    if (shopState) doc.text(`State Name: ${shopState}`, textX, y+29);

    // Vertical divider
    line(midX, y-2, midX, y+infoH);

    // Right: Invoice No / Dated
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    doc.text('Invoice No.', midX+2, y+4); doc.text('Dated', midX+44, y+4);
    line(midX, y+5, pW-mg, y+5);
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text(bill.billNumber, midX+2, y+10); doc.text(Utils.formatDateShort(bill.createdAt), midX+44, y+10);
    line(midX, y+12, pW-mg, y+12);

    doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    doc.text('Delivery Note', midX+2, y+17); doc.text('Other References', midX+44, y+17);
    line(midX, y+19, pW-mg, y+19);

    doc.text("Buyer's Order No.", midX+2, y+24); doc.text('Dated', midX+44, y+24);
    line(midX, y+26, pW-mg, y+26);

    doc.text('Terms of Payment', midX+2, y+31);
    line(midX, y+33, pW-mg, y+33);

    y += infoH + 1;
    line(mg, y, pW-mg, y);

    // ---- Buyer ----
    y += 1;
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    doc.text('Buyer (Bill to)', mg+2, y+4);
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(bill.customerName.toUpperCase(), mg+2, y+10);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    if (bill.customerAddress) doc.text(bill.customerAddress, mg+2, y+16, {maxWidth: midX-mg-4});
    doc.text(`Mob: ${bill.customerMobile||''}`, mg+2, y+22);
    if (bill.customerGstin) doc.text(`GSTIN: ${bill.customerGstin}`, mg+2, y+28);

    y += 33;
    line(mg, y, pW-mg, y);

    // ---- Table Header ----
    y += 1;
    const cols = { si: mg, desc: mg+10, unit: pW-mg-50, rate: pW-mg-32, amt: pW-mg-18 };

    doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.text('Sl\nNo.', mg+2, y+3);
    doc.text('Description of Goods', cols.desc+2, y+5);
    doc.text('Unit', cols.unit+2, y+5);
    doc.text('Rate', cols.rate+2, y+5);
    doc.text('Amount', pW-mg-2, y+5, {align:'right'});

    // Col lines
    line(cols.unit, y, cols.unit, y+8);
    line(cols.rate, y, cols.rate, y+8);
    line(cols.amt, y, cols.amt, y+8);
    line(cols.desc, y, cols.desc, y+8);

    y += 8;
    line(mg, y, pW-mg, y);

    // ---- Items ----
    const rowH = 14;
    bill.items.forEach((item, idx) => {
      const desc2 = `SN: ${item.sn||'-'} | Model: ${item.model||'-'}`;
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
      doc.text(String(idx+1), mg+3, y+5);
      doc.text(item.name, cols.desc+2, y+5);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
      doc.text(desc2, cols.desc+2, y+10, {maxWidth: cols.unit-cols.desc-4});
      doc.text(`${item.qty} UNIT${item.qty>1?'S':''}`, cols.unit+2, y+5);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
      doc.text(item.price.toLocaleString('en-IN'), cols.rate+2, y+5);
      doc.setFont('helvetica','bold');
      doc.text(item.total.toLocaleString('en-IN'), pW-mg-2, y+5, {align:'right'});

      line(cols.desc, y, cols.desc, y+rowH);
      line(cols.unit, y, cols.unit, y+rowH);
      line(cols.rate, y, cols.rate, y+rowH);
      line(cols.amt, y, cols.amt, y+rowH);
      y += rowH;
      line(mg, y, pW-mg, y);
    });

    // Blank space
    const blankRows = Math.max(0, 4 - bill.items.length);
    for (let i = 0; i < blankRows; i++) {
      line(cols.desc, y, cols.desc, y+10); line(cols.unit, y, cols.unit, y+10);
      line(cols.rate, y, cols.rate, y+10); line(cols.amt, y, cols.amt, y+10);
      y += 10; line(mg, y, pW-mg, y);
    }

    // ---- Discount ----
    if (bill.totalDiscount > 0) {
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(200,0,0);
      doc.text('CASH DISCOUNT / REBATE', cols.amt-4, y+6, {align:'right'});
      doc.text('-' + bill.totalDiscount.toLocaleString('en-IN'), pW-mg-2, y+6, {align:'right'});
      doc.setTextColor(0,0,0);
      y += 10; line(mg, y, pW-mg, y);
    }

    // ---- Total ----
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text('Total Amount', cols.unit-4, y+6, {align:'right'});
    doc.text(`${bill.totalQty||bill.items.length} UNITS`, cols.unit+2, y+6);
    doc.text(bill.total.toLocaleString('en-IN'), pW-mg-2, y+6, {align:'right'});
    y += 10; line(mg, y, pW-mg, y);

    // ---- Amount in words ----
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    doc.text('Amount Chargeable (in words)', mg+2, y+4);
    doc.setFont('helvetica','italic'); doc.setFontSize(9);
    doc.text(Utils.numToWords(Math.round(bill.total)), mg+2, y+10);
    y += 15; line(mg, y, pW-mg, y);

    // ---- Bottom section: Bank + Signature ----
    const botMidX = mg + (pW-2*mg) * 0.55;
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text('Remarks: TAX INVOICE', mg+2, y+5);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.text('Bank Details:', mg+2, y+11);
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    doc.text(`Bank Name: ${bankName}`, mg+2, y+17);
    if (bankAcc) doc.text(`A/c No: ${bankAcc}`, mg+2, y+23);
    if (bankIfsc) doc.text(`IFSC: ${bankIfsc}`, mg+2, y+29);

    // Signature side
    line(botMidX, y, botMidX, y+36);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text('Customer Signature:', botMidX+3, y+5);
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    doc.text(`for ${(session.shop||'SHOP').toUpperCase()}`, pW-mg-3, y+32, {align:'right'});
    y += 36; line(mg, y, pW-mg, y);

    // ---- QR Code + Terms ----
    const qrY = y;
    if (qrData) {
      try {
        doc.addImage(qrData, 'PNG', mg+3, qrY+3, 25, 25);
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text('Scan to Pay', mg+7, qrY+30);
      } catch(e) {}
    }
    line(botMidX, qrY, botMidX, qrY+35);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.text('Terms & Conditions:', botMidX+3, qrY+4);
    doc.setFont('helvetica','normal'); doc.setFontSize(7);
    doc.text(terms, botMidX+3, qrY+9, {maxWidth: pW-mg-botMidX-4});
    y = Math.max(y, qrY) + 36;
    line(mg, y, pW-mg, y);

    // Save
    doc.save(`${bill.billNumber}.pdf`);
    Notify.success('GST Invoice downloaded!');
  },

  viewBill(id) {
    const bill = DB.findOne('bills', b => b.id === id);
    if (!bill) return;
    const el = document.getElementById('bill-view-content');
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:18px">
        <div style="font-size:1.3rem;font-weight:800;font-family:'Space Grotesk',sans-serif;color:var(--accent)">${bill.billNumber}</div>
        <div style="font-size:.8rem;color:var(--text2)">${Utils.formatDateTime(bill.createdAt)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div style="background:var(--bg3);padding:12px;border-radius:var(--r-sm)">
          <div style="font-size:.7rem;font-weight:700;color:var(--text2);margin-bottom:6px">CUSTOMER</div>
          <div class="fw-600">${bill.customerName}</div>
          <div style="font-size:.8rem;color:var(--text2)">${bill.customerMobile||''}</div>
          <div style="font-size:.8rem;color:var(--text2)">${bill.customerAddress||''}</div>
        </div>
        <div style="background:var(--bg3);padding:12px;border-radius:var(--r-sm)">
          <div style="font-size:.7rem;font-weight:700;color:var(--text2);margin-bottom:6px">INVOICE INFO</div>
          <div class="fw-600">Status: <span class="badge ${bill.status==='paid'?'badge-green':'badge-orange'}">${bill.status}</span></div>
          <div style="margin-top:8px;font-size:.875rem">Total: <strong style="color:var(--accent)">${Utils.formatCurrency(bill.total)}</strong></div>
        </div>
      </div>
      <table class="data-table">
        <thead><tr><th>#</th><th>Product</th><th>SN / Model</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${bill.items.map((it,i) => `<tr>
          <td>${i+1}</td><td class="fw-600">${Utils.escapeHtml(it.name)}</td>
          <td style="font-size:.78rem;color:var(--text2)">${it.sn?`SN: ${it.sn}`:'-'}${it.model?`<br>Model: ${it.model}`:''}</td>
          <td>${it.qty}</td>
          <td>${Utils.formatCurrency(it.price)}</td>
          <td class="fw-600">${Utils.formatCurrency(it.total)}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div style="text-align:right;padding-top:12px;border-top:1px solid var(--border);margin-top:8px">
        <div style="font-size:.875rem;color:var(--text2);margin-bottom:3px">Subtotal: ${Utils.formatCurrency(bill.subtotal)}</div>
        ${bill.totalDiscount>0?`<div style="font-size:.875rem;color:var(--danger);margin-bottom:3px">Discount: -${Utils.formatCurrency(bill.totalDiscount)}</div>`:''}
        <div style="font-size:.875rem;color:var(--text2);margin-bottom:6px">Tax: ${Utils.formatCurrency(bill.tax)}</div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--accent)">Total: ${Utils.formatCurrency(bill.total)}</div>
        <div style="font-size:.75rem;color:var(--text2);margin-top:4px;font-style:italic">${Utils.numToWords(Math.round(bill.total))}</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-primary" onclick="Billing.downloadGSTPDF(null,'${bill.id}')"><i class="ri-file-pdf-line"></i> Download PDF</button>
        <button class="btn" style="background:#25D366;color:#fff" onclick="Billing.sendWhatsAppById('${bill.id}')"><i class="ri-whatsapp-line"></i> Send WhatsApp</button>
      </div>
    `;
    document.getElementById('bill-view-modal').classList.add('open');
  }
};
