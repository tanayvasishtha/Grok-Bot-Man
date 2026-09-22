export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private windGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private humGain: GainNode | null = null
  private fountainGain: GainNode | null = null
  private droneGain: GainNode | null = null
  private droneOsc: OscillatorNode | null = null
  volume = 0.75
  private started = false

  constructor() {
    const saved = localStorage.getItem('gbm-volume')
    if (saved !== null) {
      const n = Number(saved)
      if (Number.isFinite(n)) this.volume = Math.max(0, Math.min(1, n))
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    localStorage.setItem('gbm-volume', String(this.volume))
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05)
    }
  }

  ensure(): void {
    if (this.started) {
      if (this.ctx?.state === 'suspended') void this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = this.volume
    master.connect(ctx.destination)
    this.master = master

    const noise = this.brownNoise()
    const wind = ctx.createBufferSource()
    wind.buffer = noise
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 240
    const windGain = ctx.createGain()
    windGain.gain.value = 0
    wind.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(master)
    wind.start()
    this.windGain = windGain
    this.windFilter = windFilter

    const hum = ctx.createBufferSource()
    hum.buffer = noise
    hum.loop = true
    const humFilter = ctx.createBiquadFilter()
    humFilter.type = 'lowpass'
    humFilter.frequency.value = 180
    const humGain = ctx.createGain()
    humGain.gain.value = 0.018
    hum.connect(humFilter)
    humFilter.connect(humGain)
    humGain.connect(master)
    hum.start()
    this.humGain = humGain

    const a = ctx.createOscillator()
    const b = ctx.createOscillator()
    a.type = 'sine'
    b.type = 'sine'
    a.frequency.value = 110
    b.frequency.value = 164.8
    const tone = ctx.createGain()
    tone.gain.value = 0.012
    a.connect(tone)
    b.connect(tone)
    tone.connect(master)
    a.start()
    b.start()

    const fount = ctx.createBufferSource()
    fount.buffer = noise
    fount.loop = true
    const fFilter = ctx.createBiquadFilter()
    fFilter.type = 'bandpass'
    fFilter.frequency.value = 500
    fFilter.Q.value = 0.6
    const fountainGain = ctx.createGain()
    fountainGain.gain.value = 0
    fount.connect(fFilter)
    fFilter.connect(fountainGain)
    fountainGain.connect(master)
    fount.start()
    this.fountainGain = fountainGain

    const droneOsc = ctx.createOscillator()
    droneOsc.type = 'sine'
    droneOsc.frequency.value = 74
    const droneGain = ctx.createGain()
    droneGain.gain.value = 0
    droneOsc.connect(droneGain)
    droneGain.connect(master)
    droneOsc.start()
    this.droneOsc = droneOsc
    this.droneGain = droneGain

    this.started = true
    void ctx.resume()
  }

  update(state: {
    speed: number
    plaza: number
    drone: number
    active: boolean
    quiet: boolean
  }): void {
    if (!this.ctx || !this.windGain || !this.windFilter || !this.fountainGain || !this.droneGain || !this.humGain) return
    const t = this.ctx.currentTime
    const hear = state.active ? 1 : 0
    const quiet = state.quiet ? 0.45 : 1
    const wind = Math.min(0.045, state.speed * 0.00065) * hear * quiet
    this.windGain.gain.setTargetAtTime(wind, t, 0.25)
    this.windFilter.frequency.setTargetAtTime(200 + Math.min(900, state.speed * 7), t, 0.3)
    const fount = state.plaza < 42 ? (1 - state.plaza / 42) * 0.028 * hear : 0
    this.fountainGain.gain.setTargetAtTime(fount, t, 0.3)
    const drone = state.drone < 36 ? (1 - state.drone / 36) * 0.03 * hear : 0
    this.droneGain.gain.setTargetAtTime(drone, t, 0.2)
    this.humGain.gain.setTargetAtTime(state.active ? 0.016 * quiet : 0.0, t, 0.4)
    if (this.droneOsc) this.droneOsc.frequency.setTargetAtTime(70 + Math.min(18, state.drone * 0.1), t, 0.3)
  }

  attach(): void {
    this.noiseBurst(0.09, 420, 0.035)
    this.tone(150, 0.08, 0.02, 'sine')
  }

  release(perfect: boolean): void {
    this.noiseBurst(perfect ? 0.16 : 0.1, perfect ? 520 : 360, perfect ? 0.04 : 0.028)
  }

  whiff(): void {
    this.tone(90, 0.06, 0.012, 'triangle')
  }

  zip(): void {
    this.noiseBurst(0.12, 300, 0.03)
  }

  pickup(step: number): void {
    const notes = [440, 523.25, 587.33, 659.25, 783.99]
    this.tone(notes[step % notes.length], 0.12, 0.022, 'sine')
  }

  beacon(): void {
    this.tone(220, 0.22, 0.02, 'sine')
    this.tone(330, 0.28, 0.016, 'sine')
  }

  win(): void {
    this.tone(220, 0.4, 0.02, 'sine')
    this.tone(330, 0.5, 0.016, 'sine')
    this.tone(440, 0.6, 0.014, 'sine')
  }

  damage(): void {
    this.sweep(140, 55, 0.22, 0.04)
  }

  wall(): void {
    this.tone(70, 0.09, 0.02, 'sine')
  }

  blip(): void {
    this.noiseBurst(0.035, 900, 0.012)
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType): void {
    if (!this.ctx || !this.master || this.volume <= 0.001) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private sweep(from: number, to: number, dur: number, gain: number): void {
    if (!this.ctx || !this.master || this.volume <= 0.001) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noiseBurst(dur: number, freq: number, gain: number): void {
    if (!this.ctx || !this.master || this.volume <= 0.001) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.brownNoise()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  private brownNoise(): AudioBuffer {
    const ctx = this.ctx!
    const length = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
    return buffer
  }
}
