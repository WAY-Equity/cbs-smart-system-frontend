import {useEffect,useRef,useState} from 'react';
import {MessageSquare,X} from 'lucide-react';

const portalOrigin=new URL(import.meta.env.VITE_CBS_FEEDBACK_ORIGIN || 'http://127.0.0.1:5174').origin;
const feedbackUrl=`${portalOrigin}/?embed=feedback`;
export default function FeedbackWidget(){
  const dialog=useRef<HTMLDialogElement>(null), frame=useRef<HTMLIFrameElement>(null);
  const [open,setOpen]=useState(false), [dirty,setDirty]=useState(false), [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!open)return;
    dialog.current?.showModal();
    const receive=(event:MessageEvent)=>{
      if(event.origin!==portalOrigin||event.source!==frame.current?.contentWindow)return;
      if(event.data?.type==='cbs-feedback-ready'){window.clearInterval(retry);}
      if(event.data?.type==='cbs-feedback-state'){
        setDirty(event.data.dirty===true);setBusy(event.data.busy===true);
      }
    };
    const connect=()=>frame.current?.contentWindow?.postMessage({type:'cbs-feedback-init'},portalOrigin);
    window.addEventListener('message',receive);
    connect();
    const retry=window.setInterval(connect,1000);
    return()=>{window.removeEventListener('message',receive);window.clearInterval(retry);};
  },[open]);
  function close(){
    if(busy)return;
    if(dirty&&!window.confirm('送信していない回答があります。閉じると回答が失われます。閉じますか？'))return;
    setOpen(false);setDirty(false);setBusy(false);
  }
  return <>
    <button className="feedback-launcher" aria-haspopup="dialog" onClick={()=>setOpen(true)}>
      <span className="feedback-launcher-icon"><MessageSquare size={25}/></span>
      <span><strong>フィードバック</strong><small>ご意見をお聞かせください</small></span>
    </button>
    {open&&<dialog ref={dialog} className="feedback-dialog" aria-labelledby="feedback-title" onCancel={event=>{event.preventDefault();close();}}>
      <header className="feedback-header"><h2 id="feedback-title">フィードバック</h2><button className="icon-button" aria-label="閉じる" disabled={busy} onClick={close}><X size={20}/></button></header>
      <iframe ref={frame} src={feedbackUrl} referrerPolicy="no-referrer" title="CBS リリースへのフィードバック" allow={`microphone ${portalOrigin}`} />
    </dialog>}
  </>;
}
