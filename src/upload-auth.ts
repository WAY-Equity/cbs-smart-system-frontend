// Apps Script nests the user HTML inside Google's own wrapper frames.
export function isUploadFrameOrigin(origin:string):boolean {
  try{const url=new URL(origin);return url.protocol==='https:' && /^n-[a-z0-9-]+-script\.googleusercontent\.com$/.test(url.hostname);}catch{return false;}
}
export function isUploadDescendant(source:MessageEventSource|null,frame:Window|null):source is Window {
  if(!source||!frame)return false;
  try{let current=source as Window;for(let depth=0;depth<5;depth++){if(current===frame)return true;if(current.parent===current)return false;current=current.parent;}}catch{/* Unrelated window. */}
  return false;
}
