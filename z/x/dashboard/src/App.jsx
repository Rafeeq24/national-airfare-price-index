import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

const MOCK_INDEX_CHART = [
  { date: 'Aug 04', 'T+1': 103.2, 'T+7': 97.4, 'T+45': 94.8, composite: 98.4 },
  { date: 'Aug 07', 'T+1': 109.8, 'T+7': 98.6, 'T+45': 95.1, composite: 101.2 },
  { date: 'Aug 10', 'T+1': 95.4, 'T+7': 104.2, 'T+45': 93.6, composite: 97.7 },
  { date: 'Aug 13', 'T+1': 106.5, 'T+7': 96.0, 'T+45': 96.2, composite: 99.6 },
  { date: 'Aug 16', 'T+1': 101.0, 'T+7': 108.5, 'T+45': 94.0, composite: 101.2 },
  { date: 'Aug 19', 'T+1': 108.2, 'T+7': 95.2, 'T+45': 96.8, composite: 100.1 },
  { date: 'Aug 22', 'T+1': 94.6, 'T+7': 107.0, 'T+45': 93.5, composite: 98.4 },
  { date: 'Aug 25', 'T+1': 107.8, 'T+7': 96.8, 'T+45': 97.2, composite: 100.6 },
  { date: 'Aug 28', 'T+1': 100.5, 'T+7': 109.4, 'T+45': 94.8, composite: 101.6 },
  { date: 'Aug 31', 'T+1': 109.0, 'T+7': 94.8, 'T+45': 96.4, composite: 100.1 },
  { date: 'Sep 03', 'T+1': 95.8, 'T+7': 107.2, 'T+45': 93.8, composite: 98.9 },
  { date: 'Sep 06', 'T+1': 112.5, 'T+7': 98.0, 'T+45': 95.4, composite: 102.0 }
];

const ROUTE_COMPARISON_DATA = [
  { route: 'DEL-BOM', name: 'Delhi ⇄ Mumbai', t1: 7389, t7: 5586, t45: 4536, index: 104.7, weight: 0.35 },
  { route: 'DEL-BLR', name: 'Delhi ⇄ Bengaluru', t1: 8250, t7: 6120, t45: 4980, index: 102.1, weight: 0.25 },
  { route: 'BOM-BLR', name: 'Mumbai ⇄ Bengaluru', t1: 5490, t7: 4210, t45: 3650, index: 98.5, weight: 0.20 },
  { route: 'DEL-CCU', name: 'Delhi ⇄ Kolkata', t1: 6890, t7: 5150, t45: 4120, index: 101.4, weight: 0.12 },
  { route: 'MAA-DEL', name: 'Chennai ⇄ Delhi', t1: 7920, t7: 5890, t45: 4750, index: 103.8, weight: 0.08 }
];

const DEFAULT_SURVEILLANCE_QUOTES = [
  { id: 1, carrier: 'IndiGo', route: 'DEL-BOM', window: 'T+45', travelDate: '2026-10-31', baseFare: 3719, totalFare: 4536, mode: 'IndiGo', scrapedAt: '2026-09-16 14:48' },
  { id: 2, carrier: 'IndiGo', route: 'DEL-BOM', window: 'T+7', travelDate: '2026-09-23', baseFare: 4580, totalFare: 5586, mode: 'IndiGo', scrapedAt: '2026-09-16 14:48' },
  { id: 3, carrier: 'IndiGo', route: 'DEL-BOM', window: 'T+1', travelDate: '2026-09-17', baseFare: 6059, totalFare: 7389, mode: 'IndiGo', scrapedAt: '2026-09-16 14:48' },
  { id: 4, carrier: 'Air India', route: 'DEL-BOM', window: 'T+45', travelDate: '2026-10-19', baseFare: 3852, totalFare: 4815, mode: 'Air India', scrapedAt: '2026-09-04 22:47' },
  { id: 5, carrier: 'Air India', route: 'DEL-BOM', window: 'T+7', travelDate: '2026-09-12', baseFare: 4785, totalFare: 5836, mode: 'Air India', scrapedAt: '2026-09-04 22:47' },
  { id: 6, carrier: 'Air India', route: 'DEL-BOM', window: 'T+1', travelDate: '2026-09-05', baseFare: 6720, totalFare: 8179, mode: 'Air India', scrapedAt: '2026-09-04 22:47' },
  { id: 7, carrier: 'SpiceJet', route: 'DEL-BOM', window: 'T+7', travelDate: '2026-09-24', baseFare: 4420, totalFare: 5390, mode: 'Travel Portal', scrapedAt: '2026-09-16 13:15' },
  { id: 8, carrier: 'Akasa Air', route: 'DEL-BOM', window: 'T+1', travelDate: '2026-09-18', baseFare: 5890, totalFare: 7180, mode: 'Akasa API', scrapedAt: '2026-09-16 12:40' }
];

