import React, { useMemo, useState, useEffect, useRef, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import {
  Customer,
  QueryApiResponse,
} from "./customer-models";
import { ModalCustomer } from "./ModalCustomer";
import { ActivityForm } from "../leads/ActivityForm";

import {
  DataGrid,
  DataGridColumnHeader,
  TDataGridRequestParams,
  KeenIcon,
  DataGridRowSelectAll,
  DataGridRowSelect,
  useDataGrid,
} from "@/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Eye, AlertCircle, Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { ColumnDef, Column, RowSelectionState } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { SpinnerDotted } from 'spinners-react';

import { getCustomers, getCustomerById } from "../../services/customer.service";

// import { PersonTypeEnum } from "@/enums/PersonTypeEnum";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

type CustomersQueryApiResponse = QueryApiResponse<Customer>;

interface IPartiesCustomerContentProps {
  refreshStatus: number;
}

interface ActivityLead {
  id: string;
  status?: string;
  address?: string;
  created_at?: string;
  activity_type?: string;
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<{ uuid: string; name: string }[]>([]);

  useEffect(() => {
    setSearchInput(defaultSearch);
  }, [defaultSearch]);

  useEffect(() => {
    const fetchAllCustomers = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/customers/?dropdown=true`);
        setCustomers(response.data);
      } catch (error) {
        console.error("Failed to fetch all customers dropdown", error);
      }
    };
    fetchAllCustomers();
  }, []);

  // Handle input change and trigger debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setOpen(true); // Keep dropdown open while typing
  };
  const filteredCustomers = useMemo(() => {
    if (!searchInput) return customers;
    return customers.filter((c) =>
      c?.name?.toLowerCase()?.includes(searchInput?.toLowerCase())
    );
  }, [customers, searchInput]);

  return (
    <div className="card-header flex justify-between items-center flex-wrap gap-4 border-b-0 px-5 py-4">
      <div className="flex grow w-full md:w-auto">
        <Popover open={open} onOpenChange={setOpen}>
          <div className="relative w-full md:w-64 lg:w-72">
            <PopoverTrigger asChild>
              <div className="relative">
                <KeenIcon
                  icon="magnifier"
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-500"
                />
                <Input
                  placeholder="Search customer"
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
                {(filteredCustomers || [])?.length === 0 && (
                  <CommandEmpty>No customer found.</CommandEmpty>
                )}
                <CommandGroup>
                  {(filteredCustomers || [])?.map((customer) => (
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

const PartiesCustomerContent = ({ refreshStatus }: IPartiesCustomerContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPersonTypeQuery, setPersonTypeQuery] = useState("-1");
  const [refreshKey, setRefreshKey] = useState(0);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Customer | null>(null);
  const [selectedCustomerForActivity, setSelectedCustomerForActivity] = useState<ActivityLead | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isEditing, setIsEditing] = useState(false);
  const [customersData, setCustomersData] = useState<Customer[]>([]);

  const navigate = useNavigate();

  const MobileView = () => {
    const { table, loading: gridLoading, props } = useDataGrid();
    const rows = table.getRowModel().rows;
    const { onEdit, onDelete, onDetails } = props as any;

    if (gridLoading && rows.length === 0) return null;

    return (
      <div className="flex flex-col lg:hidden border-t border-gray-100">
        {(rows || []).map((row: any) => {
          const customer = row.original as Customer;
          return (
            <div
              key={customer.uuid}
              className="flex justify-between items-center py-4 px-5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-all active:bg-gray-50"
            >
              <div
                className="flex flex-col cursor-pointer grow pr-4"
                onClick={() => navigate(`/customer/${customer.id}`)}
              >
                <span className="font-semibold text-gray-900 text-sm mb-0.5">
                  {customer.first_name} {customer.last_name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium truncate max-w-[150px]">
                    {customer.email || "No email"}
                  </span>
                  {customer.city && (
                    <span className="text-[10px] text-gray-300 font-medium whitespace-nowrap">
                      • {customer.city}
                    </span>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center size-9 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all shrink-0">
                    <MoreVertical className="h-4.5 w-4.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-30 p-1 shadow-lg border-gray-200">
                  <DropdownMenuItem
                    className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                    onClick={() => {
                      onEdit(customer);
                    }}
                  >
                    <Edit className="mr-1 h-4 w-4 text-gray-500" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                    onClick={() => navigate(`/customer/${customer.id}`)}
                  >
                    <Eye className="mr-1 h-4 w-4 text-gray-500" />
                    Details
                  </DropdownMenuItem>
                  <div className="my-1 border-t border-gray-100"></div>
                  <DropdownMenuItem
                    className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                    onClick={() => onDelete(customer)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        {rows.length === 0 && !gridLoading && (
          <div className="p-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <KeenIcon icon="folder-search" className="text-3xl text-gray-200" />
              <span className="text-gray-400 text-sm font-medium">No customers found matching your criteria.</span>
            </div>
          </div>
        )}
      </div>
    );
  };
  // handle click for delete customer
  const handleDeleteClick = async (uuid: string) => {
    const details = await fetchCustomerDetails(uuid);
    if (details) {
      setCustomerToDelete(uuid);
      setShowDeleteDialog(true);
    }
  };

  // Fetch latest customer details from server to ensure data accuracy before edit/delete
  const fetchCustomerDetails = async (uuid: string) => {
    try {
      setFetchingDetails(true);
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/customers/${uuid}`);
      setSelectedPerson(response?.data);
      return response?.data;
    } catch (error: any) {
      toast.error("Failed to fetch customer details");
      return null;
    } finally {
      setFetchingDetails(false);
    }
  };

  const deleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/customers/${customerToDelete}`);
      toast.success("Customer deleted successfully");
      setShowDeleteDialog(false);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Delete failed");
    } finally {
      setCustomerToDelete(null);
    }
  };

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus, searchQuery, searchPersonTypeQuery]);

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

  const openPersonModal = async (event: React.SyntheticEvent, rowData: Customer | null = null) => {
    event.preventDefault();

    if (rowData?.uuid) {
      setSelectedPerson(rowData);
      setIsEditing(true);

      try {
        const result = await getCustomerById(rowData.uuid);
        if (result.success && result.data) {
          const customerData = {
            ...result?.data,
            shipping_address1: result?.data?.shipping_address1 ?? '',
            shipping_address2: result?.data?.shipping_address2 ?? '',
            shipping_city: result?.data?.shipping_city ?? '',
            shipping_state: result?.data?.shipping_state ?? '',
            shipping_country: result?.data?.shipping_country ?? '',
            shipping_pin: result?.data?.shipping_pin ?? result?.data?.shipping_zip ?? '',
          };
          setSelectedPerson(customerData);
          setPersonModalOpen(true);
        } else {
          toast.error(result.error || 'Failed to load customer data');
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
        toast.error('An error occurred while loading customer data');
      } finally {
        setIsEditing(false);
      }
    } else {
      // For new customer
      setSelectedPerson(null);
      setPersonModalOpen(true);
    }
  };

  // const handleClose = () => {
  //   setPersonModalOpen(false);
  //   setRefreshKey((prev) => prev + 1); // Trigger refresh on close

  // };

  const columns = useMemo<ColumnDef<Customer>[]>(
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
                  navigate(`/customer/${info.row.original?.id ?? ''}`);
                }}
              >
                {info.row.original.first_name} {info.row.original.last_name}
              </a>
              <a
                className="text-2sm text-gray-700 font-normal hover:text-primary-active cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/customer/${info.row.original?.id ?? ''}`);
                }}
              >
                {info.row.original.email || "\u00A0"}
              </a>
            </div>
          </div>
        ),
        meta: {
          headerClassName: "min-w-[300px]",
        },
      },
      {
        accessorFn: (row: Customer) => row.gst,
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
        accessorFn: (row: Customer) => row.mobile,
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
        accessorFn: (row: Customer) => row.city,
        id: "city",
        header: ({ column }) => (
          <DataGridColumnHeader title="City" column={column} />
        ),
        enableSorting: true,
        cell: (info: any) => {
          return info.row.original.city;
        },
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader title="Actions" column={column} className="justify-center" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-center" >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary-active"
                  disabled={loading && selectedPerson?.uuid === row.original.uuid}
                >
                  {loading && selectedPerson?.uuid === row.original.uuid ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreVertical className="h-4 w-4" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={async () => {
                    const details = await fetchCustomerDetails(row?.original?.uuid);
                    if (details) setPersonModalOpen(true);
                  }}
                >
                  {loading && selectedPerson?.uuid === row.original.uuid ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => {
                    navigate(`/customer/${row?.original?.id}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Details
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => {
                    handleDeleteClick(row?.original?.uuid);
                  }}
                  className="text-red-500 focus:text-red-500"
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

  // Fetch customers from API with pagination, sorting, and search
  const fetchCustomers = async (params: TDataGridRequestParams) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(params.pageIndex + 1));
      queryParams.set("items_per_page", String(params.pageSize));

      if (params.sorting?.[0]?.id) {
        queryParams.set("sort", params.sorting[0].id);
        queryParams.set("order", params.sorting[0].desc ? "desc" : "asc");
      }

      if (searchQuery) {
        queryParams.set("query", searchQuery);
      } else {
        queryParams.delete("query");
      }

      if (searchPersonTypeQuery !== "-1") {
        queryParams.set("person_type", searchPersonTypeQuery);
      }

      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value));
          }
        });
      }

      const response = await axios.get<CustomersQueryApiResponse>(
        `${import.meta.env.VITE_APP_API_URL}/customers/?${queryParams.toString()}`,
      );
      const payload: any = response?.data as any;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const total = payload?.pagination?.total ?? (Array.isArray(payload) ? rows.length : 0);

      setCustomers(rows);
      return {
        data: rows,
        totalCount: total,
      };
    } catch (error) {
      console.log(error);
      toast(`Connection Error`, {
        description: `An error occurred while fetching data. Please try again later`,
        action: {
          label: "Ok",
          onClick: () => console.log("Ok"),
        },
      });

      return {
        data: [],
        totalCount: 0,
      };
    } finally {
      setLoading(false);
    }
  };

  // Handle row selection changes
  const handleRowSelection = (state: RowSelectionState) => {
    setRowSelection(state);
    const selectedRowIds = Object.keys(state);
    if (selectedRowIds.length > 0) {
      toast(`Total ${selectedRowIds.length} are selected.`, {
      });
    }
  };

  return (
    <div className="grid gap-5 lg:gap-7.5 relative">
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80">
          <div className="text-primary">
            <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
          </div>
        </div>
      )}
      {/* {loading && !customersData?.length && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-black/20">
          <div className="text-primary">
            <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
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
        onFetchData={fetchCustomers}
        loading={loading}
        rowSelection={true}
        rowSelectionState={rowSelection}
        getRowId={(row: any) => row.id}
        onRowSelectionChange={handleRowSelection}
        pagination={{ size: 5 }}
        toolbar={
          <Toolbar
            defaultSearch={searchQuery}
            setSearch={setSearchQuery}
            defaultStatusType={searchPersonTypeQuery}
            setDefaultStatusType={setPersonTypeQuery}
          />
        }
        layout={{
          card: true,
          classes: {
            container: 'hidden lg:block'
          }
        }}
        onEdit={async (customer: Customer) => {
          const details = await fetchCustomerDetails(customer.uuid);
          if (details) setPersonModalOpen(true);
        }}
        onDelete={(customer: Customer) => {
          setCustomerToDelete(customer.uuid);
          setSelectedPerson(customer);
          setShowDeleteDialog(true);
        }}
        onDetails={(id: string) => {
          navigate(`/customer/${id}`);
        }}
      >
        <MobileView />
      </DataGrid>
      {/* Modal for adding/editing customers */}
      <ModalCustomer
        open={personModalOpen}
        onOpenChange={(open: boolean) => {
          setPersonModalOpen(open);

          if (!open) {
            setSelectedPerson(null);
            setRefreshKey((prev) => prev + 1); // Increment key to trigger grid refresh
          }
        }}
        onSuccess={() => {
          setPersonModalOpen(false);
          setRefreshKey((prev) => prev + 1);
        }}
        customer={
          selectedPerson
            ? {
              ...selectedPerson,
              person_type_id: (selectedPerson as any)?.person_type_id ?? 1
            }
            : null
        }
      />

      <ActivityForm open={activityModalOpen} onOpenChange={() => setActivityModalOpen(false)} lead={selectedCustomerForActivity} />
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] p-4 sm:p-6 rounded-lg">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>

            <DialogTitle className="text-lg font-semibold">Delete Customer</DialogTitle>

            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong>{selectedPerson?.first_name} {selectedPerson?.last_name}</strong> customer?
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
              onClick={deleteCustomer}
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

export { PartiesCustomerContent };
