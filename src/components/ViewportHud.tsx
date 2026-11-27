import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Box,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Feather,
  Gamepad2,
  Grid,
  Layers,
  Magnet,
  Move3d,
  RotateCw,
  Shield,
  SlidersHorizontal,
  Square,
  User,
  Wind,
  Zap,
} from 'lucide-react';
import type {
  PlayModeStatus,
  ViewportOverlayFlags,
  ViewportTelemetryHudState,
} from '../types';
import type { BlenderCameraPreset } from '../utils/cameraPresets';

interface ViewportHudProps {
  hud: ViewportTelemetryHudState;
  activePreset: string;
  autoSpin: boolean;
  overlays: ViewportOverlayFlags;
  playMode: PlayModeStatus;
  zenMode: boolean;
  inspectorOpen?: boolean;
  gravityEnabled: boolean;
  gravityStrength: number;
  onCameraPreset: (preset: BlenderCameraPreset) => void;
  onFocusSelected: () => void;
  onToggleAutoSpin: () => void;
  onToggleOverlay: (key: keyof ViewportOverlayFlags) => void;
  onStopPlayMode: () => void;
  onTogglePlayCameraMode: () => void;
  onCycleGravityMode: () => void;
  onPlayVirtualKey: (key: string, pressed: boolean) => void;
}

const ALL_CAMERA_PRESETS: Array<{ id: BlenderCameraPreset; label: string; title: string }> = [
  { id: 'hero', label: 'Persp', title: 'Hero 3/4 Perspective (Numpad 0)' },
  { id: 'front', label: 'Front', title: 'Front Elevation (Numpad 1)' },
  { id: 'back', label: 'Back', title: 'Back Elevation (Ctrl+Numpad 1)' },
  { id: 'left', label: 'Left', title: 'Left Elevation (Ctrl+Numpad 3)' },
  { id: 'right', label: 'Right', title: 'Right Elevation (Numpad 3)' },
  { id: 'top', label: 'Top', title: 'Top Plan View (Numpad 7)' },
  { id: 'bottom', label: 'Bottom', title: 'Bottom Underside View (Ctrl+Numpad 7)' },
];

const QUICK_DESKTOP_PRESETS: Array<{ id: BlenderCameraPreset; label: string; title: string }> = [
  { id: 'hero', label: 'Persp', title: 'Hero 3/4 Perspective (Numpad 0)' },
  { id: 'front', label: 'Front', title: 'Front Elevation (Numpad 1)' },
  { id: 'right', label: 'Right', title: 'Right Elevation (Numpad 3)' },
  { id: 'top', label: 'Top', title: 'Top Plan View (Numpad 7)' },
  { id: 'bottom', label: 'Bottom', title: 'Bottom Underside View (Ctrl+Numpad 7)' },
];

function detectPreferTouchKeys(): boolean {
  if (typeof window === 'undefined') return false;
  const isSmallScreen = window.innerWidth < 1024;
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return isSmallScreen || hasCoarsePointer || hasTouchPoints;
}

