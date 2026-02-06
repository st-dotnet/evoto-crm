import React, { useState, useMemo, useEffect } from "react";
import { DataGrid, DataGridColumnHeader } from "@/components";
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
    FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import { getInvoices, deleteInvoice } from "../services/invoice.services";
import { toast } from "sonner";

interface Invoice {
    id: string;
    date: string;
    invoice_number: string;
    party_name: string;
    due_date: string;
    amount: number;
    amount_paid: number;
    balance_due: number;
    status: string;
    payment_status: string;
}

const InvoicePage = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
    const navigate = useNavigate();

    // Fetch invoices from database
    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const response = await getInvoices();
            if (response.success && response.data) {
                const invoicesData = response.data.data || response.data;

                const transformedInvoices = invoicesData.map((item: any) => ({
                    id: item.uuid,
                    date: item.invoice_date || item.created_at,
                    invoice_number: item.invoice_number,
                    party_name: item.customer_name || 'N/A',
                    due_date: item.due_date,
                    amount: item.total_amount || 0,
                    amount_paid: item.amount_paid || 0,
                    balance_due: item.balance_due || 0,
                    status: item.status || 'draft',
                    payment_status: item.payment_status || 'unpaid',
                }));
                setInvoices(transformedInvoices);
            } else {
                toast.error(response.error || 'Failed to fetch invoices');
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error('Failed to fetch invoices');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    // Filter invoices by payment status
    const filteredInvoices = useMemo(() => {
        if (selectedStatus === 'all') return invoices;
        return invoices.filter(inv => inv.payment_status === selectedStatus);
    }, [invoices, selectedStatus]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this invoice?')) return;

        const response = await deleteInvoice(id);
        if (response.success) {
            toast.success('Invoice deleted successfully');
            fetchInvoices();
        } else {
            toast.error(response.error || 'Failed to delete invoice');
        }
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
                headerClassName: "min-w-[100px]",
            },
        },
        {
            accessorKey: "invoice_number",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Invoice #"
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
                    title="Customer"
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
                    title="Due Date"
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
            accessorKey: "balance_due",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Balance"
                    column={column}
                    className="justify-end"
                />
            ),
            cell: (info) => {
                const balance = info.getValue() as number;
                return (
                    <div className={`text-sm font-medium text-right ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{balance?.toLocaleString('en-IN') || '0'}
                    </div>
                );
            },
            meta: {
                headerClassName: "min-w-[100px] justify-end",
                cellClassName: "text-right",
            },
        },
        {
            accessorKey: "payment_status",
            header: ({ column }) => (
                <DataGridColumnHeader
                    title="Payment"
                    column={column}
                    className="justify-center"
                />
            ),
            cell: (info) => {
                const status = info.getValue() as string;
                return (
                    <div className="flex items-center justify-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${getPaymentStatusBadge(status)}`}>
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
                headerClassName: "min-w-[90px]",
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
                                        navigate(`/invoices/${row.original.id}`);
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
                                        navigate(`/invoices/${row.original.id}/edit`);
                                        setIsOpen(false);
                                    }}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigate(`/invoices/${row.original.id}/payment`);
                                        setIsOpen(false);
                                    }}
                                >
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Record Payment
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
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
                <h1 className="text-2xl font-bold">Invoices</h1>
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
                                        {selectedStatus === 'all' && 'All Invoices'}
                                        {selectedStatus === 'paid' && 'Paid'}
                                        {selectedStatus === 'unpaid' && 'Unpaid'}
                                        {selectedStatus === 'partial' && 'Partial'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px]">
                                <DropdownMenuItem
                                    onClick={() => setSelectedStatus('all')}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-gray-500" />
                                    <span>All Invoices</span>
                                    {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setSelectedStatus('paid')}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-green-500" />
                                    <span>Paid</span>
                                    {selectedStatus === 'paid' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setSelectedStatus('unpaid')}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-red-500" />
                                    <span>Unpaid</span>
                                    {selectedStatus === 'unpaid' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setSelectedStatus('partial')}
                                    className="flex items-center gap-2"
                                >
                                    <Circle className="h-4 w-4 text-yellow-500" />
                                    <span>Partial</span>
                                    {selectedStatus === 'partial' && <Check className="h-4 w-4 ml-auto" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <Button
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => navigate('/invoices/new')}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Create Invoice
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
                            placeholder="Search invoices..."
                            className="pl-9 h-9 w-full border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        />
                    </div>
                </div>
                <div className="overflow-auto">
                    <DataGrid
                        key="invoice-grid"
                        columns={columns}
                        data={filteredInvoices}
                        rowSelection
                        getRowId={(row) => row.id.toString()}
                        pagination={{ size: 10 }}
                    />
                </div>
            </div>
        </div>
    );
};

export default InvoicePage;
