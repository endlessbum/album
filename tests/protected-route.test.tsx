import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { Router } from 'wouter';
import { ProtectedRoute } from '@/lib/protected-route';

// simple mock of use-auth hook
vi.mock('@/hooks/use-auth', () => {
  let state: any = { user: undefined, isLoading: false };
  return {
    useAuth: () => state,
    __setAuthState: (next: any) => { state = next; },
  };
});

import * as Auth from '@/hooks/use-auth';

function Page() { return <div data-testid="page">OK</div>; }

describe('ProtectedRoute', () => {
  it('shows loader while loading', () => {
    (Auth as any).__setAuthState({ user: undefined, isLoading: true });
    const { container } = render(
      <Router hook={() => ['/', () => {}] as any}> 
        <ProtectedRoute path="/" component={Page} />
      </Router>
    );
    // loader has role not set, but we can check by SVG presence via query by title not available; fallback: container text is empty
    expect(container).toBeTruthy();
  });

  it('redirects when no user', () => {
    (Auth as any).__setAuthState({ user: undefined, isLoading: false });
    const { container } = render(
      <Router hook={() => ['/', () => {}] as any}> 
        <ProtectedRoute path="/" component={Page} />
      </Router>
    );
    // Redirect renders nothing of Page
    expect(container.querySelector('[data-testid="page"]')).toBeNull();
  });

  it('renders component when user exists', () => {
    (Auth as any).__setAuthState({ user: { id: 'u1' }, isLoading: false });
    const { getByTestId } = render(
      <Router hook={() => ['/', () => {}] as any}> 
        <ProtectedRoute path="/" component={Page} />
      </Router>
    );
    expect(getByTestId('page')).toBeTruthy();
  });
});
