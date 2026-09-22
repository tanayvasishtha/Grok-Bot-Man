import * as THREE from 'three'
import { createFaceTexture } from './grokFace'
import { clamp } from './math'

export type HeroPose = {
  mode: 'idle' | 'run' | 'air' | 'swing' | 'dive' | 'zip'
  yaw: number
  lean: number
  bank: number
  phase: number
  anchor: THREE.Vector3 | null
  camYaw: number
  glanceX: number
  glanceY: number
  whiff: number
}

export class Hero {
  readonly root = new THREE.Group()
  readonly handWorld = new THREE.Vector3()
  private rig = new THREE.Group()
  private torso = new THREE.Group()
  private head = new THREE.Group()
  private armL = new THREE.Group()
  private armR = new THREE.Group()
  private foreL = new THREE.Group()
  private foreR = new THREE.Group()
  private handL = new THREE.Object3D()
  private handR = new THREE.Object3D()
  private thighL = new THREE.Group()
  private thighR = new THREE.Group()
  private shinL = new THREE.Group()
  private shinR = new THREE.Group()
  private launchL: THREE.Mesh
  private launchR: THREE.Mesh
  private paint: (x: number, y: number) => void
  private faceTick = 0
  private lastGlanceX = 99
  private lastGlanceY = 99
  activeHand: 'l' | 'r' = 'r'

