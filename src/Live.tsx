// Screens backed by the real API: sign-in, 物件 and 取引先.
// Plain Japanese, large touch targets, one action per button.
import {useEffect, useRef, useState} from 'react';
import {Search, Download, Plus, ChevronRight, X, CheckCircle2, FileText, Building2, RefreshCw} from 'lucide-react';
import {
  api, downloadCsv, query, saveSession, ApiError,
  type Session, type Lookups, type Page, type PropertyRow, type PropertyDetail, type PartyRow, type PartyDetail, type HistoryEntry,
} from './api';

export const statusLabels: Record<string, string> = {active: '稼働中', needs_review: '要確認', ended: '終了'};

const fieldLabels: Record<string, string> = {
  propertyCode: '物件コード', name: '名称', nameKana: 'フリガナ', postalCode: '郵便番号', address: '所在地・住所',
  departmentId: '部署', status: '状態', note: '備考', aliases: '別名', owner: '当社担当', confirmed: '内容確認',
  isCustomer: '顧客', isVendor: '業者', representative: '代表者', billingNote: '請求・入金メモ',
  deliveryMethod: '請求書の送り方', paymentTerms: '支払条件',
};
const actionLabels: Record<string, string> = {create: '登録', update: '更新'};

function StatusBadge({value}: {value: string}) {
  const cls = value === 'needs_review' ? 'amber' : value === 'active' ? 'green' : 'neutral';
  return <span className={'badge ' + cls}>{statusLabels[value] || value}</span>;
}

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'});
}

function show(v: unknown) {
  if (v === null || v === undefined || v === '') return '（空欄）';
  if (Array.isArray(v)) return v.length ? v.join('、') : '（なし）';
  if (typeof v === 'boolean') return v ? 'はい' : 'いいえ';
  return String(v);
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function History({items, lookups}: {items: HistoryEntry[]; lookups: Lookups | null}) {
  if (!items.length) return <p className="muted">更新履歴はまだありません。</p>;
  const dept = (id: unknown) => lookups?.departments.find(d => d.id === id)?.name ?? id;
  return <div>{items.map((h, i) => (
    <div className="history" key={i}>
      <strong>{actionLabels[h.action] || h.action}</strong>
      <small>{h.at} · {h.actorName || '取込・システム'}</small>
      {Object.entries(h.diff || {}).map(([k, c]) => (
        <p key={k}>{fieldLabels[k] || k}：{k === 'confirmed' ? '確認済みにしました' :
          <>{show(k === 'departmentId' ? dept(c.before) : k === 'status' ? statusLabels[String(c.before)] ?? c.before : c.before)} → {show(k === 'departmentId' ? dept(c.after) : k === 'status' ? statusLabels[String(c.after)] ?? c.after : c.after)}</>}</p>
      ))}
    </div>
  ))}</div>;
}

// --- sign-in -------------------------------------------------------------------

export function SignIn({onDone}: {onDone: (s: Session) => void}) {
  const [code, setCode] = useState('');
  const [people, setPeople] = useState<Lookups['people'] | null>(null);
  const [person, setPerson] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const l = await api<Lookups>({code, personId: '', personName: ''}, 'GET', '/api/v1/lookups');
      setPeople(l.people);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '確認できませんでした。');
    } finally {
      setBusy(false);
    }
  }
  function finish(e: React.FormEvent) {
    e.preventDefault();
    const p = people?.find(x => x.id === person);
    if (!p) {
      setError('お名前を選んでください。');
      return;
    }
    const s = {code, personId: p.id, personName: p.name};
    saveSession(s);
    onDone(s);
  }
  return <section className="card live-signin">
    <h2>CBSスマートシステムに入る</h2>
    {!people ? <form onSubmit={check}>
      <p>社内で共有された合言葉を入力してください。</p>
      <label><span>合言葉</span><input autoFocus type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} required/></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary big" disabled={busy}>{busy ? '確認しています…' : '次へ'}</button>
    </form> : <form onSubmit={finish}>
      <p>あなたのお名前を選んでください。更新履歴に記録されます。</p>
      <label><span>お名前</span><select autoFocus value={person} onChange={e => setPerson(e.target.value)} required>
        <option value="" disabled>選んでください</option>
        {people.map(p => <option key={p.id} value={p.id}>{p.name}{p.group ? `（${p.group}）` : ''}</option>)}
      </select></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary big">はじめる</button>
    </form>}
  </section>;
}

