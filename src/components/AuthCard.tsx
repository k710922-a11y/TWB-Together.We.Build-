"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

export function AuthCard({ title, subtitle, action, fields, submit, hidden }: {
  title: string; subtitle?: string; submit: string;
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  fields: { name: string; label: string; type?: string; placeholder?: string; defaultValue?: string; readOnly?: boolean; autoComplete?: string }[];
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <form action={formAction} className="card w-full max-w-[380px] p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[15px] font-black text-white">T</span>
          <span className="text-[17px] font-bold">TWB</span>
        </div>
        <h1 className="text-[19px] font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-sub">{subtitle}</p>}
        <div className="mt-5 space-y-3.5">
          {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {fields.map((f) => (
            <label key={f.name} className="block">
              <span className="label">{f.label}</span>
              <input className="input h-10" name={f.name} type={f.type ?? "text"} placeholder={f.placeholder}
                defaultValue={f.defaultValue} readOnly={f.readOnly} autoComplete={f.autoComplete} required={f.name !== "project"} />
            </label>
          ))}
        </div>
        {state?.error && <p className="mt-3 rounded-lg bg-[#fff1f3] px-3 py-2 text-[13px] text-pri-high">{state.error}</p>}
        <button className="btn-primary mt-5 h-10 w-full" disabled={pending}>{pending ? "처리 중…" : submit}</button>
      </form>
    </main>
  );
}
