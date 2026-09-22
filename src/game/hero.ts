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
    this.torso.position.set(0, 1.32, 0)
    this.rig.add(this.torso)

    const pelvis = this.part(new THREE.BoxGeometry(0.3, 0.14, 0.18), shell)
    pelvis.position.set(0, -0.2, 0)
    this.torso.add(pelvis)
    const waist = this.part(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 10), joint)
    waist.position.set(0, -0.08, 0)
    this.torso.add(waist)
    const abdomen = this.part(new THREE.BoxGeometry(0.24, 0.18, 0.15), shell)
    abdomen.position.set(0, 0.04, 0.01)
    this.torso.add(abdomen)
    const chest = this.part(new THREE.BoxGeometry(0.5, 0.36, 0.22), shell)
    chest.position.set(0, 0.3, 0.02)
    this.torso.add(chest)
    const seam = this.part(new THREE.BoxGeometry(0.04, 0.32, 0.02), joint)
    seam.position.set(0, 0.3, 0.132)
    this.torso.add(seam)
    const rib = this.part(new THREE.BoxGeometry(0.42, 0.025, 0.02), joint)
    rib.position.set(0, 0.22, 0.132)
    this.torso.add(rib)
    const rib2 = rib.clone()
    rib2.position.y = 0.38
    this.torso.add(rib2)
    const collar = this.part(new THREE.BoxGeometry(0.54, 0.07, 0.2), joint)
    collar.position.set(0, 0.5, 0)
    this.torso.add(collar)
    const backpack = this.part(new THREE.BoxGeometry(0.34, 0.48, 0.15), pack)
    backpack.position.set(0, 0.28, -0.2)
    this.torso.add(backpack)
    const packCap = this.part(new THREE.BoxGeometry(0.26, 0.1, 0.08), joint)
    packCap.position.set(0, 0.5, -0.22)
    this.torso.add(packCap)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), screen)
    plate.position.set(0, 0.28, -0.286)
    plate.rotation.y = Math.PI
    plate.scale.x = -1
    this.torso.add(plate)

    this.head.position.set(0, 0.68, 0.03)
    this.torso.add(this.head)
    const neck = this.part(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 10), joint)
    neck.position.set(0, -0.08, 0)
    this.head.add(neck)
    const helmet = this.part(new THREE.SphereGeometry(0.17, 20, 16), shell)
    helmet.scale.set(1.05, 1.12, 1.04)
    this.head.add(helmet)
    const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), screen)
    facePlane.position.set(0, 0.01, 0.158)
    this.head.add(facePlane)

    this.armR.position.set(-0.36, 0.42, 0)
    this.armL.position.set(0.36, 0.42, 0)
    this.torso.add(this.armR, this.armL)
    this.buildArm(this.armR, this.foreR, this.handR, shell, joint, launchMatR, -1)
    this.buildArm(this.armL, this.foreL, this.handL, shell, joint, launchMatL, 1)
    this.launchR = this.armR.getObjectByName('launcher') as THREE.Mesh
    this.launchL = this.armL.getObjectByName('launcher') as THREE.Mesh

    this.thighR.position.set(-0.13, 1.26, 0)
    this.thighL.position.set(0.13, 1.26, 0)
    this.rig.add(this.thighR, this.thighL)
    this.buildLeg(this.thighR, this.shinR, shell, joint, -1)
    this.buildLeg(this.thighL, this.shinL, shell, joint, 1)
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
    const shoulder = this.part(new THREE.SphereGeometry(0.11, 12, 10), shell)
    arm.add(shoulder)
    const pauldron = this.part(new THREE.BoxGeometry(0.16, 0.08, 0.14), shell)
    pauldron.position.set(side * 0.04, 0.06, 0.02)
    arm.add(pauldron)
    const upper = this.part(new THREE.CapsuleGeometry(0.055, 0.38, 4, 8), shell)
    upper.rotation.x = Math.PI / 2
    upper.position.z = 0.26
    arm.add(upper)
    const elbow = this.part(new THREE.SphereGeometry(0.065, 10, 8), joint)
    elbow.position.z = 0.5
    arm.add(elbow)
    fore.position.z = 0.5
    arm.add(fore)
    const lower = this.part(new THREE.CapsuleGeometry(0.046, 0.34, 4, 8), shell)
    lower.rotation.x = Math.PI / 2
    lower.position.z = 0.22
    fore.add(lower)
    const band = this.part(new THREE.BoxGeometry(0.1, 0.035, 0.08), joint)
    band.position.set(0, 0.02, 0.16)
    fore.add(band)
    const actuator = this.part(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), joint)
    actuator.rotation.x = Math.PI / 2
    actuator.position.z = 0.08
    fore.add(actuator)
    const launcher = this.part(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), launchMat)
    launcher.rotation.x = Math.PI / 2
    launcher.position.z = 0.42
    launcher.name = 'launcher'
    fore.add(launcher)
    hand.position.z = 0.48
    fore.add(hand)
    const palm = this.part(new THREE.BoxGeometry(0.11, 0.045, 0.1), shell)
    palm.position.z = 0.05
    hand.add(palm)
    for (let i = 0; i < 4; i++) {
      const finger = this.part(new THREE.CapsuleGeometry(0.014, 0.07, 2, 6), shell)
      finger.rotation.x = Math.PI / 2
      finger.position.set((i - 1.5) * 0.024 * Math.sign(side || 1), 0, 0.13)
      hand.add(finger)
    }
    const thumb = this.part(new THREE.CapsuleGeometry(0.016, 0.045, 2, 6), shell)
    thumb.rotation.z = side * 0.9
    thumb.position.set(side * 0.065, 0, 0.05)
    hand.add(thumb)
  }

  private buildLeg(thigh: THREE.Group, shin: THREE.Group, shell: THREE.Material, joint: THREE.Material, side: number): void {
    const hip = this.part(new THREE.SphereGeometry(0.095, 10, 8), joint)
    thigh.add(hip)
    const upper = this.part(new THREE.CapsuleGeometry(0.07, 0.5, 4, 8), shell)
    upper.rotation.x = Math.PI / 2
    upper.position.z = 0.32
    thigh.add(upper)
    const armor = this.part(new THREE.BoxGeometry(0.05, 0.1, 0.26), shell)
    armor.position.set(side * 0.07, 0, 0.3)
    thigh.add(armor)
    const band = this.part(new THREE.BoxGeometry(0.13, 0.04, 0.07), joint)
    band.position.set(0, 0, 0.22)
    thigh.add(band)
    const piston = this.part(new THREE.CylinderGeometry(0.028, 0.028, 0.28, 6), joint)
    piston.rotation.x = Math.PI / 2
    piston.position.set(side * 0.06, 0, 0.32)
    thigh.add(piston)
    const knee = this.part(new THREE.SphereGeometry(0.078, 10, 8), joint)
    knee.position.z = 0.66
    thigh.add(knee)
    shin.position.z = 0.66
    thigh.add(shin)
    const lower = this.part(new THREE.CapsuleGeometry(0.055, 0.46, 4, 8), shell)
    lower.rotation.x = Math.PI / 2
    lower.position.z = 0.28
    shin.add(lower)
    const shinBand = this.part(new THREE.BoxGeometry(0.12, 0.035, 0.08), joint)
    shinBand.position.set(0, 0, 0.2)
    shin.add(shinBand)
    const foot = this.part(new THREE.BoxGeometry(0.16, 0.05, 0.3), shell)
    foot.position.set(0, -0.02, 0.58)
    shin.add(foot)
    const sole = this.part(new THREE.BoxGeometry(0.17, 0.02, 0.32), joint)
    sole.position.set(0, -0.05, 0.6)
    shin.add(sole)
  }

  update(dt: number, pose: HeroPose): void {
    this.root.rotation.y = pose.yaw
    this.torso.rotation.z = pose.bank
    this.torso.rotation.y = 0
    let lean = pose.lean
    if (pose.mode === 'dive') lean = 1.05
    else if (pose.mode === 'zip') lean = 0.45
    else if (pose.mode === 'swing') lean = pose.lean
    this.torso.rotation.x = lean

    const stride = pose.mode === 'run' ? Math.sin(pose.phase) : pose.mode === 'idle' ? Math.sin(pose.phase * 0.35) * 0.08 : 0
    const legBase = pose.mode === 'dive' ? 2.45 : pose.mode === 'swing' ? 1.22 : Math.PI / 2
    const amp = pose.mode === 'run' ? 0.55 : pose.mode === 'swing' ? 0.18 : pose.mode === 'air' ? 0.2 : 0.04
    this.thighR.rotation.set(legBase + stride * amp, 0, 0)
    this.thighL.rotation.set(legBase - stride * amp, 0, 0)
    this.shinR.rotation.set(pose.mode === 'run' ? Math.max(0, -stride) * 1.1 : pose.mode === 'swing' ? 0.95 : 0.12, 0, 0)
    this.shinL.rotation.set(pose.mode === 'run' ? Math.max(0, stride) * 1.1 : pose.mode === 'swing' ? 0.95 : 0.12, 0, 0)

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
      const trail = this.activeHand === 'l' ? this.armR : this.armL
      const trailFore = this.activeHand === 'l' ? this.foreR : this.foreL
      trail.rotation.set(0.4, 0, this.activeHand === 'l' ? 0.5 : -0.5)
      trailFore.rotation.set(0.2, 0, 0)
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
