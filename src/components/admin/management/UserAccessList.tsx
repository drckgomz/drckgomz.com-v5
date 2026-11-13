'use client';
import { useState, type ReactNode } from 'react';

type Account = { id: string; name: string; email: string; roles: string[]; owner: boolean; enabled: boolean; banned: boolean; editor: ReactNode };
export default function UserAccessList({ accounts }: { accounts: Account[] }) {
  const [search, setSearch] = useState('');
  const [access, setAccess] = useState('all');
  const term = search.trim().toLowerCase();
  const visible = accounts.filter(account =>
    (!term || [account.name, account.email, account.id].some(value => value.toLowerCase().includes(term))) &&
    (access === 'all' || (access === 'blocked' && account.banned) || (access === 'disabled' && !account.enabled) ||
      (access === 'owner' && account.owner) || account.roles.includes(access)));
  return <section className="space-y-4" aria-label="Account access management">
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Search accounts on this page<input type="search" maxLength={240} value={search} onChange={event => setSearch(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background p-3" /></label>
      <label>Access filter<select value={access} onChange={event => setAccess(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background p-3">
        <option value="all">All accounts</option><option value="owner">Owner</option><option value="content_admin">Content administrator</option><option value="whitelist_manager">Audience administrator</option><option value="blocked">Blocked accounts</option><option value="disabled">Disabled accounts</option>
      </select></label>
    </div>
    <p role="status">{visible.length} of {accounts.length} accounts on this page match. Filters apply to the current page.</p>
    <ul className="space-y-4">{accounts.map(account => <li key={account.id} hidden={!visible.includes(account)} className="space-y-3 rounded border border-border p-4">
      <h2 className="break-words text-lg">{account.name || account.email || 'Account'}</h2>
      <p className="break-all text-sm text-muted-foreground">{account.email}</p>
      <p className="text-sm">{account.owner ? 'Owner · protected' : account.roles.length ? account.roles.join(', ') : 'Ordinary member'}{account.banned ? ' · blocked' : ''}{!account.enabled ? ' · disabled' : ''}</p>
      {account.editor}
    </li>)}</ul>
  </section>;
}
