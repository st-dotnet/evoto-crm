import { Fragment, useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components";
import axios from "axios";
import { DialogClose } from "@radix-ui/react-dialog";

interface IModalPersonProps {
  open: boolean;
  onOpenChange: () => void;
  person: Person | null;
}

interface IModalPersonType {
  id: number;
  name: string;
}

interface Person {
  id?: number;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst: string;
  person_type: string;
  person_type_id?: string;
  status?: string;
}

const initialValues: Omit<Person, "person_type"> = {
  first_name: "",
  last_name: "",
  mobile: "",
  email: "",
  gst: "",
  person_type_id: "",
};

const savePersonSchema = Yup.object().shape({
  first_name: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("First Name is required"),
  last_name: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Last Name is required"),
  mobile: Yup.string()
    .min(10, "Minimum 10 symbols")
    .max(13, "Maximum 13 symbols")
    .required("Mobile is required"),
  email: Yup.string()
    .email("Wrong email format")
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols"),
    // .required("Email is required"),
  gst: Yup.string().min(15, "Minimum 15 symbols").max(15, "Maximum 15 symbols"),
  person_type_id: Yup.string().required("Person Type is required"),
});

const ModalPerson = ({ open, onOpenChange, person }: IModalPersonProps) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const from = "/parties/persons";
  const [personTypes, setPersonTypes] = useState<IModalPersonType[]>([]);

  useEffect(() => {
    const fetchPersonTypes = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/person-types/`,
        );
        setPersonTypes(response.data);
      } catch (error) {
        console.error("Error fetching person types:", error);
      }
    };
    fetchPersonTypes();
  }, []);

  const formik = useFormik({
    initialValues,
    validationSchema: savePersonSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        const postData = {
          first_name: values.first_name,
          last_name: values.last_name,
          mobile: values.mobile,
          email: values.email,
          gst: values.gst,
          person_type_id: values.person_type_id,
        };
        if (person?.id) {
          await axios.put(
            `${import.meta.env.VITE_APP_API_URL}/persons/${person.id}`,
            postData,
          );
        } else {
          await axios.post(
            `${import.meta.env.VITE_APP_API_URL}/persons/`,
            postData,
          );
        }
        onOpenChange();
        navigate(from, { replace: true });
      } catch (error) {
        console.error(error);
        setStatus("The person details are incorrect");
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    if (open && person) {
      formik.resetForm({
        values: {
          first_name: person.first_name || "",
          last_name: person.last_name || "",
          mobile: person.mobile || "",
          email: person.email || "",
          gst: person.gst || "",
          person_type_id: person.person_type_id || "",
        },
      });
    } else if (open) {
      formik.resetForm();
    }
  }, [open, person]);

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="container-fixed max-w-[600px] p-0 [&>button]:hidden">
          <DialogHeader className="modal-header">
            <DialogTitle className="modal-title">
              {person ? "Edit Person" : "Add Person"}
            </DialogTitle>
            <DialogDescription></DialogDescription>
            <DialogClose></DialogClose>
          </DialogHeader>
          <DialogBody className="modal-body">
            <div className="max-w-[auto] w-full">
              <form
                className="flex flex-col gap-5 p-10"
                noValidate
                onSubmit={formik.handleSubmit}
              >
                {formik.status && (
                  <Alert variant="danger">{formik.status}</Alert>
                )}
                <div className="flex flex-col gap-1">
                  <label className="form-label text-gray-900">First Name</label>
                  <label className="input">
                    <input
                      placeholder="first name"
                      type="input"
                      autoComplete="off"
                      {...formik.getFieldProps("first_name")}
                      className={clsx(
                        "form-control bg-transparent",
                        {
                          "is-invalid":
                            formik.touched.first_name &&
                            formik.errors.first_name,
                        },
                        {
                          "is-valid":
                            formik.touched.first_name &&
                            !formik.errors.first_name,
                        },
                      )}
                    />
                  </label>
                  {formik.touched.first_name && formik.errors.first_name && (
                    <span role="alert" className="text-danger text-xs mt-1">
                      {formik.errors.first_name}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="form-label text-gray-900">Last Name</label>
                  <label className="input">
                    <input
                      placeholder="last name"
                      type="input"
                      autoComplete="off"
                      {...formik.getFieldProps("last_name")}
                      className={clsx(
                        "form-control bg-transparent",
                        {
                          "is-invalid":
                            formik.touched.last_name && formik.errors.last_name,
                        },
                        {
                          "is-valid":
                            formik.touched.last_name &&
                            !formik.errors.last_name,
                        },
                      )}
                    />
                  </label>
                  {formik.touched.last_name && formik.errors.last_name && (
                    <span role="alert" className="text-danger text-xs mt-1">
                      {formik.errors.last_name}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="form-label text-gray-900">Mobile</label>
                  <label className="input">
                    <input
                      placeholder="mobile"
                      type="input"
                      autoComplete="off"
                      {...formik.getFieldProps("mobile")}
                      className={clsx(
                        "form-control bg-transparent",
                        {
                          "is-invalid":
                            formik.touched.mobile && formik.errors.mobile,
                        },
                        {
                          "is-valid":
                            formik.touched.mobile && !formik.errors.mobile,
                        },
                      )}
                    />
                  </label>
                  {formik.touched.mobile && formik.errors.mobile && (
                    <span role="alert" className="text-danger text-xs mt-1">
                      {formik.errors.mobile}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="form-label text-gray-900">Email</label>
                  <label className="input">
                    <input
                      placeholder="email@email.com"
                      type="email"
                      autoComplete="off"
                      {...formik.getFieldProps("email")}
                      className={clsx(
                        "form-control bg-transparent",
                        {
                          "is-invalid":
                            formik.touched.email && formik.errors.email,
                        },
                        {
                          "is-valid":
                            formik.touched.email && !formik.errors.email,
                        },
                      )}
                    />
                  </label>
                  {formik.touched.email && formik.errors.email && (
                    <span role="alert" className="text-danger text-xs mt-1">
                      {formik.errors.email}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="form-label text-gray-900">GST</label>
                  <label className="input">
                    <input
                      type="text"
                      placeholder="GST"
                      autoComplete="off"
                      {...formik.getFieldProps("gst")}
                      className={clsx(
                        "form-control bg-transparent",
                        {
                          "is-invalid": formik.touched.gst && formik.errors.gst,
                        },
                        {
                          "is-valid": formik.touched.gst && !formik.errors.gst,
                        },
                      )}
                    />
                  </label>
                  {formik.touched.gst && formik.errors.gst && (
                    <span role="alert" className="text-danger text-xs mt-1">
                      {formik.errors.gst}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="form-label text-gray-900">
                    Person Type
                  </label>
                  <label>
                    <select
                      {...formik.getFieldProps("person_type_id")}
                      className={clsx(
                        "select",
                        {
                          "is-invalid":
                            formik.touched.person_type_id && formik.errors.person_type_id,
                        },
                        {
                          "is-valid":
                            formik.touched.person_type_id && !formik.errors.person_type_id,
                        },
                      )}
                    >
                      <option value="">--Select--</option>
                      {personTypes.map((type: IModalPersonType) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {formik.touched.person_type_id && formik.errors.person_type_id && (
                    <span role="alert" className="text-danger text-xs mt-1">
                      {formik.errors.person_type_id}
                    </span>
                  )}
                </div>
                {(() => {
                  const selectedType = personTypes.find(
                    (t) => String(t.id) === String(formik.values.person_type_id)
                  );

                  if (selectedType?.id === 4) { 
                    return (
                      <div className="flex flex-col gap-1">
                        <label className="form-label text-gray-900">Status</label>
                        <label>
                          <select
                            {...formik.getFieldProps("status")}
                            className={clsx(
                              "select",
                              {
                                "is-invalid": formik.touched.status && formik.errors.status,
                              },
                              {
                                "is-valid": formik.touched.status && !formik.errors.status,
                              },
                            )}
                          >
                            <option value="NEW">NEW</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Quote Given">Quote Given</option>
                            <option value="Win">Win</option>
                            <option value="Lose">Lose</option>
                          </select>
                        </label>
                        {formik.touched.status && formik.errors.status && (
                          <span role="alert" className="text-danger text-xs mt-1">
                            {formik.errors.status}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="flex flex-col gap-1">
                  <hr></hr>
                  <button
                    type="submit"
                    className="btn btn-primary right"
                    disabled={loading || formik.isSubmitting}
                  >
                    {loading ? "Please wait..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
};

export { ModalPerson };