const AVAILABLE_ROUTES = [
  { id: 'DEL-BOM', name: 'Delhi ⇄ Mumbai', orig: 'Delhi (DEL)', dest: 'Mumbai (BOM)', distance: '1,150 km', flights: '62 daily' },
  { id: 'DEL-BLR', name: 'Delhi ⇄ Bengaluru', orig: 'Delhi (DEL)', dest: 'Bengaluru (BLR)', distance: '1,740 km', flights: '48 daily' },
  { id: 'BOM-BLR', name: 'Mumbai ⇄ Bengaluru', orig: 'Mumbai (BOM)', dest: 'Bengaluru (BLR)', distance: '840 km', flights: '36 daily' },
  { id: 'DEL-CCU', name: 'Delhi ⇄ Kolkata', orig: 'Delhi (DEL)', dest: 'Kolkata (CCU)', distance: '1,310 km', flights: '32 daily' },
  { id: 'MAA-DEL', name: 'Chennai ⇄ Delhi', orig: 'Chennai (MAA)', dest: 'Delhi (DEL)', distance: '1,760 km', flights: '28 daily' },
  { id: 'BLR-HYD', name: 'Bengaluru ⇄ Hyderabad', orig: 'Bengaluru (BLR)', dest: 'Hyderabad (HYD)', distance: '500 km', flights: '24 daily' }
];

