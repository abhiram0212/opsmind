import { AlertTriangle, ArrowUpRight, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Incident } from '../types';

export function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-title-action">{action}</div>}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone.toLowerCase()}`}>{children}</span>;
}

export function LoadingRows({ count = 5 }: { count?: number }) {
  return <div className="loading-list" aria-label="Loading content">{Array.from({ length: count }, (_, index) => <div className="skeleton-row" key={index}><span /><span /><span /></div>)}</div>;
}

export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="empty-state error-state"><AlertTriangle size={22} /><strong>Could not load this view</strong><span>{message}</span><button className="button button-secondary" onClick={retry}><RefreshCw size={15} />Retry</button></div>;
}

export function Empty({ message }: { message: string }) {
  return <div className="empty-state"><span className="empty-mark" /><strong>Nothing here yet</strong><span>{message}</span></div>;
}

export function IncidentRow({ incident }: { incident: Incident }) {
  return <a className="incident-row" href={`/incidents/${incident.id}`}><span className="incident-number">{incident.incidentNumber}</span><span className="incident-name"><strong>{incident.title}</strong><small>{incident.service} / {incident.environment}</small></span><Badge tone={incident.severity}>{incident.severity}</Badge><Badge tone={incident.status}>{incident.status}</Badge><span className="incident-date">{new Date(incident.detectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><ArrowUpRight size={15} className="row-arrow" /></a>;
}

export function Metric({ label, value, detail, accent, icon }: { label: string; value: string | number; detail: string; accent: string; icon: ReactNode }) {
  return <div className={`metric metric-${accent}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></div>;
}

export function SectionHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return <div className="section-header"><h2>{title}</h2>{aside}</div>;
}