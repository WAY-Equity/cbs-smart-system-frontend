const FOLDER_ID = '1PGRk1HgB_ArV5oIRCijzROlPlObjL94r';
const AUTH0_USERINFO='https://dev-m4cnup0ujpc2l7wn.us.auth0.com/userinfo';
const ALLOWED_EMAILS=['kusaka@cbs-f.com','ju@wayequity.co','nakai@cbs-f.com','y-tomokata@cbs-hd.club','nakahara@wayequity.co','nakahara@soramanagement.co','horie@wayequity.co','chen@wayequity.co'];
const MAX_BYTES = 20 * 1024 * 1024;

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('CBS | 資料共有')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function authorize_(token) {
  const denied='ログインを確認できません。CBSに再度ログインしてください。';
  if(typeof token!=='string'||!token||token.length>16384||/[\r\n]/.test(token))throw new Error(denied);
  let response;
  try{response=UrlFetchApp.fetch(AUTH0_USERINFO,{headers:{Authorization:'Bearer '+token},muteHttpExceptions:true,followRedirects:false});}catch{throw new Error(denied);}
  if(response.getResponseCode()!==200)throw new Error(denied);
  let user;try{user=JSON.parse(response.getContentText());}catch{throw new Error(denied);}
  if(!user||user.email_verified!==true||typeof user.sub!=='string'||!user.sub.startsWith('email|')||typeof user.email!=='string'||!ALLOWED_EMAILS.includes(user.email.trim().toLowerCase()))throw new Error(denied);
  return user;
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

// Large uploads relay 4 MiB chunks to Drive; OAuth credentials never leave Apps Script.
function beginLargeUpload(token, data) {
  authorize_(token);
  if (!data || !/^[a-f0-9-]{36}$/.test(data.id) || typeof data.explanation !== 'string' || !data.explanation.trim() || data.explanation.length>5000 || !Array.isArray(data.files) || !data.files.length || data.files.length>20) throw new Error('送信内容を確認してください。');
  let total=0;
  data.files.forEach(f=>{if(!f || typeof f.name!=='string' || !f.name.trim() || f.name.length>200 || /[\x00-\x1f/\\]/.test(f.name) || !Number.isSafeInteger(f.size) || f.size<=0 || f.size>100*1024*1024)throw new Error('1件100MB以内のファイルを選択してください。');total+=f.size;});
  if(total>1024*1024*1024)throw new Error('合計1GB以内のファイルを選択してください。');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const root=DriveApp.getFolderById(FOLDER_ID), existing=root.getFoldersByName(data.id);
    const folder=existing.hasNext()?existing.next():root.createFolder(data.id);
    const entries=folder.getFilesByName('_submission.json');
    const signature=JSON.stringify({explanation:data.explanation.trim(),files:data.files});
    if(entries.hasNext()) {const record=JSON.parse(entries.next().getBlob().getDataAsString());if(record.signature!==signature)throw new Error('送信内容が変更されています。');return {id:record.id};}
    folder.createFile('_submission.json',JSON.stringify({id:data.id,at:new Date().toISOString(),explanation:data.explanation.trim(),signature,status:'pending',files:[],expected:data.files,uploads:{}}),'application/json');
    return {id:data.id};
  } finally {lock.releaseLock();}
}
function largeRecord_(id) {
  if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('受付番号が無効です。');
  const folders=DriveApp.getFolderById(FOLDER_ID).getFoldersByName(id);
  if(!folders.hasNext())throw new Error('受付が見つかりません。');
  const folder=folders.next(), file=folder.getFilesByName('_submission.json').next();
  return {folder,file,record:JSON.parse(file.getBlob().getDataAsString())};
}
function driveFetch_(url,options) {
  return UrlFetchApp.fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
}
function uploadLargeChunk(token,id,index,offset,base64) {
  authorize_(token);
  if(!Number.isInteger(index)||index<0||!Number.isSafeInteger(offset)||offset<0||typeof base64!=='string'||base64.length>5600000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))throw new Error('送信データが無効です。');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const {folder,file,record}=largeRecord_(id), expected=record.expected&&record.expected[index];
    if(!expected)throw new Error('資料が見つかりません。');
    if(record.files[index])return {offset:expected.size,done:true};
    let upload=record.uploads[index];
    if(!upload){
      const response=driveFetch_('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,size',{method:'post',contentType:'application/json',headers:{'X-Upload-Content-Type':'application/octet-stream','X-Upload-Content-Length':String(expected.size)},payload:JSON.stringify({name:String(index+1).padStart(2,'0')+'_'+expected.name,parents:[folder.getId()]})});
      if(response.getResponseCode()!==200)throw new Error('Driveへの接続に失敗しました。');
      const headers=response.getAllHeaders(),url=headers.Location||headers.location;
      if(typeof url!=='string'||!url.startsWith('https://www.googleapis.com/'))throw new Error('Driveの送信先を確認できませんでした。');
      upload=record.uploads[index]={url,offset:0};file.setContent(JSON.stringify(record));
    }
    // Query Drive on every retry: a prior response may have been lost after bytes arrived.
    let response=driveFetch_(upload.url,{method:'put',headers:{'Content-Range':'bytes */'+expected.size},payload:''});
    function applyResponse(result){
      const code=result.getResponseCode();
      if(code===200||code===201){const saved=JSON.parse(result.getContentText());if(Number(saved.size)!==expected.size)throw new Error('保存サイズが一致しません。');record.files[index]={id:saved.id,name:expected.name,size:expected.size};delete record.uploads[index];file.setContent(JSON.stringify(record));return {offset:expected.size,done:true};}
      if(code!==308)throw new Error('アップロードを再開できませんでした。時間をおいて再度お試しください。');
      const headers=result.getAllHeaders(),range=headers.Range||headers.range;upload.offset=range?Number(String(range).split('-').pop())+1:0;file.setContent(JSON.stringify(record));return {offset:upload.offset,done:false};
    }
    const progress=applyResponse(response);
    if(progress.done||offset!==progress.offset||!base64)return progress;
    const bytes=Utilities.base64Decode(base64);
    if(!bytes.length||bytes.length>4*1024*1024||offset+bytes.length>expected.size||(offset+bytes.length<expected.size&&bytes.length%(256*1024)!==0))throw new Error('分割データのサイズが無効です。');
    response=driveFetch_(upload.url,{method:'put',contentType:'application/octet-stream',headers:{'Content-Range':'bytes '+offset+'-'+(offset+bytes.length-1)+'/'+expected.size},payload:bytes});
    return applyResponse(response);
  } finally {lock.releaseLock();}
}
function finishLargeUpload(token,id) {
  authorize_(token);const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const {folder,file,record}=largeRecord_(id);
    if(!record.expected||record.expected.some((f,i)=>!record.files[i]||record.files[i].size!==f.size))throw new Error('送信が完了していない資料があります。');
    if(!folder.getFilesByName('資料の説明.txt').hasNext())folder.createFile('資料の説明.txt',record.explanation,'text/plain');
    record.status='complete';file.setContent(JSON.stringify(record));return receipt_(record);
  } finally {lock.releaseLock();}
}
