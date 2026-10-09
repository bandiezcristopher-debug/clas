/**
 * CAAP form generator — private intake backend (Google Apps Script)
 *
 * The public page writes here. Nobody can read back. The Sheet and the
 * Drive folder stay owned by, and shared only with, the licensing account.
 *
 * SETUP
 * 1. Sign in as the licensing e-mail account (not a personal account).
 * 2. Create a Google Sheet. Copy its ID from the URL:
 *      docs.google.com/spreadsheets/d/<THIS PART>/edit
 * 3. Create a Drive folder for attachments. Copy its ID from the URL.
 * 4. Go to script.google.com > New project. Paste this file in.
 * 5. Fill in SHEET_ID and FOLDER_ID below.
 * 6. Deploy > New deployment > type "Web app".
 *      Execute as:        Me (the licensing account)
 *      Who has access:    Anyone
 *    "Anyone" only means anyone may POST. It does NOT let anyone read the
 *    Sheet — doGet returns nothing and the Sheet itself is never shared.
 * 7. Copy the /exec URL and paste it into SUBMIT_URL at the top of the
 *    <script> block in index.html (and standalone.html).
 * 8. When you change this file later: Deploy > Manage deployments > edit >
 *    Version: New version. (The /exec URL stays the same.)
 *
 * DAILY LIMIT (enforced here, so it cannot be bypassed from the browser)
 *   Per e-mail address, per calendar day (Asia/Manila):
 *   - ONE "standard" application: Original, Reinstatement, or any
 *     Form 542 application.
 *   - PLUS, for Form 541 only, each of Upgrade of License / Application for
 *     Proficiency Check / Additional Rating once. These may be sent together
 *     in one submission (one Form 541 each) or in later submissions the same
 *     day, but the same type cannot be sent twice.
 *   E-mail addresses are normalised first (lower-case, "+tag" removed, and
 *   dots removed for gmail.com) so alias tricks do not get around the limit.
 *
 * ONE PENDING APPLICATION PER PERSON (Original, Reinstatement)
 *   A person is identified by last name + first name + date of birth (not by
 *   e-mail, so changing e-mail does not help). While that person has an
 *   application of the same type, on the same PEL form, whose "status" cell is
 *   NEW or IN REVIEW, a new one is refused and nothing is saved.
 *   STAFF: when you finish with an application, change its status cell in the
 *   Sheet to anything else (PROCESSED, REJECTED, ...). That lets the person apply
 *   again. To let someone correct a mistake, set their old row to REJECTED.
 *   Upgrade / Proficiency Check / Additional Rating are not affected.
 */

const SHEET_ID  = 'PASTE_SPREADSHEET_ID_HERE';
const FOLDER_ID = 'PASTE_DRIVE_FOLDER_ID_HERE';
/* TOCID sign-in. Must be the same passcode you give the TOCID officers; the server checks it, so
   nobody can list, open or validate applications without it. CHANGE IT before going live. */
const ACC_TAB = 'Accounts';           // staff accounts (admin creates / edits / deletes them from the page)
const SESSION_SECONDS = 21600;       // a sign-in lasts 6 hours (the maximum the script cache allows)
const TOCID_PASSCODE = '';           // no longer used: TOCID officers now have their own accounts
/* STAFF (ALD) passcode, same one staff type on the page. The server checks it when the Approve button
   tells the Monitoring sheet that "ALD Approval for KTP" is done. CHANGE IT and keep both in step. */
const ADMIN_PASSCODE = 'CHANGE_ME_BEFORE_DEPLOYING';
/* Folder layout: FOLDER_ID / yyyy-MM-dd / <LAST-FIRST>_<control no.> / (PDFs, photo, signature, draft).
   true = date folder, then one folder per applicant submission.  false = everything straight into FOLDER_ID. */
const USE_DAY_SUBFOLDERS = true;
const REJECTED_FOLDER_NAME = 'Rejected Applications';   // v6.6: a rejected application's Drive folder is MOVED here (inside the main folder), never deleted
const MONITOR_TAB = 'Monitoring';
const STALE_CLAIM_HOURS = 3;          // a "Being Processed" mark older than this is ignored (someone forgot to release it)
const TZ = 'Asia/Manila';
/* v7.3: survey check. Paste the ID of the Google Sheet that holds the survey form's responses (Form > Responses > Link to Sheets).
   The form must ask for an e-mail address (a question whose title contains "e-mail" / "email"). Leave '' to keep the honour tick only. */
const SURVEY_SHEET_ID = '';
const SURVEY_SHEET_TAB = '';      // '' = the first tab of that sheet

/* ---- v6.1 KTP PERMIT: control-number registers ----
   The office keeps THREE registers (tabs): Mechanics (AMT+AMS), Pilot, Other Airmen. Each tab has its own running
   control number and its own Temporary PEL series, so a new permit continues from the last row of ITS tab.
   REGISTER_SHEET_ID = the Google Sheet ID (docs.google.com/spreadsheets/d/<ID>/edit). If the three tabs are in
   different files, give each its own id below. Native Google Sheet only (an .xlsx in Drive: File > Save as Google Sheets).
   The account this script runs as needs edit access. Tabs are found by gid (the number after #gid= in the link). */
const REGISTER_SHEET_ID = 'PASTE_REGISTER_SPREADSHEET_ID_HERE';
const REGISTERS = {
  MECH:  { id: '', gid: 413218578  },      // AMT, AMS
  PILOT: { id: '', gid: 1526991716 },      // PPL, CPL, ATPL, FI, pilot additional, conversion/validation
  OTHER: { id: '', gid: 236582630  }       // ATC, ATSEP, ASO, FOO, GI, RPA ...
};
const PERMIT_REGISTER = { AMT: 'MECH', AMS: 'MECH', PPL: 'PILOT', CPL: 'PILOT', ATPL: 'PILOT', FI: 'PILOT', PILOT: 'PILOT', CONVAL: 'PILOT' };   // anything else = OTHER
/* v6.3 Temporary PEL. New (Original) applicants get the next number of the Temporary PEL series of their register tab.
   Applicants who already hold a PEL (Reinstatement, Additional, Upgrade ...) keep THEIR OWN PEL number in that column.
   The last Temporary PEL given out is remembered by the script (it is no longer "highest number in the column", which
   was wrong as soon as a real PEL such as 2010185 was typed in). If the first number it picks is wrong, put the last
   correct Temporary PEL of that tab here ONCE (0 = automatic); the script never goes below this number. */
const TEMP_PEL_LAST = { MECH: 0, PILOT: 0, OTHER: 0 };
const REUSE_EXISTING_PEL = true;            // false = every applicant gets a Temporary PEL, even if they already hold a PEL
const REGISTER_TEST_FACILITY = 'AEB';       // "Test Facility" column
const PERMIT_TYPE_LETTER = { original: 'O', reinstatement: 'R', additional: 'ADD', upgrade: 'U' };

const BUNDLE_TYPES = ['additional'];

/* one pending application per person: which types it applies to, and which statuses count as "pending" */
const PENDING_BLOCK_TYPES = ['original', 'reinstatement'];
const PENDING_STATUSES = ['NEW', 'IN REVIEW'];
const FILE_TOKENS = {
  original: 'Original', reinstatement: 'Reinstatement',
  additional: 'AdditionalRating',
};

const COLUMNS = [
  'reference', 'submittedAt', 'status', 'action', 'formUsed',
  'lastName', 'firstName', 'middleName', 'dob', 'age', 'pob',
  'address', 'city', 'province', 'postal', 'country', 'nationality',
  'mobile', 'phone', 'email', 'company',
  'sex', 'height', 'weight', 'hair', 'eyes',
  'licenseNo', 'licenseType', 'stateIssue', 'dateIssued',
  'ratings', 'limitations', 'endorsements', 'epr', 'otherLic',
  'medClass', 'medState', 'medDate', 'medExaminer', 'failed',
  'pdfLink', 'photoLink', 'signatureLink', 'pilotTimeJSON',
  // added for application types + the daily limit (new columns go at the END)
  'appType', 'appTypeLabel', 'licApplied', 'catClass', 'ratingInvolved',
  'submitDay', 'emailKey', 'bundleId', 'personKey', 'draftLink',
  'tocidStatus', 'tocidDate', 'tocidData',
  // v5.4: education, attachments, folder, rejections
  'school', 'gradYear', 'folderId', 'diplomaLink', 'torLink', 'rejectedAt', 'rejectedBy', 'rejectReason',
  // v5.5: AMT / AMS degree level and the 12-month OJT certificate (AMS Associate graduates)
  'degree', 'ojtLink',
  // v5.6: Ground Schooling Certificate (the only attachment on PEL Form 541)
  'groundLink',
  // v6.0: Form 001 (Aeronautical Knowledge Test Permit) and the Licensing Officer evaluation
  'f001Link', 'loStatus', 'loBy', 'loAt', 'loRemarks',
  // v6.1: Knowledge Test Permit
  'permitCtrl', 'permitPel', 'permitLink', 'permitAt',
  // v6.3: walk-in priority, equal division of the initial approval among ALD staff, compiled PDF
  'walkIn', 'assignedTo', 'assignedAt', 'compiledLink', 'permitVenue',
  // v7.1: documents per license (training certificate, PSA birth certificate, medical certificate, drone pictures + specs) and the RPA drone weight
  'trainingLink', 'psaLink', 'medicalLink', 'droneLink', 'droneSpecLink', 'droneKg',
  // v7.4: Certificate of Employment (PEL 542 applied for on the basis of Experience)
  'coeLink',
];

/* =====================================================================================
   SUBMISSIONS (v6.9): the script lock is held only for the duplicate check, the number assignment and the sheet rows.
   Drive saves happen BEFORE the lock, the notification e-mail is queued and sent by a timed trigger (walk-ins: at once).
   ===================================================================================== */
const SUBMIT_LOCK_WAIT_MS = 30000;

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (pe) { return json_({ ok: false, error: 'The request could not be read.' }); }
  const op = d && typeof d.op === 'string' ? d.op : '';
  if (op === 'analyticsData' || op === 'analyticsBackfill') return analytics_(d);
  if (op === 'calendarSave') return calendarSave_(d);           // v7.4: holidays / working weekends (administrator only)
  if (op === 'myPerformance') return myPerformance_(d);         // v7.4: personal dashboard (ALD / TOCID / Licensing Officer)    // v7.0: dashboard (administrator + Licensing Officers)
  /* sign-in, accounts and the staff desks change shared sheets, so they keep the script lock for the whole request */
  if (op === 'login' || op === 'logout' || op.indexOf('acc') === 0 || op.indexOf('desk') === 0) {
    return locked_(55000, function () {
      if (op === 'login') return login_(d);
      if (op === 'logout') { try { CacheService.getScriptCache().remove('t:' + String(d.token || '')); } catch (x) {} return json_({ ok: true }); }
      if (op.indexOf('acc') === 0) return acct_(d);                       // admin: manage accounts
      return desk_(d);                                                    // TOCID / ALD / Licensing Officer desks
    });
  }
  return submit_(d);
}

function busy_(msg) { return json_({ ok: false, code: 'BUSY', error: msg || 'The server is busy. Please wait a moment.' }); }
const LOCK_ERR_ = /lock|too many times|timed out|timeout|Service invoked/i;

