import React, { useMemo, useState, useEffect } from "react";
import { ScreenLoader } from "@/components/loaders";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  DataGrid,
  DataGridColumnHeader,
  TDataGridRequestParams,
  KeenIcon,
  DataGridRowSelectAll,
  DataGridRowSelect,
  useDataGrid,
} from "@/components";
import { ColumnDef, Column, RowSelectionState } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Eye, AlertCircle, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ModalUser } from "./ModalUsers";
import { useAuthContext } from "@/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

// Define User Interface (updated to match backend)
interface User {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  mobile: string;
  role: string;
  isActive?: boolean;
  state?: string;
  country?: string;
  created_at?: string,
  created_by?: string,
  updated_at?: string,
  businesses: Array<{ id: number; name: string }>;
}

interface IUsersContentProps {
  refreshStatus: number;
}

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
}

// const Toolbar = ({
//   defaultSearch,
//   setSearch,
//   onAddUser,
// }: {
//   defaultSearch: string;
//   setSearch: (query: string) => void;
//   onAddUser: () => void;
// }) => {
//   const [searchInput, setSearchInput] = useState(defaultSearch);

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       setSearch(searchInput);
//     }, 400);

//     return () => clearTimeout(timer);
//   }, [searchInput, setSearch]);

//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setSearchInput(e.target.value);
//   };

//   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
//     if (event.key === "Enter") {
//       setSearch(searchInput);
//     }
//   };

