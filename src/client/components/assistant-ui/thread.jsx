"use client";

import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useThreadRuntime,
} from "@assistant-ui/react";
import {
  ArrowUpIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Leaf,
  Mic,
} from "lucide-react";
import { motion } from "framer-motion";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";

const CHAT_LIFT_TRANSITION = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.6,
};

const AlleafLogo = ({ className }) => (
  <div className={className}>
    <Leaf className="h-10 w-10" strokeWidth={1.5} />
  </div>
);

const SUGGESTIONS = [
  "How can I manage stress better?",
  "Guide me through a breathing exercise",
  "I need help improving my sleep",
  "What are some gratitude practices?",
];

const SuggestionButton = ({ text }) => {
  const threadRuntime = useThreadRuntime();
  return (
    <button
      type="button"
      onClick={() => threadRuntime.append({ role: "user", content: [{ type: "text", text }] })}
      className="w-full rounded-2xl border border-black/[0.06] bg-black/[0.03] px-4 py-3 text-left text-sm text-black/55 transition-all duration-200 hover:border-black/10 hover:bg-black/[0.05] hover:text-black/75 active:scale-[0.98]"
    >
      {text}
    </button>
  );
};

export const Thread = ({
  isVoiceOpen = false,
  isVoiceRunning = false,
  onStopVoice,
  onStartVoice,
  voiceControl = null,
}) => {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col items-stretch bg-transparent">
      <AuiIf condition={(s) => s.thread.isEmpty}>
        <div className="flex h-full flex-col">
          <motion.div
            className="flex flex-1 flex-col items-center justify-center px-6"
            initial={false}
            animate={{ y: isVoiceRunning ? -24 : 0 }}
            transition={CHAT_LIFT_TRANSITION}
            style={{ willChange: "transform" }}
          >
            <AlleafLogo className="mb-4 text-black/60" />
            <p className="mb-1 text-center text-lg font-medium text-black/85">
              How are you feeling?
            </p>
            <p className="mb-8 text-center text-sm text-black/40">
              Your mindful wellness companion
            </p>
            <div className="flex w-full max-w-sm flex-col gap-2.5">
              {SUGGESTIONS.map((s) => (
                <SuggestionButton key={s} text={s} />
              ))}
            </div>
          </motion.div>
          <div className="overflow-visible px-4 pt-2 pb-1">
            {voiceControl}
            <div className="-mx-4 border-t border-black/[0.06] bg-[#f2f2f7] px-4 pt-2 pb-1">
              <Composer
                isVoiceOpen={isVoiceOpen}
                isVoiceRunning={isVoiceRunning}
                onStopVoice={onStopVoice}
                onStartVoice={onStartVoice}
              />
              <p className="pb-1 text-center text-xs text-black/30">
                Alleaf is here to listen, not to replace professional support.
              </p>
            </div>
          </div>
        </div>
      </AuiIf>

      <AuiIf condition={(s) => s.thread.isEmpty === false}>
        <motion.div
          className="min-h-0 grow"
          initial={false}
          animate={{ y: isVoiceRunning ? -24 : 0 }}
          transition={CHAT_LIFT_TRANSITION}
          style={{ willChange: "transform" }}
        >
          <ThreadPrimitive.Viewport className="flex h-full flex-col justify-end overflow-y-scroll scroll-smooth px-3 pt-3 pb-2">
            <ThreadPrimitive.Messages components={{ Message: ChatMessage }} />
          </ThreadPrimitive.Viewport>
        </motion.div>
        <div className="overflow-visible px-3 pt-2 pb-1">
          {voiceControl}
          <div className="-mx-3 border-t border-black/[0.06] bg-[#f2f2f7] px-3 pt-2 pb-1">
            <Composer
              isVoiceOpen={isVoiceOpen}
              isVoiceRunning={isVoiceRunning}
              onStopVoice={onStopVoice}
              onStartVoice={onStartVoice}
            />
            <p className="mx-auto w-full max-w-3xl pb-1 text-center text-[11px] text-black/25">
              Alleaf is here to listen, not to replace professional support.
            </p>
          </div>
        </div>
      </AuiIf>
    </ThreadPrimitive.Root>
  );
};

