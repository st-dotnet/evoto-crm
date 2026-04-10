import React, { useState, useEffect, useMemo, useRef } from "react";
import { ScreenLoader } from "@/components/loaders";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Save, User, FileText, Search, X, Filter, Calendar, Circle, Check, ChevronDown } from "lucide-react";
import {
  getPaymentOutList,
  getVendorInvoices,
  getPaymentOutById,
  recordPaymentOut,
  getVendorNamesDropdown,
} from "../services/payment-out.service";
import axios from "axios";
import { toast } from "sonner";
import { DataGrid, DataGridColumnHeader } from "@/components";
import { ColumnDef } from "@tanstack/react-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const CreatePaymentOut = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  
  // API function to get vendors
  const getVendorsDropdown = async () => {
    const token = localStorage.getItem("OTOI-auth-v1.0.0.1");
    if (!token) {
      return { success: false, error: "Authentication required", status: 401 };
    }

    try {
      const API_URL = import.meta.env.VITE_APP_API_URL;
      
      const response = await axios.get(
        `${API_URL}/vendors/?dropdown=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      
      return { success: true, data: response.data, status: response.status };
    } catch (error: any) {
      return {
        success: false,
        error: "Failed to fetch vendors",
        status: error.response?.status ?? 500,
      };
    }
  };
  const [isEditMode, setIsEditMode] = useState(!!id);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isVendorsLoading, setIsVendorsLoading] = useState(false);
  const [mobilePayments, setMobilePayments] = useState<any[]>([]);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [vendorInvoices, setVendorInvoices] = useState<any[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDiscount, setPaymentDiscount] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [isFullyPaid, setIsFullyPaid] = useState(false);
  
  // Invoice selection state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [paymentError, setPaymentError] = useState("");
  const [invoiceFieldError, setInvoiceFieldError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleBackClick = () => {
    navigate("/payment-out");
  };

  // Handle invoice selection
  const handleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const selectedInvoice = vendorInvoices.find((inv) => inv.id === invoiceId);
    if (selectedInvoice) {
      setPaymentNumber(selectedInvoice.invoice_number);
      // Only set payment amount if invoice has pending balance
      if (
        selectedInvoice.balance_amount > 0 ||
        selectedInvoice.status === "partial"
      ) {
        setPaymentAmount(selectedInvoice.balance_amount.toString());
      } else {
        setPaymentAmount("");
      }
      setPaymentDiscount("0");
    }
  };

  const handleSave = async () => {
    if (!selectedInvoiceId) {
      setInvoiceFieldError(true);
      setIsShaking(true); // Start shake animation
      toast.error("Please select a purchase invoice to record payment");

      // Stop shaking after 2 seconds
      setTimeout(() => {
        setIsShaking(false);
      }, 2000);

      return;
    }

    const actualPaymentAmount = parseFloat(paymentAmount) || 0;
    const discountAmount = parseFloat(paymentDiscount) || 0;
    const totalAppliedAmount = actualPaymentAmount + discountAmount;

    if (!paymentAmount || actualPaymentAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    const selectedInvoice = vendorInvoices.find(
      (inv) => inv.id === selectedInvoiceId,
    );
    const balanceAmount = selectedInvoice?.balance_amount || 0;

    if (totalAppliedAmount > balanceAmount + 0.01) {
      toast.error("Total payment cannot exceed balance amount");
      return;
    }

    setIsSaving(true);
    setPaymentError("");
    setInvoiceFieldError(false);

    try {
      const response = await recordPaymentOut(
        selectedInvoiceId,
        actualPaymentAmount,
        paymentMode,
        notes,
        parseFloat(paymentDiscount) || 0,
      );

      if (response.success) {
        toast.success("Payment recorded successfully");

        // Reset form
        setSelectedInvoiceId(null);
        setPaymentAmount("");
        setPaymentDiscount("");
        setPaymentNumber("");
        setNotes("");

        // Refresh vendor invoices to update the data
        if (selectedVendor) {
          await fetchVendorInvoices(selectedVendor.name);
        }

        navigate("/payment-out");
      } else {
        // Handle overpayment error specifically
        if (response.error?.includes("Overpayment not allowed")) {
          setPaymentError(response.error);
          toast.error(response.error);

          // Auto-correct to max allowed amount if provided
          if ((response.data as any)?.max_allowed) {
            setPaymentAmount((response.data as any).max_allowed.toString());
            toast.info(
              `Amount adjusted to maximum allowed: ₹${(response.data as any).max_allowed}`,
            );
          }
        } else {
          toast.error(response.error || "Failed to record payment");
        }
      }
    } catch (error: any) {

      // Handle overpayment error from API response
      if (error.response?.data?.error?.includes("Overpayment not allowed")) {
        const errorData = error.response.data;
        setPaymentError(errorData.error);
        toast.error(errorData.error);

        // Auto-correct to max allowed amount
        if (errorData.max_allowed) {
          setPaymentAmount(errorData.max_allowed.toString());
          toast.info(
            `Amount adjusted to maximum allowed: ₹${errorData.max_allowed}`,
          );
        }
      } else {
        toast.error("An error occurred while recording payment");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch vendors
  const fetchVendors = async () => {
    setIsVendorsLoading(true);
    try {
      const response = await getVendorsDropdown();

      if (response.success && response.data) {
        const vendorsList = response.data
          .filter((vendor: any) => vendor && vendor.name && vendor.name.trim() !== "")
          .map((vendor: any) => ({
            uuid: vendor.uuid || vendor.id,
            name: vendor.name || "Unknown Vendor",
            mobile: vendor.mobile || "",
            hasInvoices: true,
          }));
        setVendors(vendorsList);
      } else {
        toast.error(response.error || "Failed to fetch vendors");
      }
    } catch (error) {
      toast.error("Failed to fetch vendors");
    } finally {
      setIsVendorsLoading(false);
      setIsLoading(false);
    }
  };

  const handleVendorDeselect = () => {
    setSelectedVendor(null);
    setVendorInvoices([]);
    setSearchQuery("");
    setIsFullyPaid(false);
    // Clear payment fields when vendor is deselected
    setPaymentAmount("");
    setPaymentDiscount("");
    setPaymentNumber("");
    // Reset payment date to current date
    setPaymentDate(new Date().toISOString().split("T")[0]);
  };

  // Fetch invoices for selected vendor
  const fetchVendorInvoices = async (vendorName: string) => {
    setIsInvoicesLoading(true);
    try {
      const response = await getVendorInvoices(vendorName);

      if (response.success && response.data) {
        // Filter out unpaid invoices - only show paid and partially paid
        const filteredInvoices = response.data.filter(
          (invoice: any) =>
            invoice.balance_amount === 0 ||
            invoice.balance_amount === "0" ||
            invoice.status === "partial" ||
            invoice.status === "partially paid" ||
            invoice.status === "paid"
        );
        setVendorInvoices(filteredInvoices);

        // Check if all invoices are fully paid (balance amount = 0)
        const allInvoicesPaid = filteredInvoices.every(
          (invoice: any) =>
            invoice.balance_amount === 0 || invoice.balance_amount === "0",
        );
        setIsFullyPaid(allInvoicesPaid);

        // Auto-select single partial invoice
        const partialInvoices = filteredInvoices.filter(
          (invoice: any) =>
            invoice.balance_amount > 0 &&
            (invoice.status === "partial" ||
              invoice.status === "partially paid"),
        );

        if (partialInvoices.length === 1) {
          // Auto-select the single partial invoice
          const singlePartialInvoice = partialInvoices[0];
          setSelectedInvoiceId(singlePartialInvoice.id);
          setPaymentNumber(singlePartialInvoice.invoice_number);
          setPaymentAmount(singlePartialInvoice.balance_amount.toString());
          setPaymentDiscount("0");
        } else {
          // Reset selection if multiple partial invoices or none
          setSelectedInvoiceId(null);
          setPaymentNumber("");
          setPaymentAmount("");
          setPaymentDiscount("0");
        }
      } else {
        toast.error(response.error || "Failed to fetch vendor invoices");
        setVendorInvoices([]);
        setIsFullyPaid(false);
      }
    } catch (error) {
      toast.error("Failed to fetch vendor invoices");
      setVendorInvoices([]);
      setIsFullyPaid(false);
    } finally {
      setIsInvoicesLoading(false);
    }
  };

  const handleVendorSelect = async (vendor: any) => {
    setSelectedVendor(vendor);
    setIsModalOpen(false);
    setSearchQuery("");

    // Reset all payment fields before fetching new data
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("cash");
    setPaymentAmount("");
    setPaymentDiscount("");
    setPaymentNumber("");

    await fetchVendorInvoices(vendor.name);
  };

  // Load payment data for editing
  const loadPaymentForEdit = async (paymentId: string) => {
    try {
      setIsLoading(true);
      const response = await getPaymentOutById(paymentId);

      if (response.success && response.data) {
        const paymentData = response.data;

        // Set form fields with payment data
        setPaymentDate(
          paymentData.date || new Date().toISOString().split("T")[0],
        );
        setPaymentAmount(
          paymentData.amount_paid?.toString() ||
            paymentData.total_amount?.toString() ||
            "",
        );
        setPaymentDiscount(paymentData.discount?.toString() || "");
        setPaymentNumber(paymentData.payment_number || "");
        setPaymentMode(paymentData.payment_mode?.toLowerCase() || "cash");
        setNotes(paymentData.notes || "");

        // Set vendor information
        if (paymentData.vendor_name || paymentData.party_name) {
          const vendorData = {
            name: paymentData.vendor_name || paymentData.party_name,
            id: paymentData.id,
            mobile: "",
            hasInvoices: true,
          };
          setSelectedVendor(vendorData);
          fetchVendorInvoices(vendorData.name);
        }
      } else {
        toast.error(response.error || "Failed to load payment data");
        navigate("/payment-out");
      }
    } catch (error) {
      toast.error("Failed to load payment data");
      navigate("/payment-out");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode && id) {
      loadPaymentForEdit(id);
      return;
    }
    fetchVendors();
  }, [isEditMode, id]);

  const filteredVendors = vendors.filter((vendor) => {
    if (!vendor) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      (vendor.name && vendor.name.toLowerCase().includes(searchLower)) ||
      (vendor.mobile && vendor.mobile.includes(searchQuery))
    );
  });

  // Custom Tooltip Cell component for settled payments
  const TooltipCell = ({
    children,
    row,
  }: {
    children: React.ReactNode;
    row: any;
  }) => {
    const isSettled =
      row.original.balance_amount === 0 || row.original.balance_amount === "0";

    return (
      <div
        className={isSettled ? "cursor-not-allowed" : ""}
        title={
          isSettled
            ? "This invoice is already fully paid and cannot be edited"
            : undefined
        }
      >
        {children}
      </div>
    );
  };

  // Column definitions for DataGrid
  const invoiceColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Invoice Date"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => (
          <TooltipCell row={info.row}>
            <div className="text-sm text-gray-900 text-center">
              {new Date(info.getValue() as string).toLocaleDateString()}
            </div>
          </TooltipCell>
        ),
        meta: { headerClassName: "w-[110px]" },
      },
      {
        accessorKey: "invoice_number",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Invoice Number"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => (
          <TooltipCell row={info.row}>
            <div className="text-sm font-medium text-primary text-center">
              {info.getValue() as string}
            </div>
          </TooltipCell>
        ),
        meta: { headerClassName: "w-[110px]" },
      },
      {
        accessorKey: "invoice_amount",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Invoice Amount"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => (
          <TooltipCell row={info.row}>
            <div className="text-sm font-medium text-center">
              ₹{(info.getValue() as number)?.toLocaleString("en-IN") || "0"}
            </div>
          </TooltipCell>
        ),
        meta: {
          headerClassName: "w-[130px]",
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "amount_paid",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Amount Paid"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => (
          <TooltipCell row={info.row}>
            <div className="text-sm font-medium text-center">
              ₹{(info.getValue() as number)?.toLocaleString("en-IN") || "0"}
            </div>
          </TooltipCell>
        ),
        meta: {
          headerClassName: "w-[130px]",
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "balance_amount",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Balance Amount"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => (
          <TooltipCell row={info.row}>
            <div className="text-sm font-medium text-center">
              ₹{(info.getValue() as number)?.toLocaleString("en-IN") || "0"}
            </div>
          </TooltipCell>
        ),
        meta: {
          headerClassName: "w-[130px]",
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Status"
            column={column}
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const status = row.original.status;

          return (
            <TooltipCell row={row}>
              <div className="flex justify-center">
                {status === "paid" ? (
                  <span className="px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded whitespace-nowrap">
                    paid
                  </span>
                ) : status === "partial" || status === "partially paid" ? (
                  <span className="px-1.5 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-100 rounded whitespace-nowrap">
                    Partial
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded whitespace-nowrap">
                    Unpaid
                  </span>
                )}
              </div>
            </TooltipCell>
          );
        },
        meta: {
          headerClassName: "w-[80px]",
          cellClassName: "text-center",
        },
      },
    ],
    [selectedVendor],
  );

  // ─── Selected Vendor Card ────────
  const renderSelectedVendor = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Vendor Name
        </label>
        <input
          type="text"
          value={selectedVendor?.name || ""}
          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 text-sm"
          readOnly
        />
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Payment Amount (Pending: ₹
            {(
              vendorInvoices.find((i) => i.id === selectedInvoiceId)
                ?.balance_amount || 0
            ).toLocaleString("en-IN")}
            )
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm z-10">
              ₹
            </span>
            <input
              type="number"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => {
                const actualAmount = parseFloat(e.target.value) || 0;
                const selectedInvoice = vendorInvoices.find(
                  (inv) => inv.id === selectedInvoiceId,
                );
                const balanceAmount = selectedInvoice?.balance_amount || 0;
                const currentDiscount = parseFloat(paymentDiscount) || 0;

                const grossAmount = actualAmount + currentDiscount;

                if (grossAmount <= balanceAmount + 0.01) {
                  setPaymentAmount(actualAmount.toString());
                  setPaymentError("");
                } else {
                  const maxActual = Math.max(
                    0,
                    balanceAmount - currentDiscount,
                  );
                  setPaymentAmount(maxActual.toString());
                  setPaymentError(`Total payment cannot exceed balance amount`);
                }
              }}
              className={`w-full h-10 pl-8 pr-3 border rounded-lg focus:outline-none focus:ring-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
                paymentError
                  ? "border-red-100 focus:ring-red-200 focus:border-red-400"
                  : "border-slate-100 focus:ring-blue-200 focus:border-blue-400"
              }`}
              readOnly={isFullyPaid}
            />
          </div>
          {paymentError && (
            <div className="text-red-500 text-xs mt-1">{paymentError}</div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Payment Discount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm">
              ₹
            </span>
            <input
              type="number"
              min="0"
              placeholder={paymentDiscount || "0.00"}
              value={paymentDiscount}
              onChange={(e) => {
                const newDiscount = parseFloat(e.target.value) || 0;
                const selectedInvoice = vendorInvoices.find(
                  (inv) => inv.id === selectedInvoiceId,
                );
                const balanceAmount = selectedInvoice?.balance_amount || 0;
                const currentActual = parseFloat(paymentAmount) || 0;

                const maxActual = Math.max(0, balanceAmount - newDiscount);
                const adjustedActual = Math.min(currentActual, maxActual);

                setPaymentDiscount(e.target.value);
                setPaymentAmount(adjustedActual.toString());
                setPaymentError("");
              }}
              className="w-full h-10 pl-8 pr-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm disabled:bg-slate-50 disabled:text-slate-500 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
              readOnly={isFullyPaid}
            />
          </div>
        </div>
      </div>

      {/* Show payment breakdown */}
      {paymentAmount && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">
                Actual Payment Amount:
              </span>
              <span className="text-sm font-bold text-blue-900">
                ₹{(parseFloat(paymentAmount) || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">
                Payment Discount:
              </span>
              <span className="text-sm font-bold text-blue-900">
                -₹{(parseFloat(paymentDiscount) || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-blue-300">
              <span className="text-sm font-semibold text-blue-800">
                Total Applied to Invoice:
              </span>
              <span className="text-base font-bold text-blue-900">
                ₹
                {(
                  (parseFloat(paymentAmount) || 0) +
                  (parseFloat(paymentDiscount) || 0)
                ).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Show invoice status message */}
      {selectedVendor && vendorInvoices.length > 0 && (
        <div
          className={`mt-4 p-3 rounded-lg ${
            vendorInvoices.every((invoice) => invoice.balance_amount === 0)
              ? "bg-green-50 border border-green-200"
              : "bg-yellow-50 border border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                vendorInvoices.every((invoice) => invoice.balance_amount === 0)
                  ? "bg-green-500"
                  : "bg-yellow-500"
              }`}
            ></div>
            <p
              className={`text-sm font-medium ${
                vendorInvoices.every((invoice) => invoice.balance_amount === 0)
                  ? "text-green-700"
                  : "text-yellow-700"
              }`}
            >
              {vendorInvoices.every((invoice) => invoice.balance_amount === 0)
                ? `All ${vendorInvoices.length} invoices with this vendor are settled`
                : `${vendorInvoices.filter((invoice) => invoice.balance_amount > 0).length} invoice(s) with this vendor are pending`}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderEmptyVendor = () => (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12">
      <div className="text-center">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100 text-blue-600 mx-auto">
            <User className="h-6 w-6 sm:h-8 sm:w-8" />
          </div>
        </div>
        <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">
          No Vendor Selected
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6 px-4">
          Select a vendor to record payment
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-lg transition-all duration-200"
        >
          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Select Vendor
        </button>
      </div>
    </div>
  );

  // ─── Vendor Selection Modal ────────
  const VendorSelectionModal = () => (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="w-[95vw] max-w-[400px] sm:max-w-[450px] p-0 overflow-hidden rounded-lg border border-gray-200 shadow-lg">
        <DialogHeader className="bg-white px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold text-gray-800">
            Select Vendor
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              placeholder="Search Vendors by name or mobile..."
              className="pl-10 h-10 rounded-md border-gray-300 focus-visible:ring-1 focus-visible:ring-gray-400 focus-visible:ring-offset-0"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Vendor List */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
            <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {isVendorsLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <ScreenLoader />
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-gray-900">
                    Loading Vendors...
                  </h3>
                </div>
              ) : filteredVendors.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-gray-900">
                    No Vendor found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search criteria.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredVendors.map((vendor) => (
                    <li
                      key={vendor.id}
                      className={`group relative p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedVendor?.id === vendor.id
                          ? "bg-gray-100"
                          : ""
                      }`}
                      onClick={() => handleVendorSelect(vendor)}
                    >
                      <div className="flex items-center">
                        <div
                          className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${
                            selectedVendor?.id === vendor.id
                              ? "bg-green-100"
                              : "bg-gray-100"
                          }`}
                        >
                          <span
                            className={`font-medium text-sm ${
                              selectedVendor?.id === vendor.id
                                ? "text-green-700"
                                : "text-gray-600"
                            }`}
                          >
                            {(vendor.name || "Unknown")
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                            {vendor.name || "Unknown Vendor"}
                          </div>
                          {vendor.mobile && (
                            <div className="text-sm text-gray-500 flex items-center mt-1">
                              <span className="text-gray-400 mr-1.5">
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                </svg>
                              </span>
                              {vendor.mobile}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              Loading details...
            </p>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={handleBackClick}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-semibold text-slate-900 tracking-tight">
                  {isEditMode ? "Edit Payment Out" : "Record Payment Out"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 hidden xs:block">
                  {isEditMode
                    ? "Update outgoing payment information"
                    : "Create a new outgoing payment record"}
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedVendor}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Payment
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
          {/* ── Vendor Selection Card ─────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 text-blue-600">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                    Vendor Information
                  </h2>
                </div>
                {selectedVendor && (
                  <button
                    onClick={handleVendorDeselect}
                    className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {isInvoicesLoading && selectedVendor ? (
                <div className="flex items-center justify-center py-12">
                  <ScreenLoader />
                  <span className="ml-2 text-sm text-slate-500">
                    Loading vendor data...
                  </span>
                </div>
              ) : (
                <>
                  {selectedVendor
                    ? renderSelectedVendor()
                    : renderEmptyVendor()}
                </>
              )}
            </div>
          </div>

          {/* ── Payment Details Card ─────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 text-blue-600">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Payment Details
                </h2>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Date / Mode / Number */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full h-9 sm:h-10 px-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm disabled:bg-slate-50"
                    disabled={isFullyPaid}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-9 sm:h-10 px-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm disabled:bg-slate-50"
                    disabled={isFullyPaid}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="net banking">Net Banking</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                    Choose Invoice
                  </label>
                  {(() => {
                    const unpaid = vendorInvoices.filter(
                      (inv) => inv.balance_amount > 0 || inv.status !== "paid",
                    );
                    const paid = vendorInvoices.filter(
                      (inv) =>
                        inv.balance_amount === 0 && inv.status === "paid",
                    );

                    if (unpaid.length > 0) {
                      return (
                        <select
                          value={selectedInvoiceId || ""}
                          onChange={(e) => {
                            handleInvoiceSelection(e.target.value);
                            setInvoiceFieldError(false);
                            setIsShaking(false);
                          }}
                          className={`w-full h-9 sm:h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm ${
                            invoiceFieldError
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          } ${isShaking ? "animate-pulse" : ""}`}
                          disabled={
                            !selectedVendor || vendorInvoices.length === 0
                          }
                        >
                          <option value="">Choose an invoice...</option>
                          {unpaid.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoice_number}
                            </option>
                          ))}
                        </select>
                      );
                    }

                    if (paid.length > 0) {
                      return (
                        <input
                          type="text"
                          value={paid[0].invoice_number}
                          readOnly
                          className="w-full h-9 sm:h-10 px-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 text-xs sm:text-sm"
                          placeholder="No unpaid invoices"
                        />
                      );
                    }

                    return (
                      <input
                        type="text"
                        value=""
                        readOnly
                        className="w-full h-9 sm:h-10 px-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-400 text-xs sm:text-sm"
                        placeholder="No invoices found"
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
                  Notes
                </label>
                <textarea
                  value={
                    isFullyPaid && !notes.trim()
                      ? "Invoice fully settled."
                      : notes
                  }
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter remarks..."
                  className="w-full h-20 sm:h-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-xs sm:text-sm disabled:bg-slate-50"
                  readOnly={isFullyPaid}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Invoice Table Section */}
        {selectedVendor && (
          <div className="mt-6 sm:mt-8 bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-100 text-purple-600">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Purchase Invoices for this Vendor
                </h2>
              </div>
            </div>

            <div className="p-4">
              {isInvoicesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <ScreenLoader />
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <DataGrid
                    key="payment-out-invoice-grid"
                    columns={invoiceColumns}
                    data={vendorInvoices}
                    getRowId={(row) => row.id.toString()}
                    pagination={{ size: 10 }}
                    onRowClick={(row) => {
                      if (row.original.balance_amount > 0) {
                        handleInvoiceSelection(row.original.id);
                      }
                    }}
                    layout={{
                      classes: {
                        table:
                          "[&_tr:hover]:bg-slate-50 [&_td]:py-3 [&_th]:py-3 [&_td]:text-center [&_th]:text-center w-full",
                      },
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Vendor Selection Modal */}
      <VendorSelectionModal />
    </div>
  );
};

export default CreatePaymentOut;