const Toolbar = ({
  defaultSearch,
  setSearch,
  onAddUser,
}: {
  defaultSearch: string;
  setSearch: (query: string) => void;
  onAddUser: () => void;
}) => {
  const [searchInput, setSearchInput] = useState(defaultSearch);
  const [open, setOpen] = useState(false);
  const [searchableUsers, setSearchableUsers] = useState<{ uuid: string; name: string }[]>([]);

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/users/?dropdown=true`);
        setSearchableUsers(response?.data);
      } catch (error) {
        console.error("Failed to fetch all users dropdown", error);
      }
    };
    fetchAllUsers();
  }, []);

  // Handle input change and trigger debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setOpen(true); // Keep dropdown open while typing
  };
  const filteredUsers = useMemo(() => {
    if (!searchInput) return searchableUsers;
    return searchableUsers.filter((u) =>
      u?.name?.toLowerCase()?.includes(searchInput?.toLowerCase())
    );
  }, [searchableUsers, searchInput]);

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
                  placeholder="Search user"
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
                {filteredUsers.length === 0 && (
                  <CommandEmpty>No user found.</CommandEmpty>
                )}
                <CommandGroup>
                  {filteredUsers?.map((user) => (
                    <CommandItem
                      key={user?.uuid}
                      value={user?.name}
                      onSelect={() => {
                        setSearchInput(user?.name);
                        setSearch(user?.name); // Hit the API with exact selection
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          searchInput === user?.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {user?.name}
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

// Main UsersContent Component
const UsersContent = ({ refreshStatus }: IUsersContentProps) => {
  const { currentUser } = useAuthContext();
  const isAdmin = currentUser?.role === 'Admin';
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(false);

  const navigate = useNavigate();

  const MobileView = () => {
    const { table, loading: gridLoading, props } = useDataGrid();
    const rows = table.getRowModel().rows;
    const { onEdit, onDelete, onDetails } = props as any;

    if (gridLoading && rows.length === 0) return null;

    return (
      <div className="flex flex-col lg:hidden border-t border-gray-100">
        {(rows || []).map((row: any) => {
          const user = row.original as User;
          return (
            <div
              key={user.id}
              className="flex justify-between items-center py-4 px-5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-all active:bg-gray-50"
            >
              <div
                className="flex flex-col cursor-pointer grow pr-4"
                onClick={() => navigate(`/user/${user.id}`)}
              >
                <span className="font-semibold text-gray-900 text-sm mb-0.5">
                  {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium truncate max-w-[150px]">
                    {user.email}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
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
                    onClick={() => onEdit(user)}
                  >
                    <Edit className="mr-1 h-4 w-4 text-gray-500" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                    onClick={() => onDetails(user.id)}
                  >
                    <Eye className="mr-1 h-4 w-4 text-gray-500" />
                    Details
                  </DropdownMenuItem>
                  <div className="my-1 border-t border-gray-100"></div>
                  <DropdownMenuItem
                    className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                    onClick={() => onDelete(user)}
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
              <span className="text-gray-400 text-sm font-medium">No users found matching your criteria.</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus, searchQuery]);

  // Server-side fetch function
  const fetchUsers = async (params: TDataGridRequestParams) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(params?.pageIndex + 1));
      queryParams.set("items_per_page", String(params?.pageSize));

      if (searchQuery.trim()?.length > 0) {
        queryParams.set("query", searchQuery);
      }

      if (params.sorting?.[0]?.id) {
        queryParams.set("sort", params.sorting[0]?.id);
        queryParams.set("order", params.sorting[0]?.desc ? "desc" : "asc");
      }

      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/users/?${queryParams.toString()}`
      );

      setUsers(response?.data?.data);
      return {
        data: response?.data?.data,
        totalCount: response?.data?.pagination?.total || 0,
      };
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to fetch users");
      return { data: [], totalCount: 0 };
    } finally {
      setLoading(false);
    }
  };

  // Column Filter Component
  const ColumnInputFilter = <TData, TValue>({ column }: IColumnFilterProps<TData, TValue>) => {
    const [inputValue, setInputValue] = useState((column.getFilterValue() as string) ?? "");

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        column.setFilterValue(inputValue);
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


  // Fetch Single User Details
  const fetchUserDetails = async (userId: string) => {
    try {
      setFetchingUser(true);
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/users/${userId}`);
      setSelectedUser(response?.data);
      return response?.data;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to fetch user details");
      return null;
    } finally {
      setFetchingUser(false);
    }
  };

  // Delete User (updated endpoint)
  const deleteUser = async (userId: string) => {
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/users/${userId}`);
      toast.success("User deleted successfully");
      setShowDeleteDialog(false);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || "Delete failed";
      toast.error(errorMessage);
    }
  };

  // Columns Definition (updated for `id` and `username`)
  const columns = useMemo<ColumnDef<User>[]>(
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
        accessorFn: (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Name"
            filter={<ColumnInputFilter column={column} />}
            column={column}
          />
        ),
        enableSorting: true,
        cell: (info) => (
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <a
                className="font-medium text-sm text-gray-900 hover:text-primary-active mb-px cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/user/${info.row.original.id}`);
                }}
              >
                {`${info.row.original.first_name || ''} ${info.row.original.last_name || ''}`.trim() || info.row.original.email}
              </a>
              <a
                className="text-2sm text-gray-700 font-normal hover:text-primary-active cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/user/${info.row.original.id}`);
                }}
              >
                {info.row.original.email}
              </a>
            </div>
          </div>
        ),
        meta: { headerClassName: "min-w-[300px]" },
      },
      {
        accessorFn: (row) => row.mobile,
        id: "mobile",
        header: ({ column }) => <DataGridColumnHeader title="Mobile" column={column} />,
        enableSorting: true,
        cell: (info) => info.row.original.mobile,
        meta: { headerClassName: "min-w-[137px]", cellClassName: "text-gray-800 font-medium" },
      },
      {
        accessorFn: (row) => row.role,
        id: "role",
        header: ({ column }) => <DataGridColumnHeader title="Role" column={column} />,
        enableSorting: true,
        cell: (info) => info.row.original.role,
        meta: { headerClassName: "min-w-[137px]", cellClassName: "text-gray-800 font-medium" },
      },
      {
        accessorFn: (row) => row.isActive,
        id: "isActive",
        header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${row.original.isActive
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
              }`}
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </span>
        ),
        meta: { headerClassName: "min-w-[100px]", cellClassName: "text-gray-800 font-medium" },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader title="Actions" column={column} className="justify-center" />
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
                {isAdmin && (
                  <DropdownMenuItem
                    onClick={async () => {
                      const userData = await fetchUserDetails(row.original.id);
                      if (userData) {
                        setLeadModalOpen(true);
                      }
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    navigate(`/user/${row.original.id}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Details
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem
                    onClick={async () => {
                      const userData = await fetchUserDetails(row.original.id);
                      if (userData) {
                        setShowDeleteDialog(true);
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                    <span className="text-red-500">Delete</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        meta: { headerClassName: "w-28", cellClassName: "text-gray-800 font-medium" },
      },
    ],
    []
  );

  const handleRowSelection = (state: RowSelectionState) => {
    setRowSelection(state);
    const selectedRowIds = Object.keys(state);
    if (selectedRowIds.length > 0) {
      toast(`Total ${selectedRowIds.length} users are selected.`);
    }
  };
  const handleClose = () => {
    setLeadModalOpen(false);
    setRefreshKey((prev) => prev + 1);
  };
  // Search Handler
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="grid gap-5 lg:gap-7.5">
      {/* {(loading || fetchingUser) && users.length === 0 && (
        <ScreenLoader />
      )} */}
      {fetchingUser && (
        <ScreenLoader />
      )}
      <DataGrid
        key={refreshKey}
        columns={columns}
        serverSide={true}
        onFetchData={fetchUsers}
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
            onAddUser={() => {
              setSelectedUser(null);
              setLeadModalOpen(true);
            }}
          />
        }
        layout={{
          card: true,
          classes: {
            container: 'hidden lg:block'
          }
        }}
        onEdit={(user: User) => {
          setSelectedUser(user);
          setLeadModalOpen(true);
        }}
        onDelete={(user: User) => {
          setSelectedUser(user);
          setShowDeleteDialog(true);
        }}
        onDetails={(id: string) => {
          navigate(`/user/${id}`);
        }}
      >
        <MobileView />
      </DataGrid>
      <ModalUser
        open={leadModalOpen}
        onOpenChange={handleClose}
        user={selectedUser}
      />
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] p-4 sm:p-6 rounded-lg">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-semibold">Delete User</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong> 
              {/* ({selectedUser?.email})? */}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-3 mt-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUser(selectedUser?.id || "")}
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

export { UsersContent };
