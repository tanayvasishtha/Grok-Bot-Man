import { Game } from './game/game'

const canvas = document.querySelector<HTMLCanvasElement>('#view')
if (!canvas) throw new Error('Missing the city canvas')

try {
  new Game(canvas)
} catch (err) {
  console.error(err)
  const note = document.createElement('p')
  note.className = 'lede'
  note.style.cssText = 'position:fixed;inset:auto 24px 24px 24px;z-index:5;color:#efeae2'
  note.textContent = err instanceof Error ? err.message : 'The city could not start.'
  document.body.appendChild(note)
}
