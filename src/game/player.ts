import * as THREE from 'three'
import type { AudioBus } from './audio'
import type { Anchor, City } from './city'
import { CITY } from './city'
import type { Hero, HeroPose } from './hero'
import { angDiff, clamp, dampAngle } from './math'
import type { FrameInput } from './input'

const CHEST = 1.02
const GRAVITY = 30
const RUN = 7.6
const AIR = 14
const JUMP = 9.2
const ROPE_MIN = 8
const ROPE_MAX = 72
const MAX_SPEED = 74

export type PlayerFrame = {
  slung: boolean
  hardLand: boolean
  attached: boolean
}

export class Player {
  readonly pos = new THREE.Vector3()
  readonly vel = new THREE.Vector3()
  yaw = Math.PI
  grounded = true
  swinging = false
  zipping = false
  diving = false
  readonly anchor = new THREE.Vector3()
  anchorId = -1
  rope = 20
  preview: Anchor | null = null
  whiff = 0
  invuln = 0
  sinceBottom = 10
  private prevVy = 0
  private coyote = 0
  private jumpLock = 0
  private wallLock = 0
  private catch = 0
  private airGrace = 0
  private ray = new THREE.Raycaster()
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private assist = new THREE.Vector3()
  private chestV = new THREE.Vector3()
  private wish = new THREE.Vector3()
  private top: { a: Anchor; s: number }[] = []

  constructor(spawn: THREE.Vector3) {
    this.pos.copy(spawn)
  }

  get speed(): number {
    return this.vel.length()
  }

  get slingWindow(): boolean {
    if (!this.swinging || this.speed < 11) return false
    if (this.chest().y > this.anchor.y - 1.5) return false
    if (this.vel.y < 0 && this.vel.y > -9) return true
    return this.sinceBottom < 0.28
  }

  settle(): void {
    this.vel.set(0, 0, 0)
    this.swinging = false
    this.zipping = false
    this.diving = false
    this.grounded = true
    this.anchorId = -1
  }

  reset(spawn: THREE.Vector3): void {
    this.pos.copy(spawn)
    this.vel.set(0, 0, 0)
    this.grounded = true
    this.swinging = false
    this.zipping = false
    this.diving = false
    this.whiff = 0
    this.invuln = 0
    this.catch = 0
    this.airGrace = 0
    this.yaw = Math.PI
  }

  hit(): void {
    this.release(false, null)
    this.invuln = 1.7
    this.vel.y = Math.max(this.vel.y, 6)
    this.diving = false
  }

  update(
    dt: number,
    input: FrameInput,
    camYaw: number,
    lookDir: THREE.Vector3,
    city: City,
    hero: Hero,
    audio: AudioBus,
  ): PlayerFrame {
    const flags: PlayerFrame = { slung: false, hardLand: false, attached: false }
    if (this.invuln > 0) this.invuln -= dt
    if (this.whiff > 0) this.whiff -= dt
    if (this.jumpLock > 0) this.jumpLock -= dt
    if (this.wallLock > 0) this.wallLock -= dt
    if (this.catch > 0) this.catch -= dt
    if (this.airGrace > 0) this.airGrace -= dt

    this.preview = this.findAnchor(lookDir, city)
    if (input.swingDown) {
      const choice = this.preview
      if (choice) {
        this.attach(choice, lookDir)
        flags.attached = true
        audio.attach()
      } else if (!this.grounded) {
        this.whiff = 0.28
        audio.whiff()
      }
    }
    if (input.zip) this.tryZip(lookDir, audio)
    if (input.jump) this.tryJump()

    let left = dt
    let first = true
    const step = 1 / 90
    while (left > 0.0001) {
      const h = Math.min(step, left)
      this.integrate(h, input, camYaw, city, flags, audio, first ? input.wheel : 0)
      first = false
      left -= h
    }

    if (this.swinging && this.prevVy < 0 && this.vel.y >= 0) this.sinceBottom = 0
    else this.sinceBottom += dt
    this.prevVy = this.vel.y

    if (!input.swingHeld && this.swinging && !this.zipping && !input.swingDown) {
      if (this.release(true, audio)) flags.slung = true
    }

    this.face(dt)
    this.pose(hero, camYaw)
    city.nudgeCars(this.pos, this.vel, this.grounded)
    return flags
  }

