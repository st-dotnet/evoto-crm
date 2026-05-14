import { Fragment, useState, useRef } from "react";
import { ModalLead } from "./blocks/leads";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from "@/partials/toolbar";
import { LeadsContent } from ".//blocks/leads/LeadsContent";
import { useLayout } from "@/providers";
import { Lead } from "../parties/blocks/leads/lead-models";
import axios from "axios";
import { toast } from "sonner";
import { SpinnerDotted } from 'spinners-react';
import { Upload, Download, Plus } from "lucide-react";

export interface ILeadModalContentProps {
  state: boolean;
}

const LeadsPage = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setLeadModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };

  const openLeadModal = (
    event: { preventDefault: () => void },
    rowData: Lead | null = null
  ) => {
    event.preventDefault();
    setSelectedLead(rowData);
    setLeadModalOpen(true);
  };

  // Download Excel Template
  const handleDownloadTemplate = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/leads/download-template`,
        {
          responseType: "blob",
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "lead-template.xlsx");
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

  // Import CSV
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("csv_file", file);

    axios
      .post(
        `${import.meta.env.VITE_APP_API_URL}/csv_import/import_leads`,
        formData
      )
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
            duration: 8000,
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
                  <span className="text-md text-gray-600 dark:text-gray-300">All Leads:</span>
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            <ToolbarActions>
              <div className="flex items-center gap-2">
                {/* Import CSV Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".csv"
                  onChange={handleImportCSV}
                />
                <button
                  className="group flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-300"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:-translate-y-0.5 transition-all duration-300 ease-in-out" />
                  <span>Import</span>
                </button>

                {/* Download Template Button */}
                <button
                  className="group flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-green-500 rounded-lg hover:bg-lime-700 shadow-sm hover:shadow transition-all duration-300"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="size-3.5 group-hover:translate-y-0.5 transition-all duration-300 ease-in-out" />
                  <span>Download Template</span>
                </button>

                {/* Add Lead Button */}
                <button
                  className="group flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all duration-300"
                  onClick={(e) => openLeadModal(e as any)}
                >
                  <Plus className="size-4 group-hover:rotate-90 transition-all duration-400 ease-in-out" />
                  <span>Add Lead</span>
                </button>
              </div>
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}
      <Container>
        <LeadsContent refreshStatus={refreshKey} />
        <ModalLead
          open={leadModalOpen}
          onOpenChange={handleClose}
          lead={selectedLead}
        />
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

export { LeadsPage };
