import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
    DataGrid,
    DataGridColumnHeader,
    KeenIcon,
    DataGridRowSelectAll,
    DataGridRowSelect,
} from "@/components";
import { ColumnDef } from "@tanstack/react-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, AlertCircle } from "lucide-react";
import { SpinnerDotted } from 'spinners-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogHeader
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ModalPurchase } from "./ModalPurchases";
import { PurchaseEntry } from "./purchase-entry-models";

interface IPurchaseContentProps {
    refreshStatus: number;
}

const Toolbar = ({
    defaultSearch,
    setSearch,
}: {
    defaultSearch: string;
    setSearch: (query: string) => void;
}) => {
    const [searchInput, setSearchInput] = useState(defaultSearch);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
        setSearch(e.target.value);
    };

    return (
        <div className="card-header flex justify-between flex-wrap gap-2 border-b-0 px-5">
            <div className="flex flex-wrap gap-2 lg:gap-5">
                <label className="input input-sm">
                    <KeenIcon icon="magnifier" />
                    <input
                        type="text"
                        placeholder="Search invoice"
                        value={searchInput}
                        onChange={handleInputChange}
                    />
                </label>
            </div>
            {/* Add button removed here as it is handled by the parent page */}
        </div>
    );
};

const PurchaseContent = ({ refreshStatus }: IPurchaseContentProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [entries, setEntries] = useState<PurchaseEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<PurchaseEntry | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchEntries = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/purchase/`, {
                params: {
                    page: 1,
                    items_per_page: 1000,
                    query: searchQuery,
                },
            });
            setEntries(response.data.data);
        } catch (error: any) {
            toast.error("Failed to fetch purchase entries");
        } finally {
            setLoading(false);
        }
    };

    const fetchPurchaseDetails = async (uuid: string) => {
        try {
            setFetchingDetails(true);
            const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/purchase/${uuid}`);
            setSelectedEntry(response.data);
            return response.data;
        } catch (error: any) {
            toast.error("Failed to fetch purchase entry details");
            return null;
        } finally {
            setFetchingDetails(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, [refreshStatus, searchQuery]);

    const deleteEntry = async (uuid: string) => {
        try {
            await axios.delete(`${import.meta.env.VITE_APP_API_URL}/purchase/${uuid}`);
            toast.success("Purchase entry deleted successfully");
            setShowDeleteDialog(false);
            fetchEntries();
        } catch (error: any) {
            toast.error("Delete failed");
        }
    };

    const columns = useMemo<ColumnDef<PurchaseEntry>[]>(
        () => [
            {
                accessorKey: "uuid",
                header: () => <DataGridRowSelectAll />,
                cell: ({ row }) => <DataGridRowSelect row={row} />,
                enableSorting: false,
                enableHiding: false,
                meta: { headerClassName: "w-0" },
            },
            {
                accessorKey: "invoice_number",
                header: ({ column }) => <DataGridColumnHeader title="Invoice Number" column={column} />,
                cell: (info) => <span className="font-medium text-gray-900">{info.row.original.invoice_number}</span>,
                meta: { headerClassName: "min-w-[150px]" },
            },
            {
                accessorKey: "date",
                header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
                cell: (info) => info.row.original.date,
                meta: { headerClassName: "min-w-[120px]" },
            },
            {
                accessorKey: "amount",
                header: ({ column }) => <DataGridColumnHeader title="Amount" column={column} />,
                cell: (info) => info.row.original.amount,
                meta: { headerClassName: "min-w-[100px]" },
            },
            {
                accessorKey: "entered_bill",
                header: ({ column }) => <DataGridColumnHeader title="Entered Bill" column={column} />,
                cell: ({ row }) => (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${row.original.entered_bill ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                        {row.original.entered_bill ? "Register" : "Pending"}
                    </span>
                ),
                meta: { headerClassName: "min-w-[100px]" },
            },
            {
                id: "actions",
                header: ({ column }) => <DataGridColumnHeader title="Actions" column={column} className="justify-center" />,
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="flex justify-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 text-sm text-primary hover:text-primary-active">
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={async () => {
                                    const details = await fetchPurchaseDetails(row.original.uuid!);
                                    if (details) setModalOpen(true);
                                }}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                    const details = await fetchPurchaseDetails(row.original.uuid!);
                                    if (details) setShowDeleteDialog(true);
                                }}>
                                    <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                    <span className="text-red-500">Delete</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ),
                meta: { headerClassName: "w-28" },
            },
        ],
        []
    );

    return (
        <div className="grid gap-5 lg:gap-7.5">
            {(loading || fetchingDetails) && entries.length === 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20">
                    <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
                </div>
            )}
            {fetchingDetails && entries.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10">
                    <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3 border">
                        <SpinnerDotted size={30} thickness={100} speed={100} color="currentColor" />
                        <span className="text-sm font-medium">Fetching details...</span>
                    </div>
                </div>
            )}
            <DataGrid
                columns={columns}
                data={entries}
                loading={loading}
                rowSelection={true}
                getRowId={(row: any) => row.uuid}
                pagination={{ size: 10 }}
                toolbar={
                    <Toolbar
                        defaultSearch={searchQuery}
                        setSearch={setSearchQuery}
                    />
                }
                layout={{ card: true }}
            />

            <ModalPurchase
                open={modalOpen}
                onOpenChange={setModalOpen}
                purchase_entry={selectedEntry}
                onSuccess={fetchEntries}
            />

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-[420px] p-6">
                    <DialogHeader className="flex flex-col items-center text-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <DialogTitle>Delete Purchase Entry</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete invoice <strong>{selectedEntry?.invoice_number}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-3 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteEntry(selectedEntry?.uuid || "")}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export { PurchaseContent };
