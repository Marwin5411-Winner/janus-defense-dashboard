// Performance optimization utilities for high-density vessel tracking

export class VesselPerformanceOptimizer {
  private static instance: VesselPerformanceOptimizer
  private viewportBounds: { west: number; south: number; east: number; north: number } | null = null
  private lastUpdateTime = 0
  private updateThrottleMs = 100 // Throttle updates to 100ms
  private visibleVessels = new Set<string>()

  static getInstance(): VesselPerformanceOptimizer {
    if (!VesselPerformanceOptimizer.instance) {
      VesselPerformanceOptimizer.instance = new VesselPerformanceOptimizer()
    }
    return VesselPerformanceOptimizer.instance
  }

  // Update viewport bounds for culling
  updateViewportBounds(viewport: { longitude: number; latitude: number; zoom: number }) {
    const tileSize = 512
    const scale = Math.pow(2, viewport.zoom)
    const worldSize = tileSize * scale
    
    // Calculate visible bounds (approximate)
    const latDelta = 180 / scale
    const lngDelta = 360 / scale
    
    this.viewportBounds = {
      west: viewport.longitude - lngDelta / 2,
      east: viewport.longitude + lngDelta / 2,
      south: viewport.latitude - latDelta / 2,
      north: viewport.latitude + latDelta / 2
    }
  }

  // Check if vessel is in viewport (with padding)
  isVesselVisible(latitude: number, longitude: number): boolean {
    if (!this.viewportBounds) return true
    
    const padding = 0.5 // 0.5 degree padding
    return (
      latitude >= (this.viewportBounds.south - padding) &&
      latitude <= (this.viewportBounds.north + padding) &&
      longitude >= (this.viewportBounds.west - padding) &&
      longitude <= (this.viewportBounds.east + padding)
    )
  }

  // Throttle updates to maintain 60fps
  shouldUpdate(currentTime: number): boolean {
    if (currentTime - this.lastUpdateTime >= this.updateThrottleMs) {
      this.lastUpdateTime = currentTime
      return true
    }
    return false
  }

  // Level of detail based on zoom level
  getDetailLevel(zoom: number): 'high' | 'medium' | 'low' {
    if (zoom >= 10) return 'high'
    if (zoom >= 6) return 'medium'
    return 'low'
  }

  // Cluster vessels that are very close together at low zoom
  clusterVessels(vessels: any[], zoom: number): any[] {
    // Hard limit - never render more than 200 vessels for performance
    const maxVessels = 200
    let workingVessels = vessels
    
    if (vessels.length > maxVessels) {
      // Prioritize: Military > Dark vessels > Recent > others
      workingVessels = vessels
        .sort((a, b) => {
          const aScore = (a.shipType === 'Military' ? 100 : 0) + (a.isDark ? 50 : 0)
          const bScore = (b.shipType === 'Military' ? 100 : 0) + (b.isDark ? 50 : 0)
          return bScore - aScore
        })
        .slice(0, maxVessels)
    }
    
    if (zoom >= 8) return workingVessels // No clustering at high zoom

    const clusterDistance = zoom < 4 ? 0.5 : 0.2 // degrees
    const clusters = new Map<string, any[]>()

    vessels.forEach(vessel => {
      if (!vessel.latitude || !vessel.longitude) return
      if (isNaN(vessel.latitude) || isNaN(vessel.longitude)) return
      const key = this.getClusterKey(vessel.latitude, vessel.longitude, clusterDistance)
      if (!clusters.has(key)) {
        clusters.set(key, [])
      }
      clusters.get(key)!.push(vessel)
    })

    // Return representative vessels from each cluster
    return Array.from(clusters.values()).map(cluster => {
      if (cluster.length === 1) return cluster[0]
      
      // For multiple vessels in cluster, create a representative
      const avgLat = cluster.reduce((sum, v) => sum + v.latitude, 0) / cluster.length
      const avgLng = cluster.reduce((sum, v) => sum + v.longitude, 0) / cluster.length
      const priorityVessel = cluster.find(v => v.shipType === 'Military') || 
                           cluster.find(v => v.isDark) || 
                           cluster[0]
      
      return {
        ...priorityVessel,
        latitude: avgLat,
        longitude: avgLng,
        _clusterSize: cluster.length,
        _clusteredVessels: cluster
      }
    })
  }

