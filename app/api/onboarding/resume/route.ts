import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { saveResumeFile } from "@/lib/storage";
import { extractResumeText } from "@/lib/resume/extract-text";
import { getOpenAIForUser } from "@/lib/openai/client";
import { parseResumeWithAI } from "@/lib/openai/parse-resume";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await requireUser();

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing resume file" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload a PDF or DOCX." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 8MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { resumeFileUrl } = await saveResumeFile(user.id, file.name, buffer);

  let extractedText = "";
  try {
    extractedText = await extractResumeText(buffer, file.type);
  } catch (err) {
    // Text extraction failing shouldn't block onboarding — the user can still
    // fill in their profile manually.
    return NextResponse.json({
      resumeFileUrl,
      resumeFileName: file.name,
      suggestion: null,
      warning: `Could not read text from this file: ${(err as Error).message}`,
    });
  }

  const openai = await getOpenAIForUser(user.id);
  const suggestion = openai ? await parseResumeWithAI(openai, extractedText) : null;

  return NextResponse.json({
    resumeFileUrl,
    resumeFileName: file.name,
    suggestion,
    warning: openai
      ? suggestion
        ? null
        : "AI extraction didn't return usable data — please fill in your profile manually."
      : "Add your OpenAI key in Settings to auto-fill your profile from your resume.",
  });
}
