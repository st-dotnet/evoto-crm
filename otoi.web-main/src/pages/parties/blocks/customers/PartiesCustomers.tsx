import { Fragment, useRef, useState } from "react";
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
import { Lead } from "../leads/lead-models";
import { PartiesCustomerContent } from "./PartiesCustomersContent";
import { ModalCustomer } from "./ModalCustomer";

export interface IPersonModalContentProps {
  state: boolean;
}

const PartiesCustomersPage = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0); // State to trigger refresh
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Lead | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  // handle close
  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };
    const openCustomerModal = (
    event: { preventDefault: () => void },
    rowData: Lead | null = null
  ) => {
    event.preventDefault();
    setSelectedCustomer(rowData);
    setPersonModalOpen(true);
  };

  //  Download Excel Template
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/customers/download-template`,
        {
          responseType: "blob",
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "customer.xlsx");
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


  //  Import CSV
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("csv_file", file);

    axios
      .post(`${import.meta.env.VITE_APP_API_URL}/csv_import/import_customers`, formData)
      .then((response) => { 
        const { message, details } = response.data;
        const { imported, skipped_no_contact, skipped_internal_duplicates, skipped_database_duplicates } = details;
        
        // Calculate total skipped records
        const totalSkipped = skipped_no_contact + skipped_internal_duplicates + skipped_database_duplicates;
        
        // Create a single comprehensive toast message
        let toastMessage = `${imported} records imported successfully`;
        
        if (totalSkipped > 0) {
          let skipReasons = [];
          if (skipped_no_contact > 0) skipReasons.push(`${skipped_no_contact} missing contact info`);
          if (skipped_internal_duplicates > 0) skipReasons.push(`${skipped_internal_duplicates} internal duplicates`);
          if (skipped_database_duplicates > 0) skipReasons.push(`${skipped_database_duplicates} existing duplicates`);
          
          toastMessage += `. ${totalSkipped} records were skipped: ${skipReasons.join(', ')}.`;
          
          toast.warning(toastMessage, {
            duration: 4000,
          });
        } else {
          toast.success(toastMessage, {
            duration: 4000,
          });
        }
        
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
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            <ToolbarActions>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".csv"
                onChange={handleImportCSV}
              />
              <button
                className="btn btn-sm btn-light"
                onClick={() => fileInputRef.current?.click()}
              >
                Import CSV
              </button>
              <button
                className="btn btn-sm btn-success"
                onClick={handleDownloadTemplate}
              >
                Download Template
              </button>
              <a className="btn btn-sm btn-primary" onClick={openCustomerModal}>
                Add Customer
              </a>
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}

      <Container>
        <PartiesCustomerContent refreshStatus={refreshKey} />
        <ModalCustomer open={personModalOpen} onOpenChange={handleClose} customer={null} />
      </Container>

       {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/50 dark:bg-black/50 overflow-hidden">
          <div className="text-primary">
            <SpinnerDotted size={50} thickness={100} speed={100} color="currentColor" />
          </div>
        </div>
      )}
    </Fragment>
  );
};

export { PartiesCustomersPage };


