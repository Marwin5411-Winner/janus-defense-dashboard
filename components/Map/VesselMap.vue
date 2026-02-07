<template>
  <div class="h-full w-full relative">
    <div ref="mapContainer" class="h-full w-full overflow-hidden absolute inset-0"></div>
    
    <!-- Loading overlay -->
    <div v-if="loading" class="absolute inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center rounded-lg">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p class="mt-2 text-gray-300">Loading vessel data...</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="absolute top-4 right-4 z-50 bg-gray-800 bg-opacity-90 p-3 rounded-lg">
      <div class="flex items-center space-x-2">
        <button @click="toggleAutoRefresh" 
                :class="autoRefresh ? 'bg-green-600' : 'bg-gray-600'"
                class="px-3 py-1 text-xs rounded text-white hover:opacity-80">
          {{ autoRefresh ? 'Auto ON' : 'Auto OFF' }}
        </button>
        <button @click="refreshData" 
                class="px-3 py-1 text-xs bg-blue-600 rounded text-white hover:bg-blue-700">
          Refresh
        </button>
      </div>
    </div>

    <!-- Legend -->
    <div class="absolute bottom-4 left-4 z-50 bg-gray-800 bg-opacity-90 p-3 rounded-lg text-xs">
      <div class="font-medium text-white mb-2">Vessel Types</div>
      <div class="space-y-1">
        <div class="flex items-center space-x-2">
          <!-- Military uses IconLayer (Triangle) -->
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2L2 22h20L12 2z"/></svg>
          <span class="text-gray-300">Military (Icon)</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          <span class="text-gray-300">Commercial</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span class="text-gray-300">Unknown</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-3 h-1 bg-red-600 border border-red-900"></div>
          <span class="text-gray-300">Ghost Trail</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useVesselStore } from '~/stores/vessel'
import { getCountryByMMSI } from '~/utils/mmsi'
import { VesselPerformanceOptimizer } from '~/utils/performance'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { IconLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers'

const vesselStore = useVesselStore()
const mapContainer = ref(null)
const loading = ref(true)
const autoRefresh = ref(true)

let map = null
let deckOverlay = null
let refreshInterval = null
let performanceOptimizer = null
let currentViewState = null

// SVG Data URI for Military Vessel (Red Triangle)
const MILITARY_ICON_URL = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23ef4444"%3E%3Cpath d="M12 2L2 22h20L12 2z"/%3E%3Cpath d="M12 6l-6 12h12L12 6z" fill="black" opacity="0.3"/%3E%3C/svg%3E';

const createPopupContent = (vessel) => {
  let statusInfo = ''
  if (vessel.isDark) {
    if (vessel.inCoverage) {
      statusInfo = `<div class="text-red-600 font-bold animate-pulse mt-1 border border-red-900 p-1 bg-red-950/20">🚨 CONFIRMED BLACKOUT (SUSPICIOUS)</div>`
    } else {
      statusInfo = `<div class="text-gray-500 font-bold mt-1">📡 SIGNAL RANGE EXCEEDED (O.O.R.)</div>`
    }
  }
    
  return `
    <div class="p-2 min-w-[200px] bg-black text-amber-500 font-mono">
      <div class="flex justify-between items-start border-b border-amber-900 pb-1 mb-1">
        <h3 class="font-bold">${vessel.name || 'Unknown Vessel'}</h3>
        <span class="bg-amber-500 text-black text-[10px] px-1 font-bold">${getCountryByMMSI(vessel.mmsi)}</span>
      </div>
      <p class="text-xs">MMSI: ${vessel.mmsi}</p>
      <p class="text-xs">TYPE: ${vessel.shipType || 'Unknown'}</p>
      <p class="text-xs font-bold text-[#00ff00]">SPD: ${vessel.speed?.toFixed(1) || 0} KTS | HDG: ${vessel.course || 0}°</p>
      ${statusInfo}
      <p class="text-[10px] text-gray-500 mt-2 border-t border-[#111] pt-1 uppercase">LAST SEEN: ${new Date(vessel.timestamp).toLocaleString()}</p>
    </div>
  `
}

const initializeMap = () => {
  if (!mapContainer.value) return

  // Initialize performance optimizer
  performanceOptimizer = VesselPerformanceOptimizer.getInstance()

  // Initialize MapLibre map
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        'dark-tiles': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors © CARTO'
        }
      },
      layers: [
        {
          id: 'dark-tiles-layer',
          type: 'raster',
          source: 'dark-tiles',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    },
    center: [105.0, 10.0],
    zoom: 6,
    pitch: 0,
    bearing: 0
  })

  // Initialize Deck.gl overlay (interleaved mode - renders into MapLibre's WebGL context)
  deckOverlay = new MapboxOverlay({
    interleaved: true,
    layers: []
  })

  // Add deck.gl overlay as a MapLibre control
  map.addControl(deckOverlay)

  // Track view state changes
  map.on('move', () => {
    const center = map.getCenter()
    currentViewState = {
      longitude: center.lng,
      latitude: center.lat,
      zoom: map.getZoom()
    }
    performanceOptimizer.updateViewportBounds(currentViewState)
  })

  // Wait for map to load
  map.on('load', () => {
    console.log('MapLibre base map loaded')
    loading.value = false
    updateVesselLayers()
  })
}

