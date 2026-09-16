"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagInput } from "@/components/tag-input";

interface InitialProfile {
  resumeFileUrl: string | null;
  resumeFileName: string | null;
  resumeDriveLink: string | null;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  headline: string;
  summary: string;
  experienceYears: number;
  skills: string[];
  targetLocations: string[];
  outreachPreferences: { tone?: string; notes?: string };
}

export function OnboardingForm({ initialProfile }: { initialProfile: InitialProfile | null }) {
  const router = useRouter();

  const [resumeFileUrl, setResumeFileUrl] = useState(initialProfile?.resumeFileUrl ?? null);
  const [resumeFileName, setResumeFileName] = useState(initialProfile?.resumeFileName ?? null);
  const [resumeDriveLink, setResumeDriveLink] = useState(initialProfile?.resumeDriveLink ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile?.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(initialProfile?.githubUrl ?? "");
  const [headline, setHeadline] = useState(initialProfile?.headline ?? "");
  const [summary, setSummary] = useState(initialProfile?.summary ?? "");
  const [experienceYears, setExperienceYears] = useState(initialProfile?.experienceYears ?? 0);
  const [skills, setSkills] = useState<string[]>(initialProfile?.skills ?? []);
  const [targetLocations, setTargetLocations] = useState<string[]>(
    initialProfile?.targetLocations ?? []
  );
  const [tone, setTone] = useState(initialProfile?.outreachPreferences?.tone ?? "friendly");
  const [notes, setNotes] = useState(initialProfile?.outreachPreferences?.notes ?? "");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/onboarding/resume", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to process resume");
        return;
      }

      setResumeFileUrl(data.resumeFileUrl);
      setResumeFileName(data.resumeFileName);

      if (data.suggestion) {
        setHeadline((prev) => prev || data.suggestion.headline);
        setSummary((prev) => prev || data.suggestion.summary);
        if (data.suggestion.experienceYears) setExperienceYears(data.suggestion.experienceYears);
        setSkills((prev) => (prev.length ? prev : data.suggestion.skills));
        setTargetLocations((prev) => (prev.length ? prev : data.suggestion.suggestedLocations));
        toast.success("Resume uploaded — profile pre-filled from it. Review and adjust below.");
      } else {
        toast.success("Resume uploaded.");
      }
      if (data.warning) toast.message(data.warning);
    } catch {
      toast.error("Failed to upload resume");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!skills.length) {
      toast.error("Add at least one skill");
      return;
    }
    if (!targetLocations.length) {
      toast.error("Add at least one target location");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeFileUrl,
          resumeFileName,
          resumeDriveLink,
          phone,
          linkedinUrl,
          githubUrl,
          headline,
          summary,
          experienceYears,
          skills,
          targetLocations,
          outreachPreferences: { tone, notes },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Failed to save profile");
        return;
      }

      toast.success("Profile saved");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resume-upload">Upload resume (PDF or DOCX)</Label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="resume-upload"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "cursor-pointer",
                  uploading && "pointer-events-none opacity-50"
                )}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Processing..." : "Choose file"}
              </label>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {resumeFileName && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {resumeFileName}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="drive-link">Google Drive (or other cloud) resume link</Label>
            <Input
              id="drive-link"
              type="url"
              placeholder="https://drive.google.com/..."
              value={resumeDriveLink}
              onChange={(e) => setResumeDriveLink(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This link is what gets shared in outreach emails sent on your behalf.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              placeholder="e.g. Senior Software Engineer"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Included in the signature of outreach emails sent on your behalf.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="linkedin-url">LinkedIn URL</Label>
              <Input
                id="linkedin-url"
                type="url"
                placeholder="https://linkedin.com/in/..."
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-url">GitHub URL</Label>
              <Input
                id="github-url"
                type="url"
                placeholder="https://github.com/..."
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Both are optional and, when set, included as links in the signature of outreach
            emails sent on your behalf.
          </p>

          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={3}
              placeholder="A short professional summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="experience">Years of experience</Label>
            <Input
              id="experience"
              type="number"
              min={0}
              max={60}
              step={0.5}
              value={experienceYears}
              onChange={(e) => setExperienceYears(Number(e.target.value))}
              className="w-32"
            />
          </div>

          <div className="space-y-2">
            <Label>Key skills</Label>
            <TagInput value={skills} onChange={setSkills} placeholder="Type a skill and press Enter" />
          </div>

          <div className="space-y-2">
            <Label>Target locations</Label>
            <TagInput
              value={targetLocations}
              onChange={setTargetLocations}
              placeholder="e.g. Bengaluru, Remote"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outreach preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => v && setTone(v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Anything else to mention in outreach emails?</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Optional notes the AI should keep in mind when drafting emails"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save & continue
      </Button>
    </form>
  );
}
