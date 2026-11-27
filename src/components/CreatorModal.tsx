import React from 'react';
import { Award, Boxes, ExternalLink, Globe, Layers, User, X } from 'lucide-react';

interface CreatorModalProps {
  open: boolean;
  onClose: () => void;
  repoOwner?: string | null;
  repoName?: string | null;
}

export const CreatorModal: React.FC<CreatorModalProps> = ({
  open,
  onClose,
  repoOwner,
  repoName,
}) => {
  if (!open) return null;

  const repoDisplay =
    repoOwner && repoName ? `${repoOwner}/${repoName}` : 'BlendFactory Studio Repository';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B19]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creator-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-[#FFFFFF] border border-[#E5E1DA] shadow-[0_24px_60px_rgba(28,27,25,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1DA] bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2D5A4C] text-white flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="creator-modal-title"
                className="font-serif text-[18px] font-medium text-[#1C1B19] leading-tight"
              >
                Creator &amp; About BlendFactory Studio
              </h2>
              <p className="text-[11px] text-[#6C6860]">
                Visual 3D World Studio &amp; Multi-Angle Inspection Medium
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Creator dialog"
            className="w-8 h-8 rounded-lg border border-[#E5E1DA] bg-white text-[#6C6860] hover:text-[#1C1B19] hover:border-[#C5BEB2] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-[13px] text-[#35322E]">
          {/* Author Card */}
          <div className="p-4 rounded-xl border border-[#E5E1DA] bg-[#FAF8F5] flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#E8EFEA] border border-[#C8DBD2] text-[#2D5A4C] flex items-center justify-center shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-serif text-[16px] font-medium text-[#1C1B19]">
                  {repoOwner ? repoOwner : '[Creator Name]'}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#E5E1DA] font-mono text-[10px] text-[#6C6860]">
                  Project Author
                </span>
              </div>
              <p className="text-[12px] text-[#59554E] leading-relaxed">
                [Bio] — Creator &amp; maintainer of BlendFactory Studio, combining Blender-grade
                modeling precision, Unity Play Mode &amp; component physics, and Unreal-scale
                open-world sculpting in a clean browser-first 3D inspection studio.
              </p>
              <div className="pt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#E5E1DA] text-[#4F4B45]">
                  <Globe className="w-3 h-3 text-[#2D5A4C]" />
                  <span>[Links: Website / Portfolio]</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#E5E1DA] text-[#4F4B45]">
                  <ExternalLink className="w-3 h-3 text-[#2D5A4C]" />
                  <span>{repoDisplay}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Project Metadata & Credits */}
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-white">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#6C6860] mb-1">
                <Boxes className="w-3.5 h-3.5 text-[#2D5A4C]" />
                <span>Studio Architecture</span>
              </div>
              <p className="text-[#4F4B45] leading-relaxed">
                React 19 · TypeScript · Three.js WebGL PBR · Procedural Terrain &amp; Rigid-Body
                Physics · Universal 16-Format Exporter · Headless Blender 4.2 LTS CI
              </p>
            </div>
            <div className="p-3.5 rounded-lg border border-[#E5E1DA] bg-white">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#6C6860] mb-1">
                <Layers className="w-3.5 h-3.5 text-[#2D5A4C]" />
                <span>Open-World Showcase</span>
              </div>
              <p className="text-[#4F4B45] leading-relaxed">
                Includes an organized repository character library grouped by category (
                <strong>Female Characters</strong>, <strong>Male Characters</strong>, and{' '}
                <strong>Stylized &amp; Rigged Characters</strong>) with visual studio previews.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-[#7A756D] leading-relaxed border-t border-[#ECE8E0] pt-3">
            Update author metadata in <span className="font-mono text-[#1C1B19]">metadata.json</span>{' '}
            or <span className="font-mono text-[#1C1B19]">src/components/CreatorModal.tsx</span> to
            personalize your studio credits and external links.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#E5E1DA] bg-[#FAF8F5] text-[11px] text-[#6C6860]">
          <span className="font-mono">BlendFactory Studio · v2.0 Open-World Edition</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#2D5A4C] text-white font-medium hover:bg-[#244A3E] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
