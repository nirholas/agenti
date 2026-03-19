import React, { useState } from 'react';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (eventData: {
    title: string;
    description: string;
    date: string;
    capacity: string;
    price: string;
  }) => Promise<void>;
  isCreating: boolean;
}

export function CreateEventModal({ isOpen, onClose, onCreate, isCreating }: CreateEventModalProps) {
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventCapacity, setEventCapacity] = useState("0");
  const [eventPrice, setEventPrice] = useState("0.05");

  if (!isOpen) return null;

  const handleSubmit = async () => {
    await onCreate({
      title: eventTitle,
      description: eventDescription,
      date: eventDate,
      capacity: eventCapacity,
      price: eventPrice
    });

    // Reset form
    setEventTitle("");
    setEventDescription("");
    setEventDate("");
    setEventCapacity("0");
    setEventPrice("0.05");
  };

  const isFormValid = eventTitle && eventDescription && eventDate && eventPrice;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
            Create New Event
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.25rem',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
              Event Title *
            </span>
            <input
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="e.g., AI Workshop 2025"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}
            />
          </label>

          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
              Description *
            </span>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Describe your event..."
              rows={3}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                Event Date & Time *
              </span>
              <input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem'
                }}
              />
            </label>

            <label>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                Max Capacity
              </span>
              <input
                type="number"
                value={eventCapacity}
                onChange={(e) => setEventCapacity(e.target.value)}
                min="0"
                placeholder="0 = unlimited"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.875rem'
                }}
              />
            </label>
          </div>

          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
              RSVP Price (USD) *
            </span>
            <input
              type="text"
              value={eventPrice}
              onChange={(e) => setEventPrice(e.target.value)}
              placeholder="0.05"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontFamily: 'monospace'
              }}
            />
          </label>
        </div>

        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isCreating}
            style={{
              padding: '0.75rem 1.5rem',
              background: !isFormValid || isCreating ? '#cbd5e1' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: !isFormValid || isCreating ? 'not-allowed' : 'pointer'
            }}
          >
            {isCreating ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

