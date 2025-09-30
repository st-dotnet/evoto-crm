import axios from "axios";


export interface Lead {
  uuid?: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst?: string;
  status?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: number;
  reason?: string;
  address1?: string;
  address2?: string;
}

export interface Customer {
  uuid?: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst?: string;
  status?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: number;
  reason?: string;
  address1?: string;
  address2?: string;
}

export interface ModalPersonConfig {
  isPerson: boolean;
  isLead: boolean;
  isCustomer: boolean;
  title: {
    add: string;
    edit: string;
  };
}

// Constants
export const MODAL_PERSON_CONSTANTS = {
  INITIAL_VALUES: {
    first_name: "",
    last_name: "",
    mobile: "",
    email: "",
    gst: "",
    status: "",
    city: "",
    state: "",
    country: "",
    pin: "",
    address1: "",
    address2: "",
    reason: "",
  },
};

// Configurations
export const PERSON_CONFIG: ModalPersonConfig = {
  isPerson: true,
  isLead: false,
  isCustomer: false,
  title: {
    add: "Add Person",
    edit: "Edit Person",
  },
};

export const LEAD_CONFIG: ModalPersonConfig = {
  isPerson: false,
  isLead: true,
  isCustomer: false,
  title: {
    add: "Add Lead",
    edit: "Edit Lead",
  },
};

export const CUSTOMER_CONFIG: ModalPersonConfig = {
  isPerson: false,
  isLead: false,
  isCustomer: true,
  title: {
    add: "Add Customer",
    edit: "Edit Customer",
  },
};

// Utility functions
export const prepareFormInitialValues = (
  editData: Lead | Customer | null,
  formik: any
) => {
  if (editData) {
    formik.resetForm({
      values: {
        first_name: editData.first_name || "",
        last_name: editData.last_name || "",
        mobile: editData.mobile || "",
        email: editData.email || "",
        gst: editData.gst || "",
        status: editData.status || "",
        city: editData.city || "",
        state: editData.state || "",
        country: editData.country || "",
        pin: editData.pin || "",
        address1: editData.address1 || "",
        address2: editData.address2 || "",
        reason: editData.reason || "",
      },
    });
  } else {
    formik.resetForm();
  }
};

export const submitModalPersonForm = async (
  values: Omit<Lead, "uuid">,
  editData:  Lead | Customer | null,
  config: ModalPersonConfig,
  apiUrl: string
) => {
  const postData = {
    first_name: values.first_name,
    last_name: values.last_name,
    mobile: values.mobile,
    email: values.email,
    gst: values.gst,
    status: values.status,
    city: values.city,
    state: values.state,
    country: values.country,
    pin: values.pin,
    address1: values.address1,
    address2: values.address2,
    reason: values.reason,
  };

  let url = "";
  if (config.isLead) {
    url = editData?.uuid
      ? `${apiUrl}/leads/${editData.uuid}`
      : `${apiUrl}/leads/`;
  } else if (config.isCustomer) {
    url = editData?.uuid
      ? `${apiUrl}/customers/${editData.uuid}`
      : `${apiUrl}/customers/`;
  }

  if (editData?.uuid) {
    return await axios.put(url, postData);
  } else {
    return await axios.post(url, postData);
  }
};
