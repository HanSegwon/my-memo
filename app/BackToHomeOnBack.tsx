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
    const handleBack = () => {
      if (pathname === '/affair-expenses' && document.querySelector('.affair-expense-modal')) {
        window.dispatchEvent(new Event('affair-expense:close-dialog'));
        return;
      }
      if (pathname === '/children-academy' && document.querySelector('.children-academy-modal')) {
        window.dispatchEvent(new Event('children-academy:close-dialog'));
        return;
      }
      if (pathname === '/smoking' && document.querySelector('.smoking-record-dialog')) {
        window.dispatchEvent(new Event('smoking:close-dialog'));
        return;
      }
      router.replace('/');
    };
    window.addEventListener('popstate', handleBack);

    return () => window.removeEventListener('popstate', handleBack);
  }, [pathname, router]);

  return null;
}
