import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Gamepad2,
  Keyboard,
  Layers,
  Mountain,
  Terminal,
  X,
} from 'lucide-react';

interface ManualModalProps {
  open: boolean;
  onClose: () => void;
}

type ManualSectionId = 'navigation' | 'shortcuts' | 'world' | 'physics' | 'ai-workflow';

export const ManualModal: React.FC<ManualModalProps> = ({ open, onClose }) => {
  const [section, setSection] = useState<ManualSectionId>('navigation');

  if (!open) return null;

  const navItems: Array<{ id: ManualSectionId; label: string; icon: React.ReactNode }> = [
    { id: 'navigation', label: 'Viewport & Inspection', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard className="w-3.5 h-3.5" /> },
    { id: 'world', label: 'Open-World & Terrain', icon: <Mountain className="w-3.5 h-3.5" /> },
    { id: 'physics', label: 'Play Mode & Physics', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
    { id: 'ai-workflow', label: 'AI Studio & CLI Flow', icon: <Terminal className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B19]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[86vh] flex flex-col rounded-xl bg-[#FFFFFF] border border-[#E5E1DA] shadow-[0_24px_60px_rgba(28,27,25,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1DA] bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2D5A4C] text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="manual-modal-title"
                className="font-serif text-[18px] font-medium text-[#1C1B19] leading-tight"
              >
                BlendFactory Studio — User Manual
              </h2>
              <p className="text-[11px] text-[#6C6860]">
                Visual 3D World Studio, Multi-Angle Inspector &amp; Play-Test Medium
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close User Manual"
            className="w-8 h-8 rounded-lg border border-[#E5E1DA] bg-white text-[#6C6860] hover:text-[#1C1B19] hover:border-[#C5BEB2] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Navigation Rail */}
          <nav className="w-56 shrink-0 border-r border-[#E5E1DA] bg-[#FAF8F5] p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-left transition-colors ${
                    active
                      ? 'bg-[#2D5A4C] text-white shadow-xs'
                      : 'text-[#4F4B45] hover:bg-[#EFECE6] hover:text-[#1C1B19]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Content Pane */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 text-[13px] text-[#35322E] leading-relaxed">
            {section === 'navigation' && (
              <>
                <div>
                  <h3 className="font-serif text-[16px] text-[#1C1B19] mb-1.5">
                    Unbounded 3D Viewport Navigation
                  </h3>
                  <p className="text-[#59554E]">
                    Navigate freely across open worlds—including below the reference grid (
                    <span className="font-mono text-[#1C1B19]">Y &lt; 0</span>) for caves, dungeons,
                    floating island undersides, and underwater basins—with zero floor-clamping or
                    starter grid boundary limits.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5]">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#2D5A4C] mb-1">
                      Mouse &amp; Camera
                    </div>
                    <ul className="space-y-1 text-[12px] text-[#4F4B45]">
                      <li>• <strong>Left-Drag</strong>: Orbit smoothly around target (full 360° including bottom)</li>
                      <li>• <strong>Right-Drag / Shift+Drag</strong>: Pan freely in screen space</li>
                      <li>• <strong>Scroll Wheel</strong>: Zoom smoothly from 0.2m detail up to 600m scale</li>
                      <li>• <strong>F Key / Focus</strong>: Frame the currently selected object immediately</li>
                    </ul>
                  </div>
                  <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5]">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#2D5A4C] mb-1">
                      Multi-Angle Inspection &amp; Overlays
                    </div>
                    <ul className="space-y-1 text-[12px] text-[#4F4B45]">
                      <li>• <strong>Camera Bar</strong>: One-click Hero, Front, Back, Left, Right, Top, Bottom</li>
                      <li>• <strong>Shading Passes</strong>: Combined Lit PBR, Albedo/Unlit, Wireframe, Normals, Matcap</li>
                      <li>• <strong>Overlays</strong>: Independent Grid, World Axes, Bounding Box &amp; UCX Collider toggles</li>
                      <li>• <strong>Camera Tuning</strong>: Live Field of View (20°–110°), Move Speed &amp; Auto-Orbit Turntable</li>
                    </ul>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FFFFFF]">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1C1B19] mb-1">
                    <Layers className="w-3.5 h-3.5 text-[#2D5A4C]" />
                    <span>Viewport Telemetry HUD &amp; Outliner</span>
                  </div>
                  <p className="text-[12px] text-[#59554E]">
                    The compact Telemetry HUD monitors real-time FPS, object count, triangles/vertices,
                    selected bounding dimensions (W × H × D meters), and live 3D cursor/selection coordinates.
                    Use the Scene Outliner to search/filter entities, toggle eye visibility and locks,
                    create parent/child groups, duplicate, or delete nodes—all tracked in the Undo/Redo stack.
                  </p>
                </div>
              </>
            )}

            {section === 'shortcuts' && (
              <>
                <h3 className="font-serif text-[16px] text-[#1C1B19]">
                  Essential Keyboard Shortcuts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                  {[
                    { key: 'Ctrl+Z / Cmd+Z', desc: 'Undo last edit (create, delete, transform, sculpt, material)' },
                    { key: 'Ctrl+Y / Cmd+Shift+Z', desc: 'Redo undone edit' },
                    { key: 'G / R / S', desc: 'Toggle Translate (Move), Rotate, or Scale Transform Gizmo' },
                    { key: 'F', desc: 'Focus / Frame selected object in viewport' },
                    { key: 'Shift+D', desc: 'Duplicate selected object or group' },
                    { key: 'Delete / Backspace', desc: 'Delete selected object (undoable via Ctrl+Z)' },
                    { key: 'Numpad 1 / 3 / 7', desc: 'Front, Right, and Top orthographic inspection views' },
                    { key: 'Ctrl + Numpad 1 / 3 / 7', desc: 'Back, Left, and Bottom views (inspect below Y=0)' },
                    { key: 'Numpad 5 / Numpad 0', desc: 'Toggle Ortho/Perspective · Look through Scene Camera' },
                    { key: 'Alt+Ctrl+Q', desc: 'Toggle 4-panel Blender Quad View' },
                    { key: 'WASD / Arrows + Space', desc: 'Play Mode: Move, Jump, Shift Sprint, Mouse-Drag Look' },
                    { key: 'Escape', desc: 'Exit Play Mode, cancel active brush/gizmo, or close dialogs' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5]"
                    >
                      <kbd className="shrink-0 px-2 py-0.5 rounded bg-white border border-[#D8D3C9] font-mono text-[11px] font-medium text-[#1C1B19]">
                        {item.key}
                      </kbd>
                      <span className="text-[#4F4B45] text-right">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {section === 'world' && (
              <>
                <div>
                  <h3 className="font-serif text-[16px] text-[#1C1B19] mb-1.5">
                    Open-World Building, Terrain &amp; PBR Materials
                  </h3>
                  <p className="text-[#59554E]">
                    Switch to the <strong>World</strong> tab in the right Inspector panel to access
                    Unreal/Unity-style terrain sculpting, ground painting, brush scattering, snapping,
                    and atmosphere controls.
                  </p>
                </div>

                <div className="space-y-3 text-[12px]">
                  <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5]">
                    <div className="font-semibold text-[#1C1B19] mb-1">
                      1. Terrain Sculpting &amp; Multi-Layer Ground Painting
                    </div>
                    <p className="text-[#59554E]">
                      Spawn an Open-World Terrain patch (or select any terrain mesh) and activate{' '}
                      <strong>Terrain Sculpt</strong> to paint <em>Raise</em>, <em>Lower</em> (carving
                      freely below <span className="font-mono">Y &lt; 0</span>), <em>Smooth</em>,{' '}
                      <em>Flatten</em>, or <em>Noise</em> directly in the viewport with adjustable brush
                      radius and strength. Switch to <strong>Ground Paint</strong> to blend Grass, Moss,
                      Basalt Rock, Sand, Alpine Snow, and Cave Earth vertex layers. Every stroke is undoable.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5]">
                    <div className="font-semibold text-[#1C1B19] mb-1">
                      2. Brush-Based Procedural Scatter &amp; Modular Snapping
                    </div>
                    <p className="text-[#59554E]">
                      Activate <strong>Scatter Brush</strong> to paint procedural pine trees, boulders,
                      crystals, grass tufts, architectural pillars, or clones of your currently selected
                      prop onto any terrain or cliff surface with surface-normal alignment and scale
                      variation. Configure Grid, Rotation, and Scale snap increments plus Local/World
                      coordinate space for crisp modular architecture.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5]">
                    <div className="font-semibold text-[#1C1B19] mb-1">
                      3. PBR Material Editor &amp; Dynamic Atmosphere
                    </div>
                    <p className="text-[#59554E]">
                      In the <strong>Shader</strong> tab, edit any material&apos;s Albedo, Metalness,
                      Roughness, Emissive color/intensity, and procedural Bump/Normal relief maps—then
                      save extracted textures and bundles straight to the repository. Control dynamic
                      Sun Azimuth &amp; Elevation, real-time shadows, Skybox presets (including Celestial
                      Sky), and Distance + Height Fog.
                    </p>
                  </div>
                </div>
              </>
            )}

            {section === 'physics' && (
              <>
                <div>
                  <h3 className="font-serif text-[16px] text-[#1C1B19] mb-1.5">
                    Temporary Play Mode &amp; Gravity / Rigid-Body Physics
                  </h3>
                  <p className="text-[#59554E]">
                    Verify world scale, doorway clearances, traversal sightlines, and collision volumes
                    first-hand without ever corrupting your authored scene layout.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                  <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5]">
                    <div className="font-semibold text-[#1C1B19] mb-1">
                      Play / Stop Workflow
                    </div>
                    <ul className="space-y-1 text-[#4F4B45]">
                      <li>• Click <strong>Play</strong> in the top toolbar to snapshot the entire scene and spawn a controllable explorer avatar.</li>
                      <li>• Move with <strong>W A S D</strong> or Arrow keys, <strong>Space</strong> to jump, <strong>Shift</strong> to sprint, and drag the viewport to orbit/look.</li>
                      <li>• Toggle <strong>3rd-Person</strong> or <strong>1st-Person</strong> camera directly from the Play HUD.</li>
                      <li>• Click <strong>Stop</strong> (or press <strong>Esc</strong>) to cleanly restore exact pre-play positions, rotations, scales, and editor camera.</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5]">
                    <div className="font-semibold text-[#1C1B19] mb-1">
                      Gravity &amp; Rigid-Body Simulation
                    </div>
                    <ul className="space-y-1 text-[#4F4B45]">
                      <li>• Toggle <strong>Gravity</strong> in the top toolbar or World Inspector to simulate falling, stacking, and collision against static floors, terrains, and <span className="font-mono">UCX_</span> colliders.</li>
                      <li>• Enable <strong>Live Editor Physics</strong> to drop props directly onto terrain/surfaces while editing, then restore or undo cleanly.</li>
                      <li>• Toggle <strong>Colliders</strong> overlay to audit walkable platforms and obstacle bounds visually.</li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {section === 'ai-workflow' && (
              <>
                <div>
                  <h3 className="font-serif text-[16px] text-[#1C1B19] mb-1.5">
                    Visual Medium for AI Studio, Antigravity &amp; CLI Workflows
                  </h3>
                  <p className="text-[#59554E]">
                    BlendFactory Studio keeps every 3D asset, procedural generator, texture, and
                    inspection capture organized in modular repository files so AI coding models and
                    human creators can collaborate in a tight visual refinement loop.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-[#FAF8F5] font-mono text-[11px] text-[#2C2A27] space-y-1">
                  <div>models/&lt;model-slug&gt;/</div>
                  <div className="pl-4">├── manifest.json          # Canonical metadata &amp; latest screenshot pointers</div>
                  <div className="pl-4">├── &lt;model-slug&gt;.glb       # Viewable PBR binary mesh (or procedural TS/Py builder)</div>
                  <div className="pl-4">├── build.py               # Modular Blender 4.2 LTS procedural script</div>
                  <div className="pl-4">├── textures/              # PBR albedo, bump, roughness &amp; normal PNG maps</div>
                  <div className="pl-4">└── screenshots/           # latest_hero.png, latest_front.png, latest_top.png...</div>
                </div>

                <ol className="list-decimal pl-5 space-y-1.5 text-[12px] text-[#4F4B45]">
                  <li>
                    <strong>Author or Edit in Code</strong>: Generate or refine procedural geometry in{' '}
                    <span className="font-mono">src/utils/</span> or <span className="font-mono">models/&lt;slug&gt;/</span>.
                  </li>
                  <li>
                    <strong>Inspect Every Angle Visually</strong>: Use one-click Front, Back, Left, Right,
                    Top, Bottom, Wireframe, and Normals views to catch silhouette defects, backface gaps,
                    or floating bases.
                  </li>
                  <li>
                    <strong>Play-Test Scale &amp; Colliders</strong>: Enter Play Mode to walk around the
                    model, verify human-scale proportions, and confirm walkable surfaces and colliders.
                  </li>
                  <li>
                    <strong>Iterate &amp; Commit Cleanly</strong>: Update code/textures, reload in the
                    viewport, capture updated reference views, and commit directly to Git.
                  </li>
                </ol>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#E5E1DA] bg-[#FAF8F5] text-[11px] text-[#6C6860]">
          <span>Press Esc at any time to close this manual.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#2D5A4C] text-white font-medium hover:bg-[#244A3E] transition-colors"
          >
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
};