function locked_(waitMs, fn) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(waitMs); } catch (lockErr) { return busy_(); }       // a queue of applicants -> the page retries by itself
  try { return fn(); }
  catch (err) {
    console.error(err);
    if (LOCK_ERR_.test(String(err))) return busy_();
    return json_({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}

/* one applicant's submission. Phase A (no lock): checks + Drive. Phase B (lock): check again, assign, write rows. Phase C: the rest. */
function submit_(d) {
  const cache = CacheService.getScriptCache();
  const cid = d && d.clientId ? 'sub:' + String(d.clientId).slice(0, 80) : '', pk = cid ? 'subp:' + cid.slice(4) : '';
  let saved = null, wrote = false, done = false;
  try {
    /* a retried submission carries the same clientId; if the first attempt already saved, return its answer (no duplicate) */
    if (cid) {
      const hit = cache.get(cid); if (hit) return json_(JSON.parse(hit));
      if (cache.get(pk)) return busy_('Your previous attempt is still being saved. Please wait a moment.');   // it is running right now
      cache.put(pk, '1', 70);
    }
    const apps = normaliseApps_(d);
    if (!apps.length) return json_({ ok: false, error: 'No application was received.' });

    const base = apps[0].form;
    const emailKey = emailKey_(base.email);
    if (!emailKey) return json_({ ok: false, error: 'A valid e-mail address is required.' });

    const now = new Date();
    const day = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
    const is541 = String(base.cat) === '541';
    const bundle = is541 && apps.every(function (a) { return BUNDLE_TYPES.indexOf(a.type) > -1; });

    /* ---- validate the request shape ---- */
    if (!bundle && apps.length > 1)
      return json_({ ok: false, error: 'Only Upgrade, Proficiency Check and Additional Rating (Form 541) can be filed together.' });
    const seen = {};
    for (var i = 0; i < apps.length; i++) {
      if (!FILE_TOKENS[apps[i].type]) return json_({ ok: false, error: 'Unknown application type.' });
      if (seen[apps[i].type]) return json_({ ok: false, error: 'The same application type was sent twice.' });
      seen[apps[i].type] = true;
    }

    /* ---- every applicable field must be filled in (the page checks this too; this stops a bypass) ---- */
    if (!d.photo) return json_({ ok: false, error: 'The photograph is required.' });
    if (!d.signature) return json_({ ok: false, error: 'The signature is required.' });
    /* v7.1: the documents depend on the license (mirror of docKeys() on the page) */
    const needOjt0 = String(base.cat) === '542' && String(base.licApplied) === 'lic_ams' && String(base.degree) === 'associate';
    const needDocs = docKeysFor_(base, needOjt0);
    for (let q = 0; q < needDocs.length; q++)
      if (!d[needDocs[q]]) return json_({ ok: false, error: 'The ' + DOC_NAMES[needDocs[q]] + ' attachment is required.' });
    if (String(base.licApplied) === 'lic_rpa' && !(parseFloat(base.droneKg) > 0)) return json_({ ok: false, error: 'The drone weight (kg) is required.' });
    /* v5.5: AMT / AMS must state the degree level; AMS Associate graduates must also attach a 12-month OJT certificate */
    const licA = String(base.licApplied || ''), isMaint = String(base.cat) === '542' && (licA === 'lic_amt' || licA === 'lic_ams');
    if (isMaint && ['bachelor', 'associate'].indexOf(String(base.degree || '')) === -1)
      return json_({ ok: false, error: 'Select the degree level (Bachelor or Associate) for the Aviation Maintenance application.' });
    const needOjt = isMaint && licA === 'lic_ams' && String(base.degree) === 'associate';
    if (needOjt && !d.ojt) return json_({ ok: false, error: 'AMS Associate graduates must attach a 12-month OJT certificate.' });
    if (d.survey !== true) return json_({ ok: false, error: 'Please answer the survey first, then tick the box saying you have answered it.' });   // v7.2
    if (SURVEY_SHEET_ID && !surveyAnswered_(base.email))   // v7.3: real check against the form's response sheet
      return json_({ ok: false, error: 'We could not find a survey answer for ' + String(base.email || '') + '. Open the survey, type exactly this e-mail address, send it, wait a minute, then press Submit again.' });
    for (var j = 0; j < apps.length; j++) {
      var miss = missingFields_(apps[j]);
      if (miss.length) return json_({ ok: false, error: 'Required fields are empty: ' + miss.join(', ') + '. Type N/A where something does not apply.' });
    }

    /* v6.9: a staff member at the counter can mark the applicant as a walk-in (only a valid ALD / admin sign-in counts) */
    let walk = false;
    if (d.walkIn === true && d.token) { try { const me = auth_(d); walk = !!(me && (me.role === 'ald' || me.role === 'admin')); } catch (wx) {} }

    /* ---- early check WITHOUT the lock: refuses an obvious duplicate before anything is saved to Drive ---- */
    const sheet = getSheet_();
    const ctx = { apps: apps, base: base, emailKey: emailKey, day: day, bundle: bundle, formUsed: 'PEL ' + (base.cat || ''), idx: null };
    try { const early = checkSubmission_(sheet, ctx); if (early) return early; } catch (ce) { console.error('early check skipped: ' + ce); }

    /* ---- PHASE A: save everything to Drive (no lock, so other applicants are not held up) ---- */
    const rootFolder = DriveApp.getFolderById(FOLDER_ID);
    const photoName = reserveReference_(base.lastName);          // also the control no. of the first application; unique per second
    const dayParent = USE_DAY_SUBFOLDERS ? subfolder_(rootFolder, day) : rootFolder;
    const dayFolder = USE_DAY_SUBFOLDERS
      ? dayParent.createFolder(safe_(base.lastName) + '-' + safe_(base.firstName) + '_' + photoName)   // one folder per submission
      : rootFolder;
    saved = { folder: USE_DAY_SUBFOLDERS ? dayFolder : null, links: [] };
    const keep = function (link) { if (link) saved.links.push(link); return link; };
    const bundleId = bundle && apps.length > 1 ? 'B' + Utilities.formatDate(now, TZ, 'HHmmss') : '';
    const photoLink = keep(saveDataUrl_(dayFolder, d.photo, photoName + '_photo'));
    const sigLink   = keep(saveDataUrl_(dayFolder, d.signature, photoName + '_signature'));
    const docSave = function (k, name) { return needDocs.indexOf(k) > -1 ? keep(saveDataUrl_(dayFolder, d[k], photoName + name)) : ''; };
    const groundLink = docSave('ground', '_GroundSchooling'), diplomaLink = docSave('diploma', '_COG-Diploma'), torLink = docSave('tor', '_TOR');
    const trainingLink = docSave('training', '_TrainingCertificate'), psaLink = docSave('psa', '_PSA-BirthCertificate'), medicalLink = docSave('medical', '_MedicalCertificate');
    const droneLink = docSave('dronephoto', '_DronePictures'), droneSpecLink = docSave('dronespec', '_DroneSpecs');
    const coeLink = docSave('coe', '_CertificateOfEmployment');
    const f001Pdf = d.f001 ? keep(saveFile_(dayFolder, d.f001, 'application/pdf', photoName + '_Form001.pdf')) : '';
    const ojtLink     = needOjt ? keep(saveDataUrl_(dayFolder, d.ojt, photoName + '_OJT-12mo')) : '';
    /* The applicant's draft (.json) goes in the same folder so staff can load it back into the
       form (Staff sign in > Options > Load a saved draft) and change the application. */
    let draftLink = '', draftFile = null;
    try {
      if (d.draft) {
        const draftName = String(d.draftName || 'caap-draft.json').replace(/\.json$/i, '');
        draftFile = dayFolder.createFile(Utilities.newBlob(String(d.draft), 'application/json', draftName + '_' + photoName + '.json'));
        draftLink = keep(draftFile.getUrl());
      }
    } catch (draftErr) { console.error('draft not saved: ' + draftErr); }

    const rowsOut = [];                                          // everything for the sheet except the assignment, built before the lock
    apps.forEach(function (a, idx) {
      const f = a.form;
      const reference = idx ? photoName + '-' + (idx + 1) : photoName;   // control no. = the folder's number
      const fileName = a.pdfName || (FILE_TOKENS[a.type] + '_' + safe_(f.lastName) + '-' + safe_(f.firstName) + '_' +
                                      safe_(f.licenseNo || 'NOPEL') + '_Form' + f.cat + '.pdf');
      const pdfLink = keep(saveFile_(dayFolder, a.pdf, 'application/pdf', fileName));
      const values = {
        reference: reference,
        submittedAt: d.submittedAt || now.toISOString(),
        status: 'NEW',
        action: f.action || '',
        formUsed: 'PEL ' + (f.cat || ''),
        pdfLink: pdfLink, photoLink: photoLink, signatureLink: sigLink, draftLink: draftLink,
        diplomaLink: diplomaLink, torLink: torLink, ojtLink: ojtLink, groundLink: groundLink, trainingLink: trainingLink, psaLink: psaLink, medicalLink: medicalLink, droneLink: droneLink, droneSpecLink: droneSpecLink, coeLink: coeLink,
        droneKg: String(base.licApplied) === 'lic_rpa' ? String(base.droneKg || '') : '', f001Link: f001Pdf, loStatus: 'Pending', walkIn: walk ? 'YES' : '', degree: isMaint ? String(base.degree) : '', folderId: USE_DAY_SUBFOLDERS ? dayFolder.getId() : '',
        pilotTimeJSON: JSON.stringify(d.pilotTime || {}),
        failed: f.failed === 'failed_yes' ? 'YES' : 'NO',
        appType: a.type, appTypeLabel: a.typeLabel || a.type,
        licApplied: f.licApplied || '', catClass: f.catClass || '', ratingInvolved: f.ratingInvolved || '',
        submitDay: day, emailKey: emailKey, bundleId: bundleId,
        personKey: personKey_(f.lastName, f.firstName, f.dob),
      };
      rowsOut.push({ values: values, f: f, a: a, reference: reference, fileName: fileName, pdfLink: pdfLink });
    });

    /* ---- PHASE B: the short locked part: check again, assign the ALD staff member, write the rows ---- */
    const lock = LockService.getScriptLock();
    try { lock.waitLock(SUBMIT_LOCK_WAIT_MS); }
    catch (lockErr) { discardSaved_(saved); saved = null; return busy_(); }
    let refused = null, assignee = null;
    const results = [];
    try {
      const hit2 = cid ? cache.get(cid) : null;
      if (hit2) refused = json_(JSON.parse(hit2));               // an earlier attempt of this same submission finished meanwhile
      else {
        refused = checkSubmission_(sheet, ctx);                  // the authoritative check (also fills ctx.idx for the assignment)
        if (!refused) {
          /* v6.3: the initial approval is divided equally among the active ALD staff (fewest of TODAY's submissions first) */
          try { assignee = pickAssignee_(sheet, day, ctx.idx); } catch (asgErr) { console.error('assignment skipped: ' + asgErr); }
          rowsOut.forEach(function (r) {
            r.values.assignedTo = assignee ? assignee.username : '';
            r.values.assignedAt = assignee ? now : '';
            sheet.appendRow(COLUMNS.map(function (k) {
              return r.values[k] !== undefined ? r.values[k] : (r.f[k] !== undefined ? r.f[k] : '');
            }));
            wrote = true;
            results.push({ reference: r.reference, type: r.a.type, label: r.a.typeLabel || r.a.type, fileName: r.fileName, pdfLink: r.pdfLink, pdf: r.a.pdf, form: r.f });
          });
          try {
            results.forEach(function (r) { addMonitor_(r.reference, r.form, r.label, now, assignee ? assignee.name : '', walk); });
          } catch (monErr) { console.error('monitoring row not added (application was saved): ' + monErr); }
          const okLocked = { ok: true, reference: results[0].reference, references: results.map(function (r) { return r.reference; }) };
          if (cid) { try { cache.put(cid, JSON.stringify(okLocked), 21600); } catch (cx) {} }   // inside the lock, so a retry waiting for it finds it
          SpreadsheetApp.flush();
        }
      }
    } finally { lock.releaseLock(); }
    if (refused) { discardSaved_(saved); saved = null; return refused; }

    /* ---- PHASE C: everything else, outside the lock ---- */
    // the draft remembers its control no.(s) so the Approve button can update the Monitoring sheet later
    try {
      if (draftFile) {
        const dj = JSON.parse(String(d.draft)); dj.__refs = results.map(function (r) { return r.reference; });
        draftFile.setContent(JSON.stringify(dj));
      }
    } catch (refErr) { console.error('draft refs not saved: ' + refErr); }
    try { queueNotice_(results, walk); } catch (mailErr) { console.error('notification failed (application was saved): ' + mailErr); }
    done = true;
    return json_({ ok: true, reference: results[0].reference, references: results.map(function (r) { return r.reference; }) });
  } catch (err) {
    console.error(err);
    if (saved && !wrote) { try { discardSaved_(saved); } catch (dx) {} }     // nothing was written to the sheet: do not leave orphan files
    if (LOCK_ERR_.test(String(err))) return busy_();
    return json_({ ok: false, error: String(err) });
  } finally {
    if (pk) { try { cache.remove(pk); } catch (rx) {} }
  }
}

/* move this attempt's files to the Drive trash again (the submission was refused or never reached the sheet) */
function discardSaved_(saved) {
  if (!saved) return;
  try {
    if (saved.folder) { saved.folder.setTrashed(true); return; }
    saved.links.forEach(function (l) { const id = fileId_(l); if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (x) {} } });
  } catch (e) { console.error('cleanup failed: ' + e); }
}

/* Control number that is unique even when many applicants submit in the same second (the stamp is bumped to the next
   free second; it is only an identifier, the real time is kept in submittedAt). Needs the lock for a few milliseconds. */
function reserveReference_(lastName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(SUBMIT_LOCK_WAIT_MS);
  try {
    const props = PropertiesService.getScriptProperties();
    let t = Date.now();
    const lastSec = Math.floor((parseInt(props.getProperty('lastRefMs') || '0', 10) || 0) / 1000);
    if (Math.floor(t / 1000) <= lastSec) t = (lastSec + 1) * 1000;
    props.setProperty('lastRefMs', String(t));
    return newReference_(lastName, '', new Date(t));
  } finally { lock.releaseLock(); }
}

/* Reads only the columns the checks need (two blocks) instead of every column of every row. */
function submissionIndex_(sheet) {
  const last = sheet.getLastRow(); if (last < 2) return [];
  const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0], n = last - 1;
  const c = function (k) { return head.indexOf(k); };
  const a1 = c('dob'), b0 = c('appType'), b1 = c('personKey');
  if (c('reference') !== 0 || a1 < 0 || b0 < 0 || b1 < b0) {                 // unexpected layout: read everything, as before
    const all = sheet.getRange(2, 1, n, head.length).getValues();
    return all.map(function (r) { return { ref: r[c('reference')], status: r[c('status')], action: r[c('action')], formUsed: r[c('formUsed')], last: r[c('lastName')], first: r[c('firstName')], dob: r[c('dob')], type: r[c('appType')], day: r[c('submitDay')], emailKey: r[c('emailKey')], personKey: r[c('personKey')] }; });
  }
  const A = sheet.getRange(2, 1, n, a1 + 1).getValues(), B = sheet.getRange(2, b0 + 1, n, b1 - b0 + 1).getValues();
  const iS = c('status'), iAc = c('action'), iF = c('formUsed'), iL = c('lastName'), iFn = c('firstName'),
        iT = c('appType') - b0, iD = c('submitDay') - b0, iE = c('emailKey') - b0, iP = c('personKey') - b0;
  return A.map(function (r, i) { return { ref: r[0], status: r[iS], action: r[iAc], formUsed: r[iF], last: r[iL], first: r[iFn], dob: r[a1], type: B[i][iT], day: B[i][iD], emailKey: B[i][iE], personKey: B[i][iP] }; });
}

/* One pending application per person + one application per e-mail per day. Returns the answer to send, or null if allowed. */
function checkSubmission_(sheet, ctx) {
  const idx = submissionIndex_(sheet); ctx.idx = idx;
  const tz = sheet.getParent().getSpreadsheetTimeZone();
  for (var k = 0; k < ctx.apps.length; k++) {
    const app = ctx.apps[k];
    if (PENDING_BLOCK_TYPES.indexOf(app.type) === -1) continue;
    const pf = app.form, pKey = personKey_(pf.lastName, pf.firstName, pf.dob);
    if (!pKey) continue;                      // name or date of birth missing: nothing safe to match on
    for (var i = 0; i < idx.length; i++) {
      const r = idx[i];
      if (PENDING_STATUSES.indexOf(String(r.status).trim().toUpperCase()) === -1) continue;
      if ((r.type || r.action || 'original') !== app.type) continue;
      if (r.formUsed && r.formUsed !== ctx.formUsed) continue;
      const rowKey = r.personKey ? String(r.personKey) : personKey_(r.last, r.first, r.dob, tz);   // older rows have no personKey yet
      if (rowKey !== pKey) continue;
      var rd = r.day; if (rd instanceof Date) rd = Utilities.formatDate(rd, TZ, 'yyyy-MM-dd');
      return json_({ ok: false, code: 'PENDING_APPLICATION', error:
        'An application for ' + (app.typeLabel || app.type) + ' under this name and date of birth is already under review ' +
        '(reference ' + r.ref + (rd ? ', submitted ' + rd : '') + '). ' +
        'A new one can only be submitted after the licensing office has processed it. ' +
        'If you need to correct something, please contact the licensing office and quote that reference number.' });
    }
  }
  const doneTypes = [];
  idx.forEach(function (r) {
    var rd = r.day; if (rd instanceof Date) rd = Utilities.formatDate(rd, TZ, 'yyyy-MM-dd');
    if (String(r.status).trim().toUpperCase() === 'REJECTED') return;          // rejected = deleted: they may apply again today
    if (r.emailKey === ctx.emailKey && String(rd) === ctx.day) doneTypes.push(r.type || r.action || 'original');
  });
  const standardDone = doneTypes.some(function (t) { return BUNDLE_TYPES.indexOf(t) === -1; });
  if (ctx.bundle) {
    const dup = ctx.apps.filter(function (a) { return doneTypes.indexOf(a.type) > -1; });
    if (dup.length) return limit_('An application for ' + dup.map(function (a) { return a.typeLabel || a.type; }).join(', ') +
      ' was already submitted today with this e-mail address. Only one of each may be filed per day.');
  } else if (standardDone) {
    return limit_('An application has already been submitted today with this e-mail address. ' +
      'Only one application per e-mail address per day is accepted — please try again tomorrow.');
  }
  return null;
}

/* Names of required fields that are empty for this application (mirrors the page's rules). */
function missingFields_(a) {
  const f = a.form || {};
  const is541 = String(f.cat) === '541';
  const isOrig = is541 ? a.type === 'original' : f.action === 'original';
  var need = ['lastName', 'firstName', 'middleName', 'dob', 'age', 'pob', 'address', 'city', 'province', 'postal',
              'country', 'nationality', 'mobile', 'phone', 'email', 'company', 'sex', 'height', 'weight', 'hair', 'eyes', 'school', 'gradYear'];
  if (!is541 && ['lic_amt', 'lic_ams'].indexOf(String(f.licApplied)) !== -1) need.push('degree');
  if (!isOrig) need.push('licenseNo');
  if (!is541) {
    if (['lic_atc', 'lic_aso'].indexOf(String(f.licApplied)) !== -1) need.push('langText');   // language proficiency: ATC and ASO only
    if (!isOrig) need = need.concat(['licenseType', 'stateIssue', 'dateIssued', 'ratings', 'limitations', 'endorsements']);
  } else need = need.concat(['aircraftUsed', 'totalTime', 'picTime']);
  if (f.medRequired !== false) need = need.concat(['medClass', 'medState', 'medDate', 'medExaminer']);
  return need.filter(function (k) { return !String(f[k] === undefined || f[k] === null ? '' : f[k]).trim(); });
}

/* =====================================================================================
   DESKS: the to-do lists for the TOCID officers and the ALD staff.   (op = deskList | deskGet | deskClaim |
   deskRelease | deskTocidSave | deskInitial | deskApprove | deskReject).   role = 'tocid' | 'ald'
   The passcode is checked here (TOCID_PASSCODE / ADMIN_PASSCODE), so nobody can use these without it.
   ===================================================================================== */
/* v6.1 layout: Licensing Officer Evaluation sits right after TOCID Validation; the permit columns are at the end */
const MON_HEAD = ['Control No.', 'Name of the Applicant', 'Type of Application', 'Date & Time Submitted', 'Days Pending',
                  'Being Processed', 'ALD Initial Approval', 'TOCID Validation',
                  'Licensing Officer Evaluation', 'Evaluated By (Licensing Officer)',
                  'ALD Approval for KTP', 'Remarks', 'Handled By',
                  'Permit Control No.', 'Permit Generated', 'Permit File',
                  'Assigned ALD Staff (initial approval)', 'Walk-in'];
const MC = { ref: 1, name: 2, type: 3, at: 4, days: 5, busy: 6, initial: 7, tocid: 8, lo: 9, loBy: 10, ktp: 11, remarks: 12, handled: 13,
             permitNo: 14, permitAt: 15, permitLink: 16, assigned: 17, walkin: 18 };
const MON_COL_LETTER = function (c) { return String.fromCharCode(64 + c); };

function txt_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm') : String(v === undefined || v === null ? '' : v); }
function fileId_(link) { const m = String(link || '').match(/[-\w]{25,}/); return m ? m[0] : ''; }

/* ---------- Monitoring sheet (a tab of the same spreadsheet) ---------- */
function monitorSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(MONITOR_TAB);
  if (!sh) {
    sh = ss.insertSheet(MONITOR_TAB, 0);
    sh.getRange(1, 1, 1, MON_HEAD.length).setValues([MON_HEAD]);
    formatMonitor_(sh);
    return sh;
  }
  const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 7)).getValues()[0];
  if (head[3] === 'ALD Initial Approval') {                       // v5.3 layout (7 columns): add the 3 new columns after "Type"
    sh.insertColumnsBefore(4, 3);
    sh.getRange(1, 1, 1, MON_HEAD.length).setValues([MON_HEAD]);
    const last = sh.getLastRow();
    if (last > 1) {
      const app = getSheet_(), ah = app.getRange(1, 1, 1, app.getLastColumn()).getValues()[0];
      const when = {};
      if (app.getLastRow() > 1) app.getRange(2, 1, app.getLastRow() - 1, ah.length).getValues().forEach(function (r) {
        const t = r[ah.indexOf('submittedAt')]; when[String(r[ah.indexOf('reference')])] = t ? new Date(t) : '';
      });
      const refs = sh.getRange(2, 1, last - 1, 1).getValues();
      sh.getRange(2, MC.at, last - 1, 1).setValues(refs.map(function (r) { return [when[String(r[0])] || '']; }));
      sh.getRange(2, MC.days, last - 1, 1).setFormulas(refs.map(function (r, i) { return [daysFormula_(i + 2)]; }));
    }
    formatMonitor_(sh);
  }
  /* v6.1 layout: Licensing Officer Evaluation + Evaluated By sit right after TOCID Validation, permit columns at the end.
     Three older layouts are upgraded in place (existing data moves with its column):
       v6.0  ... TOCID | KTP | Remarks | LO Eval | Evaluated By | Handled By   -> move the two LO columns
       v5.x  ... TOCID | KTP | Remarks | Handled By?                          -> insert the two LO columns
       v6.1 without the permit columns                                      -> add them */
  const h = function (i) { return String(head[i] || ''); };
  if (h(8) === 'ALD Approval for KTP' && h(10) === 'Licensing Officer Evaluation') {
    sh.moveColumns(sh.getRange(1, 11, sh.getMaxRows(), 2), 9);        // old K:L go in front of the old column I
    migrated_(sh);
  } else if (h(8) === 'ALD Approval for KTP' && h(10) !== 'Licensing Officer Evaluation') {
    sh.insertColumnsBefore(MC.lo, 2);
    const last3 = sh.getLastRow();
    if (last3 > 1) {
      const ktp3 = sh.getRange(2, MC.ktp, last3 - 1, 1).getValues();   // rows already finished need no evaluation, the rest are Pending
      sh.getRange(2, MC.lo, last3 - 1, 1).setValues(ktp3.map(function (r) { return [String(r[0]) === 'Approved' ? 'N/A' : 'Pending']; }));
    }
    migrated_(sh);
  } else if (h(MC.permitNo - 1) !== MON_HEAD[MC.permitNo - 1] && h(MC.ktp - 1) === 'ALD Approval for KTP') {
    migrated_(sh);                                                    // only the permit columns are missing
  }
  if (String(sh.getRange(1, MC.assigned).getValue()) !== MON_HEAD[MC.assigned - 1]) {      // v6.3: Assigned + Walk-in columns at the end
    sh.getRange(1, 1, 1, MON_HEAD.length).setValues([MON_HEAD]); formatMonitor_(sh);
  }
  return sh;
}

