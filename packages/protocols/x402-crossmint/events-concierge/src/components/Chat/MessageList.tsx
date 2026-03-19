import { useEffect, useRef } from "react";
import { Message } from "./Message";
import type { ChatMessage } from "../../types";

interface MessageListProps {
  messages: ChatMessage[];
  onAction?: (action: string) => void;
  onPrefill?: (text: string) => void;
}

export function MessageList({ messages, onAction, onPrefill }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.length === 0 && (
        <div style={{
          textAlign: 'center',
          color: '#94a3b8',
          marginTop: '2rem',
          fontSize: '0.875rem'
        }}>
          No messages yet. Say hello to get started!
        </div>
      )}

      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          onAction={onAction}
          onPrefill={onPrefill}
        />
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
