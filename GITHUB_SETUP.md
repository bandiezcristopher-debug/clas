# Putting this on GitHub

This copy is prepared for GitHub: the real passcode, the Google Sheet / Drive / register IDs and the TOCID signature image
are NOT in it. The web page is published by GitHub Pages from `public/`; the backend stays in Google Apps Script.

## 1. Publish the page
1. Create a repository on GitHub and push this folder to the `main` branch
   (`git init`, `git add .`, `git commit -m "CLAS"`, `git branch -M main`, `git remote add origin <url>`, `git push -u origin main`).
2. Repository **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. The workflow `.github/workflows/pages.yml` runs on every push to `main` and publishes `public/`.
   The address is shown in the workflow run (`https://<account>.github.io/<repository>/`).
   Pages is free for public repositories; a private repository needs a paid GitHub plan.

## 2. Backend (stays on Google, never on GitHub)
- Open your Apps Script project and paste `backend/apps-script.gs`, then fill in `SHEET_ID`, `FOLDER_ID`, `REGISTER_SHEET_ID`
  and a NEW `ADMIN_PASSCODE` **in the Apps Script editor only**. Do not commit those values.
- Deploy > Manage deployments > **New version**. The web app URL stays the same, so `SUBMIT_URL` in `public/index.html` keeps working.
  (`SUBMIT_URL` is public by design: applicants' browsers must call it. Staff actions are checked on the server.)

## 3. Things to do once
- Change the administrator passcode. The old one was visible in the old script file and, as a SHA-256 hash, in the old page.
- The TOCID signature image in `public/templates/tocid-signature.png` is a blank placeholder (it is only the fallback for officers without
  their own signature). Keep the real file out of a public repository.
- Never commit exports (CSV from the dashboard), spreadsheets or applicant files. `.gitignore` blocks the common ones.
- `dist/standalone.html` (double-click copy) is not published; build it locally with `npm run build` if you need it.
