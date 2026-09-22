import * as THREE from 'three'
import type { City } from './city'

export type WorldEvent =
  | { t: 'logit' }
  | { t: 'beacon'; name: string }
  | { t: 'damage' }
  | { t: 'near' }
  | { t: 'extract' }
  | { t: 'extract-locked' }

type Drone = {
  mesh: THREE.Group
  angle: number
  home: THREE.Vector3
  pos: THREE.Vector3
  cooldown: number
}

type Orb = { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }

type Logit = { mesh: THREE.Mesh; base: number; alive: boolean; wait: number }

export class Entities {
  readonly group = new THREE.Group()
  captured: boolean[]
  extractOpen = false
  private beams: THREE.Mesh[] = []
  private rings: THREE.Mesh[] = []
  private drones: Drone[] = []
  private orbs: Orb[] = []
  private logits: Logit[] = []
  private extractBeam: THREE.Mesh
  private extractRing: THREE.Mesh
  private ray = new THREE.Raycaster()
  private nearestDrone = 999
  private lockedToast = false
  private nearCd = 0
  private aim = new THREE.Vector3()
  private goal = new THREE.Vector3()
  private playerPoint = new THREE.Vector3()
  private stepV = new THREE.Vector3()

  constructor(private city: City) {
    this.captured = city.beacons.map(() => false)
    city.beacons.forEach((beacon, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.3, 0.08, 10, 28),
        new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.9 }),
      )
      ring.position.copy(beacon.position)
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 1.4, 90, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x9be7ff,
          transparent: true,
          opacity: 0.11,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      beam.position.set(beacon.position.x, 45, beacon.position.z)
      this.group.add(ring, beam)
      this.rings.push(ring)
      this.beams.push(beam)
      if (i > 0) this.spawnDrone(beacon.position, i)
    })

    this.extractRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.6, 0.1, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xe7a15a }),
    )
    this.extractRing.position.copy(city.extract)
    this.extractRing.rotation.x = Math.PI / 2
    this.extractBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 1.6, 70, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xe7a15a,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    this.extractBeam.position.set(city.extract.x, city.extract.y + 30, city.extract.z)
    this.extractBeam.visible = false
    this.extractRing.visible = false
    this.group.add(this.extractRing, this.extractBeam)

    this.scatterLogits()
  }

  private spawnDrone(home: THREE.Vector3, salt: number): void {
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.7, roughness: 0.32, emissive: new THREE.Color('#ff6a4a'), emissiveIntensity: 0.35 }),
    )
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.045, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xff8d72 }),
    )
    ring.rotation.x = Math.PI / 2
    group.add(body, ring)
    const pos = home.clone()
    pos.y = 18 + salt
    group.position.copy(pos)
    this.group.add(group)
    this.drones.push({ mesh: group, angle: salt, home: home.clone(), pos, cooldown: 1 + salt })
  }

  private scatterLogits(): void {
    const geo = new THREE.IcosahedronGeometry(0.32, 0)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd7a8,
      emissive: new THREE.Color('#e7a15a'),
      emissiveIntensity: 0.85,
      roughness: 0.3,
      metalness: 0.2,
    })
    let placed = 0
    let guard = 0
    while (placed < 42 && guard < 600) {
      guard++
      const x = CITYRand()
      const z = CITYRand()
      const y = 10 + Math.random() * 22
      if (this.city.insideBuilding(x, z, 2)) continue
      if (Math.hypot(x, z) < 16) continue
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      this.group.add(mesh)
      this.logits.push({ mesh, base: y, alive: true, wait: 0 })
      placed++
    }
  }

  droneDistance(x: number, y: number, z: number): number {
    let best = 999
    for (const drone of this.drones) {
      const d = Math.hypot(drone.pos.x - x, drone.pos.y - y, drone.pos.z - z)
      if (d < best) best = d
    }
    this.nearestDrone = best
    return best
  }

  get closestDrone(): number {
    return this.nearestDrone
  }

  restore(captured: boolean[]): void {
    this.captured = captured.map((v) => v)
    this.extractOpen = this.captured.every(Boolean)
    this.extractBeam.visible = this.extractOpen
    this.extractRing.visible = this.extractOpen
    this.lockedToast = false
    for (const orb of this.orbs) {
      this.group.remove(orb.mesh)
    }
    this.orbs = []
  }

  update(
    dt: number,
    body: { x: number; y: number; z: number; speed: number; invuln: number },
    mission: boolean,
  ): WorldEvent[] {
    const events: WorldEvent[] = []
    const time = performance.now() * 0.001
    this.rings.forEach((ring, i) => {
      const beacon = this.city.beacons[i]
      ring.rotation.y += dt * 0.4
      ring.rotation.z = Math.sin(time + i) * 0.08
      const mat = ring.material as THREE.MeshBasicMaterial
      if (this.captured[i]) mat.color.set('#e7a15a')
      const d = Math.hypot(body.x - beacon.position.x, body.y - beacon.position.y, body.z - beacon.position.z)
      if (!this.captured[i] && mission && d < 6.4) {
        this.captured[i] = true
        events.push({ t: 'beacon', name: beacon.name })
        if (this.captured.every(Boolean)) {
          this.extractOpen = true
          this.extractBeam.visible = true
          this.extractRing.visible = true
        }
      }
    })

    if (this.extractOpen) {
      this.extractRing.rotation.z += dt * 0.6
      const d = Math.hypot(body.x - this.city.extract.x, body.y - this.city.extract.y, body.z - this.city.extract.z)
      if (d < 5.5) events.push({ t: 'extract' })
    } else if (!this.lockedToast) {
      const d = Math.hypot(body.x - this.city.extract.x, body.y - this.city.extract.y, body.z - this.city.extract.z)
      if (d < 6) {
        this.lockedToast = true
        events.push({ t: 'extract-locked' })
      }
    }

    for (const logit of this.logits) {
      if (!logit.alive) {
        logit.wait -= dt
        if (logit.wait <= 0) {
          logit.alive = true
          logit.mesh.visible = true
        }
        continue
      }
      logit.mesh.rotation.y += dt * 1.4
      logit.mesh.position.y = logit.base + Math.sin(time * 1.6 + logit.base) * 0.35
      const d = Math.hypot(body.x - logit.mesh.position.x, body.y + 1 - logit.mesh.position.y, body.z - logit.mesh.position.z)
      if (d < 1.7) {
        logit.alive = false
        logit.wait = 22
        logit.mesh.visible = false
        events.push({ t: 'logit' })
      }
    }

    this.nearCd = Math.max(0, this.nearCd - dt)
    this.playerPoint.set(body.x, body.y + 4, body.z)
    for (const drone of this.drones) {
      drone.angle += dt * 0.35
      this.goal.set(
        drone.home.x + Math.cos(drone.angle) * 14,
        17 + Math.sin(drone.angle * 2) * 2,
        drone.home.z + Math.sin(drone.angle) * 14,
      )
      const dist = drone.pos.distanceTo(this.playerPoint)
      const aggro = mission && dist < 48
      if (aggro) this.goal.copy(this.playerPoint)
      const step = this.stepV.copy(this.goal).sub(drone.pos)
      const len = step.length()
      const max = (aggro ? 11 : 6) * dt
      if (len > 0.001) drone.pos.add(step.multiplyScalar(Math.min(1, max / len)))
      drone.mesh.position.copy(drone.pos)
      drone.mesh.rotation.y += dt
      const mat = (drone.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.25 + Math.sin(time * 2.2 + drone.angle) * 0.12
      if (dist < 1.6 && body.invuln <= 0) events.push({ t: 'damage' })
      else if (dist < 3.3 && dist > 1.7 && body.speed > 18 && this.nearCd <= 0) {
        events.push({ t: 'near' })
        this.nearCd = 1.15
      }

      drone.cooldown -= dt
      if (aggro && dist < 32 && drone.cooldown <= 0 && body.invuln <= 0) {
        const dir = this.aim.copy(this.playerPoint).sub(drone.pos)
        const range = dir.length()
        if (range > 0.001) dir.multiplyScalar(1 / range)
        this.ray.set(drone.pos, dir)
        this.ray.far = range
        const blocked = this.ray.intersectObjects(this.city.solids, false)[0]
        if (!blocked || blocked.distance > range - 1) {
          this.fire(drone.pos, dir)
          drone.cooldown = 2.7
        }
      }
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i]
      orb.life -= dt
      orb.mesh.position.addScaledVector(orb.vel, dt)
      const d = Math.hypot(orb.mesh.position.x - body.x, orb.mesh.position.y - (body.y + 1), orb.mesh.position.z - body.z)
      if (d < 1.15 && body.invuln <= 0) {
        events.push({ t: 'damage' })
        orb.life = 0
      } else if (d < 2.6 && body.speed > 16 && this.nearCd <= 0) {
        events.push({ t: 'near' })
        this.nearCd = 1.15
      }
      if (orb.life <= 0) {
        this.group.remove(orb.mesh)
        this.orbs.splice(i, 1)
      }
    }
    return events
  }

  private fire(from: THREE.Vector3, dir: THREE.Vector3): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb199 }),
    )
    mesh.position.copy(from)
    this.group.add(mesh)
    this.orbs.push({ mesh, vel: dir.clone().multiplyScalar(13), life: 4 })
  }
}

function CITYRand(): number {
  return -300 + Math.random() * 600
}
