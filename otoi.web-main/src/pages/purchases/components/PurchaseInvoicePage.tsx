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
import { listPurchaseInvoices, deletePurchaseInvoice, recordPurchaseInvoicePayment } from "../services/purchaseInvoice.services";
import { toast } from "sonner";
import { TDataGridRequestParams } from "@/components";
import { SpinnerDotted } from 'spinners-react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

    // Fetch vendor names for autocomplete suggestions
    const fetchAutocompleteData = useCallback(async () => {
        setIsDropdownLoading(true);
        try {
            const vendorResponse = await getAllVendorsDropdown();
            if (vendorResponse.success && vendorResponse.data) {
                const vendorNames = vendorResponse.data
                    .map((v: any) => v.name)
                    .filter((name: string) => name && name !== "N/A");
                setAllVendorNames(vendorNames);
            }
        } catch (error) {
            console.error('Error fetching autocomplete data:', error);
        } finally {
            setIsDropdownLoading(false);
        }
    }, []);

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
                const transformed = invoicesData.map((item: any) => ({
                    id: item.uuid,
                    date: item.invoice_date || item.created_at,
                    invoice_number: item.invoice_number,
                    vendor_name: item.vendor_name || 'N/A',
                    amount: item.total_amount || 0,
                    amount_paid: item.amount_paid || 0,
                    balance_due: item.balance_due || 0,
                    payment_status: item.payment_status || 'unpaid',
                }));
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

    const handleCreateDebitNote = (invoice: PurchaseInvoice) => {
        // Navigate to debit note creation page with prefilled data
        const vendorId = invoice.vendor?.uuid || invoice.vendor_id;
        navigate(`/debit-note/create?invoice_id=${invoice.id}&vendor_id=${vendorId}`);
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
            cell: (info) => (
                <div className="text-sm text-gray-900">
                    {new Date(info.getValue() as string).toLocaleDateString("en-IN")}
                </div>
            ),
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
                const [isOpen, setIsOpen] = useState(false);

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
                                    className="flex items-center justify-center text-primary hover:text-primary-active transition-colors"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => { navigate(`/purchases/purchase-invoices/${row.original.id}`); setIsOpen(false); }}>
                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { navigate(`/purchases/purchase-invoices/${row.original.id}/edit`); setIsOpen(false); }}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { handleCreateDebitNote(row.original); setIsOpen(false); }}>
                                    <FileMinus className="mr-2 h-4 w-4" /> Create Debit Note
                                </DropdownMenuItem>
                                {row.original.payment_status !== 'paid' && (
                                    <DropdownMenuItem onSelect={() => { handleRecordPayment(row.original); setIsOpen(false); }}>
                                        <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-red-600" onSelect={() => {
                                    setInvoiceToDelete(row.original.id);
                                    setShowDeleteDialog(true);
                                    setIsOpen(false);
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

    return (
        <div className="container-fluid p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Purchase Invoices</h1>
                <div className="flex items-center gap-2">
                    <div className="w-44">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-full gap-1">
                                    <Filter className="h-3.5 w-3.5 text-gray-500" />
                                    <span className="truncate">
                                        {selectedStatus === 'all' && 'All Status'}
                                        {selectedStatus === 'paid' && 'Paid'}
                                        {selectedStatus === 'unpaid' && 'Unpaid'}
                                        {selectedStatus === 'partial' && 'Partial'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px]">
                                <DropdownMenuItem onClick={() => { setSelectedStatus('all'); setRefreshKey(prev => prev + 1); }}>
                                    <Circle className="h-3.5 w-3.5 mr-2 text-gray-400" /> All Status
                                    {selectedStatus === 'all' && <Check className="h-3.5 w-3.5 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedStatus('paid'); setRefreshKey(prev => prev + 1); }}>
                                    <Circle className="h-3.5 w-3.5 mr-2 text-green-500 fill-green-500" /> Paid
                                    {selectedStatus === 'paid' && <Check className="h-3.5 w-3.5 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedStatus('unpaid'); setRefreshKey(prev => prev + 1); }}>
                                    <Circle className="h-3.5 w-3.5 mr-2 text-red-500 fill-red-500" /> Unpaid
                                    {selectedStatus === 'unpaid' && <Check className="h-3.5 w-3.5 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedStatus('partial'); setRefreshKey(prev => prev + 1); }}>
                                    <Circle className="h-3.5 w-3.5 mr-2 text-yellow-500 fill-yellow-500" /> Partial
                                    {selectedStatus === 'partial' && <Check className="h-3.5 w-3.5 ml-auto" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="w-44">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-full gap-1 text-gray-600">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span className="truncate">
                                        {selectedDateFilter === 'today' && 'Today'}
                                        {selectedDateFilter === 'this_week' && 'This Week'}
                                        {selectedDateFilter === 'last_week' && 'Last Week'}
                                        {selectedDateFilter === 'this_month' && 'This Month'}
                                        {selectedDateFilter === 'last_month' && 'Last Month'}
                                        {selectedDateFilter === 'last_365' && 'Last 365 Days'}
                                        {selectedDateFilter === 'all' && 'All Time'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0 opacity-50" />
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
                    <Button
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => navigate('/purchases/purchase-invoices/new')}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only">Create Purchase Invoice</span>
                    </Button>
                </div>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                <div className="p-4 border-b">
                    <div className="relative w-fit">
                        <div className="flex">
                            <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9 w-80 justify-start px-3" disabled={isDropdownLoading}>
                                        {isDropdownLoading ? (
                                            <span className="flex items-center"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div> Loading...</span>
                                        ) : (
                                            searchTerm || (searchType === 'vendor_name' ? 'Search by vendor...' : 'Search by invoice #...')
                                        )}
                                        {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4" />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
                                    <DropdownMenuItem onClick={() => { setSearchTerm(''); setRefreshKey(prev => prev + 1); }} className={!searchTerm ? "bg-blue-50 text-blue-600" : ""}>
                                        <span className="text-gray-500 italic">Show All {searchType === 'vendor_name' ? 'Vendors' : 'Invoices'}</span>
                                    </DropdownMenuItem>
                                    {filteredSuggestions.map((item, idx) => (
                                        <DropdownMenuItem key={idx} onClick={() => { setSearchTerm(item); }} className={searchTerm === item ? "bg-blue-50 text-blue-600" : ""}>
                                            {item}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 rounded-md px-3 text-sm text-gray-600 ml-2">
                                        <Filter className="h-3.5 w-3.5 mr-1 text-blue-500" />
                                        {searchTerm ? `${searchType === 'vendor_name' ? 'Vendor' : 'Invoice'}: ${searchTerm.substring(0, 10)}...` : 'Filter by'}
                                        <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-48">
                                    <DropdownMenuItem onClick={() => handleSearchTypeChange('vendor_name')} className={searchType === 'vendor_name' ? "bg-blue-50 text-blue-600" : ""}>
                                        <Filter className="h-3.5 w-3.5 mr-2" /> Vendor Name
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSearchTypeChange('invoice_number')} className={searchType === 'invoice_number' ? "bg-blue-50 text-blue-600" : ""}>
                                        <Filter className="h-3.5 w-3.5 mr-2" /> Invoice Number
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
                            if (showDeleteDialog || isDropdownOpen) return;
                            navigate(`/purchases/purchase-invoices/${row.original.id}`);
                        }}
                        layout={{ classes: { table: "cursor-pointer [&_tr:hover]:bg-gray-50" } }}
                    />
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
                                            value={paymentForm.amount || ""}
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
                                            value={paymentForm.discount || ""}
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
