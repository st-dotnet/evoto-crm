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
    Search,
    MoreVertical,
    Edit,
    Eye,
    Trash2,
    CreditCard,
    FileText,
    AlertCircle,
    Receipt
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { getInvoices, deleteInvoice, getCustomerNamesDropdown, getInvoiceNumbersDropdown } from "../services/invoice.service";
import { checkCreditNoteExistsForInvoice } from "../../creditIn/service/creditIn.service";
import { toast } from "sonner";
import { TDataGridRequestParams } from "@/components";
import { SpinnerDotted } from 'spinners-react';
import { cn } from "@/lib/utils";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface Invoice {
    id: string;
    date: string;
    invoice_number: string;
    party_name: string;
    due_date: string;
    amount: number;
    total_amount: number;
    amount_paid: number;
    balance_due: number;
    payment_status: string;
}

const InvoicePage = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [invoicesWithCreditNotes, setInvoicesWithCreditNotes] = useState<Set<string>>(new Set());
    const [isCheckingCreditNote, setIsCheckingCreditNote] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial' | 'refunded'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'party_name' | 'invoice_number'>('party_name');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [allCustomerNames, setAllCustomerNames] = useState<string[]>([]);
    const [allInvoiceNumbers, setAllInvoiceNumbers] = useState<string[]>([]);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isDropdownLoading, setIsDropdownLoading] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const navigate = useNavigate();

    // Fetch autocomplete data for search suggestions
    const fetchAutocompleteData = useCallback(async () => {
        setIsDropdownLoading(true);
        try {
            const [customerResponse, invoiceNumberResponse] = await Promise.all([
                getCustomerNamesDropdown(),
                getInvoiceNumbersDropdown()
            ]);

            if (customerResponse.success && customerResponse.data) {
                const customerNames = Array.isArray(customerResponse.data)
                    ? customerResponse.data.map((item: any) => item.name || item).filter(Boolean)
                    : [];
                setAllCustomerNames(customerNames);
            }

            if (invoiceNumberResponse.success && invoiceNumberResponse.data) {
                const invoiceNumbers = Array.isArray(invoiceNumberResponse.data)
                    ? invoiceNumberResponse.data.map((item: any) => item.invoice_number || item).filter(Boolean)
                    : [];
                setAllInvoiceNumbers(invoiceNumbers);
            }
        } catch (error) {
            console.error('Error fetching autocomplete data:', error);
        } finally {
            setIsDropdownLoading(false);
        }
    }, []);

    // Fetch autocomplete data on mount and when search type changes
    useEffect(() => {
        fetchAutocompleteData();
    }, [fetchAutocompleteData]);

    // Handle search type change
    const handleSearchTypeChange = (type: 'party_name' | 'invoice_number') => {
        setSearchType(type);
        setShowSuggestions(false);
        setSearchTerm('');
        // Clear filtered suggestions immediately for better UX
        setFilteredSuggestions(type === 'party_name' ? allCustomerNames : allInvoiceNumbers);
    };

    // Filter suggestions based on search term and type
    useEffect(() => {
        if (searchTerm) {
            const suggestions = searchType === 'party_name'
                ? allCustomerNames.filter(name =>
                    name.toLowerCase().includes(searchTerm.toLowerCase())
                )
                : allInvoiceNumbers.filter(number =>
                    number.toLowerCase().includes(searchTerm.toLowerCase())
                );
            setFilteredSuggestions(suggestions);
        } else {
            // Update suggestions but don't show them automatically
            const suggestions = searchType === 'party_name' ? allCustomerNames : allInvoiceNumbers;
            setFilteredSuggestions(suggestions);
        }
    }, [searchTerm, searchType, allCustomerNames, allInvoiceNumbers]);

    // Fetch invoices from database
    const fetchInvoices = useCallback(async (params: TDataGridRequestParams) => {
        setIsLoading(true);
        try {
            const response = await getInvoices(
                searchTerm,
                params.pageIndex + 1,
                params.pageSize,
                searchType === 'party_name' ? searchTerm : '',
                searchType === 'invoice_number' ? searchTerm : '',
                selectedStatus === 'all' ? '' : selectedStatus
            );

            if (response.success && response.data) {
                const invoicesData = response.data.data || response.data;

                const transformedInvoices = invoicesData.map((item: any) => ({
                    id: item.uuid,
                    date: item.invoice_date || item.created_at,
                    invoice_number: item.invoice_number,
                    party_name: item.customer_name || 'N/A',
                    due_date: item.due_date,
                    amount: item.total_amount || 0,
                    total_amount: item.total_amount || 0,
                    amount_paid: item.amount_paid || 0,
                    balance_due: item.balance_due || 0,
                    payment_status: item.payment_status || 'unpaid',
                }));
                setInvoices(transformedInvoices);

                // Check which invoices have credit notes
                checkInvoicesForCreditNotes(transformedInvoices);

                // Return data for server-side DataGrid
                return {
                    data: transformedInvoices,
                    totalCount: response.data.pagination?.total || transformedInvoices.length,
                };
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error('Failed to fetch invoices');
            setInvoices([]);
            return {
                data: [],
                totalCount: 0,
            };
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, searchType, selectedStatus]);

    // Check which invoices have credit notes
    const checkInvoicesForCreditNotes = async (invoiceList: Invoice[]) => {
        const invoiceIds = invoiceList.map(inv => inv.id);
        const creditNoteChecks = invoiceIds.map(async (invoiceId) => {
            try {
                const response = await checkCreditNoteExistsForInvoice(invoiceId);
                return { invoiceId, hasCreditNote: response.success ? response.data.hasCreditNote : false };
            } catch (error) {
                console.error(`Error checking credit note for invoice ${invoiceId}:`, error);
                return { invoiceId, hasCreditNote: false };
            }
        });

        const results = await Promise.all(creditNoteChecks);
        const invoicesWithNotes = new Set(
            results.filter(result => result.hasCreditNote).map(result => result.invoiceId)
        );

        setInvoicesWithCreditNotes(invoicesWithNotes);
    };

    // Listen for credit note updates to refresh invoice data
    useEffect(() => {
        const handleCreditNoteUpdate = (event: CustomEvent) => {
            // Refresh the invoice data to show updated status
            setRefreshKey(prev => prev + 1);

            // Also refresh credit note status for current invoices
            if (invoices.length > 0) {
                checkInvoicesForCreditNotes(invoices);
            }
        };

        window.addEventListener('creditNoteUpdated', handleCreditNoteUpdate as EventListener);

        return () => {
            window.removeEventListener('creditNoteUpdated', handleCreditNoteUpdate as EventListener);
        };
    }, [invoices]);

    const MobileView = ({
        onEdit,
        onDetails,
        onDelete,
    }: {
        onEdit: (id: string) => void;
        onDetails: (id: string) => void;
        onDelete: (id: string) => void;
    }) => {
        return (
            <div className="flex flex-col lg:hidden border-t border-gray-100 dark:border-gray-100/10">
                {invoices.map((invoice) => (
                    <div
                        key={invoice.id}
                        className="flex justify-between items-center py-4 px-5 border-b border-gray-100 dark:border-gray-100/10 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-200/50 transition-all active:bg-gray-50 dark:active:bg-gray-200/50"
                    >
                        <div
                            className="flex flex-col cursor-pointer grow pr-4"
                            onClick={() => onDetails(invoice.id)}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900 dark:text-white text-sm">{invoice.invoice_number}</span>
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium border ${getPaymentStatusBadge(invoice.payment_status)}`}>
                                    {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                                </span>
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-0.5">{invoice.party_name}</span>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-zinc-500">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(invoice.date).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                    <AlertCircle className={`h-3 w-3 ${new Date(invoice.due_date) < new Date() ? 'text-red-400' : 'text-blue-400'}`} />
                                    Due: {new Date(invoice.due_date).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <div className="font-bold text-primary text-sm">
                                    ₹{invoice.amount?.toLocaleString('en-IN') || '0'}
                                </div>
                                {invoice.balance_due > 0 && (
                                    <div className="text-[10px] text-red-500 font-medium">
                                        Bal: ₹{invoice.balance_due.toLocaleString('en-IN')}
                                    </div>
                                )}
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center justify-center size-9 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-all shrink-0">
                                    <MoreVertical className="h-4.5 w-4.5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 p-1 shadow-lg bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                                <DropdownMenuItem
                                    className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                                    onClick={() => onEdit(invoice.id)}
                                >
                                    <Edit className="mr-2 h-4 w-4 text-gray-500" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                                    onClick={() => onDetails(invoice.id)}
                                >
                                    View Details
                                </DropdownMenuItem>
                                <div className="my-1 border-t border-gray-100 dark:border-zinc-800"></div>
                                <DropdownMenuItem
                                    className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                                    onClick={() => onDelete(invoice.id)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
                {invoices.length === 0 && !isLoading && (
                    <div className="p-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                            <Search className="text-3xl text-gray-200" />
                            <span className="text-gray-400 text-sm font-medium">No invoices found.</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Filter invoices by payment status (kept for compatibility but not used with server-side filtering)
    const filteredInvoices = useMemo(() => {
        return invoices;
    }, [invoices]);

    const handleEdit = (id: string) => {
        navigate(`/invoices/${id}/edit`);
    };

    const handleDelete = async (id: string) => {
        // Prevent any pending navigation
        window.event?.stopPropagation();
        window.event?.preventDefault();

        // Check if credit notes exist for this invoice before allowing delete
        try {
            const response = await checkCreditNoteExistsForInvoice(id);
            if (response.success && response.data && response.data.hasCreditNote) {
                const creditNotes = response.data.creditNotes || [];
                const creditNoteNumbers = creditNotes.map((cn: any) => cn.credit_note_number).join(', ');
                toast.error(`Cannot delete invoice. Credit note already exist: ${creditNoteNumbers}. Please unlink credit note first.`);
                return;
            }
        } catch (error) {
            console.error('Error checking credit notes:', error);
            // Still allow delete if check fails, but show warning
            toast.warning('Unable to verify credit note status. Proceed with caution.');
        }

        setInvoiceToDelete(id);
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (!invoiceToDelete || isDeleting) return;
        setIsDeleting(true);

        const response = await deleteInvoice(invoiceToDelete);
        if (response.success) {
            toast.success('Invoice deleted successfully');
            setRefreshKey(prev => prev + 1);
        } else {
            toast.error(response.error || 'Failed to delete invoice');
        }

        setShowDeleteDialog(false);
        setInvoiceToDelete(null);
        setIsDeleting(false);
    };

    const handleDeleteCancel = () => {
        setShowDeleteDialog(false);
        setInvoiceToDelete(null);
    };

    const getPaymentStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            paid: 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-500 border-green-200 dark:border-green-800',
            partial: 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-800',
            unpaid: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-500 border-red-200 dark:border-red-800',
            refunded: 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/50',
        };
        return styles[status.toLowerCase()] || 'bg-gray-50 dark:bg-gray-200/20 text-gray-700 dark:text-gray-500 border-gray-200 dark:border-gray-800';
    };


    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-300',
            sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
            paid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
            overdue: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
        };
        return styles[status] || 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-300';
    };

    const columns = useMemo<ColumnDef<Invoice>[]>(() => [
        {
            id: "select",
            header: () => (
                <div className="flex items-center justify-center w-full h-full">
                    <DataGridRowSelectAll />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex items-center justify-center w-full h-full">
                    <DataGridRowSelect row={row} />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Date"
                    column={column}
                    className="justify-start"
                />
            ),
            cell: (info) => (
                <div className="text-sm text-gray-900 dark:text-zinc-100">
                    {new Date(info.getValue() as string).toLocaleDateString()}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[100px]",
            },
        },
        {
            accessorKey: "invoice_number",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Invoice Number"
                    column={column}
                    className="justify-start"
                />
            ),
            cell: (info) => (
                <div className="text-sm font-medium text-primary">
                    {info.getValue() as string}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[100px]",
            },
        },
        {
            accessorKey: "party_name",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Party Name"
                    column={column}
                    className="justify-start"
                />
            ),
            cell: (info) => (
                <div className="text-sm text-gray-900 dark:text-zinc-100">
                    {info.getValue() as string}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[180px]",
            },
        },
        {
            accessorKey: "due_date",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Due In"
                    column={column}
                    className="justify-start"
                />
            ),
            cell: (info) => {
                const dueDate = new Date(info.getValue() as string);
                const isOverdue = dueDate < new Date();
                return (
                    <div className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-500 font-medium' : 'text-gray-900 dark:text-zinc-100'}`}>
                        {dueDate.toLocaleDateString()}
                    </div>
                );
            },
            meta: {
                headerClassName: "min-w-[100px]",
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Amount"
                    column={column}
                    className="justify-end"
                />
            ),
            cell: (info) => (
                <div className="text-sm font-medium text-right text-gray-900 dark:text-zinc-100">
                    ₹{(info.getValue() as number)?.toLocaleString('en-IN') || '0'}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[100px] justify-end",
                cellClassName: "text-right",
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
            cell: (info) => {
                const status = (info.getValue() as string).toLowerCase();
                const colorMap: Record<string, string> = {
                    paid: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-500 border-green-200 dark:border-green-800",
                    unpaid: "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-500 border-red-200 dark:border-red-800",
                    partial: "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-800",
                    refunded: "bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/50",
                };
                return (
                    <div className="flex items-center justify-center">
                        <div className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border",
                            colorMap[status] || "bg-gray-50 dark:bg-gray-200/50 text-gray-700 dark:text-gray-800 border-gray-200 dark:border-gray-100"
                        )}>
                            <span className="w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse bg-current" />
                            {status.toUpperCase()}
                        </div>
                    </div>
                );
            },
            meta: {
                headerClassName: "min-w-[100px]",
            },
        },
        {
            accessorKey: "actions",
            header: "Actions",
            enableSorting: false,
            meta: {
                headerClassName: "w-28",
                cellClassName: "text-gray-800 font-medium pointer-events-auto",
                disableRowClick: true,
            },
            cell: ({ row }) => {
                const [isOpen, setIsOpen] = useState(false);

                // Update global dropdown state
                useEffect(() => {
                    setIsDropdownOpen(isOpen);
                }, [isOpen]);

                return (
                    <div className="flex justify-center">
                        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    data-dropdown-trigger="true"
                                    className="flex items-center justify-center text-sm text-primary hover:text-primary-active"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                                <DropdownMenuItem
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigate(`/invoices/${row.original.id}`);
                                        setIsOpen(false);
                                    }}
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onSelect={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // Check if credit notes exist for this invoice before allowing edit
                                        try {
                                            const response = await checkCreditNoteExistsForInvoice(row.original.id);
                                            if (response.success && response.data && response.data.hasCreditNote) {
                                                const creditNotes = response.data.creditNotes || [];
                                                const creditNoteNumbers = creditNotes.map((cn: any) => cn.credit_note_number).join(', ');
                                                toast.error(`Cannot edit invoice. Credit note already exist: ${creditNoteNumbers}. Please unlink credit note first.`);
                                                setIsOpen(false);
                                                return;
                                            }
                                        } catch (error) {
                                            console.error('Error checking credit notes:', error);
                                            // Still allow edit if check fails, but show warning
                                            toast.warning('Unable to verify credit note status. Proceed with caution.');
                                        }

                                        navigate(`/invoices/${row.original.id}/edit`);
                                        setIsOpen(false);
                                    }}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onSelect={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // CHECK IF CREDIT NOTE ALREADY EXISTS - RESTRICT TO ONE PER INVOICE
                                        setIsCheckingCreditNote(true);
                                        try {
                                            const checkResponse = await checkCreditNoteExistsForInvoice(row.original.id);

                                            if (checkResponse.success && checkResponse.data.hasCreditNote) {

                                                // If credit note exists, just show toast message - don't navigate
                                                const existingCreditNote = checkResponse.data.creditNotes[0];
                                                toast.info(`Credit note ${existingCreditNote.credit_note_number} already exists.You can only create one credit note per invoice.`);
                                                setIsOpen(false);
                                                return;
                                            } else {
                                                navigate(`/sales/credit-note/create?invoice_id=${row.original.id}`);
                                                setIsOpen(false);
                                                return;
                                            }
                                        } catch (error) {
                                            console.error('Error checking credit note existence:', error);
                                            toast.warning('Unable to verify credit note status. You can proceed, but please verify no duplicates exist.');
                                            navigate(`/sales/credit-note/create?invoice_id=${row.original.id}`);
                                            setIsOpen(false);
                                            return;
                                        } finally {
                                            setIsCheckingCreditNote(false);
                                        }
                                    }}
                                    disabled={isCheckingCreditNote}
                                    className={isCheckingCreditNote ? 'opacity-70' : ''}
                                >
                                    <Receipt className="mr-2 h-4 w-4" />
                                    Create Credit Note
                                    {isCheckingCreditNote && (
                                        <span className="ml-2 text-xs text-blue-600">(Checking...)</span>
                                    )}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.nativeEvent.stopImmediatePropagation();
                                        handleDelete(row.original.id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                    <span className="text-red-500">Delete</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ], []);

    return (

        <div className="w-full px-4 py-6 sm:p-6 relative overflow-x-hidden">
            {(isDeleting) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80">
                    <div className="text-primary">
                        <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
                    </div>
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Invoices</h1>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-zinc-700">
                            Voucher Management
                        </span>
                        <span className="text-xs text-gray-400 dark:text-zinc-500 font-medium italic">
                            Manage and track your customer invoices
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Desktop Segmented Control */}
                    <div className="hidden sm:flex items-center px-1.5 py-1 bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-sm w-fit">
                        <div className="flex items-center pl-2 pr-3 border-r border-gray-200/80 dark:border-gray-100/20 mr-1">
                            <Filter className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500 mr-2" />
                            <span className="text-[10px] uppercase tracking-widest font-extrabold text-gray-900 dark:text-white">Filters</span>
                        </div>
                        <div className="relative flex items-center">
                            {/* Animated Slider Background with Glow */}
                            <div
                                className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_12px_-2px_rgba(59,130,246,0.15)] dark:shadow-[0_2px_15px_-3px_rgba(59,130,246,0.3)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${selectedStatus === 'all' ? 'bg-white dark:bg-blue-500/20 border-gray-200 dark:border-blue-500/50 shadow-gray-200/50' :
                                    selectedStatus === 'paid' ? 'bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/50 shadow-green-200/50' :
                                        selectedStatus === 'unpaid' ? 'bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/50 shadow-red-200/50' :
                                            selectedStatus === 'partial' ? 'bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/50 shadow-yellow-200/50' :
                                                'bg-purple-50 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/50 shadow-purple-200/50'
                                    }`}
                                style={{
                                    width: '86px',
                                    transform: `translateX(${selectedStatus === 'all' ? '0px' :
                                        selectedStatus === 'paid' ? '86px' :
                                            selectedStatus === 'unpaid' ? '172px' :
                                                selectedStatus === 'partial' ? '258px' :
                                                    '340px'
                                        })`
                                }}
                            />

                            <button
                                onClick={() => { setSelectedStatus('all'); setRefreshKey(prev => prev + 1); }}
                                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'all' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('paid'); setRefreshKey(prev => prev + 1); }}
                                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'paid' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
                            >
                                Paid
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('unpaid'); setRefreshKey(prev => prev + 1); }}
                                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'unpaid' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
                            >
                                Unpaid
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('partial'); setRefreshKey(prev => prev + 1); }}
                                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'partial' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
                            >
                                Partial
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('refunded'); setRefreshKey(prev => prev + 1); }}
                                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'refunded' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
                            >
                                Refunded
                            </button>
                        </div>
                    </div>

                    {/* Mobile Dropdown Fallback */}
                    <div className="w-full sm:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-10 w-full justify-between bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800 shadow-sm transition-all">
                                    <div className="flex items-center overflow-hidden">
                                        <Filter className="h-4 w-4 shrink-0 text-gray-400 dark:text-zinc-500" />
                                        <span className="truncate ml-2 font-medium text-gray-700 dark:text-zinc-300">
                                            {selectedStatus === 'all' && 'All Invoices'}
                                            {selectedStatus === 'paid' && 'Paid'}
                                            {selectedStatus === 'unpaid' && 'Unpaid'}
                                            {selectedStatus === 'partial' && 'Partial'}
                                            {selectedStatus === 'refunded' && 'Refunded'}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px] bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                                <DropdownMenuItem onClick={() => { setSelectedStatus('all'); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-2">
                                    <Circle className="h-4 w-4 text-gray-500" />
                                    <span>All Invoices</span>
                                    {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedStatus('paid'); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-2">
                                    <Circle className="h-4 w-4 text-green-500" />
                                    <span>Paid</span>
                                    {selectedStatus === 'paid' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedStatus('unpaid'); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-2">
                                    <Circle className="h-4 w-4 text-red-500" />
                                    <span>Unpaid</span>
                                    {selectedStatus === 'unpaid' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedStatus('partial'); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-2">
                                    <Circle className="h-4 w-4 text-yellow-500" />
                                    <span>Partial</span>
                                    {selectedStatus === 'partial' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedStatus('refunded'); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-2">
                                    <Circle className="h-4 w-4 text-gray-500" />
                                    <span>Refunded</span>
                                    {selectedStatus === 'refunded' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Create Button moved to table header */}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-100 border border-gray-200 dark:border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-200 w-full">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                        <div className="relative w-full sm:w-80">
                            <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-10 w-full justify-start px-3 bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-200 hover:border-blue-300 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/5 backdrop-blur-sm shadow-sm transition-all rounded-xl" disabled={isDropdownLoading}>
                                        {isDropdownLoading ? (
                                            <span className="flex items-center text-xs">
                                                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Loading...
                                            </span>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-900">
                                                {searchTerm || (searchType === 'party_name' ? 'Select by party name...' : 'Select by invoice number...')}
                                            </span>
                                        )}
                                        {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                                    <DropdownMenuItem onClick={() => { setSearchTerm(''); setRefreshKey(prev => prev + 1); }} className={!searchTerm ? "bg-blue-50 text-blue-600" : ""}>
                                        <span className="text-gray-500">Show All {searchType === 'party_name' ? 'Parties' : 'Invoices'}</span>
                                    </DropdownMenuItem>
                                    {isDropdownLoading ? (
                                        <DropdownMenuItem disabled>
                                            <div className="flex items-center justify-center w-full py-2">
                                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Loading options...
                                            </div>
                                        </DropdownMenuItem>
                                    ) : (
                                        (searchType === 'party_name' ? allCustomerNames : allInvoiceNumbers).map((item, index) => (
                                            <DropdownMenuItem key={index} onClick={() => { setSearchTerm(item); setRefreshKey(prev => prev + 1); }} className={searchTerm === item ? "bg-blue-50 text-blue-600" : ""}>
                                                {item}
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Desktop Segmented Filter Type */}
                        <div className="hidden sm:flex relative p-0.5 bg-gray-100 dark:bg-gray-200 rounded-lg border border-gray-200/60 dark:border-gray-100 shadow-inner w-fit items-center">
                            <button
                                onClick={() => handleSearchTypeChange('party_name')}
                                className={cn(
                                    "px-4 py-1.5 text-[10px] font-bold rounded-md transition-all z-10 uppercase tracking-wider",
                                    searchType === 'party_name' ? "bg-white dark:bg-gray-100 text-blue-600 shadow-sm" : "text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-800"
                                )}
                            >
                                Party Name
                            </button>
                            <button
                                onClick={() => handleSearchTypeChange('invoice_number')}
                                className={cn(
                                    "px-4 py-1.5 text-[10px] font-bold rounded-md transition-all z-10 uppercase tracking-wider",
                                    searchType === 'invoice_number' ? "bg-white dark:bg-gray-100 text-blue-600 shadow-sm" : "text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-800"
                                )}
                            >
                                Invoice No.
                            </button>
                        </div>

                        {/* Mobile Dropdown Fallback */}
                        <div className="sm:hidden">
                            <DropdownMenu open={showFilterDropdown} onOpenChange={setShowFilterDropdown}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-10 rounded-md px-3 text-sm text-gray-600 dark:text-gray-800 bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-200 w-full sm:w-auto">
                                        <Filter className="h-3.5 w-3.5 mr-1 text-blue-500 shrink-0" />
                                        <span className="truncate max-w-[150px]">
                                            {searchTerm ? `${searchType === 'party_name' ? 'Party' : 'Invoice'}: ${searchTerm}` : 'Filter by'}
                                        </span>
                                        <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-48 bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                                    <DropdownMenuItem onClick={() => { handleSearchTypeChange('party_name'); setShowFilterDropdown(false); }} className={searchType === 'party_name' ? "bg-blue-50 text-blue-600" : ""}>
                                        <Filter className="h-3.5 w-3.5 mr-2" />
                                        Party Name
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { handleSearchTypeChange('invoice_number'); setShowFilterDropdown(false); }} className={searchType === 'invoice_number' ? "bg-blue-50 text-blue-600" : ""}>
                                        <Filter className="h-3.5 w-3.5 mr-2" />
                                        Invoice No.
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="w-full sm:w-auto sm:ml-auto">
                            <button
                                className="group flex items-center gap-2 px-5 h-10 text-xs font-bold text-blue-600 bg-white dark:bg-gray-100 border border-blue-100 dark:border-blue-900/30 rounded-xl shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-95"
                                onClick={() => navigate('/invoices/new-invoice')}
                            >
                                <Plus className="size-4 text-blue-500 group-hover:rotate-90 transition-transform" />
                                <span className="whitespace-nowrap captialize tracking-wider">Create Invoice</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="overflow-auto">
                    <DataGrid
                        refreshKey={refreshKey}
                        columns={columns}
                        serverSide={true}
                        onFetchData={fetchInvoices}
                        rowSelection
                        getRowId={(row: any) => row.id?.toString()}
                        pagination={{ size: 5 }}
                        onRowClick={(row: any) => {
                            if (showDeleteDialog || isDropdownOpen) {
                                return;
                            }
                            const clickedElement = document.activeElement;
                            if (clickedElement && clickedElement.getAttribute('data-dropdown-trigger') === 'true') {
                                return;
                            }
                            navigate(`/invoices/${row.original.id}`);
                        }}
                        layout={{
                            card: true,
                            classes: {
                                container: 'hidden lg:block',
                            }
                        }}
                    >
                        <MobileView
                            onEdit={(id) => navigate(`/invoices/${id}/edit`)}
                            onDetails={(id) => navigate(`/invoices/${id}`)}
                            onDelete={(id) => {
                                setInvoiceToDelete(id);
                                setShowDeleteDialog(true);
                            }}
                        />
                    </DataGrid>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Invoice"
                message="Are you sure you want to delete this invoice? This action will permanently remove all the data and cannot be undone."
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
                variant="danger"
            />
        </div>

    );
};

export default InvoicePage;
