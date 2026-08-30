import { type ReactNode } from 'react';

// Force this route to render dynamically on the server (App Router segment config).
// The login page is itself a `'use client'` component, so `dynamic`/`revalidate`
// must live on a Server Component layout wrapping it.
export const dynamic = 'force-dynamic';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
