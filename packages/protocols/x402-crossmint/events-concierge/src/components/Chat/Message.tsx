import React from 'react';
import type { ChatMessage } from "../../types";

interface MessageProps {
  message: ChatMessage;
  onAction?: (action: string) => void;
  onPrefill?: (text: string) => void;
}

export function Message({ message, onAction, onPrefill }: MessageProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className={`message ${message.sender}`}>
      <div className="message-bubble">
        {message.text}
      </div>

      {message.inlineComponent && (
        <div className="message-inline-component">
          {/* Inline components will be rendered here */}
          {message.inlineComponent.type === 'wallet-card' && (
            <WalletCard data={message.inlineComponent.data} />
          )}
          {message.inlineComponent.type === 'tools-list' && (
            <ToolsList data={message.inlineComponent.data} onAction={onAction} />
          )}
          {message.inlineComponent.type === 'events-list' && (
            <EventsList data={message.inlineComponent.data} onPrefill={onPrefill} />
          )}
          {message.inlineComponent.type === 'rsvp-confirmation' && (
            <RsvpConfirmation data={message.inlineComponent.data} />
          )}
          {message.inlineComponent.type === 'tx-link' && (
            <TxLink data={message.inlineComponent.data} />
          )}
        </div>
      )}

      {message.actions && message.actions.length > 0 && (
        <div className="message-actions">
          {message.actions.map((action, idx) => (
            <button
              key={idx}
              className={`message-action-btn ${action.variant}`}
              onClick={() => onAction?.(action.action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="message-timestamp">
        {formatTime(message.timestamp)}
      </div>
    </div>
  );
}

// Inline component: Wallet Card
function WalletCard({ data }: { data: any }) {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Wallet Information
      </div>
      <div style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div>
          <strong>Guest (Payer):</strong>
          <div className="mono" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {data.guestAddress}
            {data.deployed && <span style={{
              marginLeft: '0.5rem',
              background: '#dcfce7',
              color: '#166534',
              padding: '0.125rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600
            }}>DEPLOYED</span>}
            {!data.deployed && <span style={{
              marginLeft: '0.5rem',
              background: '#fef3c7',
              color: '#92400e',
              padding: '0.125rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600
            }}>PRE-DEPLOYED</span>}
          </div>
        </div>
        <div>
          <strong>Host (Recipient):</strong>
          <div className="mono" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {data.hostAddress}
          </div>
        </div>
        <div>
          <strong>Network:</strong> {data.network}
        </div>
      </div>
    </div>
  );
}

// Inline component: Tools List
function ToolsList({ data, onAction }: { data: any; onAction?: (action: string) => void }) {
  const displayTitleFor = (name: string) => {
    // if (name === 'createEvent') return 'Create Event';
    if (name === 'getAllEvents') return 'Get all events';
    if (name === 'rsvpToEvent') return 'RSVP to event';
    return name;
  };

  const clickActionFor = (name: string) => {
    // if (name === 'createEvent') return 'create event';
    if (name === 'getAllEvents') return 'list events';
    if (name === 'rsvpToEvent') return 'rsvp to event';
    return name;
  };

  const PricePill = ({ isPaid, price }: { isPaid: boolean; price: number | null }) => {
    if (!isPaid) {
      return (
        <span
          style={{
            padding: '0.5rem 0.85rem',
            background: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '999px',
            color: '#0F172A',
            fontWeight: 700,
            fontSize: '0.9375rem',
            lineHeight: 1
          }}
        >
          Free
        </span>
      );
    }
    const amount = typeof price === 'number' ? `$${price.toFixed(2)}` : '$0.00';
    return (
      <span
        style={{
          padding: '0.5rem 0.85rem',
          background: 'white',
          border: '1px solid #1A73E8',
          borderRadius: '999px',
          color: '#1A73E8',
          fontWeight: 700,
          fontSize: '0.9375rem',
          lineHeight: 1
        }}
      >
        {amount}
      </span>
    );
  };

  return (
    <div style={{ padding: '0.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {(Array.isArray(data.tools) ? data.tools.filter((t: any) => t?.name !== 'createEvent') : []).map((tool: any, idx: number) => {
          const title = displayTitleFor(tool.name);
          const subtitle = tool.description as string;
          return (
            <div
              key={idx}
              onClick={() => onAction?.(clickActionFor(tool.name))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onAction?.(clickActionFor(tool.name));
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '1rem',
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 18px rgba(2,6,23,0.08)',
                cursor: 'pointer'
              }}
            >
              <img src="/calendar.svg" alt="tool" width={40} height={40} style={{ flexShrink: 0 }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>{title}</div>
                <div style={{ color: '#64748B', fontSize: '1rem' }}>{subtitle}</div>
              </div>

              <PricePill isPaid={!!tool.isPaid} price={tool.price ?? null} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Inline component: Events List
function EventsList({ data, onPrefill }: { data: any; onPrefill?: (text: string) => void }) {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data.events?.map((event: any, idx: number) => {
          const dateStr = new Date(event.date).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });
          const isFree = Number(event.price) === 0;
          const priceText = isFree ? 'Free' : `$${Number(event.price).toFixed(2)}`;
          const capacityText = event.capacity === 0
            ? 'Unlimited capacity'
            : `${Math.max(event.capacity - event.rsvpCount, 0)} spots left`;

          return (
            <div
              key={idx}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 6px 18px rgba(2,6,23,0.06)',
                cursor: 'pointer'
              }}
              onClick={() => onPrefill?.(`rsvp to event ${event.id}`)}
              title="Click to prefill RSVP command"
            >
              {/* Date & time */}
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{dateStr}</div>

              {/* Title */}
              <div style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {event.title}
              </div>

              {/* Meta row: capacity, RSVPs, price */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '14px' }}>
                  <img src="/users.svg" width={16} height={16} alt="capacity" />
                  <span>{capacityText}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '14px' }}>
                  <img src="/users.svg" width={16} height={16} alt="rsvps" />
                  <span>{event.rsvpCount} RSVPs</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginLeft: 'auto' }}>
                  <img src="/dollar.svg" width={15} height={15} alt="price" />
                  <span style={{ color: '#1A73E8' }}>{priceText}</span>
                </div>
              </div>

              {/* Optional: copyable ID in tiny footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => navigator.clipboard.writeText(event.id)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                  title="Click to copy full event ID"
                >
                  ID: {event.id}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Inline component: RSVP Confirmation
function RsvpConfirmation({ data }: { data: any }) {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{
        background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
        border: '2px solid #22c55e',
        borderRadius: '8px',
        padding: '1.25rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
        <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>
          RSVP Confirmed!
        </div>
        <div style={{ fontSize: '0.875rem', color: '#15803d', marginBottom: '1rem' }}>
          You're registered for "{data.eventTitle}"
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          fontSize: '0.8125rem',
          color: '#166534'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Total RSVPs</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{data.rsvpCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline component: Transaction Link
function TxLink({ data }: { data: any }) {
  const href: string = data?.href;
  const txHash: string = data?.txHash;
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Transaction
      </div>
      <div className="mono" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
        {txHash}
      </div>
      {href && (
        <div style={{ marginTop: '0.5rem' }}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', textDecoration: 'none' }}
          >
            View on Explorer ↗
          </a>
        </div>
      )}
    </div>
  );
}
