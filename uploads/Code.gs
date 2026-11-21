const FOLDER_ID = '1bv2LLrNlG3Hcj1Wdy7iNd1P0PBVuRk_f';
const OWNER = 'ju@wayequity.co';
const WEBSITE = 'https://d3kk6kbbp4x94g.cloudfront.net/?page=upload';
const MAX_BYTES = 20 * 1024 * 1024;

function doGet() {
  const page = HtmlService.createTemplateFromFile('Index');
  page.invitation = '';
  if (Session.getActiveUser().getEmail() === OWNER) {
    const props = PropertiesService.getScriptProperties();
    let token = props.getProperty('UPLOAD_INVITATION');
    if (!token) {
      token = Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('UPLOAD_INVITATION', token);
    }
    page.invitation = WEBSITE + '#invite=' + token;
  }
  return page.evaluate().setTitle('CBS | 資料共有')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function authorize_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('UPLOAD_INVITATION');
  if (!expected || typeof token !== 'string' || token !== expected) throw new Error('専用の共有リンクから開いてください。');
}

function validate_(data) {
  if (!data || !/^[a-f0-9-]{36}$/.test(data.id) || typeof data.explanation !== 'string' || data.explanation.length > 5000 || !data.explanation.trim()) throw new Error('資料の説明をご記入ください（5,000文字以内）。');
  if (!Array.isArray(data.files) || !data.files.length || data.files.length > 20) throw new Error('ファイルは1〜20件で選択してください。');
  let total = 0;
  return data.files.map((file, index) => {
    if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 200 || /[\x00-\x1f/\\]/.test(file.name)) throw new Error('ファイル名を確認してください。');
    if (typeof file.base64 !== 'string' || file.base64.length > 14 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) throw new Error('ファイルを読み取れませんでした。');
    const bytes = Utilities.base64Decode(file.base64);
    total += bytes.length;
    if (!bytes.length || bytes.length > 10 * 1024 * 1024 || total > MAX_BYTES) throw new Error('1件10MB、合計20MB以内のファイルを選択してください。');
    const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
    return {name:file.name, storedName:String(index + 1).padStart(2,'0') + '_' + file.name, size:bytes.length, hash:hash, bytes:bytes};
  });
}

function saveSubmission(token, data) {
  authorize_(token);
  const files = validate_(data);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('別の送信を処理中です。少し待って再度送信してください。');
  try {
    const root = DriveApp.getFolderById(FOLDER_ID);
    const folders = root.getFoldersByName(data.id);
    const folder = folders.hasNext() ? folders.next() : root.createFolder(data.id);
    const entries = folder.getFilesByName('_submission.json');
    const signature = JSON.stringify({explanation:data.explanation.trim(),files:files.map(f=>({name:f.name,size:f.size,hash:f.hash}))});
    let recordFile, record;
    if (entries.hasNext()) {
      recordFile = entries.next();
      record = JSON.parse(recordFile.getBlob().getDataAsString());
      if (record.signature !== signature) throw new Error('送信内容が変更されています。新しい送信としてやり直してください。');
      if (record.status === 'complete') return receipt_(record);
    } else {
      record = {id:data.id,at:new Date().toISOString(),explanation:data.explanation.trim(),signature:signature,status:'pending',files:[]};
      recordFile = folder.createFile('_submission.json', JSON.stringify(record), 'application/json');
    }
    for (const file of files) {
      const existing = folder.getFilesByName(file.storedName);
      let saved;
      if (existing.hasNext()) {
        saved = existing.next();
        const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saved.getBlob().getBytes()));
        if (hash !== file.hash) throw new Error('保存済みファイルの確認が必要です。WAYにご連絡ください。');
      } else {
        saved = folder.createFile(Utilities.newBlob(file.bytes, 'application/octet-stream', file.storedName));
      }
      if (!record.files.some(f=>f.id === saved.getId())) record.files.push({id:saved.getId(),name:file.name,size:file.size});
      recordFile.setContent(JSON.stringify(record));
    }
    const notes = folder.getFilesByName('資料の説明.txt');
    if (!notes.hasNext()) folder.createFile('資料の説明.txt', record.explanation, 'text/plain');
    record.status = 'complete';
    recordFile.setContent(JSON.stringify(record));
    return receipt_(record);
  } finally { lock.releaseLock(); }
}

function receipt_(record) {
  return {id:record.id,at:record.at,explanation:record.explanation,files:record.files.map(f=>({name:f.name,size:f.size}))};
}

function listSubmissions(token) {
  authorize_(token);
  const folders = DriveApp.getFolderById(FOLDER_ID).getFolders();
  const result = [];
  // shortcut: this small intake folder is scanned, add an index when submissions exceed 100.
  let scanned = 0;
  while (folders.hasNext() && scanned++ < 100) {
    const entries = folders.next().getFilesByName('_submission.json');
    if (entries.hasNext()) {
      const record = JSON.parse(entries.next().getBlob().getDataAsString());
      if (record.status === 'complete') result.push(receipt_(record));
    }
  }
  return result.sort((a,b)=>b.at.localeCompare(a.at));
}
