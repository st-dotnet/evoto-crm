import { Fragment, useState } from "react";
import { ModalVendor } from "./blocks/vendors/ModalVendor";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from "@/partials/toolbar";

import { PartiesVendorsContent } from "./PartiesVendorsContent";
import { useLayout } from "@/providers";
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
              <a href="#" className="btn btn-sm btn-light">
                Import CSV
              </a>
              <a className="btn btn-sm btn-primary" onClick={openPersonModal}>
                Add Vendor
              </a>
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


