import { useState, useEffect } from 'react';
import { getAIIdentity, AIIdentity } from '../services/ai/config';

export function useAIIdentity() {
  const [identity, setIdentity] = useState<AIIdentity>(getAIIdentity());

  useEffect(() => {
    const handleUpdate = () => {
      setIdentity(getAIIdentity());
    };

    window.addEventListener('ai-identity-changed', handleUpdate);
    return () => window.removeEventListener('ai-identity-changed', handleUpdate);
  }, []);

  return identity;
}