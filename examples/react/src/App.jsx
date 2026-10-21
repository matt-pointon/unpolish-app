import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ROOT = import.meta.env.BASE_URL.startsWith('/')
  ? import.meta.env.BASE_URL
  : (location.pathname.match(/^.*\/dist\//) || ['/'])[0];
function usePath() {
  const [path, setPath] = useState(location.pathname.slice(ROOT.length).replace(/\/$/, '') || '');
  useEffect(() => {
    const on = () => setPath(location.pathname.slice(ROOT.length) || '');
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const go = (p) => { history.pushState({}, '', ROOT + p + location.search + location.hash); setPath(p); };
  return [path, go];
}

const invoices = [
  { id: 'INV-2041', client: 'Northwind Studio', amount: 4200, status: 'Paid' },
  { id: 'INV-2042', client: 'Harbor & Pine', amount: 1850, status: 'Overdue' },
  { id: 'INV-2043', client: 'Oak Labs', amount: 920, status: 'Draft' },
];
const tone = { Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', Overdue: 'bg-rose-50 text-rose-700 ring-rose-600/20', Draft: 'bg-slate-100 text-slate-600 ring-slate-500/20', Sent: 'bg-sky-50 text-sky-700 ring-sky-600/20' };

export default function App() {
  const [path, go] = usePath();
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const [rows, setRows] = useState(invoices);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);
  const nav = [['', 'Invoices'], ['clients', 'Clients'], ['settings', 'Settings']];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-5xl flex items-center gap-6 px-6 h-16">
          <span data-brand-logo className="font-bold text-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 bg-clip-text text-transparent">Ledger</span>
          <nav className="flex gap-1" aria-label="Main">
            {nav.map(([p, label]) => (
              <a key={p} href={ROOT + p} data-testid={'nav-' + (p || 'home')} aria-current={path === p ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); go(p); }}
                className={'px-3 py-2 rounded-lg text-sm font-medium transition-colors ' + (path === p ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>{label}</a>
            ))}
          </nav>
          <div className="ml-auto relative">
            <button data-testid="menu-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-full ring-1 ring-slate-200 pl-1 pr-3 py-1 text-sm font-medium hover:bg-slate-50">
              <img src="/examples/assets/avatar-1.svg" alt="" className="size-7 rounded-full" />Ana
            </button>
            {menu && (
              <div role="menu" data-testid="menu" className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-lg ring-1 ring-slate-900/5 p-1">
                {['Profile', 'Billing', 'Sign out'].map((m) => (
                  <button key={m} role="menuitem" onClick={() => { setMenu(false); setToast(m + ' clicked'); }} className={'w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 ' + (m === 'Sign out' ? 'text-rose-600' : '')}>{m}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {path === '' && <Invoices rows={rows} onNew={() => setModal(true)} />}
        {(path === 'clients' || path.startsWith('clients/')) && <Clients />}
        {(path === 'settings' || path.startsWith('settings/')) && <Settings onSaved={() => setToast('Settings saved')} />}
      </main>
      {modal && createPortal(
        <NewInvoice onClose={() => setModal(false)} onCreate={(r) => { setRows((x) => [...x, r]); setModal(false); setToast('Invoice created'); }} />, document.body)}
      {toast && createPortal(<div role="status" data-testid="toast" className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-medium shadow-xl">{toast}</div>, document.body)}
    </div>
  );
}

function Invoices({ rows, onNew }) {
  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">Track what's been billed and what's outstanding.</p>
        </div>
        <button data-testid="new-invoice" onClick={onNew} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600">New invoice</button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[['Outstanding', '$2,770', 'text-amber-600'], ['Paid this month', '$4,200', 'text-emerald-600'], ['Overdue', '$1,850', 'text-rose-600']].map(([l, v, c]) => (
          <div key={l} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-sm text-slate-500">{l}</p>
            <p className={'text-2xl font-semibold mt-1 ' + c}>{v}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <table className="w-full text-sm" data-testid="invoice-table">
          <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-5 py-3 font-medium">Invoice</th><th className="px-5 py-3 font-medium">Client</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{r.id}</td>
                <td className="px-5 py-3 text-slate-600">{r.client}</td>
                <td className="px-5 py-3"><span className={'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ' + tone[r.status]}>{r.status}</span></td>
                <td className="px-5 py-3 text-right tabular-nums">${r.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Clients() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Clients</h1>
      <div className="grid grid-cols-2 gap-4">
        {[['Northwind Studio', '/examples/assets/lake.svg'], ['Harbor & Pine', '/examples/assets/dunes.svg']].map(([n, img]) => (
          <article key={n} className="rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-900/5">
            <img src={img} alt={n + ' office'} className="h-36 w-full object-cover" />
            <div className="p-4 flex items-center justify-between"><h2 className="font-semibold">{n}</h2><span className="text-xs text-indigo-600 font-medium">Active</span></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Settings({ onSaved }) {
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('ana@ledger');
  const invalid = !/^\S+@\S+\.\S+$/.test(email);
  return (
    <form className="max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5" onSubmit={(e) => { e.preventDefault(); if (invalid) return; setSaving(true); setTimeout(() => { setSaving(false); onSaved(); }, 600); }}>
      <h1 className="text-xl font-semibold">Settings</h1>
      <label className="block text-sm font-medium text-slate-700">Billing email
        <input data-testid="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid} className={'mt-1 block w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-4 ' + (invalid ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100')} />
        {invalid && <span className="mt-1 block text-xs text-rose-600">Enter a valid email address.</span>}
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked className="accent-indigo-600" /> Email receipts</label>
      <div className="flex gap-2">
        <button type="submit" disabled={invalid || saving} data-testid="save" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" disabled className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 ring-1 ring-slate-200">Archive</button>
      </div>
    </form>
  );
}

function NewInvoice({ onClose, onCreate }) {
  const [client, setClient] = useState('');
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="ni-title" data-testid="dialog" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="ni-title" className="text-lg font-semibold">New invoice</h2>
        <label className="block mt-4 text-sm font-medium">Client
          <input data-testid="client" autoFocus value={client} onChange={(e) => setClient(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Company name" />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button data-testid="create" onClick={() => onCreate({ id: 'INV-' + (2044 + Math.floor(Math.random() * 100)), client: client || 'New client', amount: 500, status: 'Sent' })} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Create</button>
        </div>
      </div>
    </div>
  );
}
