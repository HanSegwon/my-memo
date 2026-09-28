'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function BackToHomeOnBack() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/') return;

    if (window.history.state?.backToHome !== true) {
      window.history.pushState({ ...window.history.state, backToHome: true }, '', pathname);
    }
    const handleBack = () => router.replace('/');
    window.addEventListener('popstate', handleBack);

    return () => window.removeEventListener('popstate', handleBack);
  }, [pathname, router]);

  return null;
}
