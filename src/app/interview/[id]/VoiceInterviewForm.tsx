"use client";

import { useCallback, useState } from "react";
import { VoiceInterviewClient } from "./VoiceInterviewClient";

export function VoiceInterviewForm({
  interviewId,
  jdTitle,
  completeInterview,
}: {
  interviewId: string;
  jdTitle: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completeInterview: (formData: FormData) => Promise<any>;
}) {
  const [transcriptJson, setTranscriptJson] = useState("");

  const onTranscriptChange = useCallback((json: string) => {
    setTranscriptJson(json);
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="font-medium">Voice interview</div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Technical questions from the first turn. Mark complete to save the transcript; an AI pass scores{" "}
        <span className="font-medium">TechnicalKnowledge</span> and <span className="font-medium">Communication</span>{" "}
        from your answers vs the JD and resume summary from setup (needs <span className="font-medium">OPENAI_API_KEY</span>
        ; otherwise a heuristic placeholder runs).
      </p>

      <div className="mt-4">
        <VoiceInterviewClient
          jdTitle={jdTitle}
          interviewId={interviewId}
          onTranscriptChange={onTranscriptChange}
        />
      </div>

      <form action={completeInterview} className="mt-4 grid gap-3">
        <input type="hidden" name="interviewId" value={interviewId} />
        <input type="hidden" name="transcriptJson" value={transcriptJson} />

        <label className="grid gap-2 text-sm">
          Candidate notes (optional)
          <textarea
            className="min-h-[120px] rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
            name="candidateNotes"
            placeholder="Anything you want the reviewer to know…"
          />
        </label>

        <div className="pt-1">
          <button
            className="rounded-full bg-foreground px-6 py-2 text-sm font-medium text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
            type="submit"
          >
            Mark complete
          </button>
        </div>
      </form>
    </div>
  );
}

