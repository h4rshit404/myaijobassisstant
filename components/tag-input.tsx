"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
  className?: string;
}

export function TagInput({ value, onChange, placeholder, max, disabled, className }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const atMax = typeof max === "number" && value.length >= max;

  function commitDraft() {
    const tag = draft.trim();
    setDraft("");
    if (!tag || atMax) return;
    if (value.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm",
        "focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring",
        disabled && "opacity-50",
        className
      )}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full hover:bg-muted-foreground/20"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && !atMax && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={value.length ? "" : placeholder}
          className="flex-1 min-w-[8ch] bg-transparent outline-none placeholder:text-muted-foreground"
        />
      )}
      {atMax && (
        <span className="text-xs text-muted-foreground">Max {max} reached</span>
      )}
    </div>
  );
}
