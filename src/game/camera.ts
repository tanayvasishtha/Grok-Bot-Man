import * as THREE from 'three'
import type { FrameInput } from './input'
import { clamp, damp, dampAngle } from './math'

export class CameraRig {
  yaw = Math.PI
  pitch = -0.12
  dist = 5.7
  readonly lookDir = new THREE.Vector3(0, 0, -1)
  private target = new THREE.Vector3()
  private desired = new THREE.Vector3()
  private ray = new THREE.Raycaster()
  private smooth = new THREE.Vector3()
  private ready = false
  orbit = 0.6

  update(
    dt: number,
    input: FrameInput | null,
    focus: THREE.Vector3,
    velocity: THREE.Vector3,
    solids: THREE.Object3D[],
    menu: boolean,
    reduceMotion: boolean,
  ): void {
    if (menu) {
      this.orbit += dt * (reduceMotion ? 0.02 : 0.07)
      const r = 46
      this.desired.set(Math.sin(this.orbit) * r, 24, Math.cos(this.orbit) * r * 0.85 + 18)
      this.target.set(0, 10, 8)
      if (!this.ready) {
        this.smooth.copy(this.desired)
        this.ready = true
      }
      this.smooth.lerp(this.desired, 1 - Math.exp(-1.4 * dt))
      return
    }

    if (input) {
      const looking = input.pointerLocked || input.rightHeld || Math.abs(input.lookX) + Math.abs(input.lookY) > 0
      if (looking) {
        this.yaw -= input.lookX * 0.0022
        this.pitch -= input.lookY * 0.0018
      }
      const turn = 1.55 * dt
      if (input.turnLeft) this.yaw -= turn
      if (input.turnRight) this.yaw += turn
      if (input.turnUp) this.pitch += turn
      if (input.turnDown) this.pitch -= turn
      this.pitch = clamp(this.pitch, -0.95, 1.05)
    }

    const speed = velocity.length()
    if (input && Math.abs(input.lookX) + Math.abs(input.lookY) < 0.5 && speed > 10 && !input.rightHeld) {
      const face = Math.atan2(velocity.x, velocity.z)
      this.yaw = dampAngle(this.yaw, face, 1.6, dt)
    }

    const cp = Math.cos(this.pitch)
    const sp = Math.sin(this.pitch)
    this.lookDir.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).normalize()
    this.target.copy(focus)
    this.target.y += 1.55
    this.target.addScaledVector(velocity, 0.045)
    let dist = this.dist
    this.desired.copy(this.target).addScaledVector(this.lookDir, -dist)
    this.ray.set(this.target, this.desired.clone().sub(this.target).normalize())
    this.ray.far = dist
    const hit = this.ray.intersectObjects(solids, false)[0]
    if (hit && hit.distance < dist) dist = Math.max(1.4, hit.distance - 0.45)
    this.desired.copy(this.target).addScaledVector(this.lookDir, -dist)
    if (!this.ready) {
      this.smooth.copy(this.desired)
      this.ready = true
    }
    const k = 1 - Math.exp(-8 * dt)
    this.smooth.lerp(this.desired, k)
  }

  apply(camera: THREE.PerspectiveCamera, speed: number): void {
    camera.position.copy(this.smooth)
    camera.lookAt(this.target)
    const fov = damp(camera.fov, 68 + clamp(speed / 70, 0, 1) * 14, 4, 0.016)
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }

  snap(focus: THREE.Vector3): void {
    this.target.copy(focus)
    this.target.y += 1.55
    this.lookDir.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))
    this.smooth.copy(this.target).addScaledVector(this.lookDir, -this.dist)
    this.ready = true
  }
}