function migrated_(sh) {              // after a layout change: rewrite headers, the Days Pending formulas and all formatting
  sh.getRange(1, 1, 1, MON_HEAD.length).setValues([MON_HEAD]);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, MC.days, last - 1, 1).setFormulas(sh.getRange(2, 1, last - 1, 1).getValues().map(function (r, i) { return [daysFormula_(i + 2)]; }));
  formatMonitor_(sh);
}

function daysFormula_(r) {
  const K = MON_COL_LETTER(MC.ktp), G = MON_COL_LETTER(MC.initial), H = MON_COL_LETTER(MC.tocid);
  return '=IFERROR(IF($A' + r + '="","",IF($' + K + r + '="Approved","Done",IF(OR($' + G + r + '="Rejected",$' + H + r + '="Rejected",$' + K + r + '="Rejected"),"Rejected",MAX(1,TODAY()-INT($D' + r + ')+1)))),"")';
}

function formatMonitor_(sh) {
  sh.getRange(1, 1, 1, MON_HEAD.length).setFontWeight('bold').setBackground('#0b3d75').setFontColor('#ffffff')
    .setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('center');
  sh.setFrozenRows(1);
  [150, 220, 230, 160, 100, 190, 130, 130, 150, 230, 140, 280, 320, 190, 150, 220, 230, 90].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  const N = 4999;
  sh.getRange(2, MC.at, N, 1).setNumberFormat('yyyy-mm-dd hh:mm AM/PM');
  sh.getRange(2, MC.days, N, 1).setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange(2, MC.initial, N, 2).setHorizontalAlignment('center'); sh.getRange(2, MC.ktp, N, 1).setHorizontalAlignment('center');
  sh.getRange(2, MC.permitNo, N, 2).setHorizontalAlignment('center'); sh.getRange(2, MC.permitAt, N, 1).setNumberFormat('yyyy-mm-dd hh:mm AM/PM');
  sh.getRange(2, MC.lo, N, 1).setHorizontalAlignment('center'); sh.getRange(2, MC.walkin, N, 1).setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange(2, MC.handled, N, 1).setWrap(true);
  const dd = SpreadsheetApp.newDataValidation().requireValueInList(['Pending', 'Approved', 'Rejected', 'N/A'], true).setAllowInvalid(false).build();
  [MC.initial, MC.tocid, MC.ktp].forEach(function (c) { sh.getRange(2, c, N, 1).setDataValidation(dd); });
  sh.getRange(2, MC.lo, N, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Pending', 'Eligible', 'Ineligible', 'N/A'], true).setAllowInvalid(false).build());
  const R = function (col) { return [sh.getRange(2, col, N, 1)]; };
  const fmt = function (f, bg, fg, col) { return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(f).setBackground(bg).setFontColor(fg).setRanges(R(col)).build(); };
  const rules = [
    // days pending: 1-5 green, 6-10 yellow, 11+ red
    fmt('=AND(ISNUMBER($E2),$E2>=1,$E2<=5)', '#c8f0d0', '#146c2e', MC.days),
    fmt('=AND(ISNUMBER($E2),$E2>=6,$E2<=10)', '#fff2a8', '#7a5c00', MC.days),
    fmt('=AND(ISNUMBER($E2),$E2>=11)', '#f7b4b0', '#9b1c14', MC.days),
    fmt('=$F2<>""', '#ffd9a8', '#8a4b00', MC.busy),
  ];
  [MC.initial, MC.tocid, MC.ktp].forEach(function (c) {
    const col = MON_COL_LETTER(c);
    rules.push(fmt('=$' + col + '2="Approved"', '#d6f2dc', '#16622b', c));
    rules.push(fmt('=$' + col + '2="Pending"', '#fff1cc', '#7a5200', c));
    rules.push(fmt('=$' + col + '2="Rejected"', '#f7b4b0', '#9b1c14', c));
    rules.push(fmt('=$' + col + '2="N/A"', '#e6e6e6', '#555555', c));
  });
  rules.push(fmt('=$' + MON_COL_LETTER(MC.lo) + '2="Eligible"', '#d6f2dc', '#16622b', MC.lo));
  rules.push(fmt('=$' + MON_COL_LETTER(MC.lo) + '2="Pending"', '#fff1cc', '#7a5200', MC.lo));
  rules.push(fmt('=$' + MON_COL_LETTER(MC.lo) + '2="Ineligible"', '#f7b4b0', '#9b1c14', MC.lo));
  rules.push(fmt('=$' + MON_COL_LETTER(MC.lo) + '2="N/A"', '#e6e6e6', '#555555', MC.lo));
  rules.push(fmt('=$' + MON_COL_LETTER(MC.walkin) + '2="YES"', '#ffcf7a', '#6b3a00', MC.walkin));
  sh.setConditionalFormatRules(rules);
}

function fullName_(f) {
  return [String(f.lastName || '') + ',', f.firstName, f.middleName].filter(function (x) { return x; }).join(' ').trim().toUpperCase();
}

/* v7.1: documents each license must upload (mirror of docKeys() on the page) */
const DOC_NAMES = { ground: 'Ground Schooling Certificate', diploma: 'Certificate of Graduation / Diploma', tor: 'Transcript of Records', ojt: '12-month OJT Certificate',
  training: 'Training Certificate', psa: 'PSA Birth Certificate', medical: 'Medical Certificate', dronephoto: 'Pictures of the drone', dronespec: 'Drone specifications', coe: 'Certificate of Employment' };
function docKeysFor_(base, needOjt) {
  /* v7.4: on the basis of Experience, AMT / AMS upload only the Certificate of Employment; every other license uploads the Training Certificate + the COE */
  if (String(base.cat) === '542' && String(base.basis || '').toLowerCase().indexOf('basis_experience') > -1) {
    const l = String(base.licApplied || '');
    return (l === 'lic_amt' || l === 'lic_ams') ? ['coe'] : ['training', 'coe'];
  }
  return docKeysBase_(base, needOjt);
}
function docKeysBase_(base, needOjt) {
  if (String(base.cat) === '541') return ['ground'];
  const l = String(base.licApplied || '');
  if (l === 'lic_dispatcher') return ['training', 'tor', 'diploma'];
  if (l === 'lic_groundinstr') return ['ground'];
  if (l === 'lic_aso' || l === 'lic_atc' || l === 'lic_atsep') return ['training'];
  if (l === 'lic_studentatc' || l === 'lic_studentaso') return ['psa', 'medical'];
  if (l === 'lic_rpa') return ['training', 'dronephoto', 'dronespec'];
  return ['tor', 'diploma'].concat(needOjt ? ['ojt'] : []);
}
function droneNote_(f) {                                  // shown in Monitoring > Remarks so ALD staff see the weight class at a glance
  if (String(f.licApplied || '') !== 'lic_rpa') return '';
  const kg = parseFloat(f.droneKg); if (!(kg > 0)) return '';
  return 'RPA drone: ' + kg + ' kg (' + (kg < 7 ? 'below 7 kg' : '7 kg or more') + ')';
}
function addMonitor_(reference, f, typeLabel, when, assignedName, walk) {
  const sh = monitorSheet_(), r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, MON_HEAD.length).setValues([[reference, fullName_(f), (typeLabel || '') + ' (PEL ' + (f.cat || '') + ')',
    when || new Date(), daysFormula_(r), '', 'Pending', tocidApplies_(f.cat, f.licApplied) ? 'Pending' : 'N/A', 'Pending', droneNote_(f), 'Pending', '', '', '', '', '', assignedName || '', walk ? 'YES' : '']]);   // only AMT / AMS go through TOCID
}

function monRow_(sh, reference) {                       // 1-based row number of a control no., or 0
  const last = sh.getLastRow(); if (last < 2) return 0;
  const refs = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < refs.length; i++) if (String(refs[i][0]) === String(reference)) return i + 2;
  return 0;
}
function setMonitor_(reference, header, value) {
  const sh = monitorSheet_(), r = monRow_(sh, reference);
  if (!r) return false;
  sh.getRange(r, MON_HEAD.indexOf(header) + 1).setValue(value); return true;
}
function logHandled_(sh, r, text) {       // "Handled By": who did which step (names come from the accounts)
  if (!r) return;
  const c = sh.getRange(r, MC.handled), old = String(c.getValue() || '');
  c.setValue((old ? old + '\n' : '') + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') + '  ' + text);
}
function addRemark_(sh, r, text) {
  const c = sh.getRange(r, MC.remarks), old = String(c.getValue() || '');
  c.setValue(old ? old + '\n' + text : text);
}

/* "Being Processed": who is working on an application (text in the cell, time in a cell note) */
function busyInfo_(sh, r) {
  const c = sh.getRange(r, MC.busy), t = String(c.getValue() || '').trim();
  if (!t) return { by: '', at: null };
  const note = c.getNote(), at = note ? new Date(note) : null;
  if (at && !isNaN(at) && (new Date() - at) > STALE_CLAIM_HOURS * 3600 * 1000) return { by: '', at: null, stale: true };
  return { by: t, at: at };
}
function setBusy_(sh, r, label) {
  const c = sh.getRange(r, MC.busy);
  if (!label) { c.clearContent(); c.clearNote(); return; }
  c.setValue(label + ' · ' + Utilities.formatDate(new Date(), TZ, 'MMM d, h:mm a')); c.setNote(new Date().toISOString());
}

/* ---------- application rows ---------- */
function appRows_() {
  const sheet = getSheet_();
  const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, head.length).getValues() : [];
  return { sheet: sheet, head: head, rows: rows, col: function (n) { return head.indexOf(n); } };
}
function groupOf_(A, idx) {          // indexes of every row that belongs to the same submission (bundled applications)
  const b = String(A.rows[idx][A.col('bundleId')] || ''), out = [];
  A.rows.forEach(function (r, i) { if (i === idx || (b && String(r[A.col('bundleId')]) === b)) out.push(i); });
  return out;
}

/* v6.5: only AMT and AMS applications (PEL Form 542, license applied for = AMT or AMS) are validated by TOCID.
   Everything else (every Form 541 application and every other Form 542 license) goes straight from the ALD initial approval to the Licensing Officer. */
function tocidApplies_(cat, licApplied) { return String(cat) === '542' && ['lic_amt', 'lic_ams'].indexOf(String(licApplied)) > -1; }
function rowNoTocid_(row, col) { return !tocidApplies_(/542/.test(txt_(row[col('formUsed')])) ? '542' : '541', txt_(row[col('licApplied')])); }
function roleLabel_(role) { return role === 'tocid' ? 'TOCID' : role === 'lo' ? 'Licensing Officer' : 'ALD'; }

