// Firebase tarayıcı dosyalarını node_modules içinden www/vendor klasörüne kopyalar.
// Uygulama internet olmadan açıldığında da bu dosyalar yerelden yüklenir.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www', 'vendor');
const names = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
const dirs = [
  path.join(root, 'node_modules', 'firebase'),
  path.join(root, 'node_modules', 'firebase', 'compat')
];

fs.mkdirSync(out, { recursive: true });
let missing = [];
for (const n of names) {
  const found = dirs.map((d) => path.join(d, n)).find((p) => fs.existsSync(p));
  if (!found) { missing.push(n); continue; }
  fs.copyFileSync(found, path.join(out, n));
  console.log('kopyalandı:', n);
}
if (missing.length) {
  console.error('Bulunamayan dosyalar:', missing.join(', '));
  console.error('Önce "npm install" çalıştırın. Sorun sürerse firebase paket sürümünü kontrol edin.');
  process.exit(1);
}
