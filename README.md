# v7.3 changes: "Other school" and a real survey check

- **School drop-down has a last choice, *OTHER (my school is not in this list)*.** It shows a box to type the full school name (saved in capitals like every school). Drafts that hold a school not in the list reopen with that choice selected. The server needs no change for this: it already accepts any school text.
- **Survey is checked against the form's response sheet.** In your Google Form add a question *E-mail address* (title must contain "e-mail" or "email"), then open the form's *Responses > Link to Sheets* and copy the sheet ID into `SURVEY_SHEET_ID` at the top of `backend/apps-script.gs` (also `SURVEY_SHEET_TAB` if the answers are not on the first tab). The applicant is told to use the same e-mail as in the application; on Submit the script looks for it in the sheet and refuses if it is missing. Leave `SURVEY_SHEET_ID` empty to keep the v7.2 honour tick only. If the sheet cannot be opened the script lets the applicant through and logs the error (check the sharing of the sheet with the account that runs the script).
- **School list now shows every branch** (from your list of domestic aviation schools): a school with several branches appears once per branch, e.g. *ACATECH AVIATION COLLEGE — Baguio City*; a school with one location keeps its plain name. 132 entries (104 schools). Applicants still use *OTHER* if theirs is missing. Edit `SCHOOLS` in `public/index.html`.
- Limits: an e-mail that answered the survey once passes again later; typing someone else's e-mail would also pass.

**Update steps:** paste `backend/apps-script.gs` (keep your IDs, set `SURVEY_SHEET_ID`), redeploy as a new version, upload ALL of `public/`.

---

# v7.2 changes: school list, mandatory survey, plainer analytics

- **School is a drop-down** (list `SCHOOLS` in `public/index.html`, 107 schools, duplicates removed, A-Z). Applicants cannot type a school. The server still only checks that a school was sent. Old drafts with a school that is not in the list show the box empty until a school is picked.
- **Mandatory survey.** Before Submit the page shows an *Open the survey* button (Google Form) and a required box *I have answered the survey*. Submit is refused without it, in the page and in the script (`d.survey`). Note: a Google Form cannot tell this page who answered, so this is an honour tick. To verify for real, add a *Control no. / e-mail* question to the form and compare it with its response sheet.
- **Analytics, Staff tab** (now *Staff work*): separate tables for **ALD staff**, **TOCID officers** and **Licensing Officers**, each with only the columns that fit that job (ALD: given / still waiting past goal / first reviews / final KTP approvals / rejections; TOCID: validated / rejections; Licensing Officer: evaluated / eligible / not eligible / % eligible).
- **Analytics, Turnaround tab** (now *Waiting times*): a one-paragraph summary in plain words, a how-to-read box, steps named by who the applicant is waiting for, and plain column names (Typical wait, Average, Slowest 1 in 10 waited, Finished on time). The filter *Target (days)* is now **On-time goal (days)** with a tooltip; Overview cards use the same wording.

**Update steps:** paste `backend/apps-script.gs` (keep your IDs), redeploy as a new version, upload ALL of `public/`.

---

# v7.1 changes: required documents per license

| License | Documents the applicant must upload |
|---|---|
| Form 541 (all pilot licenses) | Ground Schooling Certificate |
| Ground Instructor | Ground School Certificate |
| Flight Dispatcher | Training Certificate, TOR, Diploma/COG |
| Aeronautical Station Operator, Air Traffic Controller | Training Certificate |
| Air Traffic Safety Electronic Personnel | Training Certificate |
| Student ATC / Student ASO Authorization | PSA Birth Certificate, Medical Certificate |
| Remotely Piloted Aircraft | Training Certificate, pictures of the drone (up to 4, joined into one PDF), drone specifications, and the drone weight in kg (below 7 kg / 7 kg or more) |
| AMT, AMS, Inspection Authorization | unchanged: TOR + Diploma/COG (+ 12-month OJT for AMS Associate) |

- The page shows only the upload boxes the chosen license needs, checks them before Submit, and the server refuses a submission with a missing document or (RPA) a missing weight (`docKeysFor_` in the script mirrors `docKeys()` on the page).
- Drone pictures are real photos, so they skip the text-sharpness check (they only need at least 500 px on the short side). All other uploads still go through the clarity check.
- The compiled requirements view (every desk, and the compiled PDF) lists the documents of that license in this order. The drone weight shows on the desk info panel and in Monitoring > Remarks ("RPA drone: 2.5 kg (below 7 kg)").
- New Applications columns (added automatically): trainingLink, psaLink, medicalLink, droneLink, droneSpecLink, droneKg.

**Update steps:** paste `backend/apps-script.gs` (keep your IDs and ADMIN_PASSCODE), redeploy as a new version, upload ALL of `public/`.

---

# v7.0 changes: analytics dashboard (administrator + Licensing Officers), archived records included

**Analytics.** The desk bar of the administrator and of every Licensing Officer has a new **Analytics** button (ALD staff and TOCID do not see it, and the server refuses the request for them). It opens a full-screen dashboard with filters (date submitted: 7 / 30 / 90 days, 12 months, this year, all time or a custom range; live / archived / both; form 541 / 542; application type; assigned ALD staff; a target in days) and eight tabs:
- **Overview**: applications received, approved for KTP, rejected, in progress, approval rate, median turnaround and share within target, walk-ins, permits generated, share from the archive; outcome donut, what needs attention now, split by type and form, activity chart.
- **Pipeline & backlog**: funnel (submitted > initial approval > TOCID > Licensing Officer > KTP > permit), where the pending applications are by step and age (<=5, 6-10, 11-20, >20 days), pending initial approvals per ALD staff, the 25 oldest pending applications.
- **Trends**: submitted / approved / rejected per day, week or month (chosen from the range), live vs archived per month, month-by-month table, weekday x hour heat map.
- **Turnaround**: mean, median, 90th percentile and longest time for each step and in total, distribution, within-target share, by application type, licence and walk-in.
- **Applicants**: by type, licence, school, degree, sex, age group, nationality, province, city; returning applicants.
- **Staff**: assigned, still late, median wait, initial approvals, TOCID validations, Form 001 evaluations (eligible / ineligible), KTP approvals and rejections made, per person.
- **Rejections**: at which step, by whom, most common reasons, rate by type and school.
- **Archive & data**: records per archive month, whether each month is counted, data-quality checks.
**Export CSV** saves the filtered records; **Print / PDF** prints all tabs.