  private getClusterKey(lat: number, lng: number, distance: number): string {
    const gridLat = Math.floor(lat / distance) * distance
    const gridLng = Math.floor(lng / distance) * distance
    return `${gridLat.toFixed(2)},${gridLng.toFixed(2)}`
  }

  // Optimize data transfer for large datasets
  prepareVesselDataForDeckGL(vessels: any[]) {
    return vessels
      .filter(vessel => vessel.latitude && vessel.longitude && !isNaN(vessel.latitude) && !isNaN(vessel.longitude))
      .map(vessel => ({
      id: vessel.id,
      position: [vessel.estimatedLon || vessel.longitude, vessel.estimatedLat || vessel.latitude],
      originalPosition: [vessel.longitude, vessel.latitude],
      vessel: vessel,
      // Pre-calculate styling to avoid runtime computation
      color: this.getVesselColor(vessel),
      radius: this.getVesselRadius(vessel),
      icon: this.getVesselIcon(vessel),
      // Caching flags
      visible: this.isVesselVisible(vessel.latitude, vessel.longitude)
    }))
  }

  private getVesselColor(vessel: any): number[] {
    if (vessel.isDark) {
      return vessel.inCoverage ? [220, 38, 38, 255] : [107, 114, 128, 179] // red-600 or gray-500
    }
    switch (vessel.shipType) {
      case 'Military': return [239, 68, 68, 255]   // red-500
      case 'Commercial': return [34, 197, 94, 255] // green-500
      default: return [234, 179, 8, 255]           // yellow-500
    }
  }

  private getVesselRadius(vessel: any): number {
    if (vessel.isDark && vessel.inCoverage) return 8000 // Larger for suspicious vessels
    if (vessel._clusterSize) return 12000 + (vessel._clusterSize * 1000) // Clustered vessels
    return 4000 // Standard size
  }

  private getVesselIcon(vessel: any): string {
    if (vessel._clusterSize) return `📍${vessel._clusterSize}`
    if (vessel.shipType === 'Military') return '⚓'
    if (vessel.shipType === 'Commercial') return '🚢'
    return '📍'
  }
}

// WebWorker for heavy computations
export class VesselWorker {
  private worker: Worker | null = null

  constructor() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker('/workers/vesselWorker.js')
    }
  }

  async processVessels(vessels: any[], viewport: any): Promise<any[]> {
    return new Promise((resolve) => {
      if (this.worker) {
        this.worker.postMessage({ vessels, viewport })
        this.worker.onmessage = (e) => {
          resolve(e.data)
        }
      } else {
        // Fallback to main thread
        const optimizer = VesselPerformanceOptimizer.getInstance()
        optimizer.updateViewportBounds(viewport)
        const clustered = optimizer.clusterVessels(vessels, viewport.zoom)
        const processed = optimizer.prepareVesselDataForDeckGL(clustered)
        resolve(processed)
      }
    })
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

// Animation utilities for smooth 60fps updates
export class AnimationManager {
  private animationId: number | null = null
  private lastFrameTime = 0
  private targetFps = 60
  private frameInterval = 1000 / this.targetFps

  startAnimation(updateCallback: (deltaTime: number) => void) {
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - this.lastFrameTime
      
      if (deltaTime >= this.frameInterval) {
        updateCallback(deltaTime)
        this.lastFrameTime = currentTime - (deltaTime % this.frameInterval)
      }
      
      this.animationId = requestAnimationFrame(animate)
    }
    
    this.animationId = requestAnimationFrame(animate)
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }
}