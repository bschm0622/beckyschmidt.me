import React, { useState } from 'react';
import * as api from '@/lib/cms-api';
import { ApiError } from '@/lib/cms-api';
import { setTrackingOff } from '@/lib/analytics/track';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.login(password);
      // Any browser Becky signs in on stops counting toward analytics.
      setTrackingOff(true);
      window.location.reload();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Admin</h1>
          <p className="text-sm text-muted-foreground">Sign in to see your sites and notes.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            placeholder="Password"
            autoFocus
            required
          />
          {error && <p className="text-sm text-danger text-center">{error}</p>}
          <button type="submit" disabled={isLoading} className="btn-primary w-full">
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
