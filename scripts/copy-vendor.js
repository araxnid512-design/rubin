// Копирует браузерные сборки библиотек в vendor/ обеих игр (проекты без сборщика, работают офлайн):
// www/vendor — «Стикс: Дорога стабов», clones/www/vendor — «Клоны против дроидов».
const fs = require('fs');
const path = require('path');

const capacitor = {
  'capacitor.js': '@capacitor/core/dist/capacitor.js',
  'app.js': '@capacitor/app/dist/plugin.js',
  'status-bar.js': '@capacitor/status-bar/dist/plugin.js',
  'screen-orientation.js': '@capacitor/screen-orientation/dist/plugin.js',
};
const targets = {
  www: { ...capacitor, 'planck.min.js': 'planck/dist/planck.min.js' },
  'clones/www': capacitor,
};

const root = path.join(__dirname, '..');
for (const [dir, files] of Object.entries(targets)) {
  const out = path.join(root, dir, 'vendor');
  fs.mkdirSync(out, { recursive: true });
  for (const [name, src] of Object.entries(files)) fs.copyFileSync(require.resolve(src), path.join(out, name));
  console.log(`vendor: ${dir}/vendor — скопировано файлов: ${Object.keys(files).length}`);
}
