import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * 3D relief build of the "Open Hands" emblem (walnut hand-strokes cradling a
 * brass coin) — the sculpted counterpart to the flat mark in BrandMark.tsx.
 * Geometry and materials mirror the brand asset exactly; only camera/render
 * plumbing is added here.
 */
export default function BrandEmblem3D({
  height = 220,
  className = '',
}: {
  height?: number
  className?: string
}) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x241d16)

    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.01, 10)
    camera.position.set(0, 0.02, 0.24)
    camera.lookAt(0, 0.01, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(0.3, 0.4, 0.5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffdca8, 0.4)
    rim.position.set(-0.4, 0.2, -0.3)
    scene.add(rim)

    const S = 0.0015 // svg-unit -> meter scale (100-unit viewBox -> 0.15m wide)
    const pt = (x: number, y: number, z = 0) => new THREE.Vector3((x - 50) * S, -(y - 50) * S, z)

    const group = new THREE.Group()
    group.name = 'hishabi_open_hands_emblem'

    const walnut = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.62, metalness: 0.02 })
    const brass = new THREE.MeshStandardMaterial({ color: 0xc7a24a, roughness: 0.32, metalness: 0.75 })

    const tubeRadius = 0.0045
    function makeStroke(p0: THREE.Vector3, c1: THREE.Vector3, c2: THREE.Vector3, p1: THREE.Vector3) {
      const curve = new THREE.CubicBezierCurve3(p0, c1, c2, p1)
      const geo = new THREE.TubeGeometry(curve, 32, tubeRadius, 16, false)
      group.add(new THREE.Mesh(geo, walnut))
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

    const dotsGroup = new THREE.Group()
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
        dotsGroup.add(dot)
      })
    })
    group.add(dotsGroup)

    group.rotation.x = -0.15
    group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(group)
    group.position.y -= box.min.y
    group.position.y -= (box.max.y - box.min.y) / 2
    group.updateMatrixWorld(true)

    scene.add(group)

    let frame = 0
    let raf = 0

    // User drag rotates the emblem on top of the idle sway; the sway pauses
    // while dragging and resumes from wherever the user left it.
    //
    // Touch is deliberately horizontal-only. `touch-action: pan-y` hands
    // vertical gestures back to the browser so the page still scrolls when a
    // thumb lands on the emblem, and a touch gesture is only claimed once it
    // has travelled further across than down. Mouse and pen keep both axes.
    let isDragging = false
    let isTouch = false
    let captured = false
    let startX = 0
    let startY = 0
    let lastX = 0
    let lastY = 0
    let userYaw = 0
    let userPitch = 0
    const PITCH_LIMIT = 0.6
    const CLAIM_THRESHOLD = 4 // px of travel before the gesture is ours

    const animate = () => {
      frame += 1
      const sway = isDragging ? 0 : Math.sin(frame / 220) * 0.5
      group.rotation.y = sway + userYaw
      group.rotation.x = -0.15 + userPitch
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    const el = renderer.domElement
    el.style.touchAction = 'pan-y'
    el.style.cursor = 'grab'

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true
      isTouch = e.pointerType === 'touch'
      startX = lastX = e.clientX
      startY = lastY = e.clientY
      captured = false
      // A mouse or pen press is ours immediately; a touch has to prove itself.
      if (!isTouch) {
        el.setPointerCapture(e.pointerId)
        captured = true
        el.style.cursor = 'grabbing'
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return

      if (isTouch && !captured) {
        const travelX = Math.abs(e.clientX - startX)
        const travelY = Math.abs(e.clientY - startY)
        if (travelX < CLAIM_THRESHOLD && travelY < CLAIM_THRESHOLD) return
        if (travelY > travelX) {
          // Reads as a scroll, not a turn — release it to the page.
          isDragging = false
          return
        }
        el.setPointerCapture(e.pointerId)
        captured = true
      }

      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      userYaw += dx * 0.008
      // Pitch stays on mouse/pen only: on touch, vertical belongs to the page.
      if (!isTouch) {
        userPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, userPitch + dy * 0.008))
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      isDragging = false
      captured = false
      el.style.cursor = 'grab'
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)

    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className={`w-full overflow-hidden rounded-xl ${className}`}
      style={{ height }}
    />
  )
}
