import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

export function useRemote<T>(path: string, interval = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  useEffect(() => {
    let live = true;
    const load = async () => {
      if (live) { setLoading(data === null); setError(''); }
      try {
        const result = await api<T>(path);
        if (live) { setData(result); setLoading(false); }
      } catch (problem) {
        if (live) { setError(problem instanceof Error ? problem.message : 'Unable to load this view.'); setLoading(false); }
      }
    };
    void load();
    if (interval) {
      const timer = window.setInterval(() => { void load(); }, interval);
      return () => { live = false; window.clearInterval(timer); };
    }
    return () => { live = false; };
  }, [path, interval, version]);
  return { data, loading, error, reload };
}