  private tryJump(): void {
    if (this.grounded || this.coyote > 0) {
      this.vel.y = JUMP
      this.grounded = false
      this.coyote = 0
      this.jumpLock = 0.16
      if (this.swinging) this.release(false, null)
    }
  }

  private tryZip(lookDir: THREE.Vector3, audio: AudioBus): void {
    if (this.swinging) {
      this.zipping = true
      audio.zip()
      return
    }
    if (this.wallLock > 0.2) return
    const horiz = this.tmp.set(lookDir.x, 0, lookDir.z)
    if (horiz.lengthSq() < 1e-4) horiz.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    horiz.normalize()
    this.vel.x += horiz.x * 16
    this.vel.z += horiz.z * 16
    this.vel.y = Math.max(this.vel.y, 3)
    this.grounded = false
    this.wallLock = 0.45
    audio.zip()
  }

  private attach(choice: Anchor, lookSafe: THREE.Vector3): void {
    this.anchor.copy(choice.point)
    this.anchorId = choice.buildingId
    this.swinging = true
    this.zipping = false
    this.diving = false
    const flat = Math.hypot(lookSafe.x, lookSafe.z) || 1
    this.pos.x += (lookSafe.x / flat) * 0.4
    this.pos.z += (lookSafe.z / flat) * 0.4
    this.pos.y += 0.3
    const hung = this.chest().distanceTo(this.anchor)
    this.rope = clamp(hung, ROPE_MIN, ROPE_MAX)
    const hs = Math.hypot(this.vel.x, this.vel.z)
    if (hs < 4.5) {
      const add = 4.5 - hs
      this.vel.x += (lookSafe.x / flat) * add
      this.vel.z += (lookSafe.z / flat) * add
    }
    this.grounded = false
    this.jumpLock = 0.28
    this.catch = 0.16
    this.airGrace = 0.7
  }

  private release(score: boolean, audio: AudioBus | null): boolean {
    if (!this.swinging) return false
    const perfect = score && this.slingWindow
    if (perfect) {
      const fromFall = this.vel.y < 0 ? clamp(1 + this.vel.y / 9, 0, 1) : 0
      const fromRise = 1 - clamp(this.sinceBottom / 0.28, 0, 1)
      const closeness = Math.max(fromFall, this.vel.y >= 0 ? fromRise : fromFall)
      const boost = 1.22 + closeness * 0.24
      this.vel.multiplyScalar(boost)
      this.vel.y = Math.max(this.vel.y, 2 + closeness * 3)
    }
    this.swinging = false
    this.zipping = false
    this.anchorId = -1
    audio?.release(perfect)
    return perfect
  }

  private integrate(
    dt: number,
    input: FrameInput,
    camYaw: number,
    city: City,
    flags: PlayerFrame,
    audio: AudioBus,
    wheel: number,
  ): void {
    const fwdX = Math.sin(camYaw)
    const fwdZ = Math.cos(camYaw)
    const rightX = -Math.cos(camYaw)
    const rightZ = Math.sin(camYaw)
    this.wish.set(rightX * input.moveX + fwdX * input.moveY, 0, rightZ * input.moveX + fwdZ * input.moveY)
    const wishLen = this.wish.length()
    if (wishLen > 1) this.wish.multiplyScalar(1 / wishLen)

    if (this.swinging) {
      this.vel.y -= GRAVITY * dt
      const chest = this.chest()
      const offset = this.tmp.copy(chest).sub(this.anchor)
      let dist = offset.length()
      const n = dist > 0.001 ? offset.multiplyScalar(1 / dist) : offset.set(0, -1, 0)
      let reel = 0
      if (this.catch <= 0) {
        if (input.moveY > 0.2) reel += 22
        if (input.moveY < -0.2) reel -= 16
      }
      if (wheel > 0) reel -= 18
      if (wheel < 0) reel += 18
      if (this.zipping) reel += 48
      if (this.catch > 0 && dist + 0.2 < this.rope) reel += 24
      this.rope = clamp(this.rope - reel * dt, ROPE_MIN, ROPE_MAX)
      const radial = this.vel.dot(n)
      if (radial > 0 && dist >= this.rope - 0.2) this.vel.addScaledVector(n, -radial)
      const side = this.tmp2.set(rightX, 0, rightZ).projectOnPlane(n)
      if (side.lengthSq() > 1e-6) {
        side.normalize()
        this.vel.addScaledVector(side, input.moveX * 18 * dt)
      }
      if (this.zipping && this.rope <= ROPE_MIN + 0.15) {
        const travel = this.assist.set(this.vel.x, 0, this.vel.z)
        if (travel.lengthSq() < 4) travel.set(fwdX, 0, fwdZ)
        if (travel.lengthSq() > 0.01) {
          travel.normalize()
          this.vel.addScaledVector(travel, 14)
        }
        this.vel.y = Math.max(this.vel.y, 6)
        this.release(false, null)
      }
    } else {
      this.vel.y -= (input.dive && !this.grounded ? 52 : GRAVITY) * dt
      this.diving = input.dive && !this.grounded
      if (this.diving) {
        this.vel.x += fwdX * 10 * dt
        this.vel.z += fwdZ * 10 * dt
      }
      if (this.grounded) {
        const rate = 1 - Math.exp(-14 * dt)
        this.vel.x += (this.wish.x * RUN - this.vel.x) * rate
        this.vel.z += (this.wish.z * RUN - this.vel.z) * rate
      } else if (wishLen > 0.05) {
        this.vel.x += this.wish.x * AIR * dt
        this.vel.z += this.wish.z * AIR * dt
      }
    }

    this.pos.addScaledVector(this.vel, dt)
    this.keepInside()
    this.constrainRope()
    this.collide(city, flags, audio)
    this.constrainRope()
    this.ground(dt, city, flags, audio)

    const sp = this.speed
    if (sp > MAX_SPEED) this.vel.multiplyScalar(MAX_SPEED / sp)
    if (!Number.isFinite(this.vel.x) || !Number.isFinite(this.pos.x)) {
      this.vel.set(0, 0, 0)
    }
  }

