// Run only from the Apps Script editor; creates and trashes its own test submission.
function verifyUpload() {
  if (Session.getActiveUser().getEmail() !== OWNER) throw new Error('Owner only');
  const token = PropertiesService.getScriptProperties().getProperty('UPLOAD_INVITATION');
  const id = Utilities.getUuid();
  const data = {id:id, explanation:'[WAY verification] Harmless test documents, not business records.', files:[
    {name:'sample-a.txt',base64:Utilities.base64Encode('CBS upload check A')},
    {name:'sample-b.txt',base64:Utilities.base64Encode('CBS upload check B')}
  ]};
  try {
    const first = saveSubmission(token,data);
    const retry = saveSubmission(token,data);
    const matches = listSubmissions(token).filter(row=>row.id===id);
    if (first.files.length!==2 || retry.id!==id || matches.length!==1 || matches[0].explanation!==data.explanation) throw new Error('Upload verification failed');
    const folder = DriveApp.getFolderById(FOLDER_ID).getFoldersByName(id).next();
    if (folder.getFilesByName('01_sample-a.txt').next().getBlob().getDataAsString()!=='CBS upload check A' || folder.getFilesByName('02_sample-b.txt').next().getBlob().getDataAsString()!=='CBS upload check B') throw new Error('Stored contents differ');
    console.log('PASS: two files, exact bytes, explanation, history, and idempotent retry.');
  } finally {
    const folders = DriveApp.getFolderById(FOLDER_ID).getFoldersByName(id);
    while(folders.hasNext()) folders.next().setTrashed(true);
  }
}
