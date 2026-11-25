import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button, Modal } from './ui';

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for things that remove or close something. */
  danger?: boolean;
};

type Ask = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<Ask | null>(null);

/**
 * "Are you sure?" in the app's own style instead of the browser's pop-up.
 * `const ask = useConfirm(); if (await ask({ title: 'Archive this property?' })) …`
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const ask = useCallback<Ask>((opts) => new Promise((resolve) => setPending({ opts, resolve })), []);
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const o = pending?.opts;
  return (
    <Ctx.Provider value={ask}>
      {children}
      {o && (
        <Modal
          open
          onClose={() => close(false)}
          title={o.title}
          footer={
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                {o.cancelLabel ?? 'Cancel'}
              </Button>
              <Button variant={o.danger ? 'danger' : 'primary'} autoFocus onClick={() => close(true)}>
                {o.confirmLabel ?? 'Yes, continue'}
              </Button>
            </>
          }
        >
          {o.body && <div className="text-sm leading-relaxed text-slate-600">{o.body}</div>}
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ask = useContext(Ctx);
  if (!ask) throw new Error('useConfirm outside ConfirmProvider');
  return ask;
}
