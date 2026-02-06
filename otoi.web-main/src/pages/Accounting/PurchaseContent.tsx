import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
    DataGrid,
    DataGridColumnHeader,
    TDataGridRequestParams,
    KeenIcon,
    DataGridRowSelectAll,
    DataGridRowSelect,
} from "@/components";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, AlertCircle, X, Check } from "lucide-react";
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

// const Toolbar = ({
//     defaultSearch,
//     setSearch,
// }: {
//     defaultSearch: string;
//     setSearch: (query: string) => void;
// }) => {
//     const [searchInput, setSearchInput] = useState(defaultSearch);

//     useEffect(() => {
//         const timer = setTimeout(() => {
//             setSearch(searchInput);
//         }, 400);

//         return () => clearTimeout(timer);
//     }, [searchInput, setSearch]);

//     const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//         setSearchInput(e.target.value);
//     };

//     const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
//         if (event.key === "Enter") {
//             setSearch(searchInput);
//         }
//     };

const Toolbar = ({
    defaultSearch,
    setSearch,
}: {
    defaultSearch: string;
    setSearch: (query: string) => void;
}) => {
    const [searchInput, setSearchInput] = useState(defaultSearch);
    const [open, setOpen] = useState(false);
    const [purchases, setPurchases] = useState<{ uuid: string; name: string }[]>([]);

    useEffect(() => {
        const fetchAllPurchases = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/purchase/?dropdown=true`);
                setPurchases(response?.data);
            } catch (error) {
                console.error("Failed to fetch all purchase dropdown", error);
            }
        };
        fetchAllPurchases();
    }, []);

    // Handle input change and trigger debounced search
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e?.target?.value;
        setSearchInput(value);
        setOpen(true); // Keep dropdown open while typing
    };
    const filteredPurchases = useMemo(() => {
        if (!searchInput) return purchases;
        return purchases.filter((c) =>
            c?.name?.toLowerCase()?.includes(searchInput?.toLowerCase())
        );
    }, [purchases, searchInput]);

    return (
        <div className="card-header flex justify-between flex-wrap gap-3 border-b-0 px-5 py-4">
            <div className="flex grow md:grow-0">
                <Popover open={open} onOpenChange={setOpen}>
                    <div className="relative w-full md:w-64 lg:w-72">
                        <PopoverTrigger asChild>
                            <div className="relative">
                                <KeenIcon
                                    icon="magnifier"
                                    className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-500"
                                />
                                <Input
                                    placeholder="Search purchases..."
                                    value={searchInput}
                                    onChange={handleInputChange}
                                    onClick={() => setOpen(true)} // Added to ensure popover opens on click
                                    className="pl-9 pr-9 h-9 text-xs"
                                />
                                {searchInput && (
                                    <X
                                        className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 cursor-pointer hover:text-gray-600"
                                        onClick={() => {
                                            setSearchInput("");
                                            setSearch("");
                                        }}
                                    />
                                )}
                            </div>
                        </PopoverTrigger>
                    </div>

                    <PopoverContent
                        className="p-0 w-[var(--radix-popover-trigger-width)]"
                        align="start"
                        onOpenAutoFocus={(e) => e?.preventDefault()} // Prevents focus jump
                    >
                        <Command>
                            <CommandList>
                                {filteredPurchases.length === 0 && (
                                    <CommandEmpty>No customer found.</CommandEmpty>
                                )}
                                <CommandGroup>
                                    {filteredPurchases?.map((customer) => (
                                        <CommandItem
                                            key={customer?.uuid}
                                            value={customer?.name}
                                            onSelect={() => {
                                                setSearchInput(customer?.name);
                                                setSearch(customer?.name); // Hit the API with exact selection
                                                setOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    searchInput === customer?.name ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {customer?.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};

const PurchaseContent = ({ refreshStatus }: IPurchaseContentProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<PurchaseEntry | null>(null);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        setRefreshKey((prev) => prev + 1);
    }, [refreshStatus, searchQuery]);

    const fetchPurchaseEntries = async (params: TDataGridRequestParams) => {
        try {
            const queryParams = new URLSearchParams();
            queryParams.set("page", String(params.pageIndex + 1));
            queryParams.set("items_per_page", String(params.pageSize));

            if (searchQuery.trim().length > 0) {
                queryParams.set("query", searchQuery);
            }

            if (params.sorting?.[0]?.id) {
                queryParams.set("sort", params?.sorting[0]?.id);
                queryParams.set("order", params?.sorting[0]?.desc ? "desc" : "asc");
            }

            const response = await axios.get(
                `${import.meta.env.VITE_APP_API_URL}/purchase/?${queryParams.toString()}`
            );

            return {
                data: response?.data?.data,
                totalCount: response?.data?.pagination?.total,
            };
        } catch (error: any) {
            toast.error("Failed to fetch purchase entries");
            return { data: [], totalCount: 0 };
        }
    };

    // Fetch full details for a specific entry before editing/deleting
    const fetchPurchaseDetails = async (uuid: string) => {
        try {
            setFetchingDetails(true);
            const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/purchase/${uuid}`);
            setSelectedEntry(response?.data);
            return response?.data;
        } catch (error: any) {
            toast.error("Failed to fetch purchase details");
            return null;
        } finally {
            setFetchingDetails(false);
        }
    };

    const deleteEntry = async (uuid: string) => {
        try {
            await axios.delete(`${import.meta.env.VITE_APP_API_URL}/purchase/${uuid}`);
            toast.success("Purchase entry deleted successfully");
            setShowDeleteDialog(false);
            setRefreshKey((prev) => prev + 1);
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
                enableSorting: true,
                cell: (info) => <span className="font-medium text-gray-900">{info.row.original.invoice_number}</span>,
                meta: { headerClassName: "min-w-[150px]" },
            },
            {
                accessorKey: "date",
                header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
                enableSorting: true,
                cell: (info) => info.row.original.date,
                meta: { headerClassName: "min-w-[120px]" },
            },
            {
                accessorKey: "amount",
                id: "amount",
                header: ({ column }) => (
                    <DataGridColumnHeader title="Amount" column={column} />
                ),
                enableSorting: true,
                cell: (info: any) => { return info.row.original.amount },
                meta: { headerClassName: "min-w-[100px]" },
            },
            {
                accessorKey: "entered_bill",
                header: ({ column }) => <DataGridColumnHeader title="Entered Bill" column={column} />,
                enableSorting: true,
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
        [fetchPurchaseDetails]
    );

    return (
        <div className="grid gap-5 lg:gap-7.5">
            {fetchingDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10">
                    <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3 border">
                        <SpinnerDotted size={30} thickness={100} speed={100} color="currentColor" />
                        <span className="text-sm font-medium">Fetching details...</span>
                    </div>
                </div>
            )}
            <DataGrid
                key={refreshKey}
                columns={columns}
                serverSide={true}
                onFetchData={fetchPurchaseEntries}
                loading={loading}
                rowSelection={true}
                rowSelectionState={rowSelection}
                getRowId={(row: any) => row.uuid}
                onRowSelectionChange={setRowSelection}
                pagination={{ size: 5 }}
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
                onOpenChange={(isOpen) => {
                    setModalOpen(isOpen);
                    if (!isOpen) {
                        setRefreshKey((prev) => prev + 1);
                    }
                }}
                purchase_entry={selectedEntry}
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
