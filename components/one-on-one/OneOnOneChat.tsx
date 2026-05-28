"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Send, Loader2, Sparkles, RefreshCw } from "lucide-react"

interface ChatMessage {
  id: string
  content: string
  senderId: string
  createdAt: string
  sender: {
    id: string
    profile: { firstName: string | null; lastName: string | null; photoUrl: string | null } | null
  }
}

interface OneOnOneChatProps {
  matchId: string
  currentUserId: string
  suggestedPrompt?: string | null
  peerFirstName?: string | null
}

function Avatar({ name, photoUrl, size = "sm" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"

  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <div className={`${sz} flex-shrink-0 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center font-semibold text-brand-primary`}>
      {initials}
    </div>
  )
}

export function OneOnOneChat({ matchId, currentUserId, suggestedPrompt, peerFirstName }: OneOnOneChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [buzzSuggestion, setBuzzSuggestion] = useState<string | null>(null)
  const [loadingBuzz, setLoadingBuzz] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchMessages = useCallback(async (cursor?: string) => {
    try {
      const url = `/api/one-on-one/messages?matchId=${matchId}${cursor ? `&cursor=${cursor}` : ""}`
      const res = await fetch(url)
      const data = await res.json()
      if (cursor) {
        setMessages((prev) => [...(data.messages as ChatMessage[]), ...prev])
      } else {
        setMessages(data.messages as ChatMessage[])
      }
      setHasMore(data.hasMore)
      setNextCursor(data.nextCursor)
    } catch (err) {
      console.error("Failed to fetch messages", err)
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    fetchMessages()
    // Poll every 8 seconds for new messages (replace with SSE/websocket in V2)
    const interval = setInterval(() => fetchMessages(), 8000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, loading])

  const sendMessage = async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || sending) return

    setSending(true)
    setInput("")
    setBuzzSuggestion(null)

    try {
      const res = await fetch("/api/one-on-one/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, content: text }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages((prev) => [...prev, data.message as ChatMessage])
      }
    } catch (err) {
      console.error("Failed to send", err)
    } finally {
      setSending(false)
    }
  }

  const getBuzzSuggestion = async () => {
    setLoadingBuzz(true)
    try {
      const context = messages
        .slice(-6)
        .map((m) => `${m.senderId === currentUserId ? "Me" : peerFirstName ?? "Peer"}: ${m.content}`)
        .join("\n")

      const res = await fetch("/api/buzz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "suggest-reply",
          context,
          peerName: peerFirstName ?? "your match",
        }),
      })
      const data = await res.json()
      setBuzzSuggestion(data.suggestion ?? data.reply ?? null)
    } catch {
      // Non-fatal
    } finally {
      setLoadingBuzz(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="sl-panel flex flex-col overflow-hidden" style={{ height: "520px" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold text-brand-text">
            {peerFirstName ? `Chat with ${peerFirstName}` : "1-on-1 Chat"}
          </span>
        </div>
        <button
          onClick={getBuzzSuggestion}
          disabled={loadingBuzz || messages.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-all hover:bg-brand-primary/20 disabled:opacity-40"
        >
          {loadingBuzz ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          BUZZ reply
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Load more */}
        {hasMore && (
          <button
            onClick={() => fetchMessages(nextCursor ?? undefined)}
            className="w-full text-center text-xs text-brand-text-subtle hover:text-brand-text py-2"
          >
            Load earlier messages
          </button>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand-text-subtle" />
          </div>
        ) : messages.length === 0 ? (
          /* Empty state — show suggested prompt */
          <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
            <p className="text-sm text-brand-text-subtle">No messages yet. Be the one to start.</p>
            {suggestedPrompt && (
              <button
                onClick={() => sendMessage(suggestedPrompt)}
                className="max-w-sm rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-left text-sm text-brand-text transition-all hover:bg-brand-primary/15"
              >
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> BUZZ suggests
                </p>
                <p className="text-brand-text-muted leading-relaxed">{suggestedPrompt}</p>
              </button>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId
            const name = `${msg.sender.profile?.firstName ?? ""} ${msg.sender.profile?.lastName ?? ""}`.trim() || "Unknown"
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                <Avatar name={name} photoUrl={msg.sender.profile?.photoUrl} />
                <div className={`max-w-[75%] space-y-1 ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isMe
                        ? "bg-brand-primary text-white rounded-tr-sm"
                        : "bg-brand-surface text-brand-text border border-brand-border rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-brand-text-subtle px-1">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* BUZZ suggestion banner */}
      {buzzSuggestion && (
        <div className="border-t border-brand-primary/20 bg-brand-primary/5 px-4 py-3 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> BUZZ suggestion
          </p>
          <div className="flex items-start gap-2">
            <p className="flex-1 text-xs text-brand-text-muted leading-relaxed">{buzzSuggestion}</p>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => { setInput(buzzSuggestion); setBuzzSuggestion(null); textareaRef.current?.focus() }}
                className="rounded-lg bg-brand-primary/10 border border-brand-primary/30 px-2.5 py-1 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20"
              >
                Use
              </button>
              <button
                onClick={() => setBuzzSuggestion(null)}
                className="rounded-lg px-2 py-1 text-xs text-brand-text-subtle hover:text-brand-text"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-brand-border px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${peerFirstName ?? "your match"}…`}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-brand-border bg-brand-surface px-4 py-2.5 text-sm text-brand-text placeholder-brand-text-subtle outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/10 transition-all"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = "auto"
              el.style.height = Math.min(el.scrollHeight, 120) + "px"
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-brand-text-subtle">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
