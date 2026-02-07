<template>
  <div class="h-full w-full relative">
    <div ref="mapContainer" class="h-full w-full overflow-hidden"></div>
    
    <!-- Loading overlay -->
    <div v-if="loading" class="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center rounded-lg">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p class="mt-2 text-gray-300">Loading vessel data...</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="absolute top-4 right-4 bg-gray-800 bg-opacity-90 p-3 rounded-lg">
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
    <div class="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 p-3 rounded-lg text-xs">
      <div class="font-medium text-white mb-2">Vessel Types</div>
      <div class="space-y-1">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-red-500 rounded-full"></div>
          <span class="text-gray-300">Military</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          <span class="text-gray-300">Commercial</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span class="text-gray-300">Unknown</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useVesselStore } from '~/stores/vessel'
import { getCountryByMMSI } from '~/utils/mmsi'
import { calculateEstimatedPosition } from '~/utils/navigation'
import L from 'leaflet'

const vesselStore = useVesselStore()
const mapContainer = ref(null)
const loading = ref(true)
const autoRefresh = ref(true)

let map = null
let vesselMarkers = []
let refreshInterval = null

const getVesselColor = (vessel) => {
  if (vessel.isDark) {
    return vessel.inCoverage ? '#ff0000' : '#4b5563' // Bright Red if Blackout, Dim Gray if OOR
  }
  switch (vessel.shipType) {
    case 'Military': return '#ef4444' // red
    case 'Commercial': return '#22c55e' // green
    default: return '#eab308' // yellow
  }
}

const getVesselIcon = (vessel) => {
  const color = getVesselColor(vessel)
  const isDark = vessel.isDark ? 'border-dashed opacity-60' : 'border-solid'
  const isSuspicious = vessel.isDark && vessel.inCoverage
  const animation = isSuspicious ? 'animate-ping' : (vessel.isDark ? 'animate-pulse' : '')
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${animation}" style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px ${vessel.isDark ? 'dashed' : 'solid'} white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); opacity: ${vessel.isDark ? 0.7 : 1};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  })
}

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

  // Initialize Leaflet map
  map = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false
  }).setView([10.0, 105.0], 6)

  // Ensure map tiles are recalculated on resize
  setTimeout(() => {
    map.invalidateSize()
  }, 400)

  // Add tile layer (Dark Mode)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  // Custom Zoom Control at bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(map)

  // Add custom styles
  const style = document.createElement('style')
  style.textContent = `
    .leaflet-popup-content-wrapper {
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .custom-div-icon {
      background: transparent;
      border: none;
    }
  `
  document.head.appendChild(style)

  loading.value = false
}

const updateVesselMarkers = () => {
  if (!map) return

  // Clear existing markers and paths
  vesselMarkers.forEach(marker => map.removeLayer(marker))
  vesselMarkers = []

  // Add new markers
  vesselStore.vessels.forEach(vessel => {
    const lat = vessel.estimatedLat || vessel.latitude
    const lon = vessel.estimatedLon || vessel.longitude

    if (lat && lon) {
      const marker = L.marker([lat, lon], {
        icon: getVesselIcon(vessel)
      })
      
      marker.bindPopup(createPopupContent(vessel))
      
      // Add hover effects
      marker.on('mouseover', function() {
        this.openPopup()
      })
      
      // If ghost (dark), draw a line from last known to estimated
      if (vessel.isDark) {
        const polyline = L.polyline([
          [vessel.latitude, vessel.longitude],
          [lat, lon]
        ], {
          color: '#6b7280',
          weight: 1,
          dashArray: '5, 5',
          opacity: 0.5
        }).addTo(map)
        vesselMarkers.push(polyline)
      }

      marker.addTo(map)
      vesselMarkers.push(marker)
    }
  })
}

const refreshData = async () => {
  await vesselStore.fetchVessels()
  updateVesselMarkers()
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
  refreshInterval = setInterval(refreshData, 5000) // Refresh every 5 seconds
}

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

// Watch for vessel data changes
watch(() => vesselStore.vessels, updateVesselMarkers, { deep: true })

// Watch for map focus requests
watch(() => vesselStore.mapFocus, (focus) => {
  if (focus && map) {
    map.flyTo([focus.lat, focus.lon], focus.zoom || 12, {
      duration: 1.5
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
  if (map) {
    map.remove()
  }
})
</script>