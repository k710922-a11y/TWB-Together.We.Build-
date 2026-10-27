"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import clsx from "clsx";
import type { Result } from "@/lib/result";
import { STATUS_LABEL, STATUS_STYLE, PRIORITY_LABEL, PRIORITY_STYLE, type Status, type Priority } from "@/lib/format";

/* ── 토스트 ─────────────────────────────────────── */
type Toast = { id: number; text: string; kind: "ok" | "err" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "err") => void>(() => {});

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 5000 : 2500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={clsx("rounded-lg px-4 py-2.5 text-[13px] font-medium shadow-lg max-w-sm",
            t.kind === "err" ? "bg-[#2b1a1f] text-[#ffd6dc]" : "bg-ink text-white")}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** 서버 액션 실행 + 실패 시 토스트 */
export function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const exec = useCallback(<T,>(fn: () => Promise<Result<T>>, opts?: { ok?: string; onOk?: (d: T) => void; onErr?: () => void }) => {
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          if (opts?.ok) toast(opts.ok);
          opts?.onOk?.(r.data);
        } else {
          toast(r.error, "err");
          if (r.conflict) router.refresh();
          opts?.onErr?.();
        }
      } catch {
        toast("서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.", "err");
        opts?.onErr?.();
      }
    });
  }, [toast, router]);
  return { exec, pending };
}

/* ── 기본 요소 ───────────────────────────────────── */
export function Avatar({ name, color, size = 24, className }: { name?: string | null; color?: string | null; size?: number; className?: string }) {
  if (!name) {
    return <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-faint text-faint", className)}
      style={{ width: size, height: size, fontSize: size * 0.45 }}>?</span>;
  }
  return (
    <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, background: color ?? "#5b5bf0", fontSize: Math.max(10, size * 0.45) }}>
      {name.slice(0, 1)}
    </span>
  );
}

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const s = STATUS_STYLE[status];
  return <span className={clsx("pill", s.fg, s.bg, className)}>{STATUS_LABEL[status]}</span>;
}

export function PriorityText({ priority }: { priority: Priority }) {
  return <span className={clsx("font-semibold", PRIORITY_STYLE[priority])}>{PRIORITY_LABEL[priority]}</span>;
}

export function Modal({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#1f2440]/30 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div className="card w-full shadow-xl" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-sub hover:bg-canvas" aria-label="닫기"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** 바깥 클릭 시 닫히는 팝오버 */
export function Popover({ trigger, children, align = "left", className }: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode; children: (close: () => void) => React.ReactNode;
  align?: "left" | "right"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={clsx("absolute z-40 mt-1 min-w-[160px] rounded-lg border border-line bg-white p-1 shadow-lg", align === "right" ? "right-0" : "left-0", className)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ onClick, children, active }: { onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={clsx("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-canvas", active && "bg-brand-50 text-brand font-semibold")}>
      {children}
    </button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-sub">{children}</div>;
}

/** 청크 단위로 내려받아 저장 (Vercel 응답 크기 한도 회피) */
export async function downloadFile(id: string, onProgress?: (p: number) => void) {
  const meta = await (await fetch(`/api/files/${id}?meta=1`)).json() as { name: string; mime: string; chunks: number; error?: string };
  if (meta.error) throw new Error(meta.error);
  const parts: ArrayBuffer[] = [];
  for (let i = 0; i < meta.chunks; i++) {
    const r = await fetch(`/api/files/${id}?chunk=${i}`);
    if (!r.ok) throw new Error("다운로드에 실패했습니다.");
    parts.push(await r.arrayBuffer());
    onProgress?.((i + 1) / meta.chunks);
  }
  const url = URL.createObjectURL(new Blob(parts, { type: meta.mime || "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url; a.download = meta.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 자료실 파일 업로드 (3MB 청크) */
export async function uploadFile(file: File, opts: { projectId?: string | null; category?: string | null }, onProgress?: (p: number) => void) {
  const { CHUNK_BYTES } = await import("@/lib/limits");
  const init = await fetch("/api/files/upload?op=init", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, mime: file.type, size: file.size, projectId: opts.projectId ?? null, category: opts.category ?? null }),
  });
  const ij = await init.json();
  if (!init.ok) throw new Error(ij.error ?? "업로드 실패");
  const total = Math.ceil(file.size / CHUNK_BYTES);
  for (let i = 0; i < total; i++) {
    const blob = file.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const r = await fetch(`/api/files/upload?op=chunk&id=${ij.id}&idx=${i}`, { method: "POST", body: blob });
      ok = r.ok;
    }
    if (!ok) throw new Error("업로드가 중간에 끊겼습니다. 다시 시도해 주세요.");
    onProgress?.((i + 1) / total);
  }
  const done = await fetch(`/api/files/upload?op=complete&id=${ij.id}`, { method: "POST" });
  const dj = await done.json();
  if (!done.ok) throw new Error(dj.error ?? "업로드 실패");
  return dj as { id: string; name: string };
}
