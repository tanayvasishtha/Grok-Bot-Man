import { formatScore } from './math'

export type HudMode = 'menu' | 'play' | 'pause' | 'dialogue' | 'end'

export type HudView = {
  mode: HudMode
  score: number
  combo: number
  speed: number
  integrity: number
  objective: string
  detail: string
  relays: boolean[]
  clock: string
  prompt: string
  hint: string
  sling: string
  slingWindow: boolean
  anchorHot: boolean
  debug: string
  barks: { x: number; y: number; text: string }[]
  marker: { x: number; y: number; text: string; color: string } | null
  dialogue: { name: string; role: string; text: string; last: boolean } | null
  end: { title: string; copy: string; lines: string[]; win: boolean } | null
  best: string
  volume: number
  district: string
}

export class Hud {
  private root: HTMLElement
  private hud: HTMLElement
  private menu: HTMLElement
  private pause: HTMLElement
  private end: HTMLElement
  private dialogue: HTMLElement
  private barks: HTMLElement
  private barkNodes: HTMLDivElement[] = []
  private onAction: (action: string) => void = () => {}

  constructor() {
    this.root = document.getElementById('app')!
    this.hud = document.getElementById('hud')!
    this.menu = document.getElementById('menu')!
    this.pause = document.getElementById('pause')!
    this.end = document.getElementById('end')!
    this.dialogue = document.getElementById('dialogue')!
    this.barks = document.getElementById('barks')!
    for (let i = 0; i < 5; i++) {
      const node = document.createElement('div')
      node.className = 'bark'
      this.barks.appendChild(node)
      this.barkNodes.push(node)
    }
    this.root.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')
      if (!target) return
      this.onAction(target.dataset.action || '')
    })
    const volumes = document.querySelectorAll<HTMLInputElement>('[data-volume]')
    volumes.forEach((input) => {
      input.addEventListener('input', () => {
        this.onAction(`volume:${input.value}`)
        volumes.forEach((other) => {
          if (other !== input) other.value = input.value
        })
      })
    })
  }

  bind(fn: (action: string) => void): void {
    this.onAction = fn
  }

  render(view: HudView): void {
    this.menu.classList.toggle('hidden', view.mode !== 'menu')
    this.hud.classList.toggle('hidden', view.mode === 'menu')
    this.pause.classList.toggle('hidden', view.mode !== 'pause')
    this.end.classList.toggle('hidden', view.mode !== 'end')
    this.dialogue.classList.toggle('hidden', !view.dialogue)
    document.getElementById('touch')?.classList.toggle('hidden', view.mode !== 'play')

    const lights = document.getElementById('integrity')!
    lights.innerHTML = [0, 1, 2].map((i) => `<span class="${i < view.integrity ? 'on' : ''}"></span>`).join('')
    document.getElementById('obj-kicker')!.textContent = view.district
    document.getElementById('obj-text')!.textContent = view.objective
    document.getElementById('obj-detail')!.textContent = view.detail
    const relays = document.getElementById('relays')!
    relays.innerHTML = view.relays.map((on) => `<span class="${on ? 'lit' : ''}"></span>`).join('')
    relays.classList.toggle('hidden', view.relays.length === 0)
    document.getElementById('score')!.textContent = formatScore(view.score)
    const combo = document.getElementById('combo')!
    combo.textContent = view.combo > 1 ? `${view.combo}×` : ''
    document.getElementById('clock')!.textContent = view.clock
    document.getElementById('speed')!.textContent = String(Math.round(view.speed * 3.6))
    const prompt = document.getElementById('prompt')!
    prompt.classList.toggle('hidden', !view.prompt)
    prompt.textContent = view.prompt
    const hint = document.getElementById('hint')!
    hint.textContent = view.hint
    hint.classList.toggle('hidden', !view.hint)
    const reticle = document.getElementById('reticle')!
    reticle.classList.toggle('hot', view.anchorHot)
    reticle.classList.toggle('window', view.slingWindow)
    reticle.classList.toggle('hidden', view.mode !== 'play')
    const sling = document.getElementById('sling')!
    sling.textContent = view.sling
    sling.classList.toggle('show', Boolean(view.sling))
    document.getElementById('debug')!.textContent = view.debug
    document.getElementById('debug')!.classList.toggle('hidden', !view.debug)
    document.getElementById('best')!.textContent = view.best
    document.querySelectorAll<HTMLInputElement>('[data-volume]').forEach((input) => {
      if (document.activeElement !== input) input.value = String(view.volume)
    })

    const marker = document.getElementById('marker')!
    if (view.marker && view.mode === 'play') {
      marker.classList.remove('hidden')
      marker.style.left = `${view.marker.x}px`
      marker.style.top = `${view.marker.y}px`
      marker.style.color = view.marker.color
      marker.textContent = view.marker.text
    } else marker.classList.add('hidden')

    this.barkNodes.forEach((node, i) => {
      const bark = view.barks[i]
      node.classList.toggle('show', Boolean(bark))
      if (!bark) return
      node.style.left = `${bark.x}px`
      node.style.top = `${bark.y}px`
      node.textContent = bark.text
    })

    if (view.dialogue) {
      document.getElementById('dlg-name')!.textContent = view.dialogue.name
      document.getElementById('dlg-role')!.textContent = view.dialogue.role
      document.getElementById('dlg-text')!.textContent = view.dialogue.text
      document.getElementById('dlg-next')!.textContent = view.dialogue.last ? 'E  close' : 'E  continue'
    }

    if (view.end) {
      document.getElementById('end-kicker')!.textContent = view.end.win ? 'Circuit live' : 'Filament slack'
      document.getElementById('end-title')!.textContent = view.end.title
      document.getElementById('end-copy')!.textContent = view.end.copy
      document.getElementById('end-lines')!.innerHTML = view.end.lines.map((line) => `<li>${line}</li>`).join('')
    }

    const vignette = document.getElementById('vignette')!
    vignette.style.opacity = String(0.45 + Math.min(0.4, view.speed / 180))
  }

  toast(text: string): void {
    const host = document.getElementById('toasts')!
    const node = document.createElement('div')
    node.className = 'toast'
    node.textContent = text
    host.appendChild(node)
    requestAnimationFrame(() => node.classList.add('show'))
    window.setTimeout(() => {
      node.classList.remove('show')
      window.setTimeout(() => node.remove(), 400)
    }, 2800)
  }
}
