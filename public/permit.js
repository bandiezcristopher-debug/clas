/* Knowledge Test Permit (Notice of Admission) generator - v6.1
   Uses the layouts of the ALD CONVERTER (permit-data.js, auto-generated from those files).
   permitKindFor(d)  -> which permit template an application needs (from the form data returned by collect())
   renderPermit(...) -> PDF bytes: the applicant's photo and signature, the control no. and Temporary PEL.      */

/* ---- which application gets which permit template ------------------------------------------------------------
   Edit this table if the office decides differently. d = collect() of the application:
     d.cat 541|542, d.licApplied (lic_*), d.appType (original|reinstatement|additional|upgrade|proficiency),
     d.ratingInvolved ("rtg_airframe, rtg_powerplant" ...)                                                          */
const PERMIT_CODE = {          // control no. prefix:  <CODE>-AKTP-<yyyy>-<mm>-<seq>
  amt: 'AMT', amt_airframe: 'AMT', amt_powerplant: 'AMT', amt_military: 'AMT', amt_renewal: 'AMT',
  ams: 'AMS', ams_add: 'AMS', ams_orig_spec: 'AMS',
  private: 'PPL', cpl: 'CPL', atpl: 'ATPL', fi: 'FI', gi: 'GI', conval: 'CONVAL', pilot_add: 'PILOT',
  aso: 'ASO', atc: 'ATC', atc_pel: 'ATC', atsep: 'ATSEP', foo: 'FOO', rpa: 'RPA',
};
const RATING_NAMES = {
  rtg_airframe: 'Airframe Rating', rtg_powerplant: 'Powerplant Rating',
  rtg_instrument: 'Instrument Rating', rtg_cat23: 'Category II or III Approaches', rtg_addedtype: 'Added Type Rating', rtg_other: 'Other Rating',
};

function permitKindFor(d){
  const t = d.appType, lic = d.licApplied, rt = String(d.ratingInvolved || '').split(',').map(s => s.trim()).filter(Boolean);
  const hasAF = rt.indexOf('rtg_airframe') > -1, hasPP = rt.indexOf('rtg_powerplant') > -1;
  const none = why => ({ kind: null, why });
  if (t === 'proficiency') return none('A Proficiency Check has no Knowledge Test Permit.');
  let kind = null, ratings = [];
  if (d.cat === '541'){
    if (t === 'additional'){ kind = 'pilot_add'; ratings = rt.length ? rt.map(x => RATING_NAMES[x] || x) : ['Additional Rating']; }
    else kind = { lic_private: 'private', lic_commercial: 'cpl', lic_atp: 'atpl', lic_flightinstr: 'fi' }[lic] || null;
    if (!kind) return none('There is no Knowledge Test Permit template for this pilot license yet.');
  } else {
    if (lic === 'lic_amt'){
      if (t === 'additional' || (hasAF !== hasPP)) kind = hasAF && !hasPP ? 'amt_airframe' : hasPP && !hasAF ? 'amt_powerplant' : 'amt';
      else kind = 'amt';
    }
    else if (lic === 'lic_ams'){ kind = t === 'additional' ? 'ams_add' : 'ams'; if (kind === 'ams_add') ratings = rt.length ? rt.map(x => RATING_NAMES[x] || x) : ['Additional Rating']; }
    else if (lic === 'lic_atc' || lic === 'lic_studentatc') kind = (t === 'original') ? 'atc' : 'atc_pel';
    else kind = { lic_aso: 'aso', lic_studentaso: 'aso', lic_atsep: 'atsep', lic_dispatcher: 'foo', lic_groundinstr: 'gi', lic_rpa: 'rpa' }[lic] || null;
    if (!kind) return none('There is no Knowledge Test Permit template for this license yet.');
  }
  return { kind, code: PERMIT_CODE[kind], ratings, label: PERMIT_KINDS[kind].label };
}

/* ---- images -------------------------------------------------------------------------------------------------- */
function permitCleanSignature(dataUrl){      // same rule as the converter: pale paper becomes pure white
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0);
        const id = x.getImageData(0, 0, c.width, c.height), p = id.data;
        for (let i = 0; i < p.length; i += 4){ const l = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000; if (l > 160){ p[i] = p[i + 1] = p[i + 2] = 255; } p[i + 3] = 255; }
        x.putImageData(id, 0, 0); res(c.toDataURL('image/jpeg', 0.95));
      } catch (e){ res(dataUrl); }
    };
    im.onerror = () => res(dataUrl); im.src = dataUrl;
  });
}

