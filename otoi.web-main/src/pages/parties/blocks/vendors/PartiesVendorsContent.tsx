import React, { useMemo, useState, useEffect } from "react";
import { debounce } from "@/lib/helpers";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SpinnerDotted } from 'spinners-react';

import {
  DataGrid,
  DataGridColumnHeader,
  TDataGridRequestParams,
  KeenIcon,
  DataGridRowSelectAll,
  DataGridRowSelect,
} from "@/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, MoreVertical, Settings, Edit, Trash2, Eye, PlusCircle, AlertCircle, X, Check } from "lucide-react";

import {
  ColumnDef,
  Column,
  RowSelectionState,
} from "@tanstack/react-table";
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
  DialogHeader
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
    (column.getFilterValue() as string) ?? ""
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

// const Toolbar = ({
//   defaultSearch,
//   setSearch,
//   defaultPersonType,
//   setDefaultPersonType,
// }: {
//   defaultSearch: string;
//   setSearch: (query: string) => void;
//   defaultPersonType: string;
//   setDefaultPersonType: (query: string) => void;
// }) => {
//   const [searchInput, setSearchInput] = useState(defaultSearch);
//   const [searchPersonType, setPersonType] = useState(defaultPersonType);

//   const debouncedSearch = useMemo(
//     () =>
//       debounce((query: string) => {
//         setSearch(query);
//       }, 500),
//     [setSearch]
//   );

//   useEffect(() => {
//     return () => {
//       debouncedSearch.cancel?.();
//     };
//   }, [debouncedSearch]);

//   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
//     if (event.key === "Enter") {
//       debouncedSearch.cancel?.();
//       setSearch(searchInput);
//     }
//   };

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value;
//     setSearchInput(value);
//     debouncedSearch(value);
//   };

