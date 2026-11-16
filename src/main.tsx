import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import UploadPage from './UploadPage';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{new URLSearchParams(window.location.search).get('page')==='upload'?<UploadPage/>:<App/>}</React.StrictMode>);
