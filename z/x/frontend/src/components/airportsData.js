/**
 * Airport Geographic Data & Monitored Air Corridors
 * Includes geodetic coordinates (lat/lon), IATA codes, airport names,
 * and high-frequency monitored trunk routes across India and regional hubs.
 */

export const AIRPORTS = {
  DEL: {
    code: 'DEL',
    city: 'Delhi',
    fullName: 'Indira Gandhi International Airport',
    lat: 28.5562,
    lon: 77.1000,
    hubType: 'Primary Trunk Mega-Hub',
    elevation: '237m',
    dailyFlights: 1450,
    landmarkImg: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'India Gate & Qutub Minar',
    popularRoutes: ['DEL-BOM', 'DEL-BLR', 'DEL-CCU', 'DEL-HYD', 'DEL-DXB']
  },
  BOM: {
    code: 'BOM',
    city: 'Mumbai',
    fullName: 'Chhatrapati Shivaji Maharaj Intl Airport',
    lat: 19.0896,
    lon: 72.8656,
    hubType: 'Financial Capital Gateway',
    elevation: '11m',
    dailyFlights: 980,
    landmarkImg: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Gateway of India & Bandra-Worli',
    popularRoutes: ['DEL-BOM', 'BOM-BLR', 'BOM-GOI', 'BOM-HYD', 'BOM-DXB']
  },
  BLR: {
    code: 'BLR',
    city: 'Bengaluru',
    fullName: 'Kempegowda International Airport',
    lat: 13.1986,
    lon: 77.7066,
    hubType: 'Silicon Valley Mega-Hub',
    elevation: '915m',
    dailyFlights: 760,
    landmarkImg: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Vidhana Soudha & Tech Corridors',
    popularRoutes: ['DEL-BLR', 'BOM-BLR', 'BLR-HYD', 'BLR-MAA', 'BLR-SIN']
  },
  HYD: {
    code: 'HYD',
    city: 'Hyderabad',
    fullName: 'Rajiv Gandhi International Airport',
    lat: 17.2403,
    lon: 78.4294,
    hubType: 'South-Central Aero Hub',
    elevation: '617m',
    dailyFlights: 540,
    landmarkImg: 'https://images.unsplash.com/photo-1605649487212-47bdab064df8?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Charminar & HITEC City',
    popularRoutes: ['BLR-HYD', 'DEL-HYD', 'BOM-HYD']
  },
  MAA: {
    code: 'MAA',
    city: 'Chennai',
    fullName: 'Chennai International Airport',
    lat: 12.9941,
    lon: 80.1709,
    hubType: 'Eastern Gateway',
    elevation: '16m',
    dailyFlights: 490,
    landmarkImg: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Marina Beach & Central',
    popularRoutes: ['MAA-DEL', 'BLR-MAA', 'MAA-BOM']
  },
  CCU: {
    code: 'CCU',
    city: 'Kolkata',
    fullName: 'Netaji Subhash Chandra Bose Intl Airport',
    lat: 22.6547,
    lon: 88.4467,
    hubType: 'Northeastern Cultural Hub',
    elevation: '5m',
    dailyFlights: 420,
    landmarkImg: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Howrah Bridge & Victoria Memorial',
    popularRoutes: ['DEL-CCU', 'CCU-BOM', 'CCU-BLR']
  },
  AMD: {
    code: 'AMD',
    city: 'Ahmedabad',
    fullName: 'Sardar Vallabhbhai Patel Intl Airport',
    lat: 23.0772,
    lon: 72.6347,
    hubType: 'Western Industrial Hub',
    elevation: '58m',
    dailyFlights: 280,
    landmarkImg: 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Atal Bridge & Sabarmati',
    popularRoutes: ['DEL-AMD', 'BOM-AMD']
  },
  GOI: {
    code: 'GOI',
    city: 'Goa',
    fullName: 'Dabolim / Manohar Intl Airport (Mopa)',
    lat: 15.3808,
    lon: 73.8314,
    hubType: 'Premier Tourism Destination',
    elevation: '56m',
    dailyFlights: 210,
    landmarkImg: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Goa Coastline & Basilica',
    popularRoutes: ['BOM-GOI', 'DEL-GOI', 'BLR-GOI']
  },
  COK: {
    code: 'COK',
    city: 'Kochi',
    fullName: 'Cochin International Airport (Solar)',
    lat: 10.1520,
    lon: 76.3920,
    hubType: '100% Green Solar Gateway',
    elevation: '9m',
    dailyFlights: 190,
    landmarkImg: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Kerala Backwaters & Chinese Nets',
    popularRoutes: ['BLR-COK', 'DEL-COK', 'BOM-COK']
  },
  IXR: {
    code: 'IXR',
    city: 'Ranchi',
    fullName: 'Birsa Munda Airport',
    lat: 23.3143,
    lon: 85.3217,
    hubType: 'Eastern Mineral & Regional Hub',
    elevation: '655m',
    dailyFlights: 75,
    landmarkImg: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Hundru Falls & Ranchi Hills',
    popularRoutes: ['DEL-IXR', 'CCU-IXR']
  },
  DXB: {
    code: 'DXB',
    city: 'Dubai',
    fullName: 'Dubai International Airport',
    lat: 25.2532,
    lon: 55.3657,
    hubType: 'Global Intercontinental Hub',
    elevation: '19m',
    dailyFlights: 1200,
    landmarkImg: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Burj Khalifa & Emirates Skyline',
    popularRoutes: ['DEL-DXB', 'BOM-DXB']
  },
  SIN: {
    code: 'SIN',
    city: 'Singapore',
    fullName: 'Singapore Changi Airport',
    lat: 1.3644,
    lon: 103.9915,
    hubType: 'Southeast Asia Gateway',
    elevation: '22m',
    dailyFlights: 1100,
    landmarkImg: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=300&auto=format&fit=crop&q=80',
    landmarkName: 'Marina Bay Sands & Jewel Changi',
    popularRoutes: ['DEL-SIN', 'BLR-SIN', 'MAA-SIN']
  }
};

