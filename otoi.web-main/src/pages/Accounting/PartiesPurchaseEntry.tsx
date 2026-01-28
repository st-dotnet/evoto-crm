import { Fragment, useState } from "react";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from "@/partials/toolbar";
import { useLayout } from "@/providers";
import { KeenIcon } from "@/components";
import { ModalPurchase } from "./ModalPurchases";
import { PurchaseContent } from "./PurchaseContent";
import { PurchaseEntry } from "./purchase-entry-models";

const PartiesPurchaseEntry = () => {
  const { currentLayout } = useLayout();
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PurchaseEntry | null>(null);

  const handleSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const openAddModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedEntry(null);
    setModalOpen(true);
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
                  <span className="text-md text-gray-600">Purchase Entries:</span>
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            <ToolbarActions>
              <button
                className="btn btn-sm btn-primary"
                onClick={openAddModal}
              >
                <KeenIcon icon="plus" /> Add Purchase Entry
              </button>
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}
      <Container>
        <PurchaseContent refreshStatus={refreshKey} />
        <ModalPurchase
          open={modalOpen}
          onOpenChange={setModalOpen}
          purchase_entry={selectedEntry}
          onSuccess={handleSuccess}
        />
      </Container>
    </Fragment>
  );
};

export { PartiesPurchaseEntry };
