import { Fragment, useState } from "react";
import { ModalVendor } from "./ModalVendor";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from "@/partials/toolbar";

import { useLayout } from "@/providers";
import { PartiesVendorsContent } from "./PartiesVendorsContent";
import { KeenIcon } from "@/components";
import { Plus } from "lucide-react";
// import { useNavigate } from "react-router-dom";
// import { toast } from "sonner";
// import axios from "axios";
// import { useRef } from "react";

// Define Vendor type locally since import path does not exist
export interface Vendor {
  uuid?: string;
  vendor_name: string;
  company_name: string;
  mobile: string;
  email: string;
  gst: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
}

export interface IPersonModalContentProps {
  state: boolean;
}

const PartiesVendorsPage = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0); // State to trigger refresh
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Vendor | null>(null);
  // handle close
  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };
  const openPersonModal = (event: { preventDefault: () => void }, rowData: Vendor | null = null) => {
    event.preventDefault();
    setSelectedPerson(rowData);
    setPersonModalOpen(true);
  };
  return (
    <Fragment>
      <style>{`
        .vendor-add-btn:hover .size-4 { transform: rotate(90deg) !important; transition: transform 0.2s ease-in-out !important; }
        .vendor-add-btn:hover svg { transform: rotate(90deg) !important; transition: transform 0.2s ease-in-out !important; }
      `}</style>
      {currentLayout?.name === "demo1-layout" && (
        <Container>
          <Toolbar>
            <ToolbarHeading>
              <ToolbarPageTitle />
              <ToolbarDescription>
                <div className="flex items-center flex-wrap gap-1.5 font-medium">
                  <span className="text-md text-gray-600">All Vendors:</span>
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            <ToolbarActions>
              <div className="flex items-center gap-2">
                <button
                  className="vendor-add-btn flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all duration-300"
                  onClick={openPersonModal}
                >
                  <Plus className="size-4" />
                  <span>Add Vendor</span>
                </button>
              </div>
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}

      <Container>
        <PartiesVendorsContent refreshStatus={refreshKey} />
        <ModalVendor open={personModalOpen} onOpenChange={handleClose} vendor={selectedPerson} />
      </Container>
    </Fragment>
  );
};

export { PartiesVendorsPage };


