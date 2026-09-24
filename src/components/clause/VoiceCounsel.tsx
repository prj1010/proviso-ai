import { briefFor, getAgreement, listAgreements } from "@/clause/local-db";
import { speakClause } from "@/clause/voice.functions";
import { agreementService } from "@/services";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "speaking" | "listening";

interface Focus {
  id: string;
  title?: string;
}

const SAMPLE =
  "Here is a sample brief. The indemnity has no cap, even if the landlord shares fault. And the lease rolls for three years unless you cancel 120 days ahead. Open a workspace to hear this on your own agreement.";

export function VoiceCounsel() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mouth, setMouth] = useState(false);
  const [line, setLine] = useState("I can brief a lease out loud, or listen and answer from the clauses.");
  const [focus, setFocus] = useState<Focus | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const mouthTimer = useRef<number | null>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const onFocus = (event: Event) => {
      const detail = (event as CustomEvent<Focus>).detail;
      if (detail?.id) setFocus(detail);
      else setFocus(null);
    };
    window.addEventListener("clause:focus-agreement", onFocus);
    return () => window.removeEventListener("clause:focus-agreement", onFocus);
  }, []);

  useEffect(() => {
    return () => halt();
  }, []);

  const halt = () => {
    recogRef.current?.stop();
    recogRef.current = null;
    if (mouthTimer.current) window.clearInterval(mouthTimer.current);
    mouthTimer.current = null;
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setMouth(false);
    setPhase("idle");
  };

  const pulseMouth = () => {
    if (mouthTimer.current) window.clearInterval(mouthTimer.current);
    mouthTimer.current = window.setInterval(() => {
      setMouth((v) => !v);
    }, 160);
  };

  const speak = async (text: string) => {
    halt();
    const spoken = text.replace(/\s+/g, " ").trim().slice(0, 850);
    setLine(spoken);
    setOpen(true);
    setPhase("speaking");
    pulseMouth();
    try {
      const result = await speakClause({ data: { text: spoken } });
      if (result.ok && "audioBase64" in result && result.audioBase64) {
        const binary = atob(result.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const src = URL.createObjectURL(new Blob([bytes], { type: result.mime || "audio/mpeg" }));
        urlRef.current = src;
        await playUrl(src);
      } else if (result.ok && "url" in result && result.url) {
        await playUrl(result.url);
      } else {
        await browserSpeak(spoken);
      }
    } catch {
      await browserSpeak(spoken);
    }
    if (mouthTimer.current) window.clearInterval(mouthTimer.current);
    setMouth(false);
    setPhase("idle");
  };

  const playUrl = (src: string) =>
    new Promise<void>((resolve) => {
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      void audio.play().catch(() => resolve());
    });

  const browserSpeak = (text: string) =>
    new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });

  const brief = () => {
    const id =
      focus?.id ?? (path.startsWith("/dashboard") ? listAgreements()[0]?.id : undefined);
    if (id) {
      const agreement = getAgreement(id);
      if (agreement && agreement.status === "SUCCESS") {
        void speak(briefFor(agreement));
        return;
      }
    }
    if (path.startsWith("/dashboard")) {
      void speak("Upload a text-based PDF and I will brief the rent, the term, and the sharpest risk.");
      return;
    }
    void speak(SAMPLE);
  };

  const listen = () => {
    const Ctor =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!Ctor) {
      setOpen(true);
      setLine("This browser has no speech recognition. Type the question in the agreement chat, then press me to hear the answer.");
      return;
    }
    halt();
    setOpen(true);
    setPhase("listening");
    setLine("Listening… ask about rent, notice, the deposit, or a risky clause.");
    const recog = new Ctor();
    recog.lang = "en-IN";
    recog.interimResults = false;
    recog.continuous = false;
    recogRef.current = recog;
    recog.onresult = (event: SpeechRecognitionEvent) => {
      const said = event.results[0]?.[0]?.transcript?.trim();
      recogRef.current = null;
      setPhase("idle");
      if (!said) return;
      void answerSpoken(said);
    };
    recog.onerror = () => {
      setPhase("idle");
      setLine("I missed that. Try again, or type it in the chat.");
    };
    recog.onend = () => {
      if (phase === "listening") setPhase("idle");
    };
    recog.start();
  };

  const answerSpoken = async (said: string) => {
    setLine(`You asked: ${said}`);
    if (!focus?.id) {
      await speak("Open an agreement first. I only answer from the lease that is on screen.");
      return;
    }
    const agreement = getAgreement(focus.id);
    if (!agreement) return;
    const res = await agreementService.sendAgreementQuery({
      agreementId: agreement.id,
      chatId: agreement.chatId,
      message: said,
    });
    const reply = res.data?.message?.content;
    if (!res.success || !reply) {
      await speak("I could not answer that from the agreement.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("clause:voice-turn", {
        detail: {
          agreementId: agreement.id,
          user: res.data?.userMessage,
          assistant: res.data?.message,
        },
      }),
    );
    await speak(reply);
  };

  return (
    <div className={`voice-dock${focus ? " voice-dock-aside" : ""}`}>
      {open && (
        <div className="voice-panel" role="dialog" aria-label="Proviso counsel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#0f172a" }}>Asha</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Proviso counsel{focus?.title ? ` · ${focus.title}` : ""}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Hide counsel" type="button">
              Hide
            </button>
          </div>
          <p style={{ marginTop: "10px", fontSize: "0.84rem", lineHeight: 1.5, color: "#334155", maxHeight: "140px", overflow: "auto" }}>
            {line}
          </p>
          <div className="voice-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={brief} disabled={phase === "speaking"}>
              {phase === "speaking" ? "Speaking…" : "Brief me"}
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={listen} disabled={phase !== "idle"}>
              {phase === "listening" ? "Listening…" : "Ask aloud"}
            </button>
            {phase !== "idle" && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={halt}>
                Stop
              </button>
            )}
          </div>
        </div>
      )}
      <button
        className={`voice-face${phase === "speaking" ? " speaking" : ""}`}
        type="button"
        aria-label={open ? "Proviso counsel Asha" : "Open voice counsel"}
        onClick={() => (open ? setOpen(false) : setOpen(true))}
      >
        <img
          src={mouth ? "/counsel-open.jpg" : "/counsel-closed.jpg"}
          alt="Asha, Proviso counsel"
        />
      </button>
    </div>
  );
}

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}
