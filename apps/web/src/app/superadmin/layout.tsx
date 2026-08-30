import { type ReactNode } from 'react';

// Force this route to render dynamically (see ../login/layout.tsx for rationale).
export const dynamic = 'force-dynamic';

export default function SuperadminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
