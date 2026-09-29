import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useRemote } from '../hooks/useRemote';
import { useToast } from '../components/Toast';
import { Empty, IncidentRow, LoadError, LoadingRows, PageTitle } from '../components/Common';
import { launchIncident } from '../components/Layout';
import type { Incident } from '../types';

export function Incidents() {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [ascending, setAscending] = useState(false);
  const { data, loading, error, reload } = useRemote<Incident[]>(`/incidents?q=${encodeURIComponent(query.trim())}`);
  const toast = useToast();
  const incidents = useMemo(() => (data ?? []).filter((incident) => (severity === 'ALL' || incident.severity === severity) && (status === 'ALL' || incident.status === status)).sort((a, b) => (ascending ? 1 : -1) * (Date.parse(a.detectedAt) - Date.parse(b.detectedAt))), [data, severity, status, ascending]);
  const pageSize = 10;
  const visible = incidents.slice(page * pageSize, (page + 1) * pageSize);

  const startDemo = async () => {
    try { const incident = await launchIncident('payment'); window.location.href = `/incidents/${incident.id}`; }
    catch (problem) { toast(problem instanceof Error ? problem.message : 'Incident could not be created.', 'error'); }
  };

  return <div className="page-stack"><PageTitle eyebrow="RESPONSE / EVENT HISTORY" title="Incident history" description="Search every recorded outage, mitigation and resolution in the production timeline." action={<button className="button button-primary" onClick={() => void startDemo()}>Launch incident</button>} />
    <section className="panel history-panel"><div className="history-toolbar"><label className="search-field"><Search size={16} /><input aria-label="Search incidents" placeholder="Search by incident, service or ID" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><label className="filter-field"><SlidersHorizontal size={15} /><select aria-label="Filter by severity" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(0); }}><option value="ALL">All severity</option>{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="filter-field"><select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="ALL">All status</option>{['DETECTED', 'INVESTIGATING', 'MITIGATING', 'RESOLVED', 'FAILED'].map((item) => <option key={item}>{item}</option>)}</select></label><button className="button button-secondary sort-button" onClick={() => setAscending(!ascending)}>Date {ascending ? '↑' : '↓'}</button></div>
      {error ? <LoadError message={error} retry={reload} /> : loading ? <LoadingRows count={8} /> : visible.length ? <><div className="history-head"><span>INCIDENT</span><span>SUMMARY</span><span>SEVERITY</span><span>STATUS</span><span>DETECTED</span><span /></div><div className="incident-list">{visible.map((incident) => <IncidentRow incident={incident} key={incident.id} />)}</div><div className="history-pagination"><span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, incidents.length)} of {incidents.length} incidents</span><div><button className="button button-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button className="button button-secondary" disabled={(page + 1) * pageSize >= incidents.length} onClick={() => setPage(page + 1)}>Next</button></div></div></> : <Empty message="No incidents match the current search and filters." />}
    </section>
  </div>;
}