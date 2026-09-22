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

type CompanySite = 'tesla' | 'neuralink' | 'starlink' | 'x' | 'spacex' | 'launch'

function companyAt(i: number, j: number): CompanySite | null {
  if (i === 8 && j === 5) return 'tesla'
  if (i === 8 && j === 6) return 'neuralink'
  if (i === 7 && j === 8) return 'starlink'
  if (i === 3 && j === 2) return 'x'
  if (i === 5 && j === 9) return 'spacex'
  if (i === 6 && j === 9) return 'launch'
  return null
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

function wrapText(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (g.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else current = next
  }
  if (current) lines.push(current)
  return lines
}

function billboardTexture(title: string, line: string, ink: string, bg = '#090b10'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = line ? 512 : 220
  const g = canvas.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.strokeStyle = ink
  g.lineWidth = 10
  g.strokeRect(16, 16, canvas.width - 32, canvas.height - 32)
  g.fillStyle = ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const titleSize = title.length > 11 ? 84 : 112
  g.font = `700 ${titleSize}px Outfit, Segoe UI, sans-serif`
  g.fillText(title, canvas.width / 2, line ? 150 : canvas.height / 2)
  if (line) {
    g.globalAlpha = 0.88
    let size = 40
    g.font = `500 ${size}px Outfit, Segoe UI, sans-serif`
    let rows = wrapText(g, line, 920)
    while (rows.length > 3 && size > 26) {
      size -= 2
      g.font = `500 ${size}px Outfit, Segoe UI, sans-serif`
      rows = wrapText(g, line, 920)
    }
    rows.forEach((row, i) => g.fillText(row, canvas.width / 2, 300 + i * (size + 12)))
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

type Clad = 'giga' | 'hall' | 'stone' | 'lab' | 'link' | 'night' | 'shed'

function cladTexture(kind: Clad): THREE.CanvasTexture {
  const tall = kind === 'stone'
  const canvas = document.createElement('canvas')
  canvas.width = tall ? 256 : 512
  canvas.height = tall ? 512 : 256
  const g = canvas.getContext('2d')!
  if (kind === 'giga') {
    g.fillStyle = '#e7e7e2'
    g.fillRect(0, 0, 512, 256)
    g.strokeStyle = '#b7b7b0'
    g.lineWidth = 3
    for (let y = 16; y < 256; y += 18) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(512, y)
      g.stroke()
    }
    g.strokeStyle = '#9a9a94'
    for (let x = 0; x <= 512; x += 64) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, 256)
      g.stroke()
    }
    g.fillStyle = '#2e3338'
    for (let x = 8; x < 512; x += 52) g.fillRect(x, 210, 34, 40)
  } else if (kind === 'hall') {
    g.fillStyle = '#f2f3f1'
    g.fillRect(0, 0, 512, 256)
    g.fillStyle = '#d4d6d2'
    for (let x = 0; x < 512; x += 36) g.fillRect(x, 0, 5, 256)
    g.fillStyle = '#1b2834'
    g.fillRect(0, 96, 512, 78)
    for (let x = 10; x < 512; x += 28) {
      g.fillStyle = (x / 28) % 3 === 0 ? '#0c1218' : '#b9d4ea'
      g.fillRect(x, 108, 16, 52)
    }
  } else if (kind === 'stone') {
    g.fillStyle = '#cbb89e'
    g.fillRect(0, 0, 256, 512)
    g.fillStyle = '#b7a488'
    for (let x = 0; x <= 256; x += 32) g.fillRect(x, 0, 6, 512)
    for (let y = 18; y < 500; y += 36) {
      for (let x = 10; x < 250; x += 32) {
        const lit = (x + y) % 9 === 0
        g.fillStyle = lit ? '#ffd2a4' : '#2a241c'
        g.fillRect(x, y, 16, 22)
      }
    }
  } else if (kind === 'lab') {
    g.fillStyle = '#f5f6f4'
    g.fillRect(0, 0, 512, 256)
    g.fillStyle = '#7eb6e0'
    g.fillRect(0, 48, 512, 14)
    g.fillStyle = '#d5dde4'
    for (let x = 24; x < 500; x += 70) g.fillRect(x, 110, 36, 48)
    g.fillStyle = '#1a242e'
    for (let x = 30; x < 500; x += 70) g.fillRect(x, 118, 24, 32)
  } else if (kind === 'link') {
    g.fillStyle = '#101820'
    g.fillRect(0, 0, 512, 256)
    for (let y = 12; y < 244; y += 28) {
      for (let x = 10; x < 500; x += 32) {
        g.fillStyle = (x + y) % 5 === 0 ? '#d7ecff' : '#1a3344'
        g.fillRect(x, y, 18, 16)
      }
    }
  } else if (kind === 'night') {
    g.fillStyle = '#14161c'
    g.fillRect(0, 0, 512, 256)
    g.fillStyle = '#c9a27a'
    g.fillRect(0, 70, 512, 6)
    for (let y = 20; y < 230; y += 36) {
      for (let x = 16; x < 490; x += 40) {
        g.fillStyle = (x + y) % 7 === 0 ? '#ffc48a' : '#0c0e12'
        g.fillRect(x, y, 22, 18)
      }
    }
  } else {
    g.fillStyle = '#8d9399'
    g.fillRect(0, 0, 512, 256)
    g.fillStyle = '#6e757b'
    for (let y = 8; y < 256; y += 14) g.fillRect(0, y, 512, 4)
    g.fillStyle = '#2c3136'
    g.fillRect(0, 200, 512, 56)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

function cladMaterial(kind: Clad, rx: number, ry: number, glow: string, glowAmt: number): THREE.MeshStandardMaterial {
  const map = cladTexture(kind)
  map.repeat.set(rx, ry)
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    roughness: kind === 'link' || kind === 'night' ? 0.34 : 0.58,
    metalness: kind === 'giga' || kind === 'hall' ? 0.22 : 0.35,
    emissive: new THREE.Color(glow),
    emissiveMap: map,
    emissiveIntensity: glowAmt,
  })
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
  private neuralinkDoor = new THREE.Vector3()
  private starlinkRoof = new THREE.Vector3()
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
  private trackers: THREE.Object3D[] = []
  private padLight: THREE.PointLight | null = null
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
      { name: 'TESLA', line: "Accelerating the world's transition to sustainable energy", ink: '#e10600' },
      { name: 'SPACEX', line: 'Making life multiplanetary', ink: '#f7f7f7' },
      { name: 'NEURALINK', line: 'Restore autonomy. Unlock human potential.', ink: '#d7ecff' },
      { name: 'STARLINK', line: 'High-speed internet, anywhere on Earth', ink: '#c5ddff' },
      { name: 'X', line: 'The everything app', ink: '#f2f2f2' },
      { name: 'xAI', line: 'Understand the universe', ink: '#f4f1ea' },
    ]
    let brandI = 0

    for (let i = 0; i < CITY.count; i++) {
      for (let j = 0; j < CITY.count; j++) {
        if (i === 5 && j === 5) continue
        let x = CITY.origin + (i + 0.5) * CITY.cell
        let z = CITY.origin + (j + 0.5) * CITY.cell
        const site = companyAt(i, j)
        if (site) {
          this.buildCompany(site, id, x, z)
          id++
          continue
        }
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
            new THREE.PlaneGeometry(wide ? 18 : 8, wide ? 9 : 2),
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
    this.addCars(rng)
    this.layoutCars()
    this.water = this.group.children.find((child) => child.name === 'water') as THREE.Mesh
  }

  private finishJobSites(dark: THREE.Material): void {
    if (this.datacenter.y === 0) this.datacenter.set(140, 14, 48)
    this.protest.copy(this.openSpot(this.datacenter.x + 6, this.datacenter.z + 16, () => 0.42))
    this.neuralink.copy(this.neuralinkDoor.lengthSq() > 0 ? this.neuralinkDoor : this.openSpot(this.protest.x + 26, this.protest.z + 6, () => 0.4))
    this.resetPad.set(this.protest.x, 0, this.protest.z + 5)
    if (this.starlinkRoof.y > 0) this.starlink.copy(this.starlinkRoof)
    else if (this.starlink.y === 0) this.starlink.set(36, 18, 170)
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
  }

  private addOfficeRow(at: THREE.Vector3): void {
    const offices = [
      { name: 'GROK BOT', line: 'Understand the universe', ink: '#f4f1ea', body: 0x14161c, glass: 0xc9a27a },
      { name: 'CURSOR', line: 'The AI code editor', ink: '#d7ecff', body: 0x1a1e24, glass: 0x9ec4de },
      { name: 'DATACENTER', line: 'The training halls', ink: '#ffb15a', body: 0x8d9298, glass: 0x6a7278 },
    ]
    offices.forEach((office, i) => {
      const x = at.x + (i - 1) * 9.2
      let z = at.z - 5.5
      for (let n = 0; n < 6 && this.insideBuilding(x, z, 2.4); n++) z -= 3
      const h = 8.4
      const clad = i === 0 ? 'night' : i === 1 ? 'link' : 'shed'
      const body = cladMaterial(clad, 2, 2, i === 2 ? '#ffb15a' : '#d7ecff', 0.45)
      const glass = new THREE.MeshStandardMaterial({
        color: office.glass,
        roughness: 0.12,
        metalness: 0.4,
        emissive: new THREE.Color(office.glass),
        emissiveIntensity: 0.45,
      })
      this.boxSolid(820 + i, 7.4, h, 5.2, x, h / 2, z, body)
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.1, 1.3, 0.12), glass)
      band.position.set(x, 3.2, z + 2.66)
      this.group.add(band)
      if (i === 2) {
        for (let k = 0; k < 3; k++) {
          const chiller = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), body)
          chiller.position.set(x - 2 + k * 2, h + 0.55, z)
          this.group.add(chiller)
        }
      }
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.12), glass)
      door.position.set(x, 1.35, z + 2.68)
      this.group.add(door)
      this.addWordmark(x, 6.15, z + 2.78, 6.8, 3.4, office.name, office.line, office.ink, 0)
      this.blocks.push({
        id: 820 + i,
        x,
        z,
        w: 7.4,
        d: 5.2,
        h,
        boxes: [new THREE.Box3(new THREE.Vector3(x - 3.7, 0, z - 2.6), new THREE.Vector3(x + 3.7, h, z + 2.6))],
      })
      this.addRoofAnchors(820 + i, x, z, 7.4, 5.2, h, true)
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

  private boxSolid(
    id: number,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material | THREE.Material[],
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.userData.buildingId = id
    mesh.receiveShadow = true
    this.group.add(mesh)
    this.solids.push(mesh)
    return mesh
  }

  private addWordmark(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    title: string,
    line: string,
    ink: string,
    yaw: number,
    bg?: string,
  ): void {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: billboardTexture(title, line, ink, bg),
        side: THREE.DoubleSide,
      }),
    )
    sign.position.set(x, y, z)
    sign.rotation.y = yaw
    this.group.add(sign)
  }

  private buildCompany(site: CompanySite, id: number, x: number, z: number): void {
    if (site === 'launch') {
      this.addLaunchPad(id, x, z)
      return
    }
    const ink = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.55, metalness: 0.4 })
    const glass = new THREE.MeshStandardMaterial({
      color: 0xb7c9d6,
      roughness: 0.08,
      metalness: 0.45,
      emissive: new THREE.Color('#d5e6f4'),
      emissiveIntensity: 0.35,
    })
    if (site === 'tesla') {
      const w = 30
      const h = 14
      const d = 26
      this.boxSolid(id, w, h, d, x, h / 2, z, cladMaterial('giga', 3, 2, '#f4f4f2', 0.22))
      const lobby = new THREE.Mesh(new THREE.BoxGeometry(11, 8, 3.2), glass)
      lobby.position.set(x + 8, 4, z + d / 2 + 1.2)
      this.group.add(lobby)
      for (let k = -2; k <= 2; k++) {
        const dock = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 0.25), ink)
        dock.position.set(x + k * 5.2, 1.6, z - d / 2 - 0.1)
        this.group.add(dock)
      }
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.4, 0.35, 0.45),
        new THREE.MeshBasicMaterial({ color: 0xe10600 }),
      )
      stripe.position.set(x, h + 0.2, z + d / 2)
      this.group.add(stripe)
      this.addWordmark(x - 2, 9.2, z + d / 2 + 0.2, 16, 8, 'TESLA', "Accelerating the world's transition to sustainable energy", '#e10600', 0, '#f7f7f5')
      this.finishCompany(id, x, z, w, d, h)
      return
    }
    if (site === 'neuralink') {
      const w = 22
      const h = 9
      const d = 14
      this.boxSolid(id, w, h, d, x - 2, h / 2, z, cladMaterial('lab', 2, 1, '#f4f7fb', 0.2))
      this.boxSolid(id, 10, 7, 10, x + 10, 3.5, z + 2, cladMaterial('lab', 1, 1, '#d7ecff', 0.25))
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.35, d + 0.2), glass)
      band.position.set(x - 2, 6.6, z)
      this.group.add(band)
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(8, 0.14, 3.4), glass)
      canopy.position.set(x - 2, 3.5, z + d / 2 + 1.5)
      this.group.add(canopy)
      this.addWordmark(x - 2, 5.4, z + d / 2 + 0.16, 14, 7, 'NEURALINK', 'Restore autonomy. Unlock human potential.', '#1a1d22', 0, '#f4f7fb')
      this.neuralinkDoor.set(x - 2, 0, z + d / 2 + 4.2)
      this.finishCompany(id, x - 2, z, w, d, h)
      return
    }
    if (site === 'starlink') {
      const w = 28
      const h = 11
      const d = 18
      this.boxSolid(id, w, h, d, x, h / 2, z, cladMaterial('link', 3, 2, '#9ecfff', 0.4))
      const dishMatLocal = new THREE.MeshStandardMaterial({ color: 0xe7eef5, metalness: 0.65, roughness: 0.28 })
      const yard: Array<[number, number, number]> = []
      for (let k = 0; k < 8; k++) yard.push([-10 + (k % 4) * 6.4, h + 1.15, k < 4 ? -3 : 3])
      for (let k = 0; k < 5; k++) yard.push([-8 + k * 4, 1.15, d / 2 + 2.4])
      for (const [dx, yy, dz] of yard) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 6), dishMatLocal)
        mast.position.set(x + dx, yy - 0.45, z + dz)
        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 12), dishMatLocal)
        dish.rotation.x = 0.85
        dish.position.set(x + dx, yy, z + dz)
        this.trackers.push(dish)
        this.group.add(mast, dish)
      }
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.25, metalness: 0.4 }),
      )
      dome.scale.y = 0.72
      dome.position.set(x + 11, h + 1.1, z)
      this.group.add(dome)
      this.addWordmark(x, 7.6, z + d / 2 + 0.16, 15, 7.5, 'STARLINK', 'High-speed internet, anywhere on Earth', '#f4f7fb', 0)
      this.starlinkRoof.set(x - 4, h + 0.2, z)
      this.finishCompany(id, x, z, w, d, h)
      return
    }
    if (site === 'x') {
      const w = 30
      const h = 38
      const d = 18
      this.boxSolid(id, w, h, d, x, h / 2, z, cladMaterial('stone', 2, 3, '#ffd2a8', 0.28))
      const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.2 })
      for (const tilt of [0.55, -0.55]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.5, 0.4), black)
        arm.position.set(x, h - 7, z + d / 2 + 0.35)
        arm.rotation.z = tilt
        this.group.add(arm)
      }
      this.addWordmark(x, 12, z + d / 2 + 0.22, 14, 7, 'X', 'The everything app', '#f7f7f7', 0)
      this.finishCompany(id, x, z, w, d, h)
      return
    }
    const w = 16
    const h = 13
    const d = 30
    this.boxSolid(id, w, h, d, x, h / 2, z, cladMaterial('hall', 2, 2, '#f4f6f8', 0.18))
    for (let k = -3; k <= 3; k++) {
      const bay = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 3.2), ink)
      bay.position.set(x + w / 2 + 0.12, 2, z + k * 4)
      this.group.add(bay)
    }
    const roofGear = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 10), ink)
    roofGear.position.set(x, h + 0.7, z - 6)
    this.group.add(roofGear)
    this.addWordmark(
      x + w / 2 + 0.24,
      8.4,
      z + 2,
      18,
      9,
      'SPACEX',
      'Making life multiplanetary',
      '#16181c',
      -Math.PI / 2,
      '#f4f6f8',
    )
    this.finishCompany(id, x, z, w, d, h)
  }

  private finishCompany(id: number, x: number, z: number, w: number, d: number, h: number): void {
    this.blocks.push({
      id,
      x,
      z,
      w,
      d,
      h,
      boxes: [new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2))],
    })
    this.addRoofAnchors(id, x, z, w, d, h, false)
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.8, 0.42, d + 0.8),
      new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.55, metalness: 0.35 }),
    )
    lip.position.set(x, h + 0.12, z)
    this.group.add(lip)
  }

  private addLaunchPad(id: number, x: number, z: number): void {
    const concrete = new THREE.MeshStandardMaterial({ color: 0xc8c4bc, roughness: 0.94, metalness: 0.02 })
    const scorched = new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.97 })
    const steel = new THREE.MeshStandardMaterial({ color: 0xb7c0c8, metalness: 0.86, roughness: 0.24 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.7, roughness: 0.4 })
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 0.32, 48), concrete)
    pad.position.set(x, 0.16, z)
    pad.userData.buildingId = -1
    pad.receiveShadow = true
    this.group.add(pad)
    this.solids.push(pad)
    const paint = new THREE.Mesh(
      new THREE.RingGeometry(6.2, 7.4, 48),
      new THREE.MeshBasicMaterial({ color: 0xe7a15a, side: THREE.DoubleSide }),
    )
    paint.rotation.x = -Math.PI / 2
    paint.position.set(x, 0.34, z)
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.45, 32),
      new THREE.MeshBasicMaterial({ color: 0xf4f4f2, side: THREE.DoubleSide }),
    )
    inner.rotation.x = -Math.PI / 2
    inner.position.set(x, 0.35, z)
    this.group.add(paint, inner)
    const trench = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 20), scorched)
    trench.position.set(x, 0.36, z)
    this.group.add(trench)
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 14), steel)
      wall.position.set(x + side * 1.7, 1.5, z)
      wall.rotation.z = side * -0.55
      this.group.add(wall)
    }
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.1, 0.7, 20), dark)
    mount.position.set(x, 2.5, z)
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.6, 1.4, 16), steel)
    stool.position.set(x, 1.6, z)
    this.group.add(mount, stool)
    const deluge = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.16, 8, 28), steel)
    deluge.rotation.x = Math.PI / 2
    deluge.position.set(x, 3.15, z)
    this.group.add(deluge)
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), steel)
      pipe.position.set(x + Math.cos(a) * 5.4, 2.5, z + Math.sin(a) * 5.4)
      this.group.add(pipe)
    }

    const towerX = x + 10
    const towerH = 96
    const chords: THREE.BufferGeometry[] = []
    const half = 1.65
    const chordGeo = new THREE.CylinderGeometry(0.16, 0.22, towerH, 6)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        chords.push(placeGeometry(chordGeo, towerX + sx * half, towerH / 2, z + sz * half))
      }
    }
    for (let y = 4; y < towerH; y += 4.5) {
      chords.push(placeGeometry(new THREE.BoxGeometry(half * 2, 0.14, 0.14), towerX, y, z - half))
      chords.push(placeGeometry(new THREE.BoxGeometry(half * 2, 0.14, 0.14), towerX, y, z + half))
      chords.push(placeGeometry(new THREE.BoxGeometry(0.14, 0.14, half * 2), towerX - half, y, z))
      chords.push(placeGeometry(new THREE.BoxGeometry(0.14, 0.14, half * 2), towerX + half, y, z))
      const brace = new THREE.BoxGeometry(3.6, 0.1, 0.1)
      chords.push(placeGeometry(brace, towerX, y + 1.6, z - half, 0, 0, 0.7))
      chords.push(placeGeometry(brace, towerX, y + 1.6, z - half, 0, 0, -0.7))
    }
    const tower = new THREE.Mesh(joinGeometry(chords), steel)
    tower.userData.buildingId = id
    this.group.add(tower)
    this.solids.push(tower)
    for (const armY of [42, 66]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.55, 1.15), dark)
      arm.position.set(towerX - 2.8, armY, z)
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 2.2), dark)
      jaw.position.set(x + 4.7, armY, z)
      this.group.add(arm, jaw)
    }
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 16, 1.6), dark)
    carriage.position.set(towerX - 1.2, 54, z)
    this.group.add(carriage)
    this.addWordmark(towerX - 1.9, 28, z, 8, 4, 'SPACEX', 'Making life multiplanetary', '#f4f6f8', Math.PI / 2)
    this.addWordmark(x - 13.5, 6.5, z, 12, 6, 'SPACEX', 'Making life multiplanetary', '#16181c', Math.PI / 2, '#f4f6f8')
    for (const y of [18, 36, 52, 70, 88]) {
      this.anchors.push({ point: new THREE.Vector3(towerX, y, z + 2.4), buildingId: id })
    }

    const mastMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8 })
    for (const [dx, dz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]] as Array<[number, number]>) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 36, 6), dark)
      mast.position.set(x + dx, 18, z + dz)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mastMat)
      tip.position.set(x + dx, 36.4, z + dz)
      this.group.add(mast, tip)
      this.anchors.push({ point: new THREE.Vector3(x + dx, 35.5, z + dz), buildingId: -2 })
    }
    const tankPaint = new THREE.MeshStandardMaterial({ color: 0xf7f8f8, roughness: 0.32, metalness: 0.5 })
    const tanks = [
      { name: 'LOX', ink: '#7eb6e0', dx: -9 },
      { name: 'CH4', ink: '#e7a15a', dx: -5.2 },
      { name: 'N2', ink: '#f4f4f2', dx: -1.4 },
    ]
    for (const tank of tanks) {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 8.5, 14), tankPaint)
      shell.position.set(x + tank.dx, 4.3, z - 11)
      this.group.add(shell)
      this.addWordmark(x + tank.dx, 5.2, z - 9.4, 2.4, 0.7, tank.name, '', tank.ink, 0, '#1a1d22')
    }
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 3.4, 12), steel)
    water.position.set(x + 8, 9.2, z + 11)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 7.4, 8), dark)
    stem.position.set(x + 8, 3.7, z + 11)
    this.group.add(water, stem)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      if (Math.cos(a) < -0.45) continue
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), dark)
      post.position.set(x + Math.cos(a) * 15.2, 0.8, z + Math.sin(a) * 15.2)
      this.group.add(post)
    }
    const floodA = new THREE.PointLight(0xfff1d4, 3.2, 36, 2)
    floodA.position.set(x - 8, 18, z + 6)
    const floodB = new THREE.PointLight(0xd7ecff, 2.2, 40, 2)
    floodB.position.set(towerX, 70, z + 4)
    this.padLight = new THREE.PointLight(0xffe1a8, 2.4, 16, 2)
    this.padLight.position.set(x, 4.2, z)
    this.group.add(floodA, floodB, this.padLight)
    this.blocks.push({
      id,
      x: towerX,
      z,
      w: 4,
      d: 4,
      h: towerH,
      boxes: [
        new THREE.Box3(new THREE.Vector3(towerX - 2, 0, z - 2), new THREE.Vector3(towerX + 2, towerH, z + 2)),
        new THREE.Box3(new THREE.Vector3(x - 4.8, 0, z - 4.8), new THREE.Vector3(x + 4.8, 90, z + 4.8)),
      ],
    })
    this.addStarship(id, x, z)
  }

  private addStarship(id: number, x: number, z: number): void {
    const steel = new THREE.MeshStandardMaterial({
      color: 0xd5d9de,
      metalness: 0.94,
      roughness: 0.22,
      emissive: new THREE.Color('#c5ced6'),
      emissiveIntensity: 0.16,
    })
    const tile = new THREE.MeshStandardMaterial({ color: 0x16181b, metalness: 0.35, roughness: 0.78 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.72, roughness: 0.38 })
    const ship = new THREE.Group()
    const booster = new THREE.Mesh(new THREE.CylinderGeometry(4.05, 4.2, 40, 28), steel)
    booster.position.y = 22
    booster.userData.buildingId = id
    const bands = [8, 15, 22, 29, 36, 41.4].map((y) => placeGeometry(new THREE.CylinderGeometry(4.28, 4.28, 0.22, 28), 0, y, 0))
    const bandMesh = new THREE.Mesh(joinGeometry(bands), dark)
    const fins: THREE.BufferGeometry[] = []
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      fins.push(placeGeometry(new THREE.BoxGeometry(2.6, 3.1, 0.16), Math.cos(a) * 5.4, 37.2, Math.sin(a) * 5.4, 0.2, -a, 0))
    }
    const finMesh = new THREE.Mesh(joinGeometry(fins), dark)
    const bellGeo = new THREE.CylinderGeometry(0.26, 0.52, 1.25, 8)
    const bells: THREE.BufferGeometry[] = []
    const spots: Array<[number, number]> = [[0, 0]]
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      spots.push([Math.cos(a) * 1.45, Math.sin(a) * 1.45])
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.15
      spots.push([Math.cos(a) * 2.7, Math.sin(a) * 2.7])
    }
    for (const [gx, gz] of spots) {
      bells.push(placeGeometry(bellGeo, gx, 1.05, gz))
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xfff3c8 }),
      )
      glow.position.set(gx, 0.2, gz)
      this.engineGlows.push(glow)
      ship.add(glow)
    }
    const bellMesh = new THREE.Mesh(joinGeometry(bells), dark)
    const inter = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 4.15, 2.4, 24), dark)
    inter.position.y = 43
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.4, 30, 24), steel)
    hull.position.y = 59
    hull.userData.buildingId = id
    const belly = new THREE.Mesh(
      new THREE.CylinderGeometry(3.48, 3.62, 28, 18, 1, true, 0.15, Math.PI * 0.9),
      tile,
    )
    belly.position.y = 59
    const nose = new THREE.Mesh(new THREE.ConeGeometry(3.15, 11, 24), steel)
    nose.position.y = 79.5
    const header = new THREE.Mesh(new THREE.CylinderGeometry(3.22, 3.22, 0.45, 24), dark)
    header.position.y = 70
    const flapGeo = new THREE.BoxGeometry(0.2, 7.4, 3.2)
    const flaps = [
      [-3.7, 50, 0.22],
      [3.7, 50, -0.22],
      [-3.35, 71, 0.16],
      [3.35, 71, -0.16],
    ].map(([px, py, rz]) => {
      const flap = new THREE.Mesh(flapGeo, tile)
      flap.position.set(px, py, 0.15)
      flap.rotation.z = rz
      return flap
    })
    const glass = new THREE.MeshStandardMaterial({
      color: 0x1a2430,
      metalness: 0.2,
      roughness: 0.12,
      emissive: new THREE.Color('#9ecfff'),
      emissiveIntensity: 0.45,
    })
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.5), glass)
      win.position.set(Math.sin(a) * 3.32, 66, Math.cos(a) * 3.32)
      win.rotation.y = a
      ship.add(win)
    }
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 1.8),
      new THREE.MeshBasicMaterial({ map: signTexture('SPACEX', '#f4f6f8'), side: THREE.DoubleSide }),
    )
    mark.position.set(0, 24, 4.35)
    const shipMark = mark.clone()
    shipMark.position.set(0, 62, 3.45)
    ship.add(booster, bandMesh, finMesh, bellMesh, inter, hull, belly, nose, header, mark, shipMark, ...flaps)
    ship.position.set(x, 3.4, z)
    this.solids.push(booster, hull)
    this.group.add(ship)
    this.anchors.push(
      { point: new THREE.Vector3(x, 88, z), buildingId: id },
      { point: new THREE.Vector3(x + 5.6, 41, z), buildingId: id },
      { point: new THREE.Vector3(x - 5.6, 41, z), buildingId: id },
    )
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
      const s = 0.82 + Math.sin(time * 7 + glow.position.x * 3 + glow.position.z) * 0.22
      glow.scale.setScalar(s)
    }
    if (this.padLight) this.padLight.intensity = 2.1 + Math.sin(time * 2.5) * 0.45
    for (const dish of this.trackers) dish.rotation.y += dt * 0.2
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
