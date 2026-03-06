import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft,
  Save,
  User,
  FileText,
  Search,
  X,
} from "lucide-react";
import {
  getPaymentInList,
  getPartyInvoices,
  getPaymentById,
} from "../services/payment-in.service";
import { recordPayment } from "../../invoice/services/invoice.service";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
import { SpinnerDotted } from "spinners-react";
import { toast } from "sonner";
import { DataGrid, DataGridColumnHeader } from "@/components";
import { ColumnDef } from "@tanstack/react-table";

export const CreatePaymentIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [isEditMode, setIsEditMode] = useState(!!id);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [isAddingParty, setIsAddingParty] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parties, setParties] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPartiesLoading, setIsPartiesLoading] = useState(false);
  const [partyInvoices, setPartyInvoices] = useState<any[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [paymentReceived, setPaymentReceived] = useState("");
  const [paymentDiscount, setPaymentDiscount] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [isFullyPaid, setIsFullyPaid] = useState(false);

  // Ref for dropdown container to handle click-outside
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Invoice selection state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [paymentError, setPaymentError] = useState("");
  const [invoiceFieldError, setInvoiceFieldError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleBackClick = () => {
    navigate("/payment-in");
  };

  // Handle invoice selection
  const handleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const selectedInvoice = partyInvoices.find((inv) => inv.id === invoiceId);
    if (selectedInvoice) {
      setPaymentNumber(selectedInvoice.invoice_number);
      // Only set payment received if invoice has pending balance
      if (
        selectedInvoice.balance_amount > 0 ||
        selectedInvoice.status === "partially paid"
      ) {
        setPaymentReceived(selectedInvoice.balance_amount.toString());
      } else {
        setPaymentReceived("");
      }
      setPaymentDiscount("0");
    }
  };

  const handleSave = async () => {
    if (!selectedInvoiceId) {
      setInvoiceFieldError(true);
      setIsShaking(true); // Start shake animation
      toast.error("Please select partial paid invoice to record payment");

      // Stop shaking after 2 seconds
      setTimeout(() => {
        setIsShaking(false);
      }, 2000);

      return;
    }

    const actualPaymentAmount = parseFloat(paymentReceived) || 0;
    const discountAmount = parseFloat(paymentDiscount) || 0;
    const totalAppliedAmount = actualPaymentAmount + discountAmount;
    
    if (!paymentReceived || actualPaymentAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    
    const selectedInvoice = partyInvoices.find(
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
      const response = await recordPayment(
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
        setPaymentReceived("");
        setPaymentDiscount("");
        setPaymentNumber(""); 
        setNotes("");

        // Refresh party invoices to update the data
        if (selectedParty) {
          await fetchPartyInvoices(selectedParty.name);
        }

        navigate("/payment-in");
      } else {
        // Handle overpayment error specifically
        if (response.error?.includes("Overpayment not allowed")) {
          setPaymentError(response.error);
          toast.error(response.error);

          // Auto-correct to max allowed amount if provided
          if ((response.data as any)?.max_allowed) {
            setPaymentReceived((response.data as any).max_allowed.toString());
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
        setPaymentError(errorData.error);
        toast.error(errorData.error);

        // Auto-correct to max allowed amount
        if (errorData.max_allowed) {
          setPaymentReceived(errorData.max_allowed.toString());
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

  // Fetch parties from payment records
  const fetchParties = async () => {
    setIsPartiesLoading(true);
    try {
      // Fetch all payment records to get all party names (use page=1, per_page=1000)
      const response = await getPaymentInList(1, 1000, '', '', '');

      if (response.success && response.data) {
        const paymentData = response.data.data || response.data;

        // Extract unique customer names from payment records
        const uniqueCustomers = new Map();
        paymentData.forEach((payment: any) => {
          const customerName = payment.party_name;
          if (customerName && !uniqueCustomers.has(customerName)) {
            uniqueCustomers.set(customerName, {
              id: payment.id,
              name: customerName,
              mobile: "",
              hasInvoices: true,
            });
          }
        });

        const transformedParties = Array.from(uniqueCustomers.values());
        setParties(transformedParties);
      } else {
        toast.error(response.error || "Failed to fetch parties");
      }
    } catch (error) {
      console.error("Error fetching parties:", error);
      toast.error("Failed to fetch parties");
    } finally {
      setIsPartiesLoading(false);
      setIsLoading(false);
    }
  };

  // Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAddingParty(false);
        setSearchQuery("");
      }
    };

    if (isAddingParty) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddingParty]);

  const handlePartyDeselect = () => {
    setSelectedParty(null);
    setPartyInvoices([]);
    setIsAddingParty(false);
    setSearchQuery("");
    setIsFullyPaid(false);
    // Clear payment fields when party is deselected
    setPaymentReceived("");
    setPaymentDiscount("");
    setPaymentNumber("");
    // Reset payment date to current date
    setPaymentDate(new Date().toISOString().split("T")[0]);
  };

  // Fetch invoices for selected party
  const fetchPartyInvoices = async (partyName: string) => {
    setIsInvoicesLoading(true);
    try {
      const response = await getPartyInvoices(partyName);

      if (response.success && response.data) {
        setPartyInvoices(response.data);

        // Check if all invoices are fully paid (balance amount = 0)
        const allInvoicesPaid = response.data.every(
          (invoice: any) =>
            invoice.balance_amount === 0 || invoice.balance_amount === "0",
        );
        setIsFullyPaid(allInvoicesPaid);

        // Auto-select single partial invoice
        const partialInvoices = response.data.filter(
          (invoice: any) =>
            invoice.balance_amount > 0 &&
            (invoice.status === "partially paid" ||
              invoice.status === "partial"),
        );

        if (partialInvoices.length === 1) {
          // Auto-select the single partial invoice
          const singlePartialInvoice = partialInvoices[0];
          setSelectedInvoiceId(singlePartialInvoice.id);
          setPaymentNumber(singlePartialInvoice.invoice_number);
          setPaymentReceived(singlePartialInvoice.balance_amount.toString());
          setPaymentDiscount("0");
        } else {
          // Reset selection if multiple partial invoices or none
          setSelectedInvoiceId(null);
          setPaymentNumber("");
          setPaymentReceived("");
          setPaymentDiscount("0");
        }
      } else {
        toast.error(response.error || "Failed to fetch party invoices");
        setPartyInvoices([]);
        setIsFullyPaid(false);
      }
    } catch (error) {
      console.error("Error fetching party invoices:", error);
      toast.error("Failed to fetch party invoices");
      setPartyInvoices([]);
      setIsFullyPaid(false);
    } finally {
      setIsInvoicesLoading(false);
    }
  };

  const handlePartySelect = async (party: any) => {
    setSelectedParty(party);
    setIsAddingParty(false);
    setIsModalOpen(false);
    setSearchQuery("");

    // Reset all payment fields before fetching new data
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("cash");
    setPaymentReceived("");
    setPaymentDiscount("");
    setPaymentNumber("");

    await fetchPartyInvoices(party.name);

    // Pre-fill form with latest payment data for this party
    try {
      const response = await getPaymentInList(1, 1000, '', '', '');
      if (response.success && response.data) {
        const paymentData = response.data.data || response.data;
        const partyPayments = paymentData.filter(
          (payment: any) => payment.party_name === party.name,
        );

        if (partyPayments.length > 0) {
          // Get the most recent payment for this party
          const latestPayment = partyPayments.sort(
            (a: any, b: any) =>
              new Date(b.date).getTime() - new Date(a.date).getTime(),
          )[0];

          // Pre-fill the form fields
          if (latestPayment.date) {
            setPaymentDate(latestPayment.date);
          }
          if (latestPayment.payment_mode) {
            setPaymentMode(latestPayment.payment_mode.toLowerCase());
          }
          if (latestPayment.payment_number) {
            setPaymentNumber(latestPayment.payment_number);
          }
          // Don't pre-fill payment amount - let it be set by invoice selection
          // if (latestPayment.amount_received) {
          //   setPaymentReceived(latestPayment.amount_received.toString());
          // }
          // Don't pre-fill payment discount - let user enter from scratch
          // if (latestPayment.payment_discount || latestPayment.discount_total) {
          //   setPaymentDiscount(
          //     (
          //       latestPayment.payment_discount ||
          //       latestPayment.discount_total ||
          //       0
          //     ).toString(),
          //   );
          // }
        }
      }
    } catch (error) {
      console.error("Error fetching payment data for pre-fill:", error);
    }
  };

  // Load payment data for editing
  const loadPaymentForEdit = async (paymentId: string) => {
    try {
      setIsLoading(true);
      const response = await getPaymentById(paymentId);

      if (response.success && response.data) {
        const paymentData = response.data;

        // Set form fields with payment data
        setPaymentDate(
          paymentData.invoice_date || new Date().toISOString().split("T")[0],
        );
        setPaymentReceived(
          paymentData.amount_paid?.toString() ||
            paymentData.total_amount?.toString() ||
            "",
        );
        setPaymentDiscount(paymentData.payment_discount?.toString() || "");
        setPaymentNumber(paymentData.invoice_number || "");
        setPaymentMode("cash"); // Default to cash since payment_mode not available
        setNotes(paymentData.additional_notes?.notes || "");

        // Set party information
        if (paymentData.customer) {
          const partyData = {
            name: `${paymentData.customer.first_name} ${paymentData.customer.last_name}`,
            id: paymentData.customer.uuid,
            mobile: paymentData.customer.mobile || "",
            hasInvoices: true,
          };
          setSelectedParty(partyData);
          fetchPartyInvoices(partyData.name);
        }
      } else {
        toast.error(response.error || "Failed to load payment data");
        navigate("/payment-in");
      } 
    } catch (error) {
      console.error("Error loading payment for edit:", error);
      toast.error("Failed to load payment data");
      navigate("/payment-in");
    } finally {
      setIsLoading(false);
    }
  };

  // Check for pre-filled data from navigation state or edit mode
  useEffect(() => {
    // If in edit mode, load payment data by ID
    if (isEditMode && id) {
      loadPaymentForEdit(id);
      return;
    }

    // Otherwise, check for pre-filled data from navigation state
    try {
      let paymentData = location.state?.paymentData;

      // Only use session storage data if there's actual navigation state with paymentData
      // This prevents old data from being loaded when creating a fresh payment
      if (!paymentData) {
        // Don't automatically load from session storage for fresh payments
        // Only load if explicitly navigated with payment data
        return;
      }

      // Also check session storage as fallback
      if (!paymentData) {
        const storedData = sessionStorage.getItem("paymentData");
        if (storedData) {
          try {
            paymentData = JSON.parse(storedData);
            sessionStorage.removeItem("paymentData");
          } catch (error) {
            console.error("Error parsing stored payment data:", error);
          }
        }
      }

      if (paymentData) {
        if (paymentData.date) {
          const date = new Date(paymentData.date);
          setPaymentDate(date.toISOString().split("T")[0]);
        }
        if (paymentData.payment_mode) {
          setPaymentMode(paymentData.payment_mode.toLowerCase());
        }
        if (paymentData.notes) {
          setNotes(paymentData.notes);
        }
        if (paymentData.party_name) {
          const partyData = {
            name: paymentData.party_name,
            id: paymentData.id,
            mobile: "",
            hasInvoices: true,
          };
          setSelectedParty(partyData);
          fetchPartyInvoices(paymentData.party_name);
        }
        // Don't pre-fill payment amount - let it be set by invoice selection
        // if (paymentData.amount_received) {
        //   setPaymentReceived(paymentData.amount_received.toString());
        // }
        // Don't pre-fill payment discount - let user enter from scratch
        // if (paymentData.payment_discount || paymentData.discount_total) {
        //   setPaymentDiscount(
        //     (
        //       paymentData.payment_discount ||
        //       paymentData.discount_total ||
        //       0
        //     ).toString(),
        //   );
        // }
        // Pre-fill payment number
        if (paymentData.payment_number) {
          setPaymentNumber(paymentData.payment_number);
        }
      }
    } catch (error) {
      console.error("Error in payment data useEffect:", error);
    }
  }, [isEditMode, id, location.state]); // Run when edit mode changes or navigation state changes

  useEffect(() => {
    fetchParties();
  }, []);

  const filteredParties = parties.filter((party) => {
    if (!party || !party.hasInvoices) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      (party.name && party.name.toLowerCase().includes(searchLower)) ||
      (party.mobile && party.mobile.includes(searchQuery))
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
            ? "This payment is already settled and cannot be edited"
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
            title="Payment Date"
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
            title="Total Invoice Amount"
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
        accessorKey: "discount",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Discount"
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
        accessorKey: "amount_received",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Amount Received"
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
        accessorKey: "payment_status",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Status"
            column={column}
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const balanceAmount = row.original.balance_amount;
          const status = row.original.status;

          return (
            <TooltipCell row={row}>
              <div className="flex justify-center">
                {balanceAmount === 0 && status === "paid" ? (
                  <span className="px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded whitespace-nowrap">
                    paid
                  </span>
                ) : status === "partially paid" ? (
                  <span className="px-1.5 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-100 rounded whitespace-nowrap">
                    Partial
                  </span>
                ) : status === "unpaid" ? (
                  <span className="px-1.5 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded whitespace-nowrap">
                    Unpaid
                  </span>
                ) : null}
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
    [selectedParty],
  );

  // --- Party Search Dropdown (inline in left panel) --------
  const renderInlinePartySearch = () => (
    <div className="space-y-4" ref={dropdownRef}>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Search Party
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search parties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            autoFocus
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>

      {isPartiesLoading ? (
        <div className="text-center py-6">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Loading parties...</span>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg h-[250px] overflow-y-auto">
          {filteredParties.length > 0 ? (
            <>
              {filteredParties.map((party) => (
                <div
                  key={party.id}
                  onClick={() => handlePartySelect(party)}
                  className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors duration-150"
                >
                  <div className="font-medium text-sm text-slate-900">
                    {party.name}
                  </div>
                  {party.mobile && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {party.mobile}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="p-6 text-center">
              <div className="text-sm text-slate-500">
                No parties found
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Selected Party Card ────────
  const renderSelectedParty = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Party Name
        </label>
        <input
          type="text"
          value={selectedParty?.name || ""}
          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 text-sm"
          readOnly
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Pending Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm z-10">
              ₹
            </span>
            <input
              type="number"
              placeholder="0.00"
              value={paymentReceived}
              onChange={(e) => {
                const actualPaymentAmount = parseFloat(e.target.value) || 0;
                const selectedInvoice = partyInvoices.find(
                  (inv) => inv.id === selectedInvoiceId,
                );
                const balanceAmount = selectedInvoice?.balance_amount || 0;
                const currentDiscount = parseFloat(paymentDiscount) || 0;
                
                // Calculate the gross amount (actual payment + discount)
                const grossAmount = actualPaymentAmount + currentDiscount;
                
                // Only allow if gross amount doesn't exceed balance amount
                if (grossAmount <= balanceAmount + 0.01) {
                  setPaymentReceived(actualPaymentAmount.toString());
                  setPaymentError(""); // Clear error when user changes amount
                } else {
                  // Set to max allowed actual payment amount
                  const maxActualPayment = Math.max(0, balanceAmount - currentDiscount);
                  setPaymentReceived(maxActualPayment.toString());
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
                const selectedInvoice = partyInvoices.find(
                  (inv) => inv.id === selectedInvoiceId,
                );
                const balanceAmount = selectedInvoice?.balance_amount || 0;
                const currentActualPayment = parseFloat(paymentReceived) || 0;
                
                // Calculate max allowed actual payment amount
                const maxActualPayment = Math.max(0, balanceAmount - newDiscount);
                
                // Adjust actual payment if it exceeds new maximum allowed
                const adjustedActualPayment = Math.min(currentActualPayment, maxActualPayment);
                
                setPaymentDiscount(e.target.value);
                setPaymentReceived(adjustedActualPayment.toString());
                setPaymentError(""); // Clear error when user changes discount
              }}
              className="w-full h-10 pl-8 pr-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm disabled:bg-slate-50 disabled:text-slate-500 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
              readOnly={isFullyPaid}
            />
          </div>
        </div>
      </div>

      {/* Show payment breakdown */}
      {paymentReceived && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">
                Actual Payment Amount:
              </span>
              <span className="text-sm font-bold text-blue-900">
                ₹
                {(parseFloat(paymentReceived) || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">
                Payment Discount:
              </span>
              <span className="text-sm font-bold text-blue-900">
                -₹
                {(parseFloat(paymentDiscount) || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-blue-300">
              <span className="text-sm font-semibold text-blue-800">
                Total Applied to Invoice:
              </span>
              <span className="text-base font-bold text-blue-900">
                ₹
                {(
                  (parseFloat(paymentReceived) || 0) + 
                  (parseFloat(paymentDiscount) || 0)
                ).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Show invoice status message */}
      {selectedParty && partyInvoices.length > 0 && (
        <div
          className={`mt-4 p-3 rounded-lg ${
            partyInvoices.every((invoice) => invoice.balance_amount === 0)
              ? "bg-green-50 border border-green-200"
              : "bg-yellow-50 border border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                partyInvoices.every((invoice) => invoice.balance_amount === 0)
                  ? "bg-green-500"
                  : "bg-yellow-500"
              }`}
            ></div>
            <p
              className={`text-sm font-medium ${
                partyInvoices.every((invoice) => invoice.balance_amount === 0)
                  ? "text-green-700"
                  : "text-yellow-700"
              }`}
            >
              {partyInvoices.every((invoice) => invoice.balance_amount === 0)
                ? `All ${partyInvoices.length} invoices with this party are settled`
                : `${partyInvoices.filter((invoice) => invoice.balance_amount > 0).length} invoice with this party are pending`}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderEmptyParty = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center">
        <div className="mb-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mx-auto">
            <User className="h-8 w-8" />
          </div>
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          No Party Selected
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Select a party to record payment
        </p>
        <button
          onClick={() => setIsAddingParty(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-all duration-200"
        >
          <User className="h-4 w-4" />
          Select Party
        </button>
      </div>
    </div>
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackClick}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                  {isEditMode ? "Edit Payment" : "Record Payment"}
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {isEditMode
                    ? "Update payment information"
                    : "Create a new payment record"}
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedParty}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
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
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Party Selection Card ─────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600">
                    <User className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Party Information
                  </h2>
                </div>
                {selectedParty && (
                  <button
                    onClick={handlePartyDeselect}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              {isInvoicesLoading && selectedParty ? (
                <div className="flex items-center justify-center py-12">
                  <SpinnerDotted
                    size={30}
                    thickness={100}
                    speed={100}
                    color="#1B84FF"
                  />
                  <span className="text-sm text-slate-500">
                    Loading parties...
                  </span>
                </div>
              ) : (
                <>
                  {isAddingParty
                    ? renderInlinePartySearch()
                    : selectedParty
                      ? renderSelectedParty()
                      : renderEmptyParty()}
                </>
              )}
            </div>
          </div>

          {/* ── Payment Details Card ─────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-600">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Payment Details
                </h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Date / Mode / Number */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    disabled={isFullyPaid}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    disabled={isFullyPaid}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="netbanking">Net Banking</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Choose Invoice
                  </label>
                  {(() => {
                    const unpaidInvoices = partyInvoices.filter(
                      (invoice) =>
                        invoice.balance_amount > 0 ||
                        invoice.status === "partially paid",
                    );
                    const paidInvoices = partyInvoices.filter(
                      (invoice) =>
                        invoice.balance_amount === 0 &&
                        invoice.status === "paid",
                    );

                    // If there are unpaid invoices, show dropdown for selection
                    if (unpaidInvoices.length > 0) {
                      return (
                        <select
                          value={selectedInvoiceId || ""}
                          onChange={(e) => {
                            handleInvoiceSelection(e.target.value);
                            setInvoiceFieldError(false); // Clear error when user selects
                            setIsShaking(false); // Stop shaking when user selects
                          }}
                          className={`w-full h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-slate-50 disabled:text-slate-500 ${
                            invoiceFieldError
                              ? "border-red-500 bg-red-50"
                              : "border-slate-300"
                          } ${isShaking ? "animate-pulse" : ""}`}
                          disabled={
                            !selectedParty || partyInvoices.length === 0
                          }
                        >
                          <option value="">Choose an invoice...</option>
                          {unpaidInvoices.map((invoice) => (
                            <option key={invoice.id} value={invoice.id}>
                              {invoice.invoice_number}
                            </option>
                          ))}
                        </select>
                      );
                    }

                    // If only paid invoices exist, show read-only field with first paid invoice
                    if (paidInvoices.length > 0) {
                      return (
                        <input
                          type="text"
                          value={paidInvoices[0].invoice_number}
                          readOnly
                          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 text-sm"
                          placeholder="No unpaid invoices"
                        />
                      );
                    }

                    // No invoices at all
                    return (
                      <input
                        type="text"
                        value=""
                        readOnly
                        className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-400 text-sm"
                        placeholder="No invoices found"
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={
                    isFullyPaid && !notes.trim()
                      ? "No notes added for this payment..."
                      : notes
                  }
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter notes..."
                  className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  readOnly={isFullyPaid}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Invoice Table Section */}
        {selectedParty && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-600">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Related Invoices with this party
                </h2>
              </div>
            </div>

            <div className="p-4">
              {isInvoicesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <SpinnerDotted
                    size={30}
                    thickness={100}
                    speed={100}
                    color="#1B84FF"
                  />
                  <span className="text-sm text-slate-500">
                    Loading invoices...
                  </span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="">
                    <DataGrid
                      key="payment-invoice-grid"
                      columns={invoiceColumns}
                      data={partyInvoices}
                      rowSelection
                      getRowId={(row) => row.id.toString()}
                      pagination={{ size: 5 }}
                      onRowClick={(row) => {
                        if (
                          row.original.balance_amount !== 0 &&
                          row.original.balance_amount !== "0"
                        ) {
                          navigate(`/invoices/${row.original.id}`);
                        }
                      }}
                      layout={{
                        classes: {
                          table:
                            '[&_tr:hover]:bg-slate-50 [&_td]:py-3 [&_th]:py-3 [&_td]:text-center [&_th]:text-center w-full [&_tr[data-settled="true"]]:cursor-not-allowed [&_tr[data-settled="true"]]:hover:bg-gray-100',
                        },
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Party Selection Modal ──────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Select Party
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Search Party
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search parties..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {isPartiesLoading ? (
                <div className="text-center py-8">
                  <SpinnerDotted
                    size={30}
                    thickness={100}
                    speed={100}
                    color="#1B84FF"
                  />
                  <p className="ml-4 text-sm font-medium text-slate-600">
                    Loading details...
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                  {filteredParties.length > 0 ? (
                    filteredParties.map((party) => (
                      <div
                        key={party.id}
                        onClick={() => handlePartySelect(party)}
                        className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors duration-150"
                      >
                        <div className="font-medium text-sm text-slate-900">
                          {party.name}
                        </div>
                        {party.mobile && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {party.mobile}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No parties found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePaymentIn;
