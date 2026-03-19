import React, { useState, useCallback, useEffect } from "react";
import { CrossmintProvider, CrossmintAuthProvider, useAuth } from "@crossmint/client-sdk-react-ui";
import { CrossmintWallets, createCrossmint } from "@crossmint/wallets-sdk";
import { CreateEventModal } from "../components/CreateEventModal";
import "../styles.css";
import "../chat.css";

// Using Vite's import.meta.env (typed as any to avoid TS ambient issues in this file)
const VITE_ENV: any = (import.meta as any).env || {};
const CLIENT_KEY = VITE_ENV.VITE_CROSSMINT_CLIENT_KEY || VITE_ENV.VITE_CROSSMINT_API_KEY || "";

function MyMcpInner() {
  const { login, logout, user, jwt } = useAuth();

  // Minimal landing page when user is not authenticated
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexDirection: 'column' }}>

        {/* Center card */}
        <div style={{ background: 'white', width: '100%', maxWidth: '520px', margin: '0 1rem', borderRadius: '16px', boxShadow: '0 20px 40px rgba(2, 6, 23, 0.08)', padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <img src="/calendar.svg" alt="Calendar" width={88} height={88} style={{ display: 'block' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>Event Host Dashboard</h1>

          <div style={{ marginTop: '22px' }}>
            <button
              onClick={login}
              style={{
                background: '#2563eb',
                color: 'white',
                fontWeight: 700,
                border: 'none',
                borderRadius: '999px',
                padding: '12px 24px',
                fontSize: '16px',
                cursor: 'pointer',
                width: '160px',
                boxShadow: '0 6px 14px rgba(37, 99, 235, 0.3)'
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#1d4ed8')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#2563eb')}
            >
              Sign in
            </button>
          </div>
        </div>

        {/* Brand below card */}
        <div style={{ marginTop: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Powered by</span>
          <img src="/crossmint.png" alt="Crossmint" style={{ height: '14px', display: 'inline-block' }} />
        </div>
      </div>
    );
  }

  // Wallet & MCP state
  const [wallet, setWallet] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [currentOtp, setCurrentOtp] = useState("");
  const [otpHandlers, setOtpHandlers] = useState<{ sendEmailWithOtp?: () => Promise<void>; verifyOtp?: (otp: string) => Promise<void>; reject?: () => void; }>({});
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Events state
  const [events, setEvents] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState("0.00");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Logs
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));

  const WORKER_BASE = (VITE_ENV.VITE_WORKER_BASE_URL as string) || "https://events-concierge.angela-temp.workers.dev";

  const initializeWallet = useCallback(async () => {
    if (!CLIENT_KEY.startsWith("ck_")) {
      addLog("❌ VITE_CROSSMINT_CLIENT_KEY must be a client key (ck_)");
      return;
    }
    if (!user?.email) {
      addLog("❌ Please login with Crossmint first");
      return;
    }
    if (!jwt) {
      addLog("🔐 Login required to obtain JWT for Email OTP signer");
      return;
    }
    const ownerEmail = user.email;

    try {
      setIsProcessing(true);
      addLog("🚀 Initializing Crossmint wallet (Email OTP signer)...");

      const crossmint = createCrossmint({
        apiKey: CLIENT_KEY,
        experimental_customAuth: { jwt, email: ownerEmail }
      });
      const wallets = CrossmintWallets.from(crossmint);

      const w = await wallets.getOrCreateWallet({
        chain: "base-sepolia" as any,
        owner: `email:${ownerEmail}`,
        signer: {
          type: "email" as const,
          email: ownerEmail,
          onAuthRequired: async (needsAuth, sendEmailWithOtp, verifyOtp, reject) => {
            addLog(`🔐 Email OTP auth ${needsAuth ? "required" : "not required"}`);
            if (!needsAuth) {
              setOtpRequired(false);
              setOtpSent(false);
              setOtpHandlers({});
              return;
            }
            setOtpRequired(true);
            setOtpSent(false);
            setOtpHandlers({ sendEmailWithOtp, verifyOtp, reject });
          }
        }
      });

      setWallet(w);
      addLog(`✅ Wallet ready: ${w.address}`);
    } catch (e: any) {
      addLog(`❌ Wallet init failed: ${e?.message || String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [CLIENT_KEY, user?.email, jwt]);

  const sendOtp = useCallback(async () => {
    try {
      await otpHandlers.sendEmailWithOtp?.();
      setOtpSent(true);
      addLog("📧 OTP sent. Check your email");
    } catch (e: any) {
      addLog(`❌ Send OTP failed: ${e?.message || String(e)}`);
    }
  }, [otpHandlers.sendEmailWithOtp]);

  const submitOtp = useCallback(async () => {
    try {
      await otpHandlers.verifyOtp?.(currentOtp);
      setOtpRequired(false);
      setOtpSent(false);
      setOtpHandlers({});
      setCurrentOtp("");
      addLog("✅ OTP verified");
    } catch (e: any) {
      addLog(`❌ Verify OTP failed: ${e?.message || String(e)}`);
    }
  }, [otpHandlers.verifyOtp, currentOtp]);

  const createMcp = useCallback(async () => {
    if (!user?.email || !wallet) return;
    const res = await fetch(`${WORKER_BASE}/api/users/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: `email:${user.email}`, walletAddress: wallet.address })
    });
    if (!res.ok) {
      addLog(`❌ Create MCP failed: ${await res.text()}`);
      return;
    }
    const data = (await res.json()) as { mcpUrl?: string };
    setMcpUrl(data.mcpUrl || null);
    addLog(`✅ MCP ready at ${data.mcpUrl}`);
  }, [user?.email, wallet]);

  const createEvent = useCallback(async (eventData: {
    title: string;
    description: string;
    date: string;
    capacity: string;
    price: string;
  }) => {
    if (!user?.email || !wallet) {
      addLog("❌ Please login and initialize wallet first");
      return;
    }

    try {
      setIsCreatingEvent(true);
      addLog(`🎉 Creating event: ${eventData.title}...`);

      const dateTimestamp = new Date(eventData.date).getTime();

      const res = await fetch(`${WORKER_BASE}/api/users/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: `email:${user.email}`,
          walletAddress: wallet.address,
          title: eventData.title,
          description: eventData.description,
          date: dateTimestamp,
          capacity: parseInt(eventData.capacity) || 0,
          price: eventData.price
        })
      });

      if (!res.ok) {
        const error = (await res.json()) as { error?: string };
        addLog(`❌ Failed to create event: ${error?.error || "Unknown error"}`);
        return;
      }

      const data = (await res.json()) as { eventId?: string };
      addLog(`✅ Event created successfully! ID: ${data.eventId}`);

      // Close modal and refresh events
      setShowCreateModal(false);
      await fetchEvents();
    } catch (error) {
      addLog(`❌ Error creating event: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCreatingEvent(false);
    }
  }, [user?.email, wallet]);

  const fetchEvents = useCallback(async () => {
    if (!user?.email || !wallet) return;

    try {
      setLoadingEvents(true);
      const res = await fetch(
        `${WORKER_BASE}/api/users/events?userId=email:${encodeURIComponent(user.email)}&walletAddress=${wallet.address}`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );

      if (!res.ok) {
        addLog(`❌ Failed to fetch events`);
        return;
      }

      const data = (await res.json()) as { events?: any[]; totalRevenue?: string };
      setEvents(data.events || []);
      setTotalRevenue(data.totalRevenue || "0.00");
      addLog(`✅ Loaded ${data.events?.length || 0} events`);
    } catch (error) {
      addLog(`❌ Error fetching events: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingEvents(false);
    }
  }, [user?.email, wallet]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addLog(`📋 Copied ${label} to clipboard`);
  };

  // Auto-initialize wallet when user logs in
  useEffect(() => {
    if (user?.email && jwt && !wallet && !isProcessing) {
      addLog("🔄 User logged in, auto-initializing wallet...");
      initializeWallet();
    }
  }, [user?.email, jwt, wallet, isProcessing, initializeWallet]);

  // Auto-fetch MCP URL when wallet is ready
  useEffect(() => {
    if (wallet && user?.email && !mcpUrl) {
      addLog("🔄 Wallet ready, checking for existing MCP...");
      createMcp();
    }
  }, [wallet, user?.email, mcpUrl, createMcp]);

  // Fetch events when MCP is loaded
  useEffect(() => {
    if (mcpUrl && wallet && user?.email) {
      fetchEvents();
    }
  }, [mcpUrl, wallet, user?.email, fetchEvents]);

  // Single-page dashboard (no Setup tab) – nothing to switch

  const totalRsvps = events.reduce((sum, e) => sum + (e.rsvpCount || 0), 0);
  const setupComplete = !!(user && wallet && mcpUrl);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Header (no tabs) */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          padding: '1.25rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: 600 }}>
              Event Host Dashboard
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem'
                }}>
                  {(user.email || '?')[0]?.toUpperCase()}
                </div>
              <span style={{
                  color: '#0f172a',
                  fontSize: '0.875rem',
                fontWeight: 600
              }}>
                {user.email}
              </span>
          </div>
            )}
            <a
              href="/"
              style={{
                padding: '0.5rem 0.9rem',
                background: 'white',
                color: '#3b82f6',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: '1px solid #e2e8f0'
              }}
            >
              Back to App
            </a>
            {user && (
              <button
                onClick={logout}
                style={{
                  padding: '0.5rem 0.9rem',
                  background: 'white',
                  color: '#ef4444',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {!CLIENT_KEY || !CLIENT_KEY.startsWith("ck_") ? (
        <div style={{
          padding: '1.25rem 2rem',
          background: '#fffbeb',
          border: '1px solid #fbbf24',
          margin: '1rem 2rem',
          borderRadius: '8px'
        }}>
          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.5rem', fontSize: '0.9375rem' }}>
            Configuration Required
          </div>
          <div style={{ color: '#78350f', fontSize: '0.875rem', lineHeight: '1.5' }}>
            Set a client API key (ck_) in <code style={{ background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '4px', fontFamily: 'monospace' }}>.dev.vars</code> as <code style={{ background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '4px', fontFamily: 'monospace' }}>VITE_CROSSMINT_CLIENT_KEY=ck_staging_...</code> and restart.
          </div>
        </div>
      ) : null}

      {/* Main Content (Dashboard only) */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Dashboard */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Stats Header (Sticky) */}
              <div style={{
                background: 'white',
                borderBottom: '1px solid #e2e8f0',
                padding: '1.5rem 2rem',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  flex: 1,
                  minWidth: '260px',
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 24px rgba(2,6,23,0.04)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Earnings</div>
                    <div style={{ fontSize: '2.0rem', fontWeight: 700, color: '#0f172a' }}>${totalRevenue}</div>
                  </div>
                  <img src="/archive.svg" alt="Earnings" width={44} height={44} style={{ display: 'block' }} />
                </div>

                <div style={{
                  flex: 1,
                  minWidth: '260px',
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 24px rgba(2,6,23,0.04)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Events created</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>{events.length}</div>
                  </div>
                  <img src="/calendar.svg" alt="Events" width={44} height={44} style={{ display: 'block' }} />
                </div>

                <div style={{
                  flex: 1,
                  minWidth: '260px',
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 24px rgba(2,6,23,0.04)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Total RSVPs</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>{totalRsvps}</div>
                  </div>
                  <img src="/save.svg" alt="RSVPs" width={44} height={44} style={{ display: 'block' }} />
                </div>
              </div>

              {/* Events Grid Section */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '2rem',
                background: '#f8fafc'
              }}>
                {/* Connect MCP Panel */}
                <div style={{
                  marginBottom: '1.5rem',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', minWidth: '110px' }}>Connect MCP</div>
                  <input
                    readOnly
                    value={mcpUrl || 'Generating your personal MCP URL...'}
                    style={{
                      flex: 1,
                      padding: '0.625rem 0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      color: '#0f172a',
                      background: '#f8fafc'
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!mcpUrl) return;
                      try {
                        await copyToClipboard(mcpUrl, 'MCP URL');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1200);
                      } catch {}
                    }}
                    disabled={!mcpUrl}
                    style={{
                      padding: '0.5rem 0.9rem',
                      background: !mcpUrl ? '#f1f5f9' : copied ? '#22c55e' : '#e2e8f0',
                      color: !mcpUrl ? '#94a3b8' : copied ? 'white' : '#0f172a',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: mcpUrl ? 'pointer' : 'not-allowed',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
                    Your ongoing events
                  </h2>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
                  >
                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
                    Create new event
                  </button>
                </div>

                {loadingEvents ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    <div className="spinner" style={{ width: '2rem', height: '2rem', margin: '0 auto 1rem' }}></div>
                    Loading events...
                  </div>
                ) : events.length === 0 ? (
                  <div style={{
                    background: 'white',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '3rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>
                      No Events Yet
                    </h3>
                    <p style={{ margin: '0 0 1.5rem 0', color: '#64748b', fontSize: '0.875rem' }}>
                      Create your first event to start earning from RSVPs
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }}
                    >
                      Create Your First Event
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '1rem'
                  }}>
                    {events.map((event) => {
                      const d = new Date(event.date);
                      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
                      const day = d.toLocaleDateString('en-US', { day: '2-digit' });
                      const full = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const capacityText = event.capacity === 0 ? 'Unlimited capacity' : `${event.capacity} max`;
                      const priceText = `$${Number(event.price).toFixed(2)}`;

                      return (
                        <div
                          key={event.id}
                          style={{
                            background: 'white',
                            borderRadius: '16px',
                            padding: '16px',
                            boxShadow: '0 6px 18px rgba(2,6,23,0.06)',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 20px rgba(0,0,0,0.12)';
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                          }}
                          onMouseOut={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(2,6,23,0.06)';
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                          }}
                        >
                          <div style={{ display: 'flex', gap: '12px' }}>
                            {/* Left date pill */}
                            <div style={{ width: '44px', textAlign: 'center', color: '#64748b' }}>
                              <div style={{ fontSize: '12px' }}>{weekday}</div>
                              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{day}</div>
                            </div>

                            {/* Right content */}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{full}</div>
                              <div style={{
                                fontSize: '18px',
                                fontWeight: 700,
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                marginTop: '2px'
                              }}>
                                {event.title}
                              </div>

                              {/* Info rows */}
                              <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <img src="/users.svg" width={16} height={16} alt="capacity" />
                                  <span style={{ color: '#334155', fontSize: '14px' }}>{capacityText}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <img src="/clock.svg" width={16} height={16} alt="time" />
                                  <span style={{ color: '#334155', fontSize: '14px' }}>{time}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <img src="/dollar.svg" width={15} height={15} alt="price" />
                                  <span style={{ color: '#1A73E8', fontSize: '14px' }}>{priceText}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Divider */}
                          <div style={{ height: '1px', background: '#e5e7eb', margin: '12px 0 8px' }} />

                          {/* ID row (copyable) */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>ID</span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                transition: 'all 0.2s',
                                maxWidth: '220px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() => {
                                navigator.clipboard.writeText(event.id);
                                const span = document.querySelector(`[data-host-event-id="${event.id}"]`) as HTMLElement;
                                if (span) {
                                  const originalText = span.textContent;
                                  span.textContent = 'Copied!';
                                  span.style.color = '#10b981';
                                  setTimeout(() => {
                                    span.textContent = originalText;
                                    span.style.color = '#64748b';
                                  }, 1000);
                                }
                              }}
                              onMouseOver={(e) => {
                                (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
                                (e.currentTarget as HTMLElement).style.color = '#475569';
                              }}
                              onMouseOut={(e) => {
                                (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                                (e.currentTarget as HTMLElement).style.color = '#64748b';
                              }}
                              data-host-event-id={event.id}
                              title="Click to copy full event ID"
                            >
                              {event.id}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Create Event Card */}
                    <div
                      onClick={() => setShowCreateModal(true)}
                      style={{
                        background: 'white',
                        border: '2px dashed #cbd5e1',
                        borderRadius: '12px',
                        padding: '3rem 1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minHeight: '200px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.background = '#eff6ff';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      <div style={{
                        width: '3rem',
                        height: '3rem',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                        fontSize: '1.5rem',
                        color: '#3b82f6'
                      }}>
                        +
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>
                        Create New Event
                      </div>
                    </div>
                  </div>
                )}

              </div>
              </div>
            </div>
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={createEvent}
        isCreating={isCreatingEvent}
      />
    </div>
  );
}

export default function MyMcp() {
  return (
    <CrossmintProvider apiKey={CLIENT_KEY}>
      <CrossmintAuthProvider loginMethods={["email"]}>
        <MyMcpInner />
      </CrossmintAuthProvider>
    </CrossmintProvider>
  );
}
