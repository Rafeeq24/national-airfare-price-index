import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/**
 * RealisticEarthAviation: High-Resolution Satellite Night Earth Visualization.
 * Features realistic continental geometry, illuminated Indian city clusters,
 * atmospheric Rayleigh scattering halo, glowing Great-Circle flight arcs,
 * and floating route telemetry card.
 */
export default function RealisticEarthAviation({
  selectedRoute = 'DEL-BOM',
  onRouteChange,
  onOpenModal
}) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const earthGroupRef = useRef(null);
  const animFrameRef = useRef(null);

  // Interaction / Rotation state (calm, stable)
  const isDraggingRef = useRef(false);
  const prevPointerRef = useRef({ x: 0, y: 0 });
  // Initial orientation: Centered on India (Lat: 21°N, Lon: 78°E)
  const rotationRef = useRef({ x: 0.32, y: -1.38 });
  const targetRotationRef = useRef({ x: 0.32, y: -1.38 });

  // 2D Projected labels for airports
  const [airportLabels, setAirportLabels] = useState([]);

  // Major Indian and regional hubs
  const AIRPORTS = {
    DEL: { code: 'DEL', city: 'Delhi', full: "Indira Gandhi Int'l", lat: 28.5562, lon: 77.1000 },
    BOM: { code: 'BOM', city: 'Mumbai', full: "Chhatrapati Shivaji Int'l", lat: 19.0896, lon: 72.8656 },
    BLR: { code: 'BLR', city: 'Bengaluru', full: "Kempegowda Int'l", lat: 13.1986, lon: 77.7066 },
    HYD: { code: 'HYD', city: 'Hyderabad', full: "Rajiv Gandhi Int'l", lat: 17.2403, lon: 78.4294 },
    MAA: { code: 'MAA', city: 'Chennai', full: "Chennai Int'l", lat: 12.9941, lon: 80.1709 },
    CCU: { code: 'CCU', city: 'Kolkata', full: "Netaji Subhash Chandra", lat: 22.6547, lon: 88.4467 },
    AMD: { code: 'AMD', city: 'Ahmedabad', full: 'Sardar Vallabhbhai Patel', lat: 23.0772, lon: 72.6347 },
    GOI: { code: 'GOI', city: 'Goa', full: 'Dabolim / Mopa', lat: 15.3808, lon: 73.8314 },
    COK: { code: 'COK', city: 'Kochi', full: "Cochin Int'l", lat: 10.1520, lon: 76.3920 },
    DXB: { code: 'DXB', city: 'Dubai', full: 'Dubai Int’l', lat: 25.2532, lon: 55.3657 },
    SIN: { code: 'SIN', city: 'Singapore', full: 'Changi Airport', lat: 1.3644, lon: 103.9915 }
  };

  const MONITORED_CORRIDORS = [
    { id: 'DEL-BOM', orig: 'DEL', dest: 'BOM', dist: '1,150 km', duration: '2h 10m', flights: '62 daily' },
    { id: 'DEL-BLR', orig: 'DEL', dest: 'BLR', dist: '1,740 km', duration: '2h 45m', flights: '48 daily' },
    { id: 'BOM-BLR', orig: 'BOM', dest: 'BLR', dist: '840 km', duration: '1h 35m', flights: '36 daily' },
    { id: 'DEL-CCU', orig: 'DEL', dest: 'CCU', dist: '1,310 km', duration: '2h 15m', flights: '32 daily' },
    { id: 'MAA-DEL', orig: 'MAA', dest: 'DEL', dist: '1,760 km', duration: '2h 40m', flights: '28 daily' },
    { id: 'BLR-HYD', orig: 'BLR', dest: 'HYD', dist: '500 km', duration: '1h 10m', flights: '24 daily' },
    { id: 'DEL-HYD', orig: 'DEL', dest: 'HYD', dist: '1,260 km', duration: '2h 05m', flights: '26 daily' },
    { id: 'BOM-GOI', orig: 'BOM', dest: 'GOI', dist: '440 km', duration: '1h 05m', flights: '22 daily' }
  ];

  const activeRouteData = MONITORED_CORRIDORS.find(r => r.id === selectedRoute) || MONITORED_CORRIDORS[0];

  // Convert geodetic lat/lon to 3D Cartesian coordinates
  const latLonToVector3 = useCallback((lat, lon, radius = 1.0) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
  }, []);

  // Compute 3D Quadratic Bézier curve with peak elevation
  const computeFlightArc = useCallback((p1, p2, altitude = 0.2) => {
    const distance = p1.distanceTo(p2);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const normal = mid.clone().normalize();
    const peakAltitude = 1.0 + altitude + distance * 0.15;
    const controlPoint = normal.multiplyScalar(peakAltitude);
    return new THREE.QuadraticBezierCurve3(p1, controlPoint, p2);
  }, []);

  // High-Resolution Procedural Satellite Night Earth Texture (2048 x 1024)
  const generateHighResSatelliteTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 1. Deep space ocean with dark navy gradient & bathymetric depth
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGrad.addColorStop(0, '#030714');
    oceanGrad.addColorStop(0.35, '#050c20');
    oceanGrad.addColorStop(0.65, '#071028');
    oceanGrad.addColorStop(1, '#02050f');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Geodesic latitude & longitude grid (subtle telemetry marks)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
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

    // 3. Landmass fill with terrain gradient (Dark forest, plateau, coastlines)
    const drawPolygon = (coords, fillColor, strokeColor) => {
      ctx.beginPath();
      coords.forEach(([lon, lat], i) => {
        const px = (lon / 360 + 0.5) * canvas.width;
        const py = (-lat / 180 + 0.5) * canvas.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    };

    // India Subcontinent (Detailed high-res contour)
    drawPolygon([
      [68.5, 24], [70.5, 23], [72.2, 21.6], [72.8, 19], [73.5, 16], [74.5, 14.5], [75.5, 11], [77, 8.2],
      [77.8, 8.4], [79.8, 10.5], [80.2, 13], [81.5, 16], [83.5, 18], [86, 20], [87, 21.8],
      [89, 22.5], [91.5, 21], [94, 25], [96.5, 28], [92, 27.5], [88, 27.8], [80, 30.5],
      [75, 33], [74, 35.5], [73, 34], [71, 30], [69, 26], [68.5, 24]
    ], '#0a1738', '#1e3a8a');

    // Sri Lanka
    drawPolygon([[80, 9.8], [81.5, 8.5], [81.8, 6.8], [80.5, 6], [79.5, 7.5], [80, 9.8]], '#0a1738', '#1e3a8a');

    // Arabian Peninsula, Iran, Central Asia
    drawPolygon([[35, 30], [45, 30], [55, 26], [60, 22], [55, 17], [50, 13], [44, 12], [38, 20], [35, 30]], '#08132d', '#172554');
    drawPolygon([[60, 42], [75, 45], [90, 50], [120, 50], [130, 40], [120, 25], [105, 15], [100, 20], [90, 25], [60, 35], [60, 42]], '#08132d', '#172554');

    // Southeast Asia (Indochina, Malaysia, Indonesia)
    drawPolygon([[95, 20], [105, 15], [108, 10], [104, 2], [102, 3], [100, 5], [98, 10], [95, 20]], '#091533', '#1e3a8a');
    drawPolygon([[96, 5], [105, -5], [115, -8], [106, 0], [96, 5]], '#091533', '#1e3a8a');

    // 4. Realistic Night-Time City Illuminations (Golden clusters + radial glow)
    const renderCityCluster = (lon, lat, radius, coreColor = '#ffffff', glowColor = '#f59e0b') => {
      const cx = (lon / 360 + 0.5) * canvas.width;
      const cy = (-lat / 180 + 0.5) * canvas.height;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 8);
      grad.addColorStop(0, coreColor);
      grad.addColorStop(0.2, glowColor);
      grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.35)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 8, 0, Math.PI * 2);
      ctx.fill();

      // Sharp central light points
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    };

    // Major Indian Metropolitan Clusters
    renderCityCluster(77.10, 28.55, 3.2, '#ffffff', '#fef08a'); // Delhi NCR Mega Cluster
    renderCityCluster(72.86, 19.08, 3.0, '#ffffff', '#fef08a'); // Mumbai Coastal Ribbon
    renderCityCluster(77.70, 13.19, 2.5, '#ffffff', '#38bdf8'); // Bengaluru Silicon Corridor
    renderCityCluster(78.42, 17.24, 2.4, '#ffffff', '#38bdf8'); // Hyderabad
    renderCityCluster(80.17, 12.99, 2.2, '#ffffff', '#fef08a'); // Chennai Coast
    renderCityCluster(88.44, 22.65, 2.4, '#ffffff', '#fef08a'); // Kolkata Hub
    renderCityCluster(72.63, 23.07, 1.8, '#ffffff', '#fbbf24'); // Ahmedabad
    renderCityCluster(73.85, 18.52, 1.6, '#ffffff', '#fbbf24'); // Pune
    renderCityCluster(73.83, 15.38, 1.4, '#ffffff', '#38bdf8'); // Goa Coast
    renderCityCluster(76.39, 10.15, 1.5, '#ffffff', '#38bdf8'); // Kochi / Kerala Coast
    renderCityCluster(55.36, 25.25, 2.8, '#ffffff', '#fef08a'); // Dubai
    renderCityCluster(103.99, 1.36, 2.6, '#ffffff', '#38bdf8'); // Singapore

    // Secondary Indian urban nodes (creates realistic national web of light)
    renderCityCluster(75.78, 26.91, 1.2); // Jaipur
    renderCityCluster(80.94, 26.84, 1.3); // Lucknow
    renderCityCluster(80.33, 26.44, 1.1); // Kanpur
    renderCityCluster(85.13, 25.59, 1.2); // Patna
    renderCityCluster(72.83, 21.17, 1.4); // Surat
    renderCityCluster(77.01, 28.45, 1.5); // Gurugram
    renderCityCluster(77.39, 28.53, 1.4); // Noida

    return new THREE.CanvasTexture(canvas);
  };

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 560;

    // 1. Scene & Perspective Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 2.3);
    cameraRef.current = camera;

    // 2. WebGL Renderer with High-DPI support
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Deep Space Background Starfield Particles
    const starCount = 350;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 14;
      starPositions[i + 1] = (Math.random() - 0.5) * 14;
      starPositions[i + 2] = -2 - Math.random() * 6;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.035,
      transparent: true,
      opacity: 0.55
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // 4. Earth Root Group
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    // 5. Earth Sphere with High-Res Satellite Texture
    const earthRadius = 1.0;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTex = generateHighResSatelliteTexture();
    earthTex.anisotropy = 8;

    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.75,
      metalness: 0.25,
      emissive: new THREE.Color(0x060f26),
      emissiveIntensity: 0.7
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // 6. Rayleigh Atmospheric Scattering Halo (Soft Blue Rim Shader)
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.13, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
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
          float intensity = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.6);
          gl_FragColor = vec4(0.2, 0.65, 1.0, 1.0) * intensity * 1.4;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    earthGroup.add(atmoMesh);

    // 7. Cinematic Sunlight Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xbef8fd, 1.7);
    sunLight.position.set(5, 3.5, 5);
    scene.add(sunLight);

    // Sub-groups
    const arcsGroup = new THREE.Group();
    earthGroup.add(arcsGroup);
    const nodesGroup = new THREE.Group();
    earthGroup.add(nodesGroup);
    const planesGroup = new THREE.Group();
    earthGroup.add(planesGroup);

    // 8. Airport Nodes & Beacon Markers
    const trackedPositions = [];
    Object.values(AIRPORTS).forEach(airport => {
      const pos = latLonToVector3(airport.lat, airport.lon, earthRadius * 1.006);
      const isSelected = selectedRoute.includes(airport.code);

      // Central airport beacon
      const beaconGeo = new THREE.SphereGeometry(isSelected ? 0.02 : 0.014, 16, 16);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xfbbf24 : 0x38bdf8
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.copy(pos);
      nodesGroup.add(beaconMesh);

      // Radar Pulse Ring
      const ringGeo = new THREE.RingGeometry(0.022, 0.028, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xf59e0b : 0x0ea5e9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.9 : 0.4
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos.clone().multiplyScalar(1.002));
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      ringMesh.userData = { isPulse: true, isSelected };
      nodesGroup.add(ringMesh);

      trackedPositions.push({ airport, pos });
    });

    // 9. Great-Circle Curved Flight Trajectories
    const movingParticles = [];
    MONITORED_CORRIDORS.forEach(corridor => {
      const a1 = AIRPORTS[corridor.orig];
      const a2 = AIRPORTS[corridor.dest];
      if (!a1 || !a2) return;

      const p1 = latLonToVector3(a1.lat, a1.lon, earthRadius * 1.005);
      const p2 = latLonToVector3(a2.lat, a2.lon, earthRadius * 1.005);
      const curve = computeFlightArc(p1, p2, 0.18);

      const isSelected = corridor.id === selectedRoute;

      // Flight tube
      const tubeGeo = new THREE.TubeGeometry(
        curve,
        64,
        isSelected ? 0.0065 : 0.003,
        8,
        false
      );
      const tubeMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xfbbf24 : 0x0284c7,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.4
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      arcsGroup.add(tubeMesh);

      // Moving photon/aircraft along the arc
      const planeGeo = new THREE.SphereGeometry(isSelected ? 0.016 : 0.011, 12, 12);
      const planeMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffffff : 0xbae6fd
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planesGroup.add(planeMesh);

      movingParticles.push({
        mesh: planeMesh,
        curve,
        progress: Math.random(),
        speed: (isSelected ? 0.0032 : 0.0018)
      });
    });

    // 10. Calm, Controlled Drag Physics (NO dizzying auto-spin)
    const onPointerDown = (e) => {
      isDraggingRef.current = true;
      prevPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevPointerRef.current.x;
      const dy = e.clientY - prevPointerRef.current.y;
      targetRotationRef.current.y += dx * 0.004;
      targetRotationRef.current.x += dy * 0.004;
      // Clamp pitch to keep Indian airspace prominently in frame
      targetRotationRef.current.x = Math.max(-0.6, Math.min(0.85, targetRotationRef.current.x));
      prevPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 11. Subtle Animation Loop (Calm, stable, elegant)
    let pulseAngle = 0;
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      // Ultra-subtle calm drift (very slow, smooth)
      if (!isDraggingRef.current) {
        targetRotationRef.current.y += 0.0003;
      }

      // Smooth damping interpolation
      rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * 0.08;
      rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * 0.08;
      earthGroup.rotation.x = rotationRef.current.x;
      earthGroup.rotation.y = rotationRef.current.y;

      // Animate radar beacon pulse rings
      pulseAngle += 0.04;
      nodesGroup.children.forEach(child => {
        if (child.userData?.isPulse) {
          const s = 1.0 + 0.3 * (Math.sin(pulseAngle) + 1) * 0.5;
          child.scale.set(s, s, 1);
          child.material.opacity = child.userData.isSelected
            ? 0.45 + 0.45 * (1 - (s - 1) / 0.3)
            : 0.15 + 0.25 * (1 - (s - 1) / 0.3);
        }
      });

      // Animate aircraft particles
      movingParticles.forEach(p => {
        p.progress = (p.progress + p.speed) % 1.0;
        const pt = p.curve.getPointAt(p.progress);
        p.mesh.position.copy(pt);
      });

      // Project 3D City Coordinates into 2D Screen Space
      const w = container.clientWidth;
      const h = container.clientHeight;
      const visibleLabels = [];

      trackedPositions.forEach(({ airport, pos }) => {
        const worldPos = pos.clone().applyMatrix4(earthGroup.matrixWorld);
        const screenPos = worldPos.clone().project(camera);
        // Only show if on the visible front hemisphere facing camera
        if (worldPos.dot(camera.position) > 0.42) {
          const x = (screenPos.x * 0.5 + 0.5) * w;
          const y = (-screenPos.y * 0.5 + 0.5) * h;
          visibleLabels.push({
            code: airport.code,
            city: airport.city,
            x,
            y,
            isSelected: selectedRoute.includes(airport.code)
          });
        }
      });
      setAirportLabels(visibleLabels);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      earthTex.dispose();
      starGeometry.dispose();
    };
  }, [latLonToVector3, computeFlightArc, selectedRoute]);

  const [origCode, destCode] = selectedRoute.split('-');
  const origAirport = AIRPORTS[origCode] || AIRPORTS['DEL'];
  const destAirport = AIRPORTS[destCode] || AIRPORTS['BOM'];

  return (
    <div className="realistic-earth-card">
      {/* Top Telemetry Header inside Card */}
      <div className="earth-card-topbar">
        <div className="earth-header-text">
          <div className="earth-radar-pill">SATELLITE SURVEILLANCE RADAR</div>
          <h3 className="earth-heading">Indian Civil Aviation Airspace</h3>
          <p className="earth-subheading">
            Live orthodromic flight corridors across major metropolitan terminals
          </p>
        </div>
        <button
          type="button"
          className="btn-open-explorer-modal"
          onClick={onOpenModal}
          title="Change monitored flight route"
        >
          Explore Routes
        </button>
      </div>

      {/* 3D WebGL Canvas Stage */}
      <div className="earth-canvas-container">
        <div ref={mountRef} className="three-earth-canvas" />

        {/* Dynamic 2D Projected City HUD Labels */}
        <div className="earth-projected-overlay">
          {airportLabels.map((lbl) => (
            <div
              key={lbl.code}
              className={`earth-city-callout ${lbl.isSelected ? 'highlight' : ''}`}
              style={{ left: `${lbl.x}px`, top: `${lbl.y}px` }}
              onClick={() => {
                if (lbl.code !== origCode) {
                  const candidate = `${origCode}-${lbl.code}`;
                  const exists = MONITORED_CORRIDORS.find(r => r.id === candidate);
                  if (exists && onRouteChange) {
                    onRouteChange(candidate);
                  }
                }
              }}
            >
              <span className="callout-dot"></span>
              <span className="callout-text">{lbl.city} ({lbl.code})</span>
            </div>
          ))}
        </div>

        {/* Floating Route Telemetry Card (strictly positioned without obscuring India) */}
        <div className="earth-floating-route-dock">
          <div className="floating-route-header">
            <span className="dock-airport">{origAirport.city} ({origAirport.code})</span>
            <span className="dock-route-arrow">⇄</span>
            <span className="dock-airport">{destAirport.city} ({destAirport.code})</span>
          </div>

          <div className="floating-metrics-row">
            <div className="floating-metric">
              <span className="m-lbl">Distance</span>
              <span className="m-val">{activeRouteData.dist}</span>
            </div>
            <div className="floating-metric">
              <span className="m-lbl">Average Duration</span>
              <span className="m-val">{activeRouteData.duration}</span>
            </div>
            <div className="floating-metric">
              <span className="m-lbl">Active Flights</span>
              <span className="m-val">{activeRouteData.flights}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-view-route-details"
            onClick={onOpenModal}
          >
            View Route Insights →
          </button>
        </div>
      </div>

      {/* 4 Bottom Telemetry Metrics */}
      <div className="earth-footer-metrics-strip">
        <div className="earth-stat-pill">
          <span className="stat-symbol">✈</span>
          <div>
            <div className="stat-num">450+</div>
            <div className="stat-desc">Monitored Routes</div>
          </div>
        </div>
        <div className="earth-stat-pill">
          <span className="stat-symbol">🏛</span>
          <div>
            <div className="stat-num">6</div>
            <div className="stat-desc">Major Airlines</div>
          </div>
        </div>
        <div className="earth-stat-pill">
          <span className="stat-symbol">📡</span>
          <div>
            <div className="stat-num">Real-Time</div>
            <div className="stat-desc">Fare Surveillance</div>
          </div>
        </div>
        <div className="earth-stat-pill">
          <span className="stat-symbol">🛡</span>
          <div>
            <div className="stat-num">Transparent</div>
            <div className="stat-desc">Aviation Index</div>
          </div>
        </div>
      </div>
    </div>
  );
}
