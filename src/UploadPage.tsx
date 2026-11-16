const UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbxTFA0FrLBzcz7mjMDupV7_2e_EIlBHy2EwpucgM6gkcWXKVPPgBgFm9tl4U5psDpGc/exec';
export default function UploadPage(){
 // The invitation stays in the fragment; it is never sent to GitHub Pages.
 const invite = new URLSearchParams(window.location.hash.slice(1)).get('invite');
 return <main style={{padding:0,margin:0,maxWidth:'none',height:'100dvh'}}>
  <iframe title="CBS 資料共有" src={UPLOAD_URL+(invite?'#invite='+encodeURIComponent(invite):'')} referrerPolicy="no-referrer" style={{width:'100%',height:'100%',border:0,display:'block'}}/>
 </main>;
}
