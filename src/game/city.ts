import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { mulberry32 } from './rng'

function joinGeometry(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts)
  if (!merged) throw new Error('Could not build a city mesh')
  return merged
}

function facadeTrim(w: number, d: number, h: number, base: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const pier = new THREE.BoxGeometry(0.42, h, 0.42)
  const hx = w / 2 + 0.06
  const hz = d / 2 + 0.06
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(placeGeometry(pier, sx * hx, base + h / 2, sz * hz))
  }
  const courses = h > 16 ? [base + h * 0.38, base + h * 0.72] : [base + h * 0.55]
  for (const y of courses) {
    parts.push(placeGeometry(new THREE.BoxGeometry(w + 0.28, 0.28, d + 0.28), 0, y, 0))
  }
  return joinGeometry(parts)
}

function placeGeometry(geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const placed = geo.clone()
  placed.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  ))
  return placed
}

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
  const width = 256
  const height = 512
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')!
  g.fillStyle = '#14181e'
  g.fillRect(0, 0, width, height)
  const cols = 6
  const rows = 14
  const cw = width / cols
  const ch = height / rows
  g.fillStyle = '#2a313a'
  for (let x = 0; x <= cols; x++) g.fillRect(x * cw - 1.5, 0, 3, height)
  for (let y = 0; y <= rows; y++) g.fillRect(0, y * ch - 1.5, width, 3)
  for (let y = 0; y < rows; y++) {
    const store = y >= rows - 2
    for (let x = 0; x < cols; x++) {
      const roll = Math.random()
      const dark = roll < (store ? 0.08 : 0.38)
      let color = '#0c1016'
      if (!dark) {
        if (store) color = roll > 0.72 ? '#fff1d6' : kind === 'cool' ? '#d5e6f4' : '#ffc48a'
        else if (kind === 'cool') color = roll > 0.8 ? '#f3d7b4' : '#c9ddf0'
        else if (kind === 'warm') color = roll > 0.86 ? '#d5e6f4' : '#ffb27a'
        else color = roll > 0.5 ? '#d5e4f2' : '#ffc48a'
        if (roll > 0.93) color = '#fff8ee'
      }
      g.globalAlpha = dark ? 1 : 0.55 + Math.random() * 0.45
      g.fillStyle = color
      const padX = store ? 3 : 5
      const padY = store ? 4 : 6
      g.fillRect(x * cw + padX, y * ch + padY, cw - padX * 2, ch - padY * 2)
    }
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

type Ward = 'glass' | 'lantern' | 'foundry' | 'antenna' | 'inner'

const WARD_SIGN: Record<Exclude<Ward, 'inner'>, string> = {
  glass: 'GLASS MILE',
  lantern: 'LANTERN ROW',
  foundry: 'FOUNDRY',
  antenna: 'ANTENNA',
}

function wardAt(x: number, z: number): Ward {
  if (z < -80 && Math.abs(x) < Math.abs(z) + 30) return 'glass'
  if (x < -80 && Math.abs(z) <= Math.abs(x) + 20) return 'lantern'
  if (x > 90 && z < 150 && z > -40) return 'foundry'
  if (z > 90) return 'antenna'
  return 'inner'
}

const glassFinMat = new THREE.MeshStandardMaterial({
  color: 0xd5e6f5,
  metalness: 0.86,
  roughness: 0.12,
  emissive: new THREE.Color('#9ecfff'),
  emissiveIntensity: 0.55,
})
const hangBulbMat = new THREE.MeshBasicMaterial({ color: 0xffb15a })
const awningMat = new THREE.MeshStandardMaterial({
  color: 0x4a3020,
  emissive: new THREE.Color('#ff9a4a'),
  emissiveIntensity: 0.4,
  roughness: 0.55,
})
const dishMat = new THREE.MeshStandardMaterial({ color: 0xc5ced6, metalness: 0.72, roughness: 0.28 })
const mastTipMat = new THREE.MeshBasicMaterial({ color: 0xb7f3ff })

function signTexture(text: string, color: string): THREE.CanvasTexture {
  return billboardTexture(text, '', color)
}

function billboardTexture(title: string, line: string, ink: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = line ? 420 : 220
  const g = canvas.getContext('2d')!
  g.fillStyle = '#090b10'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.strokeStyle = ink
  g.lineWidth = 10
  g.strokeRect(16, 16, canvas.width - 32, canvas.height - 32)
  g.fillStyle = ink
  g.font = '700 132px Outfit, Segoe UI, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(title, canvas.width / 2, line ? 160 : canvas.height / 2)
  if (line) {
    g.globalAlpha = 0.78
    g.font = '500 52px Outfit, Segoe UI, sans-serif'
    g.fillText(line, canvas.width / 2, 290)
  }
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
  g.fillStyle = '#343840'
  g.fillRect(0, p - sw / 2, size, sw)
  g.fillRect(p - sw / 2, 0, sw, size)
  g.fillStyle = '#101318'
  g.fillRect(0, p - rw / 2, size, rw)
  g.fillRect(p - rw / 2, 0, rw, size)
  }
  g.save()
  g.globalCompositeOperation = 'source-atop'
  g.globalAlpha = 0.28
  g.fillStyle = '#163044'
  g.fillRect(0, 0, size, size * 0.36)
  g.fillStyle = '#3a2814'
  g.fillRect(0, size * 0.22, size * 0.32, size * 0.55)
  g.fillStyle = '#3a2216'
  g.fillRect(size * 0.64, size * 0.3, size * 0.36, size * 0.42)
  g.fillStyle = '#102028'
  g.fillRect(0, size * 0.64, size, size * 0.36)
  g.restore()
  g.strokeStyle = 'rgba(214, 220, 230, 0.42)'
  g.lineWidth = 2
  const rw = (road / CITY.size) * size
  for (let i = 0; i <= CITY.count; i++) {
    const p = toPx(CITY.origin + i * CITY.cell)
    const edge = rw / 2
    g.beginPath()
    g.moveTo(0, p - edge)
    g.lineTo(size, p - edge)
    g.moveTo(0, p + edge)
    g.lineTo(size, p + edge)
    g.moveTo(p - edge, 0)
    g.lineTo(p - edge, size)
    g.moveTo(p + edge, 0)
    g.lineTo(p + edge, size)
    g.stroke()
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
  g.fillStyle = 'rgba(232, 228, 218, 0.62)'
  for (let i = 1; i < CITY.count; i++) {
    for (let j = 1; j < CITY.count; j++) {
      if ((i + j) % 2 !== 0) continue
      const px = toPx(CITY.origin + i * CITY.cell)
      const pz = toPx(CITY.origin + j * CITY.cell)
      for (let s = -3; s <= 3; s++) {
        g.fillRect(px - rw * 0.36, pz + s * 6 - 1.5, rw * 0.72, 2.4)
        g.fillRect(px + s * 6 - 1.5, pz - rw * 0.36, 2.4, rw * 0.72)
      }
    }
  }
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
  readonly datacenter = new THREE.Vector3()
  readonly resetPad = new THREE.Vector3()
  readonly neuralink = new THREE.Vector3()
  readonly protest = new THREE.Vector3()
  readonly starlink = new THREE.Vector3()
  readonly chargers: THREE.Vector3[] = []
  private datacenterPick = Infinity
  private consoleLamps: THREE.Mesh[] = []
  private chargerLamps: THREE.Mesh[] = []
  private jobBeams: THREE.Mesh[] = []
  private chargerBeams: THREE.Mesh[] = []
  private dataBeam!: THREE.Mesh
  private starBeam!: THREE.Mesh
  private engineGlows: THREE.Mesh[] = []
  private dish: THREE.Mesh | null = null
  private dishLive = true
  private cars: Car[] = []
  private carParts: THREE.InstancedMesh[] = []
  private dummy = new THREE.Object3D()
  private water: THREE.Mesh
  private wardLights = new Map<string, THREE.PointLight>()

  constructor() {
    const rng = mulberry32(7)
    const box = new THREE.BoxGeometry(1, 1, 1)
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1c2128,
      roughness: 0.9,
      metalness: 0.22,
    })
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d22,
      roughness: 0.7,
      metalness: 0.4,
    })
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x9aa6b4,
      metalness: 0.88,
      roughness: 0.2,
      emissive: new THREE.Color('#b7c6d6'),
      emissiveIntensity: 0.22,
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
        roughness: 0.34,
        metalness: 0.32,
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
    let crownX = 0
    let crownY = 0
    let crownZ = 0
    let crownId = -1
    const brands: { name: string; line: string; ink: string }[] = [
      { name: 'TESLA', line: 'THE CAR IS THE GRID', ink: '#f4f4f2' },
      { name: 'SPACEX', line: 'THE SHIP IS SOUTH', ink: '#f7f7f7' },
      { name: 'NEURALINK', line: 'QUIET THE NOISE', ink: '#d7ecff' },
      { name: 'STARLINK', line: 'AIM THE DISH', ink: '#c5ddff' },
      { name: 'TESLA', line: 'LANTERN ROW STALLS', ink: '#e8e8e6' },
      { name: 'X', line: 'THE PLAZA IS LISTENING', ink: '#f2f2f2' },
      { name: 'SPACEX', line: 'STAINLESS OVER THE MASTS', ink: '#ffffff' },
      { name: 'NEURALINK', line: 'THE LINK STAYS UP', ink: '#b7d4ff' },
    ]
    let brandI = 0

    for (let i = 0; i < CITY.count; i++) {
      for (let j = 0; j < CITY.count; j++) {
        if (i === 5 && j === 5) continue
        let x = CITY.origin + (i + 0.5) * CITY.cell
        let z = CITY.origin + (j + 0.5) * CITY.cell
        const ward = wardAt(x, z)
        const north = ward === 'glass'
        const east = ward === 'foundry'
        let h = 14 + rng() * 16
        if (ward === 'glass') h = 34 + rng() * 46
        else if (ward === 'lantern') h = 8 + rng() * 10
        else if (ward === 'foundry') h = 7 + rng() * 11
        else if (ward === 'antenna') h = 14 + rng() * 16
        else if (Math.hypot(x, z) < 130) h = Math.max(h, 18 + rng() * 20)
        const w = 20 + rng() * 10
        const d = 20 + rng() * 10
        const setback = (ward === 'glass' ? rng() > 0.12 : ward === 'lantern' ? rng() > 0.78 : rng() > 0.32) && h > 16
        const podiumH = setback ? h * (0.28 + rng() * 0.18) : h
        const kind = north ? 'cool' : east || ward === 'lantern' ? 'warm' : 'mix'
        const side = new THREE.MeshStandardMaterial({
          color: kind === 'cool' ? 0x24303c : kind === 'warm' ? 0x3a2c28 : 0x2a3038,
          roughness: kind === 'cool' ? 0.18 : 0.46,
          metalness: kind === 'cool' ? 0.82 : 0.48,
          emissive: new THREE.Color(kind === 'warm' ? '#ffc9a0' : '#f4e2cc'),
          emissiveIntensity: ward === 'lantern' ? 1.45 : 1.15,
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
        const plinth = new THREE.Mesh(box, darkMat)
        plinth.scale.set(w + 0.7, 1.25, d + 0.7)
        plinth.position.set(x, 0.62, z)
        plinth.receiveShadow = true
        this.group.add(plinth)
        const trim = new THREE.Mesh(facadeTrim(w, d, podiumH, 0), trimMat)
        this.group.add(trim)
        if (ward === 'lantern' || ward === 'foundry') {
          const awning = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.7, 16), 0.08, 1.15), awningMat)
          awning.position.set(x, Math.min(3.4, podiumH * 0.42), z + d / 2 + 0.45)
          this.group.add(awning)
        }

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
          const towerTrim = new THREE.Mesh(facadeTrim(tw, td, h - podiumH, 0), trimMat)
          towerTrim.position.set(x + ox, podiumH, z + oz)
          this.group.add(towerTrim)
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

        this.addRoofAnchors(id, x, z, roofW, roofD, roofY, ward === 'antenna')
        this.dressRoof(ward, id, x, z, roofW, roofD, roofY, h, rng, box, darkMat)

        if (h > 42 && rng() > 0.4 && ward !== 'antenna' && ward !== 'foundry') {
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

        if (rng() > 0.35) {
          const ac = new THREE.Mesh(box, darkMat)
          ac.scale.set(1.6 + rng(), 0.7, 1.2 + rng())
          ac.position.set(x + roofW * 0.28, roofY + 0.4, z + roofD * 0.22)
          this.group.add(ac)
        }

        const brand = brandI < brands.length && h > 18 ? brands[brandI] : null
        const wardLabel = ward === 'inner' ? '' : WARD_SIGN[ward]
        const label = brand?.name || (h > 16 && rng() > 0.72 ? wardLabel : '')
        if (label) {
          if (brand) brandI++
          const ink = brand?.ink || (ward === 'glass' || ward === 'antenna' ? '#d7ecff' : '#ffc48a')
          const wide = Boolean(brand)
          const tex = brand ? billboardTexture(brand.name, brand.line, ink) : signTexture(label, ink)
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(wide ? 16 : 8, wide ? 6.4 : 2),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
          )
          const face = rng() > 0.5 ? 1 : -1
          sign.position.set(x, Math.min(h * 0.55, roofY - 3), z + face * (d / 2 + 0.12))
          if (face < 0) sign.rotation.y = Math.PI
          this.group.add(sign)
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
        if (roofY > 8) {
          const cornice = new THREE.Mesh(box, trimMat)
          cornice.scale.set(roofW + 0.9, 0.42, roofD + 0.9)
          cornice.position.set(x, roofY + 0.08, z)
          const lip = new THREE.Mesh(box, darkMat)
          lip.scale.set(roofW + 0.5, 0.28, 0.22)
          lip.position.set(x, roofY + 0.28, z - roofD / 2 - 0.15)
          this.group.add(cornice, lip)
        }

        if (ward === 'foundry' && roofY > 9 && roofY < 26) {
          const score = Math.abs(x - 150) + Math.abs(z - 50)
          if (score < this.datacenterPick) {
            this.datacenterPick = score
            this.datacenter.set(x, roofY + 0.5, z)
          }
        }
        if (ward === 'antenna' && roofY > 14 && roofY < 30 && this.starlink.y === 0) {
          this.starlink.set(x, roofY + 0.55, z)
        }
        if (ward === 'lantern' && this.chargers.length < 3 && roofY < 18) {
          const post = new THREE.Vector3(x, 1.5, z + d / 2 + 3.2)
          if (!this.insideBuilding(post.x, post.z, 0.4)) this.chargers.push(post)
        }

        if (z < -150 && roofY > extractH) {
          extractH = roofY
          crownX = x
          crownY = roofY
          crownZ = z
          crownId = id
          this.extract.set(x, roofY + 2.2, z)
        }
        id++
      }
    }

    if (crownId >= 0) this.raiseCrown(crownX, crownY, crownZ, crownId)
    if (this.jun.lengthSq() === 0) this.jun.copy(this.spawn).add(new THREE.Vector3(-20, 0, 10))
    this.finishJobSites(darkMat)
    this.placePeople(rng)
    this.dressSpots(darkMat)
    this.addPlaza(darkMat)
    this.beacons = this.makeBeacons()
    this.addWardLights()
    this.addLamps()
    this.addStarship()
    this.addCars(rng)
    this.layoutCars()
    this.water = this.group.children.find((child) => child.name === 'water') as THREE.Mesh
  }

  private finishJobSites(dark: THREE.Material): void {
    if (this.datacenter.y === 0) this.datacenter.set(140, 14, 48)
    this.protest.copy(this.openSpot(this.datacenter.x + 6, this.datacenter.z + 16, () => 0.42))
    this.neuralink.copy(this.openSpot(this.protest.x + 26, this.protest.z + 6, () => 0.4))
    this.resetPad.set(this.protest.x, 0, this.protest.z + 5)
    if (this.starlink.y === 0) this.starlink.set(36, 18, 170)
    while (this.chargers.length < 3) {
      const spot = this.openSpot(-150 + this.chargers.length * 22, 20, () => 0.35)
      spot.y = 1.5
      this.chargers.push(spot)
    }
    this.addOfficeRow(this.protest)
    this.addConsole(this.resetPad, dark, 'RESET', 'GROK BOT · CURSOR · DATACENTER', '#ffb15a')
    this.addDish(this.starlink)
    this.addConsole(this.starlink, dark, 'REALIGN', 'STARLINK', '#c5ddff')
    for (const post of this.chargers) this.addCharger(post)
    this.dataBeam = this.raiseColumn(this.resetPad.x, 0, this.resetPad.z, '#ffb15a', 46)
    this.starBeam = this.raiseColumn(this.starlink.x, this.starlink.y, this.starlink.z, '#c5ddff', 58)
    this.chargerBeams = this.chargers.map((post) => this.raiseColumn(post.x, 0, post.z, '#f4f4f2', 24))
    const support = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 3.4),
      new THREE.MeshBasicMaterial({
        map: billboardTexture('NEURALINK', 'WE SUPPORT NEURALINK', '#d7ecff'),
        side: THREE.DoubleSide,
      }),
    )
    support.position.set(this.neuralink.x, 4.2, this.neuralink.z)
    this.group.add(support)
  }

  private addOfficeRow(at: THREE.Vector3): void {
    const offices = [
      { name: 'GROK BOT', line: 'THE COURIER', ink: '#f4f1ea' },
      { name: 'CURSOR', line: 'THE EDITOR', ink: '#d7ecff' },
      { name: 'DATACENTER', line: 'THE GRID', ink: '#ffb15a' },
    ]
    offices.forEach((office, i) => {
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(7.2, 3),
        new THREE.MeshBasicMaterial({
          map: billboardTexture(office.name, office.line, office.ink),
          side: THREE.DoubleSide,
        }),
      )
      board.position.set(at.x + (i - 1) * 8.2, 3.4, at.z)
      this.group.add(board)
    })
  }

  private raiseColumn(x: number, y: number, z: number, color: string, height: number): THREE.Mesh {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.7, height, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    beam.position.set(x, y + height / 2, z)
    beam.userData.open = true
    this.jobBeams.push(beam)
    this.group.add(beam)
    return beam
  }

  lightCharger(index: number): void {
    const lamp = this.chargerLamps[index]
    if (lamp) (lamp.material as THREE.MeshBasicMaterial).color.set('#9be7ff')
    this.closeColumn(this.chargerBeams[index], '#9be7ff')
  }

  sealConsole(which: 'data' | 'star'): void {
    const lamp = this.consoleLamps[which === 'data' ? 0 : 1]
    if (lamp) (lamp.material as THREE.MeshBasicMaterial).color.set('#e7a15a')
    this.closeColumn(which === 'data' ? this.dataBeam : this.starBeam, '#e7a15a')
    if (which === 'star') this.dishLive = false
  }

  private closeColumn(beam: THREE.Mesh | undefined, color: string): void {
    if (!beam) return
    beam.userData.open = false
    const mat = beam.material as THREE.MeshBasicMaterial
    mat.color.set(color)
    mat.opacity = 0.1
  }

  private addConsole(at: THREE.Vector3, dark: THREE.Material, title: string, line: string, ink: string): void {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.07, 8, 28),
      new THREE.MeshBasicMaterial({ color: ink }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.set(at.x, at.y + 0.06, at.z)
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.15, 0.45), dark)
    stand.position.set(at.x, at.y + 0.6, at.z)
    const button = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.08, 0.28),
      new THREE.MeshBasicMaterial({ color: ink }),
    )
    button.position.set(at.x, at.y + 1.2, at.z)
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 2),
      new THREE.MeshBasicMaterial({ map: billboardTexture(title, line, ink), side: THREE.DoubleSide }),
    )
    sign.position.set(at.x, at.y + 2.5, at.z)
    this.consoleLamps.push(button)
    this.group.add(ring, stand, button, sign)
  }

  private addDish(at: THREE.Vector3): void {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xc5ced6, metalness: 0.8, roughness: 0.25 }),
    )
    mast.position.set(at.x + 2.2, at.y + 1.1, at.z)
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0xe7eef5, metalness: 0.7, roughness: 0.22 }),
    )
    dish.rotation.x = 1.05
    dish.position.set(at.x + 2.2, at.y + 2.3, at.z)
    this.dish = dish
    this.group.add(mast, dish)
  }

  resetJobs(): void {
    this.dishLive = true
    this.reopen(this.dataBeam, '#ffb15a')
    this.reopen(this.starBeam, '#c5ddff')
    this.chargerBeams.forEach((beam) => this.reopen(beam, '#f4f4f2'))
    const inks = ['#ffb15a', '#c5ddff']
    this.consoleLamps.forEach((lamp, i) => (lamp.material as THREE.MeshBasicMaterial).color.set(inks[i] ?? '#f4f4f2'))
    this.chargerLamps.forEach((lamp) => (lamp.material as THREE.MeshBasicMaterial).color.set('#3a3a3a'))
  }

  private reopen(beam: THREE.Mesh | undefined, color: string): void {
    if (!beam) return
    beam.userData.open = true
    const mat = beam.material as THREE.MeshBasicMaterial
    mat.color.set(color)
    mat.opacity = 0.16
  }

  private addCharger(at: THREE.Vector3): void {
    const white = new THREE.MeshStandardMaterial({ color: 0xf3f3f1, roughness: 0.28, metalness: 0.35 })
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.7, 0.28), white)
    cabinet.position.set(at.x, 0.85, at.z)
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.15), white)
    canopy.position.set(at.x, 1.85, at.z)
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0xc4553a, roughness: 0.5 }),
    )
    cable.position.set(at.x + 0.28, 1.15, at.z)
    cable.rotation.z = 0.5
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x3a3a3a }),
    )
    lamp.position.set(at.x, 1.55, at.z + 0.16)
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.55),
      new THREE.MeshBasicMaterial({ map: billboardTexture('TESLA', 'CHARGE', '#f4f4f2'), side: THREE.DoubleSide }),
    )
    sign.position.set(at.x, 2.15, at.z)
    this.chargerLamps.push(lamp)
    this.group.add(cabinet, canopy, cable, lamp, sign)
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

  private addRoofAnchors(id: number, x: number, z: number, w: number, d: number, y: number, sparse: boolean): void {
    const o = 0.9
    const hy = y + 1.5
    const pts = [
      [x - w / 2 - o, hy, z - d / 2 - o],
      [x + w / 2 + o, hy, z - d / 2 - o],
      [x - w / 2 - o, hy, z + d / 2 + o],
      [x + w / 2 + o, hy, z + d / 2 + o],
    ]
    if (!sparse) {
      pts.push(
        [x, hy, z - d / 2 - o],
        [x, hy, z + d / 2 + o],
        [x - w / 2 - o, hy, z],
        [x + w / 2 + o, hy, z],
      )
    }
    for (const p of pts) {
      this.anchors.push({ point: new THREE.Vector3(p[0], p[1], p[2]), buildingId: id })
    }
  }

  private dressRoof(
    ward: Ward,
    id: number,
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    h: number,
    rng: () => number,
    box: THREE.BoxGeometry,
    dark: THREE.Material,
  ): void {
    if (ward === 'glass') {
      const finH = 5 + rng() * 7
      const fin = new THREE.Mesh(box, glassFinMat)
      fin.scale.set(0.16, finH, Math.max(4, d * 0.55))
      fin.position.set(x, y + finH / 2, z)
      this.group.add(fin)
      return
    }
    if (ward === 'lantern') {
      const hy = Math.min(7.2, Math.max(4.5, h * 0.45))
      for (const side of [-1, 1]) {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), dark)
        cord.position.set(x + side * (w / 2 - 0.3), hy + 0.55, z + d / 2 + 0.15)
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), hangBulbMat)
        bulb.position.set(x + side * (w / 2 - 0.3), hy, z + d / 2 + 0.15)
        this.group.add(cord, bulb)
      }
      return
    }
    if (ward === 'foundry') {
      const stackH = 9 + rng() * 7
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, stackH, 8), dark)
      stack.position.set(x - w * 0.16, y + stackH / 2, z - d * 0.1)
      const stack2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, stackH * 0.62, 8), dark)
      stack2.position.set(x + w * 0.18, y + stackH * 0.31, z + d * 0.12)
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), hangBulbMat)
      cap.position.set(x - w * 0.16, y + stackH + 0.15, z - d * 0.1)
      this.group.add(stack, stack2, cap)
      this.anchors.push({ point: new THREE.Vector3(x - w * 0.16, y + stackH + 0.6, z - d * 0.1), buildingId: id })
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, Math.max(6, w * 0.7), 6), dark)
      pipe.rotation.z = Math.PI / 2
      pipe.position.set(x, y + 0.45, z + d / 2 - 0.4)
      this.group.add(pipe)
      return
    }
    if (ward === 'antenna') {
      const mastH = 11 + rng() * 7
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, mastH, 6), dark)
      mast.position.set(x, y + mastH / 2, z)
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 12), dishMat)
      dish.rotation.x = 1.05
      dish.position.set(x + 0.2, y + mastH * 0.62, z)
      const sideA = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, mastH * 0.55, 5), dark)
      sideA.position.set(x - w * 0.28, y + mastH * 0.27, z + d * 0.2)
      const sideB = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, mastH * 0.4, 5), dark)
      sideB.position.set(x + w * 0.22, y + mastH * 0.2, z - d * 0.18)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mastTipMat)
      tip.position.set(x, y + mastH + 0.2, z)
      this.group.add(mast, dish, sideA, sideB, tip)
      this.anchors.push({ point: new THREE.Vector3(x, y + mastH + 0.4, z), buildingId: id })
    }
  }

  private raiseCrown(x: number, y: number, z: number, id: number): void {
    const steps = [7.2, 4.6, 2.4]
    let hy = y
    for (const span of steps) {
      const h = 2.4
      const step = new THREE.Mesh(new THREE.BoxGeometry(span, h, span), glassFinMat)
      step.position.set(x, hy + h / 2, z)
      this.group.add(step)
      hy += h
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 7, 6), glassFinMat)
    spire.position.set(x, hy + 3.5, z)
    const crownTip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mastTipMat)
    crownTip.position.set(x, hy + 7.15, z)
    this.group.add(spire, crownTip)
    this.anchors.push({ point: new THREE.Vector3(x, hy + 7.2, z), buildingId: id })
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.4, 0.18, 20),
      new THREE.MeshStandardMaterial({ color: 0xe7a15a, emissive: new THREE.Color('#e7a15a'), emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.4 }),
    )
    pad.position.set(x + 8, y + 0.2, z)
    this.group.add(pad)
    this.extract.set(x + 8, y + 0.45, z)
  }

  private dressSpots(dark: THREE.Material): void {
    const stall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.7), dark)
    stall.position.set(this.ivo.x + 1.35, 0.38, this.ivo.z)
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5), dark)
    hook.position.set(this.ivo.x + 1.35, 1.5, this.ivo.z + 0.2)
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), hangBulbMat)
    lantern.position.set(this.ivo.x + 1.35, 2.15, this.ivo.z + 0.2)
    this.group.add(stall, hook, lantern)
    const canopy = new THREE.MeshStandardMaterial({
      color: 0x4a3020,
      emissive: new THREE.Color('#ff9a4a'),
      emissiveIntensity: 0.4,
      roughness: 0.55,
    })
    for (let i = 0; i < 5; i++) {
      const px = this.ivo.x - 1.4 + i * 1.7
      const pz = this.ivo.z - 2.4
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 5), dark)
      post.position.set(px, 1.6, pz)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), hangBulbMat)
      bulb.position.set(px, 3.35, pz)
      this.group.add(post, bulb)
    }
    const awning = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.12, 1.5), canopy)
    awning.position.set(this.ivo.x + 2, 3.4, this.ivo.z - 2.4)
    this.group.add(awning)

    const crateMat = new THREE.MeshStandardMaterial({ color: 0x6a4332, roughness: 0.82, metalness: 0.08 })
    const spots = [
      [1.3, 0.35, 0],
      [1.3, 1.05, 0],
      [2.05, 0.35, 0.15],
    ]
    for (const [dx, dy, dz] of spots) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), crateMat)
      crate.position.set(this.mara.x + dx, dy, this.mara.z + dz)
      this.group.add(crate)
    }
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), dark)
    pipe.rotation.z = Math.PI / 2
    pipe.position.set(this.mara.x + 1.6, 0.5, this.mara.z + 0.9)
    this.group.add(pipe)
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
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe1b0 })
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const px = Math.cos(a) * 22
      const pz = Math.sin(a) * 22
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.4, 6), dark)
      pole.position.set(px, 2.2, pz)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bulbMat)
      bulb.position.set(px, 4.5, pz)
      this.group.add(pole, bulb)
    }
  }

  private addLamps(): THREE.InstancedMesh {
    const roads: number[] = []
    for (let i = 1; i < CITY.count; i += 2) roads.push(CITY.origin + i * CITY.cell)
    const positions: THREE.Vector3[] = []
    for (const x of roads) {
      for (const z of roads) positions.push(new THREE.Vector3(x, 0, z))
    }
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.7, roughness: 0.35 })
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 5.4, 6), metal, positions.length)
    const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.25, 0.07, 0.07), metal, positions.length)
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.1, 0.18), metal, positions.length)
    const bulb = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe1b8 }),
      positions.length,
    )
    const dummy = new THREE.Object3D()
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 2.7, p.z)
      dummy.scale.set(1, 1, 1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      pole.setMatrixAt(i, dummy.matrix)
      dummy.position.set(p.x + 0.55, 5.45, p.z)
      dummy.updateMatrix()
      arm.setMatrixAt(i, dummy.matrix)
      dummy.position.set(p.x + 1.15, 5.32, p.z)
      dummy.updateMatrix()
      head.setMatrixAt(i, dummy.matrix)
      dummy.position.set(p.x + 1.15, 5.2, p.z)
      dummy.updateMatrix()
      bulb.setMatrixAt(i, dummy.matrix)
    })
    this.group.add(pole, arm, head, bulb)
    return bulb
  }

  private addStarship(): void {
    const steel = new THREE.MeshStandardMaterial({
      color: 0xd7dbdf,
      metalness: 0.94,
      roughness: 0.24,
      emissive: new THREE.Color('#aeb6bf'),
      emissiveIntensity: 0.18,
    })
    const dark = new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.72, roughness: 0.38 })
    const ship = new THREE.Group()
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.35, 38, 24), steel)
    hull.position.y = 19
    const nose = new THREE.Mesh(new THREE.ConeGeometry(3.05, 11, 24), steel)
    nose.position.y = 43.5
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.38, 3.38, 0.35, 24), dark)
    band.position.y = 28
    const flapGeo = new THREE.BoxGeometry(0.28, 8, 3.4)
    const flapL = new THREE.Mesh(flapGeo, dark)
    flapL.position.set(-3.7, 11, 0.2)
    flapL.rotation.z = 0.18
    const flapR = flapL.clone()
    flapR.position.x = 3.7
    flapR.rotation.z = -0.18
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.2, 2.6), dark)
    finL.position.set(-3.4, 34, 0)
    const finR = finL.clone()
    finR.position.x = 3.4
    const glass = new THREE.MeshStandardMaterial({
      color: 0x1a2430,
      metalness: 0.2,
      roughness: 0.12,
      emissive: new THREE.Color('#9ecfff'),
      emissiveIntensity: 0.4,
    })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.42), glass)
      win.position.set(Math.sin(a) * 3.28, 24, Math.cos(a) * 3.28)
      win.rotation.y = a
      ship.add(win)
    }
    ship.add(hull, nose, band, flapL, flapR, finL, finR)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.95, 1.7, 12), dark)
      bell.position.set(Math.cos(a) * 1.35, 0.3, Math.sin(a) * 1.35)
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xfff3c8 }),
      )
      glow.position.set(bell.position.x, -0.55, bell.position.z)
      this.engineGlows.push(glow)
      ship.add(bell, glow)
    }
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.4),
      new THREE.MeshBasicMaterial({ map: signTexture('SPACEX', '#f4f6f8'), side: THREE.DoubleSide }),
    )
    mark.position.set(0, 22, 3.4)
    ship.add(mark)
    ship.position.set(24, 28, 188)
    this.group.add(ship)
  }

  private addCars(rng: () => number): void {
    const colors = [0xf4f4f2, 0xc8cbcf, 0x1b1e22, 0x8d1e24, 0x163a66, 0xe4e0d8]
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
    const body = joinGeometry([
      placeGeometry(new THREE.BoxGeometry(1.86, 0.32, 4.35), 0, 0.4, 0.05),
      placeGeometry(new THREE.BoxGeometry(1.78, 0.1, 1.55), 0, 0.52, 1.15),
      placeGeometry(new THREE.BoxGeometry(1.82, 0.16, 0.35), 0, 0.3, 2.05),
      placeGeometry(new THREE.BoxGeometry(1.82, 0.16, 0.28), 0, 0.32, -2.1),
    ])
    const cabin = joinGeometry([
      placeGeometry(new THREE.BoxGeometry(1.68, 0.34, 2.15), 0, 0.68, -0.15),
      placeGeometry(new THREE.BoxGeometry(1.55, 0.22, 1.15), 0, 0.86, -0.55),
    ])
    const wheel = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 8)
    const wheels = joinGeometry([
      placeGeometry(wheel, -0.84, 0.32, 1.25, 0, 0, Math.PI / 2),
      placeGeometry(wheel, 0.84, 0.32, 1.25, 0, 0, Math.PI / 2),
      placeGeometry(wheel, -0.84, 0.32, -1.25, 0, 0, Math.PI / 2),
      placeGeometry(wheel, 0.84, 0.32, -1.25, 0, 0, Math.PI / 2),
    ])
    const bar = new THREE.BoxGeometry(1.52, 0.06, 0.05)
    const heads = placeGeometry(bar, 0, 0.46, 2.16)
    const tails = placeGeometry(bar, 0, 0.48, -2.16)
    const paint = new THREE.InstancedMesh(
      body,
      new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.42 }),
      n,
    )
    paint.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    const glass = new THREE.InstancedMesh(
      cabin,
      new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.82 }),
      n,
    )
    const rubber = new THREE.InstancedMesh(
      wheels,
      new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.85, metalness: 0.15 }),
      n,
    )
    const front = new THREE.InstancedMesh(heads, new THREE.MeshBasicMaterial({ color: 0xfff3d2 }), n)
    const rear = new THREE.InstancedMesh(tails, new THREE.MeshBasicMaterial({ color: 0xff3b32 }), n)
    const throwGeo = placeGeometry(new THREE.ConeGeometry(1.35, 8, 8, 1, true), 0, 0.42, 6.3, -Math.PI / 2)
    const beams = new THREE.InstancedMesh(
      throwGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfff1c4,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
      n,
    )
    this.cars.forEach((car, i) => paint.setColorAt(i, car.color))
    this.carParts = [paint, glass, rubber, front, rear, beams]
    this.group.add(paint, glass, rubber, front, rear, beams)
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
      this.dummy.position.set(x, 0, z)
      this.dummy.rotation.set(0, car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI, 0)
      this.dummy.scale.set(1, 1, 1)
      this.dummy.updateMatrix()
      for (const part of this.carParts) part.setMatrixAt(i, this.dummy.matrix)
    })
    for (const part of this.carParts) part.instanceMatrix.needsUpdate = true
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
    const time = performance.now() * 0.001
    if (this.water) {
      const mat = this.water.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.22 + Math.sin(time * 1.5) * 0.05
    }
    for (const beam of this.jobBeams) {
      if (!beam.userData.open) continue
      const mat = beam.material as THREE.MeshBasicMaterial
      mat.opacity = 0.1 + Math.sin(time * 2.4 + beam.position.x * 0.05) * 0.06
    }
    for (const glow of this.engineGlows) {
      const s = 0.82 + Math.sin(time * 7 + glow.position.x) * 0.22
      glow.scale.setScalar(s)
    }
    if (this.dish && this.dishLive) this.dish.rotation.y += dt * 0.6
  }

  nudgeCars(feet: THREE.Vector3, vel: THREE.Vector3, grounded: boolean): void {
    if (!grounded || feet.y > 1.4) return
    for (const car of this.cars) {
      const x = car.axis === 'x' ? car.along : car.fixed
      const z = car.axis === 'z' ? car.along : car.fixed
      const dx = feet.x - x
      const dz = feet.z - z
      if (Math.hypot(dx, dz) < 2.6) {
        const len = Math.hypot(dx, dz) || 1
        vel.x += (dx / len) * 6
        vel.z += (dz / len) * 6
      }
    }
  }

  ignite(name: string): void {
    const light = this.wardLights.get(name)
    if (!light) return
    light.intensity = 26
    light.distance = 96
  }

  private addWardLights(): void {
    for (const beacon of this.beacons) {
      const warm = beacon.name === 'Foundry' || beacon.name === 'Lantern Row'
      const light = new THREE.PointLight(warm ? 0xffb15a : 0x9ecfff, 6, 70, 2)
      light.position.set(beacon.position.x, beacon.position.y + 10, beacon.position.z)
      this.group.add(light)
      this.wardLights.set(beacon.name, light)
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
