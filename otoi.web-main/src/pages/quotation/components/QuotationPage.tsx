import React, { useState, useMemo, useEffect } from "react";
import { DataGrid, DataGridColumnHeader, DataGridRowSelect, DataGridRowSelectAll } from "@/components";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Settings,
  FileText,
  ChevronDown,
  Search,
  Calendar,
  Filter,
  Check,
  Circle,
  CircleOff,
  CircleCheck,
  MoreVertical,
  Edit,
  Eye,
  Copy,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { getQuotations, deleteQuotation, getQuotationById, createQuotation } from "../services/quotation.services";
import { toast } from "sonner";

interface Quotation {
  id: string;
  date: string;
  quotation_number: number;
  party_name: string;
  due_in: string;
  amount: number;
  status: string;
}

const QuotationPage = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'open' | 'all' | 'closed'>('open');
  const navigate = useNavigate();

  // Fetch quotations from database
  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      const response = await getQuotations();
      if (response.success && response.data) {
        // Backend returns { data: [...] } so we need to access .data
        const quotationsData = response.data.data || response.data;

        // Transform the data to match the interface
        const transformedQuotations = quotationsData.map((item: any) => ({
          id: item.uuid, // Use uuid as id
          date: item.quotation_date || item.created_at,
          quotation_number: item.quotation_number,
          party_name: item.customer_name || 'N/A',
          due_in: item.valid_till ? `${Math.ceil((new Date(item.valid_till).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days` : 'N/A',
          amount: item.total_amount || 0,
          status: item.status || 'open',
        }));
        setQuotations(transformedQuotations);
      } else {
        toast.error(response.error || 'Failed to fetch quotations');
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
      toast.error('Failed to fetch quotations');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch quotations on component mount
  useEffect(() => {
    fetchQuotations();
  }, []);

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
            <span className={`px-2 py-1 text-xs rounded-full ${status === 'open' ? 'bg-blue-100 text-blue-800' :
              status === 'closed' ? 'bg-green-100 text-green-800' :
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
            console.error('Error duplicating quotation:', error);
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
    <div className="container-fluid p-6">
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

          {/* <div className="w-44">
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
                  onClick={() => setSelectedStatus('open')}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-blue-500" />
                  <span>Open Quotation</span>
                  {selectedStatus === 'open' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedStatus('all')}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-gray-500" />
                  <span>All Quotation</span>
                  {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedStatus('closed')}
                  className="flex items-center gap-2"
                >
                  <CircleCheck className="h-4 w-4 text-green-500" />
                  <span>Closed Quotation</span>
                  {selectedStatus === 'closed' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div> */}
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
              onClick={async () => {
                if (!quotationToDelete || isDeleting) return;
                setIsDeleting(true);
                const response = await deleteQuotation(quotationToDelete);
                if (response.success) {
                  toast.success("Quotation deleted successfully");
                  fetchQuotations();
                  setShowDeleteDialog(false);
                } else {
                  toast.error(response.error || "Failed to delete quotation");
                }
                setQuotationToDelete(null);
                setIsDeleting(false);
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting || !quotationToDelete}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search quotations..."
              className="pl-9 h-9 w-full border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        </div>
        <div className="overflow-auto">
          <DataGrid
            key="quotation-grid"
            columns={columns}
            data={quotations}
            rowSelection
            getRowId={(row) => row.id.toString()}
            pagination={{ size: 10 }}
            onRowClick={(row) => navigate(`/quotes/${row.original.id}`)}
          />
        </div>
      </div>
    </div>
  );
};

export default QuotationPage;