  private ground(dt: number, city: City, flags: PlayerFrame, audio: AudioBus): void {
    const origin = this.tmp.set(this.pos.x, this.pos.y + 3.2, this.pos.z)
    this.ray.set(origin, this.tmp2.set(0, -1, 0))
    this.ray.far = 10
    const hits = this.ray.intersectObjects(city.solids, false)
    let groundY = hits.length ? hits[0].point.y : 0
    if (this.pos.y < 0) groundY = Math.max(groundY, 0)
    const gap = this.pos.y - groundY
    const was = this.grounded
    if (gap < 0 || (gap < 0.04 && this.vel.y < 0)) {
      this.pos.y = groundY + 0.04
      if (this.vel.y < 0) {
        if (this.swinging) this.skimStreet(audio)
        else if (this.jumpLock <= 0) {
          if (this.vel.y < -32) flags.hardLand = true
          this.vel.y = 0
          this.grounded = true
          this.diving = false
        } else {
          this.vel.y = 0
        }
      }
    } else if (!this.swinging && this.jumpLock <= 0 && this.vel.y <= 2 && gap < 0.45) {
      if (this.vel.y < -32) flags.hardLand = true
      this.pos.y = groundY + 0.04
      this.vel.y = 0
      this.grounded = true
      this.diving = false
    } else if (!this.swinging && gap > 0.55) {
      this.grounded = false
    }
    if (was && !this.grounded && this.vel.y <= 0) this.coyote = 0.12
    if (!this.grounded && this.coyote > 0) this.coyote -= dt
  }

  private skimStreet(audio: AudioBus): void {
    const impact = -this.vel.y
    const horiz = Math.hypot(this.vel.x, this.vel.z)
    if (impact < 3.5 && horiz < 7) {
      this.vel.y = 0
      this.release(false, null)
      this.grounded = true
      this.diving = false
      return
    }
    this.vel.y = Math.min(10, 2.2 + impact * 0.22)
    this.grounded = false
    if (this.wallLock <= 0 && impact > 8) {
      this.wallLock = 0.32
      audio.wall()
    }
  }

  private collide(city: City, flags: PlayerFrame, audio: AudioBus): void {
    this.resolveSphere(0.45, 0.38, city, flags, audio)
    this.resolveSphere(1.15, 0.36, city, flags, audio)
    this.resolveFountain()
  }

  private resolveFountain(): void {
    const dx = this.pos.x - 0
    const dz = this.pos.z - 0
    const d = Math.hypot(dx, dz)
    const limit = 3.5
    if (d < limit && this.pos.y < 0.9) {
      const n = d > 0.001 ? d : 1
      this.pos.x += (dx / n) * (limit - d)
      this.pos.z += (dz / n) * (limit - d)
    }
  }