// --- shared dialog shell ---------------------------------------------------------

function Dialog({open, onClose, children}: {open: boolean; onClose: () => void; children: React.ReactNode}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open) ref.current?.close();
  }, [open]);
  return <dialog ref={ref} onCancel={onClose}>{open && children}</dialog>;
}

type Common = {session: Session; lookups: Lookups | null; onAuthError: () => void; notify: (m: string) => void};

function useList<T>(session: Session, path: string, deps: unknown[], onAuthError: () => void) {
  const [data, setData] = useState<Page<T> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api<Page<T>>(session, 'GET', path)
      .then(d => { if (live) { setData(d); setError(''); } })
      .catch(err => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 401) onAuthError();
        setError(err instanceof ApiError ? err.message : '読み込みに失敗しました。');
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [path, tick, ...deps]);
  return {data, error, loading, reload: () => setTick(t => t + 1)};
}

// --- 物件 -------------------------------------------------------------------------

type PropertyForm = {
  name: string; nameKana: string; aliasesText: string; postalCode: string; address: string;
  departmentId: string; ownerId: string; status: string; note: string; confirm: boolean;
};

function toForm(p: PropertyRow | null, defaultDept: string): PropertyForm {
  return {
    name: p?.name ?? '', nameKana: p?.nameKana ?? '', aliasesText: (p?.aliases ?? []).join('\n'),
    postalCode: p?.postalCode ?? '', address: p?.address ?? '', departmentId: p?.departmentId ?? defaultDept,
    ownerId: p?.ownerId ?? '', status: p?.status ?? 'active', note: p?.note ?? '', confirm: false,
  };
}

