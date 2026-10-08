"use client";

import { useState } from "react";
import { MAX_RESUME_BYTES, RESUME_ACCEPT } from "@/lib/resumes";

/** File picker that rejects the wrong type or an oversized file before the
 * form is sent (the server checks again). */
export function ResumeInput({ label = "Resume" }: { label?: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="flex flex-col gap-1 text-[0.66rem] uppercase tracking-wider text-ink-faint">
      {label}
      <input
        type="file"
        name="resume"
        accept={RESUME_ACCEPT}
        aria-describedby="resume-hint"
        onChange={(e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          let msg: string | null = null;
          if (f && !/\.(pdf|docx?)$/i.test(f.name)) msg = "Choose a PDF or Word document (.pdf, .doc, .docx).";
          else if (f && f.size === 0) msg = "That file is empty.";
          else if (f && f.size > MAX_RESUME_BYTES) msg = "That file is larger than 10 MB.";
          input.setCustomValidity(msg ?? "");
          setError(msg);
        }}
        className="rounded-md border border-dashed border-line-strong bg-paper px-3 py-2.5 font-mono text-[0.8rem] normal-case tracking-normal text-ink file:mr-3 file:rounded-pill file:border file:border-line-strong file:bg-card file:px-3 file:py-1 file:font-mono file:text-[0.68rem] file:uppercase file:tracking-wider file:text-ink"
      />
      <span id="resume-hint" className="normal-case tracking-normal text-[0.72rem]">
        {error ? (
          <span role="alert" className="text-ink">
            <span className="font-bold text-critical" aria-hidden>
              ✕
            </span>{" "}
            {error}
          </span>
        ) : (
          "PDF or Word, up to 10 MB. Boeing can download it from the Candidates page."
        )}
      </span>
    </label>
  );
}
