import * as THREE from 'three'
import type { City } from './city'
import { CITY } from './city'
import { barkLine, pairBark } from './dialogue'
import { dampAngle } from './math'

export type Bark = { text: string; world: THREE.Vector3; life: number }

export type Npc = {
  id: string
  name: string
  index: number
  pos: THREE.Vector3
  yaw: number
  group: THREE.Group
  head: THREE.Object3D
  legL: THREE.Object3D
  legR: THREE.Object3D
  path: THREE.Vector3[]
  cursor: number
  forward: number
  speed: number
  barkCd: number
  pair: boolean
  home: THREE.Vector3 | null
}

const FIRST = ['Ames', 'Bex', 'Corin', 'Dalia', 'Ellis', 'Farah', 'Gita', 'Hugo', 'Ida', 'Joss', 'Kian', 'Noor', 'Omar', 'Priya', 'Quin', 'Sera', 'Tomas', 'Uma', 'Vik', 'Wren', 'Yara', 'Zed', 'Hana', 'Leo']
const LAST = ['Adeyemi', 'Berg', 'Cho', 'Dutta', 'Elsayed', 'Ferreira', 'Ghosh', 'Hassan', 'Ibarra', 'Jensen', 'Kaur', 'Lange', 'Mensah', 'Novak', 'Okeke', 'Quintero', 'Rossi', 'Sato', 'Tran', 'Walsh']

const COATS = [0xc4553a, 0x3e6d8c, 0xd8c7a1, 0x2f6b52, 0x8a4e78, 0x4d5560, 0xc9843a, 0x1f3d4d]

