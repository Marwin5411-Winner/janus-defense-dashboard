import { defineStore } from 'pinia'
import { calculateEstimatedPosition } from '~/utils/navigation'

interface Vessel {
  id: string
  mmsi: number
  name: string
  latitude: number
  longitude: number
  speed: number
  course: number
  shipType: string
  timestamp: string
  isDark?: boolean
  inCoverage?: boolean
  gapMinutes?: number
  estimatedLat?: number
  estimatedLon?: number
}

interface Alert {
  id: string
  type: 'military' | 'zone_breach' | 'suspicious' | 'dark_vessel'
  message: string
  timestamp: string
  vessel?: Vessel
}

interface Activity {
  id: string
  type: 'alert' | 'vessel_detected'
  message: string
  timestamp: string
}

export const useVesselStore = defineStore('vessel', {
  state: () => ({
    vessels: [] as Vessel[],
    alerts: [] as Alert[],
    recentActivity: [] as Activity[],
    isConnected: false,
    websocket: null as WebSocket | null,
    lastUpdate: null as string | null,
    mapFocus: null as { lat: number, lon: number, zoom?: number } | null
  }),

  getters: {
    militaryVessels: (state) => state.vessels.filter(v => v.shipType === 'Military'),
    commercialVessels: (state) => state.vessels.filter(v => v.shipType === 'Commercial'),
    unknownVessels: (state) => state.vessels.filter(v => !v.shipType || v.shipType === 'Unknown'),
    activeAlerts: (state) => state.alerts.filter(a => 
      new Date(a.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
    )
  },

  actions: {
    async fetchVessels() {
      try {
        const { data } = await $fetch<{data: Vessel[]}>('/api/vessels')
        if (data) {
          this.vessels = data.map(v => {
            const est = calculateEstimatedPosition(v.latitude, v.longitude, v.speed, v.course, v.timestamp)
            return {
              ...v,
              estimatedLat: est.lat,
              estimatedLon: est.lon
            }
          })
          this.lastUpdate = new Date().toISOString()
          
          // Detect new dark vessels and add alerts
          data.forEach(v => {
            if (v.isDark && v.gapMinutes && v.gapMinutes > 15 && v.gapMinutes < 20) {
              const existingAlert = this.alerts.find(a => a.vessel?.mmsi === v.mmsi && a.type === 'dark_vessel')
              if (!existingAlert) {
                const alertType = v.inCoverage ? 'CRITICAL BLACKOUT' : 'SIGNAL LOST'
                const severity = v.inCoverage ? 'suspicious' : 'dark_vessel'
                
                this.addAlert({
                  id: `dark-${v.mmsi}-${Date.now()}`,
                  type: severity as any,
                  message: `${alertType}: ${v.name || v.mmsi} (${v.gapMinutes}m gap)`,
                  timestamp: new Date().toISOString(),
                  vessel: v
                })
              }
            }
          })
        }
      } catch (error) {
        console.error('Failed to fetch vessels:', error)
        // Use mock data for demo
        this.generateMockData()
      }
    },

    generateMockData() {
      // Generate realistic mock vessel data for Thailand region
      const mockVessels: Vessel[] = [
        {
          id: '1',
          mmsi: 567000123,
          name: 'HTMS Chakri Naruebet',
          latitude: 13.75,
          longitude: 100.58,
          speed: 12.5,
          course: 135,
          shipType: 'Military',
          timestamp: new Date().toISOString()
        },
        {
          id: '2',
          mmsi: 529000456,
          name: 'MV Bangkok Express',
          latitude: 13.72,
          longitude: 100.55,
          speed: 8.2,
          course: 90,
          shipType: 'Commercial',
          timestamp: new Date().toISOString()
        },
        {
          id: '3',
          mmsi: 416001789,
          name: 'Unknown Vessel',
          latitude: 13.78,
          longitude: 100.52,
          speed: 15.8,
          course: 270,
          shipType: 'Unknown',
          timestamp: new Date().toISOString()
        },
        {
          id: '4',
          mmsi: 567000234,
          name: 'HTMS Naresuan',
          latitude: 13.68,
          longitude: 100.60,
          speed: 10.3,
          course: 45,
          shipType: 'Military',
          timestamp: new Date().toISOString()
        },
        {
          id: '5',
          mmsi: 477000999,
          name: 'Red Sea Explorer',
          latitude: 15.5,
          longitude: 41.2,
          speed: 14.2,
          course: 320,
          shipType: 'Commercial',
          timestamp: new Date().toISOString()
        },
        {
          id: '6',
          mmsi: 477000888,
          name: 'Naval Sentry Red Sea',
          latitude: 12.8,
          longitude: 43.1,
          speed: 22.5,
          course: 180,
          shipType: 'Military',
          timestamp: new Date().toISOString()
        }
      ]

      this.vessels = mockVessels
      this.lastUpdate = new Date().toISOString()
    },

    addAlert(alert: Alert) {
      this.alerts.unshift(alert)
      this.recentActivity.unshift({
        id: alert.id,
        type: 'alert',
        message: alert.message,
        timestamp: alert.timestamp
      })

      // Keep only last 50 alerts and 20 activities
      if (this.alerts.length > 50) {
        this.alerts = this.alerts.slice(0, 50)
      }
      if (this.recentActivity.length > 20) {
        this.recentActivity = this.recentActivity.slice(0, 20)
      }
    },

    initializeConnection() {
      this.isConnected = true
      this.fetchVessels()
      
      // Simulate real-time updates
      setInterval(() => {
        this.fetchVessels()
      }, 10000) // Update every 10 seconds
    },

    updateVesselPositions() {
      // Simulate vessel movement
      this.vessels.forEach(vessel => {
        const deltaLat = (Math.random() - 0.5) * 0.001
        const deltaLon = (Math.random() - 0.5) * 0.001
        
        vessel.latitude += deltaLat
        vessel.longitude += deltaLon
        vessel.speed = Math.max(0, vessel.speed + (Math.random() - 0.5) * 2)
        vessel.course = (vessel.course + (Math.random() - 0.5) * 10) % 360
        vessel.timestamp = new Date().toISOString()
      })

      // Randomly generate alerts
      if (Math.random() < 0.1) { // 10% chance every update
        this.generateRandomAlert()
      }
    },

    generateRandomAlert() {
      const alertTypes = [
        {
          type: 'military' as const,
          message: 'Military vessel detected in monitored zone'
        },
        {
          type: 'zone_breach' as const,
          message: 'Vessel approaching restricted area'
        },
        {
          type: 'suspicious' as const,
          message: 'Suspicious vessel movement pattern detected'
        }
      ]

      const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)]
      
      this.addAlert({
        id: Date.now().toString(),
        type: randomAlert.type,
        message: randomAlert.message,
        timestamp: new Date().toISOString(),
        vessel: this.militaryVessels[0] // Link to first military vessel for demo
      })
    },

    closeConnection() {
      this.isConnected = false
      if (this.websocket) {
        this.websocket.close()
        this.websocket = null
      }
    }
  }
})