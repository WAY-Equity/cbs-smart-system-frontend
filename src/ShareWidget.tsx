import {useRef,useState} from 'react';
import {FolderOpen,X} from 'lucide-react';
import UploadPage from './UploadPage';

export default function ShareWidget(){
  const dialog=useRef<HTMLDialogElement>(null);
  const [loaded,setLoaded]=useState(false);
  function open(){
    setLoaded(true);
    dialog.current?.showModal();
  }
  return <>
    <button className="feedback-launcher share-launcher" aria-haspopup="dialog" onClick={open}>
      <span className="feedback-launcher-icon"><FolderOpen size={25}/></span>
      <span><strong>資料を共有する</strong><small>ファイル・資料を送る</small></span>
    </button>
    <dialog ref={dialog} className="feedback-dialog share-dialog" aria-labelledby="share-title">
      <header className="feedback-header"><h2 id="share-title">資料を共有する</h2><button className="icon-button" aria-label="閉じる" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
      <p className="share-close-note">閉じても入力内容は保持され、送信中の処理は継続します。</p>
      {/* Keep the form mounted when hidden so reopening preserves selected files. */}
      <div className="share-content">{loaded&&<UploadPage embedded/>}</div>
    </dialog>
  </>;
}
