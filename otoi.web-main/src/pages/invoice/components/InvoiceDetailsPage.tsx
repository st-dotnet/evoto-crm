import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer, Share, CreditCard, Edit, X, FileText, Clock, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { KeenIcon } from "@/components";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getInvoiceById } from "../services/invoice.services";
import { getShareData, sendShareEmail, ShareData } from "@/services/share.service";
import { SpinnerDotted } from "spinners-react";
import { useAuthContext } from "@/auth";
import { toAbsoluteUrl } from "@/utils/Assets";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Info } from "lucide-react";
import { recordPayment } from "../services/invoice.service";
import {
  createPaymentIn,
  generatePaymentNumber,
} from "../../payment-in/services/payment-in.service";
import { checkCreditNoteExistsForInvoice } from "../../creditIn/service/creditIn.service";
import { cn } from "@/lib/utils";
import { getCustomerById } from "@/pages/parties/services/customer.service";
import { getGlobalAssets } from "@/pages/global-config/services/businessConfig.service";
import { resolveImageUrl } from "@/utils/imageUtils";

interface InvoiceItem {
  uuid: string;
  item_id: string;
  product_name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  tax_percentage: number;
  tax_amount: number;
  total_price: number;
  measuring_unit_id?: number;
  image?: string | null;
}

interface Customer {
  uuid: string;
  customer_id?: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  contact_person?: string;
  mobile: string;
  email?: string | null;
  gst?: string;
  pin?: string;
  billing_address?: any;
  shipping_address?: any;
}

interface InvoiceData {
  uuid: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  payment_status: string;
  customer: Customer;
  items: InvoiceItem[];
  subtotal: number;
  tax_total: number;
  discount_total: number;
  additional_charges_total: number;
  round_off: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_discount?: number;
  notes?: string;
  terms_and_conditions?: string;
  payment_terms?: string;
  business?: any;
}

const InvoiceDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentUser } = useAuthContext();
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);

  // Payment Form State
  interface PaymentForm {
    amountReceived: number;
    discount: number;
    date: Date;
    mode: string;
    notes: string;
  }

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    amountReceived: 0,
    discount: 0,
    date: new Date(),
    mode: "cash",
    notes: "",
  });
  const [amountError, setAmountError] = useState("");
  const [updatedBalance, setUpdatedBalance] = useState(0);
  const [brandingAssets, setBrandingAssets] = useState<{ logo_path?: string; esign_path?: string } | null>(null);
  const [isFetchingShareData, setIsFetchingShareData] = useState(false);

  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchInvoiceData();
      fetchCreditNotesForInvoice();
      fetchBrandingAssets();
    }
  }, [id]);

  // Listen for credit note updates to refresh invoice data
  useEffect(() => {
    const handleCreditNoteUpdate = (event: CustomEvent) => {
      // Add a small delay to ensure backend processes the credit note and updates status
      setTimeout(() => {
        // Refresh the invoice data to show updated status and balance
        fetchInvoiceData();
        // Also refresh credit notes to show the latest data
        fetchCreditNotesForInvoice();
      }, 500); // 500ms delay for backend processing
    };

    window.addEventListener(
      "creditNoteUpdated",
      handleCreditNoteUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "creditNoteUpdated",
        handleCreditNoteUpdate as EventListener,
      );
    };
  }, [id]);

  const fetchBrandingAssets = async () => {
    try {
      const response = await getGlobalAssets();
      if (response.success && response.data) {
        setBrandingAssets(response.data);
      }
    } catch (error) {
      console.error("Error fetching branding assets:", error);
    }
  };

  const fetchInvoiceData = async () => {
    setIsLoading(true);
    try {
      const response = await getInvoiceById(id!);
      if (response.success && response.data) {
        const data = response.data;
        setInvoiceData(data);

        // Fetch customer details separately to get address information
        if (data.customer_id || data.customer?.uuid) {
          const custId = data.customer_id || data.customer?.uuid;
          try {
            const customerRes = await getCustomerById(custId);
            if (customerRes.success && customerRes.data) {
              setInvoiceData((prev) =>
                prev
                  ? {
                    ...prev,
                    customer: {
                      ...prev.customer,
                      ...customerRes.data,
                      billing_address:
                        customerRes.data.billing_address ||
                        prev.customer?.billing_address,
                      shipping_address:
                        customerRes.data.shipping_address ||
                        prev.customer?.shipping_address,
                    },
                  }
                  : null,
              );
            }
          } catch (custError) {
            console.error(
              "Error fetching customer details for invoice:",
              custError,
            );
          }
        }
      } else {
        toast.error(response.error || "Failed to load invoice");
        navigate("/invoices");
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
      toast.error("Failed to load invoice");
      navigate("/invoices");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCreditNotesForInvoice = async () => {
    try {
      const response = await checkCreditNoteExistsForInvoice(id!);
      if (response.success && response.data) {
        setCreditNotes(response.data.creditNotes || []);
      }
    } catch (error) {
      console.error("Error fetching credit notes:", error);
      setCreditNotes([]);
    }
  };

  const getTotalCreditNoteAmount = () => {
    return creditNotes.reduce(
      (total, creditNote) => total + (creditNote.total_amount || 0),
      0,
    );
  };

  const getPendingAmount = () => {
    if (!invoiceData) return 0;
    // Use backend's corrected balance_due which now includes credit notes
    if (invoiceData.balance_due !== undefined) {
      return Math.max(0, invoiceData.balance_due);
    }
    // Fallback calculation for backward compatibility
    const creditNotesTotal = getTotalCreditNoteAmount();
    const manualBalance = Math.max(
      0,
      invoiceData.total_amount -
      creditNotesTotal -
      (invoiceData.amount_paid || 0) -
      (invoiceData.payment_discount || 0),
    );
    return manualBalance;
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current || !invoiceData) return;
    const downloadToast = toast.loading("Generating PDF...");
    try {
      const token = (() => {
        try {
          const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
          if (!authData) return null;
          const parsedAuth = JSON.parse(authData);
          return (
            parsedAuth.token ||
            parsedAuth.access_token ||
            parsedAuth.accessToken ||
            null
          );
        } catch (error) {
          return null;
        }
      })();

      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}/invoices/${invoiceData.uuid}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${invoiceData.invoice_number || "Draft"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully", { id: downloadToast });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF", { id: downloadToast });
    }
  };

  const handlePrintPDF = () => {
    const originalTitle = document.title;
    document.title = " ";
    window.print();
    document.title = originalTitle;
  };

  const handleShareWhatsApp = async () => {
    if (!invoiceData) return;
    setIsFetchingShareData(true);
    const fetchToast = toast.loading("Preparing share options...");
    try {
      const response = await getShareData(invoiceData.uuid, 'invoice');
      if (response.success && response.data) {
        const { message, contact } = response.data;
        const whatsappUrl = `https://wa.me/${contact?.mobile || ""}?text=${encodeURIComponent(message || "")}`;
        window.open(whatsappUrl, "_blank");
        toast.success("Opening WhatsApp...", { id: fetchToast });
      } else {
        throw new Error(response.error || "Failed to fetch share data");
      }
    } catch (error: any) {
      console.error("Share error:", error);
      toast.error(error.message || "Failed to prepare share link", { id: fetchToast });
    } finally {
      setIsFetchingShareData(false);
    }
  };

  const handleShareEmail = async () => {
    if (!invoiceData) return;
    setIsFetchingShareData(true);
    const fetchToast = toast.loading("Sending email...");
    try {
      const response = await sendShareEmail(invoiceData.uuid, 'invoice');
      if (response.success) {
        toast.success("Email sent successfully!", { id: fetchToast });
      } else {
        throw new Error(response.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Email error:", error);
      toast.error(error.message || "Failed to send email", { id: fetchToast });
    } finally {
      setIsFetchingShareData(false);
    }
  };

  const handleRecordPayment = () => {
    if (!invoiceData) return;
    // Use the calculated pending amount after credit notes
    const maxPayableAmount = getPendingAmount();
    setPaymentForm({
      amountReceived: roundToTwo(maxPayableAmount),
      discount: 0,
      date: new Date(),
      mode: "cash",
      notes: "",
    });
    setAmountError("");
    setIsRecordPaymentOpen(true);
  };

  const validateAmountReceived = (amount: number) => {
    if (!invoiceData) return;
    // Use the calculated pending amount after credit notes
    const pendingAmount = getPendingAmount();
    const currentDiscount = parseFloat(String(paymentForm.discount)) || 0;
    const maxAllowedAmount = Math.max(0, pendingAmount - currentDiscount);

    if (amount > maxAllowedAmount) {
      setAmountError(
        `Amount received cannot exceed ${formatCurrency(maxAllowedAmount)} (pending amount: ${formatCurrency(pendingAmount)} - discount: ${formatCurrency(currentDiscount)})`,
      );
    } else {
      setAmountError("");
    }
  };

  const handlePaymentHistory = () => {
    setIsPaymentHistoryOpen(true);
  };

  const handleActualRecordPayment = () => {
    setIsPaymentHistoryOpen(false);
    handleRecordPayment();
  };

  const handleSavePayment = async () => {
    if (!id || !invoiceData) return;

    setIsSavingPayment(true);
    try {
      const response = await recordPayment(
        id,
        paymentForm.amountReceived,
        paymentForm.mode,
        paymentForm.notes,
        paymentForm.discount,
      );

      if (response.success) {
        // Update balance from response
        if (response.data?.balance_due !== undefined) {
          setUpdatedBalance(response.data.balance_due);
        }
        toast.success("Payment recorded successfully");
        setIsRecordPaymentOpen(false);
        // Add longer delay to ensure backend processes the payment and updates status
        setTimeout(() => {
          fetchInvoiceData(); // Refresh data
        }, 1000); // Increased from 500ms to 1000ms
      } else {
        // Handle overpayment error specifically
        if (response.error?.includes("Overpayment not allowed")) {
          setAmountError(response.error);
          toast.error(response.error);

          // Auto-correct to max allowed amount if provided
          if ((response.data as any)?.max_allowed) {
            setPaymentForm({
              ...paymentForm,
              amountReceived: roundToTwo((response.data as any).max_allowed),
            });
            toast.info(
              `Amount adjusted to maximum allowed: ₹${(response.data as any).max_allowed}`,
            );
          }
        } else {
          toast.error(response.error || "Failed to record payment");
        }
      }
    } catch (error: any) {
      console.error("Payment recording error:", error);

      // Handle overpayment error from API response
      if (error.response?.data?.error?.includes("Overpayment not allowed")) {
        const errorData = error.response.data;
        setAmountError(errorData.error);
        toast.error(errorData.error);

        // Auto-correct to max allowed amount
        if (errorData.max_allowed) {
          setPaymentForm({
            ...paymentForm,
            amountReceived: roundToTwo(errorData.max_allowed),
          });
          toast.info(
            `Amount adjusted to maximum allowed: ₹${errorData.max_allowed}`,
          );
        }
      } else {
        toast.error("An error occurred while recording payment");
      }
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleEdit = async () => {
    // Check if credit notes exist for this invoice before allowing edit
    try {
      const response = await checkCreditNoteExistsForInvoice(id!);
      if (response.success && response.data && response.data.hasCreditNote) {
        const creditNotes = response.data.creditNotes || [];
        const creditNoteNumbers = creditNotes
          .map((cn: any) => cn.credit_note_number)
          .join(", ");
        toast.error(
          `Cannot edit invoice. Credit note already exist: ${creditNoteNumbers}. Please unlink credit note first.`,
        );
        return;
      }
    } catch (error) {
      console.error("Error checking credit notes:", error);
      // Still allow edit if check fails, but show warning
      toast.warning(
        "Unable to verify credit note status. Proceed with caution.",
      );
    }

    navigate(`/invoices/${id}/edit`);
  };

  const formatCurrency = (amount: number) => {
    return `₹ ${amount.toFixed(2)}`;
  };

  // Helper function to round numbers to 2 decimal places to avoid floating-point precision issues
  const roundToTwo = (num: number) => {
    return Math.round(num * 100) / 100;
  };

  const formatNumberInWords = (num: number) => {
    if (!Number.isFinite(num)) return "Zero Rupees";
    const units = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ];
    const teens = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    const twoDigits = (value: number) => {
      if (value === 0) return "";
      if (value < 10) return units[value];
      if (value < 20) return teens[value - 10];
      const ten = Math.floor(value / 10);
      const unit = value % 10;
      return unit ? `${tens[ten]} ${units[unit]}` : tens[ten];
    };

    const threeDigits = (value: number) => {
      if (value === 0) return "";
      const hundred = Math.floor(value / 100);
      const rest = value % 100;
      if (hundred === 0) return twoDigits(rest);
      if (rest === 0) return `${units[hundred]} Hundred`;
      return `${units[hundred]} Hundred ${twoDigits(rest)}`;
    };

    const toIndianWords = (value: number) => {
      if (value === 0) return "Zero";
      let remainder = value;
      const parts: string[] = [];

      const crore = Math.floor(remainder / 10000000);
      if (crore) {
        parts.push(`${threeDigits(crore)} Crore`);
        remainder %= 10000000;
      }
      const lakh = Math.floor(remainder / 100000);
      if (lakh) {
        parts.push(`${threeDigits(lakh)} Lakh`);
        remainder %= 100000;
      }
      const thousand = Math.floor(remainder / 1000);
      if (thousand) {
        parts.push(`${threeDigits(thousand)} Thousand`);
        remainder %= 1000;
      }
      const rest = remainder;
      if (rest) parts.push(threeDigits(rest));
      return parts.join(" ");
    };

    const totalPaise = Math.round(Math.abs(num) * 100);
    if (totalPaise === 0) return "Zero Rupees";
    const rupees = Math.floor(totalPaise / 100);
    const paise = totalPaise % 100;
    let result = `${toIndianWords(rupees)} Rupees`;
    if (paise) result += ` and ${toIndianWords(paise)} Paise`;
    return result;
  };

  const getAuthBusinessInfo = () => {
    // 1. Try to get business info from fetched invoice data
    const fetchedBusiness = invoiceData?.business;
    if (fetchedBusiness) {
      return {
        name:
          fetchedBusiness.company_name ||
          fetchedBusiness.name ||
          fetchedBusiness.company ||
          "Evoto Technologies",
        email: fetchedBusiness.email || currentUser?.email,
        phone:
          fetchedBusiness.phone_number ||
          fetchedBusiness.phone ||
          fetchedBusiness.mobile ||
          currentUser?.phone,
        address:
          fetchedBusiness.address || fetchedBusiness.billing_address || null,
      };
    }

    // 2. Try to get from localStorage
    try {
      const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
      if (authData) {
        const parsedAuth = JSON.parse(authData);
        const business =
          parsedAuth.business ||
          parsedAuth.business_profile ||
          (parsedAuth.user?.businesses && parsedAuth.user.businesses[0]);
        if (business) {
          return {
            name:
              business.company_name ||
              business.name ||
              business.company ||
              "Evoto Technologies",
            email: business.email || currentUser?.email,
            address: business.address || null,
            phone:
              business.phone_number ||
              business.phone ||
              business.mobile ||
              currentUser?.phone ||
              "",
          };
        }
      }
    } catch (e) {
      /* silent catch */
    }

    // 3. Fallback to currentUser
    if (currentUser) {
      const userBusiness = (currentUser as any).businesses?.[0];
      if (userBusiness) {
        return {
          name:
            userBusiness.name ||
            userBusiness.company_name ||
            "Evoto Technologies",
          email: currentUser.email,
          address: (currentUser as any).address || null,
          phone:
            userBusiness.phone_number ||
            userBusiness.phone ||
            userBusiness.mobile ||
            (currentUser as any).phone ||
            (currentUser as any).mobile,
        };
      }
    }

    return {
      name: "Evoto Technologies",
      email: currentUser?.email || "",
      address: null,
      phone: currentUser?.phone || "",
    };
  };

  const formatAddressLines = (address: any, type: "billing" | "shipping") => {
    if (!address) return [];
    if (typeof address === "string") return [address];
    const elements: React.ReactNode[] = [];
    const line1 =
      address.address1 ||
      address.address_line1 ||
      address.line1 ||
      address.street1;
    const line2 =
      address.address2 ||
      address.address_line2 ||
      address.line2 ||
      address.street2;

    const prefix = type === "billing" ? "Billing Address" : "Shipping Address";

    if (line1)
      elements.push(
        <>
          <span className="font-semibold">{prefix}:</span> {line1}
        </>,
      );
    // if (line2) elements.push(<>
    //     <span className="font-semibold">Line 2:</span> {line2}
    // </>);

    const parts = [];
    if (address.city)
      parts.push(
        <span key="city">
          <span className="font-semibold">City:</span> {address.city}
        </span>,
      );
    if (address.state)
      parts.push(
        <span key="state">
          <span className="font-semibold">State:</span> {address.state}
        </span>,
      );
    if (address.country)
      parts.push(
        <span key="country">
          <span className="font-semibold">Country:</span> {address.country}
        </span>,
      );
    const pin = address.pin || address.postal_code || address.zip;
    if (pin)
      parts.push(
        <span key="pin">
          <span className="font-semibold">PIN:</span> {pin}
        </span>,
      );

    if (parts.length > 0) {
      const joinedParts = parts.reduce((acc: React.ReactNode[], curr, idx) => {
        if (idx === 0) return [curr];
        return [...acc, ", ", curr];
      }, []);
      elements.push(<>{joinedParts}</>);
    }
    return elements;
  };

  const getCustomerAddress = (customer: any, type: "billing" | "shipping") => {
    if (!customer) return null;
    let address =
      type === "shipping"
        ? customer.shipping_address ||
        customer.shippingAddress ||
        customer.shipping_addresses
        : customer.billing_address || customer.billingAddress;

    if (Array.isArray(address)) {
      address = address.find((addr: any) => addr?.is_default) || address[0];
    }

    if (!address) {
      const prefix = type === "shipping" ? "shipping_" : "";
      address = {
        address1:
          customer[`${prefix}address1`] ||
          customer[`${prefix}address_line1`] ||
          customer.address1 ||
          customer.address_line1,
        address2:
          customer[`${prefix}address2`] ||
          customer[`${prefix}address_line2`] ||
          customer.address2 ||
          customer.address_line2,
        city: customer[`${prefix}city`] || customer.city,
        state: customer[`${prefix}state`] || customer.state,
        country: customer[`${prefix}country`] || customer.country,
        pin: customer[`${prefix}pin`] || customer.pin,
      };
    }

    return address;
  };

  const getMeasuringUnit = (unitId?: number) => {
    const units: { [key: number]: string } = {
      1: "PCS",
      2: "KG",
      3: "LTR",
      4: "MTR",
    };
    return units[unitId || 1] || "PCS";
  };

  const getPaymentStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-green-100 text-green-800",
      partial: "bg-yellow-100 text-yellow-800",
      unpaid: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-[4px]">
        <div className="flex flex-col items-center gap-4">
          <SpinnerDotted
            size={50}
            thickness={100}
            speed={100}
            color="#1B84FF"
          />
          <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
            Fetching Invoice Details...
          </p>
        </div>
      </div>
    );
  }

  if (!invoiceData) return;

  if (!invoiceData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Invoice not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      <style>
        {`
          @media print {
            /* Hide all layout elements */
            .sidebar, .header, .footer, .topbar, .no-print, [data-kt-app-sidebar-enabled="true"] .app-sidebar, [data-kt-app-header-enabled="true"] .app-header {
              display: none !important;
            }
            
            /* Reset body background and margins */
            body {
              background-color: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Reset Metronic layout wrapper */
            .wrapper {
              padding: 0 !important;
              padding-top: 0 !important;
              padding-inline-start: 0 !important;
            }

            /* Reset main content area */
            main.content, [role="content"] {
              padding: 0 !important;
            }

            /* Container adjustments */
            .min-h-screen {
              min-height: auto !important;
              background: none !important;
              padding: 0 !important;
            }

            /* Main content width and positioning */
            #invoice-print-area {
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              max-width: 100% !important;
              width: 100% !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }

            /* Ensure text colors are black */
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>
      {/* Sticky Header Actions */}
      <div className="bg-white px-4 md:px-6 py-4 border-t border-b border-gray-200 sticky top-0 z-10 no-print">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto gap-4 flex-wrap">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/invoices")}
              className="md:h-10 md:w-10 h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-lg md:text-xl font-semibold text-black">
                Invoice #{invoiceData.invoice_number}
              </h1>
              <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded capitalize ${getPaymentStatusBadge(invoiceData.payment_status)}`}>
                  {invoiceData.payment_status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2"><Download className="h-4 w-4" />Download PDF</Button>
            <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-2"><Printer className="h-4 w-4" />Print PDF</Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={isFetchingShareData}>
                  <Share className="h-4 w-4" /> Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer">
                  <KeenIcon icon="whatsapp" className="text-black-800" /> WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareEmail} className="gap-2 cursor-pointer">
                  <Mail className="h-4 w-4" /> Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2"><Edit className="h-4 w-4" />Edit</Button> */}
            <Button variant="outline" size="sm" onClick={handlePaymentHistory} className="gap-2"><Clock className="h-4 w-4" />Payment History</Button>
            {Math.max(0, invoiceData.total_amount - (invoiceData.amount_paid + getTotalCreditNoteAmount())) > 0 && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleRecordPayment}>
                <CreditCard className="h-4 w-4" />Record Payment
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Invoice Preview Area */}
      <div
        id="invoice-print-area"
        ref={invoiceRef}
        className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 lg:p-12 bg-white mt-4 md:mt-8 shadow-sm overflow-hidden print:overflow-visible"
      >
        <div className="mb-8 flex flex-col md:flex-row print:flex-row justify-between items-center md:items-start print:items-start gap-4">
          {(() => {
            const businessInfo = getAuthBusinessInfo();
            return (
              <>
                <div className="mt-4 md:mt-12 print:mt-0 order-2 md:order-1 print:order-1 text-center md:text-left print:text-left">
                  <h1 className="text-2xl font-semibold text-black leading-tight">
                    {businessInfo?.name || "Evoto Technologies"}
                  </h1>
                  {businessInfo?.email && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                      {businessInfo.email}
                    </p>
                  )}
                  {businessInfo?.phone && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                      {businessInfo.phone}
                    </p>
                  )}
                  {businessInfo?.address && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                      {businessInfo.address}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center md:items-end print:items-end -mt-0 md:-mt-8 print:mt-0 order-1 md:order-2 print:order-2">
                  {brandingAssets?.logo_path ? (
                    <img
                      src={resolveImageUrl(`/static/uploads/business/${brandingAssets.logo_path}`)}
                      className="h-24 md:h-40 w-auto object-contain"
                      alt={businessInfo?.name || "Logo"}
                    />
                  ) : (
                    <img
                      src={toAbsoluteUrl("/media/app/Evoto-Logo.png")}
                      className="h-24 md:h-40 w-auto object-contain"
                      alt="Evoto Technologies"
                    />
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Invoice Details Metadata Box */}
        <div className="mb-8 md:mb-12 border border-black print:mb-3">
          {/* Desktop/Print Table */}
          <table className="w-full hidden md:table print:table">
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="px-4 py-1 text-left text-[11px] font-semibold text-black uppercase border-r border-black w-1/3">
                  Invoice No.
                </th>
                <th className="px-4 py-1 text-center text-[11px] font-semibold text-black uppercase border-r border-black w-1/3">
                  Invoice Date
                </th>
                <th className="px-4 py-1 text-right text-[11px] font-semibold text-black uppercase w-1/3">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-1 text-left text-[14px] font-normal text-black border-r border-black">
                  {invoiceData.invoice_number}
                </td>
                <td className="px-4 py-1 text-center text-[14px] font-normal text-black border-r border-black">
                  {new Date(invoiceData.invoice_date).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-1 text-right text-[14px] font-normal text-black">
                  {new Date(invoiceData.due_date).toLocaleDateString("en-IN")}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Mobile Layout (Labels and values paired) */}
          <div className="md:hidden print:hidden divide-y divide-black">
            <div className="px-4 py-2 flex justify-between h-auto">
              <span className="text-[11px] font-bold text-black uppercase">Invoice No.</span>
              <span className="text-sm font-normal text-black">{invoiceData.invoice_number}</span>
            </div>
            <div className="px-4 py-2 flex justify-between h-auto">
              <span className="text-[11px] font-bold text-black uppercase">Invoice Date</span>
              <span className="text-sm font-normal text-black">{new Date(invoiceData.invoice_date).toLocaleDateString("en-IN")}</span>
            </div>
            <div className="px-4 py-2 flex justify-between h-auto">
              <span className="text-[11px] font-bold text-black uppercase">Due Date</span>
              <span className="text-sm font-normal text-black">{new Date(invoiceData.due_date).toLocaleDateString("en-IN")}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12 print:grid-cols-2 print:gap-12">
          <div>
            <h3 className="text-[15px] font-semibold text-black uppercase mb-3 pb-1 border-b border-black w-full md:w-56 print:w-56">BILL TO</h3>
            <div className="space-y-1 text-black text-sm">
              <p className="font-semibold text-lg mb-2">
                {invoiceData.customer
                  ? `${invoiceData.customer.first_name || ""} ${invoiceData.customer.last_name || ""}`.trim()
                  : "Customer Details Not Available"}
              </p>
              <div className="space-y-1">
                {invoiceData.customer?.company_name && (
                  <p className="text-gray-600">
                    {invoiceData.customer.company_name}
                  </p>
                )}
                {invoiceData.customer?.email && (
                  <p className="text-black">
                    <span className="font-semibold">Email:</span>{" "}
                    {invoiceData.customer.email}
                  </p>
                )}
                {invoiceData.customer?.mobile && (
                  <p className="text-black">
                    <span className="font-semibold">Mobile:</span>{" "}
                    {invoiceData.customer.mobile}
                  </p>
                )}
                {invoiceData.customer?.gst && (
                  <p className="text-black">
                    <span className="font-semibold">GST:</span>{" "}
                    {invoiceData.customer.gst}
                  </p>
                )}
                {invoiceData.customer &&
                  formatAddressLines(
                    getCustomerAddress(invoiceData.customer, "billing"),
                    "billing",
                  ).map((element, i) => (
                    <p key={i} className="text-black">
                      {element}
                    </p>
                  ))}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-black uppercase mb-3 pb-1 border-b border-black w-full md:w-56 print:w-56">SHIP TO</h3>
            <div className="text-black text-sm">
              <p className="font-semibold text-lg mb-2">
                {invoiceData.customer
                  ? `${invoiceData.customer.first_name || ""} ${invoiceData.customer.last_name || ""}`.trim()
                  : "Customer Details Not Available"}
              </p>
              <div className="space-y-1">
                {invoiceData.customer?.company_name && (
                  <p className="text-gray-600">
                    {invoiceData.customer.company_name}
                  </p>
                )}
                {invoiceData.customer?.email && (
                  <p className="text-black">
                    <span className="font-semibold">Email:</span>{" "}
                    {invoiceData.customer.email}
                  </p>
                )}
                {invoiceData.customer?.mobile && (
                  <p className="text-black">
                    <span className="font-semibold">Mobile:</span>{" "}
                    {invoiceData.customer.mobile}
                  </p>
                )}
                {invoiceData.customer?.gst && (
                  <p className="text-black">
                    <span className="font-semibold">GST:</span>{" "}
                    {invoiceData.customer.gst}
                  </p>
                )}
                {invoiceData.customer &&
                  formatAddressLines(
                    getCustomerAddress(invoiceData.customer, "shipping"),
                    "shipping",
                  ).map((element, i) => (
                    <p key={i} className="text-black">
                      {element}
                    </p>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          {/* Mobile Card View (Matched to Quotation Style) */}
          <div className="md:hidden space-y-4 mb-8 no-print">
            {invoiceData.items?.map((item, index) => (
              <div key={item.uuid} className="border border-black rounded-lg overflow-hidden border-b-2 bg-white">
                {/* Card Header */}
                <div className="grid grid-cols-[1fr,auto] gap-2 p-3 border-b border-black">
                  <div>
                    <p className="text-[10px] font-bold text-black uppercase mb-1">ITEM DESCRIPTION</p>
                    <div className="flex items-start gap-1">
                      <span className="text-sm font-bold text-black">{index + 1}.</span>
                      <div>
                        <p className="text-sm font-bold text-black leading-tight">{item.product_name}</p>
                        {item.description && (
                          <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">{item.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-16 h-16 border border-black rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img src={resolveImageUrl(item.image)} className="w-full h-full object-cover" alt={item.product_name} />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                </div>

                {/* Pricing Grid (3 Columns) */}
                <div className="grid grid-cols-3 divide-x divide-black border-b border-black">
                  <div className="p-2 text-center">
                    <p className="text-[9px] font-bold text-black uppercase mb-1">PRICE/ITEM</p>
                    <p className="text-[11px] font-medium text-black">{formatCurrency(item.unit_price)}</p>
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-[9px] font-bold text-black uppercase mb-1">DISC.</p>
                    <p className="text-[11px] font-medium text-black">-{formatCurrency(item.discount_amount)}</p>
                    {item.discount_percentage > 0 && (
                      <span className="text-[8px] block">({item.discount_percentage}%)</span>
                    )}
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-[9px] font-bold text-black uppercase mb-1">TAX</p>
                    <p className="text-[11px] font-medium text-black">
                      {formatCurrency(item.tax_amount)}
                      <span className="text-[8px] block">({item.tax_percentage}%)</span>
                    </p>
                  </div>
                </div>

                {/* Card Footer (Totals) */}
                <div className="grid grid-cols-2 p-3 bg-gray-50/50">
                  <div>
                    <p className="text-[11px] font-bold text-black uppercase">
                      QTY: {item.quantity} {getMeasuringUnit(item.measuring_unit_id)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-black uppercase">
                      TOTAL: {formatCurrency(item.total_price)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Mobile Subtotal Summary Card */}
            <div className="bg-white border border-black rounded-lg overflow-hidden no-print">
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-black uppercase">SUBTOTAL</span>
                  <span className="text-sm font-bold text-black">
                    {formatCurrency(invoiceData.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-red-600">
                  <span className="text-xs font-bold uppercase">TOTAL DISCOUNT</span>
                  <span className="text-sm font-bold">-{formatCurrency(invoiceData.discount_total)}</span>
                </div>
                <div className="flex justify-between items-center text-black">
                  <span className="text-xs font-bold uppercase">TOTAL TAX</span>
                  <span className="text-sm font-bold">{formatCurrency(invoiceData.tax_total)}</span>
                </div>
                <div className="pt-2 border-t-2 border-black flex justify-between items-center">
                  <span className="text-sm font-black text-black uppercase">GRAND TOTAL</span>
                  <span className="text-lg font-black text-black">{formatCurrency(invoiceData.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          <table className="hidden md:table print:table w-full border border-black">
            <thead>
              <tr className="border-b-2 border-black bg-gray-100">
                <th className="px-3 py-2 text-left font-semibold text-xs text-black uppercase tracking-wider w-1/2 border-r border-black">
                  Item DESCRIPTION
                </th>
                <th className="px-3 py-2 text-center font-semibold text-xs text-black uppercase tracking-wider border-r border-black">
                  IMAGE
                </th>
                <th className="px-3 py-2 text-center font-semibold text-xs text-black uppercase tracking-wider border-r border-black">
                  QTY
                </th>
                <th className="px-3 py-2 text-right font-semibold text-xs text-black uppercase tracking-wider border-r border-black whitespace-nowrap">
                  PRICE/ITEM
                </th>
                <th className="px-3 py-2 text-center font-semibold text-xs text-black uppercase tracking-wider border-r border-black">
                  DISC.
                </th>
                <th className="px-3 py-2 text-center font-semibold text-xs text-black uppercase tracking-wider border-r border-black">
                  TAX
                </th>
                <th className="px-3 py-2 text-center font-semibold text-xs text-black uppercase tracking-wider">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {invoiceData.items?.map((item, index) => (
                <tr key={item.uuid}>
                  <td className="px-3 py-2 align-top border-r border-black">
                    <div className="flex items-start gap-1">
                      <span className="font-medium text-sm text-black min-w-[20px]">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-black leading-snug">
                          {item.product_name}
                        </p>
                        {item.description && (
                          <p className="text-xs text-black mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center align-top border-r border-black">
                    {item.image ? (
                      <div className="w-10 h-10 mx-auto rounded-md overflow-hidden border border-gray-200">
                        <img
                          src={resolveImageUrl(item.image)}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-sm font-normal text-black align-top border-r border-black whitespace-nowrap">
                    {item.quantity}{" "}
                    <span className="text-[10px] ml-0.5">
                      {getMeasuringUnit(item.measuring_unit_id)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-normal text-black align-top border-r border-black whitespace-nowrap">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-normal text-black align-top border-r border-black whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span>-{formatCurrency(item.discount_amount)}</span>
                      {item.discount_percentage > 0 && (
                        <span className="text-[10px]">
                          ({item.discount_percentage}%)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-normal text-black align-top border-r border-black whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(item.tax_amount)}</span>
                      {item.tax_percentage > 0 && (
                        <span className="text-[10px]">
                          ({item.tax_percentage}%)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-normal text-sm text-black align-top whitespace-nowrap">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black bg-gray-50 font-bold">
                <td
                  colSpan={3}
                  className="px-3 py-2 text-right text-xs uppercase tracking-widest text-black border-r border-black"
                >
                  SUBTOTAL
                </td>
                <td className="px-3 py-2 text-right text-sm text-black border-r border-black whitespace-nowrap">
                  {formatCurrency(
                    invoiceData.items.reduce(
                      (sum, item) => sum + item.unit_price * item.quantity,
                      0,
                    ),
                  )}
                </td>
                <td className="px-3 py-2 text-right text-sm text-black border-r border-black whitespace-nowrap">
                  -{formatCurrency(invoiceData.discount_total)}
                </td>
                <td className="px-3 py-2 text-right text-sm text-black border-r border-black whitespace-nowrap">
                  {formatCurrency(invoiceData.tax_total)}
                </td>
                <td className="px-3 py-2 text-right text-sm text-black whitespace-nowrap">
                  {formatCurrency(invoiceData.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {/* ===== Bottom Section (Two Column Layout) ===== */}
        <div className="mt-8 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 print:grid-cols-2 print:gap-16 print:mt-16">

          {/* ================= LEFT SIDE ================= */}
          <div className="space-y-10 md:col-span-1">

            {/* Notes */}
            {invoiceData.notes && (
              <div>
                <h4 className="text-xs font-bold text-black uppercase mb-2 border-b border-black pb-1 w-full md:w-20 print:w-20">
                  Notes
                </h4>
                <p className="text-xs text-black leading-relaxed whitespace-pre-wrap">
                  {invoiceData.notes}
                </p>
              </div>
            )}

            {/* Terms */}
            {invoiceData.terms_and_conditions && (
              <div>
                <h4 className="text-xs font-bold text-black uppercase mb-2 border-b border-black pb-1 w-full md:w-40 print:w-40">
                  Terms & Conditions
                </h4>

                <div className="text-[10px] text-black space-y-1">
                  {invoiceData.terms_and_conditions
                    ?.split("\n")
                    .filter((t) => t.trim() !== "")
                    .map((term, i) => (
                      <p key={i} className="leading-tight">
                        {term}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* ================= RIGHT SIDE ================= */}
          <div>
            {/* ===== Tax Summary ===== */}
            <div className="space-y-0 text-right">

              <div className="flex justify-between items-center py-1 gap-4">
                <span className="text-xs font-bold text-black uppercase">
                  SUBTOTAL
                </span>
                <span className="text-sm font-medium text-black">
                  {formatCurrency(invoiceData.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0))}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 gap-4">
                <span className="text-xs font-bold text-black uppercase">
                  Taxable Amount
                </span>
                <span className="text-sm font-medium text-black">
                  {formatCurrency(invoiceData.subtotal - invoiceData.discount_total)}
                </span>
              </div>

              {invoiceData.tax_total > 0 && (
                <>
                  <div className="flex justify-between items-center py-1 gap-4">
                    <span className="text-xs font-bold text-black uppercase">
                      CGST ({invoiceData.subtotal - invoiceData.discount_total > 0
                        ? Math.round(((invoiceData.tax_total / (invoiceData.subtotal - invoiceData.discount_total)) * 100 / 2) * 100) / 100
                        : 0}%)
                    </span>
                    <span className="text-sm font-medium text-black">
                      {formatCurrency(invoiceData.tax_total / 2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 gap-4 border-b border-black">
                    <span className="text-xs font-bold text-black uppercase">
                      {currentUser?.isUT ? 'UTGST' : 'SGST'}
                      ({invoiceData.subtotal - invoiceData.discount_total > 0
                        ? Math.round(((invoiceData.tax_total / (invoiceData.subtotal - invoiceData.discount_total)) * 100 / 2) * 100) / 100
                        : 0}%)
                    </span>
                    <span className="text-sm font-medium text-black">
                      {formatCurrency(invoiceData.tax_total / 2)}
                    </span>
                  </div>
                </>
              )}

              {invoiceData.additional_charges_total > 0 && (
                <div className="flex justify-between items-center py-1 gap-4">
                  <span className="text-xs font-bold text-black uppercase">
                    Additional Charges
                  </span>
                  <span className="text-sm font-medium text-black">
                    {formatCurrency(invoiceData.additional_charges_total)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-2 border-b-2 border-black">
                <span className="text-sm font-bold text-black uppercase">
                  Grand Total
                </span>
                <span className="text-xl font-bold text-black">
                  {formatCurrency(invoiceData.total_amount)}
                </span>
              </div>

              <div className="pt-2 text-right">
                <p className="text-[10px] text-black leading-tight italic max-w-[250px] ml-auto">
                  <span className="font-bold uppercase text-[10px] not-italic">
                    IN WORDS:
                  </span>{' '}
                  {formatNumberInWords(invoiceData.total_amount)}
                </p>
              </div>
            </div>

            {/* ===== Signature ===== */}
            <div className="mt-12 md:mt-20 flex justify-end">
              <div className="text-center">
                <p className="text-[10px] font-bold text-black uppercase mb-1">
                  For {getAuthBusinessInfo().name}
                </p>
                {brandingAssets?.esign_path && (
                  <div className="mb-0 flex justify-center">
                    <img
                      src={resolveImageUrl(`/static/uploads/business/${brandingAssets.esign_path}`)}
                      className="h-12 md:h-20 w-auto object-contain mix-blend-multiply"
                      alt="Signature"
                    />
                  </div>
                )}
                <div className={`w-full md:w-48 border-b border-black mb-1 print:w-48 mx-auto ${brandingAssets?.esign_path ? '-mt-2' : 'mt-12'}`}></div>
                <p className="text-[10px] font-bold text-black uppercase tracking-wider">
                  Authorized Signatory
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History Sidebar */}
        <Sheet
          open={isPaymentHistoryOpen}
          onOpenChange={setIsPaymentHistoryOpen}
        >
          <SheetContent
            side="right"
            className="sm:max-w-md p-0 flex flex-col h-full border-l border-gray-200"
          >
            <SheetHeader className="p-6 border-b border-gray-100 flex flex-row items-center justify-between">
              <SheetTitle className="text-xl font-bold text-gray-800">
                Payment History - Invoice #{invoiceData.invoice_number}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">
                    Invoice Amount
                  </span>
                  <span className="text-gray-900 font-bold">
                    {formatCurrency(invoiceData.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pb-4 border-b border-gray-100">
                  <span className="text-gray-500 font-medium tracking-tight">
                    Initial Amount Received
                  </span>
                  <span className="text-gray-900 font-bold">
                    {formatCurrency(invoiceData.amount_paid)}
                  </span>
                </div>
              </div>

              {/* Payments List */}
              <div className="space-y-4">
                {invoiceData.amount_paid > 0 ? (
                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-normal text-blue-600">
                        Payment in #{invoiceData.invoice_number}
                      </h4>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(invoiceData.amount_paid)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                      <span>
                        {new Date(invoiceData.invoice_date).toLocaleDateString(
                          "en-IN",
                        )}
                      </span>
                      <span className="capitalize">Cash</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center"></div>
                )}
              </div>

              {/* Credit Note History */}
              {creditNotes.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-bold text-gray-800 mb-3">
                    Credit Note History
                  </h4>
                  <div className="space-y-2">
                    {creditNotes.map((creditNote: any) => (
                      <div
                        key={creditNote.uuid}
                        className="p-4 rounded-xl border border-green-100 bg-green-50/50 hover:bg-green-50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-normal text-green-600">
                            Credit Note #{creditNote.credit_note_number}
                          </h4>
                          <span className="text-sm font-bold text-green-600">
                            {formatCurrency(creditNote.total_amount)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                          <span>
                            {new Date(
                              creditNote.credit_note_date,
                            ).toLocaleDateString("en-IN")}
                          </span>
                          <span
                            className={`capitalize px-2 py-1 rounded-full text-xs ${creditNote.status === "refunded"
                              ? "bg-red-100 text-red-700"
                              : creditNote.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                              }`}
                          >
                            {creditNote.status || "active"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 mt-auto space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-gray-600">Total Amount Received</span>
                  <span className="text-gray-900 font-bold">
                    {formatCurrency(invoiceData.amount_paid)}
                  </span>
                </div>
                {creditNotes.length > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600">
                      Credit Note(s) Applied
                    </span>
                    <span className="text-green-600">
                      -{formatCurrency(getTotalCreditNoteAmount())}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-gray-600">Balance Amount</span>
                  <span className="text-red-600">
                    {formatCurrency(getPendingAmount())}
                  </span>
                </div>
              </div>

              {getPendingAmount() > 0 && (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-lg shadow-sm shadow-blue-100"
                  onClick={handleActualRecordPayment}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Record Payment In
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Record Payment Modal */}
        <Dialog
          open={isRecordPaymentOpen}
          onOpenChange={setIsRecordPaymentOpen}
        >
          <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
            <DialogHeader className="px-6 py-4 border-b border-gray-200">
              <DialogTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-600" />
                Record Payment For Invoice #{invoiceData.invoice_number}
              </DialogTitle>
            </DialogHeader>

            <DialogBody className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Form Section */}
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <label className="text-sm font-medium text-gray-700">
                          Amount Received{" "}
                          <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={
                          paymentForm.amountReceived === null ||
                            paymentForm.amountReceived === 0
                            ? ""
                            : roundToTwo(paymentForm.amountReceived)
                        }
                        onChange={(e) => {
                          const amount = parseFloat(e.target.value) || 0;
                          // Use the calculated pending amount after credit notes
                          const pendingAmount = getPendingAmount();
                          const currentDiscount =
                            parseFloat(String(paymentForm.discount)) || 0;
                          const maxAllowedAmount = Math.max(
                            0,
                            pendingAmount - currentDiscount,
                          );
                          const cappedAmount = Math.min(
                            amount,
                            maxAllowedAmount,
                          );
                          setPaymentForm({
                            ...paymentForm,
                            amountReceived: roundToTwo(cappedAmount),
                          });
                          validateAmountReceived(cappedAmount);
                        }}
                        className={`h-10 ${amountError ? "border-red-5 00 focus:border-red-500 focus:ring-1 focus:ring-red-100" : "border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100"} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`}
                        placeholder="0.00"
                        step="0.01"
                      />
                      {amountError && (
                        <p className="text-xs text-red-600 font-medium">
                          {amountError}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <label className="text-sm font-medium text-gray-700">
                          Payment Discount
                        </label>
                        <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={
                          paymentForm.discount === null ||
                            paymentForm.discount === 0
                            ? ""
                            : roundToTwo(paymentForm.discount)
                        }
                        onChange={(e) => {
                          const newDiscount = parseFloat(e.target.value) || 0;
                          // Use the calculated pending amount after credit notes
                          const pendingAmount = getPendingAmount();
                          const maxAllowedAmount = Math.max(
                            0,
                            pendingAmount - newDiscount,
                          );
                          const currentAmountReceived =
                            parseFloat(String(paymentForm.amountReceived)) || 0;

                          // Adjust amount received if it exceeds the new maximum allowed
                          const adjustedAmountReceived = Math.min(
                            currentAmountReceived,
                            maxAllowedAmount,
                          );

                          setPaymentForm({
                            ...paymentForm,
                            discount: roundToTwo(newDiscount),
                            amountReceived: roundToTwo(adjustedAmountReceived),
                          });
                          validateAmountReceived(adjustedAmountReceived);
                        }}
                        className={`h-10 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`}
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Payment Date
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full h-10 justify-start text-left font-normal border-gray-200 hover:bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-100",
                              !paymentForm.date && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                            {paymentForm.date ? (
                              format(paymentForm.date, "dd MMM yyyy")
                            ) : (
                              <span className="text-gray-500">Select date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={paymentForm.date}
                            onSelect={(date) =>
                              date && setPaymentForm({ ...paymentForm, date })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Payment Mode
                      </label>
                      <Select
                        value={paymentForm.mode}
                        onValueChange={(value) =>
                          setPaymentForm({ ...paymentForm, mode: value })
                        }
                      >
                        <SelectTrigger className="h-10 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Notes
                    </label>
                    <Textarea
                      placeholder="Add any remarks or payment notes..."
                      className="min-h-[80px] border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none"
                      value={paymentForm.notes}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Info & Calculation Section */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">
                      Invoice #{invoiceData.invoice_number}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Customer Name</span>
                        <span className="text-gray-900 font-medium">
                          {invoiceData.customer?.first_name}{" "}
                          {invoiceData.customer?.last_name}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Amount</span>
                        <span className="text-gray-900 font-medium">
                          {formatCurrency(invoiceData.total_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Due Date</span>
                        <span className="text-gray-900 font-medium">
                          {new Date(invoiceData.due_date).toLocaleDateString(
                            "en-IN",
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">
                      Payment Calculation
                    </h4>
                    <div className="space-y-2">
                      {creditNotes.length > 0 && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 font-medium">
                              Original Balance Due
                            </span>
                            <span className="text-gray-600">
                              {formatCurrency(invoiceData.total_amount)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-green-600 font-medium">
                              Credit Note(s) Applied
                            </span>
                            <span className="text-green-600">
                              -{formatCurrency(getTotalCreditNoteAmount())}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-red-600 font-medium">
                          Pending Amount
                        </span>
                        <span className="text-red-600 font-semibold">
                          {formatCurrency(getPendingAmount())}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Amount Received</span>
                        <span className="text-gray-900 font-medium">
                          {formatCurrency(paymentForm.amountReceived)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Discount</span>
                        <span className="text-gray-900 font-medium">
                          -{formatCurrency(paymentForm.discount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-800">
                          New Balance
                        </span>
                        <span className="text-base font-bold text-blue-600">
                          {formatCurrency(
                            Math.max(
                              0,
                              getPendingAmount() -
                              paymentForm.amountReceived -
                              paymentForm.discount,
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                <span className="font-medium">Note:</span> Fields marked with{" "}
                <span className="text-red-500">*</span> are required
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsRecordPaymentOpen(false)}
                  className="bg-white border-gray-300 font-medium"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  onClick={handleSavePayment}
                  disabled={
                    isSavingPayment ||
                    paymentForm.amountReceived <= 0 ||
                    amountError !== ""
                  }
                >
                  {isSavingPayment ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </div>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Record Payment
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default InvoiceDetailsPage;