function desk_(d) {
  const me = auth_(d);
  if (!me) return json_({ ok: false, code: 'AUTH', error: 'Your session ended or the account was changed. Please sign in again.' });
  d.role = me.role === 'admin' ? 'ald' : me.role;            // the admin works the ALD desk too
  d.who = me.name; d.me = me;
  const A = appRows_(), col = A.col, mon = monitorSheet_();

  if (d.op === 'deskList') {
    const mlast = mon.getLastRow();
    const mv = mlast > 1 ? mon.getRange(2, 1, mlast - 1, MON_HEAD.length).getValues() : [];
    const mn = mlast > 1 ? mon.getRange(2, MC.busy, mlast - 1, 1).getNotes() : [];
    const M = {};
    mv.forEach(function (r, i) {
      let by = String(r[MC.busy - 1] || '').trim();
      const at = mn[i][0] ? new Date(mn[i][0]) : null;
      if (by && at && !isNaN(at) && (new Date() - at) > STALE_CLAIM_HOURS * 3600 * 1000) by = '';
      M[String(r[0])] = { initial: String(r[MC.initial - 1]), tocid: String(r[MC.tocid - 1]), ktp: String(r[MC.ktp - 1]), busy: by,
                          lo: String(r[MC.lo - 1] || 'Pending'), loBy: String(r[MC.loBy - 1] || '') };
    });
    /* v6.3: who is an active ALD staff member (an assignment to anybody else counts as "unassigned" and is visible to all) */
    const aldNames = {}; accRows_().forEach(function (a) { if (a.role === 'ald' && a.active !== 'NO') aldNames[a.username] = a.name; });
    const out = [], done = [];
    for (let i = 0; i < A.rows.length; i++) {
      const r = A.rows[i];
      if (String(r[col('status')]).trim().toUpperCase() === 'REJECTED') continue;       // rejected = closed (Drive folder moved to Rejected Applications)
      const ref = txt_(r[col('reference')]), m = M[ref] || { initial: 'Pending', tocid: String(r[col('tocidStatus')]) ? 'Approved' : 'Pending', ktp: 'Pending', busy: '', lo: 'Pending', loBy: '' };
      const asg = txt_(r[col('assignedTo')]), walk = txt_(r[col('walkIn')]) === 'YES', asgActive = !!(asg && aldNames[asg]);
      /* ALD staff only see the initial approvals assigned to them (walk-ins are visible to all ALD staff);
         once the initial approval is given every application is on every list. Admin, TOCID and the Licensing Officers see all. */
      if (me.role === 'ald' && m.initial === 'Pending' && !walk && asgActive && asg !== me.username) continue;
      const t = r[col('submittedAt')] instanceof Date ? r[col('submittedAt')] : new Date(txt_(r[col('submittedAt')]));
      const item = { reference: ref, day: txt_(r[col('submitDay')]) || txt_(r[col('submittedAt')]).slice(0, 10),
                 submittedAt: r[col('submittedAt')] instanceof Date ? r[col('submittedAt')].toISOString() : txt_(r[col('submittedAt')]),
                 name: txt_(r[col('lastName')]) + ', ' + txt_(r[col('firstName')]),
                 type: txt_(r[col('appTypeLabel')]) + ' (' + txt_(r[col('formUsed')]) + ')',
                 school: txt_(r[col('school')]), gradYear: txt_(r[col('gradYear')]), degree: txt_(r[col('degree')]),
                 hasDraft: !!r[col('draftLink')], lo: m.lo, loBy: m.loBy, hasF001: !!r[col('f001Link')], initial: m.initial, tocid: (rowNoTocid_(r, col) && m.tocid !== 'Approved') ? 'N/A' : m.tocid, ktp: m.ktp, busy: m.busy,
                 is541: /541/.test(txt_(r[col('formUsed')])), noTocid: rowNoTocid_(r, col),
                 walkIn: walk, assignedTo: asgActive ? asg : '', assignedName: asgActive ? aldNames[asg] : '', mine: asg === me.username,
                 _t: isNaN(t) ? 0 : t.getTime(), _i: i };
      (m.ktp === 'Approved' ? done : out).push(item);
    }
    done.splice(0, Math.max(0, done.length - 200));                         // keep the 200 most recent finished ones
    const all = out.concat(done);
    /* v6.3 order: WALK-INs first, then first submitted = top */
    all.sort(function (x, y) { return (y.walkIn ? 1 : 0) - (x.walkIn ? 1 : 0) || (x._t - y._t) || (x._i - y._i); });
    all.forEach(function (x) { delete x._t; delete x._i; });
    return json_({ ok: true, rows: all, canAssign: me.role === 'admin' || me.role === 'lo' });
  }

  /* ---- v6.3 assignment of the initial approvals (admin + Licensing Officer) ---- */
  if (d.op === 'deskAssignInfo' || d.op === 'deskAssign' || d.op === 'deskRedistribute') {
    if (me.role !== 'admin' && me.role !== 'lo') return json_({ ok: false, error: 'Only the administrator or a Licensing Officer can assign applications.' });
    const staff = aldStaff_();
    const byU = {}; staff.forEach(function (a) { byU[a.username] = a; });
    const pendingIdx = function () {                                        // rows still waiting for the initial approval
      const out = [];
      A.rows.forEach(function (r, i) {
        const st = String(r[col('status')]).trim().toUpperCase();
        if (st === 'REJECTED' || st === 'PROCESSED') return;
        const mr = monRow_(mon, txt_(r[col('reference')]));
        if (mr && String(mon.getRange(mr, MC.initial).getValue()) !== 'Pending') return;
        out.push(i);
      });
      return out;
    };
    const apply = function (idxs, acc) {                                    // whole submission (bundle) moves together
      const seen = {};
      idxs.forEach(function (i0) {
        groupOf_(A, i0).forEach(function (i) {
          if (seen[i]) return; seen[i] = true;
          A.sheet.getRange(i + 2, col('assignedTo') + 1, 1, 2).setValues([[acc.username, new Date()]]);
          const ref2 = txt_(A.rows[i][col('reference')]), mr = monRow_(mon, ref2);
          if (mr) { mon.getRange(mr, MC.assigned).setValue(acc.name); logHandled_(mon, mr, 'Assigned to ' + acc.name + ' by ' + d.me.name); }
        });
      });
      return Object.keys(seen).length;
    };
    if (d.op === 'deskAssignInfo') {
      const idx = pendingIdx(), cnt = {};
      const items = idx.map(function (i) {
        const r = A.rows[i], asg = txt_(r[col('assignedTo')]), ok = !!byU[asg];
        if (ok) cnt[asg] = (cnt[asg] || 0) + 1; else cnt[''] = (cnt[''] || 0) + 1;
        return { reference: txt_(r[col('reference')]), name: txt_(r[col('lastName')]) + ', ' + txt_(r[col('firstName')]), type: txt_(r[col('appTypeLabel')]) + ' (' + txt_(r[col('formUsed')]) + ')',
                 submittedAt: r[col('submittedAt')] instanceof Date ? r[col('submittedAt')].toISOString() : txt_(r[col('submittedAt')]),
                 assignedTo: ok ? asg : '', assignedName: ok ? byU[asg].name : '', walkIn: txt_(r[col('walkIn')]) === 'YES', _i: i };
      });
      items.sort(function (x, y) { return (new Date(x.submittedAt) - new Date(y.submittedAt)) || (x._i - y._i); });
      items.forEach(function (x) { delete x._i; });
      return json_({ ok: true, staff: staff.map(function (a) { return { username: a.username, name: a.name, pending: cnt[a.username] || 0 }; }), unassigned: cnt[''] || 0, items: items });
    }
    if (d.op === 'deskAssign') {
      const to = byU[String(d.to || '')];
      if (!to) return json_({ ok: false, error: 'Choose an active ALD staff member.' });
      const want = {}; (d.refs || []).forEach(function (x) { want[String(x)] = true; });
      const ok = pendingIdx().filter(function (i) { return want[txt_(A.rows[i][col('reference')])]; });
      if (!ok.length) return json_({ ok: false, error: 'None of the selected applications is waiting for the initial approval any more.' });
      const n = apply(ok, to); SpreadsheetApp.flush();
      return json_({ ok: true, moved: n });
    }
    if (d.op === 'deskRedistribute') {                                      // everything pending on one person is spread equally over the others
      const from = String(d.from || '');
      let targets = (Array.isArray(d.to) && d.to.length ? d.to : staff.map(function (a) { return a.username; })).filter(function (u) { return byU[u] && u !== from; });
      if (!targets.length) return json_({ ok: false, error: 'There is no other active ALD staff member to give them to.' });
      const idx = pendingIdx().filter(function (i) { const a = txt_(A.rows[i][col('assignedTo')]); return from === '' ? !byU[a] : a === from; });
      if (!idx.length) return json_({ ok: false, error: 'That person has nothing pending.' });
      const load = {}; targets.forEach(function (u) { load[u] = 0; });
      pendingIdx().forEach(function (i) { const a = txt_(A.rows[i][col('assignedTo')]); if (load[a] !== undefined) load[a]++; });
      let moved = 0; const seenB = {};
      idx.forEach(function (i) {
        const g = groupOf_(A, i).join(','); if (seenB[g]) return; seenB[g] = true;
        targets.sort(function (x, y) { return load[x] - load[y] || (x < y ? -1 : 1); });
        const u = targets[0]; load[u]++; moved += apply([i], byU[u]);
      });
      SpreadsheetApp.flush();
      return json_({ ok: true, moved: moved });
    }
  }

  const ref = String(d.reference || '');
  let idx = -1;
  for (let i = 0; i < A.rows.length; i++) if (txt_(A.rows[i][col('reference')]) === ref) { idx = i; break; }
  if (idx < 0) return json_({ ok: false, error: 'Application not found (it may have been rejected).' });
  const row = A.rows[idx], group = groupOf_(A, idx);
  const refsOf = function () { return group.map(function (i) { return txt_(A.rows[i][col('reference')]); }); };
  const mrow = monRow_(mon, ref);
  const label = String(d.who || 'Someone').slice(0, 40) + ' (' + roleLabel_(d.role) + ')';

  if (d.op === 'deskGet') {
    const dl = txt_(row[col('draftLink')]), id = fileId_(dl);
    if (!id) return json_({ ok: false, error: 'No draft file is stored for this application (it was submitted before drafts were saved).' });
    const att = {};
    [['ground', 'groundLink'], ['diploma', 'diplomaLink'], ['tor', 'torLink'], ['ojt', 'ojtLink'], ['training', 'trainingLink'], ['psa', 'psaLink'], ['medical', 'medicalLink'], ['dronephoto', 'droneLink'], ['dronespec', 'droneSpecLink'], ['coe', 'coeLink'], ['f001', 'f001Link'], ['permit', 'permitLink']].forEach(function (p) {
      const fid = fileId_(row[col(p[1])]);
      if (fid) { try { const b = DriveApp.getFileById(fid).getBlob(); att[p[0]] = { mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) }; } catch (e) { console.error(e); } }
    });
    const bi = mrow ? busyInfo_(mon, mrow) : { by: '' };
    return json_({ ok: true, draft: DriveApp.getFileById(id).getBlob().getDataAsString(), attachments: att,
                   info: { school: txt_(row[col('school')]), gradYear: txt_(row[col('gradYear')]), degree: txt_(row[col('degree')]), email: txt_(row[col('email')]),
                           submittedAt: row[col('submittedAt')] instanceof Date ? row[col('submittedAt')].toISOString() : txt_(row[col('submittedAt')]),
                           busy: bi.by, walkIn: txt_(row[col('walkIn')]) === 'YES', assignedTo: txt_(row[col('assignedTo')]), compiledLink: txt_(row[col('compiledLink')]), permitVenue: txt_(row[col('permitVenue')]) } });
  }

  if (d.op === 'deskClaim') {
    if (!mrow) return json_({ ok: true });
    const bi = busyInfo_(mon, mrow);
    if (bi.by && bi.by.indexOf(label) !== 0 && !d.force) return json_({ ok: true, taken: true, by: bi.by });
    setBusy_(mon, mrow, label); return json_({ ok: true });
  }
  if (d.op === 'deskRelease') {
    if (mrow) { const bi = busyInfo_(mon, mrow); if (!bi.by || bi.by.indexOf(label) === 0) setBusy_(mon, mrow, ''); }
    return json_({ ok: true });
  }

  const setGroup = function (header, value) { refsOf().forEach(function (r) { setMonitor_(r, header, value); }); };
  const releaseGroup = function () { refsOf().forEach(function (r) { const mr = monRow_(mon, r); if (mr) setBusy_(mon, mr, ''); }); };
  const setStatus = function (v) { group.forEach(function (i) { A.sheet.getRange(i + 2, col('status') + 1).setValue(v); }); };

  /* v6.3 walk-in flag: an ALD staff member marks the applicant as a walk-in (number 1 priority, visible to all ALD staff) */
  const setWalkin = function (on) {
    group.forEach(function (i) { A.sheet.getRange(i + 2, col('walkIn') + 1).setValue(on ? 'YES' : ''); });
    refsOf().forEach(function (r) { const mr = monRow_(mon, r); if (mr) { mon.getRange(mr, MC.walkin).setValue(on ? 'YES' : ''); logHandled_(mon, mr, (on ? 'Marked WALK-IN: ' : 'Walk-in mark removed: ') + d.me.name); } });
    if (on) { try { sendQueuedFor_(refsOf()); } catch (qe) { console.error('walk-in e-mail: ' + qe); } }   // v6.9: a walk-in's notification goes out now, not at the next timed run
  };
  if (d.op === 'deskWalkin' && d.role === 'ald') {
    if (mrow && String(mon.getRange(mrow, MC.initial).getValue()) === 'Approved') return json_({ ok: false, error: 'The initial approval was already given, so the walk-in mark can no longer be changed.' });
    const now = d.walkin === true || d.walkin === 'true';
    if ((txt_(row[col('walkIn')]) === 'YES') !== now) setWalkin(now);
    SpreadsheetApp.flush(); return json_({ ok: true, walkIn: now });
  }

  if (d.op === 'deskInitial' && d.role === 'ald') {
    const asg = txt_(row[col('assignedTo')]), isWalk = txt_(row[col('walkIn')]) === 'YES' || d.walkin === true;
    if (d.me.role === 'ald' && asg && asg !== d.me.username && !isWalk && aldStaff_().some(function (a) { return a.username === asg; }))
      return json_({ ok: false, error: 'This application is assigned to another ALD staff member. Ask the administrator or a Licensing Officer to assign it to you.' });
    if (d.walkin === true && txt_(row[col('walkIn')]) !== 'YES') setWalkin(true);
    setGroup('ALD Initial Approval', 'Approved'); refsOf().forEach(function (r) { logHandled_(mon, monRow_(mon, r), 'ALD initial approval: ' + d.me.name); }); setStatus('IN REVIEW'); releaseGroup(); SpreadsheetApp.flush();
    return json_({ ok: true });
  }

  if (d.op === 'deskApprove' && d.role === 'ald') {
    const loNow = mrow ? String(mon.getRange(mrow, MC.lo).getValue() || 'Pending') : 'Pending';
    if (loNow !== 'Eligible' && loNow !== 'N/A')
      return json_({ ok: false, error: loNow === 'Ineligible' ? 'The Licensing Officer marked this applicant INELIGIBLE. Reject the application (or ask the Licensing Officer to re-evaluate).' : 'The Licensing Officer has not approved Form 001 yet.' });
    refsOf().forEach(function (r) { logHandled_(mon, monRow_(mon, r), 'ALD approval for KTP: ' + d.me.name); });
    setGroup('ALD Approval for KTP', 'Approved'); setStatus('PROCESSED'); releaseGroup(); SpreadsheetApp.flush();
    return json_({ ok: true });
  }

  /* ---- v6.1 Knowledge Test Permit: step 1 = reserve the control no. + Temporary PEL (and write the register row) ---- */
  if (d.op === 'deskPermitReserve' && d.role === 'ald') {
    if (!mrow || String(mon.getRange(mrow, MC.ktp).getValue()) !== 'Approved') return json_({ ok: false, error: 'Approve the application for KTP first.' });
    const nm = permitName_(row, col);
    if (!REGISTER_SHEET_ID && !REGISTERS.MECH.id) return json_({ ok: false, error: 'The control-number register is not set up yet. Put the register Google Sheet ID in REGISTER_SHEET_ID (apps-script.gs) and redeploy.' });
    const code = String(d.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return json_({ ok: false, error: 'No permit code for this application type.' });
    /* v6.3: applicants who already hold a PEL keep it; only Original applicants get a new Temporary PEL */
    const at0 = txt_(row[col('appType')]), isOrig = at0 ? at0 === 'original' : txt_(row[col('action')]) === 'original';
    const ownPel = String(txt_(row[col('licenseNo')])).replace(/\D/g, '');
    const wantPel = (!isOrig && REUSE_EXISTING_PEL && ownPel) ? ownPel : '';
    const lock = LockService.getScriptLock(); lock.waitLock(25000);
    try {
      const reg = registerSheet_(code), C = registerCols_(reg), key = PERMIT_REGISTER[code] || 'OTHER';
      const have = txt_(row[col('permitCtrl')]);
      if (have) {                                           // already reserved: reuse the number, but repair a wrong Temporary PEL (e.g. 2010185)
        let pel = txt_(row[col('permitPel')]), fixed = false;
        if (wantPel) { if (pel !== wantPel) { pel = wantPel; fixed = true; } }
        else if (!tempPelOk_(reg, C, key, pel)) { pel = String(tempPelNext_(reg, C, key)); tempPelSave_(key, pel); fixed = true; }
        if (fixed) {
          registerSetPel_(reg, C, have, pel);
          A.sheet.getRange(idx + 2, col('permitPel') + 1).setValue(pel);
          logHandled_(mon, mrow, 'Temporary PEL corrected to ' + pel + ': ' + d.me.name);
          SpreadsheetApp.flush();
        }
        return json_({ ok: true, already: true, fixed: fixed, ctrl: have, pel: pel, name: nm });
      }
      const now = new Date(), ym = Utilities.formatDate(now, TZ, 'yyyy-MM');
      const seq = registerNextSeq_(reg, C, code);
      const pel = wantPel || String(tempPelNext_(reg, C, key));
      const ctrl = code + '-AKTP-' + ym + '-' + seq;
      registerAppend_(reg, { date: now, pel: pel, ctrl: ctrl, name: nm, school: txt_(row[col('school')]), facility: REGISTER_TEST_FACILITY, evaluator: initials_(d.me.name),
        type: code + '-' + (PERMIT_TYPE_LETTER[txt_(row[col('appType')])] || ''), rating: permitRatingText_(row, col, code) });
      if (!wantPel) tempPelSave_(key, pel);
      A.sheet.getRange(idx + 2, col('permitCtrl') + 1, 1, 2).setValues([[ctrl, pel]]);
      mon.getRange(mrow, MC.permitNo).setValue(ctrl);
      SpreadsheetApp.flush();
      return json_({ ok: true, ctrl: ctrl, pel: pel, name: nm, ownPel: !!wantPel });
    } finally { lock.releaseLock(); }
  }

  /* v6.3: the compiled PDF (PEL form + data flow + attachments + Form 001 + KTP) is stored in the applicant's folder */
  if (d.op === 'deskCompiledSave' && d.role === 'ald') {
    if (!d.pdf) return json_({ ok: false, error: 'The compiled PDF was not received.' });
    let folder = null;
    try { const fid = txt_(row[col('folderId')]); if (fid) folder = DriveApp.getFolderById(fid); } catch (e) {}
    if (!folder) { const pid = fileId_(row[col('draftLink')]); if (pid) { try { const ps = DriveApp.getFileById(pid).getParents(); if (ps.hasNext()) folder = ps.next(); } catch (e) {} } }
    if (!folder) folder = DriveApp.getFolderById(FOLDER_ID);
    const oldC = fileId_(row[col('compiledLink')]);
    const link = saveFile_(folder, d.pdf, 'application/pdf', ref + '_COMPILED_FORMS' + (txt_(row[col('permitCtrl')]) ? '_' + txt_(row[col('permitCtrl')]) : '') + '.pdf');
    if (oldC) { try { DriveApp.getFileById(oldC).setTrashed(true); } catch (e) {} }
    A.sheet.getRange(idx + 2, col('compiledLink') + 1).setValue(link);
    logHandled_(mon, mrow, 'Compiled PDF saved: ' + d.me.name);
    /* v6.3: e-mail the applicant their compiled application (PEL form, data flow, attachments, Form 001, KTP) */
    let emailed = false;
    const to = txt_(row[col('email')]);
    if (to) {
      try {
        const nmE = [txt_(row[col('firstName')]), txt_(row[col('lastName')])].filter(String).join(' '), ctrlE = txt_(row[col('permitCtrl')]);
        MailApp.sendEmail({ to: to, subject: 'Your CAAP application and Knowledge Test Permit' + (ctrlE ? ' - ' + ctrlE : ''),
          body: 'Dear ' + nmE + ',\n\nYour application has been approved. Attached is your compiled application (application forms, data flow, requirements, Form 001' + (ctrlE ? ' and your Knowledge Test Permit ' + ctrlE : '') + ').\n\nCivil Aviation Authority of the Philippines\nLicensing',
          attachments: [Utilities.newBlob(Utilities.base64Decode(d.pdf), 'application/pdf', ref + '_COMPILED_FORMS' + (ctrlE ? '_' + ctrlE : '') + '.pdf')], name: 'CAAP Licensing' });
        emailed = true; logHandled_(mon, mrow, 'Compiled application e-mailed to the applicant');
      } catch (e) { console.error('applicant e-mail failed: ' + e); }
    }
    SpreadsheetApp.flush();
    return json_({ ok: true, link: link, emailed: emailed });
  }

  /* step 2 = the rendered PDF arrives: save it in the applicant's folder, fill the Monitoring sheet */
  if (d.op === 'deskPermitSave' && d.role === 'ald') {
    const ctrl = txt_(row[col('permitCtrl')]);
    if (!ctrl) return json_({ ok: false, error: 'No control number was reserved for this application.' });
    if (!d.pdf) return json_({ ok: false, error: 'The permit PDF was not received.' });
    let folder = null;
    try { const fid = txt_(row[col('folderId')]); if (fid) folder = DriveApp.getFolderById(fid); } catch (e) {}
    if (!folder) { const pid = fileId_(row[col('draftLink')]); if (pid) { try { const ps = DriveApp.getFileById(pid).getParents(); if (ps.hasNext()) folder = ps.next(); } catch (e) {} } }
    if (!folder) folder = DriveApp.getFolderById(FOLDER_ID);
    const oldId = fileId_(row[col('permitLink')]);
    const link = saveFile_(folder, d.pdf, 'application/pdf', ref + '_KTP_PERMIT_' + ctrl + '.pdf');
    if (oldId) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch (e) {} }
    const whenP = new Date();
    A.sheet.getRange(idx + 2, col('permitLink') + 1, 1, 2).setValues([[link, whenP]]);
    A.sheet.getRange(idx + 2, col('permitVenue') + 1).setValue(String(d.venue || '').slice(0, 300));          // custom address printed on the KTP ('' = default)
    mon.getRange(mrow, MC.permitNo, 1, 3).setValues([[ctrl, whenP, link]]);
    logHandled_(mon, mrow, 'KTP permit generated: ' + d.me.name);
    SpreadsheetApp.flush();
    return json_({ ok: true, link: link, ctrl: ctrl });
  }

  if (d.op === 'deskLoDecide') {
    if (d.role !== 'lo') return json_({ ok: false, error: 'Only a Licensing Officer can evaluate Form 001.' });
    const dec = d.decision === 'eligible' ? 'Eligible' : d.decision === 'ineligible' ? 'Ineligible' : '';
    if (!dec) return json_({ ok: false, error: 'Choose eligible or ineligible.' });
    if (!mrow) return json_({ ok: false, error: 'No Monitoring row for this application.' });
    if (String(mon.getRange(mrow, MC.initial).getValue()) !== 'Approved') return json_({ ok: false, error: 'ALD staff have not given the initial approval yet.' });
    if (!rowNoTocid_(row, col) && String(mon.getRange(mrow, MC.tocid).getValue()) !== 'Approved') return json_({ ok: false, error: 'TOCID has not validated this application yet.' });
    if (String(mon.getRange(mrow, MC.ktp).getValue()) === 'Approved') return json_({ ok: false, error: 'Already approved for KTP.' });
    const rem = String(d.remarks || '').trim();
    if (dec === 'Ineligible' && rem.length < 3) return json_({ ok: false, error: 'Please write the reason in Remarks for an ineligible applicant.' });
    if (!d.f001) return json_({ ok: false, error: 'The evaluated Form 001 was not received.' });
    // save the evaluated Form 001 in the applicant's folder (the blank one made at submission is replaced)
    let folder = null;
    try { const fid = txt_(row[col('folderId')]); if (fid) folder = DriveApp.getFolderById(fid); } catch (e) {}
    const oldId = fileId_(row[col('f001Link')]);
    if (!folder && oldId) { try { const ps = DriveApp.getFileById(oldId).getParents(); if (ps.hasNext()) folder = ps.next(); } catch (e) {} }
    if (!folder) folder = DriveApp.getFolderById(FOLDER_ID);
    const newLink = saveFile_(folder, d.f001, 'application/pdf', ref + '_Form001_' + dec.toUpperCase() + '.pdf');
    if (oldId) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch (e) {} }
    const whenLo = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    group.forEach(function (i) {
      A.sheet.getRange(i + 2, col('f001Link') + 1, 1, 5).setValues([[newLink, dec, d.me.name + ', ' + d.me.position, whenLo, rem]]);
    });
    setGroup('Licensing Officer Evaluation', dec);
    setGroup('Evaluated By (Licensing Officer)', d.me.name + ', ' + d.me.position);
    refsOf().forEach(function (r) {
      const mr = monRow_(mon, r); if (!mr) return;
      logHandled_(mon, mr, 'Form 001 ' + dec.toUpperCase() + ': ' + d.me.name + ', ' + d.me.position);
      if (dec === 'Ineligible') addRemark_(mon, mr, 'INELIGIBLE (' + whenLo + ', ' + d.me.name + '): ' + rem);
    });
    releaseGroup(); SpreadsheetApp.flush();
    return json_({ ok: true, decision: dec });
  }
  if (d.role === 'lo' && d.op === 'deskReject') return json_({ ok: false, error: 'Licensing Officers mark an applicant Ineligible instead of rejecting.' });

  if (d.role === 'tocid' && rowNoTocid_(row, col) && (d.op === 'deskTocidSave' || d.op === 'deskReject'))
    return json_({ ok: false, error: 'Only AMT and AMS applications are validated by TOCID.' });

  if (d.op === 'deskTocidSave' && d.role === 'tocid') {
    const t = d.tocid || {};
    if (!t.atoc || !t.diploma || !t.tor) return json_({ ok: false, error: 'Stamp is incomplete.' });
    const id = fileId_(row[col('draftLink')]);
    if (!id) return json_({ ok: false, error: 'No stored draft to override.' });
    JSON.parse(String(d.draft));                          // refuse anything that is not valid JSON
    DriveApp.getFileById(id).setContent(String(d.draft)); // override the stored draft
    const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    group.forEach(function (i) { A.sheet.getRange(i + 2, col('tocidStatus') + 1, 1, 3).setValues([['DONE', stamp, JSON.stringify(t)]]); });
    setGroup('TOCID Validation', 'Approved'); refsOf().forEach(function (r) { logHandled_(mon, monRow_(mon, r), 'TOCID validation: ' + d.me.name); }); releaseGroup(); SpreadsheetApp.flush();
    return json_({ ok: true });
  }

  /* ---- REJECT at any step: move the applicant's Drive folder to "Rejected Applications", free them to apply again, e-mail them ---- */
  if (d.op === 'deskReject') {
    const reason = String(d.reason || '').trim();
    if (reason.length < 3) return json_({ ok: false, error: 'Please give a reason.' });
    const stage = { initial: 'ALD Initial Approval', tocid: 'TOCID Validation', final: 'ALD Approval for KTP' }[d.stage];
    if (!stage || (d.role === 'tocid') !== (d.stage === 'tocid')) return json_({ ok: false, error: 'This step cannot be rejected from here.' });
    const email = txt_(row[col('email')]), who = [txt_(row[col('firstName')]), txt_(row[col('lastName')])].join(' ');
    const school = txt_(row[col('school')]), year = txt_(row[col('gradYear')]);

    // 1. v6.6: MOVE the applicant's Drive folder into "Rejected Applications" (nothing is deleted); file links in the sheet keep working
    const when = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    const note = 'REJECTED APPLICATION\n\nControl no.: ' + ref + '\nApplicant: ' + who + '\nRejected at: ' + stage + '\nBy: ' + roleLabel_(d.role) + (d.who ? ' - ' + d.who : '') +
                 '\nDate: ' + when + '\nReason: ' + reason + '\n';
    let moved = 'none';
    try {
      const root = subfolder_(DriveApp.getFolderById(FOLDER_ID), REJECTED_FOLDER_NAME);
      const fid = txt_(row[col('folderId')]);
      if (fid) {
        const folder = DriveApp.getFolderById(fid), parents = folder.getParents();
        try { folder.createFile('REJECTION_NOTE.txt', note); } catch (e) { console.error('rejection note not written: ' + e); }
        folder.moveTo(root); moved = 'folder';
        if (parents.hasNext()) {                                       // tidy: remove the date folder when it is now empty (it holds nothing)
          const dayF = parents.next();
          if (dayF.getId() !== FOLDER_ID && dayF.getId() !== root.getId() && !dayF.getFiles().hasNext() && !dayF.getFolders().hasNext()) dayF.setTrashed(true);
        }
      } else {                                                         // older submissions without a folder: gather this applicant's files in a new folder
        const dest = root.createFolder(safe_(txt_(row[col('lastName')])) + '-' + safe_(txt_(row[col('firstName')])) + '_' + ref);
        ['pdfLink', 'photoLink', 'signatureLink', 'draftLink', 'diplomaLink', 'torLink', 'ojtLink', 'groundLink', 'trainingLink', 'psaLink', 'medicalLink', 'droneLink', 'droneSpecLink', 'coeLink'].forEach(function (k) {
          group.forEach(function (i) { const f = fileId_(A.rows[i][col(k)]); if (f) { try { DriveApp.getFileById(f).moveTo(dest); moved = 'files'; } catch (e) {} } });
        });
        try { dest.createFile('REJECTION_NOTE.txt', note); } catch (e) {}
        if (moved === 'none') moved = 'files';
      }
    } catch (e) { console.error('folder not moved: ' + e); moved = 'failed'; }

    // 2. sheets: status REJECTED frees the applicant (one-pending rule and the daily limit both ignore it)
    group.forEach(function (i) {
      A.sheet.getRange(i + 2, col('status') + 1).setValue('REJECTED');
      A.sheet.getRange(i + 2, col('rejectedAt') + 1, 1, 3).setValues([[when, roleLabel_(d.role) + (d.who ? ' - ' + d.who : ''), stage + ': ' + reason]]);
    });
    refsOf().forEach(function (r) {
      const mr = monRow_(mon, r); if (!mr) return;
      mon.getRange(mr, MON_HEAD.indexOf(stage) + 1).setValue('Rejected');
      setBusy_(mon, mr, '');
      addRemark_(mon, mr, 'REJECTED at ' + stage + ' (' + when + '): ' + reason);
    });

    // 3. e-mail the applicant
    let emailed = false;
    if (email) {
      try {
        const body = d.template === 'notOnList'
          ? 'Dear ' + who + ',\n\nWe checked your application against the list of graduates of ' + (school || 'the school you indicated') +
            (year ? ' for the year ' + year : '') + ' and could not find your name on it.\n\n' +
            'Because of this your application has been closed. You may apply again at any time. Please make sure the school and the year of graduation are correct, and attach a clear Certificate of Graduation / Diploma and Transcript of Records.\n\n' +
            (reason && reason.length > 3 && reason !== 'Name not found on the list of graduates' ? 'Note from the licensing office: ' + reason + '\n\n' : '') +
            'Civil Aviation Authority of the Philippines\nLicensing'
          : 'Dear ' + who + ',\n\nYour application could not be accepted at the step "' + stage + '".\n\nReason: ' + reason +
            '\n\nYour submission has been closed. You may apply again after correcting the matter above.\n\nCivil Aviation Authority of the Philippines\nLicensing';
        MailApp.sendEmail({ to: email, subject: 'Your CAAP license application was not accepted', body: body, name: 'CAAP Licensing' });
        emailed = true;
      } catch (e) { console.error('applicant e-mail failed: ' + e); }
    }
    SpreadsheetApp.flush();
    return json_({ ok: true, emailed: emailed, moved: moved });
  }

  return json_({ ok: false, error: 'Unknown request.' });
}

