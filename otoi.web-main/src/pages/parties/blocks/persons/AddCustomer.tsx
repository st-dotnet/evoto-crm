import React from "react";
import ModalPerson from "./ModalPerson";
import { CUSTOMER_CONFIG } from "./modalPersonUtils.ts";

interface Props {
  open: boolean;
  onOpenChange: () => void;
  editData?: Customer | null;
}

const AddCustomer: React.FC<Props> = ({ open, onOpenChange, editData }) => {
  return (
    <ModalPerson
      open={open}
      onOpenChange={onOpenChange}
      config={CUSTOMER_CONFIG}
      editData={editData}
    />
  );
};

export default AddCustomer;