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
    FileText
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
import { getDebitNotes, deleteDebitNote, getDebitNoteById, updatePurchaseInvoiceStatus, checkDebitNoteExistsForInvoice, getPartyNamesDropdown, getInvoiceNumbersDropdown } from '../service/debitNote.service';
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
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
    const [customDateFrom, setCustomDateFrom] = useState<string>('');
    const [customDateTo, setCustomDateTo] = useState<string>('');
    const [showCustomDateRange, setShowCustomDateRange] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const navigate = useNavigate();

    // Fetch autocomplete data for search suggestions
    const fetchAutocompleteData = useCallback(async () => {
        setIsDropdownLoading(true);
        try {
            // Use dedicated dropdown endpoints that return simple arrays
            const [customerResponse, debitNoteNumberResponse] = await Promise.all([
                getPartyNamesDropdown(),
                getInvoiceNumbersDropdown()
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
            const apiParams = {
                page: params.pageIndex + 1, // DataGrid uses 0-based indexing
                per_page: params.pageSize,
                sort: params.sorting?.[0]?.id,
                order: params.sorting?.[0]?.desc ? 'desc' : 'asc',
                ...(searchTerm && {
                    search: searchTerm
                }),
                status: selectedStatus === 'all' ? '' : selectedStatus,
                ...(selectedDateFilter !== 'all' && {
                    date_filter: selectedDateFilter
                }),
                ...(showCustomDateRange && customDateFrom && {
                    date_from: customDateFrom
                }),
                ...(showCustomDateRange && customDateTo && {
                    date_to: customDateTo
                })
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
                    status: note.invoice_id ? 'credited' : 'unpaid'
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
    }, [debouncedSearchTerm, searchType, selectedStatus, refreshKey, selectedDateFilter, customDateFrom, customDateTo, showCustomDateRange]);

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
                    className="justify-start"
                />
            ),
            cell: (info) => (
                <div className="text-sm font-medium text-primary">
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
            accessorKey: "invoice_no",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Invoice No"
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
                headerClassName: "min-w-[120px]",
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
                                        setIsOpen(false);
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
                                        setIsOpen(false);
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
        <div className="container-fluid p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Debit Notes</h1>
                <div className="flex items-center gap-2">
                    <div className="w-44">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-full gap-1">
                                    <Filter className="h-3.5 w-3.5" />
                                    <span className="truncate">
                                        {selectedStatus === 'all' && 'All Debit Notes'}
                                        {selectedStatus === 'unpaid' && 'Unpaid'}
                                        {selectedStatus === 'credited' && 'Credited'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px]">
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedStatus('all');
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-gray-500" />
                                    <span>All Debit Notes</span>
                                    {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedStatus('unpaid');
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-red-500" />
                                    <span>Unpaid</span>
                                    {selectedStatus === 'unpaid' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedStatus('credited');
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-green-500" />
                                    <span>Credited</span>
                                    {selectedStatus === 'credited' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="w-36">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-full gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                        {selectedDateFilter === 'all' && 'All Dates'}
                                        {selectedDateFilter === 'today' && 'Today'}
                                        {selectedDateFilter === 'this_week' && 'This Week'}
                                        {selectedDateFilter === 'last_week' && 'Last Week'}
                                        {selectedDateFilter === 'this_month' && 'This Month'}
                                        {selectedDateFilter === 'last_month' && 'Last Month'}
                                        {selectedDateFilter === 'last_365_days' && 'Last 365 Days'}
                                        {showCustomDateRange && 'Custom Range'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px]">
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedDateFilter('all');
                                        setShowCustomDateRange(false);
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-gray-500" />
                                    <span>All Dates</span>
                                    {selectedDateFilter === 'all' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedDateFilter('today');
                                        setShowCustomDateRange(false);
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-blue-500" />
                                    <span>Today</span>
                                    {selectedDateFilter === 'today' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedDateFilter('this_week');
                                        setShowCustomDateRange(false);
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-green-500" />
                                    <span>This Week</span>
                                    {selectedDateFilter === 'this_week' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedDateFilter('last_week');
                                        setShowCustomDateRange(false);
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-yellow-500" />
                                    <span>Last Week</span>
                                    {selectedDateFilter === 'last_week' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedDateFilter('this_month');
                                        setShowCustomDateRange(false);
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-purple-500" />
                                    <span>This Month</span>
                                    {selectedDateFilter === 'this_month' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedDateFilter('last_month');
                                        setShowCustomDateRange(false);
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-orange-500" />
                                    <span>Last Month</span>
                                    {selectedDateFilter === 'last_month' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedDateFilter('last_365_days');
                                        setShowCustomDateRange(false);
                                        setRefreshKey(prev => prev + 1);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-indigo-500" />
                                    <span>Last 365 Days</span>
                                    {selectedDateFilter === 'last_365_days' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setShowCustomDateRange(true);
                                        setSelectedDateFilter('custom');
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-pink-500" />
                                    <span>Custom Range</span>
                                    {showCustomDateRange && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <Button
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => navigate('/debit-note/create')}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Create Debit Note
                        </span>
                    </Button>
                </div>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="p-4 border-b">
                    <div className="relative w-fit">
                        <div className="flex">
                            <div className="relative">
                                <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="h-9 w-80 justify-start px-3" disabled={isDropdownLoading}>
                                            {isDropdownLoading ? (
                                                <span className="flex items-center">
                                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                    Loading...
                                                </span>
                                            ) : (
                                                searchTerm || (searchType === 'party_name' ? 'Select by party name...' : 'Select by debit note number...')
                                            )}
                                            {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4" />}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                setSearchTerm('');
                                                setRefreshKey(prev => prev + 1);
                                            }}
                                            className={!searchTerm ? "bg-blue-50 text-blue-600" : ""}
                                        >
                                            <span className="text-gray-500">Show All {searchType === 'party_name' ? 'Parties' : 'Debit Notes'}</span>
                                        </DropdownMenuItem>
                                        {isDropdownLoading ? (
                                            <DropdownMenuItem disabled>
                                                <div className="flex items-center justify-center w-full py-2">
                                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                    Loading options...
                                                </div>
                                            </DropdownMenuItem>
                                        ) : (
                                            <>
                                                {searchType === 'party_name' ? 
                                                    allCustomerNames.map((item: PartyNameItem) => {
                                                        const displayValue = item.name;
                                                        const keyValue = item.uuid;

                                                        return (
                                                            <DropdownMenuItem
                                                                key={keyValue}
                                                                onClick={() => {
                                                                    setSearchTerm(displayValue);
                                                                    setRefreshKey(prev => prev + 1);
                                                                }}
                                                                className={searchTerm === displayValue ? "bg-blue-50 text-blue-600" : ""}
                                                            >
                                                                {displayValue}
                                                            </DropdownMenuItem>
                                                        );
                                                    }) :
                                                    allDebitNoteNumbers.map((item: string, index: number) => {
                                                        const displayValue = item;
                                                        const keyValue = index;

                                                        return (
                                                            <DropdownMenuItem
                                                                key={keyValue}
                                                                onClick={() => {
                                                                    setSearchTerm(displayValue);
                                                                    setRefreshKey(prev => prev + 1);
                                                                }}
                                                                className={searchTerm === displayValue ? "bg-blue-50 text-blue-600" : ""}
                                                            >
                                                                {displayValue}
                                                            </DropdownMenuItem>
                                                        );
                                                    })
                                                }
                                                {((searchType === 'party_name' ? allCustomerNames : allDebitNoteNumbers).length === 0) && (
                                                    <DropdownMenuItem disabled>
                                                        <span className="text-gray-500">No {searchType === 'party_name' ? 'parties' : 'debit notes'} found</span>
                                                    </DropdownMenuItem>
                                                )}
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <DropdownMenu open={showFilterDropdown} onOpenChange={setShowFilterDropdown}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 rounded-md px-3 text-sm text-gray-600 ml-2"
                                        >
                                            <Filter className="h-3.5 w-3.5 mr-1 text-blue-500" />
                                            {searchTerm ? `${searchType === 'party_name' ? 'Party' : 'Debit Note'}: ${searchTerm}` : 'Filter by'}
                                            <ChevronDown className="h-3 w-3 ml-1" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-48">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleSearchTypeChange('party_name');
                                                setShowFilterDropdown(false);
                                            }}
                                            className={searchType === 'party_name' ? "bg-blue-50 text-blue-600" : ""}
                                        >
                                            <Filter className="h-3.5 w-3.5 mr-2" />
                                            Party Name
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleSearchTypeChange('debit_note_number');
                                                setShowFilterDropdown(false);
                                            }}
                                            className={searchType === 'debit_note_number' ? "bg-blue-50 text-blue-600" : ""}
                                        >
                                            <Filter className="h-3.5 w-3.5 mr-2" />
                                            Debit Note Number
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                    
                    {/* Custom Date Range Inputs */}
                    {showCustomDateRange && (
                        <div className="flex items-center gap-2 mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">From:</label>
                                <Input
                                    type="date"
                                    value={customDateFrom}
                                    onChange={(e) => setCustomDateFrom(e.target.value)}
                                    className="h-8 w-32 text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">To:</label>
                                <Input
                                    type="date"
                                    value={customDateTo}
                                    onChange={(e) => setCustomDateTo(e.target.value)}
                                    className="h-8 w-32 text-sm"
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (customDateFrom && customDateTo) {
                                        setRefreshKey(prev => prev + 1);
                                    }
                                }}
                                className="h-8 px-3"
                            >
                                Apply
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowCustomDateRange(false);
                                    setCustomDateFrom('');
                                    setCustomDateTo('');
                                    setSelectedDateFilter('all');
                                    setRefreshKey(prev => prev + 1);
                                }}
                                className="h-8 px-3"
                            >
                                Clear
                            </Button>
                        </div>
                    )}
                </div>

                <DataGrid
                    data={debitNotes}
                    columns={columns}
                    loading={isLoading}
                    getRowId={(row) => row.id}
                    onFetchData={fetchDebitNotes}
                    onRowClick={(row) => navigate(`/debit-note/view/${row.original.id}`)}
                />
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