/* ---------- KTP permit helpers ---------- */
function permitName_(row, col) {       // FIRST M. LAST, the way the register writes names
  const mid = txt_(row[col('middleName')]).trim().split(/\s+/).filter(function (x) { return x; }).map(function (w) { return w.charAt(0) + '.'; }).join(' ');
  return [txt_(row[col('firstName')]).trim(), mid, txt_(row[col('lastName')]).trim()].filter(function (x) { return x; }).join(' ').toUpperCase();
}
function permitRatingText_(row, col, code) {
  const r = txt_(row[col('ratingInvolved')]);
  if (code !== 'AMT') return '';
  const af = /airframe/.test(r), pp = /powerplant/.test(r);
  return af && pp ? 'A&P' : af ? 'A' : pp ? 'P' : 'A&P';
}
function initials_(n) { return String(n || '').split(/\s+/).filter(function (w) { return /^[A-Za-z]/.test(w); }).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
function registerSheet_(code) {
  const key = PERMIT_REGISTER[code] || 'OTHER', R = REGISTERS[key], ss = SpreadsheetApp.openById(R.id || REGISTER_SHEET_ID);
  const sh = ss.getSheets().filter(function (t) { return t.getSheetId() === R.gid; })[0];
  if (!sh) throw new Error('Register tab (gid ' + R.gid + ') for ' + key + ' not found in the register file.');
  return sh;
}
/* column positions (0-based) from the header row. The three tabs differ: the date header is "Date", blank or "Column 1";
   "Test Facility" sits before COMPANY/SCHOOL on the Mechanics tab and last (KNOWLEDGE TEST FACILITY) on the others;
   only Mechanics has EVALUATOR. The header row is the first row that contains "control" or "AKTP". */
function registerCols_(sh) {
  const lastC = Math.max(sh.getLastColumn(), 8), top = sh.getRange(1, 1, Math.min(5, Math.max(sh.getLastRow(), 1)), lastC).getValues();
  let hr = -1;
  for (let i = 0; i < top.length && hr < 0; i++) if (top[i].some(function (h) { return /control|aktp/i.test(String(h)); })) hr = i;
  if (hr < 0) return { head: 0, date: 0, pel: 1, ctrl: 2, name: 3, school: 4, type: 5, rating: 6, facility: 7, evaluator: -1 };
  const h = top[hr].map(function (x) { return String(x).toLowerCase().replace(/\s+/g, ' ').trim(); });
  const f = function (re) { for (let i = 0; i < h.length; i++) if (re.test(h[i])) return i; return -1; };
  const dt = f(/date/);
  return { head: hr + 1, date: dt > -1 ? dt : 0, pel: f(/pel/), ctrl: f(/control|aktp/), name: f(/^name/), school: f(/company|school/),
           type: f(/applied|license|licence/), rating: f(/rating/), facility: f(/facility/), evaluator: f(/evaluat/) };
}
/* next AKTP running number of this register tab (the last "...-AKTP-yyyy-mm-<n>" + 1) */
function registerNextSeq_(sh, C, code) {
  const last = sh.getLastRow(), n = last - C.head;
  let seq = 0;
  if (n > 0) sh.getRange(C.head + 1, 1, n, C.ctrl + 1).getValues().forEach(function (r) {
    const m = String(r[C.ctrl] || '').toUpperCase().match(/-AKTP-\d{4}-\d{2}-(\d+)$/);
    if (m) seq = Math.max(seq, parseInt(m[1], 10));
  });
  if (!seq) throw new Error('The ' + (PERMIT_REGISTER[code] || 'OTHER') + ' register has no earlier entry to continue the control numbering from. Add one row by hand first.');
  return seq + 1;
}
/* last row of the register that really holds an entry (control no. or name). A row that only has a date does not count. */
function registerLastUsed_(sh, C) {
  const last = sh.getLastRow(); if (last <= C.head) return C.head;
  const w = Math.max(C.ctrl, C.name) + 1, v = sh.getRange(C.head + 1, 1, last - C.head, w).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][C.ctrl] || '').trim() || String(v[i][C.name] || '').trim()) return C.head + 1 + i;
  return C.head;
}
function registerAppend_(sh, o) {
  const C = registerCols_(sh), n = Math.max(sh.getLastColumn(), 8), row = new Array(n).fill(''), prev = registerLastUsed_(sh, C), at = prev + 1;
  const put = function (i, v) { if (i > -1) row[i] = v; };
  put(C.date, o.date); put(C.pel, o.pel); put(C.ctrl, o.ctrl); put(C.name, String(o.name || '').toUpperCase()); put(C.school, String(o.school || '').toUpperCase());
  put(C.type, o.type); put(C.rating, o.rating); put(C.facility, o.facility); put(C.evaluator, o.evaluator);
  if (prev > C.head) sh.getRange(prev, 1, 1, n).copyTo(sh.getRange(at, 1, 1, n), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);   // same look as the row above
  sh.getRange(at, 1, 1, n).setValues([row]);
}
function registerSetPel_(sh, C, ctrl, pel) {              // correct the PEL cell of an existing register row (found by its control no.)
  const last = sh.getLastRow(); if (last <= C.head) return false;
  const v = sh.getRange(C.head + 1, C.ctrl + 1, last - C.head, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() === ctrl) { sh.getRange(C.head + 1 + i, C.pel + 1).setValue(pel); return true; }
  return false;
}

/* ---- Temporary PEL series (v6.3) ----
   The series is remembered per register tab in the script properties (tempPel_MECH / _PILOT / _OTHER). The first time (or
   after you clear the property) it is read from the register: the newest PEL that has a neighbour within 30 numbers among
   the 15 rows above it. Isolated numbers (real PELs of existing holders: 148931, 12792 ... or a typo such as 2010185) are
   ignored. Numbers someone typed in by hand up to +300 above the series are picked up as well. */
function tempPelValues_(sh, C) {
  const last = sh.getLastRow(), n = Math.min(400, last - C.head); if (n <= 0 || C.pel < 0) return [];
  return sh.getRange(last - n + 1, C.pel + 1, n, 1).getValues().map(function (r) { return parseInt(String(r[0]).replace(/\D/g, ''), 10) || 0; });
}
function tempPelBase_(sh, C, key) {
  const vals = tempPelValues_(sh, C), props = PropertiesService.getScriptProperties();
  let base = Math.max(parseInt(props.getProperty('tempPel_' + key) || '0', 10) || 0, TEMP_PEL_LAST[key] || 0);
  if (!base) {
    for (let i = vals.length - 1; i >= 0 && !base; i--) {
      if (!vals[i]) continue;
      for (let j = i - 1; j >= Math.max(0, i - 15); j--) if (vals[j] && Math.abs(vals[i] - vals[j]) <= 30) { base = vals[i]; break; }
    }
    if (!base) throw new Error('Cannot tell which Temporary PEL series the ' + key + ' register uses (no two recent rows have close numbers). Put the last Temporary PEL of that tab in TEMP_PEL_LAST (apps-script.gs) and redeploy.');
  }
  let top = base;
  vals.forEach(function (v) { if (v > top && v <= base + 300) top = v; });
  return top;
}
function tempPelNext_(sh, C, key) { return tempPelBase_(sh, C, key) + 1; }
function tempPelSave_(key, pel) { PropertiesService.getScriptProperties().setProperty('tempPel_' + key, String(pel)); }
function tempPelOk_(sh, C, key, pel) {                    // is this number inside the current series?
  const p = parseInt(String(pel).replace(/\D/g, ''), 10) || 0, base = tempPelBase_(sh, C, key);
  return p > 0 && p <= base && p >= base - 3000;
}

