# CBS document intake

The existing CBS website opens the upload page at `?page=upload`. A Google Apps Script web app serves the form and saves files to the private `CBS 資料共有` Drive folder. No Drive credentials are placed in the website.

## Deployment

1. Apps Script project: https://script.google.com/home/projects/1GnLn-vHW50i3C98hO5rMq2yWxABY-xVFSQOXjeAEMDG9DORsoAlu_bDW/edit
2. The source is `Code.gs` and `Index.html`. The editor currently contains a single bundled `Code.gs` with the HTML in `UPLOAD_HTML`; use these source files for future edits. `appsscript.json` documents the required scopes.
3. Deploy as the owner (`ju@wayequity.co`). External access and Drive authorization require the owner's approval. The initial deployment was authorized on 2026-11-16.
4. Authorize the Apps Script owner for Drive and outbound requests. Uploads and history require the current Auth0 access token; the server validates it at the fixed tenant UserInfo endpoint and enforces the same eight verified passwordless emails. Invitation links are no longer accepted. Deploy the matching frontend and form together.
5. The public `/exec` deployment URL is in `src/UploadPage.tsx`. Publish updates through the existing GitHub Pages workflow.

Storage: https://drive.google.com/drive/folders/1PGRk1HgB_ArV5oIRCijzROlPlObjL94r (shared destination for new submissions).

## Behavior and limits

- Multiple selections append; files can be removed before submission. One explanation applies to the entire submission.
- Up to 20 nonempty files, 100 MB each and 1 GB total; explanation is required, up to 5,000 characters.
- A submission gets its own folder. Files use numbered original names to avoid collisions; explanation is also saved as `資料の説明.txt` and metadata as `_submission.json`.
- Only complete submissions appear in history. Files are never publicly shared; history includes filenames, sizes, dates, and explanations, but no download links.
- All eight authorized CBS users can submit and view the shared submission history. The login token is carried only in memory and RPC arguments, not URLs or Drive metadata. Every RPC validates it with Auth0; failures and unavailable Auth0 responses deny access.
- An unchanged retry in the same open page reuses the submission ID, checks file hashes, and resumes interrupted saves. After a page reload, check history before resubmitting. Refreshing or changing a failed submission may create another batch; pending partial files remain in Drive for recovery.
- History scans up to 100 submission folders. Add an index before the intake exceeds that size. Apps Script quotas and Drive capacity apply.
- Google DriveApp requests broad Drive permission even though this code targets only the intake folder.

## Verification

Build the website with `pnpm build`.

Verified on 2026-11-16: production CBS page loads the invitation-protected form and reads history; the no-invitation view keeps controls disabled. Local browser checks cover multi-select, appending, removal, and explanation input. The native file picker opens, but automated selection inside the hosted iframe was blocked by browser tooling; the complete browser-to-Drive submit path and a separate external Google account remain unverified.

Large uploads use 4 MiB resumable Drive API chunks, with server-side size validation. Deployment requires the Drive API enabled in the Apps Script Cloud project and authorization for script.external_request. These larger limits are not live until that authorization and deployment are completed.

The form now uses a parent-origin allowlist and a random per-frame bridge ID. The parent verifies that requests originate in its own nested Apps Script iframe before sending an access token. Standalone Apps Script visits show a prompt to open the form through CBS. Existing `UPLOAD_INVITATION` Script Properties are unused.
