import React from 'react';

/**
 * IndiaAviationMap: Professional, high-fidelity vector airspace map of India.
 * Features great-circle flight arcs, animated aircraft pulses,
 * geodetic airport beacons, and integrated route metadata telemetry.
 * Styled for Premium White Theme interface.
 */
export default function IndiaAviationMap({
  selectedRoute = 'DEL-BOM',
  onRouteChange,
  onOpenModal
}) {
  // Coordinates mapped accurately within a 620 x 720 SVG viewBox
  const AIRPORT_COORDS = {
    DEL: { x: 250, y: 195, name: 'Delhi', code: 'DEL', full: "Indira Gandhi Int'l" },
    BOM: { x: 175, y: 395, name: 'Mumbai', code: 'BOM', full: "Chhatrapati Shivaji Int'l" },
    BLR: { x: 255, y: 535, name: 'Bengaluru', code: 'BLR', full: "Kempegowda Int'l" },
    HYD: { x: 275, y: 435, name: 'Hyderabad', code: 'HYD', full: "Rajiv Gandhi Int'l" },
    MAA: { x: 310, y: 545, name: 'Chennai', code: 'MAA', full: "Chennai Int'l" },
    CCU: { x: 440, y: 315, name: 'Kolkata', code: 'CCU', full: "Netaji Subhash Chandra Bose" },
    AMD: { x: 170, y: 300, name: 'Ahmedabad', code: 'AMD', full: 'Sardar Vallabhbhai Patel' },
    GOI: { x: 195, y: 475, name: 'Goa', code: 'GOI', full: 'Dabolim / Mopa' },
    COK: { x: 235, y: 605, name: 'Kochi', code: 'COK', full: "Cochin Int'l" }
  };

  // Precomputed flight arc curves (SVG path data with control point offsets)
  const ROUTE_PATHS = [
    {
      id: 'DEL-BOM',
      path: 'M 250 195 Q 180 285 175 395',
      orig: 'DEL',
      dest: 'BOM'
    },
    {
      id: 'DEL-BLR',
      path: 'M 250 195 Q 230 365 255 535',
      orig: 'DEL',
      dest: 'BLR'
    },
    {
      id: 'BOM-BLR',
      path: 'M 175 395 Q 205 470 255 535',
      orig: 'BOM',
      dest: 'BLR'
    },
    {
      id: 'DEL-CCU',
      path: 'M 250 195 Q 350 225 440 315',
      orig: 'DEL',
      dest: 'CCU'
    },
    {
      id: 'MAA-DEL',
      path: 'M 310 545 Q 315 360 250 195',
      orig: 'MAA',
      dest: 'DEL'
    },
    {
      id: 'BLR-HYD',
      path: 'M 255 535 Q 275 485 275 435',
      orig: 'BLR',
      dest: 'HYD'
    },
    {
      id: 'BOM-GOI',
      path: 'M 175 395 Q 178 435 195 475',
      orig: 'BOM',
      dest: 'GOI'
    }
  ];

  // Route metadata lookup
  const ROUTE_INFO = {
    'DEL-BOM': { dist: '1,150 km', duration: '2h 10m', flights: '62 daily' },
    'DEL-BLR': { dist: '1,740 km', duration: '2h 45m', flights: '48 daily' },
    'BOM-BLR': { dist: '840 km', duration: '1h 35m', flights: '36 daily' },
    'DEL-CCU': { dist: '1,310 km', duration: '2h 15m', flights: '32 daily' },
    'MAA-DEL': { dist: '1,760 km', duration: '2h 40m', flights: '28 daily' },
    'BLR-HYD': { dist: '500 km', duration: '1h 10m', flights: '24 daily' }
  };

  const activeMeta = ROUTE_INFO[selectedRoute] || ROUTE_INFO['DEL-BOM'];
  const [origCode, destCode] = selectedRoute.split('-');
  const origAirport = AIRPORT_COORDS[origCode] || AIRPORT_COORDS['DEL'];
  const destAirport = AIRPORT_COORDS[destCode] || AIRPORT_COORDS['BOM'];

  return (
    <div className="airspace-map-card">
      {/* Top Header inside Card */}
      <div className="airspace-card-top">
        <div className="airspace-title-block">
          <div className="airspace-badge">AERO SURVEILLANCE RADAR</div>
          <h3 className="airspace-heading">India Domestic Airspace Network</h3>
          <p className="airspace-subheading">
            Live telemetry & flight corridors for high-frequency domestic trunk routes
          </p>
        </div>
        <button
          type="button"
          className="btn-open-explorer"
          onClick={onOpenModal}
          title="Open interactive route selector"
        >
          Explore Routes
        </button>
      </div>

      {/* SVG Map Canvas Container */}
      <div className="airspace-svg-wrapper">
        <svg
          viewBox="0 0 620 720"
          className="airspace-svg"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Ambient Base Gradient for Ocean Base */}
            <radialGradient id="mapBgGrad" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="70%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </radialGradient>

            {/* Landmass Shading */}
            <linearGradient id="indiaLandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="60%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#93c5fd" />
            </linearGradient>

            {/* Blue Trunk Corridor Glow Filter */}
            <filter id="blueGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Aircraft Marker Symbol */}
            <g id="aircraftIcon">
              <circle r="4.5" fill="#0284c7" />
              <circle r="7.5" fill="none" stroke="#0284c7" strokeWidth="1.5" opacity="0.8" />
            </g>
          </defs>

          {/* Background Oceanic Grid */}
          <rect width="620" height="720" fill="url(#mapBgGrad)" rx="12" />

          {/* Geodesic Coordinates Grid (Subtle Lines) */}
          <g stroke="rgba(2, 132, 199, 0.12)" strokeWidth="1" strokeDasharray="3 4">
            <line x1="50" y1="120" x2="570" y2="120" />
            <line x1="50" y1="240" x2="570" y2="240" />
            <line x1="50" y1="360" x2="570" y2="360" />
            <line x1="50" y1="480" x2="570" y2="480" />
            <line x1="50" y1="600" x2="570" y2="600" />
            <line x1="140" y1="50" x2="140" y2="670" />
            <line x1="260" y1="50" x2="260" y2="670" />
            <line x1="380" y1="50" x2="380" y2="670" />
            <line x1="500" y1="50" x2="500" y2="670" />
          </g>

          {/* Detailed India Subcontinent Silhouette */}
          <path
            d="
              M 230 75
              L 260 85
              L 285 105
              L 305 130
              L 330 145
              L 370 170
              L 410 200
              L 470 215
              L 540 220
              L 535 245
              L 490 260
              L 460 280
              L 455 330
              L 420 375
              L 380 430
              L 345 490
              L 325 560
              L 290 620
              L 275 645
              L 260 655
              L 245 640
              L 225 585
              L 200 520
              L 185 450
              L 170 395
              L 155 350
              L 125 320
              L 120 280
              L 150 250
              L 180 210
              L 210 160
              L 205 110
              Z
            "
            fill="url(#indiaLandGrad)"
            stroke="#0284c7"
            strokeWidth="1.5"
            opacity="0.85"
          />

          {/* Sri Lanka Contour */}
          <path
            d="M 315 635 C 330 635 340 650 330 670 C 320 685 305 675 310 650 Z"
            fill="#bae6fd"
            stroke="#0284c7"
            strokeWidth="1.2"
          />

          {/* Coastal Wave Accent Glow */}
          <path
            d="M 125 320 L 155 350 L 170 395 L 185 450 L 200 520 L 225 585 L 260 655 L 290 620 L 325 560 L 380 430 L 455 330"
            fill="none"
            stroke="rgba(2, 132, 199, 0.35)"
            strokeWidth="2.5"
          />

          {/* Flight Routes (Curves) */}
          {ROUTE_PATHS.map((r) => {
            const isSelected = r.id === selectedRoute;
            return (
              <g key={r.id}>
                {/* Background shadow path for visibility */}
                <path
                  d={r.path}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={isSelected ? 6 : 3}
                  strokeLinecap="round"
                />

                {/* Primary Route Path */}
                <path
                  id={`path-${r.id}`}
                  d={r.path}
                  fill="none"
                  stroke={isSelected ? '#0284c7' : '#64748b'}
                  strokeWidth={isSelected ? 3.5 : 1.5}
                  strokeOpacity={isSelected ? 1.0 : 0.4}
                  strokeDasharray={isSelected ? 'none' : '4 3'}
                  filter={isSelected ? 'url(#blueGlow)' : 'none'}
                  cursor="pointer"
                  onClick={() => onRouteChange && onRouteChange(r.id)}
                />

                {/* Animated Aircraft Marker traversing the active route */}
                {isSelected && (
                  <g>
                    <use href="#aircraftIcon">
                      <animateMotion
                        dur="4.5s"
                        repeatCount="indefinite"
                        rotate="auto"
                      >
                        <mpath href={`#path-${r.id}`} />
                      </animateMotion>
                    </use>
                  </g>
                )}
              </g>
            );
          })}

          {/* Airport Beacon Markers and Radar Pulses */}
          {Object.entries(AIRPORT_COORDS).map(([code, ap]) => {
            const isEndpoint = code === origCode || code === destCode;
            return (
              <g
                key={code}
                transform={`translate(${ap.x}, ${ap.y})`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (code !== origCode) {
                    const candidate = `${origCode}-${code}`;
                    if (ROUTE_INFO[candidate] && onRouteChange) {
                      onRouteChange(candidate);
                    }
                  }
                }}
              >
                {/* Outer Radar Pulse Ring */}
                <circle
                  r={isEndpoint ? 16 : 10}
                  fill="none"
                  stroke={isEndpoint ? '#0284c7' : '#0ea5e9'}
                  strokeWidth={1.5}
                  opacity={isEndpoint ? 0.8 : 0.35}
                >
                  <animate
                    attributeName="r"
                    values={isEndpoint ? '10;22;10' : '8;14;8'}
                    dur={isEndpoint ? '2s' : '3s'}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values={isEndpoint ? '0.9;0.1;0.9' : '0.4;0.1;0.4'}
                    dur={isEndpoint ? '2s' : '3s'}
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Core Airport Marker Dot */}
                <circle
                  r={isEndpoint ? 5.5 : 3.5}
                  fill={isEndpoint ? '#0284c7' : '#ffffff'}
                  stroke={isEndpoint ? '#ffffff' : '#0284c7'}
                  strokeWidth={2}
                />

                {/* Airport Text Label */}
                <text
                  x={code === 'BOM' ? -12 : 10}
                  y={code === 'DEL' ? -8 : 4}
                  textAnchor={code === 'BOM' ? 'end' : 'start'}
                  fill={isEndpoint ? '#0f172a' : '#475569'}
                  fontSize={isEndpoint ? '11.5' : '10'}
                  fontWeight={isEndpoint ? '700' : '600'}
                  fontFamily="inherit"
                  letterSpacing="0.02em"
                >
                  {ap.name} ({ap.code})
                </text>
              </g>
            );
          })}
        </svg>

        {/* Embedded Route Floating Telemetry Card */}
        <div className="airspace-route-dock">
          <div className="dock-title-row">
            <span className="dock-orig">{origAirport.name} ({origAirport.code})</span>
            <span className="dock-arrow">⇄</span>
            <span className="dock-dest">{destAirport.name} ({destAirport.code})</span>
          </div>
          <div className="dock-stats-grid">
            <div className="dock-stat">
              <span className="dock-lbl">Distance:</span>
              <span className="dock-val">{activeMeta.dist}</span>
            </div>
            <div className="dock-stat">
              <span className="dock-lbl">Avg Duration:</span>
              <span className="dock-val">{activeMeta.duration}</span>
            </div>
            <div className="dock-stat">
              <span className="dock-lbl">Daily Flights:</span>
              <span className="dock-val">{activeMeta.flights}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Bottom Telemetry Metrics */}
      <div className="airspace-footer-stats">
        <div className="footer-stat-box">
          <span className="stat-icon">✈</span>
          <div>
            <div className="stat-value">450+</div>
            <div className="stat-label">Monitored Routes</div>
          </div>
        </div>
        <div className="footer-stat-box">
          <span className="stat-icon">🏛</span>
          <div>
            <div className="stat-value">6</div>
            <div className="stat-label">Major Airlines</div>
          </div>
        </div>
        <div className="footer-stat-box">
          <span className="stat-icon">📡</span>
          <div>
            <div className="stat-value">Real-Time</div>
            <div className="stat-label">Fare Surveillance</div>
          </div>
        </div>
        <div className="footer-stat-box">
          <span className="stat-icon">🛡</span>
          <div>
            <div className="stat-value">Transparent</div>
            <div className="stat-label">Civil Aviation Data</div>
          </div>
        </div>
      </div>
    </div>
  );
}