/* ---- v6.3 equal division of the initial approval among ALD staff ---- */
function aldStaff_() { return accRows_().filter(function (a) { return a.role === 'ald' && a.active !== 'NO'; }); }
function pickAssignee_(sheet, day, idx) {
  const staff = aldStaff_(); if (!staff.length) return null;
  const last = sheet.getLastRow(), iAs = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('assignedTo');
  const today = {}, pending = {};
  if (last > 1 && iAs > -1) {
    if (!idx) idx = submissionIndex_(sheet);
    const asg = sheet.getRange(2, iAs + 1, last - 1, 1).getValues();          // one column, not the whole sheet
    for (let i = 0; i < asg.length && i < idx.length; i++) {
      const u = String(asg[i][0] || ''); if (!u) continue;
      const st = String(idx[i].status).trim().toUpperCase(); if (st === 'REJECTED') continue;
      let dd = idx[i].day; if (dd instanceof Date) dd = Utilities.formatDate(dd, TZ, 'yyyy-MM-dd');
      if (String(dd) === day) today[u] = (today[u] || 0) + 1;
      if (st === 'NEW') pending[u] = (pending[u] || 0) + 1;
    }
  }
  staff.sort(function (a, b) { return (today[a.username] || 0) - (today[b.username] || 0) || (pending[a.username] || 0) - (pending[b.username] || 0) || (a.username < b.username ? -1 : 1); });
  return staff[0];
}

/* RUN ONCE from the Apps Script editor (select setupMonitoring > Run): creates / upgrades the Monitoring tab and
   adds a row for every application that is already in the Applications tab. Safe to run again (no duplicates). */
function setupMonitoring() {
  const sh = monitorSheet_(), A = appRows_(), col = A.col;
  formatMonitor_(sh);
  const have = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { have[String(r[0])] = true; });
  let added = 0;
  A.rows.forEach(function (r) {
    const ref = txt_(r[col('reference')]); if (!ref || have[ref]) return;
    const rejected = String(r[col('status')]).trim().toUpperCase() === 'REJECTED';
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, MON_HEAD.length).setValues([[ref,
      fullName_({ lastName: r[col('lastName')], firstName: r[col('firstName')], middleName: r[col('middleName')] }),
      txt_(r[col('appTypeLabel')]) + ' (' + txt_(r[col('formUsed')]) + ')',
      r[col('submittedAt')] ? new Date(r[col('submittedAt')]) : '', daysFormula_(row), '', 'Pending',
      rowNoTocid_(r, col) ? 'N/A' : (txt_(r[col('tocidStatus')]) ? 'Approved' : 'Pending'), 'Pending', '', 'Pending', '', '', '', '', '', '', '']]);
    added++;
  });
  console.log('Monitoring rows added: ' + added);
}

/* =====================================================================================
   ACCOUNTS.  The admin signs in as  admin  with ADMIN_PASSCODE (above) and creates / edits / deletes the
   staff accounts from the page (Accounts button).  Roles: ald | tocid | lo (Licensing Officer).
   Passwords are stored salted + hashed in the "Accounts" tab (never in clear). A sign-in is a random token
   kept 6 hours in the script cache; every request re-reads the account, so deleting or deactivating one
   locks that person out at once. A Licensing Officer's signature image is kept in Drive (_staff-signatures).
   ===================================================================================== */
const ACC_HEAD = ['username', 'name', 'position', 'role', 'salt', 'hash', 'active', 'sigFileId', 'createdAt', 'updatedBy'];
const ROLES = ['ald', 'tocid', 'lo'];

function accSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(ACC_TAB);
  if (!sh) { sh = ss.insertSheet(ACC_TAB); sh.getRange(1, 1, 1, ACC_HEAD.length).setValues([ACC_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
function accRows_() {
  const sh = accSheet_(), last = sh.getLastRow();
  const v = last > 1 ? sh.getRange(2, 1, last - 1, ACC_HEAD.length).getValues() : [];
  return v.map(function (r, i) { const o = { row: i + 2 }; ACC_HEAD.forEach(function (k, j) { o[k] = String(r[j] === undefined || r[j] === null ? '' : r[j]); }); return o; });
}
function hashPw_(salt, pw) {
  let h = salt + ':' + pw;
  for (let i = 0; i < 1500; i++) {
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8)
      .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
  }
  return h;
}
function pubAcc_(a) { return { username: a.username, name: a.name, position: a.position, role: a.role }; }
function sigDataUrl_(username) {
  const a = accRows_().filter(function (x) { return x.username === username; })[0];
  if (!a || !a.sigFileId) return '';
  try { const b = DriveApp.getFileById(a.sigFileId).getBlob(); return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()); } catch (e) { return ''; }
}
function login_(d) {
  const uname = String(d.username || '').trim().toLowerCase(), pw = String(d.password || '');
  const cache = CacheService.getScriptCache(), fk = 'f:' + uname, fails = Number(cache.get(fk) || 0);
  if (fails >= 8) return json_({ ok: false, error: 'Too many wrong attempts. Wait 10 minutes, then try again.' });
  let acc = null;
  if (uname === 'admin') { if (ADMIN_PASSCODE && pw === ADMIN_PASSCODE) acc = { username: 'admin', name: 'Administrator', position: 'System Administrator', role: 'admin' }; }
  else {
    const a = accRows_().filter(function (x) { return x.username === uname; })[0];
    if (a && a.active !== 'NO' && ROLES.indexOf(a.role) > -1 && hashPw_(a.salt, pw) === a.hash) acc = pubAcc_(a);
  }
  if (!acc) { cache.put(fk, String(fails + 1), 600); return json_({ ok: false, error: 'Wrong username or password.' }); }
  cache.remove(fk);
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('t:' + token, JSON.stringify({ username: acc.username }), SESSION_SECONDS);
  return json_({ ok: true, token: token, user: acc, signature: (acc.role === 'lo' || acc.role === 'tocid') ? sigDataUrl_(acc.username) : '' });
}
function auth_(d) {                                   // the signed-in account for d.token, or null
  const t = String(d.token || ''); if (!t) return null;
  const raw = CacheService.getScriptCache().get('t:' + t); if (!raw) return null;
  const uname = JSON.parse(raw).username;
  if (uname === 'admin') return { username: 'admin', name: 'Administrator', position: 'System Administrator', role: 'admin' };
  const a = accRows_().filter(function (x) { return x.username === uname; })[0];
  return a && a.active !== 'NO' && ROLES.indexOf(a.role) > -1 ? pubAcc_(a) : null;
}
function acct_(d) {
  const me = auth_(d);
  if (!me) return json_({ ok: false, code: 'AUTH', error: 'Please sign in again.' });
  if (d.op === 'accMe') return json_({ ok: true, user: me, signature: (me.role === 'lo' || me.role === 'tocid') ? sigDataUrl_(me.username) : '' });
  if (me.role !== 'admin') return json_({ ok: false, error: 'Only the administrator can manage accounts.' });
  const rows = accRows_();
  if (d.op === 'accList') {
    return json_({ ok: true, accounts: rows.map(function (a) { return { username: a.username, name: a.name, position: a.position, role: a.role,
      active: a.active !== 'NO', createdAt: a.createdAt, signature: (a.role === 'lo' || a.role === 'tocid') ? sigDataUrl_(a.username) : '' }; }) });
  }
  const uname = String(d.username || '').trim().toLowerCase();
  if (d.op === 'accSave') {
    if (!/^[a-z0-9._-]{3,30}$/.test(uname) || uname === 'admin') return json_({ ok: false, error: 'Username: 3-30 letters, digits, dot, dash or underscore (and not "admin").' });
    const name = String(d.name || '').trim(), position = String(d.position || '').trim(), role = String(d.role || '');
    if (name.length < 3) return json_({ ok: false, error: 'Enter the full name.' });
    if (ROLES.indexOf(role) < 0) return json_({ ok: false, error: 'Choose a role.' });
    if (role === 'lo' && !position) return json_({ ok: false, error: 'A Licensing Officer needs a position (printed on Form 001).' });
    const sh = accSheet_(), cur = rows.filter(function (x) { return x.username === uname; })[0];
    if (d.isNew && cur) return json_({ ok: false, error: 'That username already exists.' });
    if (!d.isNew && !cur) return json_({ ok: false, error: 'Account not found.' });
    const pw = String(d.password || '');
    if ((d.isNew || pw) && pw.length < 8) return json_({ ok: false, error: 'The password needs at least 8 characters.' });
    let salt = cur ? cur.salt : '', hash = cur ? cur.hash : '', sigId = cur ? cur.sigFileId : '';
    if (pw) { salt = Utilities.getUuid(); hash = hashPw_(salt, pw); }
    if (d.signature && /^data:image\/(png|jpeg);base64,/.test(String(d.signature))) {
      try { if (sigId) DriveApp.getFileById(sigId).setTrashed(true); } catch (e) {}
      const f = subfolder_(DriveApp.getFolderById(FOLDER_ID), '_staff-signatures');
      sigId = fileId_(saveDataUrl_(f, String(d.signature), uname + '_signature'));
    } else if (d.clearSignature && sigId) { try { DriveApp.getFileById(sigId).setTrashed(true); } catch (e) {} sigId = ''; }
    const line = [uname, name, position, role, salt, hash, d.active === false ? 'NO' : 'YES', sigId, cur ? cur.createdAt : Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), 'admin'];
    if (cur) sh.getRange(cur.row, 1, 1, ACC_HEAD.length).setValues([line]); else sh.appendRow(line);
    SpreadsheetApp.flush();
    return json_({ ok: true });
  }
  if (d.op === 'accDelete') {
    const cur = rows.filter(function (x) { return x.username === uname; })[0];
    if (!cur) return json_({ ok: false, error: 'Account not found.' });
    try { if (cur.sigFileId) DriveApp.getFileById(cur.sigFileId).setTrashed(true); } catch (e) {}
    accSheet_().deleteRow(cur.row); SpreadsheetApp.flush();
    return json_({ ok: true });
  }
  return json_({ ok: false, error: 'Unknown request.' });
}

/* v6.5: ONE-TIME clean-up. New submissions are stored in capitals automatically; run this once from the Apps Script editor
   (select uppercaseExistingRecords > Run) to make the OLD rows uniform too:
     - Applications:  Last / First / Middle name, Company, School
     - Monitoring:    Name of the Applicant
     - the three register tabs (Knowledge Test Permit Applications - Control Numbers): Name, Company/School
   Cells that hold a formula are left alone. Safe to run more than once. */
function uppercaseExistingRecords() {
  const up = function (v) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().toUpperCase() : v; };
  const fixColumn = function (sh, c0, firstRow, n) {               // c0 = 0-based column
    if (c0 < 0 || n <= 0) return 0;
    const rg = sh.getRange(firstRow, c0 + 1, n, 1), v = rg.getValues(), f = rg.getFormulas();
    let changed = 0;
    const out = v.map(function (r, i) {
      if (f[i][0]) return [f[i][0]];
      const u = up(r[0]); if (u !== r[0]) changed++; return [u];
    });
    if (changed) rg.setValues(out);
    return changed;
  };
  let total = 0;
  const A = appRows_();
  CAPS_FIELDS.forEach(function (k) { total += fixColumn(A.sheet, A.col(k), 2, A.rows.length); });
  const mon = monitorSheet_();
  if (mon.getLastRow() > 1) total += fixColumn(mon, MC.name - 1, 2, mon.getLastRow() - 1);
  ['AMT', 'PPL', 'ATC'].forEach(function (code) {                   // MECH, PILOT, OTHER register tabs
    try {
      const sh = registerSheet_(code), C = registerCols_(sh), n = sh.getLastRow() - C.head;
      total += fixColumn(sh, C.name, C.head + 1, n) + fixColumn(sh, C.school, C.head + 1, n);
    } catch (e) { console.error('register ' + code + ' not cleaned: ' + e); }
  });
  SpreadsheetApp.flush();
  console.log('uppercaseExistingRecords: ' + total + ' cell(s) changed.');
}

/* The public endpoint deliberately serves nothing on GET. */
function doGet() {
  return ContentService.createTextOutput('Not available.');
}

/* Accept both the new {applications:[…]} payload and the old single-PDF one. */
/* v6.5: the applicant's name and the school / company are ALWAYS stored in capitals (Applications, Monitoring, register). */
const CAPS_FIELDS = ['lastName', 'firstName', 'middleName', 'company', 'school'];
function capsForm_(f) {
  f = f || {};
  CAPS_FIELDS.forEach(function (k) { if (f[k] !== undefined && f[k] !== null) f[k] = String(f[k]).replace(/\s+/g, ' ').trim().toUpperCase(); });
  return f;
}
function normaliseApps_(d) {
  if (d.applications && d.applications.length) {
    return d.applications.map(function (a) {
      return { type: a.type, typeLabel: a.typeLabel, form: capsForm_(a.form || d.form || {}), pdfName: a.pdfName, pdf: a.pdf };
    });
  }
  const f = capsForm_(d.form || {});
  return [{ type: f.action || 'original', typeLabel: '', form: f, pdfName: d.pdfName, pdf: d.pdf }];
}

/* lower-case, drop +tag, drop dots for gmail */
function emailKey_(email) {
  const m = String(email || '').trim().toLowerCase().match(/^([^\s@]+)@([^\s@]+\.[^\s@]+)$/);
  if (!m) return '';
  var local = m[1].split('+')[0], domain = m[2];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local + '@' + domain;
}

/* rows already stored for this e-mail on this day */
function rowsFor_(sheet, emailKey, day) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const iKey = head.indexOf('emailKey'), iDay = head.indexOf('submitDay'), iType = head.indexOf('appType'), iAct = head.indexOf('action'), iSt = head.indexOf('status');
  if (iKey < 0 || iDay < 0) return [];
  const rows = sheet.getRange(2, 1, last - 1, head.length).getValues();
  const out = [];
  rows.forEach(function (r) {
    var rowDay = r[iDay];
    if (rowDay instanceof Date) rowDay = Utilities.formatDate(rowDay, TZ, 'yyyy-MM-dd');
    if (iSt > -1 && String(r[iSt]).trim().toUpperCase() === 'REJECTED') return;     // rejected = deleted: they may apply again today
    if (r[iKey] === emailKey && String(rowDay) === day) out.push({ appType: r[iType] || r[iAct] || 'original' });
  });
  return out;
}

/* ---- person matching (name + date of birth) ---- */
function dobKey_(dob, tz) {
  if (dob instanceof Date) return Utilities.formatDate(dob, tz || TZ, 'yyyy-MM-dd');   // Sheets may turn "9/30/1990" into a date
  const t = String(dob || '').trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);                                   // the form sends M/D/YYYY
  if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[1] + '-' + iso[2] + '-' + iso[3] : '';
}
function nameKey_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
/* "delacruz|juan|1990-09-30", or '' if anything needed to identify the person is missing */
function personKey_(last, first, dob, tz) {
  const l = nameKey_(last), f = nameKey_(first), d = dobKey_(dob, tz);
  return (l && f && d) ? l + '|' + f + '|' + d : '';
}
/* first still-pending row for this person, same application type, same PEL form; or null */
function pendingFor_(sheet, key, type, formUsed) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const c = function (n) { return head.indexOf(n); };
  const iSt = c('status'), iType = c('appType'), iAct = c('action'), iForm = c('formUsed'), iRef = c('reference'),
        iDay = c('submitDay'), iKey = c('personKey'), iLn = c('lastName'), iFn = c('firstName'), iDob = c('dob');
  if (iSt < 0) return null;
  const tz = sheet.getParent().getSpreadsheetTimeZone();
  const rows = sheet.getRange(2, 1, last - 1, head.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (PENDING_STATUSES.indexOf(String(r[iSt]).trim().toUpperCase()) === -1) continue;
    if ((r[iType] || r[iAct] || 'original') !== type) continue;
    if (iForm >= 0 && r[iForm] && r[iForm] !== formUsed) continue;
    const rowKey = (iKey >= 0 && r[iKey]) ? String(r[iKey]) : personKey_(r[iLn], r[iFn], r[iDob], tz);   // older rows have no personKey yet
    if (rowKey !== key) continue;
    var day = r[iDay];
    if (day instanceof Date) day = Utilities.formatDate(day, TZ, 'yyyy-MM-dd');
    return { reference: r[iRef], day: String(day || '') };
  }
  return null;
}
function limit_(msg) { return json_({ ok: false, code: 'DAILY_LIMIT', error: msg }); }

function getSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Applications');
  if (!sheet) {
    sheet = ss.insertSheet('Applications');
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
  }
  if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
  // older sheets: add the new columns to the header (existing rows stay aligned)
  const have = sheet.getLastColumn();
  if (have < COLUMNS.length) sheet.getRange(1, have + 1, 1, COLUMNS.length - have).setValues([COLUMNS.slice(have)]);
  // keep the day column as plain text so "2026-09-28" is never turned into a date.
  // v6.9: formatting two whole columns on EVERY call was slow, so it is done once per column layout.
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('appsTextFmt') !== String(COLUMNS.length)) {
    sheet.getRange(1, COLUMNS.indexOf('submitDay') + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
    sheet.getRange(1, COLUMNS.indexOf('personKey') + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
    props.setProperty('appsTextFmt', String(COLUMNS.length));
  }
  return sheet;
}

function subfolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function safe_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, ''); }

function newReference_(lastName, suffix, when) {
  const stamp = Utilities.formatDate(when || new Date(), TZ, 'yyyyMMdd-HHmmss');
  const tag = String(lastName || 'APP').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
  return 'LCD-' + stamp + '-' + (tag || 'APP') + (suffix || '');
}

function saveFile_(folder, b64, mime, name) {
  if (!b64) return '';
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name);
  return folder.createFile(blob).getUrl();
}

