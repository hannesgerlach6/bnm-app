import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { ConfirmModal, ModalType } from "../components/ConfirmModal";

// ─── Globale Referenzen für Nicht-Hook-Aufrufe (z.B. errorHandler) ───────────

let _globalShowConfirm:
  | ((title: string, msg: string) => Promise<boolean>)
  | null = null;

let _globalShowAlert:
  | ((title: string, msg: string, type?: ModalType) => Promise<void>)
  | null = null;

export function setGlobalModalFunctions(
  confirm: (title: string, msg: string) => Promise<boolean>,
  alert: (title: string, msg: string, type?: ModalType) => Promise<void>
) {
  _globalShowConfirm = confirm;
  _globalShowAlert = alert;
}

export function getGlobalShowConfirm() {
  return _globalShowConfirm;
}

export function getGlobalShowAlert() {
  return _globalShowAlert;
}

// ─── Context-Typen ────────────────────────────────────────────────────────────

interface ModalState {
  visible: boolean;
  title: string;
  message: string;
  type: ModalType;
  resolve: ((value: boolean) => void) | null;
}

interface ModalContextValue {
  showConfirm: (title: string, msg: string) => Promise<boolean>;
  showAlert: (title: string, msg: string, type?: ModalType) => Promise<void>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

const INITIAL_STATE: ModalState = {
  visible: false,
  title: "",
  message: "",
  type: "confirm",
  resolve: null,
};

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(INITIAL_STATE);

  const showConfirm = useCallback(
    (title: string, msg: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setModal({ visible: true, title, message: msg, type: "confirm", resolve });
      });
    },
    []
  );

  const showAlert = useCallback(
    (title: string, msg: string, type: ModalType = "info"): Promise<void> => {
      return new Promise<void>((resolve) => {
        setModal({
          visible: true,
          title,
          message: msg,
          type,
          resolve: (v) => resolve(),
        });
      });
    },
    []
  );

  // Globale Referenzen beim ersten Render setzen
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    setGlobalModalFunctions(showConfirm, showAlert);
  }

  function handleConfirm() {
    modal.resolve?.(true);
    setModal(INITIAL_STATE);
  }

  function handleCancel() {
    modal.resolve?.(false);
    setModal(INITIAL_STATE);
  }

  return (
    <ModalContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      <ConfirmModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ModalContext.Provider>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal muss innerhalb von ModalProvider verwendet werden");
  return ctx;
}

/** Shortcut: nur Confirm-Dialog */
export function useConfirm(): (title: string, msg: string) => Promise<boolean> {
  return useModal().showConfirm;
}

/** Shortcut: nur Alert-Dialog */
export function useAlert(): (title: string, msg: string, type?: ModalType) => Promise<void> {
  return useModal().showAlert;
}
