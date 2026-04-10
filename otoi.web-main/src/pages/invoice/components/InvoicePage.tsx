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
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
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
            <div className="flex flex-col lg:hidden border-t border-gray-100">
                {invoices.map((invoice) => (
                    <div
                        key={invoice.id}
                        className="flex justify-between items-center py-4 px-5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-all active:bg-gray-50"
                    >
                        <div
                            className="flex flex-col cursor-pointer grow pr-4"
                            onClick={() => onDetails(invoice.id)}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900 text-sm">{invoice.invoice_number}</span>
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${getPaymentStatusBadge(invoice.payment_status)}`}>
                                    {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                                </span>
                            </div>
                            <span className="text-sm font-medium text-gray-700 mb-0.5">{invoice.party_name}</span>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400">
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
                                <button className="flex items-center justify-center size-9 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all shrink-0">
                                    <MoreVertical className="h-4.5 w-4.5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 p-1 shadow-lg border-gray-200">
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
                                    <Eye className="mr-2 h-4 w-4 text-gray-500" />
                                    View Details
                                </DropdownMenuItem>
                                <div className="my-1 border-t border-gray-100"></div>
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
            paid: 'bg-green-100 text-green-800',
            partial: 'bg-yellow-100 text-yellow-800',
            unpaid: 'bg-red-100 text-red-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };


    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-800',
            sent: 'bg-blue-100 text-blue-800',
            paid: 'bg-green-100 text-green-800',
            overdue: 'bg-red-100 text-red-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
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
                <div className="text-sm text-gray-900">
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
                <div className="text-sm text-gray-900">
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
                    <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
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
                <div className="text-sm font-medium text-right">
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
                const invoice = info.row.original;
                return (
                    <div className="flex items-center justify-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${getPaymentStatusBadge(invoice.payment_status)}`}>
                            {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                        </span>
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

                            <DropdownMenuContent align="end">
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
            {(isDeleting || isDropdownLoading) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80">
                    <div className="text-primary">
                        <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
                    </div>
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold">Invoices</h1>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="w-full sm:w-44">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 w-full justify-between">
                                    <div className="flex items-center overflow-hidden">
                                        <Filter className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate ml-1">
                                            {selectedStatus === 'all' && 'All Invoices'}
                                            {selectedStatus === 'paid' && 'Paid'}
                                            {selectedStatus === 'unpaid' && 'Unpaid'}
                                            {selectedStatus === 'partial' && 'Partial'}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px]">
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="w-full sm:w-36">
                        <Button variant="outline" size="sm" className="h-9 w-full gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="truncate">Last 365 Days</span>
                        </Button>
                    </div>

                    <Button
                        size="sm"
                        className="h-9 gap-1 w-full sm:w-auto"
                        onClick={() => navigate('/invoices/new-invoice')}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="whitespace-nowrap">Create Invoice</span>
                    </Button>
                </div>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="p-4 border-b">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="relative w-full sm:w-80">
                            <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-10 w-full justify-start px-3" disabled={isDropdownLoading}>
                                        {isDropdownLoading ? (
                                            <span className="flex items-center">
                                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Loading...
                                            </span>
                                        ) : (
                                            searchTerm || (searchType === 'party_name' ? 'Select by party name...' : 'Select by invoice number...')
                                        )}
                                        {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4 shrink-0" />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto">
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

                        <DropdownMenu open={showFilterDropdown} onOpenChange={setShowFilterDropdown}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-10 rounded-md px-3 text-sm text-gray-600 w-full sm:w-auto">
                                    <Filter className="h-3.5 w-3.5 mr-1 text-blue-500 shrink-0" />
                                    <span className="truncate max-w-[150px]">
                                        {searchTerm ? `${searchType === 'party_name' ? 'Party' : 'Invoice'}: ${searchTerm}` : 'Filter by'}
                                    </span>
                                    <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48">
                                <DropdownMenuItem onClick={() => { handleSearchTypeChange('party_name'); setShowFilterDropdown(false); }} className={searchType === 'party_name' ? "bg-blue-50 text-blue-600" : ""}>
                                    <Filter className="h-3.5 w-3.5 mr-2" />
                                    Party Name
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { handleSearchTypeChange('invoice_number'); setShowFilterDropdown(false); }} className={searchType === 'invoice_number' ? "bg-blue-50 text-blue-600" : ""}>
                                    <Filter className="h-3.5 w-3.5 mr-2" />
                                    Invoice Number
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <div className="overflow-auto">
                    <DataGrid
                        key={refreshKey}
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
                                table: "cursor-pointer [&_tr:hover]:bg-gray-50"
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
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
                    <div className="p-6 text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <DialogTitle className="text-lg font-semibold text-gray-900 mb-4">
                            Delete Invoice
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-600">
                            Are you sure you want to delete this invoice? This action will permanently remove all the data.
                        </DialogDescription>
                    </div>
                    <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={handleDeleteCancel}
                            disabled={isDeleting}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDeleting ? (
                                <div className="flex items-center">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Deleting...
                                </div>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>

    );
};

export default InvoicePage;
