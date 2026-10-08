export function UploadError({ message }: { message: string }) {
  return (
    <p role="alert" className="mb-6 flex items-center gap-2 rounded-md border border-line bg-card px-4 py-3 text-[0.82rem]">
      <span className="font-bold text-critical" aria-hidden>
        ✕
      </span>
      {message} Nothing was saved.
    </p>
  );
}
