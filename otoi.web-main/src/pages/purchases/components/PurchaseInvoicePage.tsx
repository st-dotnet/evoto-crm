import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
    DataGrid,
    DataGridColumnHeader,
    DataGridRowSelect,
    DataGridRowSelectAll,
} from "@/components";
import { Button } from "@/components/ui/button";
import {
    Plus,
    Calendar,
    Filter,
    Check,
    Circle,
    ChevronDown,
    MoreVertical,
    Eye,
    Edit,
    Trash2,
    CreditCard,
    FileText,
    Info,
    AlertCircle,
    FileMinus,
    User,
    Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { listPurchaseInvoices, deletePurchaseInvoice, recordPurchaseInvoicePayment, getPurchaseInvoicePartyNames, getPurchaseInvoiceNumbers, getPurchaseInvoiceStatuses } from "../services/purchaseInvoice.services";
import { checkDebitNoteExistsForInvoice } from "../../debitNote/service/debitNote.service";
import { toast } from "sonner";
import { TDataGridRequestParams } from "@/components";
import { SpinnerDotted } from 'spinners-react';
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getAllVendorsDropdown } from "../services/purchaseOrder.services";

interface PurchaseInvoice {
    id: string;
    uuid: string;
    date: string;
    invoice_number: string;
    vendor_id: string | null;
    vendor_name: string;
    vendor?: {
        uuid: string;
        vendor_name: string;
        company_name?: string;
        mobile: string;
        email?: string;
    };
    amount: number;
    amount_paid: number;
    balance_due: number;
    payment_status: string;
}

