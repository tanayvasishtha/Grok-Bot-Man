import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'

export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly composer: EffectComposer
  private fxaa: ShaderPass
  private moon: THREE.DirectionalLight
  private moonTarget = new THREE.Object3D()

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene.background = new THREE.Color(0x070b12)
    this.scene.fog = new THREE.FogExp2(0x0b1018, 0.0042)
    this.scene.environmentIntensity = 0.72

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.12, 2200)

    const hemi = new THREE.HemisphereLight(0x8ea4c8, 0x2a2118, 0.55)
    this.scene.add(hemi)
    this.moon = new THREE.DirectionalLight(0xc5d4ff, 2.35)
    this.moon.castShadow = true
    this.moon.shadow.mapSize.set(2048, 2048)
    this.moon.shadow.bias = -0.00025
    this.moon.shadow.normalBias = 0.04
    const cam = this.moon.shadow.camera as THREE.OrthographicCamera
    cam.near = 1
    cam.far = 160
    cam.left = -42
    cam.right = 42
    cam.top = 42
    cam.bottom = -42
    this.scene.add(this.moon)
    this.scene.add(this.moonTarget)
    this.moon.target = this.moonTarget

    const fill = new THREE.DirectionalLight(0xffc7a2, 0.28)
    fill.position.set(40, 30, -20)
    this.scene.add(fill)
    const rim = new THREE.PointLight(0xffe1c4, 36, 16, 2)
    rim.position.set(0.5, 0.8, 1.4)
    this.camera.add(rim)
    this.scene.add(this.camera)

    this.addSky()

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.42, 0.84)
    this.composer.addPass(bloom)
    this.fxaa = new ShaderPass(FXAAShader)
    this.composer.addPass(this.fxaa)
    this.composer.addPass(new OutputPass())
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private addSky(): void {
    const geo = new THREE.SphereGeometry(1600, 32, 16)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { moon: { value: new THREE.Vector3(-0.45, 0.62, 0.28).normalize() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vP;
        uniform vec3 moon;
        void main(){
          vec3 n = normalize(vP);
          float h = clamp(n.y, 0.0, 1.0);
          vec3 col = mix(vec3(0.09, 0.11, 0.16), vec3(0.012, 0.018, 0.04), smoothstep(0.0, 0.62, h));
          float disc = pow(max(dot(n, moon), 0.0), 220.0);
          float glow = pow(max(dot(n, moon), 0.0), 6.0);
          col += vec3(0.85, 0.9, 1.0) * disc + vec3(0.18, 0.22, 0.34) * glow * 0.45;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    this.scene.add(new THREE.Mesh(geo, mat))
    const stars = new THREE.BufferGeometry()
    const count = 700
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const y = 0.15 + Math.random() * 0.85
      const t = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const rad = 1400
      pos[i * 3] = Math.cos(t) * r * rad
      pos[i * 3 + 1] = y * rad
      pos[i * 3 + 2] = Math.sin(t) * r * rad
    }
    stars.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const points = new THREE.Points(
      stars,
      new THREE.PointsMaterial({ color: 0xd5e4ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.75 }),
    )
    this.scene.add(points)
  }

  follow(x: number, y: number, z: number): void {
    this.moon.position.set(x - 48, y + 86, z + 32)
    this.moonTarget.position.set(x, y + 4, z)
  }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    const pr = Math.min(window.devicePixelRatio, 1.6)
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(pr)
    this.composer.setSize(w, h)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    const uniforms = this.fxaa.material.uniforms as { resolution: { value: THREE.Vector2 } }
    uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr))
  }

  render(): void {
    this.composer.render()
  }
}
