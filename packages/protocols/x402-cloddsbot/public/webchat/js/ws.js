/**
 * WebSocket client with auto-reconnect and clean teardown
 */
export class WSClient {
  constructor() {
    this.ws = null;
    this.handlers = { message: [], open: [], close: [], error: [] };
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 5000;
    this.currentDelay = this.reconnectDelay;
    this.shouldReconnect = true;
    this.sessionId = null;
    this.authenticated = false;
    this._reconnectTimer = null;
    this._pingTimer = null;
  }

  connect(token, userId, sessionId) {
    this.shouldReconnect = true;
    this.sessionId = sessionId || null;
    this._token = token;
    this._userId = userId;
    this._teardown();
    this._doConnect();
  }

  _teardown() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.authenticated = false;
  }

  _doConnect() {
    // Clean up any leftover socket
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Never include sessionId in URL — avoids server-side eviction loops.
    // We send a 'switch' message after auth to set the desired session.
    const url = `${proto}//${location.host}/chat`;

    const ws = new WebSocket(url);
    this.ws = ws;
    this.authenticated = false;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      ws.send(JSON.stringify({
        type: 'auth',
        token: this._token || '',
        userId: this._userId || 'web-' + Date.now(),
        _wsVersion: 4,
      }));
      this._emit('open');
    };

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'authenticated') {
          this.authenticated = true;
          this.currentDelay = this.reconnectDelay;
          clearInterval(this._pingTimer);
          this._pingTimer = setInterval(() => {
            if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            } else {
              clearInterval(this._pingTimer);
              this._pingTimer = null;
            }
          }, 25000);
          // After auth, switch to desired session (if any)
          if (this.sessionId && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'switch', sessionId: this.sessionId }));
          }
        }
        if (msg.type === 'pong') return;
        this._emit('message', msg);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.authenticated = false;
      clearInterval(this._pingTimer);
      this._pingTimer = null;
      this._emit('close');
      if (this.shouldReconnect) {
        this._reconnectTimer = setTimeout(() => this._doConnect(), this.currentDelay);
        this.currentDelay = Math.min(this.currentDelay * 1.5, this.maxReconnectDelay);
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this._emit('error');
    };
  }

  send(text, attachments) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg = { type: 'message', text };
      if (attachments?.length) msg.attachments = attachments;
      this.ws.send(JSON.stringify(msg));
    }
  }

  switchSession(sessionId) {
    this.sessionId = sessionId;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'switch', sessionId }));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this._teardown();
  }

  on(event, fn) {
    if (this.handlers[event]) this.handlers[event].push(fn);
  }

  off(event, fn) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(f => f !== fn);
    }
  }

  _emit(event, data) {
    for (const fn of (this.handlers[event] || [])) {
      try { fn(data); } catch { /* ignore */ }
    }
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }
}