function saveDataUrl_(folder, dataUrl, name) {
  if (!dataUrl || dataUrl.indexOf(',') === -1) return '';
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  const ext = mime.indexOf('png') > -1 ? '.png' : mime.indexOf('pdf') > -1 ? '.pdf' : mime.indexOf('webp') > -1 ? '.webp' : '.jpg';
  return saveFile_(folder, dataUrl.split(',')[1], mime, name + ext);
}

/* Mail the licensing desk on every submission: the subject and body say what
   kind of application it is, and the PDFs are attached under their real names.
   Delete the body of this function to switch it off. */
function notify_(results) {
  const to = Session.getEffectiveUser().getEmail();
  const f = results[0].form;
  const name = [f.lastName, f.firstName, f.middleName].filter(String).join(', ');
  const labels = results.map(function (r) { return r.label; }).join(' + ');
  const subject = '[' + labels + '] PEL Form ' + f.cat + ' — ' + name + ' — PEL No. ' + (f.licenseNo || 'none given') +
                  ' — ' + results[0].reference;
  const lines = [
    'Application type: ' + labels,
    'Applicant: ' + name,
    'PEL / License No.: ' + (f.licenseNo || '—'),
    'Contact: ' + (f.mobile || f.phone || '') + '  ' + (f.email || ''),
    '',
  ];
  results.forEach(function (r) {
    lines.push(r.label + '  (PEL Form ' + r.form.cat + ')');
    lines.push('  Reference: ' + r.reference);
    lines.push('  File: ' + r.fileName);
    lines.push('  Drive: ' + r.pdfLink);
    if (r.form.licApplied) lines.push('  License applied for: ' + r.form.licApplied);
    if (r.form.catClass) lines.push('  Category/class: ' + r.form.catClass);
    if (r.form.ratingInvolved) lines.push('  Rating involved: ' + r.form.ratingInvolved);
    lines.push('');
  });
  const attachments = results.filter(function (r) { return r.blob || r.pdf; }).map(function (r) {
    return r.blob ? r.blob : Utilities.newBlob(Utilities.base64Decode(r.pdf), 'application/pdf', r.fileName);
  });
  MailApp.sendEmail({ to: to, subject: subject, body: lines.join('\n'), attachments: attachments });
}

/* =====================================================================================
   NOTIFICATION QUEUE (v6.9).  The e-mail to the licensing desk about a new application is no longer sent while the
   applicant waits: a row is added to the "Mail Queue" tab and the timed trigger sendQueuedMail (every minute) sends it,
   building the message from the Applications row and the PDF in Drive. WALK-IN applicants are never queued: their
   e-mail is sent immediately (when staff mark them at the form, or - if already queued - the moment the walk-in
   toggle is switched on at the desk).
     installMailTrigger()  - run ONCE (it also installs itself on the first submission); removeMailTrigger() stops it
     sendQueuedMail()      - what the trigger runs; up to MAIL_BATCH mails per minute, stops when the daily mail quota is used
   If the trigger cannot be installed the script falls back to sending immediately, so no notification is ever lost.
   ===================================================================================== */
const MAIL_TAB = 'Mail Queue';
const MAIL_HEAD = ['Id', 'Queued At', 'Kind', 'Reference(s)', 'To', 'Status', 'Sent At', 'Attempts', 'Error'];
const MC_ = { id: 0, at: 1, kind: 2, refs: 3, to: 4, status: 5, sent: 6, tries: 7, err: 8 };
const MAIL_BATCH = 15, MAIL_MAX_TRIES = 5, MAIL_STUCK_MIN = 10;

function mailSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(MAIL_TAB);
  if (!sh) {
    sh = ss.insertSheet(MAIL_TAB);
    sh.getRange(1, 1, 1, MAIL_HEAD.length).setValues([MAIL_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1); sh.setColumnWidths(1, MAIL_HEAD.length, 150); sh.setColumnWidth(4, 260); sh.setColumnWidth(9, 320);
  }
  return sh;
}
function mailTriggerReady_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('mailTrig') === '1') return true;
  try {
    if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sendQueuedMail'; })) installMailTrigger();
    cache.put('mailTrig', '1', 600);
    return true;
  } catch (e) { console.error('mail trigger not available, sending at once: ' + e); return false; }
}
function installMailTrigger() {
  removeMailTrigger();
  ScriptApp.newTrigger('sendQueuedMail').timeBased().everyMinutes(1).create();
  console.log('Mail trigger installed: sendQueuedMail runs every minute.');
}
function removeMailTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sendQueuedMail') ScriptApp.deleteTrigger(t); });
  try { CacheService.getScriptCache().remove('mailTrig'); } catch (e) {}
}

/* called after the rows are saved. Walk-in (or no trigger): send now. Otherwise: queue. */
function queueNotice_(results, walk) {
  const refs = results.map(function (r) { return r.reference; });
  const enqueue = function () { mailSheet_().appendRow([Utilities.getUuid(), new Date(), 'NEW_APPLICATION', refs.join(','), Session.getEffectiveUser().getEmail(), 'QUEUED', '', 0, '']); };
  if (walk || !mailTriggerReady_()) {
    try { notify_(results); return; }
    catch (ne) { if (!mailTriggerReady_()) throw ne; console.error('immediate mail failed, queued instead: ' + ne); enqueue(); return; }   // the trigger retries it
  }
  try { enqueue(); } catch (qe) { console.error('queue failed, sending at once: ' + qe); notify_(results); }
}

/* Rows (by Id) that are QUEUED, or SENDING for longer than MAIL_STUCK_MIN minutes, are marked SENDING and returned. Call under the user lock. */
function claimMail_(limit, onlyRefs) {
  const sh = mailSheet_(), last = sh.getLastRow(); if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, MAIL_HEAD.length).getValues(), out = [], now = new Date();
  const want = onlyRefs ? onlyRefs.reduce(function (m, r) { m[r] = true; return m; }, {}) : null;
  for (let i = 0; i < v.length && out.length < limit; i++) {
    const r = v[i], st = String(r[MC_.status]);
    const stuck = st === 'SENDING' && r[MC_.sent] instanceof Date && (now - r[MC_.sent]) > MAIL_STUCK_MIN * 60000;
    if (st !== 'QUEUED' && !stuck) continue;
    const refs = String(r[MC_.refs]).split(',');
    if (want && !refs.some(function (x) { return want[x]; })) continue;
    sh.getRange(2 + i, MC_.status + 1, 1, 3).setValues([['SENDING', now, (parseInt(r[MC_.tries], 10) || 0) + 1]]);
    out.push({ id: String(r[MC_.id]), refs: refs, tries: (parseInt(r[MC_.tries], 10) || 0) + 1 });
  }
  return out;
}
function mailMark_(id, status, err) {
  const sh = mailSheet_(), f = sh.getRange(1, 1, sh.getLastRow(), 1).createTextFinder(id).matchEntireCell(true).findNext();
  if (!f) return;
  sh.getRange(f.getRow(), MC_.status + 1, 1, 2).setValues([[status, status === 'SENT' ? new Date() : '']]);
  sh.getRange(f.getRow(), MC_.err + 1).setValue(err ? String(err).slice(0, 300) : '');
}
function resultsFromSheet_(refs) {                         // rebuild what notify_ needs from the Applications row and the PDF in Drive
  const A = appRows_(), col = A.col, out = [];
  refs.forEach(function (ref) {
    const row = A.rows.filter(function (r) { return String(r[col('reference')]) === ref; })[0];
    if (!row) throw new Error('Application ' + ref + ' is no longer in the Applications tab.');
    const f = { lastName: txt_(row[col('lastName')]), firstName: txt_(row[col('firstName')]), middleName: txt_(row[col('middleName')]),
                cat: txt_(row[col('formUsed')]).replace(/^PEL\s*/i, ''), licenseNo: txt_(row[col('licenseNo')]), mobile: txt_(row[col('mobile')]),
                phone: txt_(row[col('phone')]), email: txt_(row[col('email')]), licApplied: txt_(row[col('licApplied')]),
                catClass: txt_(row[col('catClass')]), ratingInvolved: txt_(row[col('ratingInvolved')]) };
    const link = txt_(row[col('pdfLink')]), id = fileId_(link);
    let blob = null, fileName = ref + '.pdf';
    if (id) { try { const file = DriveApp.getFileById(id); blob = file.getBlob(); fileName = file.getName(); } catch (de) { console.error('PDF not attached for ' + ref + ': ' + de); } }
    out.push({ reference: ref, label: txt_(row[col('appTypeLabel')]) || txt_(row[col('appType')]), form: f, fileName: fileName, pdfLink: link, blob: blob });
  });
  return out;
}
function deliverMail_(items) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      notify_(resultsFromSheet_(it.refs));
      mailMark_(it.id, 'SENT', '');
    } catch (err) {
      console.error('queued mail ' + it.id + ': ' + err);
      mailMark_(it.id, it.tries >= MAIL_MAX_TRIES ? 'FAILED' : 'QUEUED', err);
    }
  }
}
/* the timed trigger */
function sendQueuedMail() {
  if (MailApp.getRemainingDailyQuota() < 1) return;           // daily mail quota used up: the queue continues tomorrow
  const ul = LockService.getUserLock();                      // not the script lock: applicants are never held up by a mail run
  if (!ul.tryLock(5000)) return;
  let items = [];
  try { items = claimMail_(MAIL_BATCH, null); mailCleanup_(); } finally { ul.releaseLock(); }
  deliverMail_(items);
}
/* send the queued mail of these applications right now (walk-in) */
function sendQueuedFor_(refs) {
  const ul = LockService.getUserLock();
  if (!ul.tryLock(8000)) return false;
  let items = [];
  try { items = claimMail_(50, refs); } finally { ul.releaseLock(); }
  deliverMail_(items);
  return items.length > 0;
}
function mailCleanup_() {                                    // keep the queue tab small: drop SENT rows older than 3 days
  const sh = mailSheet_(), last = sh.getLastRow(); if (last < 400) return;
  const v = sh.getRange(2, 1, last - 1, MAIL_HEAD.length).getValues(), cut = Date.now() - 3 * 86400000, rows = [];
  v.forEach(function (r, i) { if (String(r[MC_.status]) === 'SENT' && r[MC_.sent] instanceof Date && r[MC_.sent].getTime() < cut) rows.push(i + 2); });
  deleteRows_(sh, rows);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---- optional: run once by hand to test the e-mail key rules ---- */
function testEmailKey_() {
  console.log(emailKey_('Juan.Dela+cruz@Gmail.com'));   // juandela@gmail.com
}


/* =====================================================================================
   ARCHIVE (v6.8).  Keeps the live Applications and Monitoring tabs small and fast.
   Finished applications (status PROCESSED or REJECTED) submitted more than ARCHIVE_AFTER_DAYS ago are COPIED to a
   spreadsheet "CLAS Archive yyyy-MM" (one per submission month, created next to your main spreadsheet; tabs
   Applications + Monitoring) and only then removed from the live tabs. Drive folders and the permit registers are
   not touched, so every link keeps working. Unfinished applications are never moved.
     archivePreview()        - read-only: logs how many rows would move
     archiveFinished()       - does it (also what the monthly trigger runs)
     installMonthlyArchive() - run ONCE: runs archiveFinished on the 1st of every month, about 2 AM
     removeArchiveTrigger()  - stops the monthly run
   Safe to repeat: rows already in the archive are not copied twice. Works in batches of ARCHIVE_BATCH rows and takes the
   script lock only for each batch, so applicants are never blocked for long.
   ===================================================================================== */
const ARCHIVE_AFTER_DAYS = 30;
const ARCHIVE_STATUSES = ['PROCESSED', 'REJECTED'];
const ARCHIVE_BATCH = 300;
const ARCHIVE_NAME = 'CLAS Archive ';

function archiveSheetFor_(month) {
  const props = PropertiesService.getScriptProperties(), key = 'archive:' + month;
  let id = props.getProperty(key), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(ARCHIVE_NAME + month);
    try { const ps = DriveApp.getFileById(SHEET_ID).getParents(); if (ps.hasNext()) DriveApp.getFileById(ss.getId()).moveTo(ps.next()); } catch (e) { console.error('archive file not moved: ' + e); }
    props.setProperty(key, ss.getId());
  }
  return ss;
}
function archiveTab_(ss, name, head, asText) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    const first = ss.getSheets()[0];
    sh = (first.getName() === 'Sheet1' && first.getLastRow() === 0) ? first.setName(name) : ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function archiveRefs_(sh, refCol) {                        // references already present in an archive tab
  const out = {}, last = sh.getLastRow();
  if (last > 1) sh.getRange(2, refCol + 1, last - 1, 1).getValues().forEach(function (r) { out[String(r[0])] = true; });
  return out;
}
function appendRows_(sh, rows, asText) {
  if (!rows.length) return;
  const last = Math.max(sh.getLastRow(), 1), need = last + rows.length, w = rows[0].length;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
  const rg = sh.getRange(last + 1, 1, rows.length, w);
  if (asText) rg.setNumberFormat('@');                     // keeps phone numbers, dates and control numbers exactly as stored
  rg.setValues(rows);
  SpreadsheetApp.flush();
  if (sh.getLastRow() < need) throw new Error('archive write could not be verified');
}
function deleteRows_(sh, rowNums) {                        // 1-based row numbers; contiguous runs are deleted together
  if (!rowNums.length) return;
  if (rowNums.length >= sh.getMaxRows() - 1) sh.insertRowsAfter(sh.getMaxRows(), 5);   // a sheet must keep one unfrozen row
  const r = rowNums.slice().sort(function (a, b) { return b - a; });
  let i = 0;
  while (i < r.length) {
    let j = i; while (j + 1 < r.length && r[j + 1] === r[j] - 1) j++;
    sh.deleteRows(r[j], j - i + 1); i = j + 1;
  }
}
function archiveBatch_(cutoff, dry) {
  const A = appRows_(), col = A.col, iRef = col('reference'), iSt = col('status'), iAt = col('submittedAt');
  const picks = [];
  for (let i = 0; i < A.rows.length && (dry || picks.length < ARCHIVE_BATCH); i++) {
    const r = A.rows[i];
    if (ARCHIVE_STATUSES.indexOf(String(r[iSt]).trim().toUpperCase()) < 0) continue;
    const at = r[iAt] instanceof Date ? r[iAt] : new Date(r[iAt]);
    if (isNaN(at) || at > cutoff) continue;
    picks.push(i);
  }
  const monthOf = function (i) { const v = A.rows[i][iAt], at = v instanceof Date ? v : new Date(v); return Utilities.formatDate(at, TZ, 'yyyy-MM'); };
  if (dry) {
    const tally = {}; picks.forEach(function (i) { const m = monthOf(i); tally[m] = (tally[m] || 0) + 1; });
    console.log('Would archive ' + picks.length + ' of ' + A.rows.length + ' rows: ' + JSON.stringify(tally));
    return picks.length;
  }
  if (!picks.length) return 0;
  const byMonth = {}; picks.forEach(function (i) { const m = monthOf(i); (byMonth[m] = byMonth[m] || []).push(i); });
  const mon = monitorSheet_(), mlast = mon.getLastRow();
  const mvals = mlast > 1 ? mon.getRange(2, 1, mlast - 1, MON_HEAD.length).getValues() : [], mIndex = {};
  mvals.forEach(function (r, k) { mIndex[String(r[0])] = k; });
  const delApp = [], delMon = [];
  Object.keys(byMonth).forEach(function (m) {
    try {
      const idxs = byMonth[m], ss = archiveSheetFor_(m);
      const aTab = archiveTab_(ss, 'Applications', A.head, true), mTab = archiveTab_(ss, 'Monitoring', MON_HEAD, false);
      const haveA = archiveRefs_(aTab, iRef), haveM = archiveRefs_(mTab, 0);
      const appOut = [], monOut = [], monRows = [];
      idxs.forEach(function (i) {
        const ref = String(A.rows[i][iRef]), k = mIndex[ref];
        if (!haveA[ref]) appOut.push(A.rows[i].map(function (v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : v; }));
        if (k !== undefined) { if (!haveM[ref]) monOut.push(mvals[k]); monRows.push(k + 2); }
      });
      appendRows_(aTab, appOut, true); appendRows_(mTab, monOut, false);
      try {                                                  // v7.0: the dashboard keeps counting these rows after they leave the live tabs
        const monForIdx = idxs.map(function (i) { const k = mIndex[String(A.rows[i][iRef])]; return k === undefined ? null : mvals[k]; }).filter(function (x) { return x; });
        anaIndexAppend_(anaRecs_(A.head, idxs.map(function (i) { return A.rows[i]; }), MON_HEAD, monForIdx, m));
      } catch (ie) { console.error('analytics index not updated for ' + m + ' (the dashboard will repair it): ' + ie); PropertiesService.getScriptProperties().setProperty('aidxStale:' + m, '1'); }
      idxs.forEach(function (i) { delApp.push(i + 2); }); monRows.forEach(function (r) { delMon.push(r); });
    } catch (e) { console.error('Month ' + m + ' skipped (nothing was removed for it): ' + e); }
  });
  deleteRows_(mon, delMon); deleteRows_(A.sheet, delApp);
  SpreadsheetApp.flush();
  return delApp.length;
}
function archiveRun_(dry) {
  const t0 = Date.now(), cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86400000);
  let moved = 0;
  while (Date.now() - t0 < 240000) {                       // stay well inside the 6-minute script limit
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) { console.log('The server is busy; stopped. Run again later.'); break; }
    let n = 0;
    try { n = archiveBatch_(cutoff, dry); } finally { lock.releaseLock(); }
    moved += n;
    if (dry || n < ARCHIVE_BATCH) break;
    Utilities.sleep(1500);                                 // let waiting applicants through between batches
  }
  console.log((dry ? 'Preview: ' : 'Archived ') + moved + ' application(s)' + (!dry && moved && moved % ARCHIVE_BATCH === 0 ? ' (more may remain: run archiveFinished again)' : '') + '.');
  return moved;
}
function archivePreview() { return archiveRun_(true); }
function archiveFinished() { return archiveRun_(false); }
function removeArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === 'archiveFinished') ScriptApp.deleteTrigger(tr); });
}
function installMonthlyArchive() {
  removeArchiveTrigger();
  ScriptApp.newTrigger('archiveFinished').timeBased().onMonthDay(1).atHour(2).create();
  console.log('archiveFinished will run on the 1st of every month, about 2 AM.');
}