  constructor() {
    const shell = new THREE.MeshPhysicalMaterial({
      color: 0xe4dfd6,
      metalness: 0.12,
      roughness: 0.28,
      clearcoat: 0.82,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1,
    })
    const joint = new THREE.MeshStandardMaterial({
      color: 0x121418,
      metalness: 0.78,
      roughness: 0.34,
    })
    const pack = new THREE.MeshStandardMaterial({
      color: 0x1a1d22,
      metalness: 0.55,
      roughness: 0.45,
    })
    const face = createFaceTexture()
    this.paint = face.paint
    const screen = new THREE.MeshStandardMaterial({
      map: face.texture,
      emissive: new THREE.Color('#f4f1ea'),
      emissiveMap: face.texture,
      emissiveIntensity: 0.45,
      roughness: 0.42,
      metalness: 0.05,
    })
    const launchMatL = new THREE.MeshStandardMaterial({
      color: 0xd7fbff,
      emissive: new THREE.Color('#9be7ff'),
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.4,
    })
    const launchMatR = launchMatL.clone()

    this.root.add(this.rig)
    this.torso.position.set(0, 1.16, 0)
    this.rig.add(this.torso)

    const pelvis = this.part(new THREE.BoxGeometry(0.28, 0.16, 0.18), shell)
    pelvis.position.set(0, -0.22, 0)
    this.torso.add(pelvis)
    const waist = this.part(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 10), joint)
    waist.position.set(0, -0.08, 0)
    this.torso.add(waist)
    const abdomen = this.part(new THREE.BoxGeometry(0.3, 0.2, 0.16), shell)
    abdomen.position.set(0, 0.04, 0.01)
    this.torso.add(abdomen)
    const chest = this.part(new THREE.BoxGeometry(0.42, 0.34, 0.2), shell)
    chest.position.set(0, 0.28, 0.02)
    this.torso.add(chest)
    const seam = this.part(new THREE.BoxGeometry(0.06, 0.3, 0.03), joint)
    seam.position.set(0, 0.28, 0.125)
    this.torso.add(seam)
    const collar = this.part(new THREE.BoxGeometry(0.46, 0.06, 0.18), joint)
    collar.position.set(0, 0.46, 0)
    this.torso.add(collar)
    const backpack = this.part(new THREE.BoxGeometry(0.26, 0.36, 0.12), pack)
    backpack.position.set(0, 0.26, -0.16)
    this.torso.add(backpack)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), screen)
    plate.position.set(0, 0.28, -0.23)
    plate.rotation.y = Math.PI
    this.torso.add(plate)

    this.head.position.set(0, 0.62, 0.02)
    this.torso.add(this.head)
    const neck = this.part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), joint)
    neck.position.set(0, -0.08, 0)
    this.head.add(neck)
    const helmet = this.part(new THREE.SphereGeometry(0.16, 20, 16), shell)
    helmet.scale.set(1, 1.08, 1.02)
    this.head.add(helmet)
    const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), screen)
    facePlane.position.set(0, 0.01, 0.145)
    this.head.add(facePlane)

    this.armR.position.set(-0.32, 0.4, 0)
    this.armL.position.set(0.32, 0.4, 0)
    this.torso.add(this.armR, this.armL)
    this.buildArm(this.armR, this.foreR, this.handR, shell, joint, launchMatR, -1)
    this.buildArm(this.armL, this.foreL, this.handL, shell, joint, launchMatL, 1)
    this.launchR = this.armR.getObjectByName('launcher') as THREE.Mesh
    this.launchL = this.armL.getObjectByName('launcher') as THREE.Mesh

    this.thighR.position.set(-0.11, 1.02, 0)
    this.thighL.position.set(0.11, 1.02, 0)
    this.rig.add(this.thighR, this.thighL)
    this.buildLeg(this.thighR, this.shinR, shell, joint)
    this.buildLeg(this.thighL, this.shinL, shell, joint)
  }

  private part(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private buildArm(
    arm: THREE.Group,
    fore: THREE.Group,
    hand: THREE.Object3D,
    shell: THREE.Material,
    joint: THREE.Material,
    launchMat: THREE.Material,
    side: number,
  ): void {
    const shoulder = this.part(new THREE.SphereGeometry(0.09, 12, 10), shell)
    arm.add(shoulder)
    const upper = this.part(new THREE.CapsuleGeometry(0.048, 0.36, 4, 8), shell)
    upper.rotation.x = Math.PI / 2
    upper.position.z = 0.24
    arm.add(upper)
    const elbow = this.part(new THREE.SphereGeometry(0.055, 10, 8), joint)
    elbow.position.z = 0.46
    arm.add(elbow)
    fore.position.z = 0.46
    arm.add(fore)
    const lower = this.part(new THREE.CapsuleGeometry(0.04, 0.32, 4, 8), shell)
    lower.rotation.x = Math.PI / 2
    lower.position.z = 0.2
    fore.add(lower)
    const actuator = this.part(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), joint)
    actuator.rotation.x = Math.PI / 2
    actuator.position.z = 0.08
    fore.add(actuator)
    const launcher = this.part(new THREE.CylinderGeometry(0.042, 0.042, 0.07, 10), launchMat)
    launcher.rotation.x = Math.PI / 2
    launcher.position.z = 0.38
    launcher.name = 'launcher'
    fore.add(launcher)
    hand.position.z = 0.44
    fore.add(hand)
    const palm = this.part(new THREE.BoxGeometry(0.08, 0.04, 0.09), shell)
    palm.position.z = 0.04
    hand.add(palm)
    for (let i = 0; i < 4; i++) {
      const finger = this.part(new THREE.CapsuleGeometry(0.011, 0.055, 2, 6), shell)
      finger.rotation.x = Math.PI / 2
      finger.position.set((i - 1.5) * 0.018 * Math.sign(side || 1), 0, 0.11)
      hand.add(finger)
    }
    const thumb = this.part(new THREE.CapsuleGeometry(0.013, 0.035, 2, 6), shell)
    thumb.rotation.z = side * 0.8
    thumb.position.set(side * 0.05, 0, 0.04)
    hand.add(thumb)
  }

  private buildLeg(thigh: THREE.Group, shin: THREE.Group, shell: THREE.Material, joint: THREE.Material): void {
    const hip = this.part(new THREE.SphereGeometry(0.08, 10, 8), joint)
    thigh.add(hip)
    const upper = this.part(new THREE.CapsuleGeometry(0.06, 0.42, 4, 8), shell)
    upper.rotation.x = Math.PI / 2
    upper.position.z = 0.28
    thigh.add(upper)
    const piston = this.part(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), joint)
    piston.rotation.x = Math.PI / 2
    piston.position.set(0.05, 0, 0.28)
    thigh.add(piston)
    const knee = this.part(new THREE.SphereGeometry(0.065, 10, 8), joint)
    knee.position.z = 0.54
    thigh.add(knee)
    shin.position.z = 0.54
    thigh.add(shin)
    const lower = this.part(new THREE.CapsuleGeometry(0.048, 0.4, 4, 8), shell)
    lower.rotation.x = Math.PI / 2
    lower.position.z = 0.24
    shin.add(lower)
    const foot = this.part(new THREE.BoxGeometry(0.1, 0.045, 0.22), shell)
    foot.position.set(0, -0.02, 0.48)
    shin.add(foot)
  }

  update(dt: number, pose: HeroPose): void {
    this.root.position.y = 0
    this.root.rotation.y = pose.yaw
    this.torso.rotation.z = pose.bank
    this.torso.rotation.y = 0
    let lean = pose.lean
    if (pose.mode === 'dive') lean = 1.05
    else if (pose.mode === 'zip') lean = 0.45
    else if (pose.mode === 'swing') lean = pose.lean
    this.torso.rotation.x = lean

    const stride = pose.mode === 'run' ? Math.sin(pose.phase) : pose.mode === 'idle' ? Math.sin(pose.phase * 0.35) * 0.08 : 0
    const legBase = pose.mode === 'dive' ? 2.45 : pose.mode === 'swing' ? 1.85 : Math.PI / 2
    const amp = pose.mode === 'run' ? 0.55 : pose.mode === 'swing' ? 0.25 : pose.mode === 'air' ? 0.2 : 0.04
    this.thighR.rotation.set(legBase + stride * amp, 0, 0)
    this.thighL.rotation.set(legBase - stride * amp, 0, 0)
    this.shinR.rotation.set(pose.mode === 'run' ? Math.max(0, -stride) * 1.1 : pose.mode === 'swing' ? 0.45 : 0.12, 0, 0)
    this.shinL.rotation.set(pose.mode === 'run' ? Math.max(0, stride) * 1.1 : pose.mode === 'swing' ? 0.35 : 0.12, 0, 0)

    const hang = 1.15
    this.armR.rotation.set(hang, 0, 0.12 + stride * 0.15)
    this.armL.rotation.set(hang, 0, -0.12 - stride * 0.15)
    this.foreR.rotation.set(0.25, 0, 0)
    this.foreL.rotation.set(0.25, 0, 0)

    if (pose.mode === 'dive') {
      this.armR.rotation.set(2.4, 0.2, 0.3)
      this.armL.rotation.set(2.4, -0.2, -0.3)
      this.foreR.rotation.set(0.2, 0, 0)
      this.foreL.rotation.set(0.2, 0, 0)
    }

    this.root.updateMatrixWorld(true)
    if ((pose.mode === 'swing' || pose.mode === 'zip') && pose.anchor) {
      const local = this.torso.worldToLocal(pose.anchor.clone())
      this.activeHand = local.x > 0 ? 'l' : 'r'
      const arm = this.activeHand === 'l' ? this.armL : this.armR
      const fore = this.activeHand === 'l' ? this.foreL : this.foreR
      arm.lookAt(pose.anchor)
      fore.rotation.set(0.55, 0, 0)
    } else if (pose.whiff > 0) {
      this.armR.rotation.set(0.2, 0, 0.1)
      this.foreR.rotation.set(0.1, 0, 0)
    }

    const rel = Math.atan2(Math.sin(pose.camYaw - pose.yaw), Math.cos(pose.camYaw - pose.yaw))
    this.head.rotation.x = clamp(-lean * 0.35, -0.6, 0.5)
    this.head.rotation.y = clamp(rel, -0.7, 0.7) * 0.45
    this.head.rotation.z = -pose.bank * 0.3

    const launch = (this.activeHand === 'l' ? this.launchL : this.launchR).material as THREE.MeshStandardMaterial
    const other = (this.activeHand === 'l' ? this.launchR : this.launchL).material as THREE.MeshStandardMaterial
    const hot = pose.mode === 'swing' || pose.mode === 'zip' ? 2.2 : 0.55
    launch.emissiveIntensity = hot
    other.emissiveIntensity = 0.45

    this.faceTick += dt
    if (this.faceTick > 0.07 || Math.abs(pose.glanceX - this.lastGlanceX) > 0.8 || Math.abs(pose.glanceY - this.lastGlanceY) > 0.8) {
      this.paint(pose.glanceX, pose.glanceY)
      this.lastGlanceX = pose.glanceX
      this.lastGlanceY = pose.glanceY
      this.faceTick = 0
    }

    this.root.updateMatrixWorld(true)
    const hand = this.activeHand === 'l' ? this.handL : this.handR
    hand.getWorldPosition(this.handWorld)
  }
}