function placard(text: string): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const g = canvas.getContext('2d')!
  g.fillStyle = '#f4f1ea'
  g.fillRect(0, 0, 256, 128)
  g.fillStyle = '#1a120e'
  g.font = `${text.length > 14 ? 28 : 40}px Outfit, Segoe UI, sans-serif`
  g.font = `700 ${g.font}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 128, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.36),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  )
  board.position.set(0.05, 1.42, 0.32)
  return board
}

type Silhouette = 'crowd' | 'nia' | 'jun' | 'ivo' | 'mara'

function person(color: number, ring: boolean, kind: Silhouette = 'crowd'): { group: THREE.Group; head: THREE.Object3D; legL: THREE.Object3D; legR: THREE.Object3D } {
  const group = new THREE.Group()
  const coat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xd7b093, roughness: 0.6 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5 })
  const tall = kind === 'nia' ? 0.7 : kind === 'mara' ? 0.42 : 0.55
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(kind === 'ivo' ? 0.24 : 0.2, tall, 4, 8), coat)
  body.position.y = 0.78 + tall * 0.5
  body.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin)
  head.position.y = body.position.y + tall * 0.5 + 0.28
  head.castShadow = true
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.38, 3, 6), dark)
  const legR = legL.clone()
  legL.position.set(-0.08, 0.42, 0)
  legR.position.set(0.08, 0.42, 0)
  legL.castShadow = true
  legR.castShadow = true
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.22), coat)
  shoulder.position.y = body.position.y + tall * 0.28
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), dark)
  hair.position.y = head.position.y + 0.04
  hair.scale.set(1, 0.55, 1)
  group.add(body, head, legL, legR, shoulder, hair)
  if (kind === 'nia') {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.22), dark)
    collar.position.y = body.position.y + 0.28
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 12), dark)
    band.position.y = head.position.y
    band.rotation.x = Math.PI / 2
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.03), new THREE.MeshStandardMaterial({ color: 0xe7d7c2, roughness: 0.6 }))
    board.position.set(0.28, 1.05, 0.12)
    group.add(collar, band, board)
  } else if (kind === 'jun') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), dark)
    cap.position.y = head.position.y + 0.14
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 10), dark)
    brim.position.y = head.position.y + 0.1
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.08), dark)
    satchel.position.set(-0.22, 1.15, -0.12)
    group.add(cap, brim, satchel)
  } else if (kind === 'ivo') {
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb15a }),
    )
    lantern.position.set(0.32, 1.05, 0.08)
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 5), dark)
    handle.position.set(0.32, 1.22, 0.08)
    group.add(lantern, handle)
  } else if (kind === 'mara') {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), dark)
    visor.position.set(0, head.position.y + 0.02, 0.12)
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.24), dark)
    belt.position.y = 0.95
    const wrench = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 5), new THREE.MeshStandardMaterial({ color: 0xc5ccd4, metalness: 0.8, roughness: 0.3 }))
    wrench.rotation.z = 0.4
    wrench.position.set(0.28, 0.9, 0.1)
    group.add(visor, belt, wrench)
    group.scale.setScalar(0.92)
  }
  if (ring) {
    const mark = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.025, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xe7a15a, transparent: true, opacity: 0.85 }),
    )
    mark.rotation.x = Math.PI / 2
    mark.position.y = 0.05
    group.add(mark)
  }
  return { group, head, legL, legR }
}

export class Crowd {
  readonly npcs: Npc[] = []
  readonly barks: Bark[] = []

  constructor(city: City) {
    this.addNamed('nia', 'Nia Voss', city.nia, 0xd8c7a1, 0, 'nia')
    this.addNamed('jun', 'Jun Park', city.jun, 0x3e6d8c, 1, 'jun')
    this.addNamed('ivo', 'Ivo Pell', city.ivo, 0xc9843a, 2, 'ivo')
    this.addNamed('mara', 'Mara Ell', city.mara, 0xc4553a, 3, 'mara')
    const officeNames = ['Ren', 'Sol', 'Kit']
    const officeSigns = ['RESET', 'GROK BOT', 'CURSOR']
    for (let i = 0; i < officeNames.length; i++) {
      const pos = city.protest.clone()
      pos.x += (i - 1) * 2.2
      pos.z += 1.4
      this.addNamed(`protest${i}`, officeNames[i], pos, COATS[i % COATS.length], 30 + i, 'crowd')
      this.npcs[this.npcs.length - 1].group.add(placard(officeSigns[i]))
    }
    const supportNames = ['Noor', 'Pia', 'Ames']
    const supportSigns = ['WE SUPPORT NEURALINK', 'FOR THE LINK', 'NEURALINK']
    for (let i = 0; i < supportNames.length; i++) {
      const pos = city.neuralink.clone()
      pos.x += (i - 1) * 1.4
      this.addNamed(`support${i}`, supportNames[i], pos, COATS[(i + 3) % COATS.length], 40 + i, 'crowd')
      this.npcs[this.npcs.length - 1].group.add(placard(supportSigns[i]))
    }
    this.addPair('lale', 'Lale', 'Rafi', new THREE.Vector3(-14, 0, 22), 4)
    this.addPair('nori', 'Nori', 'Pavel', new THREE.Vector3(18, 0, -16), 6)

    const rng = () => Math.random()
    for (let n = 0; n < 22; n++) {
      const vertical = rng() > 0.5
      const road = 1 + Math.floor(rng() * (CITY.count - 2))
      const base = CITY.origin + road * CITY.cell
      const side = rng() > 0.5 ? 10 : -10
      const along0 = CITY.origin + 24 + rng() * (CITY.size - 80)
      const along1 = along0 + 16 + rng() * 26
      const path = vertical
        ? [new THREE.Vector3(base + side, 0, along0), new THREE.Vector3(base + side, 0, along1)]
        : [new THREE.Vector3(along0, 0, base + side), new THREE.Vector3(along1, 0, base + side)]
      if (city.insideBuilding(path[0].x, path[0].z, 0.8)) continue
      const built = person(COATS[n % COATS.length], false, 'crowd')
      const npc: Npc = {
        id: `c${n}`,
        name: `${FIRST[n % FIRST.length]} ${LAST[(n * 3) % LAST.length]}`,
        index: n + 8,
        pos: path[0].clone(),
        yaw: 0,
        group: built.group,
        head: built.head,
        legL: built.legL,
        legR: built.legR,
        path,
        cursor: 0,
        forward: 1,
        speed: 0.7 + rng() * 0.6,
        barkCd: rng() * 4,
        pair: false,
        home: null,
      }
      built.group.position.copy(npc.pos)
      this.npcs.push(npc)
    }
  }

  private addNamed(id: string, name: string, pos: THREE.Vector3, color: number, index: number, kind: Silhouette = 'crowd'): void {
    const built = person(color, true, kind)
    const npc: Npc = {
      id,
      name,
      index,
      pos: pos.clone(),
      yaw: Math.atan2(-pos.x, -pos.z),
      group: built.group,
      head: built.head,
      legL: built.legL,
      legR: built.legR,
      path: [],
      cursor: 0,
      forward: 1,
      speed: 0,
      barkCd: 1,
      pair: false,
      home: pos.clone(),
    }
    built.group.position.copy(npc.pos)
    this.npcs.push(npc)
  }

  private addPair(id: string, a: string, b: string, origin: THREE.Vector3, index: number): void {
    const left = origin.clone().add(new THREE.Vector3(-0.7, 0, 0))
    const right = origin.clone().add(new THREE.Vector3(0.7, 0, 0))
    this.addNamed(id, a, left, 0x8a4e78, index)
    const partner = this.npcs[this.npcs.length - 1]
    partner.pair = true
    this.addNamed(`${id}-b`, b, right, 0x2f6b52, index + 1)
    const other = this.npcs[this.npcs.length - 1]
    other.pair = true
    other.id = id
    partner.yaw = 0
    other.yaw = Math.PI
  }

  resetProtest(): void {
    for (const npc of this.npcs) {
      if (!npc.id.startsWith('protest') || !npc.home) continue
      npc.pos.copy(npc.home)
      npc.path = []
      npc.speed = 0
      npc.group.position.copy(npc.home)
    }
  }

  disperseProtest(): void {
    for (const npc of this.npcs) {
      if (!npc.id.startsWith('protest')) continue
      const away = npc.pos.clone()
      away.x += 24
      away.z += 10
      npc.path = [npc.pos.clone(), away]
      npc.cursor = 1
      npc.speed = 1.7
    }
    this.barks.push({ text: 'The reset took. We are leaving.', world: this.npcs.find((n) => n.id === 'protest0')?.pos.clone().setY(2.1) ?? new THREE.Vector3(), life: 2.4 })
  }

  mount(scene: THREE.Scene): void {
    for (const npc of this.npcs) scene.add(npc.group)
  }

  nearest(x: number, y: number, z: number, grounded: boolean, speed: number): Npc | null {
    if (!grounded || speed > 4.5) return null
    let best: Npc | null = null
    let bestD = 2.8
    for (const npc of this.npcs) {
      const d = Math.hypot(npc.pos.x - x, npc.pos.y - y, npc.pos.z - z)
      if (d < bestD) {
        bestD = d
        best = npc
      }
    }
    return best
  }

  update(
    dt: number,
    body: { x: number; y: number; z: number; speed: number; grounded: boolean },
    talkingId: string | null,
  ): void {
    for (const bark of this.barks) bark.life -= dt
    for (let i = this.barks.length - 1; i >= 0; i--) if (this.barks[i].life <= 0) this.barks.splice(i, 1)

    for (const npc of this.npcs) {
      npc.barkCd -= dt
      if (npc.path.length === 2 && npc.id !== talkingId) {
        const goal = npc.path[npc.cursor]
        const dx = goal.x - npc.pos.x
        const dz = goal.z - npc.pos.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.3) npc.cursor = npc.cursor === 0 ? 1 : 0
        else {
          npc.pos.x += (dx / dist) * npc.speed * dt
          npc.pos.z += (dz / dist) * npc.speed * dt
          npc.yaw = dampAngle(npc.yaw, Math.atan2(dx, dz), 6, dt)
        }
      }
      const dx = body.x - npc.pos.x
      const dy = body.y - npc.pos.y
      const dz = body.z - npc.pos.z
      const dxz = Math.hypot(dx, dz)
      if (body.grounded && body.speed < 6 && dxz < 2.1 && Math.abs(dy) < 2) {
        const len = dxz || 1
        npc.pos.x -= (dx / len) * 1.4 * dt
        npc.pos.z -= (dz / len) * 1.4 * dt
      }
      let look = npc.yaw
      if (dxz < 12 && dy > -1 && dy < 24) look = Math.atan2(dx, dz)
      if (npc.id === talkingId) look = Math.atan2(dx, dz)
      npc.yaw = dampAngle(npc.yaw, look, 5, dt)
      const walk = npc.path.length === 2 ? Math.sin(performance.now() * 0.008 * (npc.speed + 0.4)) : Math.sin(performance.now() * 0.002) * 0.08
      npc.legL.rotation.x = walk * 0.7
      npc.legR.rotation.x = -walk * 0.7
      npc.head.rotation.x = dy > 3 && dxz < 14 ? -0.55 : 0
      npc.group.position.copy(npc.pos)
      npc.group.rotation.y = npc.yaw

      const flyby = dxz < 13 && dy > 2 && dy < 28 && body.speed > 13
      const chat = npc.pair && dxz < 8 && body.speed < 5 && Math.abs(dy) < 4
      if ((flyby || chat) && npc.barkCd <= 0 && npc.id !== talkingId) {
        const text = npc.id.startsWith('support') && npc.path.length === 0
        ? 'We support Neuralink.'
        : npc.id.startsWith('protest') && npc.path.length === 0
          ? 'Reset is in front of the offices.'
          : npc.pair && !flyby
          ? pairBark(npc.index + Math.floor(performance.now() / 4000))
          : barkLine(npc.index)
        this.barks.push({ text, world: npc.pos.clone().setY(npc.pos.y + 2.15), life: 2.2 })
        npc.barkCd = flyby ? 3.5 : 7
        if (this.barks.length > 5) this.barks.shift()
      }
    }
  }
}
