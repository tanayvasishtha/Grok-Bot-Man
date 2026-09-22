import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import net from 'node:net'

const port = 47331
const preview = process.argv.includes('--preview')
const require = createRequire(import.meta.url)
const viteBin = require.resolve('vite/bin/vite.js')

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

const viteArgs = preview
  ? [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort']
  : [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort']

const child = spawn(process.execPath, viteArgs, { stdio: 'inherit' })

const stop = () => {
  proxy.close()
  child.kill('SIGTERM')
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('error', (err) => {
  console.error(err)
  stop()
  process.exit(1)
})
child.on('exit', (code) => {
  proxy.close()
  process.exit(code ?? 0)
})
