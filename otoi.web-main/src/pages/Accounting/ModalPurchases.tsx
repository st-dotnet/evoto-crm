import { Fragment, useState, useEffect, useMemo } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import clsx from "clsx";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components";
import axios from "axios";
import { DialogClose } from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { PurchaseEntry } from "./purchase-entry-models";

// Props for the modal
interface IModalPurchaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase_entry: PurchaseEntry | null;
  onSuccess?: () => void;
}

// Initial values for form
const initialValues: PurchaseEntry = {
  invoice_number: "",
  date: new Date().toISOString().split('T')[0],
  amount: "",
  entered_bill: false,
};

const ModalPurchase = ({ open, onOpenChange, purchase_entry, onSuccess }: IModalPurchaseProps) => {
  const [loading, setLoading] = useState(false);

  // Dynamic Validation Schema
  const validationSchema = useMemo(() => {
    return Yup.object().shape({
        invoice_number: Yup.string()
            .min(2, "Minimum 2 symbols")
            .max(50, "Maximum 50 symbols")
            .required("Invoice number is required"),
        date: Yup.date().required("Date is required"),
        amount: Yup.number()
            .required("Amount is required")
            .min(0, "Amount must not be negative"),
      entered_bill: Yup.boolean(),
    });
  }, []);

  // Formik setup
  const formik = useFormik({
    initialValues: purchase_entry || initialValues,
    validationSchema,
    enableReinitialize: true,

    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);

      try {
        const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
        const apiUrl = `${baseUrl}/purchase/`;

        if (purchase_entry?.uuid) {
          await axios.put(`${apiUrl}${purchase_entry.uuid}`, values);
          toast.success("Purchase entry updated successfully");
        } else {
          await axios.post(apiUrl, values);
          toast.success("Purchase entry created successfully");
        }

        if (onSuccess) onSuccess();
        onOpenChange(false);
      } catch (error: any) {
        const errorMessage = error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "Something went wrong. Please try again.";
        setStatus(errorMessage);
        toast.error(errorMessage);
      } finally {
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    if (!open) {
      formik.resetForm();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] p-0 rounded-lg shadow-lg">
        <DialogHeader className="bg-gray-50 p-6 border-b">
          <DialogTitle className="text-lg font-semibold text-gray-800">
            {purchase_entry ? "Edit Purchase Entry" : "Add Purchase Entry"}
          </DialogTitle>
          <DialogClose onClick={() => onOpenChange(false)} className="right-2 top-1 rounded-sm opacity-70" />
        </DialogHeader>
        <DialogBody className="p-6">
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={formik.handleSubmit}
          >
            {formik.status && (
              <Alert variant="danger" className="mb-4">
                {formik.status}
              </Alert>
            )}

            {/* Invoice Number */}
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Invoice Number<span className="text-red-500">*</span>
              </label>
              <input
                placeholder="Invoice Number"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("invoice_number")}
                className={clsx(
                  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                  { "border-red-500": formik.touched.invoice_number && formik.errors.invoice_number }
                )}
              />
              {formik.touched.invoice_number && formik.errors.invoice_number && (
                <span className="text-xs text-red-500">{formik.errors.invoice_number}</span>
              )}
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Date<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...formik.getFieldProps("date")}
                className={clsx(
                  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                  { "border-red-500": formik.touched.date && formik.errors.date }
                )}
              />
              {formik.touched.date && formik.errors.date && (
                <span className="text-xs text-red-500">{formik.errors.date}</span>
              )}
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-gray-700">
                    Amount<span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount"
                    value={formik.values.amount}
                    onChange={(e) => {
                        const value = e.target.value;
                        // allow: empty, digits, digits., digits.decimal
                        if (/^\d*\.?\d*$/.test(value)) {
                            formik.setFieldValue("amount", value);
                        }
                    }}
                    onKeyDown={(e) => {
                        // block arrow up/down & minus key
                        if (["ArrowUp", "ArrowDown", "-", "e", "E"].includes(e.key)) {
                            e.preventDefault();
                        }
                    }}
                    className={clsx(
                        "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                        { "border-red-500": formik.touched.amount && formik.errors.amount }
                    )}
                />
                {formik.touched.amount && formik.errors.amount && (
                    <span className="text-xs text-red-500">{formik.errors.amount}</span>
                )}
            </div>

            {/* Entered Bill */}
            <div className="flex items-center gap-2">
              <label htmlFor="entered_bill_checkbox" className="text-sm font-medium text-gray-700">
                Entered Bill
              </label>
              <input
                type="checkbox"
                id="entered_bill_checkbox"
                checked={formik.values.entered_bill}
                onChange={(e) => formik.setFieldValue("entered_bill", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end pt-4 gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-gray-100 text-gray-800 border hover:bg-gray-200 h-10 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 h-10 px-4 py-2"
                disabled={loading || formik.isSubmitting}
              >
                {loading ? "Please wait..." : "Save"}
              </button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export { ModalPurchase };