  private resolveSphere(offsetY: number, radius: number, city: City, flags: PlayerFrame, audio: AudioBus): void {
    const center = this.tmp.set(this.pos.x, this.pos.y + offsetY, this.pos.z)
    for (const block of city.blocks) {
      if (Math.abs(block.x - center.x) > 36 || Math.abs(block.z - center.z) > 36) continue
      for (const box of block.boxes) {
        const minX = box.min.x - radius
        const maxX = box.max.x + radius
        const minY = box.min.y - radius
        const maxY = box.max.y + radius
        const minZ = box.min.z - radius
        const maxZ = box.max.z + radius
        if (center.x < minX || center.x > maxX || center.y < minY || center.y > maxY || center.z < minZ || center.z > maxZ) {
          continue
        }
        const faces = [
          { push: center.x - minX, axis: 'x' as const, sign: -1 },
          { push: maxX - center.x, axis: 'x' as const, sign: 1 },
          { push: center.y - minY, axis: 'y' as const, sign: -1 },
          { push: maxY - center.y, axis: 'y' as const, sign: 1 },
          { push: center.z - minZ, axis: 'z' as const, sign: -1 },
          { push: maxZ - center.z, axis: 'z' as const, sign: 1 },
        ]
        let best = faces[0]
        for (const face of faces) if (face.push < best.push) best = face
        if (best.axis === 'y' && best.sign < 0 && box.min.y <= 0.3) {
          let side = faces[0]
          let found = false
          for (const face of faces) {
            if (face.axis === 'y') continue
            if (!found || face.push < side.push) {
              side = face
              found = true
            }
          }
          if (found) best = side
        }
        const normal = this.tmp2.set(0, 0, 0)
        if (best.axis === 'x') {
          center.x = best.sign < 0 ? minX : maxX
          normal.set(best.sign, 0, 0)
        } else if (best.axis === 'y') {
          center.y = best.sign < 0 ? minY : maxY
          normal.set(0, best.sign, 0)
        } else {
          center.z = best.sign < 0 ? minZ : maxZ
          normal.set(0, 0, best.sign)
        }
        this.pos.set(center.x, center.y - offsetY, center.z)
        if (normal.y > 0.5) {
          if (this.airGrace > 0) {
            this.pos.y += best.push + 0.02
            if (this.vel.y < 3) this.vel.y = 3
          } else if (this.swinging && this.vel.y > -16) {
            if (this.vel.y < 0) this.vel.y *= 0.35
          } else {
            if (this.vel.y < -32) flags.hardLand = true
            if (this.vel.y < 0) this.vel.y = 0
            this.grounded = true
            this.diving = false
            if (this.swinging) this.release(false, null)
          }
        } else if (normal.y < -0.5) {
          if (this.vel.y > 0) this.vel.y = 0
        } else {
          const into = this.vel.dot(normal)
          if (into < 0) this.vel.addScaledVector(normal, -into)
          const horiz = Math.hypot(this.vel.x, this.vel.z)
          if (horiz > 9 && this.wallLock <= 0 && !this.grounded) {
            this.vel.addScaledVector(normal, 8)
            this.vel.y = Math.max(this.vel.y, Math.min(14, 6 + horiz * 0.12))
            this.wallLock = 0.4
            if (this.swinging) this.release(false, null)
            audio.wall()
          }
        }
      }
    }
  }

  private keepInside(): void {
    const lim = CITY.size / 2 - 6
    if (Math.abs(this.pos.x) > lim) this.vel.x -= Math.sign(this.pos.x) * 30 * (1 / 90)
    if (Math.abs(this.pos.z) > lim) this.vel.z -= Math.sign(this.pos.z) * 30 * (1 / 90)
    this.pos.x = clamp(this.pos.x, -lim - 12, lim + 12)
    this.pos.z = clamp(this.pos.z, -lim - 12, lim + 12)
    if (this.pos.y < -4) {
      this.pos.y = 12
      this.vel.y = 0
      this.swinging = false
    }
  }

  private face(dt: number): void {
    const hs = Math.hypot(this.vel.x, this.vel.z)
    let target = this.yaw
    if (hs > 2.5) target = Math.atan2(this.vel.x, this.vel.z)
    this.yaw = dampAngle(this.yaw, target, hs > 8 ? 6 : 8, dt)
  }

