# Janus Defense Dashboard

Real-time vessel tracking and defense monitoring system built with Nuxt 4.

## Features

- 🗺️ **Real-time Vessel Tracking** - Interactive map showing vessel positions
- 🎯 **Military Vessel Detection** - Automatic identification of military ships  
- 📊 **Defense Analytics** - Charts and statistics for maritime monitoring
- 🚨 **Alert System** - Real-time notifications for suspicious activities
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Nuxt 4** - Vue.js framework
- **Leaflet** - Interactive mapping
- **Chart.js** - Data visualization
- **Pinia** - State management
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Configuration

Set these environment variables:

```env
NUXT_JANUS_API_URL=http://localhost:3001
NUXT_JANUS_API_KEY=your-api-key
NUXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
NUXT_PUBLIC_REFRESH_INTERVAL=5000
```

## API Integration

Connects to Janus Gateway API for real-time vessel data:
- WebSocket for live updates
- REST API for historical data
- Alert notifications

## License

Defense Technology - Confidential