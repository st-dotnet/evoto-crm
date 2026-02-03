import React, { useMemo, useState, useEffect } from "react";
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
} from "@/components";
import { ColumnDef, Column, RowSelectionState } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Eye, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { ModalUser } from "./ModalUsers";
import { useAuthContext } from "@/auth";

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

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchInput, setSearch]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            setSearch(searchInput);
        }
    };

    return (
        <div className="card-header flex justify-between flex-wrap gap-2 border-b-0 px-5">
            <div className="flex flex-wrap gap-2 lg:gap-5">
                <label className="input input-sm">
                    <KeenIcon icon="magnifier" />
                    <input
                        type="text"
                        placeholder="Search user"
                        value={searchInput}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                    />
                </label>
            </div>
      {/* <div className="flex items-center gap-2.5">
            <button className="btn btn-sm btn-primary" onClick={onAddUser}>
              <KeenIcon icon="plus" /> Add User
            </button>
          </div> */}
        </div>
    );
};

// Main UsersContent Component
const UsersContent = ({ refreshStatus }: IUsersContentProps) => {
  const { currentUser } = useAuthContext();
  const isAdmin = currentUser?.role === 'Admin';
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredItems, setFilteredItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(false);

  const navigate = useNavigate();

  // Fetch Users from API (updated for all users)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/users/`, {
        params: {
          page: 1,
          items_per_page: 1000, // Fetch all users
        },
      });
      setUsers(response.data.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Single User Details
  const fetchUserDetails = async (userId: string) => {
    try {
      setFetchingUser(true);
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/users/${userId}`);
      setSelectedUser(response.data);
      return response.data;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to fetch user details");
      return null;
    } finally {
      setFetchingUser(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [refreshStatus]);

  // Filter Users (updated for username/mobile)
  useEffect(() => {
    let result = Array.isArray(users) ? [...users] : [];
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (trimmedQuery) {
      result = result.filter(
        (user) =>
          `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase().includes(trimmedQuery) ||
          user.email.toLowerCase().includes(trimmedQuery) ||
          (user.mobile && user.mobile.includes(trimmedQuery))
      );
    }
    setFilteredItems(result);
  }, [searchQuery, users]);

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

  // Delete User (updated endpoint)
  const deleteUser = async (userId: string) => {
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API_URL}/users/${userId}`);
      toast.success("User deleted successfully");
      setShowDeleteDialog(false);
      fetchUsers();
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

  // Handle Row Selection
  const handleRowSelection = (state: RowSelectionState) => {
    const selectedRowIds = Object.keys(state);
    if (selectedRowIds.length > 0) {
      toast(`Total ${selectedRowIds.length} users are selected.`);
    }
  };
  const handleClose = () => {
    setLeadModalOpen(false);
    fetchUsers();
  };
  // Search Handler
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="grid gap-5 lg:gap-7.5">
      {(loading || fetchingUser) && users.length === 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-black/20">
          <div className="text-black">
            <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
          </div>
        </div>
      )}
      {fetchingUser && users.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
            <SpinnerDotted size={30} thickness={100} speed={100} color="currentColor" />
            <span className="text-sm font-medium">Fetching details...</span>
          </div>
        </div>
      )}
      {!loading && (
        <DataGrid
          key={refreshKey}
          columns={columns}
          serverSide={false}
          data={filteredItems}
          loading={loading}
          rowSelection={true}
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
          layout={{ card: true }}
        />
      )}
      <ModalUser
        open={leadModalOpen}
        onOpenChange={handleClose}
        user={selectedUser}
      />
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[420px] p-6">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-semibold">Delete User</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong> ({selectedUser?.email})?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUser(selectedUser?.id || "")}
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

export { UsersContent };
