import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Full-viewport ambient watermark version of the "Open Hands" emblem, for
 * the landing page only - fixed behind all content, translucent, driven
 * by cursor parallax and scroll position rather than drag (the mount
 * takes no pointer events itself, so it can never steal a click, drag,
 * or scroll). Deliberately a separate component from BrandEmblem3D (the
 * opaque, draggable "stage" used on HomeScreen) rather than a parameterized
 * variant of it - transparency, sizing (viewport-fixed vs. a bounded box),
 * and interaction model all differ enough that forking keeps both simple.
 */
export default function BrandEmblemWatermark() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene() // no background - the page's own gradient shows through

    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.01, 10)
    camera.position.set(0, 0.02, 0.24)
    camera.lookAt(0, 0.01, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    const fallback = mount.querySelector('svg')

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 1.0)
    key.position.set(0.3, 0.4, 0.5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffdca8, 0.45)
    rim.position.set(-0.4, 0.2, -0.3)
    scene.add(rim)

    const S = 0.0015
    const pt = (x: number, y: number, z = 0) => new THREE.Vector3((x - 50) * S, -(y - 50) * S, z)

    const group = new THREE.Group()
    // Translucent so headline and CTA copy stay legible over the strokes;
    // the coin carries a touch more opacity since it's the eye-catcher.
    const walnut = new THREE.MeshStandardMaterial({
      color: 0x8a5a34, roughness: 0.62, metalness: 0.02,
      transparent: true, opacity: 0.14, depthWrite: false,
    })
    const brass = new THREE.MeshStandardMaterial({
      color: 0xc7a24a, roughness: 0.32, metalness: 0.75,
      transparent: true, opacity: 0.19, depthWrite: false,
    })

    const tubeRadius = 0.0045
    function makeStroke(p0: THREE.Vector3, c1: THREE.Vector3, c2: THREE.Vector3, p1: THREE.Vector3) {
      const curve = new THREE.CubicBezierCurve3(p0, c1, c2, p1)
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, tubeRadius, 16, false), walnut))
      const capGeo = new THREE.SphereGeometry(tubeRadius, 16, 16)
      const capA = new THREE.Mesh(capGeo, walnut)
      capA.position.copy(p0)
      const capB = new THREE.Mesh(capGeo, walnut)
      capB.position.copy(p1)
      group.add(capA, capB)
    }
    makeStroke(pt(14, 62), pt(22, 74), pt(40, 78), pt(50, 66))
    makeStroke(pt(86, 62), pt(78, 74), pt(60, 78), pt(50, 66))

    const coinRadius = 8 * S
    const coinThickness = 0.006
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(coinRadius, coinRadius, coinThickness, 48), brass)
    coin.rotation.x = Math.PI / 2
    coin.position.copy(pt(50, 42, 0))
    group.add(coin)

    const dotRadius = 0.0011
    const dotGeo = new THREE.SphereGeometry(dotRadius, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    const dotRows = [-1, 0, 1]
    const dotSpacing = coinRadius * 0.55
    dotRows.forEach((ry) => {
      dotRows.forEach((rx) => {
        if (Math.hypot(rx, ry) > 1.6) return
        const dot = new THREE.Mesh(dotGeo, brass)
        dot.rotation.x = -Math.PI / 2
        dot.position.set(coin.position.x + rx * dotSpacing, coin.position.y + ry * dotSpacing, coin.position.z + coinThickness / 2)
        group.add(dot)
      })
    })

    group.rotation.x = -0.15
    group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(group)
    group.position.y -= box.min.y
    group.position.y -= (box.max.y - box.min.y) / 2

    // A fixed, viewport-filling mark needs to scale with viewport height or
    // it swamps the copy on short screens / gets lost on tall ones.
    const pivot = new THREE.Group()
    pivot.add(group)
    const fitPivot = (h: number) => {
      const k = Math.max(0.85, Math.min(1.5, (h || 660) / 660))
      pivot.scale.setScalar(1.35 * k)
      pivot.position.y = 0.012
    }
    fitPivot(mount.clientHeight)
    scene.add(pivot)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let targetYaw = 0
    let targetPitch = 0
    let yaw = 0
    let pitch = 0

    // Cursor parallax listened for on the whole page - this mount takes no
    // pointer events, so it can never steal a click, drag, or scroll.
    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      targetYaw = nx * 0.22
      targetPitch = ny * 0.1
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    let raf = 0
    const animate = () => {
      frame += 1
      // Scroll turns the mark: down winds it one way, up unwinds it. Read
      // fresh every frame rather than wiring a scroll listener that can
      // go stale. Keep the sweep well under a quarter turn - past that
      // the coin goes edge-on and the mark disappears instead of turning.
      const doc = document.documentElement
      const sy = window.scrollY || doc.scrollTop || 0
      const smax = Math.max(1, (doc.scrollHeight || 0) - window.innerHeight)
      const prog = Math.min(1, sy / smax)
      yaw += (targetYaw + prog * 1.1 - yaw) * 0.045
      pitch += (targetPitch + prog * 0.12 - pitch) * 0.045
      const drift = reduce ? 0 : Math.sin(frame / 260) * 0.16
      group.rotation.y = drift + yaw
      group.rotation.x = -0.15 + pitch
      renderer.render(scene, camera)
      if (fallback && fallback.parentNode) fallback.remove()
      raf = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      fitPivot(h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse 130% 95% at 50% 40%, #f7eeda 0%, #fdf9f0 78%)' }}
    >
      <svg viewBox="0 0 100 100" style={{ width: '52%', maxWidth: 760, opacity: 0.09 }}>
        <circle cx="50" cy="42" r="8" fill="#8a5a34" />
        <path
          d="M14 62 C22 74, 40 78, 50 66 M86 62 C78 74, 60 78, 50 66"
          stroke="#8a5a34"
          strokeWidth="6.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  )
}