export function LiveProperties({session, lookups, branch, onAuthError, notify, initialQ = ''}: Common & {branch: string; initialQ?: string}) {
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(50);
  const dq = useDebounced(q);
  useEffect(() => setLimit(50), [dq, status, branch]);
  // A full 物件コード finds the property in any branch.
  const params = {q: dq, status, branch: /^p-?\d{6}$/i.test(dq.trim()) ? '' : branch};
  const {data, error, loading, reload} = useList<PropertyRow>(session, '/api/v1/properties' + query({...params, limit}), [session], onAuthError);

  const [openId, setOpenId] = useState<string | null>(null); // '' = new
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PropertyForm>(toForm(null, ''));
  const [formError, setFormError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('基本情報');

  const branchDepts = (lookups?.departments ?? []).filter(d => !branch || d.group === branch);

  async function openProperty(id: string) {
    setOpenId(id); setDetail(null); setEditing(false); setFormError(''); setConflict(false); setTab('基本情報');
    try {
      const d = await api<PropertyDetail>(session, 'GET', `/api/v1/properties/${id}`);
      setDetail(d);
      setForm(toForm(d, ''));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '読み込みに失敗しました。');
    }
  }
  function startNew() {
    setOpenId(''); setDetail(null); setEditing(true); setFormError(''); setConflict(false); setTab('基本情報');
    setForm(toForm(null, branchDepts[0]?.id ?? ''));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('物件名を入力してください。'); return; }
    setSaving(true); setFormError(''); setConflict(false);
    const body = {
      name: form.name, nameKana: form.nameKana, postalCode: form.postalCode, address: form.address,
      departmentId: form.departmentId, ownerId: form.ownerId, status: form.status, note: form.note,
      aliases: form.aliasesText.split('\n').map(s => s.trim()).filter(Boolean), confirm: form.confirm,
      ...(detail ? {rowVersion: detail.rowVersion} : {}),
    };
    try {
      const d = detail
        ? await api<PropertyDetail>(session, 'PATCH', `/api/v1/properties/${detail.id}`, body)
        : await api<PropertyDetail>(session, 'POST', '/api/v1/properties', body);
      setDetail(d); setOpenId(d.id); setForm(toForm(d, '')); setEditing(false);
      notify(detail ? '保存しました' : `登録しました（${d.propertyCode}）`);
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onAuthError();
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      setFormError(err instanceof ApiError ? err.message : '保存できませんでした。');
    } finally {
      setSaving(false);
    }
  }
  async function exportCsv() {
    try {
      await downloadCsv(session, '/api/v1/properties.csv' + query(params), '物件一覧.csv');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'CSVを作成できませんでした。');
    }
  }
  const set = (k: keyof PropertyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({...form, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value});

  return <>
    <div className="live-actions">
      <button onClick={exportCsv}><Download size={18}/>CSV出力</button>
      <button className="primary" onClick={startNew}><Plus size={18}/>物件を登録</button>
    </div>
    <section className="card list-card">
      <div className="toolbar">
        <label className="search"><Search size={20}/><input aria-label="物件を検索" placeholder="物件名・別名・物件コード・住所で検索" value={q} onChange={e => setQ(e.target.value)}/></label>
        <select aria-label="状態で絞り込む" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">すべての状態</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="count">{loading ? '検索中…' : `${data?.total ?? 0}件`}</span>
      </div>
      {error && <p className="error" role="alert">{error} <button onClick={reload}><RefreshCw size={14}/>再読み込み</button></p>}
      <div className="table-wrap">
        <table className="live-table">
          <thead><tr><th>物件 / 物件コード</th><th>所在地</th><th>部署</th><th>当社担当</th><th>状態</th><th>最終確認</th><th/></tr></thead>
          <tbody>{data?.items.map(p => (
            <tr key={p.id} onClick={() => openProperty(p.id)}>
              <td data-label="物件"><button className="row-title" onClick={e => { e.stopPropagation(); openProperty(p.id); }}>{p.name}</button>
                <small>{p.propertyCode}{p.aliases.length ? ` · 別名：${p.aliases.join('、')}` : ''}</small></td>
              <td data-label="所在地">{p.address || '未登録'}</td>
              <td data-label="部署">{p.departmentName || '未設定'}</td>
              <td data-label="当社担当">{p.ownerName || '未設定'}</td>
              <td data-label="状態"><StatusBadge value={p.status}/></td>
              <td data-label="最終確認">{fmtDate(p.confirmedAt) || '未確認'}</td>
              <td className="live-chevron"><ChevronRight size={18}/></td>
            </tr>
          ))}</tbody>
        </table>
        {data && !data.items.length && <div className="empty"><Search size={28}/><h3>一致する物件がありません</h3><p>別の言葉（別名・物件コード・住所の一部）でも探せます。</p></div>}
      </div>
      {data && <div className="table-footer">{data.items.length} / {data.total}件を表示 {data.items.length < data.total && <button onClick={() => setLimit(limit + 50)}>さらに表示</button>}</div>}
    </section>

    <Dialog open={openId !== null} onClose={() => setOpenId(null)}>
      <div className="dialog-header">
        <div><small>{detail ? `${detail.propertyCode} / 物件` : '物件'}</small><h2>{editing ? (detail ? '編集' : '新しい物件を登録') : detail?.name ?? '読み込み中…'}</h2></div>
        <button className="icon-button" aria-label="閉じる" onClick={() => setOpenId(null)}><X/></button>
      </div>
      {detail && !editing && <div className="tabs">{['基本情報', '取引先・契約', '資料', '更新履歴'].map(t =>
        <button className={tab === t ? 'selected' : ''} key={t} onClick={() => setTab(t)}>{t}</button>)}</div>}
      <form onSubmit={save}>
        <div className="dialog-body">
          {formError && <p className="error" role="alert">{formError} {conflict && detail &&
            <button type="button" onClick={() => openProperty(detail.id)}><RefreshCw size={14}/>最新の内容を読み込む</button>}</p>}
          {editing ? <div className="field-grid">
            <label><span>物件名（必須）</span><input required value={form.name} onChange={set('name')}/></label>
            <label><span>フリガナ</span><input value={form.nameKana} onChange={set('nameKana')}/></label>
            <label className="wide"><span>別名（請求一覧・発注書などでの呼び方。1行に1つ）</span><textarea rows={3} value={form.aliasesText} onChange={set('aliasesText')}/></label>
            <label><span>郵便番号</span><input inputMode="numeric" value={form.postalCode} onChange={set('postalCode')}/></label>
            <label><span>所在地</span><input value={form.address} onChange={set('address')}/></label>
            <label><span>部署</span><select value={form.departmentId} onChange={set('departmentId')}>
              <option value="">未設定</option>
              {(lookups?.departments ?? []).map(d => <option key={d.id} value={d.id}>{d.group} {d.name}</option>)}
            </select></label>
            <label><span>当社担当</span><select value={form.ownerId} onChange={set('ownerId')}>
              <option value="">未設定</option>
              {(lookups?.people ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
            <label><span>状態</span><select value={form.status} onChange={set('status')}>
              {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
            <label className="wide"><span>備考</span><textarea rows={3} value={form.note} onChange={set('note')}/></label>
            <label className="wide live-check"><input type="checkbox" checked={form.confirm} onChange={set('confirm')}/>
              <span>内容が正しいことを確認しました（最終確認日を今日にします）</span></label>
          </div> : !detail ? <p className="muted">読み込み中…</p> : tab === '基本情報' ? <div className="field-grid">
            {[['物件名', detail.name], ['物件コード', detail.propertyCode], ['フリガナ', detail.nameKana], ['別名', detail.aliases.join('、')],
              ['郵便番号', detail.postalCode], ['所在地', detail.address], ['拠点・部署', [detail.branchName, detail.departmentName].filter(Boolean).join(' ')],
              ['当社担当', detail.ownerName], ['最終確認', detail.confirmedAt ? `${fmtDate(detail.confirmedAt)}${detail.confirmedByName ? `（${detail.confirmedByName}）` : ''}` : ''],
              ['備考', detail.note]].map(([k, v]) =>
              <label key={k} className={k === '備考' || k === '別名' ? 'wide' : ''}><span>{k}</span><div className="field-value">{v || '未登録'}</div></label>)}
            <label><span>状態</span><div className="field-value"><StatusBadge value={detail.status}/></div></label>
          </div> : tab === '取引先・契約' ? <div>
            {detail.contractLines.length ? detail.contractLines.map(c =>
              <div className="related" key={c.id}><Building2 size={18}/><span><strong>{c.serviceName}</strong><small>{c.billToName} · {c.workMonths} · 品目コード {c.itemCode || 'なし'}</small></span><span>¥{c.unitAmount.toLocaleString()}</span></div>)
              : <p className="muted">契約（請求一覧の行）はまだ登録されていません。</p>}
          </div> : tab === '資料' ? <div>
            {detail.documents.length ? detail.documents.map(d =>
              <div className="related" key={d.id}><FileText size={18}/><span><strong>{d.title}</strong><small>{d.fileName || 'ファイル未登録'}{d.docDate ? ` · ${d.docDate}` : ''} · 全{d.versions}版{d.ownerName ? ` · 更新責任者 ${d.ownerName}` : ''}</small></span>
                <span className={'badge ' + (d.needsReview ? 'amber' : 'green')}>{d.needsReview ? '要確認' : `現行版 v${d.versionNo}`}</span></div>)
              : <p className="muted">資料はまだ登録されていません。</p>}
          </div> : <History items={detail.history} lookups={lookups}/>}
        </div>
        <div className="dialog-footer">
          <span><CheckCircle2 size={15}/>{session.personName}さんとして保存します</span>
          {editing ? <>
            <button type="button" onClick={() => { if (detail) { setForm(toForm(detail, '')); setEditing(false); setFormError(''); } else setOpenId(null); }}>キャンセル</button>
            <button className="primary" type="submit" disabled={saving}>{saving ? '保存しています…' : '保存する'}</button>
          </> : detail && <button type="button" className="primary" onClick={() => { setTab('基本情報'); setEditing(true); }}>編集する</button>}
        </div>
      </form>
    </Dialog>
  </>;
}

// --- 取引先 -----------------------------------------------------------------------

type PartyForm = {
  name: string; nameKana: string; aliasesText: string; isCustomer: boolean; isVendor: boolean; representative: string;
  postalCode: string; address: string; deliveryMethod: string; paymentTerms: string; billingNote: string; note: string;
};
function toPartyForm(p: PartyRow | null): PartyForm {
  return {
    name: p?.name ?? '', nameKana: p?.nameKana ?? '', aliasesText: (p?.aliases ?? []).join('\n'), isCustomer: p?.isCustomer ?? true,
    isVendor: p?.isVendor ?? false, representative: p?.representative ?? '', postalCode: p?.postalCode ?? '', address: p?.address ?? '',
    deliveryMethod: p?.deliveryMethod ?? '', paymentTerms: p?.paymentTerms ?? '', billingNote: p?.billingNote ?? '', note: p?.note ?? '',
  };
}

export function LiveParties({session, lookups, onAuthError, notify, onOpenProperty}: Common & {onOpenProperty: (code: string) => void}) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [limit, setLimit] = useState(50);
  const dq = useDebounced(q);
  useEffect(() => setLimit(50), [dq, kind]);
  const params = {q: dq, kind};
  const {data, error, loading, reload} = useList<PartyRow>(session, '/api/v1/parties' + query({...params, limit}), [session], onAuthError);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PartyDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PartyForm>(toPartyForm(null));
  const [formError, setFormError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('基本情報');

  async function openParty(id: string) {
    setOpenId(id); setDetail(null); setEditing(false); setFormError(''); setConflict(false); setTab('基本情報');
    try {
      const d = await api<PartyDetail>(session, 'GET', `/api/v1/parties/${id}`);
      setDetail(d); setForm(toPartyForm(d));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '読み込みに失敗しました。');
    }
  }
  function startNew() {
    setOpenId(''); setDetail(null); setEditing(true); setFormError(''); setConflict(false); setForm(toPartyForm(null));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(''); setConflict(false);
    const {aliasesText, ...rest} = form;
    const body = {...rest, aliases: aliasesText.split('\n').map(s => s.trim()).filter(Boolean), ...(detail ? {rowVersion: detail.rowVersion} : {})};
    try {
      const d = detail
        ? await api<PartyDetail>(session, 'PATCH', `/api/v1/parties/${detail.id}`, body)
        : await api<PartyDetail>(session, 'POST', '/api/v1/parties', body);
      setDetail(d); setOpenId(d.id); setForm(toPartyForm(d)); setEditing(false);
      notify(detail ? '保存しました' : '登録しました');
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onAuthError();
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      setFormError(err instanceof ApiError ? err.message : '保存できませんでした。');
    } finally {
      setSaving(false);
    }
  }
  async function exportCsv() {
    try {
      await downloadCsv(session, '/api/v1/parties.csv' + query(params), '取引先一覧.csv');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'CSVを作成できませんでした。');
    }
  }
  const set = (k: keyof PartyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({...form, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value});
  const kindLabel = (p: PartyRow) => [p.isCustomer && '顧客', p.isVendor && '業者'].filter(Boolean).join('・');

  return <>
    <div className="live-actions">
      <button onClick={exportCsv}><Download size={18}/>CSV出力</button>
      <button className="primary" onClick={startNew}><Plus size={18}/>取引先を登録</button>
    </div>
    <section className="card list-card">
      <div className="toolbar">
        <label className="search"><Search size={20}/><input aria-label="取引先を検索" placeholder="会社名・別名・住所で検索" value={q} onChange={e => setQ(e.target.value)}/></label>
        <select aria-label="種類で絞り込む" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">顧客・業者すべて</option><option value="customer">顧客</option><option value="vendor">業者</option>
        </select>
        <span className="count">{loading ? '検索中…' : `${data?.total ?? 0}件`}</span>
      </div>
      {error && <p className="error" role="alert">{error} <button onClick={reload}><RefreshCw size={14}/>再読み込み</button></p>}
      <div className="table-wrap">
        <table className="live-table">
          <thead><tr><th>会社名</th><th>種類</th><th>住所</th><th>支払条件</th><th>物件数</th><th/></tr></thead>
          <tbody>{data?.items.map(p => (
            <tr key={p.id} onClick={() => openParty(p.id)}>
              <td data-label="会社名"><button className="row-title" onClick={e => { e.stopPropagation(); openParty(p.id); }}>{p.name}</button>
                {p.aliases.length > 0 && <small>別名：{p.aliases.join('、')}</small>}</td>
              <td data-label="種類">{kindLabel(p)}</td>
              <td data-label="住所">{p.address || '未登録'}</td>
              <td data-label="支払条件">{p.paymentTerms || '未登録'}</td>
              <td data-label="物件数">{p.propertyCount}件</td>
              <td className="live-chevron"><ChevronRight size={18}/></td>
            </tr>
          ))}</tbody>
        </table>
        {data && !data.items.length && <div className="empty"><Search size={28}/><h3>一致する取引先がありません</h3><p>略称や「㈱」を付けない名前でも探せます。</p></div>}
      </div>
      {data && <div className="table-footer">{data.items.length} / {data.total}件を表示 {data.items.length < data.total && <button onClick={() => setLimit(limit + 50)}>さらに表示</button>}</div>}
    </section>

    <Dialog open={openId !== null} onClose={() => setOpenId(null)}>
      <div className="dialog-header">
        <div><small>取引先</small><h2>{editing ? (detail ? '編集' : '新しい取引先を登録') : detail?.name ?? '読み込み中…'}</h2></div>
        <button className="icon-button" aria-label="閉じる" onClick={() => setOpenId(null)}><X/></button>
      </div>
      {detail && !editing && <div className="tabs">{['基本情報', '物件', '更新履歴'].map(t =>
        <button className={tab === t ? 'selected' : ''} key={t} onClick={() => setTab(t)}>{t}</button>)}</div>}
      <form onSubmit={save}>
        <div className="dialog-body">
          {formError && <p className="error" role="alert">{formError} {conflict && detail &&
            <button type="button" onClick={() => openParty(detail.id)}><RefreshCw size={14}/>最新の内容を読み込む</button>}</p>}
          {editing ? <div className="field-grid">
            <label><span>会社名（必須）</span><input required value={form.name} onChange={set('name')}/></label>
            <label><span>フリガナ</span><input value={form.nameKana} onChange={set('nameKana')}/></label>
            <label className="wide"><span>別名（略称・請求一覧での表記など。1行に1つ）</span><textarea rows={3} value={form.aliasesText} onChange={set('aliasesText')}/></label>
            <label className="live-check"><input type="checkbox" checked={form.isCustomer} onChange={set('isCustomer')}/><span>顧客</span></label>
            <label className="live-check"><input type="checkbox" checked={form.isVendor} onChange={set('isVendor')}/><span>業者</span></label>
            <label><span>代表者</span><input value={form.representative} onChange={set('representative')}/></label>
            <label><span>郵便番号</span><input inputMode="numeric" value={form.postalCode} onChange={set('postalCode')}/></label>
            <label className="wide"><span>住所</span><input value={form.address} onChange={set('address')}/></label>
            <label><span>請求書の送り方</span><input placeholder="郵送 / メール / 持参 など" value={form.deliveryMethod} onChange={set('deliveryMethod')}/></label>
            <label><span>支払条件</span><input placeholder="翌月末払 など" value={form.paymentTerms} onChange={set('paymentTerms')}/></label>
            <label className="wide"><span>請求・入金メモ</span><textarea rows={2} value={form.billingNote} onChange={set('billingNote')}/></label>
            <label className="wide"><span>備考</span><textarea rows={2} value={form.note} onChange={set('note')}/></label>
          </div> : !detail ? <p className="muted">読み込み中…</p> : tab === '基本情報' ? <div className="field-grid">
            {[['会社名', detail.name], ['種類', kindLabel(detail)], ['フリガナ', detail.nameKana], ['別名', detail.aliases.join('、')],
              ['代表者', detail.representative], ['郵便番号', detail.postalCode], ['住所', detail.address], ['請求書の送り方', detail.deliveryMethod],
              ['支払条件', detail.paymentTerms], ['請求・入金メモ', detail.billingNote], ['備考', detail.note]].map(([k, v]) =>
              <label key={k} className={['備考', '請求・入金メモ', '別名', '住所'].includes(k) ? 'wide' : ''}><span>{k}</span><div className="field-value">{v || '未登録'}</div></label>)}
          </div> : tab === '物件' ? <div>
            {detail.properties.length ? detail.properties.map(p =>
              <button type="button" className="related" key={p.id} onClick={() => { setOpenId(null); onOpenProperty(p.propertyCode); }}>
                <Building2 size={18}/><span><strong>{p.name}</strong><small>{p.propertyCode}</small></span><ChevronRight size={16}/></button>)
              : <p className="muted">この取引先が請求先の物件はまだありません。</p>}
          </div> : <History items={detail.history} lookups={lookups}/>}
        </div>
        <div className="dialog-footer">
          <span><CheckCircle2 size={15}/>{session.personName}さんとして保存します</span>
          {editing ? <>
            <button type="button" onClick={() => { if (detail) { setForm(toPartyForm(detail)); setEditing(false); setFormError(''); } else setOpenId(null); }}>キャンセル</button>
            <button className="primary" type="submit" disabled={saving}>{saving ? '保存しています…' : '保存する'}</button>
          </> : detail && <button type="button" className="primary" onClick={() => { setTab('基本情報'); setEditing(true); }}>編集する</button>}
        </div>
      </form>
    </Dialog>
  </>;
}
