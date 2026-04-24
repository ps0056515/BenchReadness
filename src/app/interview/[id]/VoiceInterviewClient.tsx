"use client";

import { useEffect, useRef, useState } from "react";

type Utterance = { speaker: "BOT" | "CANDIDATE"; text: string; at: string };

type Props = {
  jdTitle: string;
  interviewId: string;
  onTranscriptChange: (json: string) => void;
};

type MicPhase = "idle" | "listening" | "bot_speaking";

function nowIso() {
  return new Date().toISOString();
}

/** Speak and resolve when playback finishes (or immediately if unsupported). */
function speakWhenDone(text: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  return new Promise((resolve) => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

/** User asked to end (spoken); do not treat as a technical answer. */
function isEndInterviewIntent(text: string): boolean {
  const t = text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length === 0) return false;
  const patterns = [
    /\bstop (the )?interview\b/,
    /\bend (the )?interview\b/,
    /\bstop (this )?session\b/,
    /\bend (this )?session\b/,
    /\bno more questions\b/,
    /\b(i'?m|i am) done\b/,
    /\bwe'?re done\b/,
    /\bthat'?s all\b/,
    /\blet'?s stop\b/,
    /\bplease stop\b/,
    /\bwant to stop\b/,
    /\bwould like to stop\b/,
    /\bwrap( it)? up\b/,
    /\bterminate (the )?interview\b/,
    /\bcan we stop\b/,
    /\bneed to stop\b/,
  ];
  return patterns.some((re) => re.test(t));
}

export function VoiceInterviewClient({ jdTitle, interviewId, onTranscriptChange }: Props) {
  const w =
    typeof window !== "undefined"
      ? (window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown })
      : null;
  const SR = (w?.SpeechRecognition ?? w?.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined;
  const supported = Boolean(SR);
  const [micPhase, setMicPhase] = useState<MicPhase>("idle");
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [botPromptIdx, setBotPromptIdx] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [typedDraft, setTypedDraft] = useState("");
  /** Mirrored for UI; logic also uses typedOnlyRef inside callbacks. */
  const [typedAnswersOnly, setTypedAnswersOnly] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const utterancesRef = useRef<Utterance[]>([]);
  const finalBufferRef = useRef("");
  /** Latest interim phrase (not always finalized by engine when user clicks Send). */
  const interimRef = useRef("");
  const botPromptIdxRef = useRef(0);
  /** User wants an active interview session (Start … until Stop). */
  const sessionActiveRef = useRef(false);
  /** Recognition was stopped only so the bot can speak (do not flush / do not treat as user Stop). */
  const pausedForTtsRef = useRef(false);
  /** User clicked "Send answer" — wait for `onend` so the engine finalizes text before flush. */
  const commitAfterEndRef = useRef(false);
  /** User clicked "Stop session" — must not flush buffer as an answer on `onend`. */
  const explicitStopRef = useRef(false);
  /** User chose typed answers only (no Web Speech recognition). */
  const typedOnlyRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest “user left view” cleanup (avoids stale closures in document listeners). */
  const silentEndBecauseUserLeftRef = useRef<() => void>(() => {});

  type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort?: () => void;
    onresult: ((event: unknown) => void) | null;
    onerror: ((event: unknown) => void) | null;
    onend: (() => void) | null;
  };

  async function fetchNextQuestion(args: {
    slot: number;
    lastAnswer: string;
    transcript: Utterance[];
  }): Promise<string | null> {
    try {
      const res = await fetch(`/api/interviews/${encodeURIComponent(interviewId)}/next-question`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slot: args.slot,
          lastAnswer: args.lastAnswer,
          utterances: args.transcript,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { question?: string };
      return typeof data.question === "string" ? data.question : null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recognitionRef.current = rec;
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, [SR]);

  useEffect(() => {
    utterancesRef.current = utterances;
  }, [utterances]);

  useEffect(() => {
    botPromptIdxRef.current = botPromptIdx;
  }, [botPromptIdx]);

  useEffect(() => {
    const transcript = {
      meta: { source: "web-speech", at: nowIso() },
      utterances,
    };
    onTranscriptChange(JSON.stringify(transcript, null, 2));
  }, [utterances, onTranscriptChange]);

  function syncUtterances(next: Utterance[]) {
    utterancesRef.current = next;
    setUtterances(next);
  }

  function releaseMicStream() {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }

  function speechErrorMessage(code: string | undefined): string {
    switch (code) {
      case "not-allowed":
        return "Microphone or speech recognition was blocked. Click the lock icon in the address bar, allow microphone (and sound if listed), then try Start again. Use Chrome or Edge on desktop.";
      case "audio-capture":
        return "No microphone was found, or it is in use by another app. Close other apps using the mic and try again.";
      case "service-not-allowed":
        return "Speech recognition is disabled for this page. Try another browser or check enterprise policies.";
      case "network":
        return "Speech recognition hit a network error (Chrome uses a cloud service for Web Speech). Check your connection and try again.";
      default:
        return code ? `Speech recognition error: ${code}` : "Speech recognition failed.";
    }
  }

  async function ensureMicStream(): Promise<boolean> {
    releaseMicStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setSpeechError("This browser does not support getUserMedia. Use Chrome or Edge on desktop.");
      return false;
    }
    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSpeechError(
        `Could not open microphone (${msg}). Check browser permissions, unplug/replug USB headsets, and try “Use typed answers instead” below.`,
      );
      return false;
    }
  }

  /** One bot line + TTS without restarting the recognition loop (session already over or pausing). */
  async function playClosingLine(botText: string) {
    const row: Utterance = { speaker: "BOT", text: botText, at: nowIso() };
    syncUtterances([...utterancesRef.current, row]);
    setMicPhase("bot_speaking");
    await speakWhenDone(botText);
    setMicPhase("idle");
  }

  async function addBot(text: string) {
    const row: Utterance = { speaker: "BOT", text, at: nowIso() };
    syncUtterances([...utterancesRef.current, row]);

    const rec = recognitionRef.current;
    if (rec && sessionActiveRef.current) {
      pausedForTtsRef.current = true;
      finalBufferRef.current = "";
      interimRef.current = "";
      setInterimText("");
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }

    setMicPhase("bot_speaking");
    await speakWhenDone(text);

    pausedForTtsRef.current = false;
    if (sessionActiveRef.current) {
      setMicPhase("listening");
      if (typedOnlyRef.current) {
        return;
      }
      scheduleRecognitionStart("after tts");
    }
  }

  function scheduleRecognitionStart(reason: string) {
    void reason;
    if (typedOnlyRef.current) {
      if (sessionActiveRef.current) setMicPhase("listening");
      return;
    }
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    const rec = recognitionRef.current;
    if (!rec || !sessionActiveRef.current) return;

    const attempt = (delayMs: number) => {
      restartTimerRef.current = setTimeout(() => {
        try {
          rec.start();
          setMicPhase("listening");
        } catch {
          restartTimerRef.current = setTimeout(() => {
            try {
              rec.start();
              setMicPhase("listening");
            } catch {
              setMicPhase("idle");
              sessionActiveRef.current = false;
            }
          }, 350);
        }
      }, delayMs);
    };

    attempt(80);
  }

  function addCandidate(text: string) {
    const row: Utterance = { speaker: "CANDIDATE", text, at: nowIso() };
    syncUtterances([...utterancesRef.current, row]);
  }

  async function advanceAfterAnswer(answer: string) {
    const clean = answer.trim();
    if (!clean) return;

    const nextSlot = botPromptIdxRef.current + 1;
    const q =
      (await fetchNextQuestion({
        slot: nextSlot,
        lastAnswer: clean,
        transcript: utterancesRef.current,
      })) ??
      "I didn’t quite catch the next prompt from the server—staying on what you just said, could you give me one concrete example and what made it tricky?";

    botPromptIdxRef.current = nextSlot;
    setBotPromptIdx(nextSlot);
    await addBot(q);
  }

  async function endInterviewFromVoice(userLine: string) {
    sessionActiveRef.current = false;
    typedOnlyRef.current = false;
    setTypedAnswersOnly(false);
    commitAfterEndRef.current = false;
    explicitStopRef.current = false;
    finalBufferRef.current = "";
    interimRef.current = "";
    setInterimText("");
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    releaseMicStream();
    addCandidate(userLine);
    await playClosingLine(
      "Got it—we’ll wrap up here. Thanks for letting me know; you can press Mark complete below when you’re ready.",
    );
  }

  function flushSpokenAnswer() {
    const clean = finalBufferRef.current.trim();
    if (!clean) return;

    finalBufferRef.current = "";
    interimRef.current = "";
    setInterimText("");

    if (isEndInterviewIntent(clean)) {
      void endInterviewFromVoice(clean);
      return;
    }

    addCandidate(clean);
    void advanceAfterAnswer(clean);
  }

  function attachRecognitionHandlers() {
    const rec = recognitionRef.current;
    if (!rec) return;

    rec.onresult = (event) => {
      if (pausedForTtsRef.current) return;
      const e = event as {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript?: string } }>;
      };
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res?.[0]?.transcript ?? "";
        if (res?.isFinal) finalBufferRef.current += text.trim() + " ";
        else interim += text;
      }
      const trimmed = interim.trim();
      interimRef.current = trimmed;
      setInterimText(trimmed);
      if (trimmed.length > 0) {
        setSpeechError(null);
      }
    };

    rec.onerror = (event) => {
      const err = (event as { error?: string })?.error;
      if (err === "aborted") return;
      if (err === "no-speech" && sessionActiveRef.current && !pausedForTtsRef.current) {
        scheduleRecognitionStart("no-speech");
        return;
      }
      if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") {
        sessionActiveRef.current = false;
        pausedForTtsRef.current = false;
        typedOnlyRef.current = false;
        setTypedAnswersOnly(false);
        setMicPhase("idle");
        setSpeechError(speechErrorMessage(err));
        releaseMicStream();
        return;
      }
      if (err === "network") {
        setSpeechError(speechErrorMessage("network"));
      }
      if (sessionActiveRef.current && !pausedForTtsRef.current) {
        scheduleRecognitionStart(`recover ${err ?? "error"}`);
      }
    };

    rec.onend = () => {
      if (pausedForTtsRef.current) {
        return;
      }
      if (explicitStopRef.current) {
        explicitStopRef.current = false;
        finalBufferRef.current = "";
        interimRef.current = "";
        setInterimText("");
        commitAfterEndRef.current = false;
        setMicPhase("idle");
        void playClosingLine(
          "Alright, stopping here. Thanks for your time—you can mark this interview complete below when you’re ready.",
        );
        return;
      }
      if (!sessionActiveRef.current) {
        finalBufferRef.current = "";
        interimRef.current = "";
        setInterimText("");
        setMicPhase("idle");
        return;
      }
      if (commitAfterEndRef.current) {
        commitAfterEndRef.current = false;
        const stitch = `${finalBufferRef.current.trim()} ${interimRef.current.trim()}`.trim();
        if (stitch) {
          finalBufferRef.current = stitch + " ";
          interimRef.current = "";
          setInterimText("");
        }
        const stitched = finalBufferRef.current.trim();
        const hadSpeech = stitched.length > 0;
        if (hadSpeech && isEndInterviewIntent(stitched)) {
          void endInterviewFromVoice(stitched);
          return;
        }
        flushSpokenAnswer();
        if (sessionActiveRef.current && !hadSpeech) {
          scheduleRecognitionStart("commit with empty buffer");
        }
        return;
      }
      scheduleRecognitionStart("onend");
    };
  }

  async function submitTypedReply() {
    const text = typedDraft.trim();
    if (!text || !sessionActiveRef.current || micPhase !== "listening") return;
    setTypedDraft("");
    setSpeechError(null);
    if (!typedOnlyRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    }
    finalBufferRef.current = "";
    interimRef.current = "";
    setInterimText("");
    if (isEndInterviewIntent(text)) {
      void endInterviewFromVoice(text);
      return;
    }
    addCandidate(text);
    void advanceAfterAnswer(text);
  }

  async function startTypedOnly() {
    if (!recognitionRef.current) return;
    setSpeechError(null);
    releaseMicStream();
    typedOnlyRef.current = true;
    setTypedAnswersOnly(true);
    sessionActiveRef.current = true;
    pausedForTtsRef.current = false;
    commitAfterEndRef.current = false;
    explicitStopRef.current = false;
    finalBufferRef.current = "";
    interimRef.current = "";
    setInterimText("");
    attachRecognitionHandlers();

    if (utterancesRef.current.length === 0) {
      setMicPhase("bot_speaking");
      const q =
        (await fetchNextQuestion({ slot: 1, lastAnswer: "", transcript: [] })) ??
        `We’ll go straight to technical for ${jdTitle}. First: name a core subsystem or stack you’d own in this kind of role and walk me through how you’ve built or run it in production—constraints, what broke, and how you verified it.`;
      const row: Utterance = { speaker: "BOT", text: q, at: nowIso() };
      syncUtterances([...utterancesRef.current, row]);
      botPromptIdxRef.current = 1;
      setBotPromptIdx(1);
      await speakWhenDone(q);
      if (sessionActiveRef.current) {
        setMicPhase("listening");
      }
      return;
    }

    setMicPhase("listening");
  }

  async function start() {
    if (!recognitionRef.current) return;
    typedOnlyRef.current = false;
    setTypedAnswersOnly(false);
    setSpeechError(null);
    const micOk = await ensureMicStream();
    if (!micOk) {
      sessionActiveRef.current = false;
      setMicPhase("idle");
      return;
    }

    sessionActiveRef.current = true;
    pausedForTtsRef.current = false;
    commitAfterEndRef.current = false;
    explicitStopRef.current = false;
    finalBufferRef.current = "";
    interimRef.current = "";
    setInterimText("");
    attachRecognitionHandlers();

    const rec = recognitionRef.current;

    if (utterancesRef.current.length === 0) {
      setMicPhase("bot_speaking");
      const q =
        (await fetchNextQuestion({ slot: 1, lastAnswer: "", transcript: [] })) ??
        `We’ll go straight to technical for ${jdTitle}. First: name a core subsystem or stack you’d own in this kind of role and walk me through how you’ve built or run it in production—constraints, what broke, and how you verified it.`;
      const row: Utterance = { speaker: "BOT", text: q, at: nowIso() };
      syncUtterances([...utterancesRef.current, row]);
      botPromptIdxRef.current = 1;
      setBotPromptIdx(1);
      await speakWhenDone(q);
      if (sessionActiveRef.current) {
        setMicPhase("listening");
        attachRecognitionHandlers();
        if (!typedOnlyRef.current) {
          scheduleRecognitionStart("open mic after intro");
        }
      }
      return;
    }

    try {
      rec.start();
      setMicPhase("listening");
    } catch {
      scheduleRecognitionStart("start catch");
    }
  }

  function stop() {
    sessionActiveRef.current = false;
    typedOnlyRef.current = false;
    setTypedAnswersOnly(false);
    pausedForTtsRef.current = false;
    commitAfterEndRef.current = false;
    explicitStopRef.current = true;
    releaseMicStream();
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    window.speechSynthesis?.cancel();

    const rec = recognitionRef.current;
    if (!rec) {
      explicitStopRef.current = false;
      void playClosingLine(
        "Alright, stopping here. Thanks for your time—you can mark this interview complete below when you’re ready.",
      );
      return;
    }
    try {
      rec.stop();
    } catch {
      explicitStopRef.current = false;
      void playClosingLine(
        "Alright, stopping here. Thanks for your time—you can mark this interview complete below when you’re ready.",
      );
    }
  }

  silentEndBecauseUserLeftRef.current = () => {
    releaseMicStream();
    window.speechSynthesis?.cancel();
    if (!sessionActiveRef.current) {
      return;
    }
    sessionActiveRef.current = false;
    typedOnlyRef.current = false;
    setTypedAnswersOnly(false);
    pausedForTtsRef.current = false;
    commitAfterEndRef.current = false;
    explicitStopRef.current = false;
    finalBufferRef.current = "";
    interimRef.current = "";
    setInterimText("");
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setMicPhase("idle");
  };

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        silentEndBecauseUserLeftRef.current();
      }
    };
    const onPageHide = () => {
      silentEndBecauseUserLeftRef.current();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      silentEndBecauseUserLeftRef.current();
    };
  }, []);

  const listening = micPhase === "listening";
  const botSpeaking = micPhase === "bot_speaking";

  if (!supported) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        Voice demo isn’t supported in this browser. Use Chrome/Edge on desktop (Web Speech API).
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      {speechError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="font-medium">Microphone / speech</div>
          <p className="mt-1">{speechError}</p>
          <p className="mt-2 text-xs opacity-90">
            Use <span className="font-medium">Chrome or Edge</span> on desktop, HTTPS or localhost, and allow microphone
            for this site. Web Speech sends audio to the browser vendor’s recognition service (not our servers).
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-medium">Voice interview (demo)</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The microphone stays off while the bot speaks so speakers do not feed junk into recognition. When
            you see <span className="font-medium">Mic on</span>, speak your answer, then click{" "}
            <span className="font-medium">Send answer</span> to continue. Say things like{" "}
            <span className="font-medium">stop the interview</span> before sending, or press{" "}
            <span className="font-medium">Stop session</span>, to end with a goodbye—no further questions.{" "}
            <span className="font-medium">Leaving this tab, hiding the browser, or navigating away</span> stops the
            session automatically (no goodbye audio).
          </div>
          <div
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
              botSpeaking
                ? "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                : listening
                  ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
            role="status"
            aria-live="polite"
          >
            {botSpeaking
              ? "Bot is speaking — mic paused"
              : listening
                ? typedAnswersOnly
                  ? "Typed answers mode — write below, then submit"
                  : "Mic on — speak, or type below"
                : "Mic off — press Start"}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {micPhase === "idle" ? (
            <>
              <button
                className="rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
                type="button"
                onClick={() => void start()}
              >
                Start (mic)
              </button>
              <button
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                type="button"
                onClick={() => void startTypedOnly()}
              >
                Use typed answers only
              </button>
            </>
          ) : (
            <button
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              type="button"
              onClick={stop}
            >
              Stop session
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 max-h-[320px] overflow-auto rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
        {utterances.length ? (
          utterances.map((u, idx) => (
            <div key={idx} className="mb-2">
              <span className="font-medium">{u.speaker === "BOT" ? "Bot" : "You"}:</span>{" "}
              <span>{u.text}</span>
            </div>
          ))
        ) : (
          <div className="text-zinc-600 dark:text-zinc-400">
            Press <span className="font-medium">Start (mic)</span> or <span className="font-medium">Use typed answers only</span>
            : you will hear the first question, then you can speak and/or type your reply.
          </div>
        )}
        {listening && !typedAnswersOnly && interimText ? (
          <div className="mt-3 border-t border-zinc-200 pt-3 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">Heard (live):</span> {interimText}
          </div>
        ) : listening && !typedAnswersOnly && !interimText ? (
          <div className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-400">
            Waiting for speech… if this stays blank, use the typed box below or try another browser.
          </div>
        ) : null}
      </div>

      {listening ? (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200" htmlFor="typed-interview-reply">
            {typedAnswersOnly ? "Your answer (typed)" : "Or type your answer if the mic is flaky"}
          </label>
          <textarea
            id="typed-interview-reply"
            className="mt-1 min-h-[88px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-black"
            value={typedDraft}
            onChange={(e) => setTypedDraft(e.target.value)}
            placeholder="Write your technical answer here…"
          />
          <button
            type="button"
            className="mt-2 rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
            onClick={() => void submitTypedReply()}
          >
            Submit typed reply
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-zinc-500">
          {typedAnswersOnly ? (
            <>
              <span className="font-medium">Submit typed reply</span> continues the interview.{" "}
              <span className="font-medium">Stop session</span> ends with a goodbye.
            </>
          ) : (
            <>
              <span className="font-medium">Send answer (voice)</span> finalizes what the mic heard.{" "}
              <span className="font-medium">Submit typed reply</span> uses the text box for that turn.{" "}
              <span className="font-medium">Stop session</span> ends (no next question).
            </>
          )}
        </div>
        <button
          type="button"
          disabled={!listening || typedAnswersOnly}
          className="w-fit rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          onClick={() => {
            const rec = recognitionRef.current;
            if (!rec || !sessionActiveRef.current) return;
            commitAfterEndRef.current = true;
            try {
              rec.stop();
            } catch {
              commitAfterEndRef.current = false;
              flushSpokenAnswer();
              if (sessionActiveRef.current) {
                scheduleRecognitionStart("send answer sync fallback");
              }
            }
          }}
        >
          Send answer (voice)
        </button>
      </div>
    </div>
  );
}