**Archived records stay in the statistics.** The monthly archive removes finished applications from the live tabs, so the dashboard keeps a compact index of them in a new tab **Analytics Archive** (main spreadsheet; one row per archived application: type, licence, school, degree, sex, nationality, province, city, age, step results and step times, rejection, the person's hash for "returning applicants". No Drive links, no e-mail, phone or street address). `archiveFinished` adds to the index in the same run that archives (if that write fails the month is flagged and the dashboard repairs it). Step times come from the Monitoring *Handled By* log, so records from before v6.0 count in totals and breakdowns but not in turnaround figures (the Archive & data tab shows how many are missing).

**Update steps:** paste `backend/apps-script.gs` (keep your IDs and ADMIN_PASSCODE), redeploy as a **new version**, upload ALL of `public/`. Sign in as `admin` or a Licensing Officer, open **Analytics**: if archives made before this update exist, a yellow bar offers **Add them now** (reads each `CLAS Archive yyyy-MM` once). The same can be done from the editor with `analyticsBackfillAll()`; `analyticsRebuildIndex()` starts the index again from the archive spreadsheets. The dashboard needs the live server connection (it is not available in `dist/standalone.html`). All records are sent to the browser when the dashboard opens, which is fine for tens of thousands of applications.

---

# v6.9 changes: shorter lock, queued notification e-mail, smaller uploads

**Short lock.** A submission no longer holds the script lock while it saves to Drive. Order now: (A, no lock) checks, an early duplicate check, then the folder, photo, signature, attachments, Form 001, PDFs and draft are saved to Drive; (B, lock) the duplicate / daily-limit check is repeated, the ALD staff member is picked, the Applications and Monitoring rows are written (a few sheet calls); (C, no lock) the draft is updated and the notification is queued. If the locked re-check refuses the submission (two people with the same details at the same moment) the files just saved are moved to the Drive trash. The duplicate / limit checks and the assignment now read only the columns they need (two blocks, one column) instead of every column of every row, and the two text-format calls on whole columns run once instead of on every call (`appsTextFmt` script property). Sign-in, accounts and the staff desks still run under the lock for the whole request, as before. A retried submission (same `clientId`) is answered from the cache; while the first attempt is still running the retry gets BUSY and the page tries again. Control numbers are reserved with a few-millisecond lock so two applicants in the same second can never get the same number (the number's time stamp moves to the next free second; the real time stays in *Date & Time Submitted*).

**Queued notification.** The e-mail to the licensing desk (the one with the PDF attached) is added to the new **Mail Queue** tab and sent by the timed trigger `sendQueuedMail` (every minute, up to 15 mails per run, stops when the daily mail quota is used, 5 tries per mail). The trigger installs itself on the first submission; to do it by hand run `installMailTrigger()` once (`removeMailTrigger()` stops it). The mail is rebuilt from the Applications row and the PDF in Drive. If the trigger cannot be installed the script falls back to sending at once. **Walk-in applicants are never queued**: a staff member who ticks *Walk-in applicant* on the form (new checkbox, only visible when an ALD staff member or the administrator is signed in) sends it immediately; if the application is already queued, switching the Walk-in toggle on at the desk sends the queued mail at that moment. The e-mails that staff actions send (compiled PDF to the applicant after KTP approval, rejection notice) are unchanged.

**Smaller uploads (in the applicant's browser).** Photo: longest side 1000 px, JPEG (the compliance check still reads the original file). Signature: drawn or uploaded, at most 700-800 px wide. Diploma, TOR, Ground School and OJT images: JPEG, longest side up to 1800 px, quality lowered until about 450 KB (never below 1200 px). PDFs over 700 KB: rebuilt from JPEG pages (up to 12 pages) and used only if at least 15% smaller. Because the PEL form and Form 001 embed the photo and signature, those PDFs shrink too.

**Update steps:** paste `backend/apps-script.gs` (keep your IDs and passcodes), deploy a **new version** and approve the new permissions (triggers); upload all of `public/`. Optional: run `installMailTrigger` once.

---

# v6.8 changes: automatic submit retry, duplicate-proof resubmits, monthly archive

- **Submit retry.** If the server is busy (many applicants at once) or the connection drops, the page sends the same submission again, up to 5 tries with a growing pause, and says "trying again automatically". Each submission carries a `clientId`; if an earlier try actually got through, the server returns the original reference instead of saving a duplicate (remembered for 6 h). The server now waits up to 55 s for its turn and answers `BUSY` instead of crashing when the queue is too long.
- **Archive.** Finished applications (status PROCESSED or REJECTED) submitted more than `ARCHIVE_AFTER_DAYS` (30) days ago are copied to a spreadsheet `CLAS Archive yyyy-MM` (one per month, created next to your main spreadsheet, tabs Applications + Monitoring) and only then removed from the live tabs. Unfinished applications are never moved. Drive folders and the permit registers are untouched. Rows already archived are never copied twice, a month that fails to write is skipped without deleting anything, and each batch of 300 rows takes the lock only briefly.
  - `archivePreview()` read-only: logs how many rows would move.
  - `archiveFinished()` does it.
  - `installMonthlyArchive()` run ONCE: archives automatically on the 1st of each month, about 2 AM. `removeArchiveTrigger()` stops it.
  - Archived applicants disappear from the desk lists (search the archive spreadsheet instead).

**Update steps:** paste `backend/apps-script.gs` (keep your IDs and ADMIN_PASSCODE), redeploy as a new version, upload ALL of `public/`. Then in the Apps Script editor run `archivePreview` (approve the permissions when asked), check the log, and run `installMonthlyArchive` once.

---

# v6.7 changes: CLAS rebrand, light-blue look, per-officer TOCID stamp, Upgrade / Proficiency Check removed

- **Name and logo.** The system is now **CLAS (CAAP License Application System)**. The CAAP logo is the browser-tab icon and sits in the header and the staff desk bar (embedded in `index.html`; originals in `public/logo.png` and `public/favicon.png`).
- **Look.** Light-blue theme (header, buttons, cards, tabs, desk bar). The yellow dashed line under the header is gone. It is one override block at the end of the `<style>` section ("v6.7").
- **TOCID stamp uses each officer's own name and signature.** The Accounts page now shows the signature upload for TOCID accounts too. The stamp prints the signed-in officer's name and signature; both are saved in the draft when they press *Validate & stamp*, so ALD staff and Licensing Officers later see the officer who actually validated. A TOCID officer without a saved signature cannot validate. Stamps made before this update keep the original officer (Capt. King William P. Valdez).
- **Form 541 choices:** Original / Issuance, Reinstatement / Reissuance, Additional Rating. *Upgrade of License* and *Application for Proficiency Check* are removed from the page and the server refuses them (`BUNDLE_TYPES`, `FILE_TOKENS`). Old applications of those types still open.

**Update steps:** paste `backend/apps-script.gs` (keep your IDs and ADMIN_PASSCODE), redeploy as a new version, upload ALL of `public/`. In **Accounts**, edit each TOCID account and upload that officer's signature.

---

# v6.6 changes: rejected applications are moved, not deleted

Rejecting an application (ALD, TOCID, "name not on the list") no longer trashes the applicant's Drive folder. It is **moved to a folder named `Rejected Applications`** inside the main applications folder (created automatically; name in `REJECTED_FOLDER_NAME`). A `REJECTION_NOTE.txt` (stage, who, date, reason) is added to the moved folder. File links in the Applications sheet keep working because the files are only moved. Older submissions that have no folder get a new folder in `Rejected Applications` holding their files. The applicant is freed to apply again and e-mailed the reason, as before; the sheet row stays marked REJECTED. The empty date folder left behind is the only thing trashed.

**Update steps:** paste `backend/apps-script.gs`, redeploy as a new version, upload `public/index.html`.

---

# v6.5 changes: permit PDF layout, all-caps names, TOCID for AMT / AMS only

**Knowledge Test Permit PDF now matches the sample.** The permit CSS needs `box-sizing: border-box`, which the hidden render frame never had: the left column grew past the centre line and pushed the QR code and the bottom note out of the page. Fixed in `permit.js`. Open Sans is now embedded (`public/permit-font.js`, no Google Fonts request) and registered in the main page too, because html2canvas paints on a main-page canvas: before, text was measured in Open Sans but painted in Arial (missing spaces such as "CAAPHangar"). The signature stamp date is now `M/D/YYYY` (e.g. 10/7/2026) like the sample.

**Names and School / Company are always capitals.** Last / first / middle name, Company / School and the school graduated from are uppercased while typing, in drafts, on the PDFs and on the server (Applications, Monitoring, register Name and Company/School). To fix OLD rows run `uppercaseExistingRecords` once from the Apps Script editor (skips formula cells; safe to repeat).

**Only AMT and AMS go through TOCID.** Form 542 with AMT or AMS: unchanged. Everything else (all of Form 541 and the other 542 licenses) has TOCID Validation = N/A and goes from the ALD initial approval straight to the Licensing Officer. The TOCID desk no longer lists them and the server refuses TOCID actions on them (`tocidApplies_` in `apps-script.gs`).

**Update steps:** paste `backend/apps-script.gs` (keep your IDs and ADMIN_PASSCODE), redeploy as a new version, upload ALL of `public/` (new file `permit-font.js`), run `uppercaseExistingRecords` once.

---

# v6.4: custom KTP address, Philippine address dropdowns

**Custom address on the KTP.** ALD desk > ALD actions > *Address on the KTP*: default (CAAP Hangar, Andrews Avenue, Pasay City) or *Custom address...*. The text is printed after "You shall proceed directly to" on every permit template. It is used by **Approve for KTP** and **Generate KTP permit** (press it again to change the address of an existing permit; the compiled PDF is rebuilt and re-sent). The address used is stored in the Applications column `permitVenue` and is shown again when the application is reopened; recent custom addresses are suggested in the box (kept in that browser).

**Address dropdowns (applicant form).** Country: Philippines or *Other country (type it)*. For the Philippines, **State / Province** is a dropdown grouped by region (82 provinces incl. Metro Manila) and **City / Municipality** is a dropdown of that province's 1,632-entry PSGC list (`public/ph-geo.js`, generated from the `ph-locations` npm package). *Other / not listed (type it)* in either dropdown lets the applicant type it; for another country the three boxes are plain text. Drafts, PDFs and the server checks still use the same `country`, `province`, `city` values. Older drafts whose province is not in the list (e.g. "NCR") open in the typed mode. The list is from an older PSGC release: Maguindanao is not split into del Norte / del Sur, so those applicants use *Other / not listed*.

**Update steps:** paste `backend/apps-script.gs`, redeploy as a new version, upload all of `public/` (new file `ph-geo.js`).

---

# v6.3 changes: Temporary PEL fix, compiled PDF with the KTP, queue order, walk-ins, equal division of initial approvals

**Temporary PEL.** The old code took the highest number in the PEL column + 1, so one real PEL typed in the register (e.g. 2010185) poisoned every later permit. Now: **Original** applicants get the next number of the Temporary PEL series (remembered per register tab in the script properties; first time it is detected from the register by looking for consecutive numbers, isolated PELs are ignored). Applicants who **already hold a PEL** (Reinstatement, Additional, Upgrade) keep their own PEL in that column (`REUSE_EXISTING_PEL`). If the first number is wrong, put the last correct one in `TEMP_PEL_LAST` once. New register rows are written after the last row that really has an entry (a date-only row no longer pushes the entry down). **Already-generated permits with a wrong PEL:** open the application and press **Generate KTP permit** again; the control no. stays, the PEL is corrected in the register, Applications and the new PDF.

**Compiled PDF + KTP.** The applicant also receives the compiled PDF by e-mail (to the e-mail on the application). The KTP is the last section of the compiled view on every desk. When a permit is generated the script also saves `<ref>_COMPILED_FORMS_<ctrl>.pdf` (PEL form, approved data flow, TOR/diploma/OJT or ground school certificate, Form 001, KTP) in the applicant's Drive folder (`compiledLink` column). **Download compiled PDF** button on the ALD desk.

**Queue order.** Every desk lists the oldest submission first. A WALK-IN group is always on top. "Show only TO DO" is on by default.

**Walk-in.** ALD desk: tick **Walk-in applicant** (before the initial approval). Marks it in Applications (`walkIn`) and Monitoring (*Walk-in*), moves it to the top for all roles, visible to all ALD staff.

**Equal division of the initial approval.** Each new submission goes to the active ALD staff member with the fewest submissions today (ties: fewest pending). ALD staff see only their own pending initial approvals (plus walk-ins); the server also refuses someone else's. Once the initial approval is given the application is on everybody's list. Absent staff: their items stay pending. **Admin and Licensing Officers** have an **Assign applications** button: move selected applications to another ALD staff member, or spread one person's pending items equally over the others. Monitoring gets two columns at the end (*Assigned ALD Staff*, *Walk-in*); Applications gets `walkIn`, `assignedTo`, `assignedAt`, `compiledLink`. Applications that exist before the update are unassigned and visible to all ALD staff.

**Update steps:** paste `backend/apps-script.gs` (keep your IDs and ADMIN_PASSCODE), redeploy as a **new version**, upload `public/`. Create the ALD staff accounts under Accounts.

---

# v6.1 changes: column order + Knowledge Test Permit (the last step)

**Monitoring sheet order is now:** Control No. | Name | Type | Date & Time | Days Pending | Being Processed | ALD Initial Approval | TOCID Validation | **Licensing Officer Evaluation | Evaluated By** | ALD Approval for KTP | Remarks | Handled By | **Permit Control No. | Permit Generated | Permit File**. An existing sheet is rearranged automatically on the next request (data moves with its columns); you can also run `setupMonitoring` once.

**Permit (Knowledge Test Permit / Notice of Admission).** Process: ... Licensing Officer Eligible -> ALD *Approve for KTP* -> **permit generated automatically** with the applicant's photo and signature. Steps behind the button:
1. `deskPermitReserve`: picks the template from the application (see `permitKindFor` in `public/permit.js`), reserves the next **AKTP control no.** and **Temporary PEL** from the control-number register and appends the register row (Date, PEL, Control No., Name, school, type, rating).
2. The browser draws the permit (layouts copied from the ALD CONVERTER, 21 templates in `permit-data.js`, auto-generated) and makes the PDF.
3. `deskPermitSave`: stores `<control no.>_KTP_PERMIT_<AKTP no.>.pdf` in the applicant's own Drive folder and fills *Permit Control No.*, *Permit Generated*, *Permit File* in Monitoring (and four `permit*` columns in Applications). If anything fails after approval, open the application again and press **Generate KTP permit** (safe to repeat: the same number is reused).

**Setup (required once):** the register must be a native Google Sheet. If it is an .xlsx in Drive: open it > File > Save as Google Sheets. Put its ID in `REGISTER_SHEET_ID` (apps-script.gs), share it (edit) with the licensing account, paste the script, redeploy as a new version. Columns are found by header name (Date, Temporary PEL, Control No./AKTP, Name, School, Type, Rating); with no header row the order is Date, PEL, Control No., Name, Org, School, Type, Rating. The first permit of each series (e.g. AMT) continues from the last matching row, so keep at least one such row in the register.

**Template choice** (`permitKindFor`): AMT Original -> AMT; AMT Additional with only Airframe / Powerplant -> that one; AMS Original -> AMS; AMS Additional -> AMS Add. Rating; ATC / ASO / ATSEP / RPA / FOO(Flight Dispatcher) / Ground Instructor; Pilot: Private, Commercial, ATP, Flight Instructor, Additional Rating. No permit: Proficiency Check, Flight Engineer, Flight Navigator, Inspection Authorization (no template). **Not done yet:** Practical Skill Test Permits (PSTP), AMS Original Specialization, AMT Military and Conversion/Validation (templates are in `permit-data.js` but nothing selects them), permits for the other applications of a bundled submission.

---

# v6.0 changes: staff accounts, Licensing Officers, Form 001, compiled requirements

**Process now:** applicant submits (generates PEL 541/542, Data Flow and **Form 001** with the applicant's signature above their name) -> ALD initial approval -> TOCID validates and stamps (541 skips TOCID) -> **Licensing Officer evaluates Form 001 (Eligible / Ineligible)** -> ALD approves for KTP. The server refuses *Approve for KTP* until the Monitoring cell *Licensing Officer Evaluation* is **Eligible** (or N/A for rows finished before v6.0).

- **Accounts (you = admin).** Sign in with username `admin` and the password in `ADMIN_PASSCODE` (apps-script.gs). The desk bar then shows **Accounts**: create, edit (name, position, role, password, active), delete. Roles: ALD staff, TOCID, Licensing Officer. Passwords are salted + hashed in an `Accounts` tab; sign-ins last 6 h; deleting or deactivating an account signs that person out at once. The old shared passcodes and the *TOCID sign in* link are gone (`TOCID_PASSCODE` is unused). Header link **Staff sign in** now asks for username + password for every role.
- **Licensing Officers.** Accounts page has *Prefill* buttons for Dann Edmund V. Salvador (Civil Aviation Licensing Officer II) and John Christian B. Cala (Supervising Civil Aviation Licensing Officer). Upload each officer's **signature image** (dark ink on white; the page makes the paper transparent and crops it). Their desk has a to-do list, the preview, and an *Eligible / Ineligible* box with remarks (required when ineligible).
- **Form 001** (`templates/form001.pdf`, v3 r0). Built at submission (date, license, name, signature) and saved in the applicant's folder as `<control no.>_Form001.pdf`. On evaluation it is rebuilt with the circled decision, license, evaluator name + position, signature, date and remarks, saved as `<control no.>_Form001_ELIGIBLE.pdf` / `_INELIGIBLE.pdf`, and the earlier copy is removed. Applicants also receive a copy.
- **Compiled requirements.** On every desk the preview is one scrolling view: 1 PEL 541/542, 2 Data Flow, 3 TOR, 4 Diploma (+ OJT cert for AMS Associate) for 542 or the Ground Schooling Certificate for 541, last Form 001. The TOCID stamp preview still updates live.
- **Monitoring sheet** gets three columns at the end: *Licensing Officer Evaluation* (Pending / Eligible / Ineligible / N/A), *Evaluated By (Licensing Officer)* (name, position) and *Handled By* (a dated log of who did ALD initial, TOCID, Licensing Officer and KTP steps). Ineligible also writes a line in Remarks. The ALD desk shows "Waiting for Licensing Officer", or "Ineligible - reject or ask the officer to re-evaluate" (the ALD *Reject* deletes the folder as before).

**Update steps:** paste `backend/apps-script.gs`, set `ADMIN_PASSCODE`, redeploy as a **new version** (authorise if asked). The Monitoring tab and the new Applications columns upgrade themselves on the next request (existing unfinished rows become *Pending*, finished rows *N/A*). Sign in as `admin`, open **Accounts**, create the two officers and upload their signatures. `npm run set-passcode` only affects the standalone copy now.

**Not done yet:** the auto-generating permit (yours, to add later). Form 001 uses the license name + "License" (e.g. "Aviation Maintenance Technician License"; "...Authorization" names are left as is).

# v5.6 changes

- **Renewal removed everywhere.** No Renewal choice on Form 541 or Form 542, no Renewal application type, and the server rejects it (`FILE_TOKENS` / `PENDING_BLOCK_TYPES` in `apps-script.gs`). The printed Renewal box on the PDFs is simply never ticked.
- **Form 541: Student Pilot is no longer offered** under "PEL license applied for" (the list now starts at Private Pilot, which is pre-selected). The Student Pilot box stays on the printed PEL 541 and its position stays in `coords.js` (`lic_student`).
- **Form 541 attachment: Ground Schooling Certificate only.** Form 541 no longer asks for the COG / Diploma or the Transcript of Records; it asks for one Ground Schooling Certificate (same quality checks as the other uploads), saved in the applicant's folder as `..._GroundSchooling` and listed in the new `groundLink` column. Form 542 is unchanged (COG / Diploma + TOR, + OJT for AMS Associate). The staff desks show the Ground Schooling Certificate for 541 applications.

- **Form 541 skips TOCID.** The TOCID desk no longer lists 541 applications (and the server refuses TOCID stamp/reject on them). In the Monitoring sheet their *TOCID Validation* cell is **N/A** (grey), and ALD staff can press *Approve for KTP* straight after the initial approval. Existing 541 rows are shown as N/A on the desks automatically; old Monitoring-sheet cells can be changed to N/A by hand if you want the sheet to match.

**Update steps:** paste `backend/apps-script.gs`, keep your `ADMIN_PASSCODE` / `TOCID_PASSCODE`, redeploy as a new version. The `groundLink` column is added to the Applications sheet automatically.

# v5.5 changes

- **Preview, applicant side.** On phones and tablets (width up to 1000 px) the page now has two sticky tabs at the top, **1. Fill in the form** and **2. Live preview**. The preview tab is a full-screen panel above the Submit bar, so nobody has to scroll to find it. On wider screens the preview stays beside the form (narrower column on tablet landscape). The preview refreshes 200 ms after a change (was 450 ms) and renders at once when the form opens or the tab is selected.
- **Preview, staff desks (ALD and TOCID).** Selecting an application shows the data flow immediately: the claim and the load now run in parallel and the preview appears as soon as the draft arrives (action buttons unlock once the claim is confirmed). The preview is drawn with pdf.js, so it also works on phones and tablets, where the old embedded PDF viewer did not.
- **Mobile / tablet layout.** Single-column fields on phones, two columns on tablets, 16 px inputs (no iOS zoom), 44 px touch targets, full-width Submit/Approve buttons, safe-area padding, and wrapped header and desk bars.
- **AMT / AMS degree.** For Aviation Maintenance Technician and Aviation Maintenance Specialist a required *Degree / program completed* field appears (Bachelor's or Associate). **AMS + Associate** also requires a 12-month OJT certificate upload (same quality checks as the COG and TOR, saved in the applicant's folder as `..._OJT-12mo`). The server re-checks both rules. The Monitoring-side Applications sheet gets two new columns, `degree` and `ojtLink`, added automatically. Rejecting an application also deletes the OJT file.

**Update steps:** paste `backend/apps-script.gs`, set `ADMIN_PASSCODE` and `TOCID_PASSCODE` to your passcodes, redeploy as a new version. `setupMonitoring` does not need to be re-run.

# CAAP Airmen Licensing — Form Generator (npm)

Requires **Node 18+**. No dependencies to install.

```bash
npm start                                  # http://localhost:8000
PORT=3000 npm start                        # different port (Windows: set PORT=3000 && npm start)
npm run dev                                # same, auto-reloads the browser when you edit a file
npm run build                              # writes dist/standalone.html (single file, PDFs embedded)
npm run set-passcode -- "new passcode"     # changes the staff passcode (default: LCD-admin-2026)
```

The app itself lives in `public/` (`index.html`, `coords.js`, `templates/`). Upload the
contents of `public/` to your website to host it. `backend/apps-script.gs` is the Google
Apps Script intake. After `set-passcode`, restart the server or re-run `npm run build`.

The page loads `pdf-lib` and `pdf.js` from cdnjs, so the browser needs internet access.

---


Fills the real CAAP PDFs by overlaying text, checkbox marks, the applicant's
photograph and signature onto the original documents. The output is the actual
CAAP form, not a lookalike — every line, box and piece of wording is the
original file.

## Files

| File | What it is |
|---|---|
| `index.html` | The app. Loads templates over HTTP. Use this on your website. |
| `standalone.html` | Same app with the three PDFs embedded (1.8 MB). Works from a double-click, no server needed. |
| `coords.js` | Every field position. **This is the only file you edit to nudge text.** |
| `templates/` | The three source PDFs (flow form, PEL 541, PEL 542). |
| `scripts/build.js` | `npm run build` - rebuilds `dist/standalone.html`. |
| `backend/apps-script.gs` | Ready-to-paste Google Apps Script intake. Writes to a private Sheet + Drive folder. |

## Running it

**Quick test:** open `standalone.html` in any browser.

**Local test of the hosted version** (`index.html` needs a server because
browsers block `fetch()` on `file://`):

```bash
cd caap-form-generator
npm start
# then open http://localhost:8000
```

**On your website:** upload the whole folder. Link to `index.html`, or embed it
with `<iframe src="/forms/index.html" width="100%" height="900"></iframe>`.

Everything runs in the visitor's browser. No data leaves their machine unless
you add a submission step (see below).

## What it produces

- **Flow, Permit and Clearance form** — always generated. Personal details,
  the "License Applied for" tick, the photo in the top-right box, and the
  client signature in row 8.
- **PEL Form 541** (flight crew) *or* **PEL Form 542** (other than flight
  crew), chosen by the applicant category toggle. Shared details carry over
  automatically, so nothing is typed twice.

The LCD-officer sections are deliberately left blank and locked — the applicant
cannot edit them: on the Flow form the whole "TO BE FILLED OUT BY LCD OFFICER"
block (types of license, license no., date of issuance, ratings, remarks, English
proficiency, limitations, other licenses) and the 8-step process table; on the PEL
forms section H "Authorized person's report" and all of page 2. The web form shows
that block as a greyed-out, disabled panel.

**No signatures.** The pre-printed LCD-officer signatures in row 1 of the Flow
form are painted out, and the applicant signature/name lines (Flow row 8, PEL 541
and 542 section H) are left blank. Ticking "Print my signature on PEL Form 541 / 542"
(off by default) prints the drawn/uploaded signature on those two forms only. The
Flow form never carries the applicant's signature or name line.

**Form 542 medical section (F)** is filled only for Air Traffic Controller, ATSEP,
Ground Instructor, Aeronautical Station Operator, Student ATC and Student ASO.
For every other 542 license the medical inputs are hidden and F is filled with N/A automatically.
The list is `MED_542` in `index.html`.

**Required fields.** Every field that applies to the chosen form and application type
is mandatory (marked with a red asterisk). Submit - and Generate PDF, unless you set
`ENFORCE_ON_GENERATE = false` in `index.html` - is refused while anything is empty: the
missing fields are outlined in red and listed at the top of the form, and on a bundled
541 application the page jumps to the tab that is incomplete. Applicants type `N/A`
in a box that does not apply. Conditional rules: PEL/License number and (542) section D
inputs are required only when the application is not Original; medical boxes only when
the form needs them; the "specify" boxes only when their category/rating is ticked;
Form 541 needs at least one category/class, at least one pilot-time entry (0 counts) and,
for Proficiency Check / Additional Rating, at least one rating; Form 542 needs a
basis. The signature is required only if "Print my signature" is ticked. "Save draft"
is never blocked. `backend/apps-script.gs` repeats the field checks server-side
(`missingFields_`) - redeploy it as a **new version** for that to take effect.

**Form 542 section D** (Current Airman License Information) is filled with N/A in
all seven boxes whenever the application is Original / Issuance, for every license
type; its inputs are hidden in that case.

**Auto draft.** Every time "Generate PDF" runs it also downloads
`caap-draft_LASTNAME-FIRSTNAME.json` (untick "Also save a draft file" to stop
this). "Load draft" restores the fields, pilot time and the uploaded photo /
uploaded signature. A signature drawn on the pad is not stored.

**Language proficiency** is required (and shown) on Form 542 only for Air Traffic
Controller and Aeronautical Station Operator (`LANG_542` in `index.html`; the same rule is
in `missingFields_` in `apps-script.gs`). For every other 542 license the box is hidden and
the Flow form prints N/A. On Form 541 the proficiency level (4/5/6) is optional.

## Admin and user views

Applicants see the normal form. The **Options** panel (merged-PDF toggle, auto-draft toggle,
date of application) is visible only to staff, via **Staff sign in** (top-right of the header).
In the user view: both forms are always merged into one PDF, no draft file is saved automatically
("Save draft" still works), and the application date is always today's date. The signed-in state
lasts for the browser tab only.

The default passcode is `LCD-admin-2026` - **change it** with `npm run set-passcode -- "new passcode"`.
This is a client-side gate that hides the panel; it is not security-grade (nothing in the panel is confidential).

## Adjusting a field position

Open `coords.js`. Every entry is `[x, top]` or `[x, top, maxWidth]`, measured
in points from the **top-left** of the page. Increase `x` to move right,
increase `top` to move down. 72 points = 1 inch. If a value is a hair too low,
subtract 1 or 2 from `top`, reload, regenerate.

`maxWidth` makes the text shrink to fit the slot rather than run into the next
label.

`flowRows` handles lines where a label sits to the right of a value (for
example `City : ___ State/Province : ___`). The renderer paints over the
labels and re-lays the whole line, so a long city name pushes the next label
right exactly the way the original Word document does.

`whiteout` covers stray marks baked into the blank template — the sample date
of birth and the `-` placeholders. `officerSigs` covers the two pre-printed
signatures in row 1. Those are now always left on the form -- they are part of
the document, not an option -- so nothing paints over them; the coordinates are
kept only in case they ever need to be removed again.

## Connecting it to your database

The submit button is built in but switched off until you give it somewhere to
send data.

1. Open `backend/apps-script.gs` and follow the setup comment at the top:
   create a Sheet and a Drive folder **while signed in as the licensing
   account**, paste their IDs in, deploy as a web app with access set to
   "Anyone".
2. Copy the `/exec` URL that deployment gives you.
3. In `index.html`, set `const SUBMIT_URL = '<that URL>';` near the top of the
   `<script>` block.
4. Run `npm run build` if you use the bundled version.

Applicants now get a **Submit to licensing office** button. It sends their
details, photo, signature and the finished PDF, then hands back a reference
number like `LCD-20260915-143210-EPIS` and downloads their copy.

On "Anyone" access: it lets anyone POST a submission, which is the point. It
does **not** let anyone read the Sheet — `doGet` returns nothing, and the
Sheet and Drive folder are never shared with anybody. That is the split you
wanted: the form is open to everyone, the database is not.

For the review side, point AppSheet (sign-in required, shared only with the
licensing e-mail) at that same Sheet. The `status` column starts at `NEW` so
your staff can move applications through the process.

Prefer something other than Google? The page POSTs one JSON object
(`{submittedAt, form, pilotTime, photo, signature, pdfName, pdf}`) and expects
`{ok:true, reference:"..."}` back, so any endpoint that speaks those two
shapes will work — Supabase Edge Function, PHP script, Node route.

## Known limits

- Fonts are Helvetica (metrically identical to Arial) because they are built
  into every PDF reader. Side by side with the originals the difference is
  invisible.
- Page 2 of both PEL forms is left untouched — it is entirely
  examiner/inspector territory.
- The Record of Pilot Time grid is wired up (all 11 rows × 15 columns, with
  the greyed cells locked and the PIC/SIC columns handled). In the two narrow
  "Night PIC" columns the figure prints beneath the printed PIC/SIC word
  because there is no room beside it — that is how the cell is drawn.

## Application types, file names and the daily limit

**Form 541** now opens with a step asking what is being filed: Original,
Reinstatement, or a bundle of **Upgrade of License / Application for
Proficiency Check / Additional Rating** (tick one or more). Each bundle item
gets its own tab and its own PEL Form 541 (own license, category and ratings);
personal details, photo, signature and pilot time are shared.

The 541 only has four "License Applied for" boxes, so: Upgrade -> Issuance,
Proficiency Check -> Additional Rating, Additional Rating -> Additional Rating.
Change the mapping in `APP_TYPES` (index.html).

**File names** (Drive and download): `ApplicationType_LASTNAME-FIRSTNAME_PELNO_Form541.pdf`,
e.g. `UpgradeOfLicense_DELACRUZ-JUAN_PEL12345_Form541.pdf`. The e-mail subject reads
`[Upgrade of License + Additional Rating] PEL Form 541 - Name - PEL No. - reference`
and the PDFs are attached. Drive files go straight into the folder set by `FOLDER_ID` (set `USE_DAY_SUBFOLDERS = true` in `apps-script.gs` to get a `yyyy-MM-dd` sub-folder again).

**Daily limit** (enforced in `apps-script.gs`, per e-mail address per Manila day):
one standard application (Original / Reinstatement / any Form 542), plus
each of Upgrade / Proficiency Check / Additional Rating once. E-mails are
normalised (case, `+tag`, gmail dots). After changing the script, redeploy it as a
**new version**. `standalone.html` ships with `SUBMIT_URL = ''` (local only).

## Photo and signature guidelines

The "Photograph & signature" section now shows the LCD photo memorandum
(quality, pose, expression, accessories, eyewear, clothing, signature) with two
sample photos (embedded in the page as small JPEGs; edit the `<figure>` blocks
in `#photoGuide` to change them). Uploads get an automatic compliance check (`analysePhoto()` in `index.html`):

- always, offline: file type, resolution, shape, plain-white background (fraction of
  near-white pixels beside/above the head, tint, shadow), exposure, sharpness,
  colour, even lighting;
- with the MediaPipe Face Landmarker (downloaded from jsdelivr / Google storage on
  the first upload, so it needs internet): exactly one face, face size and centring,
  head cut off, head tilt (roll) and turn (yaw), eyes open, mouth closed / no teeth,
  raised or frowning brows, possible eyeglasses. A closed-lip smile of any width is accepted;
  only teeth or gums showing is flagged.

The result is `pass`, `review` or `fail` with the reasons listed. It is advisory:
a `fail` asks for confirmation before submitting, it never locks the applicant out,
and the licensing office makes the final call. Earrings, necklaces, hair over the
eyes, ears, filters and photos of printed photos cannot be detected, so the
"I confirm my photograph..." box still covers them. Thresholds are constants inside
`analysePhoto()`; tune them against real submissions. A signature is required for
submitting only if "Print my signature" is ticked.

**Collared shirt and signature ink.** A collared shirt is required and is shown as a prominent
notice in the photo guide. The page cannot detect a collar, so it is covered by the "I confirm my
photograph shows me in a collared shirt..." box, which must be ticked before generating or
submitting. Signatures may be any ink colour; the check only looks for a visible signature on a
plain white background.

## One pending application per person (anti-spam)

`backend/apps-script.gs` refuses a new Original or Reinstatement while the same person
already has one of the same type, on the same PEL form (541/542), whose **status** cell in the
`Applications` sheet is `NEW` or `IN REVIEW`. The person is matched on last name + first name +
date of birth (spacing, capitals and accents ignored), so changing e-mail address does not get
around it. Nothing is saved or e-mailed for a refused submission.

**Staff:** when you have dealt with an application, change its `status` cell to anything else
(`PROCESSED`, `REJECTED`, ...). That lets the person apply again. To let someone fix a mistake,
set their old row to `REJECTED`. Upgrade, Proficiency Check and Additional Rating are not
affected (they keep the one-per-type-per-day rule). Change `PENDING_BLOCK_TYPES` and
`PENDING_STATUSES` at the top of the script to adjust the rule.

Limits: a person who changes the spelling of their name or their birth date gets through, and
a status cell typed with a typo (e.g. `PROCESED`) counts as not pending.

The notification e-mail is also sent in its own try/catch now, so an e-mail failure can no longer
turn a saved application into an error message.

After updating the script, redeploy it as a **new version** (Deploy > Manage deployments).


## v5.1 changes

- **One button.** The bottom bar now has only **Submit**. Generate PDF / Save draft / Load draft are gone from the applicant view.
- **Review pop-up.** Submit first validates, then shows every detail (personal, license, medical, pilot time, photo, signature). The applicant must press *"Yes, I am certain all the information is correct - Submit"*; *"Go back and edit"* cancels.
- **Draft saved with every submission.** The JSON draft is written to the same Drive day-folder as the PDFs (new `draftLink` column in the Sheet). Staff: Staff sign in > Options > **Load a saved draft** to reload it and make changes. Without a `SUBMIT_URL` (standalone copy) Submit downloads the PDFs and the draft instead.
- **PEL 541 section G** (medical) values are now inside the box (`medBox` in `coords.js` redraws the bottom border 7pt lower).
- Redeploy `backend/apps-script.gs` as a **new version** for the draft saving to work.

## Staff Approve button

In the staff view (Staff sign in) a green **Approve** button appears next to Submit. It builds the application PDF with today's date printed (larger font) in the **Date In** and **Date Permit Issue** boxes of row 1 of the Flow form, and keeps the pre-printed Endorsing / Approving officer signatures (applicants' copies still have them painted out). The PDF downloads as `..._APPROVED.pdf`. Position and size: `flow.approve` in `coords.js`.

## TOCID validation (step 3 of the process)

1. The applicant submits. 2. ALD staff check the diploma / TOR. 3. **TOCID** opens the application, validates it with the stamp. 4. ALD staff **Approve** it.

- Header link **TOCID sign in** (default passcode `TOCID-2026`: change it, see below). Opens a full-screen TOCID view: list of applications (from the Sheet), the data-flow preview, and the stamp form (ATOC active Yes/No, Diploma W/ or W/O, Transcript of records W/ or W/O, Special order #, Remarks, Date).
- **Validate & stamp** prints the stamp in the Remarks cells of rows 1-2 of the Flow form with the fixed signature (`public/templates/tocid-signature.png`) and the name *Capt. King William P. Valdez*, then **overrides the stored application**: the draft `.json` in the Drive folder is overwritten and the Sheet gets `tocidStatus`, `tocidDate`, `tocidData`. (The Sheet `status` is left alone because it drives the one-pending-application rule.)
- ALD staff then load the (overwritten) draft and press **Approve**: the PDF carries the stamp, today's date and the officer signatures.
- Changing the passcode: `npm run set-passcode -- --tocid "new passcode"`, then put the SAME passcode in `TOCID_PASSCODE` in `backend/apps-script.gs` and redeploy a new version. The server checks it, so nobody can list or change applications without it.
- Stamp position: `flow.tocid.box` in `coords.js`.
- Older submissions made before drafts were saved have no draft in Drive and cannot be opened from the list.

## v5.3: folders, Monitoring sheet, TOCID list per date

- **Folders:** `FOLDER_ID / yyyy-MM-dd / LAST-FIRST_<control no.> /` holds that submission's PDFs, photo, signature and draft. (`USE_DAY_SUBFOLDERS` in `apps-script.gs`.)
- **Monitoring tab** (same spreadsheet; the `Applications` tab stays as the database): Control No., Name of the Applicant, Type of Application, ALD Initial Approval, TOCID Validation, ALD Approval for KTP, Remarks. The three approval columns are Pending / Approved dropdowns (coloured). ALD Initial Approval and Remarks are manual. TOCID Validation turns Approved automatically when TOCID validates. ALD Approval for KTP turns Approved automatically when staff press Approve (needs `ADMIN_PASSCODE` in `apps-script.gs` = the staff passcode).
- **Existing applications:** in the Apps Script editor choose `setupMonitoring` and press Run once.
- **TOCID list:** grouped per date (newest first) with `n TO DO` per day; items show TO DO, then DONE after validation; "Show only TO DO" filter.
- Drafts saved from now on contain their control no.; older drafts can still be approved, but their Monitoring row must be set by hand.

## v5.4

**Applicant form**
- New required fields: **School where you graduated** and **Year graduated** (shown on the to-do lists).
- New required uploads: **COG / Diploma** and **Transcript of Records** (JPG, PNG or PDF, max 6 MB). A file is **rejected outright** (never accepted "anyway", and not stored) if it is too small, too dark, washed out, low contrast or blurry. Thresholds: `DOC_MIN_SHARP`, `DOC_MIN_SHORT`, `DOC_MIN_LONG`, `DOC_MIN_STD`, `DOC_MIN_MEAN` near the top of the script in `index.html` (raise `DOC_MIN_SHARP` to be stricter).
- The **photo** and the **signature** are also rejected outright when they fail their checks (the old "submit anyway" question is gone).
- The "Print my signature" tick box is removed: the signature is **always** printed on PEL 541 / 542 and is required.
- Attachments are saved in the applicant's own Drive folder with the PDFs: `Main folder / yyyy-MM-dd / LAST-FIRST_<control no.> /`.

**Staff (ALD) desk**: *Staff sign in* now opens a to-do list (grouped per date, search, "Show only TO DO"), with school/year, days pending, who is processing it, the diploma and TOR, and the data flow. Buttons: **Initial approval**, **Approve for KTP & download PDF** (available once TOCID has validated), **Reject**, **Open in the form editor** (then "To-do list" in the header returns).

**TOCID desk**: same list; **Validate & stamp**, **Name not on the graduates list** (e-mails the applicant, closes the application) and **Reject**. The stamp now prints in the free area of the *XIII Remarks* block (`flow.tocid.box` in `coords.js`).

**Reject (every step, both desks)**: asks for a reason, then deletes the applicant's Drive folder, marks the rows REJECTED (so the one-pending rule and the daily limit no longer block them), sets that step to *Rejected* in the Monitoring sheet with the reason in Remarks, and e-mails the applicant the reason. They can apply again straight away.

**Being Processed**: opening an application marks it in the Monitoring sheet and on both lists. If someone else already has it you are asked before taking over. Marks older than 3 hours (`STALE_CLAIM_HOURS`) are ignored. It is cleared when the step is finished, when another application is opened, on sign-out, or by deleting the cell.

**Monitoring sheet** (columns): Control No. | Name | Type | Date & Time Submitted | Days Pending | Being Processed | ALD Initial Approval | TOCID Validation | ALD Approval for KTP | Remarks. Days Pending counts the submission day as day 1, is coloured green 1-5 / yellow 6-10 / red 11+, and shows *Done* or *Rejected* when finished. Approval cells are Pending / Approved / Rejected dropdowns. An existing 7-column Monitoring tab is upgraded automatically (run `setupMonitoring` once).

**Redeploy checklist**: paste `backend/apps-script.gs`, set `TOCID_PASSCODE` and `ADMIN_PASSCODE` to the same passcodes used on the page, run `setupMonitoring` once, then Deploy > Manage deployments > Version: New version. Older submissions (no folder / draft) can be listed but not opened or fully deleted.

## v6.2
- **Registers:** the permit now writes to the right register tab (Mechanics = AMT+AMS, Pilot, Other Airmen), found by gid in `REGISTERS` (apps-script.gs). Each tab keeps its own control number and Temporary PEL series. Fill in `REGISTER_SHEET_ID` (or the `id` of each tab), then redeploy. Test Facility defaults to `REGISTER_TEST_FACILITY`; Evaluator (Mechanics tab) = initials of the ALD user.
- **Look:** refreshed stylesheet appended at the end of the `<style>` block in `public/index.html` (overrides only; delete the "v6.2 visual refresh" block to revert).

## v7.4

**PEL 542 and Flow form (from the earlier part of this release)**
- PEL 542 template replaced with the corrected 2-page form (A-H on page 1, I-L on page 2); `f542` in `public/coords.js` re-measured. New **GI RATINGS** box (`rtg_gi`) with a "GI ratings - specify" field.
- The 542 C.4 row (city / province / ZIP / country) prints below its labels and shrinks or wraps to 2 lines; the permanent address on the 542 and on the Flow form wraps to 2 lines when long (`makeDrawer.block`).

**Calendar and working days (administrator)**
- New **Calendar** tab in Analytics (administrator only): holidays and working weekends. Backend tab `Calendar` (`date | label | kind`, dates as text `yyyy-MM-dd`, kind `HOLIDAY` or `WORKDAY`; created automatically). Op `calendarSave` (action `add` / `remove`, admin role only); the calendar list is returned inside `analyticsData`. A `WORKDAY` is only accepted on a Saturday or Sunday (checked on the page and on the server).
- Every duration in the dashboard is now in **working days** (Mon-Fri, holidays excluded; a Sat/Sun marked WORKDAY counts). `anBiz(t1, t2)` uses a prefix-sum array of business days from the earliest year and returns fractional days (the overlap of each business day with the interval, divided by 24 h). It replaces the old real-time maths for `dInit`, `dToc`, `dLo`, `dKtp`, `dTotal`, `dRej` and the age of pending applications, so late counts and on-time goals use working days. Saving the calendar rebuilds all rows at once (`anLoad` = fetch, `anBuild` = rebuild).

**Staff tab: one person in detail**
- A dropdown lists everyone found in the records (ALD, TOCID, LO, with role). The chosen person gets `anPersonView`: workload KPIs (assigned, steps done, pending now), time per step (median / average / slowest 1 in 10 / longest / on time), actions per month, late items (steps slower than the goal, plus pending first reviews older than the goal), rejections with reasons, and the list of their applications, plus the "How long approved applications took" bars and the on-time donut for their approved applications. The view spans the full width of the page.

**My performance (ALD / TOCID / Licensing Officer)**
- New **My performance** button in the desk header. Server op `myPerformance` (any signed-in ALD / TOCID / LO account) shares `anaCollect_()` with the analytics op, keeps only records where the person is the assignee, did a step, or made the rejection (name match, case-insensitive), blanks every other person's name and the applicant key, and returns `{head, rows, me, cal, now}`. The page reuses `anPersonView` with the same working-day rules and an adjustable "late after" goal.

**Certificate of Employment**
- PEL 542 applications made on the basis of **Experience** now require a Certificate of Employment upload (`coe`; shown or hidden when the Basis boxes change). It is listed in the review screen, the compiled PDF, the desk attachments and the validation message. Backend: new `coeLink` column (appended at the end of `COLUMNS`), `DOC_NAMES.coe`, `docKeysFor_` adds `coe`, the file is saved as `_CertificateOfEmployment`, returned in `deskGet` attachments and moved with the other files on rejection.

**Experience basis and defaults (v7.4 update)**
- The on-time / late goal now defaults to **5 working days** (Analytics filter bar and My performance).
- When a 542 application is made on the basis of **Experience**, the documents are: **AMT and AMS: only the Certificate of Employment (COE)**; **every other license: Training Certificate + COE**. TOR, Diploma/COG, OJT and the other license documents are not asked, and the AMT/AMS degree question is hidden. A hint under the COE upload states the experience it must show: AMS 3 years; AMT 2.5 years Airframe, 2.5 years Powerplant, 5 years Airframe and Powerplant (from the ticked ratings). The server (`docKeysFor_`) applies the same rule.

**Redeploy checklist**: paste `backend/apps-script.gs`, then Deploy > Manage deployments > Version: New version. The `Calendar` tab is created on first use and the `coeLink` header is appended to the Applications tab automatically. Add the holidays in Analytics > Calendar (administrator) so waiting times skip them.

## v7.4.1 (analytics fixes)
- **Waiting-time bars now agree with the on-time figures.** "On time" always means *took at most the goal* (working days). The bars of "How long approved applications took" (Waiting times tab, one-person view and My performance) are built around the goal: the goal is always a bar edge, upper edges are inclusive, and a bar is green exactly when everything in it is on time. Labels are now "1 day or less", "Over 1 to 3 days", ...
- **Licensing Officer rejections** are counted under the Licensing Officer (new column *Rejections made* in the Licensing Officers table of the Staff tab) instead of under ALD staff. Only the page changes: upload ALL of `public/`; the script needs no update.
- **"On time" in the one-person view / My performance no longer ignores unfinished work.** Applications still waiting for the person's first review and already past the goal now count as late in *Steps on time* and in the *ALD first review* row, and a note under the table and the approved-applications chart says how many are still open. (The charts of *approved* applications can only show finished ones, hence the note.)
- **One-person view / My performance: new "Pending now" chart (first card of the charts row).** Shows how many applications are waiting for this person's first review, grouped by working days waited (green = within the goal, red = past it), with the oldest ones listed.
- **v7.4.2 time zone fix.** The page stores the submission time as a UTC ISO string; the analytics cut it to 16 characters and read it as local time, so every *submitted* time in the dashboard was 8 hours early (while step times from the Handled By log are Manila time). `anFixT` in `public/index.html` now converts these values to Manila time when the dashboard loads (live and archived rows, no script change). Effects: waiting times from submission (first review, whole journey, rejections, age of pending applications) were about 0.33 working day too long; submissions between 00:00 and 08:00 Manila were counted on the previous day / month; the weekday x hour heat map was shifted by 8 hours.
- **Received -> done for every step.** One-person view / My performance: the Applications table now has one line per step the person did with *Received by them*, *Done by them* and *Time taken* (first review, TOCID, Licensing Officer, final approval, rejections, applications still waiting). Overview: new card *Step by step* with the 25 most recent applications, each step as "received -> finished" plus working days, and the typical wait per step.
