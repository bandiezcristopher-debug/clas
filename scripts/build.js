#!/usr/bin/env node
/* Builds dist/standalone.html: index.html + coords.js + the three PDFs embedded.
   The result works from a double-click and has the submit URL cleared (local only). */
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public'), dist = path.join(__dirname, '..', 'dist');
let html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
const coords = fs.readFileSync(path.join(pub, 'coords.js'), 'utf8');
const tpl = {};
for (const n of ['flow', 'form541', 'form542', 'form001'])
  tpl[`templates/${n}.pdf`] = fs.readFileSync(path.join(pub, 'templates', n + '.pdf')).toString('base64');
tpl['templates/tocid-signature.png'] = fs.readFileSync(path.join(pub, 'templates', 'tocid-signature.png')).toString('base64');
for (const f of ['ph-geo.js', 'permit-font.js', 'permit-data.js', 'permit.js']) {          // v6.1: inline the permit generator
  const t0 = '<script src="' + f + '"></script>';
  if (!html.includes(t0)) throw new Error(f + ' script tag not found in index.html');
  html = html.replace(t0, () => '<script>\n' + fs.readFileSync(path.join(pub, f), 'utf8') + '\n</script>');
}
const tag = '<script src="coords.js"></script>';
if (!html.includes(tag)) throw new Error('coords.js script tag not found in index.html');
html = html.replace(tag, () => '<script>\nwindow.EMBEDDED_TEMPLATES = ' + JSON.stringify(tpl, null, 2) + ';\n\n' + coords + '\n</script>');
html = html.replace(/const SUBMIT_URL = '[^']*';/, "const SUBMIT_URL = '';");
fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, 'standalone.html');
fs.writeFileSync(out, html);
console.log('wrote', path.relative(process.cwd(), out), (fs.statSync(out).size / 1e6).toFixed(2) + ' MB');
