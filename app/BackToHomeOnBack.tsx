'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const DIALOG_SELECTOR = '[role="dialog"], [data-back-dialog="true"], .settings-modal, .family-event-modal, .negative-dialog, .smoking-record-dialog';
const LEGACY_DIALOG_KEYS = ['affairExpenseDialog', 'childrenAcademyDialog', 'smokingDialog'];

function openDialogs() {
  return Array.from(document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR));
}

function hasLegacyDialogState(state: Record<string, unknown> | null) {
  return LEGACY_DIALOG_KEYS.some((key) => state?.[key] === true);
}

function withoutDialogState(state: Record<string, unknown> | null) {
  const next: Record<string, unknown> = { ...(state ?? {}), backToHome: true };
  delete next.appDialogBackPath;
  delete next.appDialogBackDepth;
  for (const key of LEGACY_DIALOG_KEYS) delete next[key];
  return next;
}

function closeButtonFor(dialog: HTMLElement) {
  return dialog.querySelector<HTMLButtonElement>(
    'button[data-back-close], button[aria-label="닫기"], button.modal-close, button.negative-dialog-cancel',
  );
}

export default function BackToHomeOnBack() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/') return;

    if (window.history.state?.backToHome !== true) {
      window.history.pushState({ ...window.history.state, backToHome: true }, '', pathname);
    }

    let previousDialogCount = openDialogs().length;
    let closingDialogFromBack = false;
    const observer = new MutationObserver(() => {
      const currentDialogCount = openDialogs().length;
      const state = window.history.state as Record<string, unknown> | null;

      if (currentDialogCount > previousDialogCount) {
        let entriesToAdd = currentDialogCount - previousDialogCount;
        if (previousDialogCount === 0 && hasLegacyDialogState(state)) entriesToAdd -= 1;
        for (let index = 0; index < entriesToAdd; index += 1) {
          window.history.pushState({
            ...window.history.state,
            appDialogBackPath: pathname,
            appDialogBackDepth: previousDialogCount + index + 1,
          }, '', pathname);
        }
      } else if (currentDialogCount < previousDialogCount) {
        const hasManagedDialogState = state?.appDialogBackPath === pathname;
        if (!closingDialogFromBack && (hasManagedDialogState || hasLegacyDialogState(state))) {
          window.history.replaceState(withoutDialogState(state), '', pathname);
        }
        closingDialogFromBack = false;
      }

      previousDialogCount = currentDialogCount;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handleBack = () => {
      const dialogs = openDialogs();
      const topDialog = dialogs.at(-1);
      if (topDialog) {
        const closeButton = closeButtonFor(topDialog);
        if (closeButton && !closeButton.disabled) {
          closingDialogFromBack = true;
          closeButton.click();
          window.setTimeout(() => {
            if (!document.body.contains(topDialog)) return;
            closingDialogFromBack = false;
            const currentState = window.history.state as Record<string, unknown> | null;
            if (currentState?.appDialogBackPath !== pathname && !hasLegacyDialogState(currentState)) {
              window.history.pushState({
                ...window.history.state,
                appDialogBackPath: pathname,
                appDialogBackDepth: dialogs.length,
              }, '', pathname);
            }
          }, 0);
        } else {
          window.history.pushState({ ...window.history.state, backToHome: true }, '', pathname);
        }
        return;
      }

      router.replace('/');
    };

    window.addEventListener('popstate', handleBack);
    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', handleBack);
    };
  }, [pathname, router]);

  return null;
}
