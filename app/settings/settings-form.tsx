"use client";

import { useState } from "react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface OpenAIStatus {
  hasKey: boolean;
  isValid: boolean;
  model: string;
  lastValidated: string | null;
}
interface ScraperKeyStatus {
  adzunaAppId: boolean;
  adzunaAppKey: boolean;
  rapidApiKey: boolean;
  serpApiKey: boolean;
}
interface GmailStatus {
  email: string;
  scopes: string[];
  connectedAt: string;
}

export function SettingsForm({
  openai,
  scraperKeys,
  gmail,
}: {
  openai: OpenAIStatus;
  scraperKeys: ScraperKeyStatus;
  gmail: GmailStatus | null;
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(openai.model);
  const [savingKey, setSavingKey] = useState(false);
  const [openaiValid, setOpenaiValid] = useState(openai.isValid);

  const [adzunaAppId, setAdzunaAppId] = useState("");
  const [adzunaAppKey, setAdzunaAppKey] = useState("");
  const [rapidApiKey, setRapidApiKey] = useState("");
  const [serpApiKey, setSerpApiKey] = useState("");
  const [savingScraperKeys, setSavingScraperKeys] = useState(false);

  const gmailHasSendScope = gmail?.scopes.some((s) => s.endsWith("/gmail.send")) ?? false;

  async function handleSaveOpenAIKey() {
    if (!apiKey.trim()) {
      toast.error("Enter an API key first");
      return;
    }
    setSavingKey(true);
    try {
      const res = await fetch("/api/settings/openai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), model }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save key");
        setOpenaiValid(false);
        return;
      }
      setOpenaiValid(true);
      setApiKey("");
      toast.success("OpenAI key validated and saved");
    } catch {
      toast.error("Failed to save key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleSaveScraperKeys() {
    setSavingScraperKeys(true);
    try {
      const res = await fetch("/api/settings/scraper-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(adzunaAppId ? { adzunaAppId } : {}),
          ...(adzunaAppKey ? { adzunaAppKey } : {}),
          ...(rapidApiKey ? { rapidApiKey } : {}),
          ...(serpApiKey ? { serpApiKey } : {}),
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save keys");
        return;
      }
      setAdzunaAppId("");
      setAdzunaAppKey("");
      setRapidApiKey("");
      setSerpApiKey("");
      toast.success("Job-source keys saved");
    } catch {
      toast.error("Failed to save keys");
    } finally {
      setSavingScraperKeys(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            OpenAI API key
            {openaiValid && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Used to extract and classify contact emails from job postings, and to draft outreach
            emails. Required before running searches or generating emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-key">API key</Label>
            <Input
              id="openai-key"
              type="password"
              placeholder={openai.hasKey ? "•••••••••••••••• (saved — enter a new key to replace)" : "sk-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={model} onValueChange={(v) => v && setModel(v)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">gpt-4o-mini (recommended)</SelectItem>
                <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveOpenAIKey} disabled={savingKey}>
            {savingKey && <Loader2 className="h-4 w-4 animate-spin" />}
            Validate & save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Gmail connection
          </CardTitle>
          <CardDescription>
            Outreach emails are sent from your own Gmail account via the OAuth grant from sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gmail && gmailHasSendScope ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Connected as <span className="font-medium">{gmail.email}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Gmail send permission isn&apos;t granted yet. Reconnect to authorize sending.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => signIn("google", { callbackUrl: "/settings" })}
          >
            {gmail ? "Reconnect Gmail" : "Connect Gmail"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job-source API keys (optional)</CardTitle>
          <CardDescription>
            Free self-serve keys that improve search coverage beyond best-effort scraping.
            Adzuna: developer.adzuna.com &middot; RapidAPI (JSearch): rapidapi.com/letscrape/api/jsearch
            &middot; SerpAPI (Google Jobs): serpapi.com
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adzuna-id">Adzuna App ID</Label>
              <Input
                id="adzuna-id"
                type="password"
                placeholder={scraperKeys.adzunaAppId ? "•••••••• (saved)" : "app id"}
                value={adzunaAppId}
                onChange={(e) => setAdzunaAppId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adzuna-key">Adzuna App Key</Label>
              <Input
                id="adzuna-key"
                type="password"
                placeholder={scraperKeys.adzunaAppKey ? "•••••••• (saved)" : "app key"}
                value={adzunaAppKey}
                onChange={(e) => setAdzunaAppKey(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rapidapi-key">RapidAPI key (JSearch)</Label>
            <Input
              id="rapidapi-key"
              type="password"
              placeholder={scraperKeys.rapidApiKey ? "•••••••• (saved)" : "rapidapi key"}
              value={rapidApiKey}
              onChange={(e) => setRapidApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serpapi-key">SerpAPI key (Google Jobs)</Label>
            <Input
              id="serpapi-key"
              type="password"
              placeholder={scraperKeys.serpApiKey ? "•••••••• (saved)" : "serpapi key"}
              value={serpApiKey}
              onChange={(e) => setSerpApiKey(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={handleSaveScraperKeys} disabled={savingScraperKeys}>
            {savingScraperKeys && <Loader2 className="h-4 w-4 animate-spin" />}
            Save job-source keys
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
