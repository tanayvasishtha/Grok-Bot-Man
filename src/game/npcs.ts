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

function person(color: number, named: boolean): { group: THREE.Group; head: THREE.Object3D; legL: THREE.Object3D; legR: THREE.Object3D } {
  const group = new THREE.Group()
  const coat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xd7b093, roughness: 0.6 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5 })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 8), coat)
  body.position.y = 1.05
  body.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin)
  head.position.y = 1.62
  head.castShadow = true
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.38, 3, 6), dark)
  const legR = legL.clone()
  legL.position.set(-0.08, 0.42, 0)
  legR.position.set(0.08, 0.42, 0)
  legL.castShadow = true
  legR.castShadow = true
  group.add(body, head, legL, legR)
  if (named) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.025, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xe7a15a, transparent: true, opacity: 0.85 }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.05
    group.add(ring)
  }
  return { group, head, legL, legR }
}

export class Crowd {
  readonly npcs: Npc[] = []
  readonly barks: Bark[] = []

  constructor(city: City) {
    this.addNamed('nia', 'Nia Voss', city.nia, 0xd8c7a1, 0)
    this.addNamed('jun', 'Jun Park', city.jun, 0x3e6d8c, 1)
    this.addNamed('ivo', 'Ivo Pell', city.ivo, 0xc9843a, 2)
    this.addNamed('mara', 'Mara Ell', city.mara, 0xc4553a, 3)
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
      const built = person(COATS[n % COATS.length], false)
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

  private addNamed(id: string, name: string, pos: THREE.Vector3, color: number, index: number): void {
    const built = person(color, true)
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
        const text = npc.pair && !flyby ? pairBark(npc.index + Math.floor(performance.now() / 4000)) : barkLine(npc.index)
        this.barks.push({ text, world: npc.pos.clone().setY(npc.pos.y + 2.15), life: 2.2 })
        npc.barkCd = flyby ? 3.5 : 7
        if (this.barks.length > 5) this.barks.shift()
      }
    }
  }
}
