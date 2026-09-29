import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, ArrowUpRight, Bot, ChevronRight, CircleGauge, Clock3, Database, Layers3, Plus, Server, ShieldCheck, Sparkles, Target, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRemote } from '../hooks/useRemote';
import { post } from '../services/api';
import { Badge, Empty, IncidentRow, LoadError, LoadingRows, Metric, PageTitle, SectionHeader } from '../components/Common';
import { useToast } from '../components/Toast';
import type { DashboardData, Incident } from '../types';

const metrics = [
  { key: 'activeIncidents', label: 'Active incidents', detail: 'Across production', accent: 'red', icon: <Zap size={17} /> },
  { key: 'resolvedToday', label: 'Resolved today', detail: 'Operator-confirmed', accent: 'green', icon: <ShieldCheck size={17} /> },
  { key: 'averageMttr', label: 'Avg. MTTR', detail: 'Across resolved incidents', accent: 'blue', icon: <Clock3 size={17} />, suffix: ' min' },
  { key: 'memoryCount', label: 'Memories', detail: 'Persistent experiences', accent: 'amber', icon: <Database size={17} /> },
] as const;

export function Dashboard() {
  const { data, loading, error, reload } = useRemote<DashboardData>('/dashboard');
  const [launching, setLaunching] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const startIncident = async () => {
    setLaunching(true);
    try { const incident = await post<Incident>('/incidents', { scenario: 'payment' }); navigate(`/incidents/${incident.id}`); toast(`${incident.incidentNumber} opened with live production signals.`); }
    catch (problem) { toast(problem instanceof Error ? problem.message : 'Incident could not be created.', 'error'); }
    finally { setLaunching(false); }
  };

  return <motion.div className="page-stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
    <PageTitle eyebrow="TUESDAY, SEPTEMBER 29 / PRODUCTION" title="Operational overview" description="A live read on production health, incident response and the experience your team has kept." action={<button className="button button-primary" onClick={() => void startIncident()} disabled={launching}><Plus size={16} />{launching ? 'Opening incident…' : 'New incident'}</button>} />
    {error && <LoadError message={error} retry={reload} />}
    <section className="metric-grid">{metrics.map((metric) => <Metric key={metric.key} label={metric.label} value={loading ? '—' : `${data?.metrics[metric.key] ?? 0}${'suffix' in metric ? metric.suffix : ''}`} detail={metric.detail} accent={metric.accent} icon={metric.icon} />)}</section>
    <div className="dashboard-grid">
      <section className="panel incident-panel"><SectionHeader title="Incident activity" aside={<Link to="/incidents" className="text-link">All incidents <ArrowRight size={14} /></Link>} />{loading ? <LoadingRows count={5} /> : data?.incidents.length ? <div className="incident-list">{data.incidents.slice(0, 6).map((incident) => <IncidentRow key={incident.id} incident={incident} />)}</div> : <Empty message="Production is clear. Launch a demo incident to start an investigation." />}</section>
      <section className="panel pulse-panel"><SectionHeader title="Production pulse" aside={<span className="live-label"><span className="status-dot live" />LIVE</span>} /><div className="health-score"><span className="health-score-number">{loading ? '—' : data ? Math.round(data.services.filter((service) => service.status === 'HEALTHY').length / data.services.length * 100) : 0}</span><span className="health-score-unit">%</span><span className="health-score-label">services healthy</span></div><div className="health-rule"><span /><span /></div><div className="service-health-list">{loading ? <LoadingRows count={4} /> : data?.services.slice(0, 5).map((service) => <div className="health-row" key={service.id}><span className={`status-dot ${service.status === 'HEALTHY' ? 'live' : 'warning'}`} /><span>{service.name}</span><small>{service.latency}ms</small><Badge tone={service.status}>{service.status}</Badge></div>)}</div><Link to="/services" className="panel-footer-link">Service health <ChevronRight size={15} /></Link></section>
      <section className="panel memory-panel"><SectionHeader title="Latest experience" aside={<Link to="/memory" className="text-link">Memory explorer <ArrowRight size={14} /></Link>} /><div className="memory-feed">{loading ? <LoadingRows count={3} /> : data?.memories.length ? data.memories.slice(0, 4).map((memory, index) => <Link to="/memory" className="memory-feed-item" key={memory.id}><span className={`memory-glyph memory-glyph-${index % 4}`}><Layers3 size={16} /></span><span className="memory-feed-copy"><strong>{memory.title}</strong><small>{memory.rootCause}</small></span><span className="memory-confidence">{Math.round(memory.confidence * 100)}%<small>confidence</small></span><ArrowUpRight size={14} className="row-arrow" /></Link>) : <Empty message="Stored incident experience will appear here." />}</div></section>
      <section className="learning-panel"><div className="learning-panel-top"><span className="learning-icon"><Sparkles size={17} /></span><Badge tone="teal">LEARNING LOOP</Badge><span className="learning-loop-dot" /></div><h2>The next response starts <span>one incident smarter.</span></h2><p>Stored experience is available before every investigation. Resolve an incident to add what worked.</p><div className="learning-stats"><span><strong>{loading ? '—' : data?.metrics.memoryCount ?? 0}</strong> learned experiences</span><span><strong>{loading ? '—' : data?.metrics.runbookSuccessRate ?? 0}%</strong> runbook success</span></div><Link to="/memory" className="button button-light">Explore incident memory <ArrowRight size={15} /></Link><div className="learning-motif"><div><Bot size={17} /></div><span /><div><Database size={17} /></div><span /><div><Target size={17} /></div><span /><div><ShieldCheck size={17} /></div></div></section>
    </div>
    <footer className="dashboard-footer"><span><CircleGauge size={14} /> {data?.provider ?? 'Connecting to local memory…'}</span><span><Activity size={14} />Operational data refreshes from the incident store</span><span><Server size={14} />{data?.services.length ?? 0} services monitored</span></footer>
  </motion.div>;
}