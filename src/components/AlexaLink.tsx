import React, { useEffect, useState } from 'react';
import { User } from '../types';

interface AlexaLinkProps {
    user: User | null;
    onNavigate: (view: any) => void;
}

const AlexaLink: React.FC<AlexaLinkProps> = ({ user, onNavigate }) => {
    const [status, setStatus] = useState<'analyzing' | 'ready' | 'linking' | 'complete' | 'error'>('analyzing');
    const [state, setState] = useState<string | null>(null);
    const [redirectUri, setRedirectUri] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const alexaState = params.get('state');
        const amazonRedirect = params.get('amazon_redirect_uri');

        if (alexaState && amazonRedirect) {
            setState(alexaState);
            setRedirectUri(amazonRedirect);
            setStatus('ready');
        } else {
            console.error("[Alexa Link] Missing parameters in URL.");
            setStatus('error');
        }
    }, []);

    const handleLink = () => {
        if (!user || !state || !redirectUri) return;

        setStatus('linking');

        // The "code" in our OAuth flow is simply the user's UID.
        // Stage 2 (alexaToken) will receive this code and sign it into a JWT.
        const finalUrl = `${redirectUri}?state=${state}&code=${user.id}`;

        console.log("[Alexa Link] Redirecting back to Amazon:", finalUrl);

        // Give the user a moment to see the "Linking..." state
        setTimeout(() => {
            window.location.href = finalUrl;
        }, 1500);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
            color: '#e2e8f0',
            height: '100%',
            maxWidth: '500px',
            margin: '0 auto'
        }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#6366f1' }}>
                Link Life Archivist
            </h1>

            {status === 'error' && (
                <p style={{ color: '#ef4444' }}>
                    Invalid link request. Please try starting the linking process from the Alexa app again.
                </p>
            )}

            {status === 'ready' && !user && (
                <div>
                    <p style={{ marginBottom: '2rem' }}>
                        Please log in to GIGI to connect your Life Archivist account to Alexa.
                    </p>
                    <button
                        onClick={() => onNavigate('dashboard')}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#6366f1',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Go to Login
                    </button>
                </div>
            )}

            {status === 'ready' && user && (
                <div>
                    <p style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>
                        Connected as <strong>{user.displayName}</strong>.
                    </p>
                    <p style={{ marginBottom: '2rem', opacity: 0.8 }}>
                        By clicking below, GIGI will be able to share your journals and memories with your Alexa devices.
                    </p>
                    <button
                        onClick={handleLink}
                        style={{
                            padding: '16px 32px',
                            backgroundColor: '#4f46e5',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            boxShadow: '0 4px 14px 0 rgba(0,0,0,0.39)'
                        }}
                    >
                        Link Account Now
                    </button>
                </div>
            )}

            {status === 'linking' && (
                <div>
                    <div className="animate-spin" style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #6366f1',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        margin: '0 auto 1rem'
                    }} />
                    <p>Securing connection to Alexa...</p>
                </div>
            )}
        </div>
    );
};

export default AlexaLink;
