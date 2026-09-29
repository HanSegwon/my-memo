'use client';

import { useEffect, useState } from 'react';

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let pullAmount = 0;
    let tracking = false;

    const getScrollTop = () => window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || getScrollTop() > 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest('button, a, input, textarea, select, [role="dialog"], .family-event-modal-backdrop, [data-no-pull-refresh]')) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      pullAmount = 0;
      tracking = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return;
      const deltaX = event.touches[0].clientX - startX;
      const deltaY = event.touches[0].clientY - startY;
      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY) * 0.8 || getScrollTop() > 0) {
        tracking = false;
        setPullDistance(0);
        return;
      }
      pullAmount = Math.min(Math.max(0, deltaY - 8) * 0.8, 84);
      setPullDistance(pullAmount);
      if (deltaY > 12 && event.cancelable) event.preventDefault();
    };

    const handleTouchEnd = () => {
      if (tracking && pullAmount >= 64) {
        setRefreshing(true);
        setPullDistance(72);
        window.setTimeout(() => window.location.reload(), 120);
      } else {
        setPullDistance(0);
      }
      tracking = false;
    };

    const handleTouchCancel = () => {
      tracking = false;
      pullAmount = 0;
      setPullDistance(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);

  if (!pullDistance && !refreshing) return null;

  return (
    <div
      className={`pull-refresh-indicator${refreshing ? ' is-refreshing' : ''}`}
      style={{ transform: `translate(-50%, ${Math.max(12, pullDistance - 48)}px)` }}
      role="status"
      aria-label="새로고침 중"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 11a8 8 0 0 0-14.8-4L3 10" />
        <path d="M3 4v6h6" />
        <path d="M4 13a8 8 0 0 0 14.8 4L21 14" />
        <path d="M21 20v-6h-6" />
      </svg>
    </div>
  );
}
