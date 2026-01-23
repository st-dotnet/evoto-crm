import React, { useState, useMemo } from "react";
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
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";

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
  const [quotations] = useState<Quotation[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'open' | 'all' | 'closed'>('open');
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<Quotation>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <div className="w-full flex items-center justify-center h-full p-0 m-0">
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="w-full flex items-center justify-center h-full p-0 m-0">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
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
            <span className={`px-2 py-1 text-xs rounded-full ${
              status === 'open' ? 'bg-blue-100 text-blue-800' :
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

        const handleEdit = (quotation: Quotation) => {
          // Handle edit action
          console.log('Edit', quotation);
          setIsOpen(false);
        };

        const handleDelete = (id: string) => {
          // Handle delete action
          console.log('Delete', id);
          setIsOpen(false);
        };

        return (
          <div className="flex justify-center">
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
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
                    handleEdit(row.original);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/quotations/${row.original.id}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
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
    <div className="container-fluid p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quotation</h1>
        <div className="flex items-center gap-2">
          <div className="w-36">
            <Button variant="outline" size="sm" className="h-8 w-full gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Last 365 Days
              </span>
            </Button>
          </div>
          
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
          />
        </div>
      </div>
    </div>
  );
};

export default QuotationPage;