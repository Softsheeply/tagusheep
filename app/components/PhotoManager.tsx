"use client";

import { useRef, useState } from "react";
import SmartImage from "@/app/components/SmartImage";

type PhotoManagerProps = {
  photos: string[];
  brand?: string | null;
  canEdit: boolean;
  busy: boolean;
  maxPhotos: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onSetCover: (index: number) => void;
  onRemove: (index: number) => void;
  onReplace: (index: number, file: File) => void;
  onAdd: (files: File[]) => void;
};

export default function PhotoManager({
  photos,
  brand,
  canEdit,
  busy,
  maxPhotos,
  selectedIndex,
  onSelect,
  onMove,
  onSetCover,
  onRemove,
  onReplace,
  onAdd,
}: PhotoManagerProps) {
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const preview = photos[selectedIndex] || photos[0] || null;

  function pickReplace(index: number) {
    setReplaceIndex(index);
    replaceInput.current?.click();
  }

  return (
    <div className="space-y-4">
      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={brand ?? "tag"} className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center">
          <div className="font-medium text-white">No photos yet</div>
          <p className="mt-1 text-sm text-white/55">Add a tag or garment photo to start this record.</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url, index) => {
            const isCover = index === 0;
            const isSelected = index === selectedIndex;
            return (
              <div
                key={`${url}-${index}`}
                draggable={canEdit && !busy}
                onDragStart={() => setDragFrom(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragFrom != null && dragFrom !== index) onMove(dragFrom, index);
                  setDragFrom(null);
                }}
                className={`group relative aspect-square overflow-hidden rounded-xl border bg-white/5 ${
                  isSelected ? "border-emerald-300/70" : "border-white/10"
                }`}
              >
                <button type="button" onClick={() => onSelect(index)} className="absolute inset-0">
                  <SmartImage src={url} alt={`${brand || "tag"} photo ${index + 1}`} fill sizes="25vw" className="object-cover" />
                </button>
                {isCover && (
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                    Garment
                  </span>
                )}
                {canEdit && (
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-0.5 bg-black/70 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <TinyButton disabled={busy || index === 0} onClick={() => onMove(index, index - 1)} label="Up">↑</TinyButton>
                    <TinyButton disabled={busy || index === photos.length - 1} onClick={() => onMove(index, index + 1)} label="Down">↓</TinyButton>
                    {!isCover && <TinyButton disabled={busy} onClick={() => onSetCover(index)} label="Set as browse garment">Garment</TinyButton>}
                    <TinyButton disabled={busy} onClick={() => pickReplace(index)} label="Replace">Swap</TinyButton>
                    <TinyButton disabled={busy || photos.length < 2} danger onClick={() => onRemove(index)} label="Delete">✕</TinyButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <div className="space-y-2">
          <input
            ref={addInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = "";
              if (files.length) onAdd(files);
            }}
          />
          <input
            ref={replaceInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file && replaceIndex != null) onReplace(replaceIndex, file);
              setReplaceIndex(null);
            }}
          />
          <button
            type="button"
            disabled={busy || photos.length >= maxPhotos}
            onClick={() => addInput.current?.click()}
            className="w-full rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-40"
          >
            {busy ? "Updating photos…" : photos.length >= maxPhotos ? `Photo limit reached (${maxPhotos})` : "Add photos"}
          </button>
          <p className="text-xs text-white/45">
            First photo is the garment — that’s what search shows. Tag close-ups go after. Drag or use arrows. Changes save immediately.
          </p>
        </div>
      )}
    </div>
  );
}

function TinyButton({
  children,
  onClick,
  disabled,
  danger,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold disabled:opacity-30 ${
        danger ? "bg-rose-500 text-white" : "bg-white/90 text-black"
      }`}
    >
      {children}
    </button>
  );
}
