"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { TagInput } from "@/components/tag-input";

interface PlatformOption {
  id: string;
  label: string;
  requiresKey: boolean;
}

export function SearchForm({ platforms }: { platforms: PlatformOption[] }) {
  const router = useRouter();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(platforms.map((p) => p.id));
  const [submitting, setSubmitting] = useState(false);

  function togglePlatform(id: string, checked: boolean) {
    setSelectedPlatforms((prev) => (checked ? [...prev, id] : prev.filter((p) => p !== id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keywords.length) return toast.error("Add at least one keyword");
    if (!locations.length) return toast.error("Add at least one location");
    if (!selectedPlatforms.length) return toast.error("Select at least one platform");

    setSubmitting(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, locations, platforms: selectedPlatforms }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start search");
        return;
      }
      router.push(`/dashboard/searches/${data.id}`);
    } catch {
      toast.error("Failed to start search");
    } finally {
      setSubmitting(false);
    }
  }

  const apiPlatforms = platforms.filter((p) => p.requiresKey);
  const scrapePlatforms = platforms.filter((p) => !p.requiresKey);

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label>Job title keywords</Label>
            <TagInput
              value={keywords}
              onChange={setKeywords}
              max={10}
              placeholder="e.g. Software Engineer, Java Fullstack Developer"
            />
          </div>

          <div className="space-y-2">
            <Label>Locations (up to 3)</Label>
            <TagInput
              value={locations}
              onChange={setLocations}
              max={3}
              placeholder="e.g. Bengaluru, Hyderabad, Remote"
            />
          </div>

          <div className="space-y-3">
            <Label>Platforms</Label>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                API-backed (needs a key in Settings, optional)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {apiPlatforms.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedPlatforms.includes(p.id)}
                      onCheckedChange={(c) => togglePlatform(p.id, c === true)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Best-effort public scraping (no key needed, coverage varies)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {scrapePlatforms.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedPlatforms.includes(p.id)}
                      onCheckedChange={(c) => togglePlatform(p.id, c === true)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
