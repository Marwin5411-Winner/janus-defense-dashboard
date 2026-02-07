<template>
  <div class="bloomberg-terminal min-h-screen bg-black text-[#ffb000] font-mono selection:bg-[#ffb000] selection:text-black">
    <!-- Top Status Bar (Bloomberg Style) -->
    <header class="border-b border-[#333] px-2 py-1 flex justify-between items-center text-xs bg-[#111]">
      <div class="flex space-x-4">
        <span class="font-bold">JANUS INTELLIGENCE TERMINAL</span>
        <span class="text-white">DATABASE: <span class="text-[#00ff00]">CONNECTED</span></span>
        <span class="text-white">REGION: <span class="text-[#00ff00]">GLOBAL (SE ASIA / RED SEA)</span></span>
      </div>
      <div class="flex space-x-4 items-center">
        <span class="text-[#00ff00] animate-pulse">● LIVE STREAM</span>
        <span class="text-white">{{ currentTime }}</span>
      </div>
    </header>

    <!-- Main Grid Layout -->
    <main class="grid grid-cols-12 h-[calc(100vh-28px)] overflow-hidden">
      
      <!-- Left Sidebar: Watchlist / Alerts -->
      <div class="col-span-3 border-r border-[#333] flex flex-col bg-[#050505]">
        <div class="bg-[#222] text-white text-[10px] px-2 py-0.5 border-b border-[#333]">SIGNIFICANT EVENTS</div>
        <div class="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-1">
          <div v-for="activity in recentActivity" :key="activity.id" 
               @click="focusVessel(activity)"
               class="border-l-2 border-[#333] hover:border-[#ffb000] hover:bg-[#111] p-1 cursor-pointer transition-all group">
            <div class="flex justify-between items-start">
              <span :class="[
                activity.message.includes('LOST') ? 'text-red-600 animate-pulse' :
                activity.type === 'alert' ? 'text-red-500' : 'text-[#00ff00]'
              ]" class="text-[10px] font-bold">
                {{ activity.message.includes('LOST') ? 'DARK' : activity.type === 'alert' ? 'CRITICAL' : 'DETECTED' }}
              </span>
              <span class="text-[#666] text-[9px]">{{ formatTime(activity.timestamp) }}</span>
            </div>
            <p class="text-[11px] text-white leading-tight group-hover:text-[#ffb000]">{{ activity.message }}</p>
          </div>
        </div>
        
        <!-- Market/Stats Bottom Box -->
        <div class="border-t border-[#333] p-2 bg-[#111]">
          <div class="flex justify-between text-[10px] mb-1">
            <span class="text-[#666]">VESSEL COUNT</span>
            <span class="text-white font-bold">{{ vesselCount }}</span>
          </div>
          <div class="flex justify-between text-[10px] mb-1">
            <span class="text-[#666]">MILITARY ASSETS</span>
            <span class="text-red-500 font-bold">{{ militaryVesselCount }}</span>
          </div>
          <div class="flex justify-between text-[10px] mb-1">
            <span class="text-[#666]">DARK VESSELS</span>
            <span class="text-red-600 font-bold animate-pulse">{{ vesselStore.vessels.filter(v => v.isDark).length }}</span>
          </div>
          <div class="flex justify-between text-[10px]">
            <span class="text-[#666]">ACTIVE ALERTS</span>
            <span class="text-[#ffb000] font-bold">{{ alertCount }}</span>
          </div>
        </div>
      </div>

      <!-- Center: Map -->
      <div class="col-span-6 relative border-r border-[#333]">
        <div class="absolute top-0 left-0 z-10 bg-black/80 border-b border-r border-[#333] px-2 py-0.5 text-[10px] text-white">
          SATELLITE POSITIONING: <span class="text-[#ffb000]">ACTIVE</span>
        </div>
        <div class="h-full w-full grayscale contrast-125 brightness-75 hover:grayscale-0 transition-all duration-500">
          <ClientOnly>
            <MapVesselMap />
          </ClientOnly>
        </div>
      </div>

      <!-- Right Sidebar: Data Terminal -->
      <div class="col-span-3 flex flex-col bg-[#050505]">
        <div class="bg-[#222] text-white text-[10px] px-2 py-0.5 border-b border-[#333]">ASSET MONITORING</div>
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <table class="w-full text-left text-[10px]">
            <thead class="sticky top-0 bg-[#111] text-[#666] border-b border-[#333]">
              <tr>
                <th class="px-2 py-1 font-normal">VESSEL / MMSI</th>
                <th class="px-2 py-1 font-normal text-right">KTS</th>
                <th class="px-2 py-1 font-normal text-center">FLAG</th>
                <th class="px-2 py-1 font-normal text-right">TYPE</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#111]">
              <tr v-for="vessel in vesselStore.vessels" :key="vessel.mmsi" 
                  class="hover:bg-[#111] cursor-pointer group"
                  :class="vessel.isDark ? 'bg-red-950/20' : ''"
                  @click="vesselStore.mapFocus = { lat: vessel.estimatedLat || vessel.latitude, lon: vessel.estimatedLon || vessel.longitude, zoom: 14 }">
                <td class="px-2 py-1 truncate max-w-[120px]">
                  <div class="text-white group-hover:text-[#ffb000] flex items-center">
                    <span v-if="vessel.isDark" class="text-red-500 mr-1">⚠️</span>
                    {{ vessel.name || 'UNKNOWN' }}
                  </div>
                  <div class="text-[8px] text-[#444] font-bold tracking-widest">{{ vessel.mmsi }}</div>
                </td>
                <td class="px-2 py-1 text-right font-bold" :class="vessel.isDark ? (vessel.inCoverage ? 'text-red-600 animate-pulse' : 'text-gray-500') : 'text-[#00ff00]'">
                  {{ vessel.isDark ? (vessel.inCoverage ? 'BLACKOUT' : 'O.O.R.') : vessel.speed?.toFixed(1) }}
                </td>
                <td class="px-2 py-1 text-center font-bold text-white bg-white/5">{{ getCountryByMMSI(vessel.mmsi) }}</td>
                <td class="px-2 py-1 text-right" :class="vessel.isDark ? (vessel.inCoverage ? 'text-red-600' : 'text-gray-600') : vessel.shipType === 'Military' ? 'text-red-500' : 'text-[#666]'">
                  {{ vessel.isDark ? (vessel.inCoverage ? 'SUSP' : 'GHOST') : vessel.shipType === 'Military' ? 'MIL' : 'COM' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Bottom Terminal Info -->
        <div class="h-24 border-t border-[#333] bg-black p-2 font-mono text-[9px] text-[#00ff00]">
          <div class="flex items-center space-x-2">
            <span class="text-white">COMMAND ></span>
            <span class="animate-pulse">_</span>
          </div>
          <div class="text-[#444] mt-1">
            [SYS] INGESTING AIS_STREAM_REGION_SEA<br>
            [SYS] POSTGIS_INDEX_GIST_SEARCH_OK<br>
            [SYS] BUFFERING_1000_RECORDS_FLUSH_5S
          </div>
        </div>
      </div>
    </main>

    <!-- Bottom Ticker -->
    <footer class="h-7 border-t border-[#333] bg-[#111] flex items-center px-2 overflow-hidden whitespace-nowrap">
      <div class="flex space-x-8 animate-ticker text-[10px] uppercase font-bold">
        <span v-for="v in vesselStore.vessels.slice(0, 10)" :key="'t-'+v.mmsi">
          {{ v.name || 'VESSEL' }} <span class="text-[#00ff00]">{{ v.latitude?.toFixed(4) }}, {{ v.longitude?.toFixed(4) }}</span>
        </span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { useVesselStore } from '~/stores/vessel'
import { getCountryByMMSI } from '~/utils/mmsi'

const vesselStore = useVesselStore()
const currentTime = ref('')

const formatTime = (ts) => {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('en-US', { hour12: false }) + ' ICT'
}

const focusVessel = (activity) => {
  const alert = vesselStore.alerts.find(a => a.id === activity.id)
  if (alert && alert.vessel) {
    vesselStore.mapFocus = {
      lat: alert.vessel.latitude,
      lon: alert.vessel.longitude,
      zoom: 14
    }
    return
  }
  const vessel = vesselStore.vessels.find(v => 
    activity.message.includes(v.name) || 
    activity.message.includes(v.mmsi.toString())
  )
  if (vessel) {
    vesselStore.mapFocus = {
      lat: vessel.latitude,
      lon: vessel.longitude,
      zoom: 14
    }
  }
}

const vesselCount = computed(() => vesselStore.vessels.length)
const militaryVesselCount = computed(() => vesselStore.vessels.filter(v => v.shipType === 'Military').length)
const alertCount = computed(() => vesselStore.alerts.length)
const recentActivity = computed(() => vesselStore.recentActivity.slice(0, 10))

onMounted(() => {
  vesselStore.initializeConnection()
  updateTime()
  setInterval(updateTime, 1000)
})

onUnmounted(() => {
  vesselStore.closeConnection()
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

.bloomberg-terminal {
  font-family: 'JetBrains Mono', monospace;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #050505;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #ffb000;
}

@keyframes ticker {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

.animate-ticker {
  animation: ticker 30s linear infinite;
}

/* Adjust Leaflet for Bloomberg look */
.leaflet-container {
  background: #000 !important;
  height: 100% !important;
  width: 100% !important;
  z-index: 1;
}
.leaflet-tile-container {
  background: #000 !important;
}
.leaflet-tile {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) !important;
}
</style>