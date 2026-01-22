import { Fragment, useState, useRef } from "react";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from "@/partials/toolbar";
import { useLayout } from "@/providers";
import axios from "axios";
import { toast } from "sonner";
import { SpinnerDotted } from 'spinners-react';
import { UsersContent } from "./Users";
import { User } from "./user-models";
import { ModalUser } from "./ModalUsers";
import { KeenIcon } from "@/components";
import { useAuthContext } from "@/auth";

export interface IUserModalContentProps {
  state: boolean;
}

const PartiesUsersPage = () => {
  const { currentLayout } = useLayout();
  const { currentUser } = useAuthContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = currentUser?.role === 'Admin';

  const handleClose = () => {
    setUserModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };

  const openUserModal = (
    event: { preventDefault: () => void },
    rowData: User | null = null
  ) => {
    event.preventDefault();
    setSelectedUser(rowData);
    setUserModalOpen(true);
  };

  // Download Excel Template (if needed)
  const handleDownloadTemplate = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/users/download-template`,
        {
          responseType: "blob",
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "user-template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Failed to download template", error);
      toast.error("Failed to download template");
    } finally {
      setLoading(false);
    }
  };

  // Import CSV (if needed)
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("csv_file", file);

    axios
      .post(
        `${import.meta.env.VITE_APP_API_URL}/csv_import/import_users`,
        formData
      )
      .then((response) => {
        toast.success(response.data.message);
        setRefreshKey((prevKey) => prevKey + 1);
        event.target.value = "";
      })
      .catch((error) => {
        const backendMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          "CSV import failed";

        console.error("CSV Import Error:", error);
        toast.error(backendMessage);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Fragment>
      {currentLayout?.name === "demo1-layout" && (
        <Container>
          <Toolbar>
            <ToolbarHeading>
              <ToolbarPageTitle />
              <ToolbarDescription>
                <div className="flex items-center flex-wrap gap-1.5 font-medium">
                  <span className="text-md text-gray-600">All Users:</span>
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            <ToolbarActions>
              {/* Add User Button */}
              {isAdmin && (
                <a
                  className="btn btn-sm btn-primary"
                  onClick={(e) => openUserModal(e)}
                  href="#"
                >
                  <KeenIcon icon="plus" /> Add User
                </a>
              )}
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}
      <Container>
        <UsersContent refreshStatus={refreshKey} />
        <ModalUser
          open={userModalOpen}
          onOpenChange={handleClose}
          user={selectedUser}
        />
      </Container>

      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/50 dark:bg-black/50 overflow-hidden">
          <div className="text-[#0D0E12]">
            <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
          </div>
        </div>
      )}
    </Fragment>
  );
};

export { PartiesUsersPage };
