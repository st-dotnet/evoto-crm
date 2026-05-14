import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DataGrid, DataGridColumnHeader, DataGridRowSelect, DataGridRowSelectAll } from "@/components";
import { Button } from "@/components/ui/button";
import { Plus, Settings, FileText, ChevronDown, Search, Calendar, Filter, Check, Circle, CircleOff, CircleCheck, MoreVertical, Edit, Eye, Copy, Trash2, AlertCircle, List, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { getQuotations, deleteQuotation, getQuotationById, createQuotation, fetchQuotationItems, getAllCustomersDropdown, getQuotationNumbersDropdown } from "../services/quotation.services";
import { createInvoiceFromQuotation } from "@/pages/invoice/services/invoice.service";
import { toast } from "sonner";
import { TDataGridRequestParams } from "@/components";
import { SpinnerDotted } from 'spinners-react';


interface Quotation {
  id: string;
  date: string;
  quotation_number: number;
  party_name: string;
  due_in: string;
  amount: number;
  status: string;
}

interface PaginationData {
  total: number;
  items_per_page: number;
  current_page: number;
  last_page: number;
  from: number;
  to: number;
  prev_page_url: string | null;
  next_page_url: string | null;
  first_page_url: string | null;
}

interface QuotationItem {
  uuid: string;
  quotation_id: string;
  item_id: string;
  item_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  customer_name: string;
  quotation_number: string;
  created_at: string;
  updated_at: string;
}

interface QuotationItemsResponse {
  data: QuotationItem[];
  pagination: {
    total: number;
    items_per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
  };
}

const statusColors: any = {
  open: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50",
  closed: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50",
  converted: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/50",
  default: "bg-gray-100 dark:bg-gray-100 text-gray-700 dark:text-gray-900 border-gray-200 dark:border-gray-200"
};

const QuotationPage = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'open' | 'closed' | 'converted'>('all');
  const [activeTab, setActiveTab] = useState<'quotations' | 'items'>('quotations');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'party_name' | 'quotation_number'>('party_name');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allCustomerNames, setAllCustomerNames] = useState<string[]>([]);
  const [allQuotationNumbers, setAllQuotationNumbers] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isDropdownLoading, setIsDropdownLoading] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [sorting, setSorting] = useState([{ id: 'due_in', desc: false }]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState<PaginationData>({

    total: 0,
    items_per_page: 5,
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0,
    prev_page_url: null,
    next_page_url: null,
    first_page_url: null,
  });
  const navigate = useNavigate();

  // Fetch customer names and quotation numbers for autocomplete
  const fetchAutocompleteData = useCallback(async () => {
    try {
      setIsDropdownLoading(true);

      // Fetch all customers using the dedicated dropdown API
      const customerResponse = await getAllCustomersDropdown();
      if (customerResponse.success && customerResponse.data) {
        const customersData = customerResponse.data;
        const customerNames = customersData.map((customer: any) => customer.name).filter((name: string) => name && name !== 'N/A');
        setAllCustomerNames(customerNames);
      }

      // Fetch all quotation numbers using the dedicated dropdown API
      const quotationResponse = await getQuotationNumbersDropdown();
      if (quotationResponse.success && quotationResponse.data) {
        const quotationsData = quotationResponse.data.data || quotationResponse.data;
        const quotationNumbers = quotationsData.map((q: any) => q.quotation_number).filter((num: any) => num);
        setAllQuotationNumbers(quotationNumbers);
      }
    } catch (error) {
      // console.error('Error fetching autocomplete data:', error);
    } finally {
      setIsDropdownLoading(false);
    }
  }, []);

  // Fetch autocomplete data on component mount and when search type changes
  useEffect(() => {
    fetchAutocompleteData();
  }, [fetchAutocompleteData]);

  // Refetch data when search type changes
  useEffect(() => {
    fetchAutocompleteData();
  }, [searchType]);


  // Handle search type change
  const handleSearchTypeChange = (type: 'party_name' | 'quotation_number') => {
    setSearchType(type);
    setShowSuggestions(false);
    setSearchTerm('');
    // Clear filtered suggestions immediately for better UX
    setFilteredSuggestions(type === 'party_name' ? allCustomerNames : allQuotationNumbers);
  };

  // Filter suggestions based on search term and type
  useEffect(() => {
    if (searchTerm) {
      const suggestions = searchType === 'party_name'
        ? allCustomerNames.filter(name =>
          name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : allQuotationNumbers.filter(number =>
          number.toLowerCase().includes(searchTerm.toLowerCase())
        );
      setFilteredSuggestions(suggestions);
    } else {
      // Update suggestions but don't show them automatically
      const suggestions = searchType === 'party_name' ? allCustomerNames : allQuotationNumbers;
      setFilteredSuggestions(suggestions);
    }
  }, [searchTerm, searchType, allCustomerNames, allQuotationNumbers]);

  // Fetch quotations from database
  const fetchQuotations = useCallback(async (params: TDataGridRequestParams) => {

    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(params.pageIndex + 1));
      queryParams.set("items_per_page", String(params.pageSize));

      if (params.sorting?.[0]?.id) {
        const sortField = params.sorting[0].id === 'due_in' ? 'valid_till' : params.sorting[0].id;
        queryParams.set("sort", sortField);
        queryParams.set("order", params.sorting[0].desc ? "desc" : "asc");
      }

      if (searchTerm) {
        queryParams.set("search", searchTerm);
        queryParams.set(searchType, searchTerm);
      }

      const response = await getQuotations({
        search: searchTerm,
        party_name: searchType === 'party_name' ? searchTerm : '',
        quotation_number: searchType === 'quotation_number' ? searchTerm : '',
        status: selectedStatus === 'all' ? '' : selectedStatus, // Empty string fetches all statuses without API exact match issue
        page: params.pageIndex + 1,
        per_page: params.pageSize,
        sort: 'valid_till', // Always sort by due date to show urgent items first
        order: 'asc' // Ascending order (fewest days first)
      });

      if (response.success && response.data) {
        const quotationsData = response.data.data || [];
        const paginationData = response.data.pagination || {};

        // Transform data to match interface
        const transformedQuotations = quotationsData.map((item: any) => ({
          id: item.uuid,
          date: item.quotation_date || item.created_at,
          quotation_number: item.quotation_number,
          party_name: item.customer_name || 'N/A',
          due_in: item.valid_till ? (() => {
            const daysRemaining = Math.ceil((new Date(item.valid_till).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            if (daysRemaining < 0) {
              return <span className="text-red-600 font-medium">Overdue by {Math.abs(daysRemaining)} days</span>;
            } else if (daysRemaining === 0) {
              return <span className="text-red-600 font-medium">0 days</span>;
            } else {
              return `${daysRemaining} days`;
            }
          })() : 'N/A',
          amount: item.total_amount || 0,
          status: item.status || 'open',
        }));

        setQuotations(transformedQuotations);
        setPagination(paginationData);

        return {
          data: transformedQuotations,
          totalCount: paginationData.total || 0,
        };
      } else {
        toast.error(response.error || 'Failed to fetch quotations');
        return {
          data: [],
          totalCount: 0,
        };
      }
    } catch (error) {
      // console.error('Error fetching quotations:', error);
      toast.error('Failed to fetch quotations');
      return {
        data: [],
        totalCount: 0,
      };
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, searchType, selectedStatus]);


  const MobileView = ({
    onEdit,
    onDetails,
    onDelete,
    onDuplicate
  }: {
    onEdit: (id: string) => void;
    onDetails: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
  }) => {
    return (
      <div className="flex flex-col lg:hidden border-t border-gray-200 dark:border-gray-100">
        {quotations.map((quotation) => (
          <div
            key={quotation.id}
            className="flex justify-between items-center py-4 px-5 border-b border-gray-200 dark:border-gray-100 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-200/50 transition-all active:bg-gray-50 dark:active:bg-gray-200"
          >
            <div
              className="flex flex-col cursor-pointer grow pr-4"
              onClick={() => onDetails(quotation.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-gray-900 text-sm">#{quotation.quotation_number}</span>
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${quotation.status === 'open' ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-400' :
                  quotation.status === 'closed' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-400' :
                    quotation.status === 'converted' ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-400' :
                      'bg-gray-100 dark:bg-gray-100 text-gray-800 dark:text-gray-900'
                  }`}>
                  {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-900 mb-0.5">{quotation.party_name}</span>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(quotation.date).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-blue-400" />
                  Due: {typeof quotation.due_in === 'string' ? quotation.due_in : 'Overdue'}
                </span>
              </div>
              <div className="mt-2 font-bold text-primary text-sm">
                ₹{quotation.amount?.toLocaleString('en-IN') || '0'}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center size-9 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all shrink-0">
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 p-1 shadow-lg bg-white dark:bg-gray-200 border-gray-200 dark:border-gray-200">
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onEdit(quotation.id)}
                >
                  <Edit className="mr-2 h-4 w-4 text-gray-500" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onDetails(quotation.id)}
                >
                  <Eye className="mr-2 h-4 w-4 text-gray-500" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onDuplicate(quotation.id)}
                >
                  <Copy className="mr-2 h-4 w-4 text-gray-500" />
                  Duplicate
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100 dark:border-gray-100/10"></div>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                  onClick={() => onDelete(quotation.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {quotations.length === 0 && !isLoading && (
          <div className="p-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <Search className="text-3xl text-gray-200" />
              <span className="text-gray-400 text-sm font-medium">No quotations found.</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredquotation = useMemo(() => {
    if (selectedStatus === 'all') return quotations;
    return quotations.filter(inv => inv.status === selectedStatus);
  }, [quotations, selectedStatus]);

  // Debounce search term (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Refresh data when search changes
  useEffect(() => {
    setRefreshKey((prev: number) => prev + 1);
  }, [debouncedSearchTerm, searchType]);

  const handleDeleteConfirm = async () => {
    if (!quotationToDelete || isDeleting) return;
    setIsDeleting(true);
    const response = await deleteQuotation(quotationToDelete);
    if (response.success) {
      toast.success("Quotation deleted successfully");

      // Immediately remove the deleted quotation from UI
      setQuotations(prev => prev.filter(q => q.id !== quotationToDelete));

      // Update customer dropdown if this was the last quotation for that customer
      const deletedQuotation = quotations.find(q => q.id === quotationToDelete);
      if (deletedQuotation) {
        const remainingQuotations = quotations.filter(q => q.party_name === deletedQuotation.party_name && q.id !== quotationToDelete);
        if (remainingQuotations.length === 0) {
          // Remove customer from dropdown if no more quotations exist
          setAllCustomerNames(prev => prev.filter(name => name !== deletedQuotation.party_name));
        }

        // Remove quotation number from local dropdown state
        setAllQuotationNumbers(prev => prev.filter(q => q !== deletedQuotation.quotation_number.toString()));
      }

      fetchQuotations({ pageIndex: 0, pageSize: 5 });
      setRefreshKey(prev => prev + 1);
      setShowDeleteDialog(false);
    } else {
      toast.error(response.error || "Failed to delete quotation");
    }
    setQuotationToDelete(null);
    setIsDeleting(false);
  };

  const columns = useMemo<ColumnDef<Quotation>[]>(() => [
    {
      id: "select",
      header: () => (
        <div className="w-full flex items-center justify-center h-full p-0 m-0">
          <DataGridRowSelectAll />
        </div>
      ),
      cell: ({ row }) => (
        <div className="w-full flex items-center justify-center h-full p-0 m-0">
          <DataGridRowSelect row={row} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: {
        headerClassName: "w-12 text-center align-middle p-0 m-0",
        cellClassName: "text-center align-middle pointer-events-auto p-0 m-0",
        disableRowClick: true,
      },
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
        <div className="text-sm text-gray-900 dark:text-gray-900">
          {new Date(info.getValue() as string).toLocaleDateString()}
        </div>
      ),
      meta: {
        headerClassName: "min-w-[120px]",
      },
    },
    {
      accessorKey: "quotation_number",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Quotation Number"
          column={column}
          className="justify-start"
        />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-gray-900 dark:text-gray-900">
          {info.getValue() as string}
        </div>
      ),
      meta: {
        headerClassName: "min-w-[120px]",
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
        <div className="text-sm text-gray-900 dark:text-gray-900">
          {info.getValue() as string}
        </div>
      ),
      meta: {
        headerClassName: "min-w-[200px]",
      },
    },
    {
      accessorKey: "due_in",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Due In"
          column={column}
          className="justify-start"
        />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-900 dark:text-gray-900">
          {info.getValue() as string}
        </div>
      ),
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const getDaysValue = (value: string): number => {
          if (value === 'N/A') return 999999; // Put N/A at the end
          const match = value.match(/(\d+)/);
          return match ? parseInt(match[1]) : 999999;
        };

        const aValue = getDaysValue(rowA.getValue('due_in') as string);
        const bValue = getDaysValue(rowB.getValue('due_in') as string);

        return aValue - bValue; // Ascending order (fewest days first)
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
        <div className="text-sm font-medium text-right text-gray-900 dark:text-gray-900">
          ₹{(info.getValue() as number)?.toLocaleString('en-IN') || '0'}
        </div>
      ),
      meta: {
        headerClassName: "min-w-[120px] justify-end",
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
        const status = (info.getValue() as string)?.toLowerCase();

        return (
          <div className="flex items-center justify-center">
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all duration-300 ${statusColors[status] || statusColors.default}`}>
              <span className="w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse bg-current" />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </div>
          </div>
        );
      },
      meta: {
        headerClassName: "min-w-[120px]",
      },
    },
    {
      id: "actions",
      header: ({ column }) => (
        <DataGridColumnHeader title="Actions" column={column} className="justify-center" />
      ),
      enableSorting: false,
      meta: {
        headerClassName: "w-28",
        cellClassName: "text-gray-800 font-medium pointer-events-auto",
        disableRowClick: true,
      },
      cell: ({ row }) => {
        const [isOpen, setIsOpen] = useState(false);
        const handleEdit = (id: string) => {
          if (row.original.status === 'converted') {
            toast.error("This voucher cannot be edited because, it has been converted to a sales invoice.");
            setIsOpen(false);
            return;
          }
          navigate(`/quotes/${id}/edit`);
          setIsOpen(false);
        };

        const handleDeleteClick = (id: string) => {
          setQuotationToDelete(id);
          setShowDeleteDialog(true);
          setIsOpen(false);
        };

        const handleDuplicate = async (id: string) => {
          try {
            // Fetch the original quotation details
            const response = await getQuotationById(id);
            if (response.success && response.data) {
              const originalQuotation = response.data;

              // Transform data for CreateQuotationPage format
              const duplicateData = {
                quotationNo: '', // Will be auto-generated
                quotationDate: new Date().toISOString().split('T')[0],
                validFor: 30,
                validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'open',
                selectedCustomer: originalQuotation.customer,
                quotationItems: originalQuotation.items.map((item: any) => ({
                  id: '', // Remove existing ID
                  item_id: item.item_id,
                  item_name: item.product_name || item.description || "Item",
                  image: item.image,
                  description: item.description,
                  quantity: item.quantity,
                  price_per_item: item.unit_price,
                  discount: item.discount_percentage || 0,
                  tax: item.tax_percentage || 0,
                  amount: item.total_price,
                  measuring_unit_id: 1
                })),
                notes: originalQuotation.notes,
                terms: originalQuotation.terms_and_conditions,
                // Flag to indicate this is a duplicate
                isDuplicate: true,
                originalQuotationId: id
              };

              // Navigate to CreateQuotationPage with pre-filled data
              navigate('/quotes/new-quotation', {
                state: {
                  quotationData: duplicateData,
                  isDuplicate: true
                }
              });

              toast.success('Quotation opened for editing!');
              setIsOpen(false);
            } else {
              toast.error('Failed to fetch original quotation');
            }
          } catch (error) {
            // console.error('Error duplicating quotation:', error);
            toast.error('Failed to duplicate quotation');
          }
          setIsOpen(false);
        };

        return (
          <div
            className="flex justify-center"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex items-center justify-center text-sm text-primary hover:text-primary-active"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="bg-white dark:bg-gray-200 border-gray-200 dark:border-gray-200">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEdit(row.original.id);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/quotes/${row.original.id}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDuplicate(row.original.id);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteClick(row.original.id);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-900 tracking-tight">Quotations</h1>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-100 text-gray-500 dark:text-gray-500 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-gray-200">
              Voucher Management
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium italic">
              Create and manage client quotations
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Desktop Segmented Control */}
          <div className="hidden sm:flex items-center px-1.5 py-1 bg-gray-50/50 dark:bg-gray-100/50 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-gray-200/80 shadow-sm w-fit">
            <div className="flex items-center pl-2 pr-3 border-r border-gray-200/80 dark:border-gray-200/80 mr-1">
              <Filter className="h-3.5 w-3.5 text-gray-900 dark:text-gray-900 mr-2" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-900 dark:text-gray-900">Filters</span>
            </div>
            <div className="relative flex items-center">
              {/* Animated Slider Background with Glow */}
              <div
                className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${selectedStatus === 'all' ? 'bg-white dark:bg-gray-200 border-gray-200 dark:border-gray-200 shadow-gray-200/50 dark:shadow-black/50' :
                  selectedStatus === 'open' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 shadow-green-200/50 dark:shadow-green-900/20' :
                    selectedStatus === 'closed' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 shadow-red-200/50 dark:shadow-red-900/20' :
                      'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 shadow-purple-200/50 dark:shadow-purple-900/20'
                  }`}
                style={{
                  width: '86px',
                  transform: `translateX(${selectedStatus === 'all' ? '0px' :
                    selectedStatus === 'open' ? '86px' :
                      selectedStatus === 'closed' ? '172px' : '258px'
                    })`
                }}
              />

              <button
                onClick={() => { setSelectedStatus('all'); setRefreshKey(prev => prev + 1); }}
                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'all' ? 'text-gray-900 dark:text-gray-900' : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-800'}`}
              >
                All
              </button>
              <button
                onClick={() => { setSelectedStatus('open'); setRefreshKey(prev => prev + 1); }}
                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'open' ? 'text-gray-900 dark:text-gray-900' : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-800'}`}
              >
                Open
              </button>
              <button
                onClick={() => { setSelectedStatus('closed'); setRefreshKey(prev => prev + 1); }}
                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'closed' ? 'text-gray-900 dark:text-gray-900' : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-800'}`}
              >
                Closed
              </button>
              <button
                onClick={() => { setSelectedStatus('converted'); setRefreshKey(prev => prev + 1); }}
                className={`relative w-[86px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'converted' ? 'text-gray-900 dark:text-gray-900' : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-800'}`}
              >
                Converted
              </button>
            </div>
          </div>

          {/* Mobile Dropdown Fallback */}
          <div className="w-full sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 w-full justify-between bg-white dark:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-200 border-gray-200 dark:border-gray-200 shadow-sm transition-all">
                  <div className="flex items-center overflow-hidden">
                    <Filter className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    <span className="truncate ml-2 font-medium text-gray-700 dark:text-gray-900">
                      {selectedStatus === 'all' && 'All Quotations'}
                      {selectedStatus === 'open' && 'Open'}
                      {selectedStatus === 'closed' && 'Closed'}
                      {selectedStatus === 'converted' && 'Converted'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus('all');
                    setRefreshKey(prev => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-gray-500" />
                  <span>All Quotations</span>
                  {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedStatus('open'); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-green-500" />
                  <span>Open</span>
                  {selectedStatus === 'open' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedStatus('closed'); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-red-500" />
                  <span>Closed</span>
                  {selectedStatus === 'closed' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedStatus('converted'); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-2">
                  <CircleCheck className="h-4 w-4 text-purple-500" />
                  <span>Converted</span>
                  {selectedStatus === 'converted' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Create Button moved to table header */}
        </div>
      </div>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) {
            setQuotationToDelete(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100 shadow-2xl">
          <div className="p-6">
            <DialogHeader className="flex flex-col items-center text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-500" />
              </div>

              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-900">
                Delete quotation
              </DialogTitle>

              <DialogDescription className="text-sm text-gray-500 dark:text-gray-600 leading-relaxed">
                Are you sure you want to delete this quotation? This action cannot be undone and will permanently remove it from the system.
              </DialogDescription>
            </DialogHeader>
          </div>

          <DialogFooter className="flex items-center justify-end gap-3 p-6 bg-gray-50/50 dark:bg-gray-200/10 border-t border-gray-100 dark:border-gray-100/10">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="h-11 px-6 bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-200 text-gray-700 dark:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-200 transition-all"
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting || !quotationToDelete}
              className="h-11 px-6 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
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


      <div className="bg-white dark:bg-gray-100 border border-gray-200 dark:border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-200 w-full">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <div className="relative w-full sm:w-80">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 w-full justify-start px-3 bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-200 shadow-sm rounded-xl hover:bg-gray-50 dark:hover:bg-gray-200 transition-all" disabled={isDropdownLoading}>
                    {isDropdownLoading ? (
                      <span className="flex items-center">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading...
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 truncate">
                        <Search className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                        <span className="truncate dark:text-gray-900">{searchTerm || (searchType === 'party_name' ? 'Select by party name...' : 'Select by quotation number...')}</span>
                      </div>
                    )}
                    {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100 shadow-xl p-1">
                  <DropdownMenuItem onClick={() => { setSearchTerm(''); setRefreshKey(prev => prev + 1); }} className={`flex items-center px-3 py-2 rounded-md transition-colors ${!searchTerm ? "bg-primary/10 text-primary" : "text-gray-700 dark:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-200"}`}>
                    <span className="font-medium">Show All {searchType === 'party_name' ? 'Parties' : 'Quotations'}</span>
                  </DropdownMenuItem>
                  {isDropdownLoading ? (
                    <DropdownMenuItem disabled>
                      <div className="flex items-center justify-center w-full py-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading options...
                      </div>
                    </DropdownMenuItem>
                  ) : (
                    (searchType === 'party_name' ? allCustomerNames : allQuotationNumbers).map((item, index) => (
                      <DropdownMenuItem key={index} onClick={() => { setSearchTerm(item); setRefreshKey(prev => prev + 1); }} className={`flex items-center px-3 py-2 rounded-md transition-colors ${searchTerm === item ? "bg-primary/10 text-primary" : "text-gray-700 dark:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-200"}`}>
                        {item}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop Segmented Filter Type */}
            <div className="hidden sm:flex relative p-1 bg-gray-50 dark:bg-gray-100 rounded-xl border border-gray-200 dark:border-gray-200 shadow-inner w-fit h-10 items-center">
              <div
                className={`absolute inset-y-1 rounded-lg border shadow-sm transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${searchType === 'party_name' ? 'bg-white dark:bg-gray-300 border-gray-200 dark:border-gray-200' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                  }`}
                style={{
                  width: '100px',
                  transform: `translateX(${searchType === 'party_name' ? '0px' : '100px'})`
                }}
              />
              <button
                onClick={() => handleSearchTypeChange('party_name')}
                className={`relative w-[100px] py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors duration-300 z-10 ${searchType === 'party_name' ? 'text-gray-900 dark:text-gray-900' : 'text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-800'}`}
              >
                Party Name
              </button>
              <button
                onClick={() => handleSearchTypeChange('quotation_number')}
                className={`relative w-[100px] py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors duration-300 z-10 ${searchType === 'quotation_number' ? 'text-gray-900 dark:text-gray-900' : 'text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-800'}`}
              >
                Quote No.
              </button>
            </div>

            {/* Mobile Dropdown Fallback */}
            <div className="sm:hidden">
              <DropdownMenu open={showFilterDropdown} onOpenChange={setShowFilterDropdown}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 rounded-md px-3 text-sm text-gray-600 dark:text-gray-500 bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-200 w-full sm:w-auto">
                    <Filter className="h-3.5 w-3.5 mr-1 text-blue-500 shrink-0" />
                    <span className="truncate max-w-[150px]">
                      {searchTerm ? `${searchType === 'party_name' ? 'Party' : 'Quote'}: ${searchTerm}` : 'Filter by'}
                    </span>
                    <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                  <DropdownMenuItem onClick={() => { handleSearchTypeChange('party_name'); setShowFilterDropdown(false); }} className={searchType === 'party_name' ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : ""}>
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Party Name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { handleSearchTypeChange('quotation_number'); setShowFilterDropdown(false); }} className={searchType === 'quotation_number' ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : ""}>
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Quote No.
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="w-full sm:w-auto sm:ml-auto">
              <button
                className="group flex items-center justify-center gap-2 h-10 px-5 text-xs font-bold text-blue-600 dark:text-blue-500 bg-white dark:bg-gray-100 border border-blue-100 dark:border-blue-900 rounded-xl shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-95 w-full sm:w-auto"
                onClick={() => navigate('/quotes/new-quotation')}
              >
                <Plus className="size-4 text-blue-500 group-hover:rotate-90 transition-transform" />
                <span className="whitespace-nowrap">Create Quotation</span>
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-auto">
          <DataGrid
            refreshKey={refreshKey}
            columns={columns}
            serverSide={true}
            onFetchData={fetchQuotations}
            loading={isLoading}
            rowSelection={true}
            getRowId={(row: any) => row.id.toString()}
            pagination={{ size: 5 }}
            onRowClick={(row: any) => navigate(`/quotes/${row.original.id}`)}
            layout={{
              card: true,
              classes: {
                container: 'hidden lg:block'
              }
            }}
          >
            <MobileView
              onEdit={(id) => {
                const q = quotations.find(q => q.id === id);
                if (q && q.status === 'converted') {
                  toast.error("This voucher cannot be edited because, it has been converted to a sales invoice.");
                  return;
                }
                navigate(`/quotes/${id}/edit`);
              }}
              onDetails={(id) => navigate(`/quotes/${id}`)}
              onDelete={(id) => {
                setQuotationToDelete(id);
                setShowDeleteDialog(true);
              }}
              onDuplicate={async (id) => {
                try {
                  const response = await getQuotationById(id);
                  if (response.success && response.data) {
                    const originalQuotation = response.data;
                    const duplicateData = {
                      quotationNo: '',
                      quotationDate: new Date().toISOString().split('T')[0],
                      validFor: 30,
                      validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      status: 'open',
                      selectedCustomer: originalQuotation.customer,
                      quotationItems: originalQuotation.items.map((item: any) => ({
                        id: '',
                        item_id: item.item_id,
                        item_name: item.product_name || item.description || "Item",
                        description: item.description,
                        quantity: item.quantity,
                        price_per_item: item.unit_price,
                        discount: item.discount_percentage || 0,
                        tax: item.tax_percentage || 0,
                        amount: item.total_price,
                        measuring_unit_id: 1
                      })),
                      notes: originalQuotation.notes,
                      terms: originalQuotation.terms_and_conditions,
                      isDuplicate: true,
                      originalQuotationId: id
                    };
                    navigate('/quotes/new-quotation', {
                      state: {
                        quotationData: duplicateData,
                        isDuplicate: true
                      }
                    });
                    toast.success('Quotation opened for editing!');
                  } else {
                    toast.error('Failed to fetch original quotation');
                  }
                } catch (error) {
                  toast.error('Failed to duplicate quotation');
                }
              }}
            />
          </DataGrid>
        </div>
      </div>
    </div>
  );
};

export default QuotationPage;