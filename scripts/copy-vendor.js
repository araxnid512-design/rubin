// Копирует браузерные сборки библиотек в www/vendor (проект без сборщика, работает офлайн).
const fs = require('fs');
const path = require('path');

const files = {
  'capacitor.js': '@capacitor/core/dist/capacitor.js',
  'app.js': '@capacitor/app/dist/plugin.js',
  'status-bar.js': '@capacitor/status-bar/dist/plugin.js',
  'screen-orientation.js': '@capacitor/screen-orientation/dist/plugin.js',
  'planck.min.js': 'planck/dist/planck.min.js',
};

const out = path.join(__dirname, '..', 'www', 'vendor');
fs.mkdirSync(out, { recursive: true });
for (const [name, src] of Object.entries(files)) {
  fs.copyFileSync(require.resolve(src), path.join(out, name));
}
console.log('vendor: скопировано', Object.keys(files).length, 'файла');
