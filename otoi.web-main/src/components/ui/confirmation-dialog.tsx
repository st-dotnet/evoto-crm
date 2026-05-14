import { Fragment } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: React.ReactNode;
  // message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: "danger" | "warning" | "info";
}

const ConfirmationDialog = ({
  open,
  onOpenChange,
  title,
  message,
  confirmText = "Yes",
  cancelText = "No",
  onConfirm,
  onCancel,
  variant = "warning",
}: ConfirmationDialogProps) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const getVariantClasses = () => {
    switch (variant) {
      case "danger":
        return "bg-red-600 text-white hover:bg-red-700";
      case "warning":
        return "bg-orange-600 text-white hover:bg-orange-700";
      case "info":
        return "bg-blue-600 text-white hover:bg-blue-700";
      default:
        return "bg-blue-600 text-white hover:bg-blue-700";
    }
  };

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 rounded-[24px] shadow-2xl bg-white dark:bg-gray-100 border border-gray-200/60 dark:border-gray-100/10 overflow-hidden backdrop-blur-xl">
          <DialogHeader className="bg-transparent p-8 pb-0 border-none">
            <DialogTitle className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight text-center">
              {title}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="p-8 pt-6">
            <div className="text-center">
              <div className="mb-8">
                {variant === "danger" && (
                  <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                    <svg
                      className="h-10 w-10 text-red-600 dark:text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                )}
                {variant === "warning" && (
                  <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                    <svg
                      className="h-10 w-10 text-orange-600 dark:text-orange-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                )}
                {variant === "info" && (
                  <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                    <svg
                      className="h-10 w-10 text-blue-600 dark:text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-10 px-2 font-medium">{message}</p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="order-2 sm:order-1 inline-flex items-center justify-center rounded-xl text-sm font-bold transition-all bg-gray-50 dark:bg-gray-200/5 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-100/10 hover:bg-gray-100 dark:hover:bg-gray-200/10 h-12 px-8 min-w-[120px]"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`order-1 sm:order-2 inline-flex items-center justify-center rounded-xl text-sm font-bold transition-all h-12 px-8 min-w-[120px] shadow-xl active:scale-95 ${getVariantClasses()}`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
};

export { ConfirmationDialog };
