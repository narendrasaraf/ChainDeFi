import React, { useEffect, useState, useCallback } from 'react';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getToken() {
    return JSON.parse(localStorage.getItem('userInfo') || '{}')?.token;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function RiskBadge({ riskLevel }) {
    const config = {
        Live: { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', icon: '✅' },
        Suspicious: { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', icon: '⚠️' },
        Fake: { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', icon: '❌' },
    };
    const c = config[riskLevel] || config.Fake;
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '12px',
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.text,
                fontWeight: 700,
                fontSize: '0.8rem',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
            }}
        >
            {c.icon} {riskLevel}
        </span>
    );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
    const radius = 54;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (score / 100) * circ;
    const color = score >= 70 ? '#16A34A' : score >= 30 ? '#D97706' : '#DC2626';

    return (
        <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
            <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="70" cy="70" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="10" />
                <circle
                    cx="70" cy="70" r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
            </svg>
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.05em' }}>{Math.round(score)}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em' }}>CONFIDENCE</span>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LivenessVerification() {
    const [phase, setPhase] = useState('idle'); // idle | loading | detecting | verified | failed | error
    const [sessionId, setSessionId] = useState(null);
    const [result, setResult] = useState(null); // { success, riskLevel, confidenceScore, token }
    const [errMsg, setErrMsg] = useState('');

    // ── 1. Create session on mount ──────────────────────────────────────────────
    useEffect(() => {
        startSession();
    }, []);

    const startSession = useCallback(async () => {
        setPhase('loading');
        setResult(null);
        setErrMsg('');
        try {
            const res = await fetch(`${API_URL}/api/liveness/create-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`,
                },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Session creation failed');
            setSessionId(data.sessionId);
            setPhase('detecting');
        } catch (e) {
            setErrMsg(e.message);
            setPhase('error');
        }
    }, []);

    // ── 2. AWS component fires this when analysis is complete ───────────────────
    const handleAnalysisComplete = useCallback(async () => {
        setPhase('loading');
        try {
            const res = await fetch(`${API_URL}/api/liveness/verify-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify({ sessionId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Verification failed');
            setResult(data);
            setPhase(data.success ? 'verified' : 'failed');
        } catch (e) {
            setErrMsg(e.message);
            setPhase('error');
        }
    }, [sessionId]);

    const handleError = useCallback((err) => {
        console.error('[Liveness] AWS detector error:', err);
        setErrMsg(err?.message || 'Camera / network error during liveness check');
        setPhase('error');
    }, []);

    // ─── UI ──────────────────────────────────────────────────────────────────────
    const styles = {
        page: {
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: "inherit",
            backgroundColor: '#FFFFFF',
        },
        card: {
            width: '100%',
            maxWidth: 520,
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 24,
            padding: '3rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
        heading: {
            fontSize: '1.8rem',
            fontWeight: 800,
            color: '#0F172A',
            margin: '0 0 0.5rem',
            textAlign: 'center',
            letterSpacing: '-0.02em',
        },
        sub: {
            fontSize: '1rem',
            color: '#64748B',
            textAlign: 'center',
            marginBottom: '2.5rem',
        },
        spinner: {
            width: 48,
            height: 48,
            border: '4px solid #EFF6FF',
            borderTop: '4px solid #2563EB',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '2rem auto',
        },
        btn: {
            display: 'block',
            width: '100%',
            padding: '1rem',
            marginTop: '2rem',
            border: 'none',
            borderRadius: 12,
            backgroundColor: '#2563EB',
            color: 'white',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
        },
        tokenBox: {
            marginTop: '1.5rem',
            background: '#F1F5F9',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '1rem',
            wordBreak: 'break-all',
            fontSize: '0.75rem',
            color: '#475569',
            fontFamily: 'monospace',
        },
    };

    const LoadingSpinner = () => (
        <>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={styles.spinner} />
            <p style={{ textAlign: 'center', fontSize: '0.95rem', color: '#64748B', fontWeight: 500 }}>
                {phase === 'loading' ? 'Verifying biometric markers…' : 'Initialising secure session…'}
            </p>
        </>
    );

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h1 style={styles.heading}>🔬 Liveness Verification</h1>
                <p style={styles.sub}>Prove you're a real person using your camera</p>

                {/* ── Loading ── */}
                {(phase === 'idle' || phase === 'loading') && <LoadingSpinner />}

                {/* ── AWS FaceLivenessDetector ── */}
                {phase === 'detecting' && sessionId && (
                    <FaceLivenessDetector
                        sessionId={sessionId}
                        region={import.meta.env.VITE_AWS_REGION || 'us-east-1'}
                        onAnalysisComplete={handleAnalysisComplete}
                        onError={handleError}
                        displayText={{ hintMoveFaceToOvalText: 'Move your face into the oval' }}
                    />
                )}

                {/* ── Verified ── */}
                {phase === 'verified' && result && (
                    <>
                        <ScoreRing score={result.confidenceScore} />
                        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                            <RiskBadge riskLevel={result.riskLevel} />
                            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.75rem' }}>
                                Identity Confirmed
                            </p>
                            <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                                Confidence: <strong >{result.confidenceScore.toFixed(1)}%</strong>
                            </p>
                        </div>
                        {result.token && (
                            <div style={styles.tokenBox}>
                                <div style={{ marginBottom: 4, fontSize: '0.68rem' }}>LIVENESS TOKEN</div>
                                {result.token}
                            </div>
                        )}
                        <button style={styles.btn} onClick={startSession}>Run Again</button>
                    </>
                )}

                {/* ── Suspicious / Failed ── */}
                {phase === 'failed' && result && (
                    <>
                        <ScoreRing score={result.confidenceScore} />
                        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                            <RiskBadge riskLevel={result.riskLevel} />
                            <p style={{ color: result.riskLevel === 'Suspicious' ? '#facc15' : '#f87171', fontWeight: 700, fontSize: '1.1rem', marginTop: '0.75rem' }}>
                                {result.riskLevel === 'Suspicious' ? 'Verification Inconclusive' : 'Liveness Check Failed'}
                            </p>
                            <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                                Score: <strong >{result.confidenceScore.toFixed(1)}%</strong>
                            </p>
                        </div>
                        <button style={styles.btn} onClick={startSession}>Try Again</button>
                    </>
                )}

                {/* ── Error ── */}
                {phase === 'error' && (
                    <>
                        <p style={{ textAlign: 'center', fontWeight: 600, marginTop: '1rem' }}>
                            ❌ {errMsg || 'Something went wrong'}
                        </p>
                        <button style={styles.btn} onClick={startSession}>Retry</button>
                    </>
                )}
            </div>
        </div>
    );
}