const updateVesselLayers = () => {
  if (!deckOverlay) return

  // Get current zoom for Level of Detail (LOD)
  const zoom = currentViewState ? currentViewState.zoom : 6

  // Cluster and optimize data
  const clusteredVessels = performanceOptimizer.clusterVessels(vesselStore.vessels, zoom)
  const vesselData = performanceOptimizer.prepareVesselDataForDeckGL(clusteredVessels)

  if (!vesselData || vesselData.length === 0) {
    console.log('No vessel data to render')
    deckOverlay.setProps({ layers: [] })
    return
  }

  console.log(`Updating layers with ${vesselData.length} vessels at zoom ${zoom}`)

  // Split data for different layers
  const militaryVessels = vesselData.filter(d => d.vessel && d.vessel.shipType === 'Military')
  const otherVessels = vesselData.filter(d => d.vessel && d.vessel.shipType !== 'Military')

  // 1. IconLayer for Military Vessels
  const militaryLayer = new IconLayer({
    id: 'military-vessels',
    data: militaryVessels,
    pickable: true,
    iconAtlas: MILITARY_ICON_URL,
    iconMapping: {
      marker: { x: 0, y: 0, width: 24, height: 24, mask: false }
    },
    getIcon: d => 'marker',
    getSize: 32,
    getPosition: d => d.position,
    onClick: (info) => {
      if (info.object) {
        showVesselPopup(info.object.vessel, info.coordinate)
      }
    },
    updateTriggers: {
      getPosition: [vesselStore.lastUpdate]
    }
  })

  // 2. ScatterplotLayer for Commercial/Unknown
  const commercialLayer = new ScatterplotLayer({
    id: 'commercial-vessels',
    data: otherVessels,
    pickable: true,
    opacity: 0.8,
    stroked: true,
    filled: true,
    radiusScale: 1,
    radiusMinPixels: 4,
    radiusMaxPixels: 12,
    lineWidthMinPixels: 1,
    getPosition: d => {
      if (!d.position || d.position.some(isNaN)) {
        console.warn('Invalid position for vessel:', d)
        return [0, 0]
      }
      return d.position
    },
    getRadius: d => d.radius || 5,
    getFillColor: d => d.color || [0, 255, 0],
    getLineColor: [255, 255, 255],
    getLineWidth: 1,
    onClick: (info) => {
      if (info.object) {
        showVesselPopup(info.object.vessel, info.coordinate)
      }
    },
    updateTriggers: {
      getFillColor: [vesselStore.lastUpdate],
      getPosition: [vesselStore.lastUpdate]
    }
  })

  // 3. PathLayer for Ghost Trails
  const pathData = vesselStore.vessels
    .filter(v => v.isDark)
    .map(vessel => ({
      path: [[vessel.longitude, vessel.latitude], [vessel.estimatedLon || vessel.longitude, vessel.estimatedLat || vessel.latitude]],
      color: vessel.inCoverage ? [220, 38, 38, 200] : [107, 114, 128, 150]
    }))

  const pathLayer = new PathLayer({
    id: 'dark-vessel-paths',
    data: pathData,
    pickable: false,
    widthScale: 1,
    widthMinPixels: 2,
    getPath: d => d.path,
    getColor: d => d.color,
    getWidth: 2
  })

  // Update deck.gl layers via overlay
  deckOverlay.setProps({
    layers: [pathLayer, commercialLayer, militaryLayer]
  })
}

const showVesselPopup = (vessel, coordinate) => {
  if (!map) return

  // Remove existing popup
  const existingPopup = document.querySelector('.maplibregl-popup')
  if (existingPopup) {
    existingPopup.remove()
  }

  // Create new popup
  new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    className: 'bloomberg-popup'
  })
    .setLngLat(coordinate)
    .setHTML(createPopupContent(vessel))
    .addTo(map)
}

const refreshData = async () => {
  await vesselStore.fetchVessels()
  updateVesselLayers()
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const startAutoRefresh = () => {
  refreshInterval = setInterval(refreshData, 5000)
}

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

// Watch for vessel data changes
watch(() => vesselStore.vessels, updateVesselLayers, { deep: true })

// Watch for map focus requests
watch(() => vesselStore.mapFocus, (focus) => {
  if (focus && map) {
    map.flyTo({
      center: [focus.lon, focus.lat],
      zoom: focus.zoom || 12,
      duration: 1500
    })
  }
})

onMounted(async () => {
  await nextTick()
  initializeMap()
  await refreshData()
  
  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
  if (deckOverlay) {
    deckOverlay.setProps({ layers: [] })
  }
  if (map) {
    map.remove()
  }
})
</script>

<style>
.maplibregl-popup-content {
  background: black !important;
  border: 1px solid #333 !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
}

.maplibregl-popup-close-button {
  color: #ffb000 !important;
  font-size: 16px !important;
  font-weight: bold !important;
}

.maplibregl-popup-tip {
  background: black !important;
  border: 1px solid #333 !important;
}

/* Hide default MapLibre attribution */
.maplibregl-ctrl-attrib {
  display: none !important;
}
</style>