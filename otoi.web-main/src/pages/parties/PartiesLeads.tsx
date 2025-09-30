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
import { LeadsContent } from ".//LeadsContent";
import { useLayout } from "@/providers";
import { Lead } from "../parties/blocks/leads/lead-models";
import axios from "axios";

export interface ILeadModalContentProps {
  state: boolean;
}

const LeadsPage = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
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
    }
  };

  // Import CSV
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("csv_file", file);

    axios
      .post(`${import.meta.env.VITE_APP_API_URL}/csv_import/import_leads`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      .then((response) => {
        alert(response.data.message);
        setRefreshKey((prevKey) => prevKey + 1);
      })
      .catch((error) => {
        console.error("Failed to import CSV", error);
        alert("Failed to import CSV");
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
    </Fragment>
  );
};

export { LeadsPage };
