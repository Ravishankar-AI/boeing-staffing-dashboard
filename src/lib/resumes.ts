// Resume upload validation, shared by the add and edit actions.

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const RESUME_ACCEPT = ".pdf,.doc,.docx";

const TYPES = {
  pdf: { contentType: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  docx: {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: [0x50, 0x4b, 0x03, 0x04], // zip
  },
  doc: { contentType: "application/msword", magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE2
} as const;

export const RESUME_ERRORS = {
  resume_type: "Resumes must be a PDF or Word document (.pdf, .doc, .docx).",
  resume_size: "That resume is larger than 10 MB. Please upload a smaller file.",
} as const;
export type ResumeError = keyof typeof RESUME_ERRORS;

export type ResumeUpload = { filename: string; contentType: string; size: number; data: Buffer };

/** null when no file was chosen; otherwise the validated file or an error code.
 * The stored content type comes from the file's own bytes, never from what
 * the browser claims, so downloads are always served as one of three types. */
export async function readResume(entry: FormDataEntryValue | null): Promise<ResumeUpload | ResumeError | null> {
  // An untouched file input still submits an empty part, and how it arrives
  // depends on how the form was sent (React re-encodes it, so the name isn't
  // reliably ""). Treat any 0-byte part as "no file chosen"; the picker
  // itself refuses a genuinely empty file before submit (resume-input.tsx).
  if (!entry || typeof entry === "string" || entry.size === 0) return null;
  if (entry.size > MAX_RESUME_BYTES) return "resume_size";

  const ext = entry.name.toLowerCase().split(".").pop() as keyof typeof TYPES;
  const type = TYPES[ext];
  if (!type) return "resume_type";
  const data = Buffer.from(await entry.arrayBuffer());
  if (!type.magic.every((b, i) => data[i] === b)) return "resume_type";

  return { filename: cleanFilename(entry.name), contentType: type.contentType, size: data.length, data };
}

function cleanFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "resume";
  return base.replace(/[\x00-\x1f\x7f"<>|*?:]/g, "_").slice(-150) || "resume";
}

export function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