/* =====================================================================================
   ANALYTICS DASHBOARD (v7.0): administrator + Licensing Officers.
   The live tabs (Applications + Monitoring) are read directly. Archived applications leave those tabs, so a small
   index tab "Analytics Archive" (one compact row per archived application, no Drive links, no contact details) keeps
   them in the statistics. archiveBatch_ adds rows to it as it archives; archives made before v7.0 are read once by
   analyticsBackfill (the dashboard offers a button, or run analyticsBackfillAll in the editor).
   ===================================================================================== */
const ANA_TAB = 'Analytics Archive';
const ANA_HEAD = ['ref', 'at', 'status', 'form', 'type', 'lic', 'school', 'degree', 'sex', 'nat', 'prov', 'city', 'age', 'walk', 'asg',
                  'init', 'toc', 'lo', 'ktp', 'tInit', 'tToc', 'tLo', 'tKtp', 'tPmt', 'byInit', 'byToc', 'byLo', 'byKtp',
                  'rejAt', 'rejBy', 'rejWhy', 'pk', 'arch'];

function anaParseLog_(log) {                     // the "Handled By" log: "yyyy-MM-dd HH:mm  step: person" (one step per line)
  const o = {};
  String(log || '').split('\n').forEach(function (ln) {
    const m = ln.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(.*)$/); if (!m) return;
    const t = m[1], s = m[2].trim(); let k;
    if ((k = s.match(/^ALD initial approval:\s*(.*)$/))) { if (!o.tInit) { o.tInit = t; o.byInit = k[1].trim(); } }
    else if ((k = s.match(/^TOCID validation:\s*(.*)$/))) { o.tToc = t; o.byToc = k[1].trim(); }
    else if ((k = s.match(/^Form 001 (?:ELIGIBLE|INELIGIBLE):\s*([^,]*)/i))) { o.tLo = t; o.byLo = k[1].trim(); }
    else if ((k = s.match(/^ALD approval for KTP:\s*(.*)$/))) { o.tKtp = t; o.byKtp = k[1].trim(); }
    else if (/^KTP permit generated:/.test(s)) { if (!o.tPmt) o.tPmt = t; }
  });
  return o;
}
function anaHash_(s) {
  if (!s) return '';
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s)).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 10);
}
/* head/rows = an Applications tab (live or archived, any version: columns are found by name);
   monHead/monRows = the matching Monitoring rows. Returns compact arrays in ANA_HEAD order. */
function anaRecs_(head, rows, monHead, monRows, arch) {
  const hi = {}; head.forEach(function (h, i) { hi[h] = i; });
  const g = function (r, n) { return hi[n] === undefined ? '' : r[hi[n]]; };
  const mi = {}; (monHead || []).forEach(function (h, i) { mi[h] = i; });
  const M = {}; (monRows || []).forEach(function (r) { M[String(r[0])] = r; });
  const cut = function (v) { return txt_(v).slice(0, 16); };
  return rows.filter(function (r) { return String(g(r, 'reference')).trim(); }).map(function (r) {
    const ref = txt_(g(r, 'reference')).trim(), m = M[ref] || null;
    const mv = function (h) { return m && mi[h] !== undefined && m[mi[h]] !== undefined && m[mi[h]] !== null ? String(m[mi[h]]).trim() : ''; };
    const status = String(g(r, 'status')).trim().toUpperCase();
    const form = /542/.test(txt_(g(r, 'formUsed'))) ? '542' : '541';
    const L = anaParseLog_(mv('Handled By'));
    const done = status === 'PROCESSED';
    const init = mv('ALD Initial Approval') || (done ? 'Approved' : 'Pending');
    const toc = mv('TOCID Validation') || (tocidApplies_(form, txt_(g(r, 'licApplied'))) ? (txt_(g(r, 'tocidStatus')) ? 'Approved' : 'Pending') : 'N/A');
    const lo = mv('Licensing Officer Evaluation') || txt_(g(r, 'loStatus')) || (done ? 'N/A' : 'Pending');
    const ktp = mv('ALD Approval for KTP') || (done ? 'Approved' : 'Pending');
    const walk = (txt_(g(r, 'walkIn')) === 'YES' || mv('Walk-in') === 'YES') ? 1 : 0;
    return [ref, cut(g(r, 'submittedAt')), status, form, txt_(g(r, 'appTypeLabel')), txt_(g(r, 'licApplied')),
      txt_(g(r, 'school')).toUpperCase(), txt_(g(r, 'degree')), txt_(g(r, 'sex')), txt_(g(r, 'nationality')).toUpperCase(),
      txt_(g(r, 'province')).toUpperCase(), txt_(g(r, 'city')).toUpperCase(), txt_(g(r, 'age')), walk,
      mv('Assigned ALD Staff (initial approval)'), init, toc, lo, ktp,
      L.tInit || '', L.tToc || cut(g(r, 'tocidDate')), L.tLo || cut(g(r, 'loAt')), L.tKtp || '', L.tPmt || cut(g(r, 'permitAt')),
      L.byInit || '', L.byToc || '', L.byLo || txt_(g(r, 'loBy')).split(',')[0].trim(), L.byKtp || '',
      cut(g(r, 'rejectedAt')), txt_(g(r, 'rejectedBy')), txt_(g(r, 'rejectReason')), anaHash_(txt_(g(r, 'personKey'))), arch || ''];
  });
}

function anaSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(ANA_TAB);
  if (!sh) {
    sh = ss.insertSheet(ANA_TAB);
    sh.getRange(1, 1, 1, ANA_HEAD.length).setValues([ANA_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), ANA_HEAD.length).setNumberFormat('@');
  }
  return sh;
}
function anaIndexAppend_(recs) {                 // adds only the references that are not in the index yet
  if (!recs.length) return 0;
  const sh = anaSheet_(), have = archiveRefs_(sh, 0);
  const fresh = recs.filter(function (r) { if (have[r[0]]) return false; have[r[0]] = true; return true; });
  appendRows_(sh, fresh, true);
  return fresh.length;
}
function anaArchiveMonths_() {
  return PropertiesService.getScriptProperties().getKeys().filter(function (k) { return /^archive:\d{4}-\d{2}$/.test(k); })
    .map(function (k) { return k.slice(8); }).sort();
}
function anaPending_() {
  const p = PropertiesService.getScriptProperties();
  return anaArchiveMonths_().filter(function (m) { return p.getProperty('aidx:' + m) !== 'done' || p.getProperty('aidxStale:' + m); });
}
function anaBackfillMonth_(month) {              // reads one archive spreadsheet and adds what the index lacks
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('archive:' + month);
  if (!id) throw new Error('No archive is registered for ' + month + '.');
  const ss = SpreadsheetApp.openById(id), aTab = ss.getSheetByName('Applications'), mTab = ss.getSheetByName('Monitoring');
  let n = 0;
  if (aTab && aTab.getLastRow() > 1) {
    const aHead = aTab.getRange(1, 1, 1, aTab.getLastColumn()).getValues()[0];
    const aRows = aTab.getRange(2, 1, aTab.getLastRow() - 1, aHead.length).getValues();
    const mHead = mTab && mTab.getLastRow() > 0 ? mTab.getRange(1, 1, 1, mTab.getLastColumn()).getValues()[0] : [];
    const mRows = mTab && mTab.getLastRow() > 1 ? mTab.getRange(2, 1, mTab.getLastRow() - 1, mHead.length).getValues() : [];
    const recs = anaRecs_(aHead, aRows, mHead, mRows, month);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) throw new Error('The server is busy; try again in a moment.');
    try { n = anaIndexAppend_(recs); } finally { lock.releaseLock(); }
  }
  props.setProperty('aidx:' + month, 'done'); props.deleteProperty('aidxStale:' + month);
  return n;
}
function analyticsBackfillAll() {                // editor: index every archive month that is not indexed yet
  const t0 = Date.now(); let total = 0;
  anaPending_().forEach(function (m) {
    if (Date.now() - t0 > 240000) return;
    try { const n = anaBackfillMonth_(m); total += n; console.log(m + ': ' + n + ' application(s) indexed'); } catch (e) { console.error(m + ' failed: ' + e); }
  });
  console.log('Indexed ' + total + ' archived application(s). Months still pending: ' + JSON.stringify(anaPending_()));
}
function analyticsRebuildIndex() {               // editor: start the archive index again from the archive spreadsheets
  const props = PropertiesService.getScriptProperties();
  const sh = anaSheet_(), last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, ANA_HEAD.length).clearContent();
  anaArchiveMonths_().forEach(function (m) { props.deleteProperty('aidx:' + m); });
  analyticsBackfillAll();
}

function analytics_(d) {
  const me = auth_(d);
  if (!me) return json_({ ok: false, code: 'AUTH', error: 'Your session ended or the account was changed. Please sign in again.' });
  if (me.role !== 'admin' && me.role !== 'lo') return json_({ ok: false, error: 'Only the administrator and the Licensing Officers can open the analytics dashboard.' });
  if (d.op === 'analyticsBackfill') {
    const pend = anaPending_(), m = String(d.month || '') || pend[0];
    if (!m) return json_({ ok: true, done: true, pending: [] });
    if (pend.indexOf(m) < 0) return json_({ ok: true, month: m, added: 0, pending: pend });
    try { const n = anaBackfillMonth_(m); return json_({ ok: true, month: m, added: n, pending: anaPending_() }); }
    catch (e) { console.error(e); return json_({ ok: false, error: 'Archive ' + m + ' could not be read: ' + String(e).replace(/^Error:\s*/, '') }); }
  }
  return locked_(55000, function () {
    const c = anaCollect_();
    return json_({ ok: true, head: ANA_HEAD, live: c.live, archived: c.archived, months: c.months, pending: c.pend, cal: calendarList_(), now: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') });
  });
}
function anaCollect_() {                       // v7.4: live + archived records (shared by analytics_ and myPerformance_)
  const A = appRows_(), mon = monitorSheet_(), mlast = mon.getLastRow();
  const mRows = mlast > 1 ? mon.getRange(2, 1, mlast - 1, MON_HEAD.length).getValues() : [];
  const live = anaRecs_(A.head, A.rows, MON_HEAD, mRows, '');
  const seen = {}; live.forEach(function (r) { seen[r[0]] = true; });
  const ish = anaSheet_(), il = ish.getLastRow(), archived = [];
  if (il > 1) ish.getRange(2, 1, il - 1, ANA_HEAD.length).getValues().forEach(function (r) {
    const ref = String(r[0]); if (!ref || seen[ref]) return;
    archived.push(r.map(function (v) { return v === null || v === undefined ? '' : String(v); }));
  });
  const pend = anaPending_(), byM = {};
  archived.forEach(function (r) { byM[r[ANA_HEAD.length - 1]] = (byM[r[ANA_HEAD.length - 1]] || 0) + 1; });
  const months = anaArchiveMonths_().map(function (m) { return { month: m, indexed: pend.indexOf(m) < 0, count: byM[m] || 0 }; });
  return { live: live, archived: archived, months: months, pend: pend };
}

/* ---------- v7.4: working-day calendar (tab "Calendar": date | label | kind; dates are text yyyy-MM-dd) ---------- */
const CAL_TAB = 'Calendar', CAL_HEAD = ['date', 'label', 'kind'];
function calSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(CAL_TAB);
  if (!sh) {
    sh = ss.insertSheet(CAL_TAB);
    sh.getRange(1, 1, 1, CAL_HEAD.length).setValues([CAL_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), CAL_HEAD.length).setNumberFormat('@');
  }
  return sh;
}
function calendarList_() {
  try {
    const sh = calSheet_(), last = sh.getLastRow(); if (last < 2) return [];
    const out = [];
    sh.getRange(2, 1, last - 1, 3).getValues().forEach(function (r) {
      let dt = r[0]; if (dt instanceof Date) dt = Utilities.formatDate(dt, TZ, 'yyyy-MM-dd');
      dt = String(dt || '').trim(); const k = String(r[2] || '').trim().toUpperCase();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dt) && (k === 'HOLIDAY' || k === 'WORKDAY')) out.push({ date: dt, label: String(r[1] || ''), kind: k });
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  } catch (e) { console.error(e); return []; }
}
function calendarSave_(d) {
  const me = auth_(d);
  if (!me) return json_({ ok: false, code: 'AUTH', error: 'Your session ended or the account was changed. Please sign in again.' });
  if (me.role !== 'admin') return json_({ ok: false, error: 'Only the administrator can change the calendar.' });
  const act = String(d.action || ''), date = String(d.date || '').trim();
  if (act !== 'add' && act !== 'remove') return json_({ ok: false, error: 'Unknown calendar action.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json_({ ok: false, error: 'Enter a valid date.' });
  const p = date.split('-').map(Number), dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  if (dt.getUTCFullYear() !== p[0] || dt.getUTCMonth() !== p[1] - 1 || dt.getUTCDate() !== p[2]) return json_({ ok: false, error: 'That date does not exist.' });
  return locked_(30000, function () {
    const sh = calSheet_(); let last = sh.getLastRow();
    const dates = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { const v = r[0]; return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '').trim(); }) : [];
    for (let i = dates.length - 1; i >= 0; i--) if (dates[i] === date) sh.deleteRow(i + 2);       // one entry per date
    if (act === 'add') {
      const kind = String(d.kind || '').toUpperCase(), label = String(d.label || '').trim().slice(0, 80);
      if (kind !== 'HOLIDAY' && kind !== 'WORKDAY') return json_({ ok: false, error: 'Choose Holiday or Working day.' });
      if (!label) return json_({ ok: false, error: 'Enter a label (for example "Independence Day").' });
      const wd = dt.getUTCDay();
      if (kind === 'WORKDAY' && wd !== 0 && wd !== 6) return json_({ ok: false, error: 'A working day can only be set on a Saturday or Sunday.' });
      last = Math.max(sh.getLastRow(), 1);
      sh.getRange(last + 1, 1, 1, 3).setNumberFormat('@').setValues([[date, label, kind]]);
    }
    return json_({ ok: true, cal: calendarList_() });
  });
}

/* ---------- v7.4: "My performance" (ALD / TOCID / Licensing Officer: only the signed-in person's own records) ---------- */
function myPerformance_(d) {
  const me = auth_(d);
  if (!me) return json_({ ok: false, code: 'AUTH', error: 'Your session ended or the account was changed. Please sign in again.' });
  if (ROLES.indexOf(me.role) < 0) return json_({ ok: false, error: 'This page is for ALD staff, TOCID officers and Licensing Officers.' });
  const mine = String(me.name || '').trim().toLowerCase();
  if (!mine) return json_({ ok: false, error: 'Your account has no name.' });
  const H = ANA_HEAD, ix = function (k) { return H.indexOf(k); };
  const nameCols = ['asg', 'byInit', 'byToc', 'byLo', 'byKtp'].map(ix), iRej = ix('rejBy'), iPk = ix('pk');
  const isMe = function (v) { return String(v || '').trim().toLowerCase() === mine; };
  const rejName = function (v) { const p = String(v || '').split(' - '); return p.slice(1).join(' - ').trim(); };
  return locked_(55000, function () {
    const c = anaCollect_(), rows = [];
    c.live.concat(c.archived).forEach(function (r) {
      const hit = nameCols.some(function (i) { return isMe(r[i]); }) || isMe(rejName(r[iRej]));
      if (!hit) return;
      const o = r.slice();
      nameCols.forEach(function (i) { if (!isMe(o[i])) o[i] = ''; });
      if (!isMe(rejName(o[iRej]))) o[iRej] = String(o[iRej] || '').split(' - ')[0].trim();     // keep the role, drop another person's name
      o[iPk] = '';
      rows.push(o.map(function (v) { return v === null || v === undefined ? '' : String(v); }));
    });
    return json_({ ok: true, head: H, rows: rows, me: { name: me.name, role: me.role, position: me.position || '' }, cal: calendarList_(), now: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') });
  });
}


/* v7.3: has this e-mail address answered the survey? (reads the form's response sheet) */
function surveyAnswered_(email) {
  const want = String(email || '').trim().toLowerCase();
  if (!want) return false;
  try {
    const ss = SpreadsheetApp.openById(SURVEY_SHEET_ID);
    const sh = SURVEY_SHEET_TAB ? ss.getSheetByName(SURVEY_SHEET_TAB) : ss.getSheets()[0];
    const v = sh.getDataRange().getValues();
    if (v.length < 2) return false;
    const cols = [];
    v[0].forEach(function (h, i) { if (/e-?mail/i.test(String(h))) cols.push(i); });
    if (!cols.length) return false;
    for (let r = 1; r < v.length; r++)
      for (let c = 0; c < cols.length; c++)
        if (String(v[r][cols[c]]).trim().toLowerCase() === want) return true;
    return false;
  } catch (e) { Logger.log('surveyAnswered_: ' + e); return true; }   // sheet unreadable: do not block applicants (fix the ID / sharing)
}
