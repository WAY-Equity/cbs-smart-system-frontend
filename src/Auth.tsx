import { useEffect, useState, type MouseEvent } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { LogOut, Mail } from 'lucide-react';
import App from './App';
import UploadPage from './UploadPage';
import { authConfig, safeReturnTo } from './auth-config';

function AuthenticatedDemo() {
  const auth = useAuth0();
  const [search, setSearch] = useState(window.location.search);
  useEffect(() => {
    const syncRoute = () => setSearch(window.location.search);
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    // Preserve normal open-in-new-tab behavior for modified clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState({}, '', event.currentTarget.href);
    setSearch(window.location.search);
    window.scrollTo(0, 0);
  }
  const [failed, setFailed] = useState(false);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  // Re-check the session while a tab is open and whenever the user returns to it.
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let active = true;
    const check = () => {
      void auth.getAccessTokenSilently().catch(() => { if (active) setExpired(true); });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [auth.isAuthenticated, auth.getAccessTokenSilently]);

  const logout = () => {
    setBusy(true);
    void auth.logout({ logoutParams: { returnTo: window.location.origin + '/' } })
      .catch(() => { setFailed(true); setBusy(false); });
  };
  if (auth.isLoading) return <main className="auth-gate" role="status"><img className="auth-logo" src={authConfig.logo} alt="CBS"/><p>ログイン情報を確認しています…</p></main>;
  const unverified = auth.isAuthenticated && auth.user?.email_verified !== true;
  if (!auth.isAuthenticated || auth.error || expired || unverified) return (
    <main className="auth-gate">
      <section className="auth-card">
        <img className="auth-logo" src={authConfig.logo} alt="CBSホールディングス"/>
        <h1>CBSスマートシステム</h1>
        <p className="auth-subtitle">物件・作業・資料を、ひとつにつなぐ。</p>
        {(failed || auth.error || unverified) && <p className="error" role="alert">ログインできませんでした。ご案内済みのメールアドレスで、もう一度お試しください。</p>}
        {expired && <p role="status">セッションの確認が必要です。もう一度ログインしてください。</p>}
        <button className="primary auth-login" disabled={busy} onClick={() => {
          setBusy(true); setFailed(false);
          void auth.loginWithRedirect({
            appState: { returnTo: safeReturnTo(window.location.href, window.location.origin) },
            authorizationParams: { connection: 'email' },
          }).catch(() => { setFailed(true); setBusy(false); });
        }}><Mail size={18}/>{busy ? 'ログイン画面を開いています…' : 'メールでログイン'}</button>
      </section>
    </main>
  );
  const account = <div className="auth-account"><span title={auth.user?.email}>{auth.user?.email}</span><button type="button" className="icon-button" aria-label="ログアウト" title="ログアウト" disabled={busy} onClick={logout}><LogOut size={17}/></button>{failed && <span role="alert">ログアウトできませんでした。</span>}</div>;
  if (new URLSearchParams(search).get('page') === 'upload') return <><header className="auth-upload-header"><a href="/" onClick={navigate}>CBSスマートシステム</a>{account}</header><UploadPage/></>;
  return <App accountActions={account}/>;
}

export default function Auth() {
  return <Auth0Provider domain={authConfig.domain} clientId={authConfig.clientId} cacheLocation="localstorage"
    authorizationParams={{ redirect_uri: window.location.origin + '/', scope: 'openid profile email', connection: 'email', ui_locales: 'ja' }}
    onRedirectCallback={appState => { window.history.replaceState({}, document.title, safeReturnTo(appState?.returnTo, window.location.origin)); }}>
    <AuthenticatedDemo/>
  </Auth0Provider>;
}
