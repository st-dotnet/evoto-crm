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
                  <span className="text-md text-gray-600">All Leads:</span>
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            <ToolbarActions>
              {/* Import CSV Button */}
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
                Import Leads CSV
              </button>
              {/* Download Template Button */}
              <button
                className="btn btn-sm btn-success"
                onClick={handleDownloadTemplate}
              >
                Download Lead Template
              </button>
              {/* Add Lead Button */}
              <a
                className="btn btn-sm btn-primary"
                onClick={(e) => openLeadModal(e)}
                href="#"
              >
                Add Lead
              </a>
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
