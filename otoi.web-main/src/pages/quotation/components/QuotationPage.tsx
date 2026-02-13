import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DataGrid, DataGridColumnHeader, DataGridRowSelect, DataGridRowSelectAll } from "@/components";
import { Button } from "@/components/ui/button";
import {Plus,Settings, FileText,ChevronDown,Search,Calendar,Filter,Check,Circle,CircleOff,CircleCheck,MoreVertical,Edit,Eye,Copy,Trash2,AlertCircle,List,X} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { getQuotations, deleteQuotation, getQuotationById, createQuotation, fetchQuotationItems, getAllCustomersDropdown, getQuotationNumbersDropdown } from "../services/quotation.services";
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

const QuotationPage = () => {
const [quotations, setQuotations] = useState<Quotation[]>([]);
 const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 const [showDeleteDialog, setShowDeleteDialog] = useState(false);
 const [quotationToDelete, setQuotationToDelete] = useState<string | null>(null);
 const [isDeleting, setIsDeleting] = useState(false);
 const [selectedStatus, setSelectedStatus] = useState<'open' | 'all' | 'closed'>('all');
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
        status: selectedStatus === 'all' ? '' : selectedStatus,
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
        <div className="text-sm text-gray-900">
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
        <div className="text-sm font-medium text-gray-900">
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
        <div className="text-sm text-gray-900">
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
        <div className="text-sm text-gray-900">
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
        <div className="text-sm font-medium text-right">
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
        const status = info.getValue() as string;
        
        return (
          <div className="flex items-center justify-center">
            <span className={`px-2 py-1 text-xs rounded-full ${
              status === 'open' ? 'bg-green-100 text-green-800' :
              status === 'closed' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
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

              <DropdownMenuContent align="end">
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
    <div className="container-fluid p-6 relative">
      {(isLoading || isDeleting || isDropdownLoading) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80">
          <div className="text-primary">
            <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quotation</h1>
        <div className="flex items-center gap-2">
          {/* <div className="w-36">
            <Button variant="outline" size="sm" className="h-8 w-full gap-1">
             <Calendar className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Last 365 Days
              </span>
            </Button>
          </div> */}

          <div className="w-44">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-full gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {selectedStatus === 'open' && 'Open Quotation'}
                    {selectedStatus === 'all' && 'All Quotation'}
                    {selectedStatus === 'closed' && 'Closed Quotation'}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus('open');
                    setRefreshKey(prev => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-green-500" />
                  <span>Open Quotation</span>
                  {selectedStatus === 'open' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus('all');
                    setRefreshKey(prev => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-gray-500" />
                  <span>All Quotation</span>
                  {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus('closed');
                    setRefreshKey(prev => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-red-500" />
                  <span>Closed Quotation</span>
                  {selectedStatus === 'closed' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            size="sm"
            className="h-8 gap-1"
            onClick={() => navigate('/quotes/new-quotation')}
          >
           <Plus className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Create Quotation
            </span>
          </Button>
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
        <DialogContent className="sm:max-w-[420px] p-6">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>

            <DialogTitle className="text-lg font-semibold">
              Delete quotation
            </DialogTitle>

            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete this quotation?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-6 flex justify-end gap-3">
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
              disabled={isDeleting || !quotationToDelete}
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


      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative w-fit">
            <div className="flex">
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 w-80 justify-start px-3" disabled={isDropdownLoading}>
                      {isDropdownLoading ? (
                        <span className="flex items-center">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                          Loading...
                        </span>
                      ) : (
                        searchTerm || (searchType === 'party_name' ? 'Select by party name...' : 'Select by quotation number...')
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
                      <span className="text-gray-500">Show All {searchType === 'party_name' ? 'Parties' : 'Quotations'}</span>
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
                        <DropdownMenuItem 
                          key={index} 
                          onClick={() => {
                            setSearchTerm(item);
                            setRefreshKey(prev => prev + 1);
                          }}
                          className={searchTerm === item ? "bg-blue-50 text-blue-600" : ""}
                        >
                          {item}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex bg-gray-50 rounded-md ml-2">
                <DropdownMenu open={showFilterDropdown} onOpenChange={setShowFilterDropdown}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-md px-3 text-sm text-gray-600"
                    >
                      <Filter className="h-3.5 w-3.5 mr-1 text-blue-500" />
                      {searchTerm ? `${searchType === 'party_name' ? 'Party' : 'Quote'}: ${searchTerm}` : 'Filter by'}
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
                        handleSearchTypeChange('quotation_number');
                        setShowFilterDropdown(false);
                      }}
                      className={searchType === 'quotation_number' ? "bg-blue-50 text-blue-600" : ""}
                    >
                      <Filter className="h-3.5 w-3.5 mr-2" />
                      Quotation Number
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-auto">
          <DataGrid
            key={refreshKey}
            columns={columns}
            serverSide={true}
            onFetchData={fetchQuotations}
            loading={false}
            rowSelection={true}
            getRowId={(row: any) => row.id.toString()}
            pagination={{ size: 5 }}
            onRowClick={(row: any) => navigate(`/quotes/${row.original.id}`)}
          />
        </div>
      </div>
    </div>
  );
};

export default QuotationPage;

