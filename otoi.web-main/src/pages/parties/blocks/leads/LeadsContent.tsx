import React, { useMemo, useState, useEffect } from "react";
import {
  Lead,
  QueryLeadApiResponse,
} from "./lead-models";

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
import { ChevronDown, MoreVertical, Settings, Edit, Trash2, Eye, PlusCircle, AlertCircle, X, Check, Filter, Circle } from "lucide-react";
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


import { useDataGrid } from "@/components";

const MobileView = ({
  onEdit,
  onDetails,
  onDelete
}: {
  onEdit: (lead: Lead) => void;
  onDetails: (uuid: string) => void;
  onDelete: (lead: Lead) => void;
}) => {
  const { table, loading } = useDataGrid();
  const rows = table.getRowModel().rows;

  if (loading && rows.length === 0) return null;

  return (
    <div className="flex flex-col lg:hidden border-t border-gray-100 bg-white">
      {rows.map((row, index) => {
        const lead = row.original as Lead;
        const initials = `${lead.first_name?.[0] || ""}${lead.last_name?.[0] || ""}`.toUpperCase();

        return (
          <div
            key={lead.uuid}
            className="flex justify-between items-center py-4 px-5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/30 transition-all animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
          >
            <div
              className="flex items-center gap-3 cursor-pointer grow pr-4"
              onClick={() => onDetails(lead.uuid)}
            >
              <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs shrink-0 border border-gray-200 shadow-sm">
                {initials}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-gray-900 text-sm mb-0.5 truncate">{lead.first_name} {lead.last_name}</span>
                <span className="text-[11px] text-gray-500 font-medium truncate">
                  {lead.email || lead.mobile || "No contact info"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${lead.status === "New" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800" :
                  lead.status === "In-Progress" ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800" :
                    lead.status === "Win" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800" :
                      lead.status === "Lose" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800" :
                        "bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-800"
                }`}>
                <span className={`size-1.5 rounded-full ${lead.status === "New" ? "bg-blue-500" :
                    lead.status === "In-Progress" ? "bg-orange-500" :
                      lead.status === "Win" ? "bg-green-500" :
                        lead.status === "Lose" ? "bg-red-500" :
                          "bg-gray-400"
                  }`} />
                {lead.status}
              </span>

              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center size-9 text-primary hover:text-primary-active transition-all shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 p-1 shadow-lg border-gray-200">
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onEdit(lead)}
                >
                  <Edit className="mr-2 h-4 w-4 text-gray-500" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onDetails(lead.uuid)}
                >
                  <Eye className="mr-2 h-4 w-4 text-gray-500" />
                  Details
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100"></div>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                  onClick={() => onDelete(lead)}
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
            <span className="text-gray-500 text-sm font-bold uppercase tracking-wider">No Leads Found</span>
            <p className="text-xs text-gray-400 max-w-[200px] mx-auto">Try adjusting your filters or search criteria.</p>
          </div>
        </div>
      )}
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

  // Toolbar related state
  const [searchInput, setSearchInput] = useState("");
  const [allLeads, setAllLeads] = useState<{ uuid: string; name: string }[]>([]);
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);

  // Debounced search handler
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setSearchQuery(query);
      }, 500),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel?.();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    const fetchAllLeads = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/leads/?dropdown=true`);
        setAllLeads(response.data);
      } catch (error) {
        console.error("Failed to fetch all leads dropdown", error);
      }
    };
    fetchAllLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    if (!searchInput) return allLeads;
    return allLeads.filter((c) =>
      c?.name?.toLowerCase()?.includes(searchInput?.toLowerCase())
    );
  }, [allLeads, searchInput]);

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
        accessorFn: (row) => row.first_name,
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Lead Information"
            filter={<ColumnInputFilter column={column} />}
            column={column}
          />
        ),
        enableSorting: true,
        cell: (info: any) => {
          const lead = info.row.original;
          const initials = `${lead.first_name?.[0] || ""}${lead.last_name?.[0] || ""}`.toUpperCase();

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
                    navigate(`/lead/${lead.uuid}`);
                  }}
                >
                  {lead.first_name} {lead.last_name}
                </a>
                <span className="text-[11px] text-gray-500 font-medium tracking-tight">
                  {lead.email || "No email provided"}
                </span>
              </div>
            </div>
          );
        },
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
          <DataGridColumnHeader title="Current Status" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => {
          const status = info.row.original.status;
          return (
            <div className="flex items-center animate-in fade-in slide-in-from-bottom-2 duration-700">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${status === "New" ? "bg-blue-50 text-blue-700 border-blue-100" :
                  status === "In-Progress" ? "bg-orange-50 text-orange-700 border-orange-100" :
                    status === "Win" ? "bg-green-50 text-green-700 border-green-100" :
                      status === "Lose" ? "bg-red-50 text-red-700 border-red-100" :
                        "bg-gray-50 text-gray-700 border-gray-100"
                }`}>
                <span className={`size-1.5 rounded-full ${status === "New" ? "bg-blue-500" :
                    status === "In-Progress" ? "bg-orange-500" :
                      status === "Win" ? "bg-green-500" :
                        status === "Lose" ? "bg-red-500" :
                          "bg-gray-400"
                  }`} />
                {status || "No Status"}
              </span>
            </div>
          );
        },
        meta: {
          headerClassName: "min-w-[150px]",
          cellClassName: "text-gray-800",
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
                <button className="flex items-center gap-1 text-sm text-primary hover:text-primary-active transition-all">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 p-1 shadow-lg border-gray-200 dark:border-gray-600">
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={async () => {
                    const leadData = await fetchLeadDetails(row.original.uuid);
                    if (leadData) {
                      setLeadModalOpen(true);
                    }
                  }}
                >
                  <Edit className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => {
                    navigate(`/lead/${row.original.uuid}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Details
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm text-red-500 dark:text-red-400 rounded-md cursor-pointer focus:bg-red-50 dark:focus:bg-red-900/20"
                  onClick={async () => {
                    const userData = await fetchLeadDetails(row.original.uuid!);
                    if (userData) {
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
    setSearchInput(query);
    debouncedSearch(query);
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
      <div className="card p-0 overflow-hidden">
        <div className="card-header flex flex-col lg:flex-row lg:justify-between gap-5 border-b-0 px-5 py-4">
          <div className="flex w-full md:w-56 lg:w-64">
            <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
              <div className="relative w-full">
                <PopoverTrigger asChild>
                  <div className="relative">
                    <KeenIcon
                      icon="magnifier"
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-500"
                    />
                    <Input
                      placeholder="Search lead"
                      value={searchInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchInput(value);
                        setIsSearchPopoverOpen(true);
                        // Trigger debounced search
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
                            handleSearch(lead?.name);
                            setIsSearchPopoverOpen(false);
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

          {/* Desktop Segmented Control */}
          <div className="hidden sm:flex items-center px-1.5 py-1 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/80 shadow-sm w-fit">
            <div className="flex items-center pl-2 pr-3 border-r border-gray-200/80 mr-1">
              <Filter className="h-3.5 w-3.5 text-gray-900 mr-2" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-900 dark:text-gray-100">Filters</span>
            </div>
            <div className="relative flex items-center">
              {/* Animated Slider Background with Glow */}
              <div
                className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${searchStatusTypeQuery === "-1" ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 shadow-gray-200/50 dark:shadow-gray-700/50" :
                  searchStatusTypeQuery === "1" ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 shadow-blue-200/50 dark:shadow-blue-700/50" :
                    searchStatusTypeQuery === "2" ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 shadow-orange-200/50 dark:shadow-orange-700/50" :
                      searchStatusTypeQuery === "3" ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 shadow-indigo-200/50 dark:shadow-indigo-700/50" :
                        searchStatusTypeQuery === "4" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 shadow-green-200/50 dark:shadow-green-700/50" :
                          searchStatusTypeQuery === "5" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 shadow-red-200/50 dark:shadow-red-700/50" :
                            "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 shadow-gray-200/50 dark:shadow-gray-700/50"
                  }`}
                style={{
                  width: "100px",
                  transform: `translateX(${searchStatusTypeQuery === "-1" ? "0px" :
                    searchStatusTypeQuery === "1" ? "100px" :
                      searchStatusTypeQuery === "2" ? "200px" :
                        searchStatusTypeQuery === "3" ? "300px" :
                          searchStatusTypeQuery === "4" ? "400px" :
                            "500px"
                    })`,
                }}
              />

              {[
                { id: "-1", label: "All" },
                { id: "1", label: "New" },
                { id: "2", label: "In-Progress" },
                { id: "3", label: "Quote Given" },
                { id: "4", label: "Win" },
                { id: "5", label: "Lose" },
              ].map((status) => (
                <button
                  key={status.id}
                  onClick={() => {
                    handleStatusTypeSearch(status.id);
                  }}
                  className={`relative w-[100px] py-1.5 text-xs font-bold rounded-md transition-all duration-300 z-10 ${searchStatusTypeQuery === status.id ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Dropdown Fallback */}
          <div className="w-full sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 w-full justify-between bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600 shadow-sm transition-all">
                  <div className="flex items-center overflow-hidden">
                    <Filter className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    <span className="truncate ml-2 font-medium text-gray-700 dark:text-gray-200">
                      {searchStatusTypeQuery === "-1" && "All Leads"}
                      {searchStatusTypeQuery === "1" && "New"}
                      {searchStatusTypeQuery === "2" && "In-Progress"}
                      {searchStatusTypeQuery === "3" && "Quote Given"}
                      {searchStatusTypeQuery === "4" && "Win"}
                      {searchStatusTypeQuery === "5" && "Lose"}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {[
                  { id: "-1", label: "All Leads" },
                  { id: "1", label: "New" },
                  { id: "2", label: "In-Progress" },
                  { id: "3", label: "Quote Given" },
                  { id: "4", label: "Win" },
                  { id: "5", label: "Lose" },
                ].map((status) => (
                  <DropdownMenuItem
                    key={status.id}
                    onClick={() => {
                      handleStatusTypeSearch(status.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Circle className="h-4 w-4 text-gray-500" />
                    <span>{status.label}</span>
                    {searchStatusTypeQuery === status.id && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

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
          layout={{
            card: false,
            classes: {
              container: 'hidden lg:block'
            }
          }}
        >
          <MobileView
            onEdit={async (lead) => {
              const leadData = await fetchLeadDetails(lead.uuid);
              if (leadData) {
                setLeadModalOpen(true);
              }
            }}
            onDetails={(uuid) => navigate(`/lead/${uuid}`)}
            onDelete={async (lead) => {
              const leadData = await fetchLeadDetails(lead.uuid!);
              if (leadData) {
                setShowDeleteDialog(true);
              }
            }}
          />
        </DataGrid>
      </div>
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] p-4 sm:p-6 rounded-lg">
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
              onClick={() => deleteLead(selectedLead?.uuid || "")}
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

export { LeadsContent };