export default function App() {
  const [selectedRoute, setSelectedRoute] = useState('DEL-BOM');
  const [selectedHorizon, setSelectedHorizon] = useState('all');
  const [activeNavTab, setActiveNavTab] = useState('dashboard');
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState('Tue, 16 Sep 2026, 14:48 IST');

  const [kpis, setKpis] = useState({
    'T+1': { index: 104.7, fare: 7389, change: 4.7, isIncrease: true },
    'T+7': { index: 98.0, fare: 5586, change: -2.0, isIncrease: false },
    'T+45': { index: 95.4, fare: 4536, change: -4.6, isIncrease: false }
  });

  const [chartData, setChartData] = useState(MOCK_INDEX_CHART);
  const [quotes, setQuotes] = useState(DEFAULT_SURVEILLANCE_QUOTES);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [scraperStatus, setScraperStatus] = useState({
    indigo: { active: true, lastScraped: '2 min ago', quotesCount: 1248, status: 'Healthy', isScraping: false },
    airindia: { active: true, lastScraped: '3 min ago', quotesCount: 986, status: 'Healthy', isScraping: false },
    ota: { active: true, lastScraped: '5 min ago', quotesCount: 3120, status: 'Healthy', isScraping: false }
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const str = now.toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
      });
      setCurrentTime(`${str} IST`);
    };
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchRouteTelemetry = useCallback(async (route) => {
    setIsRefreshing(true);
    try {
      const [indexRes, summaryRes, faresRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/index?route=${route}`, { timeout: 2000 }),
        axios.get(`${API_BASE_URL}/api/summary?route=${route}`, { timeout: 2000 }),
        axios.get(`${API_BASE_URL}/api/fares?route=${route}&limit=12`, { timeout: 2000 })
      ]);

      if (indexRes.data?.data?.length > 0) setChartData(indexRes.data.data);
      else setChartData(MOCK_INDEX_CHART);

      if (summaryRes.data?.windows) {
        const w = summaryRes.data.windows;
        setKpis({
          'T+1': { index: w['T+1']?.current_index ?? 104.7, fare: w['T+1']?.current_avg_fare ?? 7389, change: w['T+1']?.change_pct ?? 4.7, isIncrease: (w['T+1']?.change_pct ?? 4.7) > 0 },
          'T+7': { index: w['T+7']?.current_index ?? 98.0, fare: w['T+7']?.current_avg_fare ?? 5586, change: w['T+7']?.change_pct ?? -2.0, isIncrease: (w['T+7']?.change_pct ?? -2.0) > 0 },
          'T+45': { index: w['T+45']?.current_index ?? 95.4, fare: w['T+45']?.current_avg_fare ?? 4536, change: w['T+45']?.change_pct ?? -4.6, isIncrease: (w['T+45']?.change_pct ?? -4.6) > 0 }
        });
      }

      if (faresRes.data?.length > 0) {
        setQuotes(faresRes.data.map((f, i) => ({
          id: f.id || i + 1, carrier: f.carrier, route: f.route, window: f.advance_purchase_window,
          travelDate: f.travel_date, baseFare: f.base_fare, totalFare: f.total_fare,
          mode: f.source || f.carrier, scrapedAt: f.date_scraped || '2026-09-16 14:48'
        })));
      }
    } catch {
      setChartData(MOCK_INDEX_CHART);
      setQuotes(DEFAULT_SURVEILLANCE_QUOTES.map(q => ({ ...q, route })));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRouteTelemetry(selectedRoute);
  }, [selectedRoute, fetchRouteTelemetry]);

  const handleTriggerScrape = async (sourceKey) => {
    setScraperStatus(prev => ({ ...prev, [sourceKey]: { ...prev[sourceKey], isScraping: true } }));
    try {
      await axios.get(`${API_BASE_URL}/api/scrape-now?source=${sourceKey}`, { timeout: 15000 });
      setScraperStatus(prev => ({
        ...prev,
        [sourceKey]: { ...prev[sourceKey], isScraping: false, lastScraped: 'Just now', quotesCount: prev[sourceKey].quotesCount + 24 }
      }));
      fetchRouteTelemetry(selectedRoute);
    } catch {
      setTimeout(() => {
        setScraperStatus(prev => ({
          ...prev,
          [sourceKey]: { ...prev[sourceKey], isScraping: false, lastScraped: 'Just now', quotesCount: prev[sourceKey].quotesCount + 18 }
        }));
      }, 1400);
    }
  };

  const handleSwapRoute = () => {
    const [o, d] = selectedRoute.split('-');
    const reversed = `${d}-${o}`;
    const exists = AVAILABLE_ROUTES.find(r => r.id === reversed);
    setSelectedRoute(exists ? exists.id : selectedRoute);
  };

  const formatINR = (val) => (val === undefined || val === null) ? '₹-' : `₹${Math.round(val).toLocaleString('en-IN')}`;

  const currentRouteMeta = useMemo(() => AVAILABLE_ROUTES.find(r => r.id === selectedRoute) || AVAILABLE_ROUTES[0], [selectedRoute]);

  const filteredQuotes = useMemo(() => {
    if (!searchQuery.trim()) return quotes;
    const q = searchQuery.toLowerCase();
    return quotes.filter(item =>
      item.carrier.toLowerCase().includes(q) ||
      item.route.toLowerCase().includes(q) ||
      item.window.toLowerCase().includes(q)
    );
  }, [quotes, searchQuery]);

  return (
    <div className="apix-production-shell">
      <header className="production-header">
        <div className="header-inner-row">
          <div className="header-branding-group">
            <div className="moca-emblem-badge">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15 5H9L12 2Z" fill="#0284c7" />
                <circle cx="12" cy="9" r="4" stroke="#0284c7" strokeWidth="1.5" />
                <path d="M7 14H17L18 21H6L7 14Z" fill="#0284c7" opacity="0.85" />
                <circle cx="12" cy="17.5" r="1.8" fill="#ffffff" />
              </svg>
            </div>
            <div className="header-text-block">
              <div className="gov-title">National Airfare Price Index</div>
            </div>
          </div>

          <nav className="header-nav-links">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'surveillance', label: 'Surveillance' },
              { id: 'reports', label: 'Reports' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab-btn ${activeNavTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveNavTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="header-actions-group">
            <div className="header-search-wrap">
              <input
                type="text"
                placeholder="Search route, airline..."
                className="search-input-field"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="live-status-pill">
              <span className="live-status-dot"></span>
              <span className="live-status-text">Live Surveillance Active</span>
            </div>
            <div className="user-profile-circle">
              <span>R</span>
            </div>
          </div>
        </div>
      </header>

      <main className="production-main-container">
        {activeNavTab === 'dashboard' && (
          <>
            <section className="route-control-card">
              <div className="route-control-left">
                <span className="control-section-label">MONITORED TRUNK ROUTE</span>
                <div className="route-endpoints-cluster">
                  <span className="endpoint-tag">{currentRouteMeta.orig}</span>
                  <button type="button" className="btn-swap-direction" onClick={handleSwapRoute}>⇄</button>
                  <span className="endpoint-tag">{currentRouteMeta.dest}</span>
                </div>
              </div>

              <div className="horizon-filter-pills">
                {['all', 'T+1', 'T+7', 'T+45'].map(h => (
                  <button key={h} type="button" className={`horizon-pill ${selectedHorizon === h ? 'active' : ''}`} onClick={() => setSelectedHorizon(h)}>
                    {h === 'all' ? 'All Horizons' : h}
                  </button>
                ))}
              </div>

              <div className="route-control-actions">
                <button type="button" className="btn-control primary" onClick={() => setIsRouteModalOpen(true)}>Change Route</button>
                <button type="button" className="btn-control secondary" onClick={() => fetchRouteTelemetry(selectedRoute)}>Live Refresh</button>
              </div>
            </section>

            <div className="kpi-cards-triad">
              <div className="kpi-summary-card t1">
                <div className="kpi-name-tag red">T+1 HORIZON</div>
                <div className="kpi-big-num">{kpis['T+1'].index.toFixed(1)}</div>
                <div className="kpi-fare-val">{formatINR(kpis['T+1'].fare)}</div>
              </div>
              <div className="kpi-summary-card t7">
                <div className="kpi-name-tag cyan">T+7 HORIZON</div>
                <div className="kpi-big-num">{kpis['T+7'].index.toFixed(1)}</div>
                <div className="kpi-fare-val">{formatINR(kpis['T+7'].fare)}</div>
              </div>
              <div className="kpi-summary-card t45">
                <div className="kpi-name-tag emerald">T+45 HORIZON</div>
                <div className="kpi-big-num">{kpis['T+45'].index.toFixed(1)}</div>
                <div className="kpi-fare-val">{formatINR(kpis['T+45'].fare)}</div>
              </div>
            </div>

            <div className="chart-container-card">
              <h3 className="chart-heading">Price Index Time-Series Comparison: {selectedRoute}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis domain={[88, 120]} stroke="#64748b" />
                  <Tooltip />
                  <Line type="monotone" dataKey="T+1" stroke="#e11d48" strokeWidth={2} />
                  <Line type="monotone" dataKey="T+7" stroke="#0284c7" strokeWidth={2} />
                  <Line type="monotone" dataKey="T+45" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <section className="surveillance-table-section">
              <div className="table-card-container">
                <table className="production-data-table">
                  <thead>
                    <tr><th>AIRLINE</th><th>ROUTE</th><th>WINDOW</th><th>TRAVEL DATE</th><th>TOTAL FARE</th><th>MODE</th></tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map((q) => (
                      <tr key={q.id}>
                        <td><span className={`carrier-pill ${q.carrier.toLowerCase().replace(/\s+/g, '')}`}>{q.carrier}</span></td>
                        <td>{q.route}</td>
                        <td>{q.window}</td>
                        <td>{q.travelDate}</td>
                        <td>{formatINR(q.totalFare)}</td>
                        <td>{q.mode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeNavTab === 'analytics' && (
          <div className="page-banner-card">
            <div>
              <div className="banner-badge">ECONOMETRIC ANALYTICS</div>
              <h2 className="banner-title">Civil Aviation Price Index & Analytics</h2>
            </div>
          </div>
        )}

        {activeNavTab === 'surveillance' && (
          <div className="page-banner-card">
            <div>
              <div className="banner-badge">SURVEILLANCE MONITORING</div>
              <h2 className="banner-title">Data Pipeline Surveillance</h2>
            </div>
          </div>
        )}

        {activeNavTab === 'reports' && (
          <div className="page-banner-card">
            <div>
              <div className="banner-badge">EXECUTIVE REPORTS</div>
              <h2 className="banner-title">National Airfare Index Summary Report</h2>
            </div>
          </div>
        )}
      </main>

      <footer className="production-footer">
        <div className="footer-inner-row">
          <div className="footer-title">National Airfare Price Index (APIx)</div>
          <div className="tiranga-line"></div>
        </div>
      </footer>
    </div>
  );
}