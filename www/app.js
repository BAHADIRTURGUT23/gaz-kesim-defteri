(function () {
  'use strict';

  var A = window.AYARLAR || {};
  var cfg = window.FIREBASE_CONFIG || {};
  var app = document.getElementById('app');
  var overlay = document.getElementById('overlay');
  var EMAIL_DOM = '@acil.gazkesim.invalid';
  var SHIFTS = ['Gündüz (08–16)', 'Akşam (16–24)', 'Gece (00–08)'];
  var DEFAULT_TEAM = ['Yusuf Yılmaz', 'Murat Uzun', 'Faruk Yılmaz', 'Eren Gül', 'Ahmet Şahin Demir', 'Mehmet Hanifi Ayçiçek', 'Bedirhan Özer', 'Abdülkadir Yılmaz', '', ''];
  var ICON_CUT = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  var auth = null, fs = null, user = null, profile = null, isAdmin = false;
  var authReady = false, got = { p: false, a: false, e: false };
  var rows = [], roster = [], members = [], rowsErr = false;
  var unsubs = [], rowsUnsub = null, memUnsub = null;
  var photoCache = {}, draft = { kes: [], ac: [] };
  var screen = { name: 'list' }, filter = 'all', q = '', authTab = 'login', editSlot = null, delArm = null;
  var busy = false, stale = false, toastTimer = null, rosterOpen = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(ts) { return new Date(ts).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function since(ts) {
    var m = Math.max(0, Math.floor((Date.now() - ts) / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    if (d > 0) return d + ' gün ' + h + ' sa';
    if (h > 0) return h + ' sa ' + (m % 60) + ' dk';
    return m + ' dk';
  }
  function shiftNow() { var h = new Date().getHours(); return h >= 8 && h < 16 ? 0 : h >= 16 ? 1 : 2; }
  function who(n) { return n || 'Bilinmiyor'; }
  function safeImg(d) { return typeof d === 'string' && d.indexOf('data:image/jpeg;base64,') === 0 ? d : ''; }
  function normSicil(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function normAddr(s) { return String(s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ığüşöç]/g, ''); }
  function emailOf(sicil) { return normSicil(sicil) + EMAIL_DOM; }
  function toast(msg) {
    var t = document.getElementById('toast'); if (t) t.remove();
    var el = document.createElement('div'); el.className = 'toast'; el.id = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.remove(); }, 4000);
  }
  function errMsg(e) {
    var c = (e && e.code) || '';
    var map = {
      'auth/email-already-in-use': 'Bu sicil için hesap zaten var. Giriş sekmesinden giriş yapın.',
      'auth/invalid-credential': 'Sicil numarası veya şifre hatalı.',
      'auth/wrong-password': 'Sicil numarası veya şifre hatalı.',
      'auth/user-not-found': 'Sicil numarası veya şifre hatalı.',
      'auth/invalid-email': 'Sicil numarası geçersiz. Yalnızca harf ve rakam kullanın.',
      'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
      'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz bekleyin.',
      'auth/network-request-failed': 'İnternet bağlantısı yok.',
      'auth/operation-not-allowed': 'Firebase\'de e-posta/şifre girişi açılmamış. KURULUM.md dosyasına bakın.',
      'permission-denied': 'Bu işlem için yetkiniz yok veya kod yanlış.',
      'unavailable': 'Bağlantı yok. Bağlantı gelince tekrar deneyin.',
      'resource-exhausted': 'Firebase ücretsiz kotası doldu.'
    };
    return (map[c] || 'İşlem tamamlanamadı, tekrar deneyin.') + (map[c] || !c ? '' : ' [' + c + ']');
  }
  function editing() { var a = document.activeElement; return !!(a && a !== document.body && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && app.contains(a)); }
  function refresh() { if (editing()) { stale = true; return; } draw(); }
  document.addEventListener('focusout', function () {
    setTimeout(function () { if (stale && !editing()) { stale = false; draw(); } }, 250);
  });

  // ---------- Fotoğraf ----------
  function nativeCamera() {
    var C = window.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Camera ? C.Plugins.Camera : null;
  }
  function recompress(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () {
        var max = 1000, qual = 0.6, out = '', w = im.width, h = im.height;
        function run() {
          var s = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', qual);
        }
        run();
        while (out.length > 170000 && max > 400) { max -= 150; qual = Math.max(0.45, qual - 0.05); run(); }
        res(out);
      };
      im.onerror = function () { rej(new Error('img')); };
      im.src = src;
    });
  }
  async function fileToDataUrl(file) {
    if (window.createImageBitmap) {
      try {
        var bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        return recompress(c.toDataURL('image/jpeg', 0.9));
      } catch (e) { /* aşağıdaki yola düş */ }
    }
    var url = URL.createObjectURL(file);
    try { return await recompress(url); } finally { URL.revokeObjectURL(url); }
  }
  function pickFile(source) {
    return new Promise(function (res) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      if (source === 'cam') inp.setAttribute('capture', 'environment');
      inp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(inp);
      var done = false;
      function finish(f) { if (done) return; done = true; res(f); setTimeout(function () { inp.remove(); }, 1000); }
      inp.onchange = function () { finish(inp.files && inp.files[0] ? inp.files[0] : null); };
      inp.addEventListener('cancel', function () { finish(null); });
      inp.click();
    });
  }
  async function addPhoto(stage, source) {
    if (draft[stage].length >= 3) { toast('En fazla 3 fotoğraf eklenir.'); return; }
    try {
      var cam = nativeCamera(), url = '';
      if (cam) {
        var p = await cam.getPhoto({ quality: 70, width: 1400, resultType: 'dataUrl', source: source === 'cam' ? 'CAMERA' : 'PHOTOS', correctOrientation: true });
        url = await recompress(p.dataUrl);
      } else {
        var f = await pickFile(source); if (!f) return;
        url = await fileToDataUrl(f);
      }
      draft[stage].push(url); refreshPrev(stage);
    } catch (e) {
      var m = String((e && e.message) || e || '');
      if (/cancel|dismiss|User cancelled/i.test(m)) return;
      toast('Fotoğraf alınamadı. Kamera iznini kontrol edin.');
    }
  }
  function pickerHtml(stage) {
    return '<div><label>Fotoğraf (en fazla 3)</label><div class="acts"><button type="button" class="btn" data-cam="' + stage + '">Fotoğraf çek</button>' +
      '<button type="button" class="btn" data-gal="' + stage + '">Galeriden seç</button></div>' +
      '<div id="prev-' + stage + '" style="margin-top:8px">' + photosHtml(draft[stage], true, stage) + '</div></div>';
  }
  function bindPicker(stage) {
    var c = app.querySelector('[data-cam="' + stage + '"]'), g = app.querySelector('[data-gal="' + stage + '"]');
    if (c) c.onclick = function () { addPhoto(stage, 'cam'); };
    if (g) g.onclick = function () { addPhoto(stage, 'gal'); };
    refreshPrev(stage);
  }
  function photosHtml(arr, removable, stage) {
    if (!arr.length) return '';
    return '<div class="photos">' + arr.map(function (d, i) {
      var s = safeImg(d); if (!s) return '';
      return removable
        ? '<button type="button" data-view="' + stage + ':' + i + '" aria-label="Fotoğrafı büyüt"><img src="' + s + '" alt="Seçilen fotoğraf ' + (i + 1) + '"><span class="x" data-rm="' + stage + ':' + i + '" role="button" aria-label="Fotoğrafı kaldır">×</span></button>'
        : '<button type="button" data-big="' + i + '" data-stage="' + stage + '" aria-label="Fotoğrafı büyüt"><img src="' + s + '" alt="Kayıt fotoğrafı ' + (i + 1) + '"></button>';
    }).join('') + '</div>';
  }
  function refreshPrev(stage) {
    var box = document.getElementById('prev-' + stage); if (!box) return;
    box.innerHTML = photosHtml(draft[stage], true, stage);
    box.querySelectorAll('[data-rm]').forEach(function (x) {
      x.onclick = function (ev) { ev.stopPropagation(); draft[stage].splice(+x.dataset.rm.split(':')[1], 1); refreshPrev(stage); };
    });
    box.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { showBig(draft[stage][+b.dataset.view.split(':')[1]]); }; });
  }
  function showBig(src) {
    var s = safeImg(src); if (!s) return;
    overlay.innerHTML = '<div class="lightbox" role="dialog" aria-label="Fotoğraf"><img src="' + s + '" alt="Büyük fotoğraf"></div>';
    overlay.firstChild.onclick = function () { overlay.innerHTML = ''; };
  }
  function shiftSelect(id) {
    return '<div><label for="' + id + '">Vardiya</label><select id="' + id + '">' + SHIFTS.map(function (s, i) { return '<option value="' + i + '"' + (i === shiftNow() ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>';
  }

  // ---------- Başlatma ve veri ----------
  function configured() { return cfg.apiKey && String(cfg.apiKey).indexOf('BURAYA') < 0 && cfg.projectId && String(cfg.projectId).indexOf('BURAYA') < 0; }

  function init() {
    if (!configured()) { draw(); return; }
    if (!window.firebase || !firebase.initializeApp) { app.innerHTML = '<div class="card"><h2>Firebase dosyaları yok</h2><p class="hint">"npm run build" çalıştırılmamış. KURULUM.md dosyasına bakın.</p></div>'; return; }
    firebase.initializeApp(cfg);
    auth = firebase.auth(); fs = firebase.firestore();
    try { fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
    auth.onAuthStateChanged(function (u) {
      user = u; authReady = true; stopData();
      if (u) startData(); else { profile = null; isAdmin = false; rows = []; roster = []; screen = { name: 'list' }; draw(); }
    });
  }
  function stopData() {
    unsubs.forEach(function (f) { try { f(); } catch (e) {} }); unsubs = [];
    if (rowsUnsub) { rowsUnsub(); rowsUnsub = null; }
    if (memUnsub) { memUnsub(); memUnsub = null; }
    got = { p: false, a: false, e: false }; rowsErr = false;
  }
  function startData() {
    var uid = user.uid;
    unsubs.push(fs.doc('uyeler/' + uid).onSnapshot(function (s) { profile = s.exists ? s.data() : null; got.p = true; after(); }, function () { profile = null; got.p = true; after(); }));
    unsubs.push(fs.doc('yoneticiler/' + uid).onSnapshot(function (s) { isAdmin = s.exists; got.a = true; after(); }, function () { isAdmin = false; got.a = true; after(); }));
    unsubs.push(fs.collection('ekip').onSnapshot(function (snap) {
      roster = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }).sort(function (a, b) { return (+a.sira || 0) - (+b.sira || 0); });
      got.e = true; refresh();
    }, function () { got.e = true; refresh(); }));
  }
  function after() {
    if (got.p && profile && !rowsUnsub) {
      rowsUnsub = fs.collection('kayitlar').orderBy('kesmeT', 'desc').limit(300).onSnapshot(function (snap) {
        rows = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); rowsErr = false; refresh();
      }, function () { rowsErr = true; rowsUnsub = null; refresh(); });
    }
    if (got.p && !profile && rowsUnsub) { rowsUnsub(); rowsUnsub = null; rows = []; }
    if (isAdmin && !memUnsub) {
      memUnsub = fs.collection('uyeler').onSnapshot(function (snap) { members = snap.docs.map(function (d) { var o = d.data(); o.uid = d.id; return o; }); refresh(); }, function () {});
    }
    refresh();
  }

  // ---------- Çizim ----------
  function orgHtml() {
    var t = (A.kurumAdi ? esc(A.kurumAdi) : '') + (A.kurumAdi && A.birimAdi ? ' · ' : '') + (A.birimAdi ? esc(A.birimAdi) : '');
    return t ? '<div class="org">' + t + '</div>' : '';
  }
  function header(withNav) {
    var side = '';
    if (withNav && user && profile) {
      side = '<div class="who"><strong>' + esc(profile.ad) + (isAdmin ? ' · Yönetici' : '') + '</strong><button class="btn small" id="outBtn">Çıkış</button></div>';
    }
    return '<header class="top"><div>' + orgHtml() + '<div class="eyebrow">Arıza kaynaklı gaz kesimleri</div><h1>Gaz Kesim Defteri</h1></div>' + side + '</header>';
  }
  function bindHeader() {
    var b = document.getElementById('outBtn'); if (b) b.onclick = function () { auth.signOut(); };
  }

  function draw() {
    stale = false;
    if (!configured()) return drawSetup();
    if (!authReady) { app.innerHTML = '<div class="empty"><b>Yükleniyor</b></div>'; return; }
    if (!user) return drawAuth();
    if (!(got.p && got.a)) { app.innerHTML = header(false) + '<div class="empty"><b>Yükleniyor</b>Kayıtlar getiriliyor.</div>'; return; }
    if (!profile) return drawComplete();
    if (screen.name === 'team') return drawTeam();
    if (screen.name === 'new') return drawNew();
    if (screen.name === 'direct') return drawDirect();
    if (screen.name === 'detail') return drawDetail();
    drawList();
  }

  function drawSetup() {
    app.innerHTML = header(false) + '<div class="card"><h2>Kurulum gerekli</h2><p class="hint">www/firebase-config.js dosyasındaki Firebase ayarları doldurulmamış. KURULUM.md dosyasındaki adımları izleyin.</p></div>';
  }

  function drawAuth() {
    var reg = authTab === 'register';
    app.innerHTML = header(false) +
      '<div class="card"><div class="tabs2" role="tablist"><button role="tab" data-tab="login" aria-selected="' + !reg + '">Giriş</button><button role="tab" data-tab="register" aria-selected="' + reg + '">Hesap oluştur</button></div>' +
      '<form class="stack" id="af" autocomplete="off">' +
      '<div><label for="a-sicil">Sicil numarası (kullanıcı adı)</label><input type="text" id="a-sicil" inputmode="text" autocapitalize="off" autocomplete="username" required></div>' +
      '<div><label for="a-pw">Şifre</label><input type="password" id="a-pw" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" minlength="6" required></div>' +
      (reg ? '<div><label for="a-kod">Takım kodu</label><input type="text" id="a-kod" autocapitalize="off" required placeholder="Yöneticinizden alın"></div>' +
        '<details><summary class="hint" style="cursor:pointer">Yönetici hesabı mı açıyorsunuz?</summary><div class="stack" style="margin-top:8px"><div><label for="a-yk">Yönetici kodu</label><input type="text" id="a-yk" autocapitalize="off"></div><div><label for="a-ad">Ad soyad (yalnızca yönetici hesabı)</label><input type="text" id="a-ad"></div></div></details>' : '') +
      '<button class="btn primary full" type="submit" id="asub">' + (reg ? 'Hesap oluştur' : 'Giriş yap') + '</button></form>' +
      (reg ? '<p class="hint">Sicil numaranız yönetici tarafından ekip listesine eklenmiş olmalı. Şifrenizi unutursanız yöneticinize başvurun.</p>' : '') + '</div>';
    app.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { authTab = b.dataset.tab; draw(); }; });
    document.getElementById('af').onsubmit = reg ? doRegister : doLogin;
  }
  async function doLogin(e) {
    e.preventDefault(); if (busy) return;
    var s = normSicil(document.getElementById('a-sicil').value), pw = document.getElementById('a-pw').value;
    if (!s) { toast('Sicil numarasını yazın.'); return; }
    busy = true; var b = document.getElementById('asub'); b.disabled = true;
    try { await auth.signInWithEmailAndPassword(emailOf(s), pw); } catch (err) { toast(errMsg(err)); }
    busy = false; var b2 = document.getElementById('asub'); if (b2) b2.disabled = false;
  }
  async function createProfile(sicil, kod, yk, ad) {
    var uid = auth.currentUser.uid;
    if (yk) {
      if (!ad) throw { code: 'ad-gerekli' };
      await fs.doc('uyeler/' + uid).set({ sicil: sicil, ad: ad, slot: '-', kod: kod || '', yk: yk });
      await fs.doc('yoneticiler/' + uid).set({ aktif: true });
      return;
    }
    var snap = await fs.collection('ekip').where('sicil', '==', sicil).limit(1).get();
    if (snap.empty || !snap.docs[0].data().ad) throw { code: 'sicil-yok' };
    var d = snap.docs[0];
    await fs.doc('uyeler/' + uid).set({ sicil: sicil, ad: d.data().ad, slot: d.id, kod: kod, yk: '' });
  }
  function profileErr(e) {
    if (e && e.code === 'sicil-yok') return 'Bu sicil numarası ekip listesinde yok. Yöneticinize başvurun.';
    if (e && e.code === 'ad-gerekli') return 'Yönetici hesabı için ad soyad yazın.';
    if (e && e.code === 'permission-denied') return 'Takım kodu veya yönetici kodu yanlış, ya da sicil listede yok.';
    return errMsg(e);
  }
  async function doRegister(e) {
    e.preventDefault(); if (busy) return;
    var s = normSicil(document.getElementById('a-sicil').value), pw = document.getElementById('a-pw').value;
    var kod = document.getElementById('a-kod').value.trim(), yk = document.getElementById('a-yk').value.trim(), ad = document.getElementById('a-ad').value.trim();
    if (!s) { toast('Sicil numarasını yazın.'); return; }
    busy = true; var b = document.getElementById('asub'); b.disabled = true;
    var cred = null;
    try {
      cred = await auth.createUserWithEmailAndPassword(emailOf(s), pw);
      await createProfile(s, kod, yk, ad);
      toast('Hesap oluşturuldu');
    } catch (err) {
      if (cred && cred.user) { try { await cred.user.delete(); } catch (x) {} }
      toast(cred ? profileErr(err) : errMsg(err));
    }
    busy = false; var b2 = document.getElementById('asub'); if (b2) b2.disabled = false;
  }
  function drawComplete() {
    app.innerHTML = header(false) +
      '<form class="card stack" id="cf" autocomplete="off"><h2>Kaydı tamamla</h2><p class="hint">Hesabınız var ama ekip kaydınız tamamlanmamış. Sicil numaranızı ve takım kodunu yazın.</p>' +
      '<div><label for="c-sicil">Sicil numarası</label><input type="text" id="c-sicil" autocapitalize="off" required></div>' +
      '<div><label for="c-kod">Takım kodu</label><input type="text" id="c-kod" autocapitalize="off" required></div>' +
      '<button class="btn primary full" type="submit" id="csub">Devam</button><button class="btn full" type="button" id="cout">Çıkış</button></form>';
    document.getElementById('cout').onclick = function () { auth.signOut(); };
    document.getElementById('cf').onsubmit = async function (e) {
      e.preventDefault(); if (busy) return;
      var s = normSicil(document.getElementById('c-sicil').value), kod = document.getElementById('c-kod').value.trim();
      if (emailOf(s) !== user.email) { toast('Bu sicil, giriş yaptığınız hesapla uyuşmuyor.'); return; }
      busy = true;
      try { await createProfile(s, kod, '', ''); toast('Kayıt tamamlandı'); } catch (err) { toast(profileErr(err)); }
      busy = false;
    };
  }

  // ---------- Ekip ----------
  function rosterRows() {
    var out = roster.slice(), n = out.reduce(function (m, r) { return Math.max(m, +r.sira || 0); }, 0);
    for (var i = 1; i <= Math.max(10, n); i++) { if (!out.some(function (r) { return (+r.sira) === i; })) out.push({ id: 's' + i, sira: i, ad: '', sicil: '', _bos: true }); }
    return out.sort(function (a, b) { return a.sira - b.sira; });
  }
  function rosterHtml(admin) {
    var reg = {}; members.forEach(function (m) { if (m.sicil) reg[m.sicil] = true; });
    return '<ul class="slots">' + rosterRows().map(function (s) {
      var h = '<li class="slot"><span class="no">' + s.sira + '</span><div>' +
        (s.ad ? '<strong>' + esc(s.ad) + '</strong>' : '<strong class="free">Boş</strong>') +
        (admin ? '<div class="meta"><span class="dot' + (s.sicil && reg[s.sicil] ? ' on' : '') + '"></span>' + (s.ad ? 'Sicil: ' + esc(s.sicil || 'girilmemiş') + (s.sicil && reg[s.sicil] ? ' · Hesap açık' : ' · Hesap yok') : 'Atanmadı') + '</div>' : '') + '</div>' +
        (admin ? '<button class="btn small" data-edit="' + esc(s.id) + '">Düzenle</button>' : '<span></span>');
      if (admin && editSlot === s.id) {
        h += '<form class="slotedit" data-form="' + esc(s.id) + '" data-sira="' + s.sira + '" autocomplete="off"><div><label for="e-ad">Ad soyad</label><input type="text" id="e-ad" value="' + esc(s.ad || '') + '"></div>' +
          '<div><label for="e-sicil">Sicil numarası</label><input type="text" id="e-sicil" autocapitalize="off" value="' + esc(s.sicil || '') + '"></div>' +
          '<div class="acts"><button class="btn primary small" type="submit">Kaydet</button><button class="btn small" type="button" data-cancel="1">İptal</button></div>' +
          (s.sicil && reg[s.sicil] ? '<button class="btn small danger" type="button" data-kick="' + esc(s.sicil) + '">Hesabın ekip erişimini kaldır</button>' : '') +
          (!s._bos ? '<button class="btn small danger" type="button" data-clear="' + esc(s.id) + '">Satırı boşalt</button>' : '') + '</form>';
      }
      return h + '</li>';
    }).join('') + '</ul>';
  }
  function bindRoster() {
    app.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editSlot = editSlot === b.dataset.edit ? null : b.dataset.edit; draw(); }; });
    app.querySelectorAll('[data-cancel]').forEach(function (b) { b.onclick = function () { editSlot = null; draw(); }; });
    app.querySelectorAll('[data-form]').forEach(function (f) { f.onsubmit = function (e) { saveSlot(e, f.dataset.form, +f.dataset.sira); }; });
    app.querySelectorAll('[data-clear]').forEach(function (b) { b.onclick = function () { fs.doc('ekip/' + b.dataset.clear).delete().then(function () { editSlot = null; toast('Satır boşaltıldı'); }, function (e) { toast(errMsg(e)); }); }; });
    app.querySelectorAll('[data-kick]').forEach(function (b) { b.onclick = function () {
      var m = members.filter(function (x) { return x.sicil === b.dataset.kick; })[0]; if (!m) return;
      fs.doc('uyeler/' + m.uid).delete().then(function () { toast('Erişim kaldırıldı'); }, function (e) { toast(errMsg(e)); });
    }; });
  }
  async function saveSlot(e, id, sira) {
    e.preventDefault(); if (busy) return;
    var ad = document.getElementById('e-ad').value.trim(), sicil = normSicil(document.getElementById('e-sicil').value);
    if (ad && !sicil) { toast('Ad yazdıysanız sicil numarası da girin.'); return; }
    if (sicil && roster.some(function (r) { return r.id !== id && r.sicil === sicil; })) { toast('Bu sicil numarası başka bir satırda var.'); return; }
    busy = true;
    try { await fs.doc('ekip/' + id).set({ sira: sira, ad: ad, sicil: sicil }); editSlot = null; toast('Ekip listesi güncellendi'); }
    catch (err) { toast(errMsg(err)); }
    busy = false;
  }
  async function seedTeam() {
    if (busy) return; busy = true;
    try {
      var batch = fs.batch();
      DEFAULT_TEAM.forEach(function (ad, i) { batch.set(fs.doc('ekip/s' + (i + 1)), { sira: i + 1, ad: ad, sicil: '' }); });
      await batch.commit(); toast('Ekip listesi oluşturuldu. Sicil numaralarını girin.');
    } catch (err) { toast(errMsg(err)); }
    busy = false;
  }
  function drawTeam() {
    app.innerHTML = header(true) + '<button class="btn small" id="back" style="width:fit-content">← Listeye dön</button>' +
      '<section class="card"><h2>Acil ekip görevlileri</h2>' + rosterHtml(isAdmin) +
      (isAdmin ? '<p class="hint">Görevli, sicil numarası ve takım koduyla hesap açar. Adı, listedeki satırdan alınır.</p>' +
        (!roster.length ? '<button class="btn primary" id="seed">Varsayılan ekip listesini oluştur</button>' : '') : '') + '</section>';
    document.getElementById('back').onclick = function () { screen = { name: 'list' }; draw(); };
    var sd = document.getElementById('seed'); if (sd) sd.onclick = seedTeam;
    bindHeader(); bindRoster();
  }

  // ---------- Liste ----------
  function visibleRows() {
    var s = q.trim().toLocaleLowerCase('tr-TR');
    return rows.filter(function (r) {
      var open = r.durum === 'acik';
      if (filter === 'kesik' && open) return false;
      if (filter === 'acik' && !open) return false;
      if (!s) return true;
      return [r.adres, r.abone, r.neden, r.isEmri, r.kesenAd, r.acanAd].join(' ').toLocaleLowerCase('tr-TR').indexOf(s) >= 0;
    });
  }
  function listHtml() {
    var vis = visibleRows();
    if (rowsErr) return '<div class="empty"><b>Kayıtlar okunamadı</b>Yetkiniz yok veya bağlantı yok.</div>';
    if (!rows.length) return '<div class="empty"><b>Henüz kayıt yok</b>Arıza nedeniyle gaz kestiğinizde "Gaz kesimi kaydet" ile adresi, nedeni ve fotoğrafı ekleyin.</div>';
    if (!vis.length) return '<div class="empty"><b>Eşleşen kayıt yok</b>Aramayı veya filtreyi değiştirin.</div>';
    return '<ul class="list">' + vis.map(function (r) {
      var open = r.durum === 'acik', c = open ? 'acik' : 'kesik', np = (r.kesFoto || 0) + (r.acFoto || 0);
      var l1 = r.kesmeYok ? 'Kesim kaydı girilmemiş' : 'Kesen: ' + esc(who(r.kesenAd)) + ' · ' + fmt(r.kesmeT);
      var l2 = open ? '<br>Açan: ' + esc(who(r.acanAd)) + ' · ' + fmt(r.acmaT) : '<br>Kesik süre: ' + since(r.kesmeT);
      return '<li><button class="rec ' + c + '" data-id="' + esc(r.id) + '"><span class="pill ' + c + '">' + (open ? ICON_OK + 'Gaz verildi' : ICON_CUT + 'Gaz kesik') + '</span>' +
        '<strong>' + esc(r.adres) + '</strong>' + (r.neden ? '<p>' + esc(r.neden) + '</p>' : '') +
        '<span class="meta">' + (r.isEmri ? 'İş emri ' + esc(r.isEmri) + ' · ' : '') + l1 + (np ? ' · ' + np + ' foto' : '') + l2 + '</span></button></li>';
    }).join('') + '</ul>';
  }
  function drawList() {
    var kesik = rows.filter(function (r) { return r.durum !== 'acik'; }).length, acik = rows.length - kesik;
    app.innerHTML = header(true) +
      '<div class="tiles">' +
      '<button class="tile" data-f="all" aria-pressed="' + (filter === 'all') + '"><b>' + rows.length + '</b><span>Tümü</span></button>' +
      '<button class="tile crit" data-f="kesik" aria-pressed="' + (filter === 'kesik') + '"><b>' + kesik + '</b><span>Gaz kesik</span></button>' +
      '<button class="tile ok" data-f="acik" aria-pressed="' + (filter === 'acik') + '"><b>' + acik + '</b><span>Gaz verildi</span></button></div>' +
      '<div class="acts"><button class="btn primary" id="newbtn">Gaz kesimi kaydet</button><button class="btn go" id="dirbtn">Gaz açımı kaydet</button></div>' +
      '<p class="hint">Kesim kaydı olan adreste gaz açımını kaydın içinden girin. Kesim kaydı yoksa "Gaz açımı kaydet" ile doğrudan girebilirsiniz.</p>' +
      '<details class="card" id="rost"' + (rosterOpen ? ' open' : '') + '><summary>Acil ekip görevlileri</summary>' + rosterHtml(false) + '</details>' +
      (isAdmin ? '<button class="btn" id="teamBtn">Ekip listesini ve sicil numaralarını düzenle</button>' : '') +
      '<input type="search" id="q" placeholder="Adres, abone no, iş emri veya isim ara" value="' + esc(q) + '" aria-label="Ara">' +
      '<div id="listbox">' + listHtml() + '</div>';
    app.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { filter = b.dataset.f; draw(); }; });
    document.getElementById('newbtn').onclick = function () { screen = { name: 'new' }; draft.kes = []; draw(); window.scrollTo(0, 0); };
    document.getElementById('dirbtn').onclick = function () { screen = { name: 'direct' }; draft.ac = []; draw(); window.scrollTo(0, 0); };
    document.getElementById('rost').addEventListener('toggle', function (e) { rosterOpen = e.target.open; });
    var tb = document.getElementById('teamBtn'); if (tb) tb.onclick = function () { screen = { name: 'team' }; editSlot = null; draw(); window.scrollTo(0, 0); };
    document.getElementById('q').oninput = function (e) { q = e.target.value; document.getElementById('listbox').innerHTML = listHtml(); bindRecs(); };
    bindHeader(); bindRecs();
  }
  function bindRecs() { app.querySelectorAll('.rec[data-id]').forEach(function (b) { b.onclick = function () { openDetail(b.dataset.id); }; }); }

  // ---------- Yeni kesim ----------
  function drawNew() {
    app.innerHTML = header(false) + '<button class="btn small" id="back" style="width:fit-content">← Listeye dön</button>' +
      '<form class="card stack" id="nf" autocomplete="off"><h2>Gaz kesimi kaydet</h2>' +
      '<div><label for="n-adres">Adres *</label><input type="text" id="n-adres" required placeholder="Mahalle, sokak, bina ve kapı no"></div>' +
      '<div class="row2"><div><label for="n-is">İş emri no</label><input type="text" id="n-is" inputmode="numeric"></div><div><label for="n-abone">Abone no</label><input type="text" id="n-abone" inputmode="numeric"></div></div>' +
      '<div><label for="n-neden">Arıza nedeni ve açıklama *</label><textarea id="n-neden" required placeholder="Ne bulundu, hangi vana kapatıldı, neden kesildi"></textarea></div>' +
      shiftSelect('n-vardiya') + pickerHtml('kes') +
      '<p class="hint">Abone bilgisi olarak yalnızca abone numarasını yazın. Ad, telefon ve kimlik numarası girmeyin.</p>' +
      '<button class="btn primary full" type="submit" id="nsave">Kaydı oluştur</button></form>';
    document.getElementById('back').onclick = function () { screen = { name: 'list' }; draw(); };
    bindPicker('kes'); document.getElementById('nf').onsubmit = submitNew;
  }
  async function submitNew(e) {
    e.preventDefault(); if (busy) return;
    var adres = document.getElementById('n-adres').value.trim(), neden = document.getElementById('n-neden').value.trim();
    if (!adres || !neden) return;
    busy = true; var btn = document.getElementById('nsave'); btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    try {
      var ref = fs.collection('kayitlar').doc(), photos = draft.kes.slice();
      for (var i = 0; i < photos.length; i++) await fs.collection('fotolar').add({ kayitId: ref.id, asama: 'kes', d: photos[i] });
      await ref.set({ adres: adres, isEmri: document.getElementById('n-is').value.trim(), abone: document.getElementById('n-abone').value.trim(), neden: neden, vardiya: +document.getElementById('n-vardiya').value, durum: 'kesik', kesenId: user.uid, kesenAd: profile.ad, kesenSicil: profile.sicil, kesmeT: Date.now(), kesFoto: photos.length });
      draft.kes = []; screen = { name: 'list' }; toast('Kayıt eklendi');
    } catch (err) { toast(errMsg(err)); }
    busy = false; draw();
  }

  // ---------- Doğrudan açım ----------
  function drawDirect() {
    app.innerHTML = header(false) + '<button class="btn small" id="back" style="width:fit-content">← Listeye dön</button>' +
      '<form class="card stack" id="df" autocomplete="off"><h2>Gaz açımı kaydet</h2>' +
      '<div><label for="d-adres">Adres *</label><input type="text" id="d-adres" required placeholder="Mahalle, sokak, bina ve kapı no"></div>' +
      '<div class="match" id="match"></div>' +
      '<div class="row2"><div><label for="d-is">İş emri no</label><input type="text" id="d-is" inputmode="numeric"></div><div><label for="d-abone">Abone no</label><input type="text" id="d-abone" inputmode="numeric"></div></div>' +
      '<div><label for="d-not">Yapılan işlem ve ölçüm notu *</label><textarea id="d-not" required placeholder="Gaz neden açıldı, ölçüm değerleri"></textarea></div>' +
      shiftSelect('d-vardiya') + pickerHtml('ac') +
      '<p class="hint">Bu adreste kesim kaydı varsa yukarıda görünür, oradan devam edin. Kesim kaydı yoksa bu form kaydı kesim bilgisi olmadan oluşturur.</p>' +
      '<button class="btn go full" type="submit" id="dsave">Gaz verildi olarak kaydet</button></form>';
    document.getElementById('back').onclick = function () { screen = { name: 'list' }; draw(); };
    bindPicker('ac');
    document.getElementById('d-adres').oninput = function (e) {
      var n = normAddr(e.target.value), box = document.getElementById('match');
      var hits = n.length < 4 ? [] : rows.filter(function (r) { var m = normAddr(r.adres); return r.durum !== 'acik' && m && (m.indexOf(n) >= 0 || n.indexOf(m) >= 0); }).slice(0, 3);
      box.innerHTML = hits.map(function (r) {
        return '<button type="button" class="rec kesik" data-m="' + esc(r.id) + '"><span class="pill kesik">' + ICON_CUT + 'Bu adreste kesik kayıt var</span><strong>' + esc(r.adres) + '</strong><span class="meta">Kesen: ' + esc(who(r.kesenAd)) + ' · ' + fmt(r.kesmeT) + '<br>Bu kayıtla devam etmek için dokunun</span></button>';
      }).join('');
      box.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { openDetail(b.dataset.m); }; });
    };
    document.getElementById('df').onsubmit = submitDirect;
  }
  async function submitDirect(e) {
    e.preventDefault(); if (busy) return;
    var adres = document.getElementById('d-adres').value.trim(), note = document.getElementById('d-not').value.trim();
    if (!adres || !note) return;
    busy = true; var btn = document.getElementById('dsave'); btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    try {
      var ref = fs.collection('kayitlar').doc(), photos = draft.ac.slice(), now = Date.now();
      for (var i = 0; i < photos.length; i++) await fs.collection('fotolar').add({ kayitId: ref.id, asama: 'ac', d: photos[i] });
      await ref.set({ adres: adres, isEmri: document.getElementById('d-is').value.trim(), abone: document.getElementById('d-abone').value.trim(), neden: '', kesmeYok: true, durum: 'acik', kesmeT: now, acmaT: now, acanId: user.uid, acanAd: profile.ad, acanSicil: profile.sicil, acNot: note, acVardiya: +document.getElementById('d-vardiya').value, acFoto: photos.length, kesFoto: 0 });
      draft.ac = []; screen = { name: 'list' }; toast('Gaz açımı kaydedildi');
    } catch (err) { toast(errMsg(err)); }
    busy = false; draw();
  }

  // ---------- Detay ----------
  async function loadPhotos(id) {
    try {
      var snap = await fs.collection('fotolar').where('kayitId', '==', id).get();
      photoCache[id] = snap.docs.map(function (d) { return d.data(); });
    } catch (e) { photoCache[id] = photoCache[id] || []; }
    if (screen.name === 'detail' && screen.id === id && !editing()) draw();
  }
  function openDetail(id) { screen = { name: 'detail', id: id }; draft.ac = []; delArm = null; draw(); window.scrollTo(0, 0); loadPhotos(id); }
  function stagePhotos(id, stage) { return (photoCache[id] || []).filter(function (p) { return p.asama === stage; }).map(function (p) { return p.d; }); }
  function drawDetail() {
    var r = rows.filter(function (x) { return x.id === screen.id; })[0];
    if (!r) { screen = { name: 'list' }; return drawList(); }
    var open = r.durum === 'acik', c = open ? 'acik' : 'kesik', kesP = stagePhotos(r.id, 'kes'), acP = stagePhotos(r.id, 'ac');
    var h = header(false) + '<button class="btn small" id="back" style="width:fit-content">← Listeye dön</button>' +
      '<div class="banner ' + c + '"><h2>' + (open ? 'Gaz verildi' : 'Gaz kesik') + '</h2><span>' + (open ? 'Müdahale edildi, abonelere gaz verildi.' : 'Bu adreste gaz hâlâ kesik. Kesik süre: ' + since(r.kesmeT)) + '</span></div>';
    if (r.kesmeYok) {
      h += '<section class="card"><h2>Kesim</h2><p class="hint">Bu adres için kesim kaydı girilmemiş. Gaz açımı doğrudan kaydedildi.</p><dl class="kv"><dt>Adres</dt><dd>' + esc(r.adres) + '</dd>' +
        (r.isEmri ? '<dt>İş emri</dt><dd>' + esc(r.isEmri) + '</dd>' : '') + (r.abone ? '<dt>Abone no</dt><dd>' + esc(r.abone) + '</dd>' : '') + '</dl></section>';
    } else {
      h += '<section class="card"><h2>Kesim</h2><dl class="kv"><dt>Adres</dt><dd>' + esc(r.adres) + '</dd>' + (r.isEmri ? '<dt>İş emri</dt><dd>' + esc(r.isEmri) + '</dd>' : '') + (r.abone ? '<dt>Abone no</dt><dd>' + esc(r.abone) + '</dd>' : '') +
        '<dt>Neden</dt><dd>' + esc(r.neden) + '</dd><dt>Kesen</dt><dd>' + esc(who(r.kesenAd)) + (r.kesenSicil ? ' · Sicil ' + esc(r.kesenSicil) : '') + '</dd><dt>Zaman</dt><dd>' + fmt(r.kesmeT) + '</dd><dt>Vardiya</dt><dd>' + esc(SHIFTS[r.vardiya] || '-') + '</dd></dl>' +
        (r.kesFoto ? (kesP.length ? photosHtml(kesP, false, 'kes') : '<p class="hint">Fotoğraflar yükleniyor...</p>') : '<p class="hint">Fotoğraf eklenmemiş.</p>') + '</section>';
    }
    if (open) {
      h += '<section class="card"><h2>Gaz verme</h2><dl class="kv"><dt>Açan</dt><dd>' + esc(who(r.acanAd)) + (r.acanSicil ? ' · Sicil ' + esc(r.acanSicil) : '') + '</dd><dt>Zaman</dt><dd>' + fmt(r.acmaT) + '</dd><dt>Vardiya</dt><dd>' + esc(SHIFTS[r.acVardiya] || '-') + '</dd><dt>Açıklama</dt><dd>' + esc(r.acNot || '-') + '</dd></dl>' +
        (r.acFoto ? (acP.length ? photosHtml(acP, false, 'ac') : '<p class="hint">Fotoğraflar yükleniyor...</p>') : '<p class="hint">Fotoğraf eklenmemiş.</p>') + '</section>';
    } else {
      h += '<form class="card stack" id="af" autocomplete="off"><h2>Gaz verildi olarak işaretle</h2>' +
        '<div><label for="a-not">Yapılan işlem ve ölçüm notu *</label><textarea id="a-not" required placeholder="Arıza giderildi, sızdırmazlık testi yapıldı, ölçüm değerleri"></textarea></div>' +
        shiftSelect('a-vardiya') + pickerHtml('ac') + '<button class="btn go full" type="submit" id="asave">Gaz verildi</button></form>';
    }
    if (isAdmin) h += '<button class="btn danger" id="del">' + (delArm === r.id ? 'Silmek için tekrar dokunun' : 'Kaydı sil') + '</button>';
    app.innerHTML = h;
    document.getElementById('back').onclick = function () { screen = { name: 'list' }; draw(); };
    app.querySelectorAll('[data-big]').forEach(function (b) { b.onclick = function () { showBig(stagePhotos(r.id, b.dataset.stage)[+b.dataset.big]); }; });
    if (!open) { bindPicker('ac'); document.getElementById('af').onsubmit = function (e) { submitOpen(e, r.id); }; }
    var d = document.getElementById('del'); if (d) d.onclick = function () { deleteRec(r.id); };
  }
  async function submitOpen(e, id) {
    e.preventDefault(); if (busy) return;
    var cur = rows.filter(function (x) { return x.id === id; })[0];
    if (!cur || cur.durum === 'acik') { toast('Bu kayıt zaten açılmış.'); return draw(); }
    var note = document.getElementById('a-not').value.trim(); if (!note) return;
    busy = true; document.getElementById('asave').disabled = true;
    try {
      var photos = draft.ac.slice();
      for (var i = 0; i < photos.length; i++) await fs.collection('fotolar').add({ kayitId: id, asama: 'ac', d: photos[i] });
      await fs.doc('kayitlar/' + id).update({ durum: 'acik', acanId: user.uid, acanAd: profile.ad, acanSicil: profile.sicil, acmaT: Date.now(), acNot: note, acVardiya: +document.getElementById('a-vardiya').value, acFoto: photos.length });
      draft.ac = []; toast('Gaz verildi olarak işaretlendi'); loadPhotos(id);
    } catch (err) { toast(errMsg(err)); }
    busy = false; draw();
  }
  async function deleteRec(id) {
    if (delArm !== id) { delArm = id; draw(); setTimeout(function () { if (delArm === id) { delArm = null; if (screen.name === 'detail' && !editing()) draw(); } }, 3500); return; }
    try {
      var snap = await fs.collection('fotolar').where('kayitId', '==', id).get();
      for (var i = 0; i < snap.docs.length; i++) await snap.docs[i].ref.delete();
      await fs.doc('kayitlar/' + id).delete();
      delete photoCache[id]; delArm = null; screen = { name: 'list' }; toast('Kayıt silindi');
    } catch (err) { toast(errMsg(err)); }
    draw();
  }

  // Web sürümünde uygulama dosyalarını telefona kaydeder (internet yokken de açılır).
  try {
    var nativeApp = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (!nativeApp && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
    }
  } catch (e) {}

  init();
})();
