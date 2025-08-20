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

import { PartiesLeadContent } from "./PartiesLeadsContent";
import { useLayout } from "@/providers";

export interface IPersonModalContentProps {
  state: boolean;
}

const PartiesLeadsPage = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0); // State to trigger refresh
  const [personModalOpen, setPersonModalOpen] = useState(false);
  // handle close
  const handleClose = () => {
    setPersonModalOpen(false);
    setRefreshKey((prevKey) => prevKey + 1);
  };
  const openPersonModal = (event: { preventDefault: () => void }) => {
    event.preventDefault();
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
                Add Lead
              </a>
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}

      <Container>
        <PartiesLeadContent refreshStatus={refreshKey} />
        <ModalPerson open={personModalOpen} onOpenChange={handleClose} />
      </Container>
    </Fragment>
  );
};

export { PartiesLeadsPage };
