import React from "react";
import ModalPerson from "./ModalPerson";
import { PERSON_CONFIG } from "./modalPersonUtils.ts";

interface Props {
  open: boolean;
  onOpenChange: () => void;
  editData?: Person | null;
}

const AddPerson: React.FC<Props> = ({ open, onOpenChange, editData }) => {
  return (
    <ModalPerson
      open={open}
      onOpenChange={onOpenChange}
      config={PERSON_CONFIG}
      editData={editData}
    />
  );
};

export default AddPerson;