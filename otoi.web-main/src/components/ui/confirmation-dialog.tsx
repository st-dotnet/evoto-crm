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
        <DialogContent className="max-w-md p-0 rounded-lg shadow-lg">
          <DialogHeader className="bg-gray-50 p-6 border-b">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              {title}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="text-center">
              <div className="mb-4">
                {variant === "danger" && (
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <svg
                      className="h-6 w-6 text-red-900"
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
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100">
                    <svg
                      className="h-6 w-6 text-orange-600"
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
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                    <svg
                      className="h-6 w-6 text-blue-600"
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
              <p className="text-sm text-gray-600 mb-6">{message}</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-gray-100 text-gray-800 border hover:bg-gray-200 h-10 px-4 py-2"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 ${getVariantClasses()}`}
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
