import { spawn } from 'node:child_process'
import net from 'node:net'

const port = 47331
const preview = process.argv.includes('--preview')

const proxy = net.createServer((client) => {
  const upstream = net.connect({ port, host: '127.0.0.1' }, () => {
    client.pipe(upstream)
    upstream.pipe(client)
  })
  const drop = () => {
    client.destroy()
    upstream.destroy()
  }
  upstream.on('error', drop)
  client.on('error', drop)
})

await new Promise((resolve, reject) => {
  proxy.once('error', reject)
  proxy.listen({ port, host: '::1', ipv6Only: true }, resolve)
})

const args = preview
  ? ['vite', 'preview', '--host', '0.0.0.0', '--port', String(port), '--strictPort']
  : ['vite', '--host', '0.0.0.0', '--port', String(port), '--strictPort']

const child = spawn('npx', args, { stdio: 'inherit' })

const stop = () => {
  proxy.close()
  child.kill('SIGTERM')
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('exit', (code) => {
  proxy.close()
  process.exit(code ?? 0)
})
