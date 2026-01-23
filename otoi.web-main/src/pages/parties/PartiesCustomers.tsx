import { Fragment, useRef, useState } from "react";
import { ModalCustomer } from "./blocks/customers/ModalCustomer";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from "@/partials/toolbar";

import { PartiesCustomerContent } from "./PartiesCustomersContent";
import { useLayout } from "@/providers";
import { Lead } from "../parties/blocks/leads/lead-models";
import axios from "axios";

export interface IPersonModalContentProps {
  state: boolean;
}

const PartiesCustomersPage = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0); // State to trigger refresh
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Lead | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // handle close
  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };
  const openPersonModal = (event: { preventDefault: () => void }, rowData: Lead | null = null) => {
    event.preventDefault();
    setSelectedPerson(rowData);
    setPersonModalOpen(true);
  };

  //  Download Excel Template
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
      link.setAttribute("download", "template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Failed to download template", error);
    }
  };


  //  Import CSV
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("csv_file", file);

    axios
      .post(`${import.meta.env.VITE_APP_API_URL}/csv_import/import_csv`, formData)
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
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            {/* <ToolbarActions>
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
              <a className="btn btn-sm btn-primary" onClick={openPersonModal}>
                Add Customer
              </a>
            </ToolbarActions> */}
          </Toolbar>
        </Container>
      )}

      <Container>
        <PartiesCustomerContent refreshStatus={refreshKey} />
        <ModalCustomer open={personModalOpen} onOpenChange={handleClose} customer={null} />
      </Container>
    </Fragment>
  );
};

export { PartiesCustomersPage };


