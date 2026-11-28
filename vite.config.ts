import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({command,mode})=>{
  const env=loadEnv(mode,process.cwd(),'VITE_');
  if(command==='build'){
    const origin=env.VITE_CBS_FEEDBACK_ORIGIN;
    if(!origin||new URL(origin).protocol!=='https:')throw new Error('Set VITE_CBS_FEEDBACK_ORIGIN to the HTTPS feedback portal origin before building.');
  }
  return {plugins:[react()],base:'./',server:{port:5173,strictPort:true},preview:{port:4173,strictPort:true}};
});
