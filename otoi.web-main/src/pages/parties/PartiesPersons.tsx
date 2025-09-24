import { Fragment, useState, useRef } from "react";
import { ModalPerson } from "./blocks/persons";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from "@/partials/toolbar";
import { PartiesPersonContent } from "./PartiesPersonsContent";
import { useLayout } from "@/providers";
import { Person } from "../parties/blocks/persons/person-models";
import axios from "axios";

export interface IPersonModalContentProps {
  state: boolean;
}

const PartiesPersonsPage = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };

  const openPersonModal = (
    event: { preventDefault: () => void },
    rowData: Person | null = null
  ) => {
    event.preventDefault();
    setSelectedPerson(rowData);
    setPersonModalOpen(true);
  };

  // 🔹 Download Excel Template
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/persons/download-template`,
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

  // 🔹 Import CSV
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("csv_file", file);

    axios
      .post(`${import.meta.env.VITE_APP_API_URL}/csv_import/import_csv`, formData, {
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
                  <span className="text-md text-gray-600">All Members:</span>
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
                Import CSV
              </button>
              {/* Download Template Button */}
              <button
                className="btn btn-sm btn-success"
                onClick={handleDownloadTemplate}
              >
                Download Template
              </button>
              {/* Add Person Button */}
              <a
                className="btn btn-sm btn-primary"
                onClick={(e) => openPersonModal(e)}
                href="#"
              >
                Add Person
              </a>
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}
      <Container>
        <PartiesPersonContent refreshStatus={refreshKey} />
        <ModalPerson
          open={personModalOpen}
          onOpenChange={handleClose}
          person={selectedPerson}
        />
      </Container>
    </Fragment>
  );
};

export { PartiesPersonsPage };