const Composer = ({ isVoiceOpen, isVoiceRunning, onStopVoice, onStartVoice }) => {
  const isEmpty = useAuiState((s) => s.composer.isEmpty);
  const isRunning = useAuiState((s) => s.thread.isRunning);

  return (
    <ComposerPrimitive.Root
      className="group/composer mx-auto mb-2 w-full max-w-3xl"
      data-empty={isEmpty}
      data-running={isRunning}
    >
      <div className="flex min-w-0 items-end gap-2 px-1 py-1">
        <ComposerPrimitive.Input
          placeholder="How are you feeling?"
          minRows={1}
          className="max-h-36 min-h-10 min-w-0 flex-1 resize-none self-stretch bg-transparent px-0.5 py-2 text-[15px] leading-6 text-black/85 outline-none placeholder:text-black/35"
        />

        {isVoiceRunning ? (
          <button
            type="button"
            onClick={onStopVoice}
            aria-label="Stop voice mode"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/80 text-white transition-all duration-200 hover:bg-black/90 active:scale-[0.96]"
          >
            <Square width={13} height={13} fill="currentColor" />
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            {isVoiceOpen && onStartVoice ? (
              <button
                type="button"
                onClick={onStartVoice}
                aria-label="Return to voice mode"
                className="flex h-10 w-10 items-center justify-center rounded-full text-black/70 transition-all duration-200 hover:bg-black/[0.05] hover:text-black active:scale-[0.96]"
              >
                <Mic width={18} height={18} />
              </button>
            ) : null}
            <div className="relative h-10 w-10 overflow-hidden">
              <ComposerPrimitive.Send
                disabled={isEmpty}
                className="absolute inset-0 flex items-center justify-center rounded-full text-black/80 transition-all duration-300 ease-out hover:bg-black/[0.05] hover:text-black active:scale-[0.96] disabled:cursor-not-allowed disabled:text-black/30 group-data-[running=true]/composer:scale-0 group-data-[running=true]/composer:opacity-0"
              >
                <ArrowUpIcon width={18} height={18} />
              </ComposerPrimitive.Send>

              <ComposerPrimitive.Cancel className="absolute inset-0 flex items-center justify-center rounded-full bg-black/80 text-white transition-all duration-300 ease-out hover:bg-black/90 active:scale-[0.96] group-data-[running=false]/composer:scale-0 group-data-[running=false]/composer:opacity-0">
                <Square width={14} height={14} fill="currentColor" />
              </ComposerPrimitive.Cancel>
            </div>
          </div>
        )}
      </div>
    </ComposerPrimitive.Root>
  );
};

const UserText = ({ text }) => (
  <span className="block whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</span>
);

const ChatMessage = () => {
  return (
    <MessagePrimitive.Root className="group/message relative mx-auto flex w-full max-w-3xl flex-col">
      <AuiIf condition={(s) => s.message.role === "user"}>
        <div className="flex flex-col items-end py-1.5 pr-1">
          <motion.div
            className="max-w-[80%] self-end overflow-hidden"
            initial={{
              opacity: 0,
              y: 18,
              clipPath: "inset(100% 0% 0% 0% round 22px)",
            }}
            animate={{
              opacity: 1,
              y: 0,
              clipPath: "inset(0% 0% 0% 0% round 22px)",
            }}
            transition={{
              duration: 0.34,
              ease: [0.16, 1, 0.3, 1],
            }}
            >
            <div
              className="relative w-fit max-w-full rounded-[22px] bg-[#d9e5cc] text-[15px] leading-relaxed text-black/90 shadow-sm"
              style={{ padding: "5px 10px" }}
            >
              <MessagePrimitive.Parts components={{ Text: UserText }} />
            </div>
          </motion.div>
          <div className="mt-0.5 flex h-7 items-center justify-end gap-0.5 opacity-0 transition-opacity duration-200 group-focus-within/message:opacity-100 group-hover/message:opacity-100">
            <ActionBarPrimitive.Root className="flex items-center gap-0.5">
              <ActionBarPrimitive.Edit className="flex h-7 w-7 items-center justify-center rounded-full text-black/25 transition-colors hover:bg-black/5 hover:text-black/50">
                <PencilIcon width={14} height={14} />
              </ActionBarPrimitive.Edit>
              <ActionBarPrimitive.Copy className="flex h-7 w-7 items-center justify-center rounded-full text-black/25 transition-colors hover:bg-black/5 hover:text-black/50">
                <CopyIcon width={14} height={14} />
              </ActionBarPrimitive.Copy>
            </ActionBarPrimitive.Root>
          </div>
        </div>
      </AuiIf>

      <AuiIf condition={(s) => s.message.role === "assistant"}>
        <div className="flex flex-col items-start py-1.5">
          <div className="w-full max-w-none text-[15px] leading-[1.55] text-black/80">
            <div className="prose prose-sm wrap-break-word prose-headings:text-black/85 prose-li:my-0.5 prose-ol:my-1.5 prose-p:my-1.5 prose-ul:my-1.5">
              <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
            </div>
          </div>
          <div className="mt-0.5 flex h-7 w-full items-center justify-start gap-0.5 opacity-0 transition-opacity duration-200 group-focus-within/message:opacity-100 group-hover/message:opacity-100">
            <ActionBarPrimitive.Root className="-ml-1.5 flex items-center gap-0.5">
              <ActionBarPrimitive.Reload className="flex h-7 w-7 items-center justify-center rounded-full text-black/25 transition-colors hover:bg-black/5 hover:text-black/50">
                <RefreshCwIcon width={14} height={14} />
              </ActionBarPrimitive.Reload>
              <ActionBarPrimitive.Copy className="flex h-7 w-7 items-center justify-center rounded-full text-black/25 transition-colors hover:bg-black/5 hover:text-black/50">
                <CopyIcon width={14} height={14} />
              </ActionBarPrimitive.Copy>
              <ActionBarPrimitive.FeedbackPositive className="flex h-7 w-7 items-center justify-center rounded-full text-black/25 transition-colors hover:bg-black/5 hover:text-black/50">
                <ThumbsUpIcon width={14} height={14} />
              </ActionBarPrimitive.FeedbackPositive>
              <ActionBarPrimitive.FeedbackNegative className="flex h-7 w-7 items-center justify-center rounded-full text-black/25 transition-colors hover:bg-black/5 hover:text-black/50">
                <ThumbsDownIcon width={14} height={14} />
              </ActionBarPrimitive.FeedbackNegative>
            </ActionBarPrimitive.Root>
          </div>
        </div>
      </AuiIf>
    </MessagePrimitive.Root>
  );
};
