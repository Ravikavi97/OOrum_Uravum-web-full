'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const PING_INTERVAL = 60_000;
const STATS_INTERVAL = 30_000;

interface Stats {
  live: number;
  today: number;
  total: number;
}

export default function VisitorStats() {
  const [stats, setStats] = useState<Stats>({ live: 0, today: 0, total: 0 });

  const ping = useCallback(async (sid: string | null) => {
    try {
      const res = await fetch(`${API_URL}/visitors/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionId && !sid) {
          sessionStorage.setItem('visitor_session', data.sessionId);
        }
      }
    } catch { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/visitors/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem('visitor_session');
    ping(stored);
    fetchStats();
    const p = setInterval(() => ping(sessionStorage.getItem('visitor_session')), PING_INTERVAL);
    const s = setInterval(fetchStats, STATS_INTERVAL);
    return () => { clearInterval(p); clearInterval(s); };
  }, [ping, fetchStats]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-2">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-xs text-white/50">Live</span>
        <span className="text-sm font-bold text-green-400">{stats.live.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">Visitors Today</span>
        <span className="text-sm font-bold text-blue-400">{stats.today.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">Total Visitors</span>
        <span className="text-sm font-bold text-purple-400">{stats.total.toLocaleString()}</span>
      </div>
    </div>
  );
}
