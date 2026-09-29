import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, BookOpenCheck, Box, ChevronDown, Command, Database, Hexagon, Menu, Search, Server, Shield, Zap } from 'lucide-react';
import { api, post } from '../services/api';
import { useToast } from './Toast';
import type { Incident, Memory } from '../types';

const navigation = [
  { label: 'Overview', to: '/', icon: Activity },
  { label: 'Incidents', to: '/incidents', icon: Zap },
  { label: 'Services', to: '/services', icon: Server },
  { label: 'Memory', to: '/memory', icon: Database },
  { label: 'Runbooks', to: '/runbooks', icon: BookOpenCheck },
  { label: 'Analytics', to: '/analytics', icon: BarChart3 },
];

export async function launchIncident(scenario: string): Promise<Incident> {
  return post<Incident>('/incidents', { scenario });
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Memory[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const showToast = useToast();

  const searchMemories = async (query: string) => {
    setSearch(query);
    if (query.trim().length < 2) { setMatches([]); return; }
    setSearching(true);
    try { setMatches(await api<Memory[]>(`/memories?q=${encodeURIComponent(query.trim())}`)); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Memory search failed.', 'error'); }
    finally { setSearching(false); }
  };

  const askOpsMind = async () => {
    if (search.trim().length < 2) return;
    try {
      const results = await api<Memory[]>(`/memories?q=${encodeURIComponent(search.trim())}`);
      setMatches(results);
      if (results.length) showToast(`${results.length} matching stored experiences found.`, 'info');
      else showToast('No matching stored experience found.', 'info');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Memory search failed.', 'error'); }
  };

  const startDemo = async () => {
    try { const incident = await launchIncident('payment'); navigate(`/incidents/${incident.id}`); setSidebarOpen(false); showToast(`${incident.incidentNumber} opened. Evidence is streaming in.`); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Could not create incident.', 'error'); }
  };

  return <div className="app-frame">
    {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Link to="/" className="brand-lockup" onClick={() => setSidebarOpen(false)}><span className="brand-mark"><Hexagon size={18} strokeWidth={2.4} /><span /></span><span><strong>OPSMIND</strong><small>INCIDENT OPERATIONS</small></span></Link>
      <div className="workspace-select"><span className="workspace-avatar">N</span><span><strong>Northstar production</strong><small>Enterprise workspace</small></span><ChevronDown size={15} /></div>
      <span className="nav-label">OPERATIONS</span>
      <nav className="primary-nav">{navigation.map(({ label, to, icon: Icon }) => <NavLink to={to} end={to === '/'} key={to} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`} onClick={() => setSidebarOpen(false)}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <span className="nav-label memory-label">INTELLIGENCE</span>
      <button className="nav-link nav-command" onClick={() => document.querySelector<HTMLInputElement>('.command-input')?.focus()}><Command size={17} /><span>Ask OpsMind</span><span className="key-hint">⌘ K</span></button>
      <div className="sidebar-bottom"><div className="provider-card"><span className="status-dot live" /><div><strong>Local memory active</strong><small>Persistent experience store</small></div><Shield size={15} /></div><NavLink to="/settings" className="settings-link" onClick={() => setSidebarOpen(false)}><Box size={16} />Workspace settings</NavLink><div className="profile-row"><span className="profile-avatar">PS</span><span><strong>Platform team</strong><small>Demo operator</small></span><ChevronDown size={14} /></div></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><button className="icon-button menu-toggle" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Production</strong></div><div className="command-wrap"><Search size={16} className="command-search-icon" /><input className="command-input" value={search} onChange={(event) => void searchMemories(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void askOpsMind(); } if (event.key === 'Escape') setMatches([]); }} placeholder="Ask OpsMind about an incident..." aria-label="Search incident memory" /><kbd>⌘ K</kbd>{searching && <span className="search-spinner" />}{matches.length > 0 && <div className="search-results"><div className="search-results-head">{matches.length} MATCHING MEMORIES</div>{matches.slice(0, 5).map((memory) => <button key={memory.id} onClick={() => { navigate(`/memory?q=${encodeURIComponent(search)}`); setMatches([]); }}><Database size={15} /><span><strong>{memory.title}</strong><small>{memory.rootCause}</small></span></button>)}<button className="search-all" onClick={() => { navigate(`/memory?q=${encodeURIComponent(search)}`); setMatches([]); }}>Search all experience <ChevronDown size={14} /></button></div>}</div><div className="environment-chip"><span className="status-dot live" />PRODUCTION</div><button className="button button-primary topbar-demo" onClick={() => void startDemo()}><Zap size={15} />Launch demo</button></header>
      <main className="content-area"><Outlet /></main>
    </div>
  </div>;
}