package x402

import (
	"math/big"
	"sync"
)

// PaymentRecorder records payment events for testing
type PaymentRecorder struct {
	mu     sync.RWMutex
	events []PaymentEvent
}

// NewPaymentRecorder creates a new payment recorder
func NewPaymentRecorder() *PaymentRecorder {
	return &PaymentRecorder{
		events: make([]PaymentEvent, 0),
	}
}

// Record records a payment event
func (r *PaymentRecorder) Record(event PaymentEvent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
}

// PaymentCount returns the number of recorded payments
func (r *PaymentRecorder) PaymentCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.events)
}

// LastPayment returns the most recent payment event (returns a copy to prevent mutations)
func (r *PaymentRecorder) LastPayment() *PaymentEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if len(r.events) == 0 {
		return nil
	}

	// Return a deep copy to prevent mutations
	last := r.events[len(r.events)-1]
	eventCopy := last
	if last.Amount != nil {
		eventCopy.Amount = new(big.Int).Set(last.Amount)
	}
	return &eventCopy
}

// GetEvents returns all recorded events (returns deep copies to prevent mutations)
func (r *PaymentRecorder) GetEvents() []PaymentEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()

	events := make([]PaymentEvent, len(r.events))
	for i, event := range r.events {
		events[i] = event
		// Deep copy the Amount field if it exists
		if event.Amount != nil {
			events[i].Amount = new(big.Int).Set(event.Amount)
		}
	}
	return events
}

// Clear clears all recorded events
func (r *PaymentRecorder) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = make([]PaymentEvent, 0)
}

// SuccessfulPayments returns only successful payment events (returns deep copies)
func (r *PaymentRecorder) SuccessfulPayments() []PaymentEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var successful []PaymentEvent
	for _, event := range r.events {
		if event.Type == PaymentEventSuccess {
			eventCopy := event
			// Deep copy the Amount field if it exists
			if event.Amount != nil {
				eventCopy.Amount = new(big.Int).Set(event.Amount)
			}
			successful = append(successful, eventCopy)
		}
	}
	return successful
}

// FailedPayments returns only failed payment events (returns deep copies)
func (r *PaymentRecorder) FailedPayments() []PaymentEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var failed []PaymentEvent
	for _, event := range r.events {
		if event.Type == PaymentEventFailure {
			eventCopy := event
			// Deep copy the Amount field if it exists
			if event.Amount != nil {
				eventCopy.Amount = new(big.Int).Set(event.Amount)
			}
			failed = append(failed, eventCopy)
		}
	}
	return failed
}

// TotalAmount returns the total amount of all successful payments
func (r *PaymentRecorder) TotalAmount() string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	total := big.NewInt(0)
	for _, event := range r.events {
		if event.Type == PaymentEventSuccess && event.Amount != nil {
			total.Add(total, event.Amount)
		}
	}
	return total.String()
}
