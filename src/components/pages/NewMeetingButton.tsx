"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { MeetingComposer } from "@/components/meeting/MeetingComposer";

export function NewMeetingButton({ projects }: { projects: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ 새 회의</button>
      <Modal open={open} onClose={() => setOpen(false)} title="새 회의 기록" width={560}>
        <MeetingComposer projects={projects} after={(id) => `/meetings/${id}`} onCancel={() => setOpen(false)} />
      </Modal>
    </>
  );
}