const PurchaseInvoicePage = () => {
    const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'vendor_name' | 'invoice_number'>('vendor_name');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [allVendorNames, setAllVendorNames] = useState<string[]>([]);
    const [allInvoiceNumbers, setAllInvoiceNumbers] = useState<string[]>([]);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [isDropdownLoading, setIsDropdownLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>('last_365');

    // Record Payment State
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
    const [paymentForm, setPaymentForm] = useState({
        amount: 0,
        discount: 0,
        date: new Date(),
        mode: "cash",
        notes: ""
    });
    const [isRecordingPayment, setIsRecordingPayment] = useState(false);

    const navigate = useNavigate();

    // Refresh when status changes (search changes trigger refreshKey in their handlers)
    useEffect(() => {
        setRefreshKey(prev => prev + 1);
    }, [selectedStatus, selectedDateFilter]);

    // Fetch vendor names and invoice numbers for autocomplete suggestions
    const fetchAutocompleteData = useCallback(async () => {
        setIsDropdownLoading(true);
        try {
            const [vendorResponse, invoiceNumberResponse, statusResponse] = await Promise.all([
                getPurchaseInvoicePartyNames(),
                getPurchaseInvoiceNumbers(),
                getPurchaseInvoiceStatuses()
            ]);
            
            // Handle vendor names (party names) - should be array of {uuid, name} objects
            if (vendorResponse.success && vendorResponse.data) {
                const vendorNames = Array.isArray(vendorResponse.data)
                    ? vendorResponse.data.filter((item: any) => item && item.name && typeof item.name === 'string')
                        .map((item: any) => item.name)
                        .sort()
                    : [];
                setAllVendorNames(vendorNames);
            }
            
            // Handle invoice numbers - should be simple array of strings
            if (invoiceNumberResponse.success && invoiceNumberResponse.data) {
                const invoiceNumbers = Array.isArray(invoiceNumberResponse.data)
                    ? invoiceNumberResponse.data.filter((item: any) => item && typeof item === 'string')
                        .sort()
                    : [];
                setAllInvoiceNumbers(invoiceNumbers);
            }
        } catch (error) {
            console.error('Error fetching autocomplete data:', error);
            setAllVendorNames([]);
            setAllInvoiceNumbers([]);
        } finally {
            setIsDropdownLoading(false);
        }
    }, [refreshKey]);

    useEffect(() => {
        fetchAutocompleteData();
    }, [fetchAutocompleteData]);

    // Handle search type change
    const handleSearchTypeChange = (type: 'vendor_name' | 'invoice_number') => {
        setSearchType(type);
        setShowSuggestions(false);
        setSearchTerm('');
        setFilteredSuggestions(type === 'vendor_name' ? allVendorNames : allInvoiceNumbers);
        setRefreshKey(prev => prev + 1);
    };

    // Filter suggestions based on search term
    useEffect(() => {
        const source = searchType === 'vendor_name' ? allVendorNames : allInvoiceNumbers;
        if (searchTerm) {
            setFilteredSuggestions(source.filter(item =>
                item.toLowerCase().includes(searchTerm.toLowerCase())
            ));
        } else {
            setFilteredSuggestions(source);
        }
    }, [searchTerm, searchType, allVendorNames, allInvoiceNumbers]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Refresh when debounce changes
    useEffect(() => {
        setRefreshKey(prev => prev + 1);
    }, [debouncedSearchTerm]);

    // Listen for debit note updates to refresh invoice data
    useEffect(() => {
        const handleDebitNoteUpdate = (event: CustomEvent) => {
            // Refresh the invoice data to show updated status
            setRefreshKey(prev => prev + 1);
        };

        const handleInvoiceStatusUpdate = (event: CustomEvent) => {
            // Refresh the invoice data to show updated status and balance
            setRefreshKey(prev => prev + 1);
        };

        window.addEventListener('debitNoteDeleted', handleDebitNoteUpdate as EventListener);
        window.addEventListener('debitNoteCreated', handleDebitNoteUpdate as EventListener);
        window.addEventListener('debitNoteAccepted', handleDebitNoteUpdate as EventListener);
        window.addEventListener('invoiceStatusUpdated', handleInvoiceStatusUpdate as EventListener);
        window.addEventListener('paymentRecorded', handleDebitNoteUpdate as EventListener);

        return () => {
            window.removeEventListener('debitNoteDeleted', handleDebitNoteUpdate as EventListener);
            window.removeEventListener('debitNoteCreated', handleDebitNoteUpdate as EventListener);
            window.removeEventListener('debitNoteAccepted', handleDebitNoteUpdate as EventListener);
            window.removeEventListener('invoiceStatusUpdated', handleInvoiceStatusUpdate as EventListener);
            window.removeEventListener('paymentRecorded', handleDebitNoteUpdate as EventListener);
        };
    }, []);

    const fetchInvoices = useCallback(async (params: TDataGridRequestParams) => {
        setIsLoading(true);
        try {
            const response = await listPurchaseInvoices({
                page: params.pageIndex + 1,
                per_page: params.pageSize,
                search: debouncedSearchTerm,
                vendor_name: searchType === 'vendor_name' ? debouncedSearchTerm : '',
                invoice_number: searchType === 'invoice_number' ? debouncedSearchTerm : '',
                payment_status: selectedStatus === 'all' ? '' : selectedStatus,
                date_filter: selectedDateFilter
            });

            if (response.success && response.data) {
                const invoicesData = response.data.data || [];
                
                // Fetch debit notes for all invoices to recalculate balance (backend still returns incorrect values)
                let debitNotes: any[] = [];
                try {
                    const { getDebitNotes } = await import("../../debitNote/service/debitNote.service");
                    const debitNotesResponse = await getDebitNotes({ per_page: 1000 });
                    const debitNotesData = debitNotesResponse.success && debitNotesResponse.data?.data ? debitNotesResponse.data.data : [];
                    debitNotes = Array.isArray(debitNotesData) ? debitNotesData : [];
                } catch (error) {
                    console.warn('Failed to fetch debit notes, proceeding without balance adjustment:', error);
                    // Continue without debit notes if fetch fails
                }
                
                const transformed = invoicesData.map((item: any) => {
                    // Calculate total debit note amount for this invoice
                    const debitNoteTotal = debitNotes
                        .filter((dn: any) => dn.invoice_id === item.uuid || dn.linked_invoice_id === item.uuid)
                        .reduce((sum: number, dn: any) => sum + (dn.total_amount || 0), 0);
                    
                    // Recalculate balance due: backend balance - debit notes applied
                    const backendBalance = item.balance_due || 0;
                    const adjustedBalance = Math.max(0, backendBalance - debitNoteTotal);
                    
                    return {
                        id: item.uuid,
                        date: item.invoice_date || item.created_at,
                        invoice_number: item.invoice_number,
                        vendor_name: item.vendor_name || 'N/A',
                        amount: item.total_amount || 0,
                        amount_paid: item.amount_paid || 0,
                        balance_due: adjustedBalance,
                        payment_status: adjustedBalance === 0 ? 'paid' : (item.payment_status || 'unpaid'),
                    };
                });
                setInvoices(transformed);
                return {
                    data: transformed,
                    totalCount: response.data.pagination?.total || transformed.length,
                };
            } else {
                toast.error(response.error || 'Failed to fetch purchase invoices');
                return { data: [], totalCount: 0 };
            }
        } catch (error) {
            console.error('Error fetching purchase invoices:', error);
            toast.error('Failed to fetch purchase invoices');
            return { data: [], totalCount: 0 };
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchTerm, searchType, selectedStatus, selectedDateFilter]);


    const handleDelete = async (id: string) => {
        // Prevent any pending navigation
        window.event?.stopPropagation();
        window.event?.preventDefault();

        // Check if debit notes exist for this purchase invoice before allowing delete
        try {
            const response = await checkDebitNoteExistsForInvoice(id);
            if (response.success && response.data && response.data.hasDebitNote) {
                const debitNotes = response.data.debitNotes || [];
                const debitNoteNumbers = debitNotes.map((dn: any) => dn.debitNoteNo).join(', ');
                toast.error(`Cannot delete purchase invoice. A debit note is linked to this invoice. Please unlink it first.`);
                return;
            }
        } catch (error) {
            console.error('Error checking debit notes:', error);
            // Still allow delete if check fails, but show warning
            toast.warning('Unable to verify debit note status. Proceed with caution.');
        }

        setInvoiceToDelete(id);
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (!invoiceToDelete || isDeleting) return;
        setIsDeleting(true);
        const response = await deletePurchaseInvoice(invoiceToDelete);
        if (response.success) {
            toast.success('Purchase Invoice deleted successfully');
            setRefreshKey(prev => prev + 1);
        } else {
            toast.error(response.error || 'Failed to delete purchase invoice');
        }
        setShowDeleteDialog(false);
        setInvoiceToDelete(null);
        setIsDeleting(false);
    };

    const handleRecordPayment = (invoice: PurchaseInvoice) => {
        setSelectedInvoice(invoice);
        setPaymentForm({
            amount: invoice.balance_due,
            discount: 0,
            date: new Date(),
            mode: "cash",
            notes: ""
        });
        setIsPaymentOpen(true);
    };

    const handlePaymentSubmit = async () => {
        if (!selectedInvoice || isRecordingPayment) return;
        if (paymentForm.amount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }
        if (paymentForm.amount > selectedInvoice.balance_due + 0.01) {
            toast.error("Amount cannot exceed balance due");
            return;
        }

        setIsRecordingPayment(true);
        const res = await recordPurchaseInvoicePayment(selectedInvoice.id, {
            amount: paymentForm.amount,
            payment_mode: paymentForm.mode,
            notes: paymentForm.notes,
            discount: paymentForm.discount
        });

        if (res.success) {
            toast.success("Payment recorded successfully");
            setIsPaymentOpen(false);
            setRefreshKey(prev => prev + 1);
        } else {
            toast.error(res.error || "Failed to record payment");
        }
        setIsRecordingPayment(false);
    };

    const getPaymentStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            paid: 'bg-green-100 text-green-800',
            partial: 'bg-yellow-100 text-yellow-800',
            unpaid: 'bg-red-100 text-red-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };

    const handleCreateDebitNote = async (invoice: PurchaseInvoice) => {
        // Check if debit note already exists for this invoice
        try {
            const response = await checkDebitNoteExistsForInvoice(invoice.id);
            if (response.success && response.data && response.data.hasDebitNote) {
                const debitNotes = response.data.debitNotes || [];
                const debitNoteNumbers = debitNotes.map((dn: any) => dn.debitNoteNo).join(', ');
                toast.error(`A debit note already exists for this invoice ${debitNoteNumbers}`);
                return;
            }
        } catch (error) {
            console.error('Error checking debit notes:', error);
            toast.warning('Unable to verify debit note status. Proceeding with creation.');
        }

        // Navigate to debit note creation page with prefilled data
        const vendorId = invoice.vendor?.uuid || invoice.vendor_id;
        const url = vendorId 
            ? `/debit-note/create?invoice_id=${invoice.id}&vendor_id=${vendorId}`
            : `/debit-note/create?invoice_id=${invoice.id}`;
        navigate(url);
    };

    const columns = useMemo<ColumnDef<PurchaseInvoice>[]>(() => [
        {
            id: "select",
            header: () => <DataGridRowSelectAll />,
            cell: ({ row }) => <DataGridRowSelect row={row} />,
            enableSorting: false,
            enableHiding: false,
            meta: {
                headerClassName: "w-10",
            }
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataGridColumnHeader title="Date" column={column} className="justify-start" />
            ),
            cell: (info) => {
                const value = info.getValue() as string;
                if (!value || value === 'N/A') return <div className="text-sm text-gray-400 text-center">N/A</div>;
                return (
                    <div className="text-sm text-gray-900 text-center">
                        {new Date(value).toLocaleDateString()}
                    </div>
                );
            },
            meta: {
                headerClassName: "min-w-[100px]",
            }
        },
        {
            accessorKey: "invoice_number",
            header: ({ column }) => (
                <DataGridColumnHeader title="Invoice #" column={column} className="justify-start" />
            ),
            cell: (info) => (
                <div className="text-sm font-medium text-primary hover:underline">
                    {info.getValue() as string}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[120px]",
            }
        },
        {
            accessorKey: "vendor_name",
            header: ({ column }) => (
                <DataGridColumnHeader title="Vendor" column={column} className="justify-start" />
            ),
            cell: (info) => <div className="text-sm text-gray-900">{info.getValue() as string}</div>,
            meta: {
                headerClassName: "min-w-[180px]",
            }
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataGridColumnHeader title="Amount" column={column} className="justify-end" />
            ),
            cell: (info) => (
                <div className="text-sm font-medium text-right">
                    ₹{(info.getValue() as number)?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[100px] justify-end",
                cellClassName: "text-right",
            }
        },
        {
            accessorKey: "balance_due",
            header: ({ column }) => (
                <DataGridColumnHeader title="Balance" column={column} className="justify-end" />
            ),
            cell: (info) => (
                <div className={`text-sm font-medium text-right ${info.getValue() as number > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{(info.getValue() as number)?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[100px] justify-end",
                cellClassName: "text-right",
            }
        },
        {
            accessorKey: "payment_status",
            header: ({ column }) => (
                <DataGridColumnHeader title="Status" column={column} className="justify-center" />
            ),
            cell: (info) => {
                const status = info.getValue() as string;
                return (
                    <div className="flex items-center justify-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusBadge(status)}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </div>
                );
            },
            meta: {
                headerClassName: "min-w-[100px] justify-center",
            }
        },
        {
            id: "actions",
            header: "Actions",
            enableSorting: false,
            meta: {
                headerClassName: "w-20 text-center",
                cellClassName: "text-gray-800 font-medium pointer-events-auto",
                disableRowClick: true,
            },
            cell: ({ row }) => {
                return (
                    <div className="flex justify-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    data-dropdown-trigger="true"
                                    className="flex items-center justify-center text-primary hover:text-primary-active transition-colors"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => { navigate(`/purchases/purchase-invoices/${row.original.id}`); }}>
                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { navigate(`/purchases/purchase-invoices/${row.original.id}/edit`); }}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { handleCreateDebitNote(row.original); }}>
                                    <FileMinus className="mr-2 h-4 w-4" /> Create Debit Note
                                </DropdownMenuItem>
                                {row.original.payment_status !== 'paid' && (
                                    <DropdownMenuItem onSelect={() => { handleRecordPayment(row.original); }}>
                                        <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-red-600" onSelect={() => {
                                    handleDelete(row.original.id);
                                }}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ], [navigate]);

    const MobileView = ({
        onRecordPayment,
        onDetails,
        onEdit,
        onCreateDebitNote,
        onDelete,
    }: {
        onRecordPayment: (invoice: PurchaseInvoice) => void;
        onDetails: (id: string) => void;
        onEdit: (id: string) => void;
        onCreateDebitNote: (invoice: PurchaseInvoice) => void;
        onDelete: (id: string) => void;
    }) => {
        return (
            <div className="flex flex-col md:hidden border-t border-gray-100">
                {invoices.map((invoice) => (
                    <div
                        key={invoice.id}
                        className="flex justify-between items-center py-4 px-5 border-b border-gray-100 hover:bg-gray-50/50 transition-all active:bg-gray-50"
                    >
                        <div
                            className="flex flex-col cursor-pointer grow pr-4"
                            onClick={() => onDetails(invoice.id)}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900 text-sm">
                                    {invoice.invoice_number}
                                </span>
                                <span
                                    className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${getPaymentStatusBadge(invoice.payment_status)}`}
                                >
                                    {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                                </span>
                            </div>
                            <span className="text-sm font-medium text-gray-700 mb-0.5">
                                {invoice.vendor_name}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(invoice.date).toLocaleDateString("en-IN")}
                                </span>
                            </div>
                            <div className="mt-2 text-sm">
                                <span className="font-medium text-gray-900">
                                    ₹{invoice.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </span>
                                {invoice.balance_due > 0 && (
                                    <span className="ml-2 font-medium text-red-600">
                                        Due: ₹{invoice.balance_due?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreVertical className="h-4 w-4 text-gray-500" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => onDetails(invoice.id)}>
                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => onEdit(invoice.id)}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => onCreateDebitNote(invoice)}>
                                        <FileMinus className="mr-2 h-4 w-4" /> Create Debit Note
                                    </DropdownMenuItem>
                                    {invoice.payment_status !== 'paid' && (
                                        <DropdownMenuItem onSelect={() => onRecordPayment(invoice)}>
                                            <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        className="text-red-600"
                                        onSelect={() => onDelete(invoice.id)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="w-full px-4 py-6 sm:p-6 relative overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">Purchase Invoices</h1>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Floating Glass Status Filter */}
                    <div className="relative bg-gray-50/50 backdrop-blur-md p-1 rounded-xl border border-gray-200/80 shadow-sm flex items-center min-w-fit">
                        {/* Integrated Label */}
                        <div className="flex items-center gap-2 px-3 border-r border-gray-200/50 mr-1">
                            <Filter className="h-3.5 w-3.5 text-gray-900" />
                            <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">Filters</span>
                        </div>

                        <div className="relative flex items-center">
                            {/* Animated Slider Background with Glow */}
                            <div
                                className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${
                                    selectedStatus === 'all' ? 'bg-white border-gray-200 shadow-gray-200/50' :
                                    selectedStatus === 'paid' ? 'bg-green-50 border-green-200 shadow-green-200/50' :
                                    selectedStatus === 'unpaid' ? 'bg-red-50 border-red-200 shadow-red-200/50' :
                                    'bg-yellow-50 border-yellow-200 shadow-yellow-200/50'
                                }`}
                                style={{
                                    width: '72px',
                                    transform: `translateX(${selectedStatus === 'all' ? '0px' :
                                        selectedStatus === 'paid' ? '72px' :
                                            selectedStatus === 'unpaid' ? '144px' : '216px'
                                        })`
                                }}
                            />

                            {/* Status Buttons */}
                            <button
                                onClick={() => { setSelectedStatus('all'); setRefreshKey(prev => prev + 1); }}
                                className={`relative z-10 w-[72px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'all' ? 'text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('paid'); setRefreshKey(prev => prev + 1); }}
                                className={`relative z-10 w-[72px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'paid' ? 'text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Paid
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('unpaid'); setRefreshKey(prev => prev + 1); }}
                                className={`relative z-10 w-[72px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'unpaid' ? 'text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Unpaid
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('partial'); setRefreshKey(prev => prev + 1); }}
                                className={`relative z-10 w-[72px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'partial' ? 'text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Partial
                            </button>
                        </div>
                    </div>

                    {/* Date Filter Dropdown */}
                    <div className="w-full sm:w-auto">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 w-full md:w-fit px-4 gap-2 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/80 shadow-sm text-gray-900 font-bold hover:bg-gray-100/50 transition-all"
                                >
                                    <Calendar className="h-4 w-4 text-gray-900" />
                                    <span className="truncate">
                                        {selectedDateFilter === 'today' && 'Today'}
                                        {selectedDateFilter === 'this_week' && 'This Week'}
                                        {selectedDateFilter === 'last_week' && 'Last Week'}
                                        {selectedDateFilter === 'this_month' && 'This Month'}
                                        {selectedDateFilter === 'last_month' && 'Last Month'}
                                        {selectedDateFilter === 'last_365' && 'Last 365 Days'}
                                        {selectedDateFilter === 'all' && 'All Time'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px]">
                                <DropdownMenuItem onClick={() => setSelectedDateFilter('today')}>Today</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSelectedDateFilter('this_week')}>This Week</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSelectedDateFilter('last_week')}>Last Week</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSelectedDateFilter('this_month')}>This Month</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSelectedDateFilter('last_month')}>Last Month</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSelectedDateFilter('last_365')}>Last 365 Days</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSelectedDateFilter('all')}>All Time</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex-grow md:block hidden" />
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100/50 bg-gray-50/30">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="relative w-full sm:w-80">
                            <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                                <DropdownMenuTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        className="h-10 w-full justify-start px-3 bg-white/50 backdrop-blur-sm rounded-xl border-gray-200 shadow-sm text-gray-900 font-medium hover:bg-white transition-all" 
                                        disabled={isDropdownLoading}
                                    >
                                        <Search className="h-4 w-4 mr-2 text-gray-400" />
                                        {isDropdownLoading ? (
                                            <span className="flex items-center"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div> Loading...</span>
                                        ) : (
                                            <span className="truncate text-left">
                                                {searchTerm || (searchType === 'vendor_name' ? 'Search by vendor...' : 'Search by invoice #...')}
                                            </span>
                                        )}
                                        {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto rounded-xl shadow-xl">
                                    <DropdownMenuItem onClick={() => { setSearchTerm(''); setRefreshKey(prev => prev + 1); }} className="text-gray-500 italic">
                                        Clear search
                                    </DropdownMenuItem>
                                    {isDropdownLoading ? (
                                        <div className="p-4 text-center text-sm text-gray-500">Loading suggestions...</div>
                                    ) : (
                                        (searchType === 'vendor_name' ? allVendorNames : allInvoiceNumbers).map((item, index) => (
                                            <DropdownMenuItem
                                                key={index}
                                                onClick={() => {
                                                    setSearchTerm(item);
                                                    setRefreshKey(prev => prev + 1);
                                                }}
                                                className={`py-2 ${searchTerm === item ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
                                            >
                                                {item}
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Desktop Segmented Filter Type */}
                        <div className="hidden sm:flex relative p-1 bg-gray-100 rounded-lg border border-gray-200/60 shadow-inner w-fit h-10 items-center">
                            <div
                                className={`absolute inset-y-1 rounded-md border shadow-sm transition-all duration-300 ease-out ${searchType === 'vendor_name' ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                                    }`}
                                style={{
                                    width: '100px',
                                    transform: `translateX(${searchType === 'vendor_name' ? '0px' : '100px'})`
                                }}
                            />
                            <button
                                onClick={() => handleSearchTypeChange('vendor_name')}
                                className={`relative w-[100px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === 'vendor_name' ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Vendor Name
                            </button>
                            <button
                                onClick={() => handleSearchTypeChange('invoice_number')}
                                className={`relative w-[100px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === 'invoice_number' ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Invoice No.
                            </button>
                        </div>

                        {/* Mobile Dropdown Fallback */}
                        <div className="sm:hidden">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-xl px-4 text-sm font-bold text-gray-900 bg-white shadow-sm border-gray-200 hover:bg-gray-50 gap-2"
                                    >
                                        <Filter className="h-4 w-4 text-blue-500" />
                                        {searchType === 'vendor_name' ? 'Vendor Name' : 'Invoice Number'}
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-48 rounded-xl shadow-xl">
                                    <DropdownMenuItem onClick={() => handleSearchTypeChange('vendor_name')}>
                                        <User className="h-4 w-4 mr-2 text-gray-400" /> Vendor Name
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSearchTypeChange('invoice_number')}>
                                        <FileText className="h-4 w-4 mr-2 text-gray-400" /> Invoice Number
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="w-full sm:w-auto sm:ml-auto">
                            <Button
                                size="sm"
                                className="h-10 gap-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200/50 transition-all active:scale-95 w-full sm:w-auto"
                                onClick={() => navigate('/purchases/purchase-invoices/new')}
                            >
                                <Plus className="h-4 w-4" />
                                <span className="font-bold">Create Invoice</span>
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="overflow-auto relative">
                    {isLoading && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60">
                            <SpinnerDotted size={50} color="#2563eb" />
                        </div>
                    )}
                    <DataGrid
                        key={refreshKey}
                        columns={columns}
                        serverSide={true}
                        onFetchData={fetchInvoices}
                        rowSelection
                        getRowId={(row: any) => row.id}
                        pagination={{ size: 5 }}
                        onRowClick={(row: any) => {
                            if (showDeleteDialog) return;
                            navigate(`/purchases/purchase-invoices/${row.original.id}`);
                        }}
                        layout={{ card: true, classes: { table: "cursor-pointer [&_tr:hover]:bg-gray-50", container: "hidden md:block" } }}
                    >
                        <MobileView
                            onDetails={(id) => {
                                if (showDeleteDialog) return;
                                navigate(`/purchases/purchase-invoices/${id}`);
                            }}
                            onEdit={(id) => navigate(`/purchases/purchase-invoices/${id}/edit`)}
                            onCreateDebitNote={(invoice) => handleCreateDebitNote(invoice)}
                            onRecordPayment={(invoice) => handleRecordPayment(invoice)}
                            onDelete={(id) => handleDelete(id)}
                        />
                    </DataGrid>
                </div>
            </div>

            {/* Record Payment Modal */}
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
                    <DialogHeader className="px-6 py-4 border-b border-gray-200">
                        <DialogTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-gray-600" />
                            Record Payment For Invoice #{selectedInvoice?.invoice_number}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {/* Form Section */}
                            <div className="md:col-span-2 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Amount Paid <span className="text-red-500">*</span></label>
                                        <Input
                                            type="number"
                                            value={paymentForm.amount === 0 ? "0" : paymentForm.amount || ""}
                                            onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                                            className="h-10"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1">
                                            <label className="text-sm font-medium text-gray-700">Payment Discount</label>
                                            <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                                        </div>
                                        <Input
                                            type="number"
                                            value={paymentForm.discount === 0 ? "0" : paymentForm.discount || ""}
                                            onChange={(e) => setPaymentForm({ ...paymentForm, discount: parseFloat(e.target.value) || 0 })}
                                            className="h-10"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Payment Date</label>
                                        <div className="relative">
                                            <Input
                                                type="date"
                                                value={paymentForm.date.toISOString().split('T')[0]}
                                                onChange={(e) => setPaymentForm({ ...paymentForm, date: new Date(e.target.value) })}
                                                className="h-10"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Payment Mode</label>
                                        <Select value={paymentForm.mode} onValueChange={(val) => setPaymentForm({ ...paymentForm, mode: val })}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="Select mode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cash">Cash</SelectItem>
                                                <SelectItem value="bank">Bank Transfer</SelectItem>
                                                <SelectItem value="upi">UPI</SelectItem>
                                                <SelectItem value="cheque">Cheque</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Notes</label>
                                    <textarea
                                        value={paymentForm.notes}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                        placeholder="Add any remarks or payment notes..."
                                        className="w-full min-h-[80px] p-2 border rounded-md text-sm border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none outline-none"
                                    />
                                </div>
                            </div>

                            {/* Info & Calculation Section */}
                            <div className="md:col-span-2 space-y-4">
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                        Invoice #{selectedInvoice?.invoice_number}
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Vendor Name</span>
                                            <span className="text-gray-900 font-medium">{selectedInvoice?.vendor_name}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Invoice Amount</span>
                                            <span className="text-gray-900 font-medium">₹{selectedInvoice?.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Due Date</span>
                                            <span className="text-gray-900 font-medium">
                                                {selectedInvoice?.date ? new Date(selectedInvoice.date).toLocaleDateString("en-IN") : "N/A"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                        Record Payment Calculation
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-red-600 font-medium">Invoice Pending Amt.</span>
                                            <span className="text-red-600 font-semibold">₹{selectedInvoice?.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">Amount Paid</span>
                                            <span className="text-gray-900 font-medium">₹{paymentForm.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">Payment Out Discount</span>
                                            <span className="text-gray-900 font-medium">₹{paymentForm.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                            <span className="text-sm font-semibold text-gray-800">Balance Amount</span>
                                            <span className="text-base font-bold text-blue-600">
                                                ₹{Math.max(0, (selectedInvoice?.balance_due || 0) - paymentForm.amount - paymentForm.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsPaymentOpen(false)} className="h-10 bg-white border-gray-300 font-medium">Close</Button>
                        <Button onClick={handlePaymentSubmit} disabled={isRecordingPayment || paymentForm.amount <= 0} className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6">
                            {isRecordingPayment ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog
                open={showDeleteDialog}
                onOpenChange={(open) => {
                    setShowDeleteDialog(open);
                    if (!open) {
                        setInvoiceToDelete(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-[420px] p-6">
                    <DialogHeader className="flex flex-col items-center text-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>

                        <DialogTitle className="text-lg font-semibold">
                            Delete Purchase
                        </DialogTitle>

                        <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                            Are you sure you want to delete this purchase invoice?
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeleting || !invoiceToDelete}
                        >
                            {isDeleting ? (
                                <span className="flex items-center">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Deleting...
                                </span>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PurchaseInvoicePage;
