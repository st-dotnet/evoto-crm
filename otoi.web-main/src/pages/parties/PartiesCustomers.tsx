import { Fragment, useState } from "react";
import { ModalPerson } from "./blocks/persons";
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
import { Person } from "../parties/blocks/persons/person-models";

export interface IPersonModalContentProps {
  state: boolean;
}

const PartiesCustomersPage = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0); // State to trigger refresh
  const [personModalOpen, setPersonModalOpen] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  // handle close
  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };
const openPersonModal = (event: { preventDefault: () => void }, rowData: Person | null = null) => {
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
                  <span className="text-md text-gray-600">All Leads:</span>
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            <ToolbarActions>
              <a href="#" className="btn btn-sm btn-light">
                Import CSV
              </a>
              <a className="btn btn-sm btn-primary" onClick={openPersonModal}>
                Add Customer
              </a>
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}

      <Container>
        <PartiesCustomerContent refreshStatus={refreshKey} />
        <ModalPerson open={personModalOpen} onOpenChange={handleClose} person={selectedPerson}/>
      </Container>
    </Fragment>
  );
};

export { PartiesCustomersPage };
