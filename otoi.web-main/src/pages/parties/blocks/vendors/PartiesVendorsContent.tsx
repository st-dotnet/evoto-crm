import React, { useMemo, useState, useEffect } from "react";
import { debounce } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { SpinnerDotted } from "spinners-react";
import { useDataGrid } from "@/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Settings,
  Edit,
  Trash2,
  Eye,
  PlusCircle,
  AlertCircle,
  X,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  DataGrid,
  DataGridColumnHeader,
  TDataGridRequestParams,
  KeenIcon,
  DataGridRowSelectAll,
  DataGridRowSelect,
} from "@/components";

import { ColumnDef, Column, RowSelectionState } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { PersonTypeEnum } from "@/enums/PersonTypeEnum";
import { Button } from "@/components/ui/button";
import { ModalVendor } from "./ModalVendor";
import { ActivityForm } from "../leads/ActivityForm";
import { Vendor, QueryApiResponse } from "../customers/customer-models";

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

type VendorsQueryApiResponse = QueryApiResponse<Vendor>;

interface IPartiesVendorsContentProps {
  refreshStatus: number;
}

interface ActivityLead {
  id: string;
  status?: string;
  address?: string;
  created_at?: string;
  activity_type?: string;
}

const ColumnInputFilter = <TData, TValue>({
  column,
}: IColumnFilterProps<TData, TValue>) => {
  const [inputValue, setInputValue] = useState(
    (column.getFilterValue() as string) ?? "",
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      column.setFilterValue(inputValue);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  return (
    <Input
      placeholder="Filter..."
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className="h-9 w-full max-w-40"
    />
  );
};

const PartiesVendorsContent = ({
  refreshStatus,
}: IPartiesVendorsContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [allVendors, setAllVendors] = useState<
    { uuid: string; name: string }[]
  >([]);
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<Vendor | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedCustomerForActivity, setSelectedCustomerForActivity] =
    useState<ActivityLead | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setSearchQuery(query);
      }, 500),
    [],
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel?.();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    const fetchAllVendors = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/vendors/?dropdown=true`,
        );
        setAllVendors(response.data);
      } catch (error) {
        console.error("Failed to fetch all vendors dropdown", error);
      }
    };
    fetchAllVendors();
  }, []);

  const filteredVendors = useMemo(() => {
    if (!searchInput) return allVendors;
    return allVendors.filter((c) =>
      c?.name?.toLowerCase()?.includes(searchInput?.toLowerCase()),
    );
  }, [allVendors, searchInput]);

  const navigate = useNavigate();

  const MobileView = ({
    onEdit,
    onDetails,
    onDelete,
  }: {
    onEdit: (vendor: Vendor) => void;
    onDetails: (uuid: string) => void;
    onDelete: (vendor: Vendor) => void;
  }) => {
    const { table, loading } = useDataGrid();
    const rows = table.getRowModel().rows;

    if (loading && rows.length === 0) return null;

    return (
      <div className="flex flex-col lg:hidden border-t border-gray-100 bg-white">
        {rows.map((row, index) => {
          const vendor = row.original as Vendor;
          const initials =
            `${vendor.company_name?.[0] || ""}${vendor.vendor_name?.[0] || ""}`.toUpperCase();

          return (
            <div
              key={vendor.uuid}
              className="flex justify-between items-center py-4 px-5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/30 transition-all animate-in fade-in slide-in-from-bottom-2"
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: "both",
              }}
            >
              <div
                className="flex items-center gap-3 cursor-pointer grow pr-4"
                onClick={() => onDetails(vendor.uuid)}
              >
                <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs shrink-0 border border-gray-200 shadow-sm">
                  {initials}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-bold text-gray-900 text-sm mb-0.5 truncate">
                    {vendor.company_name}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium truncate">
                    {vendor.email || vendor.mobile || "No contact info"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center size-9 text-primary hover:text-primary-active transition-all shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-32 p-1 shadow-lg border-gray-200"
                  >
                    <DropdownMenuItem
                      className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                      onClick={() => onEdit(vendor)}
                    >
                      <Edit className="mr-2 h-4 w-4 text-gray-500" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                      onClick={() => onDetails(vendor.uuid)}
                    >
                      <Eye className="mr-2 h-4 w-4 text-gray-500" />
                      Details
                    </DropdownMenuItem>
                    <div className="my-1 border-t border-gray-100"></div>
                    <DropdownMenuItem
                      className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                      onClick={() => onDelete(vendor)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && !loading && (
          <div className="p-20 text-center bg-gray-50/30 animate-in fade-in duration-700">
            <div className="flex flex-col items-center gap-3">
              <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 mb-2">
                <KeenIcon icon="folder-search" className="text-3xl" />
              </div>
              <span className="text-gray-500 text-sm font-bold uppercase tracking-wider">
                No Vendors Found
              </span>
              <p className="text-xs text-gray-400 max-w-[200px] mx-auto">
                Try adjusting your filters or search criteria.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const fetchVendorDetails = async (uuid?: string) => {
    try {
      setLoading(true);
      setFetchingDetails(true);
      const response = await axios?.get(
        `${import.meta.env.VITE_APP_API_URL}/vendors/${uuid}`,
      );
      setSelectedVendors(response?.data);
      return response?.data;
    } catch (error: any) {
      toast.error("Failed to fetch vendors details");
      return null;
    } finally {
      setLoading(false);
      setFetchingDetails(false);
    }
  };

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        accessorKey: "id",
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
        accessorFn: (row) => row.company_name,
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Vendor Information"
            filter={<ColumnInputFilter column={column} />}
            column={column}
          />
        ),
        enableSorting: true,
        cell: (info: any) => {
          const vendor = info.row.original;
          const initials =
            `${vendor.company_name?.[0] || ""}${vendor.vendor_name?.[0] || ""}`.toUpperCase();

          return (
            <div className="flex items-center gap-4 py-1 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="size-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs shadow-sm group-hover:bg-white transition-colors uppercase tracking-wider">
                {initials}
              </div>
              <div className="flex flex-col">
                <a
                  className="font-bold text-sm text-gray-900 hover:text-primary transition-colors mb-0.5 cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/vendor/${vendor.uuid}`);
                  }}
                >
                  {vendor.company_name}
                </a>
                <span className="text-[11px] text-gray-500 font-medium tracking-tight">
                  {vendor.email || "No email provided"}
                </span>
              </div>
            </div>
          );
        },
        meta: { headerClassName: "min-w-[300px]" },
      },
      {
        accessorFn: (row: Vendor) => row.gst,
        id: "gst",
        header: ({ column }) => (
          <DataGridColumnHeader title="GST" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => {
          return info.row.original.gst;
        },
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        accessorFn: (row: Vendor) => row.mobile,
        id: "mobile",
        header: ({ column }) => (
          <DataGridColumnHeader title="Mobile" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => {
          return info.row.original.mobile;
        },
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Actions"
            column={column}
            className="justify-center"
          />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-sm text-primary hover:text-primary-active transition-all">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-32 p-1 shadow-lg border-gray-200"
              >
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={async () => {
                    const vendorData = await fetchVendorDetails(
                      row.original.uuid,
                    );
                    if (vendorData) {
                      openPersonModal(vendorData);
                    }
                  }}
                >
                  <Edit className="mr-2 h-4 w-4 text-gray-500" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => {
                    navigate(`/vendor/${row.original.uuid}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4 text-gray-500" />
                  Details
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100"></div>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                  onClick={async () => {
                    const vendorData = await fetchVendorDetails(
                      row.original.uuid!,
                    );
                    if (vendorData) {
                      setSelectedVendors(vendorData);
                      setShowDeleteDialog(true);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        meta: {
          headerClassName: "w-28",
          cellClassName: "text-gray-800 font-medium",
        },
      },
    ],
    [],
  );

  const fetchVendors = async (params: TDataGridRequestParams) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(params.pageIndex + 1));
      queryParams.set("items_per_page", String(params.pageSize));

      if (params.sorting?.[0]?.id) {
        queryParams.set("sort", params.sorting[0].id);
        queryParams.set("order", params.sorting[0].desc ? "desc" : "asc");
      }

      if (searchQuery.trim().length > 0) {
        queryParams.set("query", searchQuery);
      }

      const response = await axios.get<VendorsQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/vendors/?${queryParams.toString()}`,
      );
      const payload: any = response.data as any;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const total =
        payload?.pagination?.total ??
        (Array.isArray(payload) ? rows.length : 0);
      setVendors(rows);
      return {
        data: rows,
        totalCount: total,
      };
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "An error occurred while fetching data. Please try again later";
      toast.error(errorMessage);

      return {
        data: [],
        totalCount: 0,
      };
    } finally {
      setLoading(false);
    }
  };

  const handleRowSelection = (state: RowSelectionState) => {
    setRowSelection(state);
    const selectedRowIds = Object.keys(state);
    if (selectedRowIds.length > 0) {
      toast(`Total ${selectedRowIds.length} are selected.`, {
        description: `Selected row IDs: ${selectedRowIds}`,
        action: {
          label: "Undo",
          onClick: () => console.log("Undo"),
        },
      });
    }
  };

  const handleSearch = (query: string) => {
    setSearchInput(query);
    debouncedSearch(query);
  };

  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };

  const openPersonModal = (rowData: Vendor | null = null) => {
    setSelectedVendors(rowData);
    setPersonModalOpen(true);
  };

  const deleteVendors = async (uuid: string) => {
    if (!uuid) return;

    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/vendors/${uuid}`);

      toast.success("Vendor deleted successfully");
      setShowDeleteDialog(false);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="grid gap-5 lg:gap-7.5">
      <div className="card p-0 overflow-hidden">
        <div className="card-header flex justify-between items-center gap-4 border-b-0 px-5 py-4">
          <div className="flex w-full md:w-56 lg:w-64">
            <Popover
              open={isSearchPopoverOpen}
              onOpenChange={setIsSearchPopoverOpen}
            >
              <div className="relative w-full">
                <PopoverTrigger asChild>
                  <div className="relative">
                    <KeenIcon
                      icon="magnifier"
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-500"
                    />
                    <Input
                      placeholder="Search vendor"
                      value={searchInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchInput(value);
                        setIsSearchPopoverOpen(true);
                        debouncedSearch(value);
                      }}
                      onClick={() => setIsSearchPopoverOpen(true)}
                      className="pl-9 pr-9 h-9 text-xs w-full"
                    />
                    {searchInput && (
                      <X
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 cursor-pointer hover:text-gray-600"
                        onClick={() => {
                          setSearchInput("");
                          handleSearch("");
                        }}
                      />
                    )}
                  </div>
                </PopoverTrigger>
              </div>

              <PopoverContent
                className="p-0 w-[var(--radix-popover-trigger-width)]"
                align="start"
                onOpenAutoFocus={(e) => e?.preventDefault()}
              >
                <Command>
                  <CommandList>
                    {filteredVendors.length === 0 && (
                      <CommandEmpty>No vendor found.</CommandEmpty>
                    )}
                    <CommandGroup>
                      {filteredVendors?.map((vendor) => (
                        <CommandItem
                          key={vendor?.uuid}
                          value={vendor?.name}
                          onSelect={() => {
                            setSearchInput(vendor?.name);
                            handleSearch(vendor?.name);
                            setIsSearchPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              searchInput === vendor?.name
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {vendor?.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DataGrid
          key={refreshKey}
          columns={columns}
          serverSide={true}
          onFetchData={fetchVendors}
          loading={loading}
          rowSelection={true}
          rowSelectionState={rowSelection}
          getRowId={(row: any) => row.id}
          onRowSelectionChange={handleRowSelection}
          pagination={{ size: 5 }}
          layout={{
            card: false,
            classes: {
              container: "hidden lg:block",
            },
          }}
        >
          <MobileView
            onEdit={async (vendor) => {
              const vendorData = await fetchVendorDetails(vendor.uuid);
              if (vendorData) {
                openPersonModal(vendorData);
              }
            }}
            onDetails={(uuid) => navigate(`/vendor/${uuid}`)}
            onDelete={async (vendor) => {
              const vendorData = await fetchVendorDetails(vendor.uuid!);
              if (vendorData) {
                setSelectedVendors(vendorData);
                setShowDeleteDialog(true);
              }
            }}
          />
        </DataGrid>
      </div>
      <ModalVendor
        open={personModalOpen}
        onOpenChange={handleClose}
        vendor={selectedVendors}
      />
      <ActivityForm
        open={activityModalOpen}
        onOpenChange={() => setActivityModalOpen(false)}
        lead={selectedCustomerForActivity}
      />
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] p-4 sm:p-6 rounded-lg">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>

            <DialogTitle className="text-lg font-semibold">
              Delete Vendors
            </DialogTitle>

            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete{" "}
              <strong>{selectedVendors?.company_name}</strong> this vendors?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-row gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={() => deleteVendors(selectedVendors?.uuid || "")}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { PartiesVendorsContent };
