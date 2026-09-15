import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

const RESUME_DIR = path.join(process.cwd(), "storage", "resumes");

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

/** Saves a resume file for a user and returns a storage-relative reference (not a public URL). */
export async function saveResumeFile(
  userId: string,
  originalName: string,
  data: Buffer
): Promise<{ storedFileName: string; resumeFileUrl: string }> {
  await mkdir(RESUME_DIR, { recursive: true });
  const storedFileName = `${userId}-${Date.now()}-${sanitizeFilename(originalName)}`;
  await writeFile(path.join(RESUME_DIR, storedFileName), data);
  return { storedFileName, resumeFileUrl: `/api/profile/resume-file?name=${encodeURIComponent(storedFileName)}` };
}

/** Reads back a resume file by its stored filename. Caller must verify ownership (filename is prefixed with userId). */
export async function readResumeFile(storedFileName: string): Promise<Buffer> {
  const safeName = path.basename(storedFileName);
  return readFile(path.join(RESUME_DIR, safeName));
}
