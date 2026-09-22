import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { AIRPORTS, MONITORED_ROUTES } from './airportsData';

/**
 * Photorealistic 3D Globe of India with Glowing Route Arcs,
 * Projected 2D HUD Labels, Real-time Aircraft Pulses, and 360° Free Rotation.
 */
export default function InteractiveGlobe({
  selectedRoute = 'DEL-BOM',
  onSelectRoute,
  onSelectAirport,
  viewConcept = 'concept1' // 'concept1' | 'concept2' | 'concept3'
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const globeGroupRef = useRef(null);
  const arcsGroupRef = useRef(null);
  const nodesGroupRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Projected 2D screen positions for city labels
  const [projectedCities, setProjectedCities] = useState([]);
  const [activeAirport, setActiveAirport] = useState(AIRPORTS['DEL']);
  const [searchQuery, setSearchQuery] = useState('');
  const [globeMode, setGlobeMode] = useState('globe'); // 'map' | 'globe' | 'satellite'
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  // Physics & Camera State
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  // Set initial orientation directly facing the Indian subcontinent (lat: ~20°N, lon: ~78°E)
  const targetRotationRef = useRef({ x: 0.32, y: -1.38 });
  const currentRotationRef = useRef({ x: 0.32, y: -1.38 });
  const zoomRef = useRef(2.15);
  const targetZoomRef = useRef(2.15);
  const autoRotateRef = useRef(true);

  // Lat/Lon to 3D Cartesian coordinates on sphere
  const latLonToVector3 = useCallback((lat, lon, radius = 1.0) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
  }, []);

  // Compute 3D Quadratic Bézier Arc with altitude curve
  const createCurvedFlightArc = useCallback((p1, p2, altitudeOffset = 0.20) => {
    const distance = p1.distanceTo(p2);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const normal = mid.clone().normalize();
    const peakAltitude = 1.0 + altitudeOffset + distance * 0.16;
    const controlPoint = normal.multiplyScalar(peakAltitude);
    return new THREE.QuadraticBezierCurve3(p1, controlPoint, p2);
  }, []);

  // Create High-Fidelity Cyber Earth Texture with India & Asia night lights
  const createCyberEarthTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Deep void space ocean with subtle gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGrad.addColorStop(0, '#040714');
    oceanGrad.addColorStop(0.5, '#070f26');
    oceanGrad.addColorStop(1, '#040714');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Geodesic coordinate grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Landmass fill and glowing neon coastlines
    ctx.fillStyle = '#0a1633';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1.8;

    const drawRegion = (points) => {
      ctx.beginPath();
      points.forEach(([px, py], i) => {
        const x = (px / 360 + 0.5) * canvas.width;
        const y = (-py / 180 + 0.5) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // Detailed India Subcontinent Polygon
    drawRegion([
      [68, 24], [70, 23], [72, 21.5], [72.8, 19], [73.5, 16], [74.5, 14.5], [75.5, 11], [77, 8.2],
      [78, 8.4], [79.8, 10.5], [80.2, 13], [81.5, 16], [83.5, 18], [86, 20], [87, 21.8],
      [89, 22.5], [91.5, 21], [94, 25], [96.5, 28], [92, 27.5], [88, 27.8], [80, 30.5],
      [75, 33], [74, 35.5], [73, 34], [71, 30], [69, 26], [68, 24]
    ]);

    // Sri Lanka
    drawRegion([[80, 9.8], [81.5, 8.5], [81.8, 6.8], [80.5, 6], [79.5, 7.5], [80, 9.8]]);

    // Arabian Peninsula & Middle East
    drawRegion([[35, 30], [45, 30], [55, 26], [60, 22], [55, 17], [50, 13], [44, 12], [38, 20], [35, 30]]);

    // Central & East Asia
    drawRegion([[60, 42], [75, 45], [90, 50], [120, 50], [130, 40], [120, 25], [105, 15], [100, 20], [90, 25], [60, 35], [60, 42]]);

    // Southeast Asia (Myanmar, Thailand, Malaysia, Indonesia, Singapore)
    drawRegion([[95, 20], [105, 15], [108, 10], [104, 2], [102, 3], [100, 5], [98, 10], [95, 20]]);
    drawRegion([[96, 5], [105, -5], [115, -8], [106, 0], [96, 5]]);

    // High-Intensity Urban Clusters (Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata, etc.)
    const drawCityCluster = (lon, lat, intensity = 1, color = '#fbbf24') => {
      const x = (lon / 360 + 0.5) * canvas.width;
      const y = (-lat / 180 + 0.5) * canvas.height;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 14 * intensity);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, color);
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.45)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 14 * intensity, 0, Math.PI * 2);
      ctx.fill();
    };

    drawCityCluster(77.10, 28.55, 2.2, '#fef08a'); // Delhi NCR
    drawCityCluster(72.86, 19.08, 2.0, '#fef08a'); // Mumbai
    drawCityCluster(77.70, 13.19, 1.8, '#38bdf8'); // Bengaluru
    drawCityCluster(78.42, 17.24, 1.6, '#38bdf8'); // Hyderabad
    drawCityCluster(80.17, 12.99, 1.6, '#fef08a'); // Chennai
    drawCityCluster(88.44, 22.65, 1.7, '#fef08a'); // Kolkata
    drawCityCluster(72.63, 23.07, 1.4, '#fbbf24'); // Ahmedabad
    drawCityCluster(73.83, 15.38, 1.2, '#38bdf8'); // Goa
    drawCityCluster(76.39, 10.15, 1.2, '#38bdf8'); // Kochi
    drawCityCluster(55.36, 25.25, 1.8, '#fef08a'); // Dubai
    drawCityCluster(103.99, 1.36, 1.8, '#38bdf8'); // Singapore

    return new THREE.CanvasTexture(canvas);
  };

  // Center Globe smoothly on selected route or airport
  const centerOnLocation = useCallback((lat, lon) => {
    const targetY = -((lon * Math.PI) / 180) - Math.PI / 2;
    const targetX = (lat * Math.PI) / 180 * 0.72;
    targetRotationRef.current = { x: targetX, y: targetY };
    targetZoomRef.current = 2.05;
  }, []);

  // Update center when selected route changes externally
  useEffect(() => {
    const routeObj = MONITORED_ROUTES.find(r => r.id === selectedRoute);
    if (routeObj) {
      const orig = AIRPORTS[routeObj.origin];
      const dest = AIRPORTS[routeObj.destination];
      if (orig && dest) {
        const midLat = (orig.lat + dest.lat) / 2;
        const midLon = (orig.lon + dest.lon) / 2;
        centerOnLocation(midLat, midLon);
        setActiveAirport(orig);
      }
    }
  }, [selectedRoute, centerOnLocation]);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 560;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, zoomRef.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // --- 1. Earth Sphere Mesh ---
    const earthRadius = 1.0;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTexture = createCyberEarthTexture();
    earthTexture.anisotropy = 8;

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.8,
      metalness: 0.2,
      emissive: new THREE.Color(0x050c22),
      emissiveIntensity: 0.65
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    globeGroup.add(earthMesh);

    // --- 2. Outer Atmospheric Glow (Ethereal Blue Rim) ---
    const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.14, 48, 48);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.6);
          gl_FragColor = vec4(0.22, 0.68, 1.0, 1.0) * intensity * 1.5;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    globeGroup.add(atmosphereMesh);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xa5f3fc, 1.6);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    const arcsGroup = new THREE.Group();
    globeGroup.add(arcsGroup);
    arcsGroupRef.current = arcsGroup;

    const nodesGroup = new THREE.Group();
    globeGroup.add(nodesGroup);
    nodesGroupRef.current = nodesGroup;

    const planesGroup = new THREE.Group();
    globeGroup.add(planesGroup);

    // --- 3. Airport Beacons and Radar Rings ---
    const trackedAirportPositions = [];

    Object.values(AIRPORTS).forEach(airport => {
      const pos = latLonToVector3(airport.lat, airport.lon, earthRadius * 1.006);

      const isDelOrBom = airport.code === 'DEL' || airport.code === 'BOM';
      const isSelected = selectedRoute.includes(airport.code);

      // Glowing marker dot
      const beaconGeo = new THREE.SphereGeometry(isDelOrBom ? 0.022 : 0.016, 16, 16);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: isDelOrBom ? 0xfbbf24 : (isSelected ? 0x38bdf8 : 0x0ea5e9)
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.copy(pos);
      beaconMesh.userData = { airport, isAirportNode: true };
      nodesGroup.add(beaconMesh);

      // Radar Pulse Ring
      const ringGeo = new THREE.RingGeometry(0.024, 0.032, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isDelOrBom ? 0xf59e0b : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isDelOrBom ? 0.9 : 0.4
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos.clone().multiplyScalar(1.002));
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      ringMesh.userData = { isPulseRing: true, isDelOrBom };
      nodesGroup.add(ringMesh);

      trackedAirportPositions.push({ airport, position: pos });
    });

    // --- 4. Glowing Great-Circle Flight Arcs & Traveling Aircraft ---
    const activeFlightCurves = [];

    MONITORED_ROUTES.forEach(route => {
      const orig = AIRPORTS[route.origin];
      const dest = AIRPORTS[route.destination];
      if (!orig || !dest) return;

      const p1 = latLonToVector3(orig.lat, orig.lon, earthRadius * 1.005);
      const p2 = latLonToVector3(dest.lat, dest.lon, earthRadius * 1.005);
      const curve = createCurvedFlightArc(p1, p2, 0.19);

      // DEL-BOM is the primary golden glowing trunk corridor
      const isDelBom = route.id === 'DEL-BOM';
      const isCurrentActive = route.id === selectedRoute;

      // Arc tube
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        64,
        isDelBom || isCurrentActive ? 0.007 : 0.0035,
        8,
        false
      );
      const tubeMaterial = new THREE.MeshBasicMaterial({
        color: isDelBom || isCurrentActive ? 0xfbbf24 : 0x0284c7,
        transparent: true,
        opacity: isDelBom || isCurrentActive ? 0.95 : 0.45
      });
      const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
      arcsGroup.add(tubeMesh);

      // Moving photon particle / plane along the arc
      const planeGeo = new THREE.SphereGeometry(isDelBom || isCurrentActive ? 0.016 : 0.011, 12, 12);
      const planeMat = new THREE.MeshBasicMaterial({
        color: isDelBom || isCurrentActive ? 0xffffff : 0x7dd3fc
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planesGroup.add(planeMesh);

      activeFlightCurves.push({
        mesh: planeMesh,
        curve,
        progress: Math.random(),
        speed: (isDelBom ? 0.003 : 0.0018) * (1 / (route.distanceKm / 1000 + 0.5))
      });
    });

    // --- Pointer Drag & Free 360° Orbit Physics ---
    const onPointerDown = (e) => {
      isDraggingRef.current = true;
      autoRotateRef.current = false;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;
      const factor = 0.0045;

      targetRotationRef.current.y += deltaX * factor;
      targetRotationRef.current.x += deltaY * factor;
      // Clamp vertical pitch to avoid polar inversion
      targetRotationRef.current.x = Math.max(-1.4, Math.min(1.4, targetRotationRef.current.x));

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      targetZoomRef.current += e.deltaY * 0.0012;
      targetZoomRef.current = Math.max(1.4, Math.min(3.2, targetZoomRef.current));
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // --- Render Loop with Dynamic 2D Label Projection ---
    let pulseTime = 0;
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Gentle auto-rotation
      if (autoRotateRef.current && isAutoRotating) {
        targetRotationRef.current.y += 0.0008;
      }

      // Smooth inertia damping
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.07;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.07;

      globeGroup.rotation.x = currentRotationRef.current.x;
      globeGroup.rotation.y = currentRotationRef.current.y;

      zoomRef.current += (targetZoomRef.current - zoomRef.current) * 0.07;
      camera.position.z = zoomRef.current;

      // Radar pulses
      pulseTime += 0.04;
      nodesGroup.children.forEach(child => {
        if (child.userData?.isPulseRing) {
          const scale = 1.0 + 0.35 * (Math.sin(pulseTime) + 1) * 0.5;
          child.scale.set(scale, scale, 1);
          child.material.opacity = child.userData.isDelOrBom
            ? 0.5 + 0.45 * (1 - (scale - 1) / 0.35)
            : 0.2 + 0.25 * (1 - (scale - 1) / 0.35);
        }
      });

      // Animate planes along arcs
      activeFlightCurves.forEach(item => {
        item.progress = (item.progress + item.speed) % 1.0;
        const point = item.curve.getPointAt(item.progress);
        item.mesh.position.copy(point);
      });

      // --- Project 3D City Coordinates into 2D Screen Space ---
      const w = container.clientWidth;
      const h = container.clientHeight;
      const projectedList = [];

      trackedAirportPositions.forEach(({ airport, position }) => {
        const worldPos = position.clone().applyMatrix4(globeGroup.matrixWorld);
        const screenPos = worldPos.clone().project(camera);

        // Check if city is on the visible hemisphere facing the camera
        const isFacingCamera = worldPos.dot(camera.position) > 0.45;

        if (isFacingCamera) {
          const x = (screenPos.x * 0.5 + 0.5) * w;
          const y = (-screenPos.y * 0.5 + 0.5) * h;
          projectedList.push({
            code: airport.code,
            city: airport.city,
            fullName: airport.fullName,
            x,
            y,
            isDel: airport.code === 'DEL',
            isBom: airport.code === 'BOM'
          });
        }
      });
      setProjectedCities(projectedList);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      earthTexture.dispose();
    };
  }, [latLonToVector3, createCurvedFlightArc, selectedRoute, isAutoRotating]);

  // Quick Airport Click
  const handleQuickAirport = (code) => {
    const airport = AIRPORTS[code];
    if (!airport) return;
    setActiveAirport(airport);
    centerOnLocation(airport.lat, airport.lon);

    const match = MONITORED_ROUTES.find(r => r.origin === code || r.destination === code);
    if (match && onSelectRoute) {
      onSelectRoute(match.id);
    }
  };

  return (
    <div className="concept-globe-wrapper">
      {/* Top Banner: Explore Airfare Trends Across India */}
      <div className="concept-globe-header">
        <h2 className="concept-explore-title">Explore Airfare Trends Across India</h2>
        <p className="concept-explore-sub">
          Select cities, explore routes and monitor airfare trends in real-time
        </p>
      </div>

      {/* Search Bar & Airport Quick Jump Pills */}
      <div className="concept-search-section">
        <div className="concept-search-bar">
          <svg className="concept-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="concept-search-input"
            placeholder="Search city or airport..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && AIRPORTS[searchQuery]) {
                handleQuickAirport(searchQuery);
              }
            }}
          />
        </div>

        {/* Airport Pills: DEL, BOM, BLR, HYD, MAA, CCU, AMD, GOI, COK, IXR */}
        <div className="concept-airport-pills-row">
          {['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU', 'AMD', 'GOI', 'COK', 'IXR'].map((code) => {
            const isSelected = selectedRoute.includes(code) || activeAirport.code === code;
            return (
              <button
                key={code}
                className={`concept-airport-pill ${isSelected ? 'active' : ''}`}
                onClick={() => handleQuickAirport(code)}
              >
                {code}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3D WebGL Canvas Stage */}
      <div className="concept-globe-stage">
        <div ref={mountRef} className="three-globe-canvas" />

        {/* Top-Right Time & Live Indicator */}
        <div className="globe-top-live-chip">
          <div className="globe-time-display">
            <span className="globe-time-val">Tue, 16 Sep 2026</span>
            <span className="globe-hour-val">14:48 IST</span>
          </div>
          <div className="globe-live-badge">
            <span className="live-dot-green"></span>
            <span>Live Data</span>
          </div>
        </div>

        {/* Top Controls: Map | Globe | Satellite */}
        <div className="globe-top-controls">
          <div className="globe-mode-pill">
            <button
              className={`mode-btn ${globeMode === 'map' ? 'active' : ''}`}
              onClick={() => setGlobeMode('map')}
            >
              Map
            </button>
            <button
              className={`mode-btn ${globeMode === 'globe' ? 'active' : ''}`}
              onClick={() => setGlobeMode('globe')}
            >
              Globe
            </button>
            <button
              className={`mode-btn ${globeMode === 'satellite' ? 'active' : ''}`}
              onClick={() => setGlobeMode('satellite')}
            >
              Satellite
            </button>
          </div>

          {/* Compass Rose */}
          <div className="globe-compass-widget" title="North Reference">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1.2" />
              <polygon points="12 4 14 12 12 10 10 12" fill="#f43f5e" />
              <polygon points="12 20 14 12 12 14 10 12" fill="rgba(255,255,255,0.6)" />
              <text x="12" y="3" fill="#f43f5e" fontSize="5" fontWeight="bold" textAnchor="middle">N</text>
            </svg>
          </div>
        </div>

        {/* Dynamic 2D Projected City Labels overlaid on 3D Globe */}
        <div className="projected-labels-overlay">
          {projectedCities.map((c) => {
            // Prominent labels for Delhi and Mumbai matching the image
            if (c.isDel) {
              return (
                <div
                  key={c.code}
                  className="city-hud-callout delhi"
                  style={{ left: `${c.x}px`, top: `${c.y}px` }}
                >
                  <div className="callout-pointer-dot"></div>
                  <div className="callout-card">
                    <div className="callout-title">Delhi (DEL)</div>
                    <div className="callout-subtitle">Indira Gandhi Int'l Airport</div>
                  </div>
                </div>
              );
            }
            if (c.isBom) {
              return (
                <div
                  key={c.code}
                  className="city-hud-callout mumbai"
                  style={{ left: `${c.x}px`, top: `${c.y}px` }}
                >
                  <div className="callout-pointer-dot"></div>
                  <div className="callout-card">
                    <div className="callout-title">Mumbai (BOM)</div>
                    <div className="callout-subtitle">Chhatrapati Shivaji Int'l</div>
                  </div>
                </div>
              );
            }
            // Other major hubs (Bengaluru, Hyderabad, Chennai, Kolkata, Dubai, Singapore)
            if (['BLR', 'HYD', 'MAA', 'CCU', 'DXB', 'SIN'].includes(c.code)) {
              return (
                <div
                  key={c.code}
                  className="city-label-simple"
                  style={{ left: `${c.x}px`, top: `${c.y}px` }}
                  onClick={() => handleQuickAirport(c.code)}
                >
                  <span className="simple-dot"></span>
                  <span className="simple-name">{c.city}</span>
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Exact Floating Route Card (DEL ↔ BOM) matching the image */}
        <div className="floating-route-info-card">
          <div className="route-card-title-row">
            <span className="route-head-code">DEL</span>
            <span className="route-head-arrow">↔</span>
            <span className="route-head-code">BOM</span>
          </div>
          <div className="route-card-city-names">
            <span>Delhi</span>
            <span>Mumbai</span>
          </div>

          <div className="route-card-metrics-grid">
            <div className="route-metric-item">
              <span className="metric-label">Distance</span>
              <span className="metric-value">1,150 km</span>
            </div>
            <div className="route-metric-item">
              <span className="metric-label">Avg. Duration</span>
              <span className="metric-value">2h 10m</span>
            </div>
            <div className="route-metric-item">
              <span className="metric-label">Active Flights</span>
              <span className="metric-value">62 daily</span>
            </div>
          </div>

          <button
            className="btn-view-route-insights"
            onClick={() => {
              if (onSelectRoute) onSelectRoute('DEL-BOM');
            }}
          >
            View Route Insights →
          </button>
        </div>

        {/* Zoom Controls at bottom right */}
        <div className="globe-zoom-controls">
          <button
            className="zoom-btn"
            onClick={() => {
              targetZoomRef.current = Math.max(1.4, targetZoomRef.current - 0.25);
            }}
            title="Zoom In"
          >
            +
          </button>
          <button
            className="zoom-btn"
            onClick={() => {
              targetZoomRef.current = Math.min(3.2, targetZoomRef.current + 0.25);
            }}
            title="Zoom Out"
          >
            −
          </button>
        </div>

        {/* Watermark: Connecting India Through Data with Tricolor Ribbon */}
        <div className="globe-watermark-branding">
          <span className="watermark-text">Connecting India through Data</span>
          <div className="watermark-tiranga-strip"></div>
        </div>
      </div>

      {/* 4 Bottom Feature Pills matching Concept 1 & 2 */}
      <div className="concept-bottom-stats-row">
        <div className="bottom-stat-card">
          <div className="stat-card-icon">✈️</div>
          <div>
            <div className="stat-card-num">450+</div>
            <div className="stat-card-label">Monitored Routes</div>
          </div>
        </div>

        <div className="bottom-stat-card">
          <div className="stat-card-icon">📊</div>
          <div>
            <div className="stat-card-num">6</div>
            <div className="stat-card-label">Major Airlines</div>
          </div>
        </div>

        <div className="bottom-stat-card">
          <div className="stat-card-icon">📡</div>
          <div>
            <div className="stat-card-num">Real-time</div>
            <div className="stat-card-label">Fare Surveillance</div>
          </div>
        </div>

        <div className="bottom-stat-card">
          <div className="stat-card-icon">🛡️</div>
          <div>
            <div className="stat-card-num">More Transparent</div>
            <div className="stat-card-label">Air Travel for India</div>
          </div>
        </div>
      </div>
    </div>
  );
}
