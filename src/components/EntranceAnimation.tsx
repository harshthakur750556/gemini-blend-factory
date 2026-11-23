import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface EntranceAnimationProps {
  onComplete: () => void;
}

export const EntranceAnimation: React.FC<EntranceAnimationProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState('INITIALIZING MONOCHROME SHADER CORE');
  const [fadingOut, setFadingOut] = useState(false);

  const finishIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFadingOut(true);
    window.setTimeout(() => {
      onComplete();
    }, 360);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      finishIntro();
      return;
    }

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      finishIntro();
      return;
    }

    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuName);

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xf8f9fa, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf8f9fa, 7, 18);

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 40);
    camera.position.set(0, 1.4, 6.2);
    camera.lookAt(0, 0, 0);

    const resize = () => {
      const w = window.innerWidth;
      const h = Math.max(1, window.innerHeight);
      renderer?.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const assembly = new THREE.Group();
    scene.add(assembly);

    // 1. Converging monochrome architectural point cloud (1,400 points)
    const count = isSoftwareGl ? 720 : 1400;
    const startPos = new Float32Array(count * 3);
    const targetPos = new Float32Array(count * 3);
    const currentPos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const cDark = new THREE.Color('#111318');
    const cMid = new THREE.Color('#475569');
    const cLight = new THREE.Color('#94a3b8');

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const theta = goldenAngle * i;
      const ySphere = 1 - 2 * u;
      const rSphere = Math.sqrt(Math.max(0, 1 - ySphere * ySphere));

      // Target: sculpted faceted core + equatorial calibration band
      const isBand = i % 5 === 0;
      const tx = isBand ? Math.cos(theta * 2) * 1.65 : rSphere * Math.cos(theta) * 1.05;
      const ty = isBand ? (Math.sin(i * 0.7) * 0.08) : ySphere * 1.05;
      const tz = isBand ? Math.sin(theta * 2) * 1.65 : rSphere * Math.sin(theta) * 1.05;

      targetPos[i * 3] = tx;
      targetPos[i * 3 + 1] = ty;
      targetPos[i * 3 + 2] = tz;

      // Start: expanded radial burst
      const spread = 3.2 + (i % 7) * 0.42;
      startPos[i * 3] = tx * spread + Math.sin(i * 1.7) * 0.7;
      startPos[i * 3 + 1] = ty * spread + Math.cos(i * 1.3) * 0.6;
      startPos[i * 3 + 2] = tz * spread;

      currentPos[i * 3] = startPos[i * 3];
      currentPos[i * 3 + 1] = startPos[i * 3 + 1];
      currentPos[i * 3 + 2] = startPos[i * 3 + 2];

      const shade = isBand ? cMid : i % 3 === 0 ? cDark : cLight;
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }

    const ptGeom = new THREE.BufferGeometry();
    ptGeom.setAttribute('position', new THREE.BufferAttribute(currentPos, 3));
    ptGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ptMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(ptGeom, ptMat);
    assembly.add(points);

    // 2. Central Precision Wireframe Polyhedron Lattice
    const icoGeom = new THREE.IcosahedronGeometry(0.92, 1);
    const icoEdges = new THREE.EdgesGeometry(icoGeom);
    const icoMat = new THREE.LineBasicMaterial({ color: 0x111318, transparent: true, opacity: 0.85 });
    const icoLines = new THREE.LineSegments(icoEdges, icoMat);
    icoLines.scale.setScalar(0.15);
    assembly.add(icoLines);

    // Inner matte-graphite solid core
    const innerGeom = new THREE.OctahedronGeometry(0.54, 0);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, wireframe: true, transparent: true, opacity: 0.45 });
    const innerCore = new THREE.Mesh(innerGeom, innerMat);
    assembly.add(innerCore);

    // 3. Calibration Gimbal Rings + Blender X/Z Axis Reference Lines
    const ringGeom1 = new THREE.RingGeometry(1.52, 1.545, 72);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x111318,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const ring1 = new THREE.Mesh(ringGeom1, ringMat1);
    ring1.rotation.x = Math.PI / 2;
    assembly.add(ring1);

    const ringGeom2 = new THREE.RingGeometry(1.86, 1.875, 72);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const ring2 = new THREE.Mesh(ringGeom2, ringMat2);
    ring2.rotation.x = Math.PI / 2.6;
    ring2.rotation.y = 0.4;
    assembly.add(ring2);

    // Ground architectural grid & Red X / Green Z axes
    const grid = new THREE.GridHelper(10, 20, 0x94a3b8, 0xdcdfe4);
    grid.position.y = -1.35;
    scene.add(grid);

    const xLineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.5, -1.345, 0),
      new THREE.Vector3(4.5, -1.345, 0),
    ]);
    const xLineMat = new THREE.LineBasicMaterial({ color: 0xe05353, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Line(xLineGeom, xLineMat));

    const zLineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.345, -4.5),
      new THREE.Vector3(0, -1.345, 4.5),
    ]);
    const zLineMat = new THREE.LineBasicMaterial({ color: 0x43a047, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Line(zLineGeom, zLineMat));

    const durationMs = isSoftwareGl ? 1350 : 2100;
    const startTs = performance.now();
    let rafId = 0;

    const animate = (now: number) => {
      if (completedRef.current) return;
      const elapsed = now - startTs;
      const t = Math.min(1, elapsed / durationMs);
      // Cubic ease-out for crisp architectural snap
      const ease = 1 - Math.pow(1 - t, 3);

      const posAttr = ptGeom.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        posAttr.array[ix] = startPos[ix] + (targetPos[ix] - startPos[ix]) * ease;
        posAttr.array[ix + 1] = startPos[ix + 1] + (targetPos[ix + 1] - startPos[ix + 1]) * ease;
        posAttr.array[ix + 2] = startPos[ix + 2] + (targetPos[ix + 2] - startPos[ix + 2]) * ease;
      }
      posAttr.needsUpdate = true;

      icoLines.scale.setScalar(0.15 + ease * 0.85);
      icoLines.rotation.y = t * Math.PI * 1.1;
      icoLines.rotation.x = t * 0.45;
      innerCore.rotation.y = -t * Math.PI * 1.6;
      ring1.rotation.z = t * Math.PI * 0.8;
      ring2.rotation.z = -t * Math.PI * 0.6;
      assembly.rotation.y = ease * 0.65;

      // Smooth dolly-in camera choreography
      camera.position.set(Math.sin(t * 0.6) * 0.6, 1.4 - ease * 0.45, 6.2 - ease * 1.9);
      camera.lookAt(0, 0, 0);

      renderer?.render(scene, camera);

      const pct = Math.round(t * 100);
      setProgress(pct);
      if (pct < 38) {
        setStageLabel('INITIALIZING MONOCHROME SHADER CORE');
      } else if (pct < 74) {
        setStageLabel('CALIBRATING BLENDER 4.2 CI PIPELINE');
      } else {
        setStageLabel('WORKBENCH ONLINE — ENTERING STUDIO');
      }

      if (t >= 1) {
        finishIntro();
        return;
      }
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      ptGeom.dispose();
      ptMat.dispose();
      icoGeom.dispose();
      icoEdges.dispose();
      icoMat.dispose();
      innerGeom.dispose();
      innerMat.dispose();
      ringGeom1.dispose();
      ringMat1.dispose();
      ringGeom2.dispose();
      ringMat2.dispose();
      xLineGeom.dispose();
      xLineMat.dispose();
      zLineGeom.dispose();
      zLineMat.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#f8f9fa] flex flex-col items-center justify-center transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      data-testid="entrance-animation"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Minimal Architectural HUD Overlay */}
      <div className="relative z-10 pointer-events-none flex flex-col items-center justify-between h-full w-full p-6">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#111318] text-white text-xs font-bold shadow-sm">
            <span className="material-symbols-outlined text-[16px]">deployed_code</span>
            <span className="tracking-wider uppercase text-[11px]">APEX 3D STUDIO</span>
          </div>
          <button
            type="button"
            onClick={finishIntro}
            className="pointer-events-auto flex items-center gap-1 px-3 py-1 rounded-md bg-white border border-[#dcdfe4] hover:border-[#111318] text-[11px] font-medium text-[#111318] shadow-sm transition-colors cursor-pointer"
          >
            <span>Skip Intro</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="w-full max-w-sm bg-white/92 border border-[#dcdfe4] rounded-xl px-4 py-3 shadow-md flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#111318] font-semibold tracking-wider">{stageLabel}</span>
            <span className="text-[#111318] font-bold">{progress}%</span>
          </div>
          <div className="w-full h-1 bg-[#e5e8ec] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#111318] transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b]">
            <span>Three.js WebGL2 PBR Engine</span>
            <span>Blender 4.2 LTS Cloud CI</span>
          </div>
        </div>
      </div>
    </div>
  );
};
