import * as THREE from 'three'
import { AudioBus } from './audio'
import { CameraRig } from './camera'
import { City } from './city'
import { conversation, type Line } from './dialogue'
import { Entities } from './entities'
import { Hero } from './hero'
import { Hud, type HudMode, type HudView } from './hud'
import { Input } from './input'
import { formatScore, formatTime } from './math'
import { Crowd, type Npc } from './npcs'
import { Player } from './player'
import { Stage } from './stage'

type Stats = {
  distance: number
  logits: number
  slings: number
  beacons: number
  talks: number
  near: number
  damage: number
  seconds: number
  fired: number
}

type Checkpoint = {
  pos: THREE.Vector3
  captured: boolean[]
  score: number
  combo: number
  stats: Stats
  integrity: number
}

type Talk = { npc: Npc; role: string; lines: Line[]; index: number }

const emptyStats = (): Stats => ({
  distance: 0, logits: 0, slings: 0, beacons: 0, talks: 0, near: 0, damage: 0, seconds: 0, fired: 0,
})

export class Game {
  private stage: Stage
  private city: City
  private hero: Hero
  private player: Player
  private crowd: Crowd
  private entities: Entities
  private input: Input
  private audio = new AudioBus()
  private hud: Hud
  private cameraRig = new CameraRig()
  private mode: HudMode = 'menu'
  private mission = false
  private score = 0
  private combo = 1
  private integrity = 3
  private stats = emptyStats()
  private checkpoint: Checkpoint
  private talk: Talk | null = null
  private talked = new Set<string>()
  private maraUsed = false
  private nightClear = false
  private datacenterDone = false
  private starlinkDone = false
  private chargersDone = [false, false, false]
  private slingText = ''
  private slingLife = 0
  private hintLife = 18
  private landing = 0
  private district = 'Central Plaza'
  private districtHold = ''
  private districtTime = 0
  private debug = false
  private win = false
  private logitStep = 0
  private last = performance.now()
  private cableSegs: THREE.Mesh[] = []
  private glowSegs: THREE.Mesh[] = []
  private marker: THREE.Mesh
  private cableMid = new THREE.Vector3()
  private segA = new THREE.Vector3()
  private segB = new THREE.Vector3()
  private dir = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)
  private proj = new THREE.Vector3()
  private reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas)
    this.city = new City()
    this.hero = new Hero()
    this.player = new Player(this.city.spawn)
    this.crowd = new Crowd(this.city)
    this.entities = new Entities(this.city)
    this.input = new Input(canvas)
    this.hud = new Hud()
    this.stage.scene.add(this.city.group, this.hero.root, this.entities.group)
    this.crowd.mount(this.stage.scene)

    const core = new THREE.MeshBasicMaterial({ color: 0xf4fdff })
    const glow = new THREE.MeshBasicMaterial({
      color: 0xbdf6ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const coreGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6)
    const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 6)
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Mesh(coreGeo, core)
      const haze = new THREE.Mesh(glowGeo, glow)
      seg.frustumCulled = false
      haze.frustumCulled = false
      seg.visible = false
      haze.visible = false
      this.cableSegs.push(seg)
      this.glowSegs.push(haze)
      this.stage.scene.add(seg, haze)
    }
    this.marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.9 }),
    )
    this.marker.visible = false
    this.stage.scene.add(this.marker)

    this.checkpoint = this.snap()
    this.cameraRig.yaw = this.player.yaw
    ;(window as unknown as { __gbm?: Game }).__gbm = this
    this.hud.bind((action) => this.action(action))
    canvas.addEventListener('click', () => {
      if (this.mode === 'play' && !this.talk) void canvas.requestPointerLock()
    })
    window.addEventListener('keydown', (e) => {
      if (this.mode === 'end' && e.code === 'Enter') this.restore(false)
    })
    requestAnimationFrame((t) => this.frame(t))
  }

  private snap(): Checkpoint {
    return {
      pos: this.player.pos.clone(),
      captured: this.entities.captured.map((v) => v),
      score: this.score,
      combo: this.combo,
      stats: { ...this.stats },
      integrity: this.integrity,
    }
  }

  private action(action: string): void {
    if (action.startsWith('volume:')) {
      this.audio.setVolume(Number(action.slice(7)) / 100)
      return
    }
    if (action === 'start') this.begin()
    if (action === 'resume') this.resume()
    if (action === 'pause') this.pause()
    if (action === 'retry') this.restore(false)
    if (action === 'roof') this.restore(true)
    if (action === 'menu') {
      this.mode = 'menu'
      this.talk = null
      document.exitPointerLock()
    }
  }

  private begin(): void {
    this.audio.ensure()
    this.restore(true)
    this.mode = 'play'
    this.hintLife = 18
    this.cameraRig.yaw = this.player.yaw
    this.cameraRig.pitch = -0.08
    this.cameraRig.snap(this.player.pos)
    const canvas = this.stage.renderer.domElement
    void canvas.requestPointerLock()
    this.hud.toast('Hold to swing. Release when the fall turns upward.')
  }

  private pause(): void {
    if (this.mode !== 'play' || this.talk) return
    this.mode = 'pause'
    document.exitPointerLock()
  }

  private resume(): void {
    if (this.mode !== 'pause') return
    this.audio.ensure()
    this.mode = 'play'
    void this.stage.renderer.domElement.requestPointerLock()
  }

  private restore(roof: boolean): void {
    const point = roof ? this.city.spawn : this.checkpoint.pos
    this.player.reset(point)
    if (roof) {
      this.mission = false
      this.score = 0
      this.combo = 1
      this.integrity = 3
      this.stats = emptyStats()
      this.entities.restore(this.city.beacons.map(() => false))
      this.talked.clear()
      this.maraUsed = false
      this.nightClear = false
      this.datacenterDone = false
      this.starlinkDone = false
      this.chargersDone = [false, false, false]
      this.city.resetJobs()
      this.crowd.resetProtest()
      this.checkpoint = this.snap()
    } else {
      this.score = this.checkpoint.score
      this.combo = this.checkpoint.combo
      this.integrity = Math.max(1, this.checkpoint.integrity)
      this.stats = { ...this.checkpoint.stats }
      this.entities.restore(this.checkpoint.captured)
      this.mission = this.checkpoint.captured.some(Boolean) || this.mission
    }
    this.win = false
    this.mode = 'play'
    this.talk = null
    this.cameraRig.yaw = this.player.yaw
    this.cameraRig.snap(this.player.pos)
    void this.stage.renderer.domElement.requestPointerLock()
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const input = this.input.snapshot()
    if (input.debug) this.debug = !this.debug

    let usedTalk = false
    if (this.talk) {
      if (input.talk || input.jump) {
        this.advance()
        usedTalk = true
      } else if (input.pause) this.closeTalk()
    } else if (input.pause) {
      if (this.mode === 'play') this.pause()
      else if (this.mode === 'pause') this.resume()
    }

    const simulate = this.mode === 'play' && !this.talk && this.landing <= 0
    const alive = this.mode === 'play' || this.mode === 'menu' || this.mode === 'dialogue'
    this.cameraRig.update(
      dt,
      simulate ? input : null,
      this.player.pos,
      this.player.vel,
      this.city.solids,
      this.mode === 'menu',
      this.reduceMotion,
      this.player.swinging,
    )
    if (simulate) this.stepPlay(dt, input, usedTalk)
    else if (this.landing > 0) {
      this.landing -= dt
      this.city.update(dt)
      this.player.pose(this.hero, this.cameraRig.yaw)
      if (this.landing <= 0) {
        this.mode = 'end'
        document.exitPointerLock()
      }
    } else if (alive) {
      this.city.update(dt)
      this.crowd.update(dt, { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, speed: 0, grounded: true }, this.talk?.npc.id ?? null)
      this.player.pose(this.hero, this.cameraRig.yaw)
    }
    this.stage.camera.fov = this.mode === 'menu' ? 58 : this.stage.camera.fov
    if (simulate) {
      this.cameraRig.update(dt, null, this.player.pos, this.player.vel, this.city.solids, false, this.reduceMotion, this.player.swinging)
    }
    this.cameraRig.apply(this.stage.camera, simulate ? this.player.speed : 0)
    this.stage.follow(this.player.pos.x, this.player.pos.y, this.player.pos.z)
    this.poseCable()
    if (this.slingLife > 0) this.slingLife -= dt
    const lineDist = this.player.swinging
      ? Math.hypot(this.player.pos.x - this.player.anchor.x, this.player.pos.y + 1 - this.player.anchor.y, this.player.pos.z - this.player.anchor.z)
      : 0
    const taut = this.player.swinging ? Math.max(0, Math.min(1, 1 - Math.max(0, this.player.rope - lineDist) / 6)) : 0
    this.audio.update({
      speed: simulate ? this.player.speed : 0,
      vy: simulate ? this.player.vel.y : 0,
      taut,
      swinging: simulate && this.player.swinging,
      zipping: simulate && this.player.zipping && this.player.swinging,
      sling: simulate && this.player.slingWindow,
      plaza: Math.hypot(this.player.pos.x, this.player.pos.z),
      drone: this.entities.closestDrone,
      active: this.mode !== 'menu',
      quiet: Boolean(this.talk) || this.mode === 'pause',
    })
    this.hud.render(this.view())
    this.stage.render()
    requestAnimationFrame((t) => this.frame(t))
  }

  private stepPlay(dt: number, input: Parameters<Player['update']>[1], usedTalk = false): void {
    const before = this.player.pos.clone()
    const flags = this.player.update(dt, input, this.cameraRig.yaw, this.cameraRig.lookDir, this.city, this.hero, this.audio)
    this.stats.distance += Math.hypot(this.player.pos.x - before.x, this.player.pos.z - before.z)
    if (flags.attached) this.stats.fired++
    if (flags.slung) {
      this.stats.slings++
      this.combo = Math.min(12, this.combo + 1)
      this.score += 160 * this.combo
      this.slingText = 'Sling'
      this.slingLife = 0.7
      this.hintLife = 0
      this.cameraRig.kick()
    }
    if (flags.hardLand && this.player.invuln <= 0) this.hurt()

    if (this.mission) this.touchChargers()
    if (input.talk && !usedTalk && this.tryConsole()) {
      // the roof button takes the press
    } else if (input.talk && !usedTalk) {
      const npc = this.crowd.nearest(this.player.pos.x, this.player.pos.y, this.player.pos.z, this.player.grounded, this.player.speed)
      if (npc) this.openTalk(npc)
    }

    const events = this.entities.update(dt, {
      x: this.player.pos.x,
      y: this.player.pos.y,
      z: this.player.pos.z,
      speed: this.player.speed,
      invuln: this.player.invuln,
    }, this.mission)
    let hurt = false
    for (const event of events) {
      if (event.t === 'logit') {
        this.stats.logits++
        this.score += 120 * this.combo
        this.audio.pickup(this.logitStep++)
      } else if (event.t === 'beacon') {
        this.stats.beacons++
        this.score += 900
        this.audio.beacon()
        this.city.ignite(event.name)
        this.hud.toast(`${event.name} is live`)
        this.noteNight()
        this.checkpoint = this.snap()
        this.checkpoint.pos.copy(this.player.pos)
      } else if (event.t === 'near') {
        this.stats.near++
        this.combo = Math.min(12, this.combo + 1)
        this.score += 70 * this.combo
      } else if (event.t === 'damage' && !hurt) {
        hurt = true
        this.hurt()
      } else if (event.t === 'extract') {
        this.winRun()
      } else if (event.t === 'extract-locked') {
        this.hud.toast('The pad is cold. Light the relays first.')
      }
    }

    if (this.mission && !this.win) this.stats.seconds += dt
    this.city.update(dt)
    this.crowd.update(dt, {
      x: this.player.pos.x,
      y: this.player.pos.y,
      z: this.player.pos.z,
      speed: this.player.speed,
      grounded: this.player.grounded,
    }, null)
    this.trackDistrict(dt)
    if (this.hintLife > 0) this.hintLife -= dt
  }

  private hurt(): void {
    if (this.player.invuln > 0 || this.win) return
    this.integrity -= 1
    this.stats.damage++
    this.combo = 1
    this.player.hit()
    this.audio.damage()
    if (this.integrity <= 0) {
      this.mode = 'end'
      document.exitPointerLock()
      this.storeBest(false)
    }
  }

  private winRun(): void {
    if (this.win) return
    this.win = true
    this.landing = 0.85
    this.player.settle()
    this.audio.win()
    const bonus = Math.floor(Math.max(0, 420 - this.stats.seconds) * 8)
    this.score += bonus
    this.storeBest(true)
  }

  private storeBest(won: boolean): void {
    const prev = Number(localStorage.getItem('gbm-best-score') || '0')
    if (this.score > prev) localStorage.setItem('gbm-best-score', String(Math.floor(this.score)))
    if (won) {
      const best = Number(localStorage.getItem('gbm-best-time') || '0')
      const ms = this.stats.seconds
      if (best === 0 || ms < best) localStorage.setItem('gbm-best-time', String(ms))
    }
  }

  private openTalk(npc: Npc): void {
    const script = conversation(npc.id, npc.name, npc.index, {
      mission: this.mission,
      integrity: this.integrity,
      maraUsed: this.maraUsed,
      beaconsLeft: this.entities.captured.filter((v) => !v).length,
      datacenterDone: this.datacenterDone,
      starlinkDone: this.starlinkDone,
      chargersLeft: this.chargersDone.filter((done) => !done).length,
    })
    this.talk = { npc, role: script.role, lines: script.lines, index: 0 }
    this.mode = 'dialogue'
    document.exitPointerLock()
    this.audio.blip()
    if (!this.talked.has(npc.id)) {
      this.talked.add(npc.id)
      this.stats.talks++
      this.score += 40
    }
  }

  private advance(): void {
    if (!this.talk) return
    this.audio.blip()
    if (this.talk.index < this.talk.lines.length - 1) {
      this.talk.index++
      return
    }
    this.finishTalk()
  }

  private closeTalk(): void {
    this.talk = null
    if (this.mode === 'dialogue') this.mode = 'play'
  }

  private finishTalk(): void {
    const npc = this.talk?.npc
    this.talk = null
    this.mode = 'play'
    if (!npc) return
    if (npc.id === 'nia' && !this.mission) {
      this.mission = true
      this.hud.toast('Relays marked. Any order.')
      this.checkpoint = this.snap()
    }
    if (npc.id === 'mara' && !this.maraUsed && this.integrity < 3) {
      this.maraUsed = true
      this.integrity = Math.min(3, this.integrity + 1)
      this.hud.toast('One sensor light restored.')
    }
  }

  private trackDistrict(dt: number): void {
    const name = this.city.districtAt(this.player.pos.x, this.player.pos.z)
    if (name === 'The wards') return
    if (name !== this.districtHold) {
      this.districtHold = name
      this.districtTime = 0
    } else this.districtTime += dt
    if (this.districtTime > 0.35 && name !== this.district) {
      this.district = name
      this.hud.toast(name)
    }
  }

  private poseCable(): void {
    const show = this.player.swinging
    if (show) {
      const hand = this.hero.handWorld
      const anchor = this.player.anchor
      const dist = Math.max(0.2, hand.distanceTo(anchor))
      const slack = Math.max(0, this.player.rope - dist)
      const tame = 1 - Math.min(1, this.player.speed / 28)
      const sag = Math.min(6.5, Math.max(0.12, 0.2 + tame * 2.4 + slack * 0.5))
      this.layCable(this.cableSegs, hand, anchor, sag)
      this.layCable(this.glowSegs, hand, anchor, sag)
    } else {
      for (const seg of this.cableSegs) seg.visible = false
      for (const seg of this.glowSegs) seg.visible = false
    }
    const hot = this.player.slingWindow
    const line = this.cableSegs[0]?.material as THREE.MeshBasicMaterial | undefined
    const haze = this.glowSegs[0]?.material as THREE.MeshBasicMaterial | undefined
    if (line) line.color.set(hot ? '#ffe7c4' : '#f4fdff')
    if (haze) haze.color.set(hot ? '#e7a15a' : '#bdf6ff')
    const preview = Boolean(this.player.preview) && this.mode === 'play'
    this.marker.visible = Boolean(preview)
    if (preview && this.player.preview) {
      this.marker.position.copy(this.player.preview.point)
      this.marker.rotation.y += 0.02
      const mark = this.marker.material as THREE.MeshBasicMaterial
      mark.color.set(hot ? '#e7a15a' : '#9be7ff')
    }
  }

  private layCable(segs: THREE.Mesh[], a: THREE.Vector3, b: THREE.Vector3, sag: number): void {
    this.cableMid.copy(a).lerp(b, 0.5)
    this.cableMid.y -= sag
    const n = segs.length
    for (let i = 0; i < n; i++) {
      this.pointOnCable(a, this.cableMid, b, i / n, this.segA)
      this.pointOnCable(a, this.cableMid, b, (i + 1) / n, this.segB)
      const seg = segs[i]
      this.dir.copy(this.segB).sub(this.segA)
      const len = Math.max(0.05, this.dir.length())
      seg.position.copy(this.segA).lerp(this.segB, 0.5)
      seg.scale.set(1, len, 1)
      const axis = this.dir.multiplyScalar(1 / len)
      if (axis.y < -0.999) seg.quaternion.set(1, 0, 0, 0)
      else seg.quaternion.setFromUnitVectors(this.up, axis)
      seg.visible = true
    }
  }

  private pointOnCable(a: THREE.Vector3, mid: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): void {
    const u = 1 - t
    out.set(0, 0, 0)
    out.addScaledVector(a, u * u)
    out.addScaledVector(mid, 2 * u * t)
    out.addScaledVector(b, t * t)
  }

  private nearSite(at: THREE.Vector3, reach: number, onFoot: boolean): boolean {
    const dxz = Math.hypot(this.player.pos.x - at.x, this.player.pos.z - at.z)
    const dy = Math.abs(this.player.pos.y - at.y)
    if (onFoot) return this.player.grounded && dxz < reach && dy < 3.2
    return dxz < reach && dy < 12
  }

  private touchChargers(): void {
    this.city.chargers.forEach((post, i) => {
      if (this.chargersDone[i] || !this.nearSite(post, 3.8, false)) return
      this.chargersDone[i] = true
      this.city.lightCharger(i)
      const n = this.chargersDone.filter(Boolean).length
      this.score += 280
      this.audio.pickup(n)
      this.hud.toast(n === 3 ? 'Tesla row is live.' : `Charger ${n}/3`)
      this.noteNight()
    })
  }

  private tryConsole(): boolean {
    if (!this.datacenterDone && this.nearSite(this.city.resetPad, 3.4, true)) {
      this.datacenterDone = true
      this.city.sealConsole('data')
      this.score += 800
      this.audio.beacon()
      this.crowd.disperseProtest()
      this.hud.toast('Reset taken. The crowd breaks up.')
      this.noteNight()
      return true
    }
    if (!this.starlinkDone && this.nearSite(this.city.starlink, 3.4, true)) {
      this.starlinkDone = true
      this.city.sealConsole('star')
      this.score += 800
      this.audio.beacon()
      this.hud.toast('Starlink dish is aimed again.')
      this.noteNight()
      return true
    }
    return false
  }

  private noteNight(): void {
    if (this.nightClear || !this.mission) return
    const relays = this.entities.captured.every(Boolean)
    const sides = this.datacenterDone && this.starlinkDone && this.chargersDone.every(Boolean)
    if (!relays || !sides) return
    this.nightClear = true
    this.hud.toast('The night is clear. Take the pad.')
  }

  private usePrompt(): string {
    if (!this.mission || !this.player.grounded) return ''
    if (!this.datacenterDone && this.nearSite(this.city.resetPad, 3.4, true)) return 'E   Reset'
    if (!this.starlinkDone && this.nearSite(this.city.starlink, 3.4, true)) return 'E   Realign'
    return ''
  }

  private objective(): { text: string; detail: string; pos: THREE.Vector3; color: string } {
    const colors = ['#9be7ff', '#ffb15a', '#ff7a4a', '#c9b6ff']
    if (this.stats.slings === 0) {
      const flying = this.stats.fired > 0
      return {
        text: flying ? 'Let go at the bottom' : 'Hold to catch a roof',
        detail: flying ? 'Release when the cable turns amber' : 'Mouse, F, or hold Swing',
        pos: this.player.pos,
        color: '#e7a15a',
      }
    }
    if (!this.mission) return { text: 'Speak with Nia Voss', detail: 'She is in the plaza, under you.', pos: this.city.nia, color: '#9be7ff' }
    let nearest = -1
    let best = Infinity
    this.entities.captured.forEach((done, i) => {
      if (done) return
      const p = this.city.beacons[i].position
      const d = Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z)
      if (d < best) {
        best = d
        nearest = i
      }
    })
    const lit = this.entities.captured.filter(Boolean).length
    const jobs: { text: string; detail: string; pos: THREE.Vector3; color: string; d: number }[] = []
    if (nearest >= 0) {
      const beacon = this.city.beacons[nearest]
      jobs.push({
        text: `Light the ${beacon.name} relay`,
        detail: `${lit}/4 · ${Math.round(best)} m`,
        pos: beacon.position,
        color: colors[nearest] ?? '#9be7ff',
        d: best,
      })
    }
    if (!this.datacenterDone) {
      const d = Math.hypot(this.city.resetPad.x - this.player.pos.x, this.city.resetPad.z - this.player.pos.z)
      jobs.push({ text: 'Reset in front of the offices', detail: `${Math.round(d)} m · Grok Bot, Cursor, Datacenter`, pos: this.city.resetPad, color: '#ffb15a', d })
    }
    if (!this.starlinkDone) {
      const d = Math.hypot(this.city.starlink.x - this.player.pos.x, this.city.starlink.z - this.player.pos.z)
      jobs.push({ text: 'Realign the Starlink dish', detail: `${Math.round(d)} m · E on the roof`, pos: this.city.starlink, color: '#c5ddff', d })
    }
    if (this.chargersDone.some((done) => !done)) {
      let d = Infinity
      let pos = this.city.chargers[0]
      this.city.chargers.forEach((post, i) => {
        if (this.chargersDone[i]) return
        const dist = Math.hypot(post.x - this.player.pos.x, post.z - this.player.pos.z)
        if (dist < d) {
          d = dist
          pos = post
        }
      })
      const n = this.chargersDone.filter(Boolean).length
      jobs.push({ text: 'Light the Tesla row', detail: `${n}/3 · ${Math.round(d)} m · Lantern Row`, pos, color: '#f4f4f2', d })
    }
    if (nearest < 0) {
      const d = Math.hypot(this.city.extract.x - this.player.pos.x, this.city.extract.z - this.player.pos.z)
      jobs.push({ text: 'Reach the extract pad', detail: `4/4 · ${Math.round(d)} m · Glass Mile roof`, pos: this.city.extract, color: '#e7a15a', d })
    }
    jobs.sort((a, b) => a.d - b.d)
    const job = jobs[0]
    return { text: job.text, detail: job.detail, pos: job.pos, color: job.color }
  }

  private screenMarker(pos: THREE.Vector3, text: string, color: string): { x: number; y: number; text: string; color: string } | null {
    this.proj.copy(pos).project(this.stage.camera)
    const behind = this.proj.z > 1
    if (behind) {
      this.proj.x *= -1
      this.proj.y *= -1
    }
    const ax = Math.abs(this.proj.x)
    const ay = Math.abs(this.proj.y)
    if (!behind && ax < 0.82 && ay < 0.82) return null
    const scale = Math.max(ax, ay, 0.001)
    this.proj.x = (this.proj.x / scale) * 0.86
    this.proj.y = (this.proj.y / scale) * 0.86
    return {
      x: (this.proj.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.proj.y * 0.5 + 0.5) * window.innerHeight,
      text,
      color,
    }
  }

  private view(): HudView {
    const goal = this.objective()
    const npc = this.mode === 'play'
      ? this.crowd.nearest(this.player.pos.x, this.player.pos.y, this.player.pos.z, this.player.grounded, this.player.speed)
      : null
    const barks = this.crowd.barks.slice(0, 5).map((bark) => {
      this.proj.copy(bark.world).project(this.stage.camera)
      return {
        x: (this.proj.x * 0.5 + 0.5) * window.innerWidth,
        y: (-this.proj.y * 0.5 + 0.5) * window.innerHeight,
        text: this.proj.z > 1 ? '' : bark.text,
      }
    }).filter((bark) => bark.text)
    const bestScore = localStorage.getItem('gbm-best-score')
    const bestTime = localStorage.getItem('gbm-best-time')
    const best = [
      bestScore ? `Best score ${formatScore(Number(bestScore))}` : '',
      bestTime ? `Best run ${formatTime(Number(bestTime))}` : '',
    ].filter(Boolean).join('  ·  ')
    const line = this.talk?.lines[this.talk.index]
    return {
      mode: this.mode,
      score: this.score,
      combo: this.combo,
      speed: this.player.speed,
      integrity: this.integrity,
      objective: goal.text,
      detail: goal.detail,
      relays: this.mission ? this.entities.captured.slice() : [],
      jobs: this.mission && this.stats.slings > 0
        ? [
            { text: 'Relays', done: this.entities.captured.every(Boolean) },
            { text: 'Datacenter', done: this.datacenterDone },
            { text: 'Starlink', done: this.starlinkDone },
            { text: 'Tesla', done: this.chargersDone.every(Boolean) },
          ]
        : [],
      clock: this.mission ? formatTime(this.stats.seconds) : '',
      prompt: this.usePrompt() || (npc ? `E   ${npc.name}` : ''),
      hint: this.stats.slings > 0 || this.mode !== 'play'
        ? ''
        : this.stats.fired === 0
          ? 'Hold left mouse, F, or Swing'
          : 'Release when the cable turns amber',
      sling: this.slingLife > 0 ? this.slingText : '',
      slingWindow: this.player.slingWindow,
      anchorHot: Boolean(this.player.preview) && !this.player.grounded,
      debug: this.debug
        ? `${this.player.swinging ? 'swing' : this.player.grounded ? 'ground' : 'air'}  ${this.player.speed.toFixed(1)} m/s  rope ${this.player.rope.toFixed(1)}`
        : '',
      barks,
      marker: this.mode === 'play' ? this.screenMarker(goal.pos, goal.text, goal.color) : null,
      dialogue: this.talk && line
        ? { name: line.speaker || this.talk.npc.name, role: this.talk.role, text: line.text, last: this.talk.index === this.talk.lines.length - 1 }
        : null,
      end: this.mode === 'end' ? this.endCard() : null,
      best: best || 'No finished run yet',
      volume: Math.round(this.audio.volume * 100),
      district: this.district,
    }
  }

  private endCard(): HudView['end'] {
    const lines = [
      `Score ${formatScore(this.score)}`,
      `Time ${formatTime(this.stats.seconds)}`,
      `Slings ${this.stats.slings}`,
      `Logits ${this.stats.logits}`,
      `Relays ${this.stats.beacons}/4`,
      `Hits ${this.stats.damage}`,
    ]
    if (this.win) {
      const rank = this.stats.damage === 0 && this.stats.seconds < 180 ? 'S' : this.stats.damage <= 1 ? 'A' : 'B'
      return {
        win: true,
        title: `Rank ${rank}`,
        copy: 'The relays are singing again. The city keeps its lights, and the plaza will pretend it never doubted you.',
        lines,
      }
    }
    return {
      win: false,
      title: 'Down',
      copy: 'The filament went slack. The circuit can wait one more night, which is not the same as being fine.',
      lines,
    }
  }
}