//   const handlePersonTypeChange = (personType: string) => {
//     setPersonType(personType);
//     setDefaultPersonType(personType);
//   };
const Toolbar = ({
  defaultSearch,
  setSearch,
  defaultPersonType,
  setDefaultPersonType,
}: {
  defaultSearch: string;
  setSearch: (query: string) => void;
  defaultPersonType: string;
  setDefaultPersonType: (query: string) => void;
}) => {
  const [searchInput, setSearchInput] = useState(defaultSearch);
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<{ uuid: string; name: string }[]>([]);

  useEffect(() => {
    const fetchAllVendors = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/vendors/?dropdown=true`);
        setVendors(response.data);
      } catch (error) {
        console.error("Failed to fetch all vendors dropdown", error);
      }
    };
    fetchAllVendors();
  }, []);

  // Handle input change and trigger debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setOpen(true); // Keep dropdown open while typing
  };
  const filteredVenders = useMemo(() => {
    if (!searchInput) return vendors;
    return vendors.filter((c) =>
      c?.name?.toLowerCase()?.includes(searchInput?.toLowerCase())
    );
  }, [vendors, searchInput]);

  return (
//     <div className="card-header flex justify-between flex-wrap gap-3 border-b-0 px-5 py-4">
//       <div className="flex flex-wrap items-center gap-2.5 lg:gap-5">
//         <div className="flex grow md:grow-0">
//           <label className="input input-sm w-full md:w-64 lg:w-72">
//             <span onClick={() => setSearch(searchInput)} className="cursor-pointer flex items-center">
//               <KeenIcon icon="magnifier" />
//             </span>
//             <input
//               type="text"
//               placeholder="Search vendors"
//               value={searchInput}
//               onChange={handleChange}
//               onKeyDown={handleKeyDown}
//               className="w-full focus:outline-none"
//             />
//           </label>
//         </div>
//       </div>
//     </div>
//   );
// };
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
                  placeholder="Search vendors..."
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
                {filteredVenders.length === 0 && (
                  <CommandEmpty>No customer found.</CommandEmpty>
                )}
                <CommandGroup>
                  {filteredVenders?.map((customer) => (
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

const PartiesVendorsContent = ({
  refreshStatus,
}: IPartiesVendorsContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPersonTypeQuery, setPersonTypeQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<Vendor | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedCustomerForActivity, setSelectedCustomerForActivity] = useState<
    ActivityLead | null
  >(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const navigate = useNavigate();

  // Fetch vendor details from server to ensure fresh data before actions
  const fetchVendorDetails = async (uuid?: string) => {
    try {
      setLoading(true);
      setFetchingDetails(true);
      const response = await axios?.get(`${import.meta.env.VITE_APP_API_URL}/vendors/${uuid}`);
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


  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus, searchQuery, searchPersonTypeQuery]);


  // const openPersonModal = (event: { preventDefault: () => void }, rowData: Vendor | null = null) => {
  //   event.preventDefault();
  //   setSelectedVendors(rowData);
  //   setPersonModalOpen(true);
  // };
  const openPersonModal = (rowData: Vendor | null = null) => {
    setSelectedVendors(rowData);
    setPersonModalOpen(true);
  };

  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };


  const deleteVendors = async (uuid: string) => {

    if (!uuid) return;

    try {
      await axios.delete(
        `${import.meta.env.VITE_APP_API_URL}/vendors/${uuid}`
      );

      toast.success("Vendor deleted successfully");
      setShowDeleteDialog(false);
      setRefreshKey((prev) => prev + 1); // Trigger grid refresh
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Delete failed"
      );
    }
  };

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        accessorKey: "id",
        header: () => <DataGridRowSelectAll />,
        cell: ({ row }) => <DataGridRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerClassName: "w-0",
        },
      },
      {
        accessorFn: (row) => row.company_name,
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Name"
            filter={<ColumnInputFilter column={column} />}
            column={column}
          />
        ),
        enableSorting: true,
        cell: (info: any) => (
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <div className="font-medium text-sm text-gray-900 mb-px">
                {info.row.original.company_name}
              </div>
              <div className="text-2sm text-gray-700 font-normal">
                {info.row.original.email}
              </div>
            </div>
          </div>
        ),
        meta: {
          headerClassName: "min-w-[300px]",
        },
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
          <DataGridColumnHeader title="Action" column={column} className="justify-center" />
        ),
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
                {/* <DropdownMenuItem onClick={(e) => {
                  e.preventDefault();
                  openPersonModal(e, row.original);
                }}> */}
                <DropdownMenuItem onClick={async () => {
                  const details = await fetchVendorDetails(row?.original?.uuid!);
                  if (details) openPersonModal(details);
                }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const details = await fetchVendorDetails(row?.original?.uuid!);
                  if (details) setShowDeleteDialog(true);
                }}>
                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">Delete</span>
                </DropdownMenuItem>
                {/* <DropdownMenuItem onClick={(e) => {
                e.preventDefault();
                navigate(`/vendor/${row.original.uuid}`);
              }}>
                <Eye className="mr-2 h-4 w-4" />
                Details
              </DropdownMenuItem> */}
                {/* <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedCustomerForActivity({
                    id: row.original.uuid,
                    status: undefined,
                    address: row.original.address1,
                    created_at: undefined,
                    activity_type: undefined,
                  });
                  setActivityModalOpen(true);
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Activity
              </DropdownMenuItem> */}
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
    []
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

      if (searchPersonTypeQuery != "-1") {
        queryParams.set("person_type", searchPersonTypeQuery);
      }

      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value));
          }
        });
      }

      const response = await axios.get<VendorsQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/vendors/?${queryParams.toString()}`,
      );
      // Support both envelope ({ data, pagination }) and plain array responses
      const payload: any = response.data as any;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const total = payload?.pagination?.total ?? (Array.isArray(payload) ? rows.length : 0);
      setVendors(rows);
      return {
        data: rows,
        totalCount: total,
      };
    } catch (error: any) {
      // console.log(error);
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || "An error occurred while fetching data. Please try again later";
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
    setSearchQuery(query);
  };

  const handlePersonTypeSearch = (query: string) => {
    setPersonTypeQuery(query);
  };


  return (
    <div className="grid gap-5 lg:gap-7.5">
      {/* {loading && vendors.length === 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-black/20">
          <div className="text-primary">
            <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
          </div>
        </div>
      )} */}

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
        onFetchData={fetchVendors}
        loading={loading}
        rowSelection={true}
        rowSelectionState={rowSelection}
        getRowId={(row: any) => row.id}
        onRowSelectionChange={handleRowSelection}
        pagination={{ size: 5 }}
        toolbar={
          <Toolbar
            defaultSearch={searchQuery}
            setSearch={handleSearch}
            defaultPersonType={searchPersonTypeQuery}
            setDefaultPersonType={handlePersonTypeSearch}
          />
        }
        layout={{ card: true }}
      />
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
        <DialogContent className="sm:max-w-[420px] p-6">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>

            <DialogTitle className="text-lg font-semibold">
              Delete Vendors
            </DialogTitle>

            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong>{selectedVendors?.company_name}</strong> this vendors?
            </DialogDescription>

          </DialogHeader>

          <DialogFooter className="mt-3 flex justify-end gap-3">

            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={() => deleteVendors(selectedVendors?.uuid || "")}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export { PartiesVendorsContent };