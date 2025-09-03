import React from "react";
import ModalPerson from "./ModalPerson";
import { LEAD_CONFIG } from "./modalPersonUtils.ts";

interface Props {
  open: boolean;
  onOpenChange: () => void;
  editData?: Lead | null;
}

const AddLead: React.FC<Props> = ({ open, onOpenChange, editData }) => {
  return (
    <ModalPerson
      open={open}
      onOpenChange={onOpenChange}
      config={LEAD_CONFIG}
      editData={editData}
    />
  );
};

export default AddLead;