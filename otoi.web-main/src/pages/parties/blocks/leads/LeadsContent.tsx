import React, { useMemo, useState, useEffect } from "react";
import {
  Lead,
  QueryLeadApiResponse,
} from "./lead-models";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, MoreVertical, Settings, Edit, Trash2, Eye, PlusCircle, AlertCircle, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { ModalLead } from "./ModalLead";
import { useNavigate } from "react-router-dom";
import { ActivityForm } from "./ActivityForm";
import { Button } from "@/components/ui/button";
import { SpinnerDotted } from 'spinners-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

type LeadsQueryApiResponse = QueryLeadApiResponse;

interface ILeadsContentProps {
  refreshStatus: number;
}
interface ActivityLead {
  id: string;
  status?: string;
  address?: string;
  created_at?: string;
  activity_type?: string;
}

import { debounce } from "@/lib/helpers";
import { cn } from "@/lib/utils";

const Toolbar = ({
  defaultSearch,
  setSearch,
  defaultStatusType,
  setDefaultStatusType,
}: {
  defaultSearch: string;
  setSearch: (query: string) => void;
  defaultStatusType: string;
  setDefaultStatusType: (query: string) => void;
}) => {
  const [searchInput, setSearchInput] = useState(defaultSearch);
  const [searchStatusType, setStatusType] = useState(defaultStatusType);

  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setSearch(query);
      }, 500),
    [setSearch]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel?.();
    };
  }, [debouncedSearch]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      debouncedSearch.cancel?.();
      setSearch(searchInput);
    }
  };

  // const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   setSearchInput(value);
  //   debouncedSearch(value);
  // };

  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<{ uuid: string; name: string }[]>([]);

  useEffect(() => {
    const fetchAllLeads = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/leads/?dropdown=true`);
        setLeads(response.data);
      } catch (error) {
        console.error("Failed to fetch all leads dropdown", error);
      }
    };
    fetchAllLeads();
  }, []);

  // Handle input change and trigger debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setOpen(true); // Keep dropdown open while typing
  };
  const filteredLeads = useMemo(() => {
    if (!searchInput) return leads;
    return leads.filter((c) =>
      c?.name?.toLowerCase()?.includes(searchInput?.toLowerCase())
    );
  }, [leads, searchInput]);

  return (
    <div className="card-header flex justify-between flex-wrap gap-3 border-b-0 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5 lg:gap-5">
        {/* <div className="flex grow md:grow-0">
          <label className="input input-sm w-full md:w-48 lg:w-64">
            <span onClick={() => setSearch(searchInput)} className="cursor-pointer flex items-center">
              <KeenIcon icon="magnifier" />
            </span>
            <input
              type="text"
              placeholder="Search leads"
              value={searchInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
          </label>
        </div> */}
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
                    placeholder="Search leads..."
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
                  {filteredLeads.length === 0 && (
                    <CommandEmpty>No lead found.</CommandEmpty>
                  )}
                  <CommandGroup>
                    {filteredLeads?.map((lead) => (
                      <CommandItem
                        key={lead?.uuid}
                        value={lead?.name}
                        onSelect={() => {
                          setSearchInput(lead?.name);
                          setSearch(lead?.name); // Hit the API with exact selection
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            searchInput === lead?.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {lead?.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {/* Status Filter */}
        <div className="flex items-center flex-wrap gap-2.5">
          <label className="text-sm font-medium text-gray-700"> Status </label>
          <Select
            defaultValue=""
            value={searchStatusType}
            onValueChange={(value) => {
              setStatusType(value);
              setDefaultStatusType(value);
            }}
          >
            <SelectTrigger className="w-32 lg:w-36" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="w-36">
              <SelectItem value="-1">All</SelectItem>
              <SelectItem value="1">New</SelectItem>
              <SelectItem value="2">In-Progress</SelectItem>
              <SelectItem value="3">Quote Given</SelectItem>
              <SelectItem value="4">Win</SelectItem>
              <SelectItem value="5">Lose</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

const LeadsContent = ({ refreshStatus }: ILeadsContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatusTypeQuery, setStatusTypeQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0); // Unique key to trigger DataGrid reload
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedLeadForActivity, setSelectedLeadForActivity] =
    useState<ActivityLead | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingLead, setFetchingLead] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const navigate = useNavigate();

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus, searchQuery, searchStatusTypeQuery]);

  const ColumnInputFilter = <TData, TValue>({
    column,
  }: IColumnFilterProps<TData, TValue>) => {
    const [inputValue, setInputValue] = useState(
      (column.getFilterValue() as string) ?? ""
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        column.setFilterValue(inputValue); // Apply the filter only on Enter
      }
    };

    return (
      <Input
        placeholder="Filter..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-9 w-full max-w-40"
      />
    );
  };

  const openLeadModal = (
    event: { preventDefault: () => void },
    rowData: Lead | null = null
  ) => {
    event.preventDefault();
    setSelectedLead(rowData);
    setLeadModalOpen(true);
  };

  // Handle modal close and trigger grid refresh
  const handleClose = () => {
    setLeadModalOpen(false);
    setRefreshKey((prev) => prev + 1); // Increment key to force DataGrid reload
  };

  // Fetch Single User Details from server to ensure fresh data
  const fetchLeadDetails = async (userId: string) => {
    try {
      setFetchingLead(true);
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/leads/${userId}`);
      setSelectedLead(response?.data);
      return response?.data;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to fetch lead details");
      return null;
    } finally {
      setFetchingLead(false);
    }
  };

  const deleteLead = async (uuid: string) => {

    try {
      await axios.delete(
        `${import.meta.env.VITE_APP_API_URL}/leads/${uuid}`
      );

      toast.success("Lead deleted successfully");
      setShowDeleteDialog(false);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Delete failed");
    }
  };

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: "id",
        header: () => <DataGridRowSelectAll />,
        cell: ({ row }) => <DataGridRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        meta: { headerClassName: "w-0" },
      },
      {
        accessorFn: (row) => row.first_name,
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
              <a
                className="font-medium text-sm text-gray-900 hover:text-primary-active mb-px cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/lead/${info.row.original.uuid}`);
                }}
              >
                {info.row.original.first_name} {info.row.original.last_name}
              </a>
              <a
                className="text-2sm text-gray-700 font-normal hover:text-primary-active cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/lead/${info.row.original.uuid}`);
                }}
              >
                {info.row.original.email || "\u00A0"}
              </a>
            </div>
          </div>
        ),
        meta: { headerClassName: "min-w-[300px]" },
      },
      {
        accessorFn: (row: Lead) => row.mobile,
        id: "mobile",
        header: ({ column }) => (
          <DataGridColumnHeader title="Mobile" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => info.row.original.mobile,
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        accessorFn: (row: Lead) => row.status,
        id: "status",
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => info.row.original.status,
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
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
                <DropdownMenuItem
                  onClick={async () => {
                    const leadData = await fetchLeadDetails(row.original.uuid);
                    if (leadData) {
                      setLeadModalOpen(true);
                    }
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigate(`/lead/${row.original.uuid}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Details
                </DropdownMenuItem>
                {/* <DropdownMenuItem
                onClick={() => {
                  setSelectedLeadForActivity({
                    id: row.original.uuid,
                    status: row.original.status,
                    address: row.original.address,
                    created_at: row.original.created_at,
                    activity_type: row.original.activity_type,
                  });
                  setActivityModalOpen(true);
                }}
              >
               <PlusCircle className="mr-2 h-4 w-4" />
                <span>Create Activity</span>
              </DropdownMenuItem> */}
                <DropdownMenuItem
                  onClick={async () => {
                    const userData = await fetchLeadDetails(row.original.uuid!);
                    if (userData) {
                      setShowDeleteDialog(true);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">Delete</span>
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
    []
  );



  const fetchLeads = async (params: TDataGridRequestParams) => {
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
      if (searchStatusTypeQuery != "-1") {
        queryParams.set("status", searchStatusTypeQuery);
      }

      // Column filters
      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value));
          }
        });
      }

      const response = await axios.get<LeadsQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/leads/?${queryParams.toString()}`
      );

      // Safely set leads data using optional chaining to prevent crashes
      setLeads(response?.data?.data);

      return {
        data: response?.data?.data,
        totalCount: response?.data?.pagination?.total || 0,
      };
    } catch (error) {
      toast(`Connection Error`, {
        description: `An error occurred while fetching leads. Please try again later`,
        action: { label: "Ok", onClick: () => console.log("Ok") },
      });
      return { data: [], totalCount: 0 };
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
        action: { label: "Undo", onClick: () => console.log("Undo") },
      });
    }
  };

  // search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  const handleStatusTypeSearch = (query: string) => {
    setStatusTypeQuery(query);
  };



  return (
    <div className="grid gap-5 lg:gap-7.5">
      {/* {(loading || fetchingLead) && leads.length === 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-black/20">
          <div className="text-black">
            <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
          </div>
        </div>
      )} */}
      {fetchingLead && leads.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
            <SpinnerDotted size={30} thickness={100} speed={100} color="currentColor" />
            <span className="text-sm font-medium">Fetching details...</span>
          </div>
        </div>
      )}
      <DataGrid
        key={refreshKey}
        columns={columns}
        serverSide={true}
        onFetchData={fetchLeads}
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
            defaultStatusType={searchStatusTypeQuery}
            setDefaultStatusType={handleStatusTypeSearch}
          />
        }
        layout={{ card: true }}
      />
      <ModalLead
        open={leadModalOpen}
        onOpenChange={handleClose}
        lead={selectedLead}
      />
      <ActivityForm
        open={activityModalOpen}
        onOpenChange={() => setActivityModalOpen(false)}
        lead={selectedLeadForActivity}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[420px] p-6">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>

            <DialogTitle className="text-lg font-semibold">
              Delete Lead
            </DialogTitle>

            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong>{selectedLead?.first_name} {selectedLead?.last_name}</strong> ({selectedLead?.email}) this lead?
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
              onClick={() => deleteLead(selectedLead?.uuid || "")}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



    </div>
  );
};

export { LeadsContent };
