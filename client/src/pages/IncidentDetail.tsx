import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowLeft, ArrowRight, Check, ChevronRight, CircleAlert, Clock3, Database, FileCheck2, GitCompareArrows, Gauge, History, Lightbulb, LoaderCircle, Play, RefreshCw, ShieldCheck, Sparkles, Terminal, Wrench } from 'lucide-react';
import { useRemote } from '../hooks/useRemote';
import { post } from '../services/api';
import { Badge, Empty, LoadError, LoadingRows, PageTitle, SectionHeader } from '../components/Common';
import { useToast } from '../components/Toast';
import type { Action, Event, Incident, Investigation, Memory } from '../types';

interface IncidentDetailData { incident: Incident; events: Event[]; learned: boolean; investigation: Investigation | null; actions: Action[] }

const scenarios = [
  ['payment', 'Payment API outage'], ['redis', 'Redis memory exhaustion'],
  ['kubernetes', 'Kubernetes CrashLoopBackOff'], ['database', 'Database latency spike'],
  ['auth', 'Authentication failure'], ['gateway', 'API gateway failure'],
];

export function IncidentDetail() {
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useRemote<IncidentDetailData>(`/incidents/${encodeURIComponent(id)}`, 1100);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const detail = data;
  const incident = detail?.incident;
  const investigation = detail?.investigation;
  const lastAction = detail?.actions[0];

  const runInvestigation = async () => {
    setBusy(true);
    try { await post<Investigation>(`/incidents/${id}/investigate`); reload(); toast('Historical investigation completed.'); }
    catch (problem) { toast(problem instanceof Error ? problem.message : 'Investigation failed.', 'error'); }
    finally { setBusy(false); }
  };

  const requestAction = async () => {
    setBusy(true);
    try { await post<Action>(`/incidents/${id}/actions`); reload(); toast('Remediation is waiting for your approval.', 'info'); }
    catch (problem) { toast(problem instanceof Error ? problem.message : 'Could not request action.', 'error'); }
    finally { setBusy(false); }
  };

  const decideAction = async (decision: 'approve' | 'reject') => {
    if (!lastAction) return;
    setBusy(true);
    try {
      await post(`/actions/${lastAction.id}/decision`, { decision, approvedBy: 'Demo operator' });
      if (decision === 'approve') { await post(`/actions/${lastAction.id}/execute`); toast('Action approved. Recovery verified from service telemetry.'); }
      else toast('Remediation rejected. No infrastructure change was executed.', 'info');
      reload();
    } catch (problem) { toast(problem instanceof Error ? problem.message : 'Could not process action.', 'error'); reload(); }
    finally { setBusy(false); }
  };

  const saveExperience = async () => {
    setBusy(true);
    try { const result = await post<{ stored: boolean; memoryCount: number }>(`/incidents/${id}/learn`); toast(result.stored ? `Experience stored. Memory now contains ${result.memoryCount} records.` : `This experience was already stored. Memory contains ${result.memoryCount} records.`); reload(); }
    catch (problem) { toast(problem instanceof Error ? problem.message : 'Could not store experience.', 'error'); }
    finally { setBusy(false); }
  };

  if (loading && !detail) return <div className="page-stack"><LoadingRows count={8} /></div>;
  if (error && !incident) return <div className="page-stack"><LoadError message={error} retry={reload} /></div>;
  if (!incident) return null;
  const resolved = incident.status === 'RESOLVED';

  return <div className="page-stack incident-detail-page"><Link to="/incidents" className="back-link"><ArrowLeft size={15} />Incident history</Link>
    <PageTitle eyebrow={`INCIDENT / ${incident.environment.toUpperCase()} / ${incident.incidentNumber}`} title={incident.title} description={`${incident.service} · Opened ${new Date(incident.detectedAt).toLocaleString()}`} action={<div className="title-badges"><Badge tone={incident.severity}>{incident.severity}</Badge><Badge tone={incident.status}>{incident.status}</Badge></div>} />
    <div className="incident-story"><span>INCIDENT</span><ArrowRight size={15} /><span>CURRENT EVIDENCE</span><ArrowRight size={15} /><span className={investigation ? 'story-done' : ''}>HINDSIGHT</span><ArrowRight size={15} /><span className={lastAction ? 'story-done' : ''}>HUMAN APPROVAL</span><ArrowRight size={15} /><span className={resolved ? 'story-done' : ''}>RECOVERY</span><ArrowRight size={15} /><span className={resolved && incident.rootCause ? 'story-done' : ''}>NEW MEMORY</span></div>
    <div className="incident-layout">
      <div className="incident-main-column">
        <section className="panel evidence-panel"><SectionHeader title="Current evidence" aside={<span className="live-label"><span className={`status-dot ${resolved ? 'live' : 'warning'}`} />{resolved ? 'RECOVERED' : 'LIVE TELEMETRY'}</span>} /><div className="evidence-metrics">{[[`Error rate`, `${investigation?.evidence.errorRate ?? (incident.service === 'Payment API' ? '42.8' : '18.2')}%`, 'error'], ['Latency', `${investigation?.evidence.latency ?? (incident.service === 'Payment API' ? 842 : 690)}ms`, 'delay'], ['CPU', `${investigation?.evidence.cpu ?? 82}%`, 'load'], ['Database', `${investigation?.evidence.databaseConnections.used ?? 96}/${investigation?.evidence.databaseConnections.limit ?? 100}`, 'connections']].map(([label, value, hint]) => <div className="evidence-stat" key={label}><span>{label}</span><strong>{resolved && label === 'Error rate' ? '0.4%' : resolved && label === 'Latency' ? '128ms' : value}</strong><small>{resolved ? 'within recovery range' : hint === 'connections' ? 'active connections' : label === 'Error rate' ? 'threshold exceeded' : 'vs 2.1s baseline'}</small><span className={`evidence-spark ${resolved ? 'spark-good' : 'spark-alert'}`} /></div>)}</div><div className="deployment-strip"><History size={15} /><span>Recent deployment</span><strong>{investigation?.evidence.recentDeployment ?? 'payments-api v2.14.0 · 18 minutes before detection'}</strong><ChevronRight size={15} /></div><div className="affected-strip"><span>AFFECTED SERVICES</span>{(investigation?.evidence.affectedServices ?? [incident.service, ...(incident.service === 'Payment API' ? ['PostgreSQL', 'Checkout'] : [])]).map((service, index) => <span className="affected-service" key={service}><i className={index === 0 ? 'affected-alert' : ''} />{service}</span>)}</div></section>

        {!investigation ? <section className="investigate-banner"><div className="investigate-icon"><Sparkles size={19} /></div><div><strong>Before OpsMind recommends a fix, it checks what happened before.</strong><p>Compare this incident against persistent operational experience and matched runbooks.</p></div><button className="button button-primary" disabled={busy} onClick={() => void runInvestigation()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{busy ? 'Investigating' : 'Start investigation'}</button></section> : <>
          <section className="panel reasoning-panel"><SectionHeader title="Hindsight recall" aside={<span className="memory-source"><Database size={14} />LOCAL EXPERIENCE STORE</span>} /><div className="reasoning-intro"><span className="reasoning-icon"><GitCompareArrows size={18} /></span><p>{investigation.reasoning}</p></div><div className="evidence-compare"><div><span className="compare-label">CURRENT SIGNALS</span><strong>{incident.symptoms[0] ?? incident.title}</strong><small>{investigation.evidence.errorRate}% errors · {investigation.evidence.latency}ms latency · {investigation.evidence.databaseConnections.used}/{investigation.evidence.databaseConnections.limit} connections</small></div><ArrowDownRight size={18} /><div><span className="compare-label">RETRIEVED ROOT CAUSE</span><strong>{investigation.likelyCause}</strong><small>{investigation.matches.length} matching memories · ranked on actual service, symptom and term overlap</small></div></div><div className="historical-head"><span>PRIOR EXPERIENCE</span><span>SIMILARITY</span></div>{investigation.matches.slice(0, 4).map(({ memory, similarity, reason }) => <MemoryMatchRow key={memory.id} memory={memory} similarity={similarity} reason={reason} />)}{investigation.matches.length === 0 && <Empty message="No stored memories matched. The recommendation is based on current evidence only." />}<div className="action-evidence"><div><span className="compare-label">WHAT WORKED</span><strong>{investigation.matches[0]?.memory.successfulActions[0] ?? 'No validated resolution found'}</strong></div><div><span className="compare-label">WHAT DID NOT</span><strong>{investigation.matches[0]?.memory.failedActions[0] ?? 'No failed-action history found'}</strong></div></div></section>

          <section className="panel investigation-plan"><SectionHeader title="Investigation plan" aside={<Badge tone="teal">EVIDENCE LED</Badge>} /><div className="plan-steps">{investigation.plan.map((step, index) => <div className="plan-step" key={step.id}><span className={`plan-index ${step.status === 'COMPLETE' ? 'plan-complete' : ''}`}>{step.status === 'COMPLETE' ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><p>{step.evidence}</p></div><button className="icon-button plan-run" title={`Inspect: ${step.title}`} aria-label={`Inspect ${step.title}`} onClick={() => toast(`Evidence checked: ${step.evidence}`, 'info')}><Play size={14} /></button></div>)}</div></section>

          <section className="panel recommendation-panel"><div className="recommendation-label"><Lightbulb size={16} /> EVIDENCE-BASED RECOMMENDATION</div><p>{investigation.recommendation}</p><div className="recommendation-reason"><span><GitCompareArrows size={14} />Retrieved support</span><strong>{investigation.action.reason} · {investigation.action.successRate}% historical runbook success</strong></div>{investigation.runbook && <div className="selected-runbook"><span className="runbook-mini-icon"><FileCheck2 size={16} /></span><div><span>SELECTED RUNBOOK</span><strong>{investigation.runbook.name}</strong><small>{investigation.runbook.steps.length} steps · {investigation.runbook.usageCount} recorded uses · {investigation.runbook.successRate}% success</small></div><Link to="/runbooks" aria-label="View runbooks"><ChevronRight size={16} /></Link></div>}{!lastAction || lastAction.status === 'REJECTED' ? <button className="button button-primary recommendation-button" disabled={busy} onClick={() => void requestAction()}><Wrench size={15} />{busy ? 'Requesting action' : 'Request remediation approval'}</button> : null}</section>
          {lastAction?.status === 'PENDING' && <section className="approval-panel"><div className="approval-heading"><span className="approval-shield"><ShieldCheck size={19} /></span><div><Badge tone="warning">OPERATOR APPROVAL REQUIRED</Badge><h2>Review proposed change</h2></div><span className="approval-risk">LOW RISK</span></div><div className="approval-action"><span>PROPOSED REMEDIATION</span><strong>{lastAction.action}</strong><p>{lastAction.reason}</p></div><div className="approval-footer"><span>No changes run until you approve. Approval is also enforced by the API.</span><div><button className="button button-secondary" disabled={busy} onClick={() => void decideAction('reject')}>Reject</button><button className="button button-primary" disabled={busy} onClick={() => void decideAction('approve')}><ShieldCheck size={15} />Approve &amp; execute</button></div></div></section>}
          {lastAction?.status === 'SUCCESS' && <section className="panel recovery-success"><span><Check size={18} /></span><div><strong>Remediation verified</strong><p>{lastAction.result} Incident resolved in {Math.max(1, Math.round((incident.recoveryTime ?? 0) / 60000))} minutes.</p></div><Badge tone="healthy">SERVICE RECOVERED</Badge></section>}
        </>}

        {resolved && <section className="panel postmortem-panel"><SectionHeader title="Post-incident review" aside={<Badge tone="teal">{incident.confidence ? `${Math.round(incident.confidence * 100)}% CONFIDENCE` : 'OPERATOR VERIFIED'}</Badge>} /><div className="postmortem-summary"><span>ROOT CAUSE</span><strong>{incident.rootCause}</strong><p>{incident.description}</p></div><div className="postmortem-columns"><div><span>RESOLUTION</span><strong>{incident.resolution}</strong></div><div><span>RECOVERY</span><strong>{Math.max(1, Math.round((incident.recoveryTime ?? 0) / 60000))} minutes</strong></div><div><span>PREVENTION</span><strong>Compare current database saturation against saved pool-exhaustion experience before any broad restarts.</strong></div></div><div className="postmortem-actions"><button className="button button-primary" onClick={() => void saveExperience()} disabled={busy || detail?.learned}><Database size={15} />{detail?.learned ? 'Experience stored' : busy ? 'Saving' : 'Store in hindsight memory'}</button></div></section>}
      </div>

      <aside className="incident-side-column"><section className="panel activity-panel"><SectionHeader title="Agent activity" aside={<span className="live-label"><span className={`status-dot ${investigation ? 'live' : 'warning'}`} />{investigation ? 'COMPLETE' : 'MONITORING'}</span>} /><div className="activity-timeline">{(investigation?.activity ?? [{ status: 'complete', message: 'Incident received' }, { status: 'active', message: 'Collecting live service evidence' }, { status: 'waiting', message: 'Historical memory search queued' }]).map((item, index) => <div className={`activity-item activity-${item.status}`} key={`${item.message}-${index}`}><span className="activity-marker">{item.status === 'complete' ? <Check size={12} /> : item.status === 'active' ? <LoaderCircle className="spin" size={12} /> : index + 1}</span><span>{item.message}</span></div>)}{investigation && lastAction?.status === 'SUCCESS' && <div className="activity-item activity-complete"><span className="activity-marker"><Check size={12} /></span><span>Recovery confirmed by live telemetry</span></div>}{incident.rootCause && <div className="activity-item activity-complete"><span className="activity-marker"><Check size={12} /></span><span>New experience stored for the next incident</span></div>}</div><div className="agent-engine"><span className="agent-orbit"><Sparkles size={14} /></span><span><strong>Deterministic evidence engine</strong><small>Reproducible reasoning · no LLM key required</small></span></div></section>

        <section className="panel logs-panel"><SectionHeader title="Live logs" aside={<span className="log-count">{detail?.events.filter((event) => event.eventType === 'LOG_EVENT').length ?? 0} ENTRIES</span>} /><div className="log-stream">{!detail?.events.some((event) => event.eventType === 'LOG_EVENT') ? <div className="log-awaiting"><LoaderCircle className="spin" size={15} />Awaiting log stream</div> : detail.events.filter((event) => event.eventType === 'LOG_EVENT').map((event) => <div className="log-line" key={event.id}><span>{new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span><b className={`log-${event.severity.toLowerCase()}`}>{event.severity}</b><code>{event.message}</code></div>)}</div><div className="log-footer"><Terminal size={13} />simulated infrastructure / live stream</div></section>

        <section className="panel incident-meta"><div><span><Clock3 size={14} />Detection</span><strong>{new Date(incident.detectedAt).toLocaleTimeString()}</strong></div><div><span><Gauge size={14} />Impact</span><strong>{incident.severity} / production</strong></div><div><span><Database size={14} />Prior experience</span><strong>{investigation ? `${investigation.matches.length} records retrieved` : 'Not searched yet'}</strong></div><div><span><RefreshCw size={14} />Agent mode</span><strong>Human approval required</strong></div></section>
      </aside>
    </div>
    <div className="incident-select-row"><span>TRY ANOTHER SCENARIO</span>{scenarios.map(([key, label]) => <button key={key} onClick={async () => { try { const next = await post<Incident>('/incidents', { scenario: key }); window.location.href = `/incidents/${next.id}`; } catch { toast('Could not create incident scenario.', 'error'); } }}><CircleAlert size={13} />{label}</button>)}</div>
  </div>;
}

function MemoryMatchRow({ memory, similarity, reason }: { memory: Memory; similarity: number; reason: string }) {
  return <div className="historical-row"><span className="historical-icon"><History size={15} /></span><div className="historical-copy"><Link to="/memory">{memory.title}</Link><small>{memory.rootCause}</small><em>{reason}</em></div><span className="similarity-meter"><span style={{ width: `${similarity}%` }} /><strong>{similarity}%</strong></span><span className="memory-confidence">{Math.round(memory.confidence * 100)}%<small>confidence</small></span><ChevronRight size={14} /></div>;
}