import * as THREE from 'three'
import { mulberry32 } from './rng'

export const CITY = {
  count: 11,
  cell: 58,
  size: 11 * 58,
  origin: -(11 * 58) / 2,
}

export type Anchor = {
  point: THREE.Vector3
  buildingId: number
}

export type Block = {
  id: number
  x: number
  z: number
  w: number
  d: number
  h: number
  boxes: THREE.Box3[]
}

export type Spot = { name: string; position: THREE.Vector3 }

type Car = {
  axis: 'x' | 'z'
  fixed: number
  along: number
  dir: number
  speed: number
  color: THREE.Color
}

function windowTexture(kind: 'cool' | 'warm' | 'mix'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const g = canvas.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 128, 256)
  const cols = 8
  const rows = 18
  const cw = 128 / cols
  const ch = 256 / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (Math.random() < 0.42) continue
      const roll = Math.random()
      let color = '#f0d2b0'
      if (kind === 'cool') color = roll > 0.72 ? '#d5e4f5' : '#f2d3ae'
      else if (kind === 'warm') color = roll > 0.82 ? '#9ecfff' : '#ffc48a'
      else color = roll > 0.55 ? '#d5e4f5' : '#ffc48a'
      if (roll > 0.94) color = '#fff6e8'
      g.globalAlpha = 0.5 + Math.random() * 0.5
      g.fillStyle = color
      g.fillRect(x * cw + 2.2, y * ch + 2.4, cw - 4.4, ch - 5)
    }
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function signTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const g = canvas.getContext('2d')!
  g.fillStyle = '#120e0c'
  g.fillRect(0, 0, 512, 128)
  g.strokeStyle = color
  g.globalAlpha = 0.9
  g.lineWidth = 4
  g.strokeRect(8, 8, 496, 112)
  g.globalAlpha = 1
  g.fillStyle = color
  g.font = '600 54px Outfit, Segoe UI, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 66)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function groundTexture(): THREE.CanvasTexture {
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  g.fillStyle = '#14171c'
  g.fillRect(0, 0, size, size)
  const img = g.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 16) {
    const n = (Math.random() - 0.5) * 10
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
  }
  g.putImageData(img, 0, 0)
  const toPx = (w: number) => ((w - CITY.origin) / CITY.size) * size
  const road = 14
  const side = 5.5
  for (let i = 0; i <= CITY.count; i++) {
    const c = CITY.origin + i * CITY.cell
    const p = toPx(c)
    const rw = (road / CITY.size) * size
    const sw = ((road + side * 2) / CITY.size) * size
    g.fillStyle = '#2a2d33'
    g.fillRect(0, p - sw / 2, size, sw)
    g.fillRect(p - sw / 2, 0, sw, size)
    g.fillStyle = '#101318'
    g.fillRect(0, p - rw / 2, size, rw)
    g.fillRect(p - rw / 2, 0, rw, size)
  }
  g.strokeStyle = 'rgba(230,220,190,0.28)'
  g.lineWidth = 2
  g.setLineDash([10, 16])
  for (let i = 0; i <= CITY.count; i++) {
    const p = toPx(CITY.origin + i * CITY.cell)
    g.beginPath()
    g.moveTo(0, p)
    g.lineTo(size, p)
    g.stroke()
    g.beginPath()
    g.moveTo(p, 0)
    g.lineTo(p, size)
    g.stroke()
  }
  g.setLineDash([])
  const plaza = toPx(0)
  const pr = (30 / CITY.size) * size
  g.fillStyle = '#3c3833'
  g.beginPath()
  g.arc(plaza, plaza, pr, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(231,161,90,0.45)'
  g.lineWidth = 3
  g.beginPath()
  g.arc(plaza, plaza, pr * 0.55, 0, Math.PI * 2)
  g.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export class City {
  readonly group = new THREE.Group()
  readonly blocks: Block[] = []
  readonly anchors: Anchor[] = []
  readonly solids: THREE.Object3D[] = []
  readonly spawn = new THREE.Vector3()
  readonly jun = new THREE.Vector3()
  readonly nia = new THREE.Vector3(2.2, 0, 10)
  readonly ivo = new THREE.Vector3()
  readonly mara = new THREE.Vector3()
  readonly beacons: Spot[] = []
  readonly extract = new THREE.Vector3()
  readonly fountain = new THREE.Vector3(0, 0, 0)
  private cars: Car[] = []
  private carMesh: THREE.InstancedMesh
  private headMesh: THREE.InstancedMesh
  private tailMesh: THREE.InstancedMesh
  private dummy = new THREE.Object3D()
  private water: THREE.Mesh
  private forward = new THREE.Vector3()

  constructor() {
    const rng = mulberry32(7)
    const box = new THREE.BoxGeometry(1, 1, 1)
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x2a2e34,
      roughness: 0.88,
      metalness: 0.18,
    })
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d22,
      roughness: 0.7,
      metalness: 0.4,
    })
    const windows = {
      cool: windowTexture('cool'),
      warm: windowTexture('warm'),
      mix: windowTexture('mix'),
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.size, CITY.size),
      new THREE.MeshStandardMaterial({
        map: groundTexture(),
        roughness: 0.62,
        metalness: 0.14,
        color: 0xffffff,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    ground.userData.buildingId = -1
    this.group.add(ground)
    this.solids.push(ground)

    let id = 0
    let spawnScore = Infinity
    let junScore = Infinity
    let extractH = -1
    const signs = ['GLASS MILE', 'NIGHT RELAY', 'FOUNDRY', 'LANTERN ROW', 'KEEP THE THREAD', 'ANTENNA', 'LOGIT', 'PLAZA']
    let signI = 0

    for (let i = 0; i < CITY.count; i++) {
      for (let j = 0; j < CITY.count; j++) {
        if (i === 5 && j === 5) continue
        let x = CITY.origin + (i + 0.5) * CITY.cell
        let z = CITY.origin + (j + 0.5) * CITY.cell
        const north = z < -70
        const south = z > 90
        const east = x > 80 && z > -50 && z < 140
        let h = 12 + rng() * 16
        if (north) h = 30 + rng() * 52
        else if (south) h = 16 + rng() * 28
        else if (east) h = 8 + rng() * 14
        else if (Math.hypot(x, z) < 130) h = Math.max(h, 18 + rng() * 22)
        const w = 20 + rng() * 10
        const d = 20 + rng() * 10
        const setback = rng() > 0.32 && h > 16
        const podiumH = setback ? h * (0.28 + rng() * 0.18) : h
        const kind = north ? 'cool' : east ? 'warm' : 'mix'
        const side = new THREE.MeshStandardMaterial({
          color: kind === 'cool' ? 0x8ea0b4 : kind === 'warm' ? 0xb08972 : 0x9aa3ad,
          roughness: 0.42,
          metalness: 0.55,
          emissive: new THREE.Color(kind === 'warm' ? '#ffc9a0' : '#f0d8c0'),
          emissiveIntensity: 0.95,
        })
        const map = windows[kind].clone()
        map.repeat.set(Math.max(2, w / 3.1), Math.max(2, h / 3.3))
        map.offset.set(rng(), rng())
        map.colorSpace = THREE.SRGBColorSpace
        side.emissiveMap = map

        const podium = new THREE.Mesh(box, [side, side, roofMat, roofMat, side, side])
        podium.scale.set(w, podiumH, d)
        podium.position.set(x, podiumH / 2, z)
        podium.castShadow = false
        podium.receiveShadow = true
        podium.userData.buildingId = id
        this.group.add(podium)
        this.solids.push(podium)

        const boxes = [
          new THREE.Box3(
            new THREE.Vector3(x - w / 2, 0, z - d / 2),
            new THREE.Vector3(x + w / 2, podiumH, z + d / 2),
          ),
        ]
        let roofY = podiumH
        let roofW = w
        let roofD = d
        if (setback) {
          const tw = w * (0.52 + rng() * 0.16)
          const td = d * (0.52 + rng() * 0.16)
          const ox = (rng() - 0.5) * (w - tw) * 0.4
          const oz = (rng() - 0.5) * (d - td) * 0.4
          const tower = new THREE.Mesh(box, [side, side, roofMat, roofMat, side, side])
          tower.scale.set(tw, h - podiumH, td)
          tower.position.set(x + ox, podiumH + (h - podiumH) / 2, z + oz)
          tower.receiveShadow = true
          tower.userData.buildingId = id
          this.group.add(tower)
          this.solids.push(tower)
          boxes.push(
            new THREE.Box3(
              new THREE.Vector3(x + ox - tw / 2, podiumH, z + oz - td / 2),
              new THREE.Vector3(x + ox + tw / 2, h, z + oz + td / 2),
            ),
          )
          roofY = h
          roofW = tw
          roofD = td
          this.addLedgeAnchors(id, x, z, w, d, podiumH)
          x += ox
          z += oz
        }

        this.addRoofAnchors(id, x, z, roofW, roofD, roofY)

        if (h > 42 && rng() > 0.4) {
          const armLen = 7 + rng() * 5
          const arm = new THREE.Mesh(box, darkMat)
          arm.scale.set(armLen, 0.28, 0.28)
          arm.position.set(x + roofW / 2 + armLen / 2 - 0.2, roofY + 0.8, z)
          this.group.add(arm)
          this.anchors.push({
            point: new THREE.Vector3(x + roofW / 2 + armLen, roofY + 1.3, z),
            buildingId: id,
          })
        }

        if (rng() > 0.55) {
          const ac = new THREE.Mesh(box, darkMat)
          ac.scale.set(1.6 + rng(), 0.7, 1.2 + rng())
          ac.position.set(x + (rng() - 0.5) * roofW * 0.3, roofY + 0.35, z + (rng() - 0.5) * roofD * 0.3)
          this.group.add(ac)
        }

        if (south && rng() > 0.45) {
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 6), darkMat)
          mast.position.set(x, roofY + 3, z)
          this.group.add(mast)
          this.anchors.push({
            point: new THREE.Vector3(x, roofY + 6.4, z),
            buildingId: id,
          })
        }

        if (signI < signs.length && h > 18 && rng() > 0.72) {
          const tex = signTexture(signs[signI], north ? '#d7ecff' : '#ffc48a')
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 2),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
          )
          const face = rng() > 0.5 ? 1 : -1
          sign.position.set(x, Math.min(h * 0.62, roofY - 2), z + face * (roofD / 2 + 0.08))
          if (face < 0) sign.rotation.y = Math.PI
          this.group.add(sign)
          signI++
        }

        const block: Block = { id, x, z, w: roofW, d: roofD, h: roofY, boxes }
        this.blocks.push(block)

        const spawnD = Math.hypot(x, z - 52)
        if (roofY > 14 && roofY < 34 && spawnD < spawnScore) {
          spawnScore = spawnD
          this.spawn.set(x, roofY, z)
        }
        const junD = Math.hypot(x + 50, z - 70)
        if (roofY > 16 && roofY < 32 && x < -15 && z > 20 && z < 120 && junD < junScore && spawnD > 8) {
          junScore = junD
          this.jun.set(x, roofY, z)
        }
        if (z < -150 && roofY > extractH) {
          extractH = roofY
          this.extract.set(x, roofY + 2.2, z)
        }
        id++
      }
    }

    if (this.jun.lengthSq() === 0) this.jun.copy(this.spawn).add(new THREE.Vector3(-20, 0, 10))
    this.placePeople(rng)
    this.addPlaza(darkMat)
    this.beacons = this.makeBeacons()
    this.addLamps()
    const traffic = this.addCars(rng)
    this.carMesh = traffic.body
    this.headMesh = traffic.head
    this.tailMesh = traffic.tail
    this.layoutCars()
    this.water = this.group.children.find((child) => child.name === 'water') as THREE.Mesh
  }

  private placePeople(rng: () => number): void {
    const roads: number[] = []
    for (let i = 1; i < CITY.count; i++) roads.push(CITY.origin + i * CITY.cell)
    const west = roads[2]
    const east = roads[8]
    this.ivo.copy(this.openSpot(west - 11, 18, rng))
    this.mara.copy(this.openSpot(east + 11, 36, rng))
  }

  private openSpot(x: number, z: number, rng: () => number): THREE.Vector3 {
    for (let n = 0; n < 8; n++) {
      const px = x + (n === 0 ? 0 : (rng() - 0.5) * 16)
      const pz = z + (n === 0 ? 0 : (rng() - 0.5) * 16)
      if (!this.insideBuilding(px, pz, 1.2)) return new THREE.Vector3(px, 0, pz)
    }
    return new THREE.Vector3(x, 0, z)
  }

  insideBuilding(x: number, z: number, pad: number): boolean {
    for (const block of this.blocks) {
      for (const box of block.boxes) {
        if (x > box.min.x - pad && x < box.max.x + pad && z > box.min.z - pad && z < box.max.z + pad) {
          if (box.max.y > 1) return true
        }
      }
    }
    return false
  }

  private makeBeacons(): Spot[] {
    const roads: number[] = []
    for (let i = 1; i < CITY.count; i++) roads.push(CITY.origin + i * CITY.cell)
    return [
      { name: 'Glass Mile', position: new THREE.Vector3(roads[5], 9, roads[2]) },
      { name: 'Lantern Row', position: new THREE.Vector3(roads[2], 9, roads[5]) },
      { name: 'Foundry', position: new THREE.Vector3(roads[8], 9, roads[6]) },
      { name: 'Antenna Ward', position: new THREE.Vector3(roads[6], 9, roads[8]) },
    ]
  }

  private addRoofAnchors(id: number, x: number, z: number, w: number, d: number, y: number): void {
    const o = 0.9
    const hy = y + 1.5
    const pts = [
      [x - w / 2 - o, hy, z - d / 2 - o],
      [x + w / 2 + o, hy, z - d / 2 - o],
      [x - w / 2 - o, hy, z + d / 2 + o],
      [x + w / 2 + o, hy, z + d / 2 + o],
      [x, hy, z - d / 2 - o],
      [x, hy, z + d / 2 + o],
      [x - w / 2 - o, hy, z],
      [x + w / 2 + o, hy, z],
    ]
    for (const p of pts) {
      this.anchors.push({ point: new THREE.Vector3(p[0], p[1], p[2]), buildingId: id })
    }
  }

  private addLedgeAnchors(id: number, x: number, z: number, w: number, d: number, y: number): void {
    const hy = y + 1.2
    const pts = [
      [x - w / 2 - 0.6, hy, z],
      [x + w / 2 + 0.6, hy, z],
      [x, hy, z - d / 2 - 0.6],
      [x, hy, z + d / 2 + 0.6],
    ]
    for (const p of pts) this.anchors.push({ point: new THREE.Vector3(p[0], p[1], p[2]), buildingId: id })
  }

  private addPlaza(dark: THREE.Material): void {
    const stone = new THREE.MeshStandardMaterial({ color: 0x6d675f, roughness: 0.72, metalness: 0.08 })
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.7, 24), stone)
    ring.position.set(0, 0.35, 0)
    ring.castShadow = true
    ring.receiveShadow = true
    this.group.add(ring)
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(2.7, 2.7, 0.28, 24),
      new THREE.MeshStandardMaterial({
        color: 0x1c3a44,
        roughness: 0.18,
        metalness: 0.2,
        emissive: new THREE.Color('#7fd0d2'),
        emissiveIntensity: 0.25,
      }),
    )
    water.position.set(0, 0.62, 0)
    water.name = 'water'
    this.group.add(water)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const tree = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 6), dark)
      trunk.position.y = 0.7
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x1d2a24, roughness: 0.85 }),
      )
      crown.position.y = 1.9
      crown.scale.y = 0.8
      tree.add(trunk, crown)
      tree.position.set(Math.cos(a) * 16, 0, Math.sin(a) * 16)
      this.group.add(tree)
    }
    const lamp = new THREE.MeshStandardMaterial({
      color: 0xd7fbff,
      emissive: new THREE.Color('#9be7ff'),
      emissiveIntensity: 1.4,
      roughness: 0.3,
      metalness: 0.2,
    })
    const masts: Array<[number, number, number]> = [
      [0, 40, 54],
      [16, 36, 50],
      [-16, 38, 48],
      [6, 12, 58],
      [-8, -6, 62],
      [20, -18, 56],
    ]
    for (const [x, z, h] of masts) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, h, 8), dark)
      pole.position.set(x, h / 2, z)
      pole.castShadow = true
      this.group.add(pole)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), lamp)
      head.position.set(x, h + 0.35, z)
      this.group.add(head)
      this.anchors.push({ point: new THREE.Vector3(x, h + 0.15, z), buildingId: -2 })
    }
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.6, metalness: 0.2 })
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.45), benchMat)
      bench.position.set(Math.cos(a) * 8.5, 0.48, Math.sin(a) * 8.5)
      bench.rotation.y = -a
      bench.castShadow = true
      this.group.add(bench)
    }
  }

  private addLamps(): THREE.InstancedMesh {
    const roads: number[] = []
    for (let i = 1; i < CITY.count; i += 2) roads.push(CITY.origin + i * CITY.cell)
    const positions: THREE.Vector3[] = []
    for (const x of roads) {
      for (const z of roads) positions.push(new THREE.Vector3(x, 0, z))
    }
    const pole = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.08, 0.1, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.7, roughness: 0.35 }),
      positions.length,
    )
    const bulb = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd7ae }),
      positions.length,
    )
    const dummy = new THREE.Object3D()
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 3, p.z)
      dummy.scale.set(1, 1, 1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      pole.setMatrixAt(i, dummy.matrix)
      dummy.position.set(p.x, 6.15, p.z)
      dummy.updateMatrix()
      bulb.setMatrixAt(i, dummy.matrix)
    })
    this.group.add(pole, bulb)
    return bulb
  }

  private addCars(rng: () => number): { body: THREE.InstancedMesh; head: THREE.InstancedMesh; tail: THREE.InstancedMesh } {
    const colors = [0xc5c8ce, 0x8d939c, 0xd8c3a5, 0x6e8ea8, 0xb06448, 0x24272c]
    for (let i = 1; i < CITY.count; i++) {
      const road = CITY.origin + i * CITY.cell
      if (rng() > 0.25) {
        this.cars.push({
          axis: 'x',
          fixed: road + (rng() > 0.5 ? 2.4 : -2.4),
          along: CITY.origin + rng() * CITY.size,
          dir: rng() > 0.5 ? 1 : -1,
          speed: 7 + rng() * 8,
          color: new THREE.Color(colors[Math.floor(rng() * colors.length)]),
        })
      }
      if (rng() > 0.25) {
        this.cars.push({
          axis: 'z',
          fixed: road + (rng() > 0.5 ? 2.4 : -2.4),
          along: CITY.origin + rng() * CITY.size,
          dir: rng() > 0.5 ? 1 : -1,
          speed: 7 + rng() * 8,
          color: new THREE.Color(colors[Math.floor(rng() * colors.length)]),
        })
      }
    }
    const n = this.cars.length
    const body = new THREE.InstancedMesh(
      new THREE.BoxGeometry(4.2, 0.7, 1.7),
      new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.65, vertexColors: false }),
      n,
    )
    body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    const head = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.2, 0.16, 1.3),
      new THREE.MeshBasicMaterial({ color: 0xfff1d6 }),
      n,
    )
    const tail = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.16, 0.14, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xff4d3a }),
      n,
    )
    this.cars.forEach((car, i) => body.setColorAt(i, car.color))
    this.group.add(body, head, tail)
    return { body, head, tail }
  }

  private layoutCars(): void {
    const min = CITY.origin + 8
    const max = -CITY.origin - 8
    this.cars.forEach((car, i) => {
      car.along += car.dir * car.speed * 0
      if (car.along > max) car.along = min
      if (car.along < min) car.along = max
      const x = car.axis === 'x' ? car.along : car.fixed
      const z = car.axis === 'z' ? car.along : car.fixed
      this.dummy.position.set(x, 0.48, z)
      this.dummy.rotation.set(0, car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI, 0)
      this.dummy.scale.set(1, 1, 1)
      this.dummy.updateMatrix()
      this.carMesh.setMatrixAt(i, this.dummy.matrix)
      this.forward.set(car.axis === 'x' ? car.dir : 0, 0, car.axis === 'z' ? car.dir : 0)
      this.dummy.position.set(x, 0.62, z).addScaledVector(this.forward, 2.05)
      this.dummy.updateMatrix()
      this.headMesh.setMatrixAt(i, this.dummy.matrix)
      this.dummy.position.set(x, 0.58, z).addScaledVector(this.forward, -2.05)
      this.dummy.updateMatrix()
      this.tailMesh.setMatrixAt(i, this.dummy.matrix)
    })
    this.carMesh.instanceMatrix.needsUpdate = true
    this.headMesh.instanceMatrix.needsUpdate = true
    this.tailMesh.instanceMatrix.needsUpdate = true
  }

  update(dt: number): void {
    const min = CITY.origin + 8
    const max = -CITY.origin - 8
    for (const car of this.cars) {
      car.along += car.dir * car.speed * dt
      if (car.along > max) car.along = min
      if (car.along < min) car.along = max
    }
    this.layoutCars()
    if (this.water) {
      const mat = this.water.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.22 + Math.sin(performance.now() * 0.0015) * 0.05
    }
  }

  nudgeCars(feet: THREE.Vector3, vel: THREE.Vector3, grounded: boolean): void {
    if (!grounded || feet.y > 1.4) return
    for (const car of this.cars) {
      const x = car.axis === 'x' ? car.along : car.fixed
      const z = car.axis === 'z' ? car.along : car.fixed
      const dx = feet.x - x
      const dz = feet.z - z
      if (Math.hypot(dx, dz) < 2.1) {
        const len = Math.hypot(dx, dz) || 1
        vel.x += (dx / len) * 6
        vel.z += (dz / len) * 6
      }
    }
  }

  districtAt(x: number, z: number): string {
    if (Math.hypot(x, z) < 48) return 'Central Plaza'
    if (z < -80 && Math.abs(x) < Math.abs(z) + 30) return 'Glass Mile'
    if (x < -80 && Math.abs(z) <= Math.abs(x) + 20) return 'Lantern Row'
    if (x > 90 && z < 150 && z > -40) return 'Foundry'
    if (z > 90) return 'Antenna Ward'
    return 'The wards'
  }
}
