/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Resume uploads go through a server action; the default 1 MB cap would
    // reject most PDFs. 10 MB file limit (src/lib/resumes.ts) plus form fields.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
