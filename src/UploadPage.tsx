import {useEffect,useRef,useState} from 'react';
import {useAuth0} from '@auth0/auth0-react';
import {isUploadDescendant,isUploadFrameOrigin} from './upload-auth';
const UPLOAD_URL='https://script.google.com/macros/s/AKfycbxTFA0FrLBzcz7mjMDupV7_2e_EIlBHy2EwpucgM6gkcWXKVPPgBgFm9tl4U5psDpGc/exec';
export default function UploadPage({embedded=false}:{embedded?:boolean}){
  const {getAccessTokenSilently,isAuthenticated}=useAuth0();
  const frame=useRef<HTMLIFrameElement>(null);
  const [bridge]=useState(()=>crypto.randomUUID());
  useEffect(()=>{
    let active=true;
    const receive=async(event:MessageEvent)=>{
      if(!isAuthenticated||!isUploadFrameOrigin(event.origin)||!isUploadDescendant(event.source,frame.current?.contentWindow??null)||event.data?.type!=='cbs-upload-auth-request'||event.data.bridge!==bridge||typeof event.data.requestId!=='string')return;
      const target=event.source;
      try{
        const token=await getAccessTokenSilently();
        if(active)target.postMessage({type:'cbs-upload-auth-result',bridge,requestId:event.data.requestId,token},event.origin);
      }catch{
        if(active)target.postMessage({type:'cbs-upload-auth-result',bridge,requestId:event.data.requestId,error:'ログインを確認できません。CBSに再度ログインしてください。'},event.origin);
      }
    };
    window.addEventListener('message',receive);
    return()=>{active=false;window.removeEventListener('message',receive);};
  },[bridge,getAccessTokenSilently,isAuthenticated]);
  const fragment=new URLSearchParams({bridge,parent:window.location.origin});
  return <main style={{padding:0,margin:0,maxWidth:'none',height:embedded?'100%':'100dvh'}}>
    <iframe ref={frame} title="CBS 資料共有" src={UPLOAD_URL+'#'+fragment} referrerPolicy="no-referrer" style={{width:'100%',height:'100%',border:0,display:'block'}}/>
  </main>;
}
