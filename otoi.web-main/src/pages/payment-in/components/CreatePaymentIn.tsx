import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
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
import { checkCreditNoteExistsForInvoice } from "../../creditIn/service/creditIn.service";
import { resolveImageUrl } from "@/utils/imageUtils";
import { SpinnerDotted } from "spinners-react";
import { toast } from "sonner";
import { DataGrid, DataGridColumnHeader } from "@/components";
import { ColumnDef } from "@tanstack/react-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [creditNotes, setCreditNotes] = useState<any[]>([]);

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
  const handleInvoiceSelection = async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const selectedInvoice = partyInvoices.find((inv) => inv.id === invoiceId);
    if (selectedInvoice) {
      setPaymentNumber(selectedInvoice.invoice_number);
      
      // Fetch credit notes for this invoice
      await fetchCreditNotesForInvoice(invoiceId);
      
      // Use the corrected pending amount calculation
      const pendingAmount = getPendingAmount(selectedInvoice);
      
      // Only set payment received if invoice has pending balance
      if (
        pendingAmount > 0 ||
        selectedInvoice.status === "partially paid"
      ) {
        setPaymentReceived(pendingAmount.toString());
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
    const pendingAmount = getPendingAmount(selectedInvoice);
    
    if (totalAppliedAmount > pendingAmount + 0.01) {
      toast.error("Total payment cannot exceed pending amount (after credit notes)");
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

  // Fetch credit notes for selected invoice
  const fetchCreditNotesForInvoice = async (invoiceId: string) => {
    try {
      const response = await checkCreditNoteExistsForInvoice(invoiceId);
      if (response.success && response.data) {
        setCreditNotes(response.data.creditNotes || []);
      }
    } catch (error) {
      console.error("Error fetching credit notes:", error);
      setCreditNotes([]);
    }
  };

  const getTotalCreditNoteAmount = () => {
    return creditNotes.reduce((total, creditNote) => total + (creditNote.total_amount || 0), 0);
  };

  const getPendingAmount = (invoice: any) => {
    if (!invoice) return 0;
    // Use backend's corrected balance_due which now includes credit notes
    if (invoice.balance_due !== undefined) {
      return Math.max(0, invoice.balance_due);
    }
    // Fallback calculation for backward compatibility
    const creditNotesTotal = getTotalCreditNoteAmount();
    const manualBalance = Math.max(0, invoice.total_amount - creditNotesTotal - (invoice.amount_paid || 0) - (invoice.payment_discount || 0));
    return manualBalance;
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
          
          // Fetch credit notes for this invoice
          await fetchCreditNotesForInvoice(singlePartialInvoice.id);
          
          // Use the corrected pending amount calculation
          const pendingAmount = getPendingAmount(singlePartialInvoice);
          setPaymentReceived(pendingAmount.toString());
          setPaymentDiscount("0");
        } else {
          // Reset selection if multiple partial invoices or none
          setSelectedInvoiceId(null);
          setPaymentNumber("");
          setPaymentReceived("");
          setPaymentDiscount("0");
          setCreditNotes([]);
        }
      } else {
        toast.error(response.error || "Failed to fetch party invoices");
        setPartyInvoices([]);
        setIsFullyPaid(false);
        setCreditNotes([]);
      }
    } catch (error) {
      console.error("Error fetching party invoices:", error);
      toast.error("Failed to fetch party invoices");
      setPartyInvoices([]);
      setIsFullyPaid(false);
      setCreditNotes([]);
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

  // --- Party Dropdown (inline in left panel) --------
  const renderInlinePartySearch = () => (
    <div className="space-y-4" ref={dropdownRef}>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select Party
        </label>
        <Select value={selectedParty?.id || ""} onValueChange={(value) => {
          const party = parties.find(p => p.id === value);
          if (party) {
            handlePartySelect(party);
          }
        }}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a party..." />
          </SelectTrigger>
          <SelectContent>
            {isPartiesLoading ? (
              <div className="p-4 text-center">
                <div className="flex items-center space-y-2">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                  <span className="text-sm text-slate-500">Loading parties...</span>
                </div>
              </div>
            ) : parties.length > 0 ? (
              parties.map((party) => (
                <SelectItem key={party.id} value={party.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{party.name}</span>
                    {party.mobile && <span className="text-xs text-slate-500">{party.mobile}</span>}
                  </div>
                </SelectItem>
              ))
            ) : (
              <div className="p-4 text-center text-slate-500">
                <span className="text-sm font-medium">No parties available</span>
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
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
            {getTotalCreditNoteAmount() > 0 && (
              <span className="text-xs text-green-600 ml-2">(after credit notes)</span>
            )}
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
                const pendingAmount = getPendingAmount(selectedInvoice);
                const currentDiscount = parseFloat(paymentDiscount) || 0;

                // Calculate the gross amount (actual payment + discount)
                const grossAmount = actualPaymentAmount + currentDiscount;
                
                // Only allow if gross amount doesn't exceed pending amount
                if (grossAmount <= pendingAmount + 0.01) {
                  setPaymentReceived(actualPaymentAmount.toString());
                  setPaymentError(""); // Clear error when user changes amount
                } else {
                  // Set to max allowed actual payment amount
                  const maxActualPayment = Math.max(0, pendingAmount - currentDiscount);
                  setPaymentReceived(maxActualPayment.toString());
                  setPaymentError(`Total payment cannot exceed pending amount (after credit notes)`);
                }
              }}
              className={`w-full h-10 pl-8 pr-3 border rounded-lg focus:outline-none focus:ring-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${paymentError
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
                const pendingAmount = getPendingAmount(selectedInvoice);
                const currentActualPayment = parseFloat(paymentReceived) || 0;

                // Calculate max allowed actual payment amount
                const maxActualPayment = Math.max(0, pendingAmount - newDiscount);
                
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
            {getTotalCreditNoteAmount() > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700">
                  Credit Note(s) Applied:
                </span>
                <span className="text-sm font-bold text-green-900">
                  -₹{getTotalCreditNoteAmount().toLocaleString("en-IN")}
                </span>
              </div>
            )}
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
          className={`mt-4 p-3 rounded-lg ${partyInvoices.every((invoice) => invoice.balance_amount === 0)
            ? "bg-green-50 border border-green-200"
            : "bg-yellow-50 border border-yellow-200"
            }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${partyInvoices.every((invoice) => invoice.balance_amount === 0)
                ? "bg-green-500"
                : "bg-yellow-500"
                }`}
            ></div>
            <p
              className={`text-sm font-medium ${partyInvoices.every((invoice) => invoice.balance_amount === 0)
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
    <div className="flex flex-col items-center justify-center py-8 sm:py-12">
      <div className="text-center w-full max-w-sm px-4">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100 text-blue-600 mx-auto">
            <User className="h-6 w-6 sm:h-8 sm:w-8" />
          </div>
        </div>
        <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">
          No Party Selected
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
          Select a party to record payment
        </p>
        <PartySelectionDropdown />
      </div>
    </div>
  );

  const PartySelectionDropdown = () => (
    <div className="space-y-2">
      <Select value={selectedParty?.id || ""} onValueChange={(value) => {
        const party = parties.find(p => p.id === value);
        if (party) {
          handlePartySelect(party);
        }
      }}>
        <SelectTrigger className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all duration-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <SelectValue placeholder="Select a party..." className="text-sm font-medium text-gray-700" />
          </div>
        </SelectTrigger>
        <SelectContent className="w-[var(--radix-select-trigger-width)] max-h-[280px] bg-white border border-gray-200 rounded-xl shadow-xl">
          {isPartiesLoading ? (
            <div className="p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                <SpinnerDotted size={24} className="text-blue-600" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-600">Loading parties...</p>
            </div>
          ) : filteredParties.length > 0 ? (
            <div className="py-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Available Parties ({filteredParties.length})
              </div>
              {filteredParties.map((party) => (
                <SelectItem
                  key={party.id}
                  value={party.id}
                  className="mx-2 my-1 px-3 py-3 rounded-lg cursor-pointer hover:bg-blue-50 focus:bg-blue-50 focus:text-blue-700 data-[state=checked]:bg-blue-100 data-[state=checked]:text-blue-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 text-gray-600 font-semibold text-sm">
                      {(party.name || "P")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {party.name || "Unnamed Party"}
                      </div>
                      {party.mobile && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          {party.mobile}
                        </div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <User className="h-6 w-6 text-gray-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900">No parties found</p>
              <p className="mt-1 text-xs text-gray-500">Try adjusting your search</p>
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );

  // ─── Party Selection Modal ────────
  const PartySelectionModal = () => (
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
              placeholder="Search Customers by name or mobile..."
              className="pl-10 h-10 rounded-md border-gray-300 focus-visible:ring-1 focus-visible:ring-gray-400 focus-visible:ring-offset-0"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
              }}
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

          {/* Customer List */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
            <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {isPartiesLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <SpinnerDotted size={20} />
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-gray-900">
                    Loading Customers...
                  </h3>
                </div>
              ) : filteredParties.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-gray-900">
                    No Customer found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search criteria.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredParties.map((party) => (
                    <li
                      key={party.id}
                      className={`group relative p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedParty?.id === party.id
                          ? "bg-gray-100"
                          : ""
                      }`}
                      onClick={() => handlePartySelect(party)}
                    >
                      <div className="flex items-center">
                        <div
                          className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${
                            selectedParty?.id === party.id
                              ? "bg-green-100"
                              : "bg-gray-100"
                          }`}
                        >
                          <span
                            className={`font-medium text-sm ${
                              selectedParty?.id === party.id
                                ? "text-green-700"
                                : "text-gray-600"
                            }`}
                          >
                            {(party.name || "Unknown")
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                            {party.name || "Unknown Customer"}
                          </div>
                          {party.mobile && (
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
                              {party.mobile}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleBackClick}
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-semibold text-slate-900 tracking-tight truncate">
                  {isEditMode ? "Edit Payment" : "Record Payment In"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                  {isEditMode
                    ? "Update payment information"
                    : "Create a new payment record"}
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedParty}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          {/* ── Party Selection Card ─────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 text-blue-600">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                    Party Information
                  </h2>
                </div>
                {selectedParty && (
                  <button
                    onClick={handlePartyDeselect}
                    className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {isInvoicesLoading && selectedParty ? (
                <div className="flex items-center justify-center py-12">
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
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-100 text-green-600">
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
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="netbanking">Net Banking</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
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
                            setInvoiceFieldError(false);
                            setIsShaking(false);
                          }}
                          className={`w-full h-9 sm:h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm ${invoiceFieldError
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
                          className="w-full h-9 sm:h-10 px-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 text-xs sm:text-sm"
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
                      ? "No notes added for this payment..."
                      : notes
                  }
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter notes..."
                  className="w-full h-20 sm:h-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-xs sm:text-sm disabled:bg-slate-50"
                  readOnly={isFullyPaid}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Invoice Table Section */}
        {selectedParty && (
          <div className="mt-6 sm:mt-8 bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 bg-slate-50/50">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-100 text-purple-600">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Invoices for this Party
                </h2>
              </div>
            </div>

            <div className="p-3 sm:p-4">
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
                  {/* Desktop Table View (md and up) */}
                  <div className="hidden md:block overflow-x-auto">
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

                  {/* Mobile Card View (below md) */}
                  <div className="block md:hidden divide-y divide-slate-100">
                    {partyInvoices.length > 0 ? (
                      partyInvoices.map((invoice) => {
                        const isSettled =
                          invoice.balance_amount === 0 ||
                          invoice.balance_amount === "0";
                        const isSelected = selectedInvoiceId === invoice.id;

                        return (
                          <div
                            key={invoice.id}
                            className={`p-4 transition-colors cursor-not-allowed ${isSelected
                              ? "bg-blue-50/50 border-l-4 border-blue-500"
                              : "bg-white hover:bg-slate-50 active:bg-slate-100"
                              } ${isSettled ? "opacity-75" : ""}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-slate-900">
                                  {invoice.invoice_number}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(
                                    invoice.date,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                {invoice.balance_amount === 0 &&
                                  invoice.status === "paid" ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 rounded">
                                    paid
                                  </span>
                                ) : (invoice.status === "partially paid" || invoice.status === "partial") ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 rounded">
                                    Partial
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 rounded">
                                    Unpaid
                                  </span>
                                )}
                                <div className="text-right">
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Balance
                                  </p>
                                  <p className="text-sm font-bold text-blue-600">
                                    ₹
                                    {(
                                      parseFloat(invoice.balance_amount) || 0
                                    ).toLocaleString("en-IN")}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                  Total Amount
                                </p>
                                <p className="text-sm font-semibold text-slate-700">
                                  ₹
                                  {(
                                    parseFloat(invoice.invoice_amount) || 0
                                  ).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                  Applied
                                </p>
                                <p className="text-sm font-semibold text-slate-700">
                                  ₹
                                  {(
                                    parseFloat(invoice.amount_received) || 0
                                  ).toLocaleString("en-IN")}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center bg-slate-50/50">
                        <p className="text-sm text-slate-500">
                          No invoices found for this party
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Party Selection Modal ──────────────────────────────────────────── */}
      <PartySelectionModal />
    </div>
  );
};

export default CreatePaymentIn;                    