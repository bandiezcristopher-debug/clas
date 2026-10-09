#!/usr/bin/env node
/* npm run set-passcode -- "my new passcode"            -> staff (ADMIN_HASH)
   npm run set-passcode -- --tocid "my new passcode"    -> TOCID  (TOCID_HASH)
   Writes the SHA-256 of the passcode into public/index.html.
   For TOCID also set the SAME passcode in backend/apps-script.gs (TOCID_PASSCODE) and redeploy. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
let args = process.argv.slice(2); const tocid = args[0] === '--tocid'; if (tocid) args = args.slice(1);
const pass = args.join(' '), name = tocid ? 'TOCID_HASH' : 'ADMIN_HASH';
if (pass.length < 6) { console.error('Usage: npm run set-passcode -- [--tocid] "new passcode"   (at least 6 characters)'); process.exit(1); }
const file = path.join(__dirname, '..', 'public', 'index.html');
const hash = crypto.createHash('sha256').update(pass).digest('hex');
const html = fs.readFileSync(file, 'utf8');
const re = new RegExp("const " + name + " = '[0-9a-f]{64}';");
if (!re.test(html)) { console.error(name + ' not found in index.html'); process.exit(1); }
fs.writeFileSync(file, html.replace(re, `const ${name} = '${hash}';`));
console.log((tocid ? 'TOCID' : 'Admin') + ' passcode updated. Restart / rebuild to use it.');
if (tocid) console.log('Also set  const TOCID_PASSCODE = \'' + pass + '\';  in backend/apps-script.gs and redeploy a new version.');
