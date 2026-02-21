"use client";

import {
  ActionBarPrimitive,
  AuiIf,
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useThreadRuntime,
} from "@assistant-ui/react";
import {
  ArrowUpIcon,
  CopyIcon,
  XIcon,
  PencilIcon,
  RefreshCwIcon,
  Mic,
  Paperclip,
  Square,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Leaf,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";

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

export const Thread = () => {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col items-stretch bg-transparent">
      <AuiIf condition={(s) => s.thread.isEmpty}>
        <div className="flex h-full flex-col">
          <div className="flex flex-1 flex-col items-center justify-center px-6">
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
          </div>
          <div className="bg-[#f2f2f7] px-4 pt-2 pb-1">
            <Composer />
            <p className="pb-1 text-center text-xs text-black/30">
              Alleaf is here to listen, not to replace professional support.
            </p>
          </div>
        </div>
      </AuiIf>

      <AuiIf condition={(s) => s.thread.isEmpty === false}>
        <ThreadPrimitive.Viewport className="flex grow flex-col justify-end overflow-y-scroll scroll-smooth px-3 pt-3 pb-2">
          <ThreadPrimitive.Messages components={{ Message: ChatMessage }} />
        </ThreadPrimitive.Viewport>
        <div className="border-t border-black/[0.04] bg-[#f2f2f7] px-3 pt-2 pb-1">
          <Composer />
          <p className="mx-auto w-full max-w-3xl pb-1 text-center text-[11px] text-black/25">
            Alleaf is here to listen, not to replace professional support.
          </p>
        </div>
      </AuiIf>
    </ThreadPrimitive.Root>
  );
};

const Composer = () => {
  const isEmpty = useAuiState((s) => s.composer.isEmpty);
  const isRunning = useAuiState((s) => s.thread.isRunning);

  return (
    <ComposerPrimitive.Root
      className="group/composer mx-auto mb-3 w-full max-w-3xl"
      data-empty={isEmpty}
      data-running={isRunning}
    >
      <div className="overflow-hidden rounded-[10px] bg-white shadow-sm ring-1 ring-black/[0.06] ring-inset transition-shadow focus-within:ring-black/[0.12]">
        <AuiIf condition={(s) => s.composer.attachments.length > 0}>
          <div className="flex flex-row flex-wrap gap-2 px-4 pt-3">
            <ComposerPrimitive.Attachments
              components={{ Attachment: AlleafAttachment }}
            />
          </div>
        </AuiIf>

        <div className="flex min-w-0 items-center gap-1.5 px-2 py-1.5">
          <ComposerPrimitive.AddAttachment className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black/50 transition-colors hover:bg-black/5 hover:text-black/70">
            <Paperclip width={18} height={18} />
          </ComposerPrimitive.AddAttachment>

          <ComposerPrimitive.Input
            placeholder="How are you feeling?"
            minRows={1}
            className="h-6 max-h-[400px] min-w-0 flex-1 resize-none self-center bg-transparent text-[15px] leading-6 text-black/85 outline-none placeholder:text-black/35"
          />

          <div className="flex shrink-0 items-center gap-1">
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-black/75 text-white">
              <button
                type="button"
                className="absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out group-data-[empty=false]/composer:scale-0 group-data-[running=true]/composer:scale-0 group-data-[empty=false]/composer:opacity-0 group-data-[running=true]/composer:opacity-0"
                aria-label="Voice mode"
              >
                <Mic width={18} height={18} />
              </button>

              <ComposerPrimitive.Send className="absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out group-data-[empty=true]/composer:scale-0 group-data-[running=true]/composer:scale-0 group-data-[empty=true]/composer:opacity-0 group-data-[running=true]/composer:opacity-0">
                <ArrowUpIcon width={18} height={18} />
              </ComposerPrimitive.Send>

              <ComposerPrimitive.Cancel className="absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out group-data-[running=false]/composer:scale-0 group-data-[running=false]/composer:opacity-0">
                <Square width={14} height={14} fill="currentColor" />
              </ComposerPrimitive.Cancel>
            </div>
          </div>
        </div>
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
          <div
            className="relative max-w-[80%] rounded-[22px] bg-[#d9e5cc] text-[15px] leading-relaxed text-black/90 shadow-sm"
            style={{ padding: "5px 10px" }}
          >
            <MessagePrimitive.Parts components={{ Text: UserText }} />
          </div>
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

const useAttachmentSrc = () => {
  const { file, src } = useAuiState(
    useShallow((s) => {
      if (s.attachment.type !== "image") return {};
      if (s.attachment.file) return { file: s.attachment.file };
      const src = s.attachment.content?.filter((c) => c.type === "image")[0]
        ?.image;
      if (!src) return {};
      return { src };
    }),
  );

  const [fileSrc, setFileSrc] = useState(undefined);

  useEffect(() => {
    if (!file) {
      setFileSrc(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setFileSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return fileSrc ?? src;
};

const AlleafAttachment = () => {
  const src = useAttachmentSrc();

  return (
    <AttachmentPrimitive.Root className="group/attachment relative">
      <div className="flex h-12 items-center gap-2 overflow-hidden rounded-xl border border-black/[0.08] bg-black/[0.03] p-0.5 transition-colors hover:border-black/[0.15]">
        <AuiIf condition={(s) => s.attachment.type === "image"}>
          {src ? (
            <img
              className="h-full w-12 rounded-[9px] object-cover"
              alt="Attachment"
              src={src}
            />
          ) : (
            <div className="flex h-full w-12 items-center justify-center rounded-[9px] bg-black/5 text-black/40">
              <AttachmentPrimitive.unstable_Thumb className="text-xs" />
            </div>
          )}
        </AuiIf>
        <AuiIf condition={(s) => s.attachment.type !== "image"}>
          <div className="flex h-full w-12 items-center justify-center rounded-[9px] bg-black/5 text-black/40">
            <AttachmentPrimitive.unstable_Thumb className="text-xs" />
          </div>
        </AuiIf>
      </div>
      <AttachmentPrimitive.Remove className="absolute -top-1.5 -right-1.5 flex h-6 w-6 scale-50 items-center justify-center rounded-full border border-black/[0.08] bg-white text-black/50 opacity-0 shadow-sm transition-all hover:bg-gray-50 hover:text-black group-hover/attachment:scale-100 group-hover/attachment:opacity-100">
        <XIcon width={14} height={14} />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};
