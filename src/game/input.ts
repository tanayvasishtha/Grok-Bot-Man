export type FrameInput = {
  moveX: number
  moveY: number
  lookX: number
  lookY: number
  turnLeft: boolean
  turnRight: boolean
  turnUp: boolean
  turnDown: boolean
  swingHeld: boolean
  swingDown: boolean
  jump: boolean
  zip: boolean
  dive: boolean
  talk: boolean
  wheel: number
  pause: boolean
  pointerLocked: boolean
  rightHeld: boolean
  debug: boolean
}

const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export class Input {
  private keys = new Set<string>()
  private just = new Set<string>()
  private mouse = false
  private right = false
  private mouseDownEdge = false
  private rightEdge = false
  private wheel = 0
  private lookX = 0
  private lookY = 0
  private touchSwing = false
  private touchSwingWas = false
  private touchJump = false
  private touchZip = false
  private touchDive = false
  private touchTalk = false
  private stickX = 0
  private stickY = 0
  private lookTouch: { id: number; x: number; y: number } | null = null
  private stickTouch: { id: number; x: number; y: number } | null = null
  private prevPad = new Set<number>()

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault()
      if (!this.keys.has(e.code)) this.just.add(e.code)
      this.keys.add(e.code)
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.mouse = false
      this.right = false
    })
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse = true
        this.mouseDownEdge = true
      }
      if (e.button === 2) {
        this.right = true
        this.rightEdge = true
      }
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse = false
      if (e.button === 2) this.right = false
    })
    window.addEventListener('mousemove', (e) => {
      this.lookX += e.movementX
      this.lookY += e.movementY
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    window.addEventListener(
      'wheel',
      (e) => {
        this.wheel += e.deltaY
        if (document.pointerLockElement) e.preventDefault()
      },
      { passive: false },
    )

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false })
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false })
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e))
    canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e))

    document.querySelectorAll<HTMLElement>('[data-touch]').forEach((el) => {
      const kind = el.dataset.touch
      const down = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        if (kind === 'swing') this.touchSwing = true
        if (kind === 'jump') this.touchJump = true
        if (kind === 'zip') this.touchZip = true
        if (kind === 'dive') this.touchDive = true
        if (kind === 'talk') this.touchTalk = true
      }
      const up = (e: Event) => {
        e.preventDefault()
        if (kind === 'swing') this.touchSwing = false
        if (kind === 'dive') this.touchDive = false
      }
      el.addEventListener('pointerdown', down)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointerleave', up)
      el.addEventListener('pointercancel', up)
    })
  }

  private onTouchStart(e: TouchEvent): void {
    document.body.classList.add('touching')
    for (const touch of Array.from(e.changedTouches)) {
      const target = touch.target as HTMLElement
      if (target.closest('[data-touch]')) continue
      if (touch.clientX < window.innerWidth * 0.42) {
        this.stickTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY }
      } else if (!this.lookTouch) {
        this.lookTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY }
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      if (this.stickTouch && touch.identifier === this.stickTouch.id) {
        e.preventDefault()
        this.stickX = Math.max(-1, Math.min(1, (touch.clientX - this.stickTouch.x) / 52))
        this.stickY = Math.max(-1, Math.min(1, (touch.clientY - this.stickTouch.y) / 52))
      }
      if (this.lookTouch && touch.identifier === this.lookTouch.id) {
        e.preventDefault()
        this.lookX += touch.clientX - this.lookTouch.x
        this.lookY += touch.clientY - this.lookTouch.y
        this.lookTouch.x = touch.clientX
        this.lookTouch.y = touch.clientY
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      if (this.stickTouch && touch.identifier === this.stickTouch.id) {
        this.stickTouch = null
        this.stickX = 0
        this.stickY = 0
      }
      if (this.lookTouch && touch.identifier === this.lookTouch.id) this.lookTouch = null
    }
  }

  private dead(v: number): number {
    return Math.abs(v) < 0.18 ? 0 : v
  }

  snapshot(): FrameInput {
    let moveX = this.stickX
    let moveY = -this.stickY
    if (this.keys.has('KeyA')) moveX -= 1
    if (this.keys.has('KeyD')) moveX += 1
    if (this.keys.has('KeyW')) moveY += 1
    if (this.keys.has('KeyS')) moveY -= 1
    moveX = Math.max(-1, Math.min(1, moveX))
    moveY = Math.max(-1, Math.min(1, moveY))

    const pad = navigator.getGamepads?.()[0] ?? null
    let padJump = false
    let padZip = false
    let padTalk = false
    let padSwingEdge = false
    let padSwingHeld = false
    let padDive = false
    if (pad) {
      moveX = Math.max(-1, Math.min(1, moveX + this.dead(pad.axes[0] ?? 0)))
      moveY = Math.max(-1, Math.min(1, moveY + this.dead(-(pad.axes[1] ?? 0))))
      this.lookX += this.dead(pad.axes[2] ?? 0) * 26
      this.lookY += this.dead(pad.axes[3] ?? 0) * 20
      const pressed = new Set<number>()
      pad.buttons.forEach((button, i) => {
        if (button.pressed) pressed.add(i)
      })
      const edge = (i: number) => pressed.has(i) && !this.prevPad.has(i)
      padJump = edge(0)
      padZip = edge(1)
      padDive = pressed.has(2)
      padTalk = edge(3)
      padSwingHeld = pressed.has(5) || pressed.has(7)
      padSwingEdge = edge(5) || edge(7)
      this.prevPad = pressed
    }

    const touchSwingEdge = this.touchSwing && !this.touchSwingWas
    this.touchSwingWas = this.touchSwing

    const frame: FrameInput = {
      moveX,
      moveY,
      lookX: this.lookX,
      lookY: this.lookY,
      turnLeft: this.keys.has('ArrowLeft'),
      turnRight: this.keys.has('ArrowRight'),
      turnUp: this.keys.has('ArrowUp'),
      turnDown: this.keys.has('ArrowDown'),
      swingHeld: this.mouse || this.keys.has('KeyF') || this.touchSwing || padSwingHeld,
      swingDown: this.mouseDownEdge || this.just.has('KeyF') || touchSwingEdge || padSwingEdge,
      jump: this.just.has('Space') || this.touchJump || padJump,
      zip: this.just.has('ShiftLeft') || this.just.has('ShiftRight') || this.rightEdge || this.touchZip || padZip,
      dive: this.keys.has('ControlLeft') || this.keys.has('KeyC') || this.touchDive || padDive,
      talk: this.just.has('KeyE') || this.touchTalk || padTalk,
      wheel: this.wheel,
      pause: this.just.has('Escape'),
      pointerLocked: document.pointerLockElement === this.canvas,
      rightHeld: this.right,
      debug: this.just.has('F3'),
    }

    this.touchJump = false
    this.touchZip = false
    this.touchTalk = false
    this.lookX = 0
    this.lookY = 0
    this.wheel = 0
    this.mouseDownEdge = false
    this.rightEdge = false
    this.just.clear()
    return frame
  }
}