function permitManilaNow(){
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = k => f.find(p => p.type === k).value;
  return { y: g('year'), m: g('month'), d: g('day'),
           date: (+g('month')) + '/' + (+g('day')) + '/' + g('year'),
           time: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }) };
}

/* Open Sans must exist in the MAIN page too: html2canvas paints on a canvas of the main document, so a font that is only known
   inside the hidden iframe is measured in Open Sans but painted in Arial (missing spaces, shifted text).                       */
const PERMIT_FONT_FACES = ['400 10pt "Open Sans"', '600 10pt "Open Sans"', '700 10pt "Open Sans"', 'italic 400 10pt "Open Sans"', 'italic 700 10pt "Open Sans"'];
async function permitEnsureFonts(){
  if (typeof PERMIT_FONT_CSS !== 'string' || !document.fonts) return;
  if (!document.getElementById('permitFontFaces')){
    const st = document.createElement('style'); st.id = 'permitFontFaces'; st.textContent = PERMIT_FONT_CSS; document.head.appendChild(st);
  }
  await Promise.race([new Promise(res => setTimeout(res, 5000)),
    Promise.all(PERMIT_FONT_FACES.map(f => document.fonts.load(f).catch(() => null))).then(() => document.fonts.ready)]);
}

/* ---- render -------------------------------------------------------------------------------------------------- */
/* info = { kind, ratings, ctrl, pel, name, photo (data URL), signature (data URL), venue (optional custom address) }  ->  Uint8Array (PDF, A4 landscape) */
async function renderPermit(info){
  if (typeof html2canvas !== 'function') throw new Error('html2canvas did not load (internet needed).');
  const K = PERMIT_KINDS[info.kind]; if (!K) throw new Error('Unknown permit template: ' + info.kind);
  await permitEnsureFonts();
  const now = permitManilaNow();
  const sig = await permitCleanSignature(info.signature);
  const ov = { photo: info.photo, csig: sig };
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const venue = String(info.venue || '').trim().replace(/[.\s]+$/, '');          // v6.3: staff may replace the address the applicant proceeds to
  const H = { img: k => ov[k] || PERMIT_IMG[k], venueText: () => venue ? 'the Airmen Examination Board. You shall proceed directly to ' + esc(venue) + '.' : K.venue, timeStr: now.time };
  const r = { ctrl: info.ctrl, pel: info.pel || '', name: String(info.name || '').toUpperCase(), date: now.date, photo: info.photo };
  const page = K.build(r, info.ratings || [], H);
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;left:-99999px;top:0;width:1202px;height:854px;border:0;';
  document.body.appendChild(fr);
  try {
    const doc = fr.contentDocument; doc.open();
    /* box-sizing: the permit CSS was written for a page with a global border-box rule; without it the left column grows past the
       centre line and the QR code and the note at the bottom are pushed out of the page. */
    doc.write('<!doctype html><html><head><meta charset="utf-8"><style>' + (typeof PERMIT_FONT_CSS === 'string' ? PERMIT_FONT_CSS : '')
      + '*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}'
      + PERMIT_CSS[K.css] + '</style></head><body>' + page + '</body></html>');
    doc.close();
    const fonts = fr.contentWindow.document.fonts;
    if (fonts) await Promise.race([new Promise(res => setTimeout(res, 5000)),
      Promise.all(PERMIT_FONT_FACES.map(f => fonts.load(f).catch(() => null))).then(() => fonts.ready)]);
    await Promise.all([].slice.call(doc.images).map(im => im.decode ? im.decode().catch(() => null) : Promise.resolve()));
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const canvas = await html2canvas(doc.querySelector('.doc-page'), { scale: 2, logging: false, backgroundColor: '#ffffff', useCORS: true, allowTaint: true,
                                                                     width: 1202, height: 854, windowWidth: 1202, windowHeight: 854, scrollX: 0, scrollY: 0 });
    const jpg = await (await fetch(canvas.toDataURL('image/jpeg', 0.97))).arrayBuffer();
    const pdf = await PDFLib.PDFDocument.create();
    const pg = pdf.addPage([841.89, 595.28]);                     // A4 landscape, full bleed
    pg.drawImage(await pdf.embedJpg(jpg), { x: 0, y: 0, width: 841.89, height: 595.28 });
    return await pdf.save();
  } finally { document.body.removeChild(fr); }
}
