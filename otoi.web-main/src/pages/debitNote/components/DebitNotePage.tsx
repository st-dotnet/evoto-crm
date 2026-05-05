import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
    DataGrid,
    DataGridColumnHeader,
    DataGridRowSelect,
    DataGridRowSelectAll,
} from "@/components";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
    User
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
import { toast } from "sonner";
import { TDataGridRequestParams } from "@/components";
import { SpinnerDotted } from 'spinners-react';
import { getDebitNotes, deleteDebitNote, getDebitNoteById, updatePurchaseInvoiceStatus, checkDebitNoteExistsForInvoice, getPartyNamesDropdown, getInvoiceNumbersDropdown, getDebitNoteNumbersDropdown } from '../service/debitNote.service';
import axios from 'axios';

interface DebitNote {
    id: string;
    date: string;
    debit_note_number: string;
    party_name: string;
    invoice_no: string;
    amount: number;
    status: string;
}

interface PartyNameItem {
    uuid: string;
    name: string;
}

interface DebitNoteNumberItem {
    uuid: string;
    debit_note_number: string;
    customer_id?: string;
}

const DebitNotePage = () => {
    const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
    const [rawDebitNotesData, setRawDebitNotesData] = useState<any[]>([]);
    const [invoicesWithDebitNotes, setInvoicesWithDebitNotes] = useState<Set<string>>(new Set());
    const [isCheckingDebitNote, setIsCheckingDebitNote] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'unpaid' | 'credited'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'party_name' | 'debit_note_number'>('party_name');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [allCustomerNames, setAllCustomerNames] = useState<PartyNameItem[]>([]);
    const [allDebitNoteNumbers, setAllDebitNoteNumbers] = useState<string[]>([]);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isDropdownLoading, setIsDropdownLoading] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [debitNoteToDelete, setDebitNoteToDelete] = useState<string | null>(null);
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>('last_365_days');
    const [isDeleting, setIsDeleting] = useState(false);
    const navigate = useNavigate();

    // Helper function to convert date filter to date range
    const getDateRange = useCallback(() => {
        const today = new Date();

        // Helper to format date as YYYY-MM-DD in local time
        const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const todayStr = formatDate(today);

        switch (selectedDateFilter) {
            case 'today':
                return {
                    date_from: todayStr,
                    date_to: todayStr
                };
            case 'this_week': {
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                return {
                    date_from: formatDate(startOfWeek),
                    date_to: formatDate(endOfWeek)
                };
            }
            case 'last_week': {
                const startOfLastWeek = new Date(today);
                startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
                const endOfLastWeek = new Date(startOfLastWeek);
                endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
                return {
                    date_from: formatDate(startOfLastWeek),
                    date_to: formatDate(endOfLastWeek)
                };
            }
            case 'this_month': {
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                return {
                    date_from: formatDate(startOfMonth),
                    date_to: formatDate(endOfMonth)
                };
            }
            case 'last_month': {
                const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                return {
                    date_from: formatDate(startOfLastMonth),
                    date_to: formatDate(endOfLastMonth)
                };
            }
            case 'last_365_days': {
                const lastYear = new Date(today);
                lastYear.setDate(today.getDate() - 365);
                return {
                    date_from: formatDate(lastYear),
                    date_to: todayStr
                };
            }
            default:
                return {};
        }
    }, [selectedDateFilter]);

    // Fetch autocomplete data for search suggestions
    const fetchAutocompleteData = useCallback(async () => {
        setIsDropdownLoading(true);
        try {
            // Use dedicated dropdown endpoints that return simple arrays
            const [customerResponse, debitNoteNumberResponse] = await Promise.all([
                getPartyNamesDropdown(),
                getDebitNoteNumbersDropdown()
            ]);

            if (customerResponse.success && customerResponse.data) {
                // Handle the party names dropdown response - should be array of {uuid, name} objects
                const partyNames = Array.isArray(customerResponse.data)
                    ? customerResponse.data.filter((item: any) => item && item.name && typeof item.name === 'string')
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                    : [];
                setAllCustomerNames(partyNames);
            } else {
                setAllCustomerNames([]);
            }

            if (debitNoteNumberResponse.success && debitNoteNumberResponse.data) {
                // Handle the debit note numbers dropdown response - should be simple array
                const debitNoteNumbers = Array.isArray(debitNoteNumberResponse.data)
                    ? debitNoteNumberResponse.data.filter((item: any) => item && typeof item === 'string')
                    : [];
                setAllDebitNoteNumbers(debitNoteNumbers);
            } else {
                setAllDebitNoteNumbers([]);
            }
        } catch (error) {
            setAllCustomerNames([]);
            setAllDebitNoteNumbers([]);
        } finally {
            setIsDropdownLoading(false);
        }
    }, [refreshKey]);

    useEffect(() => {
        fetchAutocompleteData();
    }, [fetchAutocompleteData]);

    const handleSearchTypeChange = (type: 'party_name' | 'debit_note_number') => {
        setSearchType(type);
        setShowSuggestions(false);
        setSearchTerm('');
        setFilteredSuggestions(type === 'party_name' ? allCustomerNames.map(item => item.name) : allDebitNoteNumbers);
    };

    useEffect(() => {
        if (searchTerm) {
            const suggestions = searchType === 'party_name'
                ? allCustomerNames.filter(item =>
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                ).map(item => item.name)
                : allDebitNoteNumbers.filter(item =>
                    item.toLowerCase().includes(searchTerm.toLowerCase())
                );
            setFilteredSuggestions(suggestions);
        } else {
            const suggestions = searchType === 'party_name' ? allCustomerNames.map(item => item.name) : allDebitNoteNumbers;
            setFilteredSuggestions(suggestions);
        }
    }, [searchTerm, searchType, allCustomerNames, allDebitNoteNumbers]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch debit notes with search and filters
    const fetchDebitNotes = useCallback(async (params: TDataGridRequestParams) => {
        setIsLoading(true);
        try {
            const dateRange = getDateRange();
            const apiParams = {
                page: params.pageIndex + 1, // DataGrid uses 0-based indexing
                per_page: params.pageSize,
                sort: params.sorting?.[0]?.id,
                order: params.sorting?.[0]?.desc ? 'desc' : 'asc',
                ...(searchTerm && {
                    search: searchTerm
                }),
                status: selectedStatus === 'all' ? '' : selectedStatus,
                ...(dateRange.date_from && {
                    date_from: dateRange.date_from
                }),
                ...(dateRange.date_to && {
                    date_to: dateRange.date_to
                }),
            };

            const response = await getDebitNotes(apiParams);

            if (response.success && response.data) {
                // Handle the actual API response structure: {data: {debit_notes: [...], pagination: {...}}}
                const notesArray = response.data.data?.debit_notes || response.data.debit_notes || [];

                // Store the raw data for edit navigation
                setRawDebitNotesData(notesArray);

                const formattedData = Array.isArray(notesArray) ? notesArray.map((note: any) => ({
                    id: note.uuid?.toString() || note.id?.toString() || '',
                    date: note.debit_note_date || note.date || '',
                    debit_note_number: note.debit_note_number || '',
                    party_name: note.vendor_name || note.customer_name || (() => {
                        const customer = note.customer;
                        if (customer) {
                            const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                            return name || note.party_name || '';
                        }
                        return note.party_name || '';
                    })(),
                    invoice_no: note.invoice_number || note.invoice_no || '',
                    amount: note.total_amount || note.amount || 0,
                    status: note.status || 'unpaid'
                })) : [];

                // Update the state with the formatted data
                setDebitNotes(formattedData);

                // Check if backend returned pagination info
                let totalCount = response.data.data?.pagination?.total || response.data.pagination?.total || response.data.total;

                if (!totalCount) {
                    // Backend didn't return pagination info, fetch all items to get total count
                    try {
                        const allItemsResponse = await getDebitNotes({
                            per_page: 1000, // Fetch all items
                            sort: apiParams.sort,
                            order: apiParams.order,
                            ...(searchTerm && {
                                [searchType === 'party_name' ? 'party_name' : 'debit_note_number']: searchTerm
                            }),
                            status: selectedStatus === 'all' ? '' : selectedStatus
                        });

                        if (allItemsResponse.success && allItemsResponse.data) {
                            const allNotesArray = allItemsResponse.data.data?.debit_notes || allItemsResponse.data.debit_notes || [];
                            totalCount = Array.isArray(allNotesArray) ? allNotesArray.length : formattedData.length;
                        } else {
                            totalCount = formattedData.length;
                        }
                    } catch (error) {
                        totalCount = formattedData.length;
                    }
                }

                return {
                    data: formattedData,
                    totalCount: totalCount,
                };
            } else {
                throw new Error(response.error || 'Failed to fetch debit notes');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to fetch debit notes');
            setDebitNotes([]);
            return {
                data: [],
                totalCount: 0,
            };
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchTerm, searchType, selectedStatus, refreshKey, getDateRange]);

    useEffect(() => {
        fetchDebitNotes({
            pageIndex: 0,
            pageSize: 10,
            sorting: []
        });
    }, [fetchDebitNotes, refreshKey]);

    // Filter debit notes by status (kept for compatibility but not used with server-side filtering)
    const filteredDebitNotes = useMemo(() => {
        return debitNotes;
    }, [debitNotes]);

    const handleDelete = async (id: string) => {
        window.event?.stopPropagation();
        window.event?.preventDefault();
        setDebitNoteToDelete(id);
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (!debitNoteToDelete || isDeleting) return;
        setIsDeleting(true);
        try {
            // Get the debit note details to find linked invoice
            const debitNoteResponse = await getDebitNoteById(debitNoteToDelete);
            const linkedInvoiceId = debitNoteResponse.success && debitNoteResponse.data?.invoice_id;

            const response = await deleteDebitNote(debitNoteToDelete);
            if (response.success) {
                toast.success('Debit note deleted successfully');
                setRefreshKey(prev => prev + 1); // Refresh autocomplete data

                // Update purchase invoice status if there was a linked invoice
                if (linkedInvoiceId) {
                    try {
                        await updatePurchaseInvoiceStatus(linkedInvoiceId, 'unpaid');
                    } catch (statusError) {
                        // Don't show error to user as deletion was successful
                    }
                }

                // Trigger a custom event to notify CreateDebitNotePage to refresh invoice dropdown
                window.dispatchEvent(new CustomEvent('debitNoteDeleted', {
                    detail: { debitNoteId: debitNoteToDelete }
                }));
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete debit note');
        } finally {
            setIsDeleting(false);
        }
        setShowDeleteDialog(false);
        setDebitNoteToDelete(null);
    };

    const handleDeleteCancel = () => {
        setShowDeleteDialog(false);
        setDebitNoteToDelete(null);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            unpaid: 'bg-red-100 text-red-800',
            credited: 'bg-green-100 text-green-800',
            partial: 'bg-yellow-100 text-yellow-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };

    const columns = useMemo<ColumnDef<DebitNote>[]>(() => [
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
            accessorKey: "debit_note_number",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Debit Note Number"
                    column={column}
                    className="justify-center"
                />
            ),
            cell: (info) => (
                <div className="text-sm font-medium text-primary hover:underline text-center">
                    {info.getValue() as string}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[150px]",
            },
        },
        {
            accessorKey: "party_name",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Party Name"
                    column={column}
                    className="justify-center"
                />
            ),
            cell: (info) => (
                <div className="text-sm text-gray-900 text-center">
                    {info.getValue() as string}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[180px]",
            },
        },
        {
            accessorKey: "invoice_no",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Invoice No"
                    column={column}
                    className="justify-center"
                />
            ),
            cell: (info) => (
                <div className="text-sm text-gray-900 text-center">
                    {info.getValue() as string}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[120px]",
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Amount"
                    column={column}
                    className="justify-center"
                />
            ),
            cell: (info) => (
                <div className="text-sm font-medium text-center">
                    ₹{(info.getValue() as number)?.toLocaleString('en-IN') || '0'}
                </div>
            ),
            meta: {
                headerClassName: "min-w-[100px]",
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
            cell: (info) => {
                const status = info.getValue() as string;
                return (
                    <div className="flex items-center justify-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(status)}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
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
                return (
                    <div className="flex justify-center">
                        <DropdownMenu>
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
                                        // Find raw data for this specific debit note
                                        const rawDebitNote = rawDebitNotesData.find(note =>
                                            (note.uuid?.toString() || note.id?.toString()) === row.original.id
                                        );
                                        navigate(`/debit-note/view/${row.original.id}`, {
                                            state: { debitNoteData: rawDebitNote }
                                        });
                                    }}
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Find the raw data for this specific debit note
                                        const rawDebitNote = rawDebitNotesData.find(note =>
                                            (note.uuid?.toString() || note.id?.toString()) === row.original.id
                                        );
                                        navigate(`/debit-note/edit/${row.original.id}`, {
                                            state: { debitNoteData: rawDebitNote }
                                        });
                                    }}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.nativeEvent.stopImmediatePropagation();
                                        handleDelete(row.original.id);
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
        <div className="container-fluid p-6">            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">Debit Notes</h1>
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
                                    selectedStatus === 'unpaid' ? 'bg-orange-50 border-orange-200 shadow-orange-200/50' :
                                    'bg-blue-50 border-blue-200 shadow-blue-200/50'
                                }`}
                                style={{
                                    width: '90px',
                                    transform: `translateX(${selectedStatus === 'all' ? '0px' :
                                        selectedStatus === 'unpaid' ? '90px' : '180px'
                                        })`
                                }}
                            />

                            {/* Status Buttons */}
                            <button
                                onClick={() => { setSelectedStatus('all'); setRefreshKey(prev => prev + 1); }}
                                className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'all' ? 'text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('unpaid'); setRefreshKey(prev => prev + 1); }}
                                className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'unpaid' ? 'text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Unpaid
                            </button>
                            <button
                                onClick={() => { setSelectedStatus('credited'); setRefreshKey(prev => prev + 1); }}
                                className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'credited' ? 'text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Credited
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
                                        {selectedDateFilter === 'last_365_days' && 'Last 365 Days'}
                                        {!selectedDateFilter && 'All Time'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px]">
                                {[
                                    { val: 'today', label: 'Today' },
                                    { val: 'this_week', label: 'This Week' },
                                    { val: 'last_week', label: 'Last Week' },
                                    { val: 'this_month', label: 'This Month' },
                                    { val: 'last_month', label: 'Last Month' },
                                    { val: 'last_365_days', label: 'Last 365 Days' },
                                ].map(({ val, label }) => (
                                    <DropdownMenuItem key={val} onClick={() => { setSelectedDateFilter(val); setRefreshKey(prev => prev + 1); }}>
                                        {label}
                                    </DropdownMenuItem>
                                ))}
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
                                            <span className="flex items-center">
                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Loading...
                                            </span>
                                        ) : (
                                            <span className="truncate text-left">
                                                {searchTerm || (searchType === 'party_name' ? 'Search by party name...' : 'Search by debit note #...')}
                                            </span>
                                        )}
                                        {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto rounded-xl shadow-xl">
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setSearchTerm('');
                                            setRefreshKey(prev => prev + 1);
                                        }}
                                        className="text-gray-500 italic"
                                    >
                                        Clear search
                                    </DropdownMenuItem>
                                    {isDropdownLoading ? (
                                        <div className="p-4 text-center text-sm text-gray-500">Loading suggestions...</div>
                                    ) : (
                                        <>
                                            {searchType === 'party_name' ?
                                                allCustomerNames.map((item: PartyNameItem) => (
                                                    <DropdownMenuItem
                                                        key={item.uuid}
                                                        onClick={() => {
                                                            setSearchTerm(item.name);
                                                            setRefreshKey(prev => prev + 1);
                                                        }}
                                                        className={`py-2 ${searchTerm === item.name ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                    >
                                                        {item.name}
                                                    </DropdownMenuItem>
                                                )) :
                                                allDebitNoteNumbers.map((item: string, index: number) => (
                                                    <DropdownMenuItem
                                                        key={index}
                                                        onClick={() => {
                                                            setSearchTerm(item);
                                                            setRefreshKey(prev => prev + 1);
                                                        }}
                                                        className={`py-2 ${searchTerm === item ? "bg-blue-50 text-blue-600 font-medium" : ""}`}
                                                    >
                                                        {item}
                                                    </DropdownMenuItem>
                                                ))
                                            }
                                            {((searchType === 'party_name' ? allCustomerNames : allDebitNoteNumbers).length === 0) && (
                                                <div className="p-4 text-center text-sm text-gray-500">No suggestions found</div>
                                            )}
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Desktop Segmented Filter Type */}
                        <div className="hidden sm:flex relative p-1 bg-gray-100 rounded-lg border border-gray-200/60 shadow-inner w-fit h-10 items-center gap-1">
                            <div
                                className={`absolute inset-y-1 rounded-md border shadow-sm transition-all duration-300 ease-out ${searchType === 'party_name' ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                                    }`}
                                style={{
                                    width: '100px',
                                    transform: `translateX(${searchType === 'party_name' ? '0px' : '102px'})`
                                }}
                            />
                            <button
                                onClick={() => handleSearchTypeChange('party_name')}
                                className={`relative w-[100px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === 'party_name' ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Party Name
                            </button>
                            <button
                                onClick={() => handleSearchTypeChange('debit_note_number')}
                                className={`relative w-[100px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === 'debit_note_number' ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Debit Note No.
                            </button>
                        </div>

                        {/* Mobile Dropdown Fallback */}
                        <div className="sm:hidden">
                            <DropdownMenu open={showFilterDropdown} onOpenChange={setShowFilterDropdown}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-xl px-4 text-sm font-bold text-gray-900 bg-white shadow-sm border-gray-200 hover:bg-gray-50 gap-2"
                                    >
                                        <Filter className="h-4 w-4 text-blue-500" />
                                        {searchType === 'party_name' ? 'Party Name' : 'Debit Note Number'}
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-48 rounded-xl shadow-xl">
                                    <DropdownMenuItem onClick={() => handleSearchTypeChange('party_name')}>
                                        <User className="h-4 w-4 mr-2 text-gray-400" /> Party Name
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSearchTypeChange('debit_note_number')}>
                                        <FileText className="h-4 w-4 mr-2 text-gray-400" /> Debit Note Number
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                    <div className="w-full sm:w-auto sm:ml-auto">
                        <Button
                            size="sm"
                            className="h-10 gap-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200/50 transition-all active:scale-95 w-full sm:w-auto"
                            onClick={() => navigate('/debit-note/create')}
                        >
                            <Plus className="h-4 w-4" />
                            <span className="font-bold">Create Debit Note</span>
                        </Button>
                    </div>
                </div>
                </div>

                <div className="overflow-auto relative w-full">
                    <DataGrid
                        data={debitNotes}
                        columns={columns}
                        loading={isLoading}
                        getRowId={(row) => row.id}
                        onFetchData={fetchDebitNotes}
                        onRowClick={(row) => navigate(`/debit-note/view/${row.original.id}`)}
                    />
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <div className="text-center pt-6 pb-4">
                        <h2 className="text-xl font-semibold text-foreground whitespace-nowrap">
                            Delete Debit Note
                        </h2>
                        <p className="text-sm text-muted-foreground mt-3 px-4">
                            Are you sure you want to delete this debit note? This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex justify-center gap-3 pb-6">
                        <Button variant="outline" onClick={handleDeleteCancel}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DebitNotePage;
