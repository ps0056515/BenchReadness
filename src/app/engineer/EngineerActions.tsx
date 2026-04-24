"use client";

import { useState } from "react";

function normalizeInterviewId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  try {
    // Allow pasting full URL.
    const url = new URL(s);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("interview");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]!;
  } catch {
    // not a URL
  }
  // Assume raw id.
  return s;
}

export function EngineerActions() {
  const [value, setValue] = useState("");

  const interviewId = normalizeInterviewId(value);

  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm">
        Paste interview link or id
        <input
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. cmob... or http://localhost:3000/interview/cmob..."
        />
      </label>
      <button
        type="button"
        disabled={!interviewId}
        onClick={() => {
          if (!interviewId) return;
          window.location.href = `/interview/${encodeURIComponent(interviewId)}`;
        }}
        className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background enabled:hover:bg-zinc-800 disabled:opacity-50 dark:enabled:hover:bg-zinc-200"
      >
        Open interview
      </button>
      <p className="text-xs text-zinc-500">
        In this demo build, engineers open interviews via the link/id created by a bench manager.
      </p>
    </div>
  );
}

