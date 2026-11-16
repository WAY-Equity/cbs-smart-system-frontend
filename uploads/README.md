# CBS document intake

The existing CBS website opens the upload page at `?page=upload`. A Google Apps Script web app serves the form and saves files to the private `CBS 資料共有` Drive folder. No Drive credentials are placed in the website.

## Deployment

1. Apps Script project: https://script.google.com/home/projects/1GnLn-vHW50i3C98hO5rMq2yWxABY-xVFSQOXjeAEMDG9DORsoAlu_bDW/edit
2. The source is `Code.gs` and `Index.html`. The editor currently contains a single bundled `Code.gs` with the HTML in `UPLOAD_HTML`; use these source files for future edits. `appsscript.json` documents the required scopes.
3. Deploy as the owner (`ju@wayequity.co`). External access and Drive authorization require the owner's approval. The initial deployment was authorized on 2026-11-16.
4. Run `doGet` once from the Apps Script editor as the owner and approve the requested identity permission. This initializes `UPLOAD_INVITATION` in Script Properties. The owner panel can then display the invitation URL; alternatively append the property value as `#invite=…` to the CBS website upload URL. Share this URL privately; do not commit or publish the token.
5. The public `/exec` deployment URL is in `src/UploadPage.tsx`. Publish updates through the existing GitHub Pages workflow.

Storage: https://drive.google.com/drive/folders/1bv2LLrNlG3Hcj1Wdy7iNd1P0PBVuRk_f (in My Drive, beside the meeting memo).

## Behavior and limits

- Multiple selections append; files can be removed before submission. One explanation applies to the entire submission.
- Up to 20 nonempty files, 10 MB each and 20 MB total; explanation is required, up to 5,000 characters.
- A submission gets its own folder. Files use numbered original names to avoid collisions; explanation is also saved as `資料の説明.txt` and metadata as `_submission.json`.
- Only complete submissions appear in history. Files are never publicly shared; history includes filenames, sizes, dates, and explanations, but no download links.
- The invitation is a bearer credential. Anyone possessing it can submit and read this intake's history. To revoke it, delete `UPLOAD_INVITATION` in Script Properties and run `doGet` in the editor as owner to generate a replacement. Do not embed it in the public sidebar link.
- An unchanged retry in the same open page reuses the submission ID, checks file hashes, and resumes interrupted saves. After a page reload, check history before resubmitting. Refreshing or changing a failed submission may create another batch; pending partial files remain in Drive for recovery.
- History scans up to 100 submission folders. Add an index before the intake exceeds that size. Apps Script quotas and Drive capacity apply.
- Google DriveApp requests broad Drive permission even though this code targets only the intake folder. It also requests the signed-in email to show the owner-only invitation panel.

## Verification

`node --experimental-strip-types --test tests/*.test.ts` checks authorization, input bounds, paired file/explanation storage, idempotent retries, and partial failure recovery. The website also needs `pnpm build`.

Local browser checks cover multi-select, appending, removal, and explanation input. A real upload and external-visitor iframe access must be checked after authorization and deployment; they have not yet been verified.