  pose(hero: Hero, camYaw: number): void {
    let mode: HeroPose['mode'] = 'idle'
    if (this.diving) mode = 'dive'
    else if (this.zipping && this.swinging) mode = 'zip'
    else if (this.swinging) mode = 'swing'
    else if (!this.grounded) mode = 'air'
    else if (Math.hypot(this.vel.x, this.vel.z) > 1.2) mode = 'run'
    const lean = this.swinging ? clamp(0.15 - this.vel.y * 0.02, -0.55, 0.7) : this.diving ? 1 : 0.05
    const bank = clamp(-angDiff(Math.atan2(this.vel.x, this.vel.z), this.yaw) * 0.8, -0.35, 0.35)
    hero.root.position.copy(this.pos)
    hero.update(1 / 60, {
      mode,
      yaw: this.yaw,
      lean,
      bank: this.grounded ? bank * 0.3 : bank,
      phase: performance.now() * 0.008 * Math.max(1, Math.hypot(this.vel.x, this.vel.z)),
      anchor: this.swinging ? this.anchor : null,
      camYaw,
      glanceX: clamp(angDiff(camYaw, this.yaw) * 4, -6, 6),
      glanceY: 0,
      whiff: this.whiff,
    })
  }

  private constrainRope(): void {
    if (!this.swinging) return
    const chest = this.chest()
    const offset = this.tmp.copy(chest).sub(this.anchor)
    const dist = offset.length()
    if (dist < 0.001 || dist <= this.rope) return
    const n = offset.multiplyScalar(1 / dist)
    this.pos.addScaledVector(n, this.rope - dist)
    const radial = this.vel.dot(n)
    if (radial > 0) this.vel.addScaledVector(n, -radial)
  }

  private chest(): THREE.Vector3 {
    return this.chestV.set(this.pos.x, this.pos.y + CHEST, this.pos.z)
  }

  private findAnchor(lookDir: THREE.Vector3, city: City): Anchor | null {
    const flat = Math.hypot(lookDir.x, lookDir.z) || 1
    // Follow the camera, with just enough lift that a level look still catches the next cornice.
    const aim = this.tmp
      .set((lookDir.x / flat) * 0.92, Math.max(lookDir.y, -0.05) + 0.28, (lookDir.z / flat) * 0.92)
      .normalize()
    const chest = this.chest()
    this.collectAnchors(aim, chest, city, 3)
    if (this.top.length === 0) this.collectAnchors(aim, chest, city, -14)
    for (const item of this.top) {
      if (!this.blocked(chest, item.a, city)) return item.a
    }
    return null
  }

  private collectAnchors(aim: THREE.Vector3, chest: THREE.Vector3, city: City, minHeight: number): void {
    this.top.length = 0
    for (const a of city.anchors) {
      if (this.swinging && a.point.distanceTo(this.anchor) < 6) continue
      const to = this.tmp2.copy(a.point).sub(chest)
      const dist = to.length()
      const horiz = Math.hypot(a.point.x - chest.x, a.point.z - chest.z)
      const minDist = this.swinging ? 9 : 12
      if (dist < minDist || dist > 80 || horiz < 8) continue
      to.multiplyScalar(1 / dist)
      const align = to.dot(aim)
      if (align < 0.3) continue
      const height = a.point.y - chest.y
      if (height < minHeight || height > 62) continue
      const arc = 1 - Math.abs(horiz - 34) / 36
      const distScore = 1 - Math.abs(dist - 40) / 40
      const score = align * 3.6 + arc * 1.1 + distScore + Math.min(Math.max(height, 0), 36) / 20
      this.pushTop(a, score)
    }
  }

  private pushTop(a: Anchor, s: number): void {
    if (this.top.length < 5) {
      this.top.push({ a, s })
      this.top.sort((p, q) => q.s - p.s)
      return
    }
    if (s <= this.top[this.top.length - 1].s) return
    this.top[this.top.length - 1] = { a, s }
    this.top.sort((p, q) => q.s - p.s)
  }

  private blocked(from: THREE.Vector3, anchor: Anchor, city: City): boolean {
    const to = this.tmp2.copy(anchor.point).sub(from)
    const dist = to.length()
    to.multiplyScalar(1 / dist)
    this.ray.set(from, to)
    this.ray.far = dist
    const hits = this.ray.intersectObjects(city.solids, false)
    for (const hit of hits) {
      if (hit.distance > dist - 2.4) continue
      if (hit.object.userData.buildingId === anchor.buildingId) continue
      return true
    }
    return false
  }
}