export const MONITORED_ROUTES = [
  { id: 'DEL-BOM', origin: 'DEL', destination: 'BOM', name: 'Delhi ⇄ Mumbai', weight: 0.35, distanceKm: 1150, avgDuration: '2h 10m', dailyFlights: 62 },
  { id: 'DEL-BLR', origin: 'DEL', destination: 'BLR', name: 'Delhi ⇄ Bengaluru', weight: 0.25, distanceKm: 1740, avgDuration: '2h 45m', dailyFlights: 48 },
  { id: 'BOM-BLR', origin: 'BOM', destination: 'BLR', name: 'Mumbai ⇄ Bengaluru', weight: 0.15, distanceKm: 840, avgDuration: '1h 35m', dailyFlights: 36 },
  { id: 'DEL-CCU', origin: 'DEL', destination: 'CCU', name: 'Delhi ⇄ Kolkata', weight: 0.15, distanceKm: 1310, avgDuration: '2h 15m', dailyFlights: 32 },
  { id: 'MAA-DEL', origin: 'MAA', destination: 'DEL', name: 'Chennai ⇄ Delhi', weight: 0.10, distanceKm: 1760, avgDuration: '2h 40m', dailyFlights: 28 },
  { id: 'BLR-HYD', origin: 'BLR', destination: 'HYD', name: 'Bengaluru ⇄ Hyderabad', weight: 0.08, distanceKm: 500, avgDuration: '1h 10m', dailyFlights: 24 },
  { id: 'DEL-HYD', origin: 'DEL', destination: 'HYD', name: 'Delhi ⇄ Hyderabad', weight: 0.08, distanceKm: 1260, avgDuration: '2h 05m', dailyFlights: 26 },
  { id: 'BOM-GOI', origin: 'BOM', destination: 'GOI', name: 'Mumbai ⇄ Goa', weight: 0.06, distanceKm: 440, avgDuration: '1h 05m', dailyFlights: 22 },
  { id: 'DEL-DXB', origin: 'DEL', destination: 'DXB', name: 'Delhi ⇄ Dubai (Intl Trunk)', weight: 0.12, distanceKm: 2190, avgDuration: '3h 40m', dailyFlights: 18 }
];