export const ViewportHud: React.FC<ViewportHudProps> = ({
  hud,
  activePreset,
  autoSpin,
  overlays,
  playMode,
  zenMode,
  inspectorOpen = false,
  gravityEnabled,
  gravityStrength,
  onCameraPreset,
  onFocusSelected,
  onToggleAutoSpin,
  onToggleOverlay,
  onStopPlayMode,
  onTogglePlayCameraMode,
  onCycleGravityMode,
  onPlayVirtualKey,
}) => {
  // Collapsed by default so telemetry never crowds mobile or desktop dock
  const [hudExpanded, setHudExpanded] = useState(false);
  const [viewsPopoverOpen, setViewsPopoverOpen] = useState(false);
  const [overlaysPopoverOpen, setOverlaysPopoverOpen] = useState(false);
  const [playHudHidden, setPlayHudHidden] = useState(false);
  const [showTouchKeys, setShowTouchKeys] = useState<boolean>(() => detectPreferTouchKeys());
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});
  const popoverRootRef = useRef<HTMLDivElement | null>(null);

  // Sync touch-key auto visibility when entering Play Mode or resizing across mobile breakpoint
  useEffect(() => {
    if (playMode.active) {
      setPlayHudHidden(false);
      setShowTouchKeys(detectPreferTouchKeys());
    } else {
      setPressedKeys({});
    }
  }, [playMode.active]);

  useEffect(() => {
    const onResize = () => {
      if (playMode.active && window.innerWidth < 1024) {
        setShowTouchKeys(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [playMode.active]);

  // Close popovers when clicking outside
  useEffect(() => {
    if (!viewsPopoverOpen && !overlaysPopoverOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (popoverRootRef.current && !popoverRootRef.current.contains(e.target as Node)) {
        setViewsPopoverOpen(false);
        setOverlaysPopoverOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [viewsPopoverOpen, overlaysPopoverOpen]);

  // Release any stuck virtual keys if component unmounts or Play HUD hides
  useEffect(() => {
    if (playHudHidden || !showTouchKeys) {
      ['w', 'a', 's', 'd', ' ', 'shift', 'c'].forEach((k) => onPlayVirtualKey(k, false));
      setPressedKeys({});
    }
  }, [playHudHidden, showTouchKeys, onPlayVirtualKey]);

  if (zenMode) return null;

  const formatNum = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

  const gravityModeLabel = !gravityEnabled
    ? 'Fly (0G)'
    : gravityStrength < 6
      ? 'Low-G'
      : 'Gravity';

  const handleVirtualKey = (key: string, pressed: boolean) => {
    setPressedKeys((prev) => (prev[key] === pressed ? prev : { ...prev, [key]: pressed }));
    onPlayVirtualKey(key, pressed);
  };

  const makeKeyHandlers = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture errors on synthetic events
      }
      handleVirtualKey(key, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      handleVirtualKey(key, false);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      handleVirtualKey(key, false);
    },
    onLostPointerCapture: () => {
      handleVirtualKey(key, false);
    },
  });

  const activeOverlayCount =
    Number(overlays.showGrid) +
    Number(overlays.showAxes) +
    Number(overlays.showBounds) +
    Number(overlays.showColliders);

  return (
    <>
      {/* =====================================================================
          PLAY MODE HUD + MOBILE TOUCH CONTROLS + HIDE UI HUD BUTTON
         ===================================================================== */}
      {playMode.active && playHudHidden && (
        <div
          className="absolute top-3 right-3 z-30 flex items-center gap-1.5"
          role="region"
          aria-label="Minimized Play Mode Controls"
        >
          <button
            type="button"
            onClick={() => setPlayHudHidden(false)}
            aria-label="Show Play Mode HUD"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E1DA] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#1C1B19] shadow-[0_6px_18px_rgba(28,27,25,0.12)] transition-colors hover:bg-[#FAF8F5]"
          >
            <Eye className="h-3.5 w-3.5 text-[#2D5A4C]" />
            <span>Show HUD</span>
          </button>
          <button
            type="button"
            onClick={onStopPlayMode}
            aria-label="Stop Play Mode"
            className="inline-flex items-center gap-1 rounded-xl bg-[#A63A2B] px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_6px_18px_rgba(28,27,25,0.14)] transition-colors hover:bg-[#8E3023]"
          >
            <Square className="h-3 w-3 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {playMode.active && !playHudHidden && (
        <>
          {/* Compact Non-Overlapping Top-Center Play Mode Bar */}
          <div
            className="absolute top-2.5 left-1/2 z-30 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-xl border border-[#2D5A4C] bg-white px-2.5 py-1.5 shadow-[0_10px_28px_rgba(28,27,25,0.14)] sm:top-3 sm:gap-2 sm:px-3"
            role="region"
            aria-label="Play Mode Controls"
          >
            <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#2D5A4C]">
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PLAY</span>
            </div>

            <div className="hidden h-3.5 w-px shrink-0 bg-[#E5E1DA] sm:block" />

            <div className="hidden shrink-0 font-mono text-[10.5px] text-[#59554E] tabular-nums md:block">
              Y {playMode.playerY.toFixed(1)}m ·{' '}
              {playMode.flying ? 'Flying' : playMode.grounded ? 'Grounded' : 'Airborne'}
            </div>

            <button
              type="button"
              onClick={onCycleGravityMode}
              title="Cycle Gravity Mode: Normal (9.81 m/s²) → Low-G (3.5 m/s²) → Zero-G Sky Flight"
              aria-label={`Gravity mode: ${gravityModeLabel}`}
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                !gravityEnabled
                  ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                  : gravityStrength < 6
                    ? 'border-[#C9DBD3] bg-[#F4F9F6] text-[#2D5A4C]'
                    : 'border-[#E5E1DA] bg-[#FAF8F5] text-[#1C1B19] hover:bg-[#EFECE6]'
              }`}
            >
              {!gravityEnabled ? (
                <Wind className="h-3 w-3 text-[#2D5A4C]" />
              ) : gravityStrength < 6 ? (
                <Feather className="h-3 w-3 text-[#2D5A4C]" />
              ) : (
                <Magnet className="h-3 w-3 text-[#2D5A4C]" />
              )}
              <span>{gravityModeLabel}</span>
            </button>

            <button
              type="button"
              onClick={onTogglePlayCameraMode}
              className="shrink-0 rounded-md border border-[#E5E1DA] bg-[#FAF8F5] px-2 py-1 text-[11px] font-medium whitespace-nowrap text-[#1C1B19] transition-colors hover:bg-[#EFECE6]"
              title="Switch between Third-Person and First-Person camera (V)"
            >
              {playMode.cameraMode === 'third-person' ? '3rd' : '1st'}
            </button>

            <button
              type="button"
              onClick={() => setShowTouchKeys((prev) => !prev)}
              aria-pressed={showTouchKeys}
              title="Toggle On-Screen WASD & Space Keys for Touch / Mobile"
              aria-label="Toggle on-screen touch controls"
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                showTouchKeys
                  ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                  : 'border-[#E5E1DA] bg-[#FAF8F5] text-[#59554E] hover:text-[#1C1B19]'
              }`}
            >
              <Gamepad2 className="h-3 w-3" />
              <span className="hidden sm:inline">Keys</span>
            </button>

            <button
              type="button"
              onClick={() => setPlayHudHidden(true)}
              title="Hide Play Mode HUD"
              aria-label="Hide Play Mode HUD"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#E5E1DA] bg-[#FAF8F5] px-2 py-1 text-[11px] font-medium whitespace-nowrap text-[#59554E] transition-colors hover:bg-[#EFECE6] hover:text-[#1C1B19]"
            >
              <EyeOff className="h-3 w-3" />
              <span className="hidden md:inline">Hide HUD</span>
            </button>

            <button
              type="button"
              onClick={onStopPlayMode}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#A63A2B] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#8E3023]"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop</span>
            </button>
          </div>

          {/* Mobile / Touch On-Screen Keyboard Controls (WASD + Space + Shift + Zero-G Down) */}
          {showTouchKeys && (
            <>
              {/* Bottom-Left WASD Pad */}
              <div
                className="pointer-events-auto absolute bottom-4 left-3 z-30 select-none sm:bottom-5 sm:left-5"
                role="group"
                aria-label="On-screen movement keys"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-3 gap-1.5">
                  <div />
                  <button
                    type="button"
                    aria-label="Move Forward (W)"
                    {...makeKeyHandlers('w')}
                    className={`flex h-12 w-12 touch-none select-none flex-col items-center justify-center rounded-xl border text-[13px] font-semibold shadow-[0_6px_16px_rgba(28,27,25,0.14)] transition-colors ${
                      pressedKeys['w']
                        ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                        : 'border-[#DCD7CE] bg-white text-[#1C1B19] active:bg-[#EBF2EF]'
                    }`}
                  >
                    W
                  </button>
                  <div />
                  <button
                    type="button"
                    aria-label="Strafe Left (A)"
                    {...makeKeyHandlers('a')}
                    className={`flex h-12 w-12 touch-none select-none flex-col items-center justify-center rounded-xl border text-[13px] font-semibold shadow-[0_6px_16px_rgba(28,27,25,0.14)] transition-colors ${
                      pressedKeys['a']
                        ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                        : 'border-[#DCD7CE] bg-white text-[#1C1B19] active:bg-[#EBF2EF]'
                    }`}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    aria-label="Move Backward (S)"
                    {...makeKeyHandlers('s')}
                    className={`flex h-12 w-12 touch-none select-none flex-col items-center justify-center rounded-xl border text-[13px] font-semibold shadow-[0_6px_16px_rgba(28,27,25,0.14)] transition-colors ${
                      pressedKeys['s']
                        ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                        : 'border-[#DCD7CE] bg-white text-[#1C1B19] active:bg-[#EBF2EF]'
                    }`}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    aria-label="Strafe Right (D)"
                    {...makeKeyHandlers('d')}
                    className={`flex h-12 w-12 touch-none select-none flex-col items-center justify-center rounded-xl border text-[13px] font-semibold shadow-[0_6px_16px_rgba(28,27,25,0.14)] transition-colors ${
                      pressedKeys['d']
                        ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                        : 'border-[#DCD7CE] bg-white text-[#1C1B19] active:bg-[#EBF2EF]'
                    }`}
                  >
                    D
                  </button>
                </div>
              </div>

              {/* Bottom-Right Jump / Space, Sprint & Zero-G Down Controls */}
              <div
                className="pointer-events-auto absolute right-3 bottom-4 z-30 flex flex-col items-end gap-2 select-none sm:right-5 sm:bottom-5"
                role="group"
                aria-label="On-screen jump and action keys"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5">
                  {!gravityEnabled && (
                    <button
                      type="button"
                      aria-label="Descend in Zero-G (C)"
                      {...makeKeyHandlers('c')}
                      className={`flex h-11 min-w-[68px] touch-none select-none items-center justify-center gap-1 rounded-xl border px-2.5 text-[11px] font-semibold shadow-[0_6px_16px_rgba(28,27,25,0.14)] transition-colors ${
                        pressedKeys['c']
                          ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                          : 'border-[#DCD7CE] bg-white text-[#1C1B19]'
                      }`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                      <span>Down</span>
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label="Sprint (Shift)"
                    {...makeKeyHandlers('shift')}
                    className={`flex h-11 min-w-[74px] touch-none select-none items-center justify-center gap-1 rounded-xl border px-3 text-[11.5px] font-semibold shadow-[0_6px_16px_rgba(28,27,25,0.14)] transition-colors ${
                      pressedKeys['shift']
                        ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                        : 'border-[#DCD7CE] bg-white text-[#4F4B45]'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Sprint</span>
                  </button>
                </div>

                <button
                  type="button"
                  aria-label={!gravityEnabled ? 'Fly Up (Space)' : 'Jump (Space)'}
                  {...makeKeyHandlers(' ')}
                  className={`flex h-14 min-w-[116px] touch-none select-none items-center justify-center gap-1.5 rounded-2xl border px-4 text-[12.5px] font-semibold tracking-[0.02em] shadow-[0_8px_20px_rgba(28,27,25,0.16)] transition-colors ${
                    pressedKeys[' ']
                      ? 'border-[#1D4438] bg-[#1D4438] text-white'
                      : 'border-[#2D5A4C] bg-[#2D5A4C] text-white active:bg-[#1D4438]'
                  }`}
                >
                  <ArrowUp className="h-4 w-4" />
                  <span>{!gravityEnabled ? 'ASCEND' : 'SPACE'}</span>
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* =====================================================================
          NORMAL MODE TOP-RIGHT CAMERA & OVERLAYS (ZERO WRAP / ZERO OVERLAP)
         ===================================================================== */}
      {!playMode.active && (
        <div
          ref={popoverRootRef}
          className={`absolute top-3 z-20 transition-[right] duration-200 ${
            inspectorOpen
              ? 'hidden sm:block sm:right-[384px]'
              : 'right-3'
          }`}
          aria-label="Camera Presets and Viewport Overlays"
        >
          {/* Wide Desktop (>= 1280px & inspector closed): Single compact row + Overlays dropdown */}
          {!inspectorOpen && (
            <div className="hidden xl:flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 rounded-lg border border-[#E5E1DA] bg-white p-1 shadow-[0_4px_14px_rgba(28,27,25,0.06)]">
                <Compass className="mx-1 h-3.5 w-3.5 shrink-0 text-[#6C6860]" />
                {QUICK_DESKTOP_PRESETS.map((preset) => {
                  const isActive = activePreset.toLowerCase().includes(preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onCameraPreset(preset.id)}
                      title={preset.title}
                      className={`rounded px-1.5 py-1 text-[10.5px] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-[#2D5A4C] text-white'
                          : 'text-[#4F4B45] hover:bg-[#F1EEE8] hover:text-[#1C1B19]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <div className="mx-0.5 h-3.5 w-px bg-[#E5E1DA]" />
                <button
                  type="button"
                  onClick={onFocusSelected}
                  title="Focus Selected Object (F)"
                  aria-label="Focus Selected Object"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10.5px] font-medium whitespace-nowrap text-[#4F4B45] transition-colors hover:bg-[#F1EEE8] hover:text-[#1C1B19]"
                >
                  <Crosshair className="h-3 w-3" />
                  <span>Focus</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleAutoSpin}
                  title="Toggle Turntable Auto-Orbit"
                  aria-label="Toggle Turntable Auto-Orbit"
                  aria-pressed={autoSpin}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10.5px] font-medium whitespace-nowrap transition-colors ${
                    autoSpin
                      ? 'bg-[#2D5A4C] text-white'
                      : 'text-[#4F4B45] hover:bg-[#F1EEE8] hover:text-[#1C1B19]'
                  }`}
                >
                  <RotateCw className="h-3 w-3" />
                  <span>Orbit</span>
                </button>
              </div>

              {/* Compact Overlays Popover Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOverlaysPopoverOpen((p) => !p)}
                  aria-expanded={overlaysPopoverOpen}
                  aria-label="Viewport overlays menu"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-medium whitespace-nowrap shadow-[0_4px_14px_rgba(28,27,25,0.06)] transition-colors ${
                    overlaysPopoverOpen || activeOverlayCount > 0
                      ? 'border-[#CFE2DA] bg-white text-[#1D4438]'
                      : 'border-[#E5E1DA] bg-white text-[#4F4B45] hover:text-[#1C1B19]'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  <span>Overlays</span>
                  {activeOverlayCount > 0 && (
                    <span className="rounded bg-[#EBF2EF] px-1 font-mono text-[9.5px] text-[#2D5A4C]">
                      {activeOverlayCount}
                    </span>
                  )}
                </button>

                {overlaysPopoverOpen && (
                  <div className="absolute top-10 right-0 z-30 w-52 rounded-xl border border-[#E5E1DA] bg-white p-2 shadow-[0_12px_28px_rgba(28,27,25,0.12)]">
                    <div className="px-2 pb-1 text-[10px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                      Viewport Overlays
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleOverlay('showGrid')}
                        aria-pressed={overlays.showGrid}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          overlays.showGrid
                            ? 'bg-[#E8EFEA] text-[#2D5A4C]'
                            : 'text-[#5A564F] hover:bg-[#F5F3EF]'
                        }`}
                      >
                        <Grid className="h-3.5 w-3.5" />
                        <span>Grid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleOverlay('showAxes')}
                        aria-pressed={overlays.showAxes}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          overlays.showAxes
                            ? 'bg-[#E8EFEA] text-[#2D5A4C]'
                            : 'text-[#5A564F] hover:bg-[#F5F3EF]'
                        }`}
                      >
                        <Move3d className="h-3.5 w-3.5" />
                        <span>Axes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleOverlay('showBounds')}
                        aria-pressed={overlays.showBounds}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          overlays.showBounds
                            ? 'bg-[#E8EFEA] text-[#2D5A4C]'
                            : 'text-[#5A564F] hover:bg-[#F5F3EF]'
                        }`}
                      >
                        <Box className="h-3.5 w-3.5" />
                        <span>Bounds</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleOverlay('showColliders')}
                        aria-pressed={overlays.showColliders}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          overlays.showColliders
                            ? 'bg-[#E8EFEA] text-[#2D5A4C]'
                            : 'text-[#5A564F] hover:bg-[#F5F3EF]'
                        }`}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span>Colliders</span>
                      </button>
                    </div>
                    <div className="mt-2 border-t border-[#EFECE6] pt-1.5">
                      <div className="px-2 pb-1 text-[10px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                        Extra Angles
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {(['back', 'left'] as const).map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              onCameraPreset(id);
                              setOverlaysPopoverOpen(false);
                            }}
                            className="rounded-lg border border-[#EAE5DC] bg-[#FAF9F6] py-1 text-[11px] font-medium capitalize text-[#4F4B45] hover:border-[#2D5A4C] hover:text-[#1C1B19]"
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compact Trigger for Mobile / Tablet / Narrow Desktop / Open Inspector */}
          <div className={inspectorOpen ? 'relative block' : 'relative xl:hidden'}>
            <button
              type="button"
              onClick={() => setViewsPopoverOpen((p) => !p)}
              aria-expanded={viewsPopoverOpen}
              aria-label="Camera views and viewport overlays"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap shadow-[0_4px_14px_rgba(28,27,25,0.08)] transition-colors ${
                viewsPopoverOpen
                  ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                  : 'border-[#E5E1DA] bg-white text-[#1C1B19]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#2D5A4C]" />
              <span>Views</span>
            </button>

            {viewsPopoverOpen && (
              <div className="absolute top-10 right-0 z-30 w-60 max-w-[calc(100vw-24px)] space-y-2.5 rounded-xl border border-[#E5E1DA] bg-white p-2.5 shadow-[0_12px_30px_rgba(28,27,25,0.14)]">
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                    Camera Angles
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {ALL_CAMERA_PRESETS.map((preset) => {
                      const isActive = activePreset.toLowerCase().includes(preset.id);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            onCameraPreset(preset.id);
                            setViewsPopoverOpen(false);
                          }}
                          className={`rounded-lg py-1 text-[10.5px] font-medium transition-colors ${
                            isActive
                              ? 'bg-[#2D5A4C] text-white'
                              : 'border border-[#EAE5DC] bg-[#FAF9F6] text-[#4F4B45] hover:border-[#2D5A4C]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        onFocusSelected();
                        setViewsPopoverOpen(false);
                      }}
                      className="rounded-lg border border-[#EAE5DC] bg-[#FAF9F6] py-1 text-[10.5px] font-medium text-[#2D5A4C] hover:border-[#2D5A4C]"
                    >
                      Focus
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#EFECE6] pt-2">
                  <div className="mb-1.5 text-[10px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                    Overlays & Orbit
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleOverlay('showGrid')}
                      aria-pressed={overlays.showGrid}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                        overlays.showGrid ? 'bg-[#E8EFEA] text-[#2D5A4C]' : 'bg-[#FAF9F6] text-[#5A564F]'
                      }`}
                    >
                      <Grid className="h-3 w-3" />
                      <span>Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleOverlay('showAxes')}
                      aria-pressed={overlays.showAxes}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                        overlays.showAxes ? 'bg-[#E8EFEA] text-[#2D5A4C]' : 'bg-[#FAF9F6] text-[#5A564F]'
                      }`}
                    >
                      <Move3d className="h-3 w-3" />
                      <span>Axes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleOverlay('showBounds')}
                      aria-pressed={overlays.showBounds}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                        overlays.showBounds ? 'bg-[#E8EFEA] text-[#2D5A4C]' : 'bg-[#FAF9F6] text-[#5A564F]'
                      }`}
                    >
                      <Box className="h-3 w-3" />
                      <span>Bounds</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleOverlay('showColliders')}
                      aria-pressed={overlays.showColliders}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                        overlays.showColliders ? 'bg-[#E8EFEA] text-[#2D5A4C]' : 'bg-[#FAF9F6] text-[#5A564F]'
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      <span>Colliders</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleAutoSpin}
                      aria-pressed={autoSpin}
                      className={`col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                        autoSpin ? 'bg-[#2D5A4C] text-white' : 'bg-[#FAF9F6] text-[#5A564F]'
                      }`}
                    >
                      <RotateCw className="h-3 w-3" />
                      <span>{autoSpin ? 'Turntable Orbit ON' : 'Turntable Orbit'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          COLLAPSED-BY-DEFAULT VIEWPORT TELEMETRY HUD (ZERO DOCK COLLISION)
         ===================================================================== */}
      {!playMode.active && (
        <div
          className="pointer-events-auto absolute bottom-[68px] left-2.5 z-20 xl:bottom-4 xl:left-4"
          aria-label="Viewport Telemetry HUD"
        >
          {!hudExpanded ? (
            <button
              type="button"
              onClick={() => setHudExpanded(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-white px-2.5 py-1 text-[10px] font-mono text-[#4F4B45] shadow-[0_4px_12px_rgba(28,27,25,0.06)] transition-colors hover:text-[#1C1B19]"
              title="Expand Viewport Telemetry HUD"
            >
              <Activity className="h-3 w-3 text-[#2D5A4C]" />
              <span>{hud.fps} FPS</span>
              <span className="hidden sm:inline text-[#A29B90]">·</span>
              <span className="hidden sm:inline">{hud.objectCount} obj</span>
            </button>
          ) : (
            <div className="min-w-[206px] rounded-xl border border-[#E5E1DA] bg-white px-3 py-2 font-mono text-[10px] text-[#4F4B45] shadow-[0_8px_22px_rgba(28,27,25,0.1)]">
              <div className="mb-1 flex items-center justify-between gap-2 border-b border-[#EFECE6] pb-1">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#1C1B19]">
                  <Activity className="h-3 w-3 text-[#2D5A4C]" />
                  <span>HUD · {hud.fps} FPS</span>
                </span>
                <button
                  type="button"
                  onClick={() => setHudExpanded(false)}
                  aria-label="Minimize Telemetry HUD"
                  className="text-[#8A857C] transition-colors hover:text-[#1C1B19]"
                  title="Minimize HUD"
                >
                  <EyeOff className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
                <div className="text-[#7A756D]">Objects</div>
                <div className="text-right text-[#1C1B19]">{hud.objectCount}</div>
                <div className="text-[#7A756D]">Tris / Verts</div>
                <div className="text-right text-[#1C1B19]">
                  {formatNum(hud.triangleCount)} / {formatNum(hud.vertexCount)}
                </div>
                <div className="text-[#7A756D]">Dims (m)</div>
                <div className="text-right text-[#1C1B19]">
                  {hud.selectedDimensions[0].toFixed(1)}×{hud.selectedDimensions[1].toFixed(1)}×
                  {hud.selectedDimensions[2].toFixed(1)}
                </div>
                <div className="text-[#7A756D]">
                  {hud.selectedName ? 'Sel XYZ' : 'Cursor XYZ'}
                </div>
                <div className="text-right text-[#1C1B19]">
                  {hud.cursorPosition[0].toFixed(1)}, {hud.cursorPosition[1].toFixed(1)},{' '}
                  {hud.cursorPosition[2].toFixed(1)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
