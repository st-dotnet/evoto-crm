import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DataGrid, DataGridColumnHeader, DataGridRowSelect, DataGridRowSelectAll } from "@/components";
import { Button } from "@/components/ui/button";
import { Plus, FileX, Calendar, Search, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import { getPaymentInList } from "../services/payment-in.service";
import { SpinnerDotted } from "spinners-react";

export const PaymentInPage = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch payment records
  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const response = await getPaymentInList();
      
      if (response.success) {
        setPayments(response.data || []);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Table columns definition
  const columns: ColumnDef<any>[] = [
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
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Date"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-900 text-center">
          {new Date(info.getValue() as string).toLocaleDateString()}
        </div>
      ),
    },
    {
      accessorKey: "payment_number",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Payment Number"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-gray-900 text-center">
          #{info.getValue() as string}
        </div>
      ),
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
    },
    {
      accessorKey: "total_amount_settled",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Total Amount Settled"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-center">
          ₹{(info.getValue() as number)?.toLocaleString('en-IN') || '0'}
        </div>
      ),
    },
    {
      accessorKey: "amount_received",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Amount Received"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => {
        const amountReceived = info.getValue() as number;
        const row = info.row.original;
        const discount = row.payment_discount || 0;
        
        return (
          <div className="text-sm font-medium text-center text-black-600">
            ₹{amountReceived.toLocaleString('en-IN')}
            {discount > 0 && (
              <div className="text-xs text-gray-500">
                - ₹{discount.toLocaleString('en-IN')} discount
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "payment_mode",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Payment Mode"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => {
        const row = info.row.original;
        const paymentMode = info.getValue() as string;
        const discount = row.payment_discount || 0;

        return (
          <div className="text-sm text-gray-900 text-center">
            {discount > 0 ? `${paymentMode} + discount` : paymentMode}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="w-full flex items-center justify-center h-full p-0 m-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Payment In</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Last 365 Days
            </span>
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => navigate('/payment-in/create')}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Create Payment In
            </span>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        {/* Search Bar */}
        <div className="p-4 border-b">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search payments..."
              className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <DataGrid
          columns={columns}
          data={payments}
          loading={isLoading}
          getRowId={(row: any) => row.id?.toString() || row.payment_number}
          pagination={{ size: 5 }}
          rowSelection={true}
        />
      </div>
    </div>
  );
};
