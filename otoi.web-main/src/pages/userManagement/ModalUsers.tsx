import { Fragment, useState, useEffect, useMemo } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components";
import axios from "axios";
import { DialogClose } from "@radix-ui/react-dialog";
import { toast } from "react-toastify";

// Props for the modal
interface IModalUserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

// User Interface
interface Role {
  id: number;
  name: string;
}

interface User {
  id?: number;
  first_name?: string;
  last_name?: string;
  // username removed as per request
  email: string;
  mobile: string;
  role?: string;
  isActive?: boolean;
  password?: string;
  confirmPassword?: string;
}

// Initial values for form
const initialValues: User = {
  first_name: "",
  last_name: "",
  email: "",
  mobile: "",
  role: "",
  isActive: true, // Default to active
  password: "",
  confirmPassword: "",
};

const ModalUser = ({ open, onOpenChange, user }: IModalUserProps) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);

  // Fetch roles list
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/roles/`
        );
        setRoles(response.data);
      } catch (error) {
        console.error("Error fetching roles:", error);
      }
    };
    fetchRoles();
  }, []);

  // Dynamic Validation Schema
  const saveUserSchema = useMemo(() => {
    return Yup.object().shape({
      first_name: Yup.string()
        .min(3, "Minimum 3 symbols")
        .max(50, "Maximum 50 symbols")
        .required("First Name is required"),
      last_name: Yup.string()
        .min(3, "Minimum 3 symbols")
        .max(50, "Maximum 50 symbols")
        .nullable(),
      email: Yup.string()
        .email("Invalid email")
        .required("Email is required"),
      mobile: Yup.string()
        .test("mobile-length", "Mobile must be 10 digits", 
            function (value) {
                if (!value) return true; 

                const digitsOnly = value.replace(/-/g, '');
                return digitsOnly.length === 10 && /^\d{10}$/.test(digitsOnly);
            }
        )
        .required("Mobile No. in digits required"),
      role: Yup.string().required("Role is required"),
      password: user?.id
        ? Yup.string().nullable()
        : Yup.string()
          .min(6, "Minimum 6 symbols")
          .required("Password is required"),
      confirmPassword: user?.id
        ? Yup.string().nullable()
        : Yup.string()
          .oneOf([Yup.ref("password"), undefined], "Passwords must match")
          .required("Confirm Password is required"),
      isActive: Yup.boolean(),
    });
  }, [user]);

  // Formik setup
  const formik = useFormik({
    initialValues,
    validationSchema: saveUserSchema,
    enableReinitialize: true, // Important to re-evaluate reuse of schema/values

    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);

      try {
        const postData = {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          mobile: values.mobile || null,
          role: values.role,
          isActive: values.isActive,
          password: values.password,
        };

        const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
        const apiBaseUsers = baseUrl.endsWith("/")
          ? `${baseUrl}users`
          : `${baseUrl}/users`;
        let response;

        if (user?.id) {
          // Update user (no password in update)
          const { password, confirmPassword, ...updateData } = values;

          console.log("API URL:", `${apiBaseUsers}/${user.id}`);
          console.log("Payload:", updateData);

          response = await axios.put(
            `${apiBaseUsers}/${user.id}`,
            updateData
          );
          toast.success("User updated successfully");
          // Navigate to user details page after update
          navigate(`/user/${user.id}`);
        } else {
          // Create user
          response = await axios.post(
            `${apiBaseUsers}/`,
            postData
          );
          toast.success("User created successfully");

          // If API returns created user ID
          const createdId = response.data?.id;
          if (createdId) {
            navigate(`/user/${createdId}`);
          } else {
            onOpenChange(false);
          }
        }
      } catch (error: any) {
        const errorMessage = error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "Something went wrong. Please try again.";
        setStatus(errorMessage);
        console.error("Error updating/creating user:", error);
        console.error("Error response:", error?.response);
      } finally {
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  // Reset form when editing a user
  useEffect(() => {
    if (open && user) {
      formik.resetForm({
        values: {
          first_name: user?.first_name || "",
          last_name: user?.last_name || "",
          email: user.email || "",
          mobile: user.mobile || "",
          role: user.role || "",
          isActive: user.isActive !== undefined ? user.isActive : true,
          password: "",
          confirmPassword: "",
        },
      });
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) {
      formik.resetForm();
    }
  }, [open]);

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          formik.resetForm();
        }
        onOpenChange(isOpen);
      }}>
        <DialogContent className="container-fixed max-w-[900px] p-0 rounded-lg shadow-lg">
          <DialogHeader className="bg-gray-50 p-6 border-b">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              {user ? "Edit User" : "Add User"}
            </DialogTitle>
            <DialogClose onClick={() => onOpenChange(false)} className="right-2 top-1 rounded-sm opacity-70" />
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="max-w-[auto] w-full">
              <form
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                noValidate
                onSubmit={formik.handleSubmit}
              >
                {formik.status && (
                  <Alert variant="danger" className="col-span-full mb-4">
                    {formik.status}
                  </Alert>
                )}

                {/* First Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    First Name<span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    placeholder="First Name"
                    type="text"
                    autoComplete="off"
                    {...formik.getFieldProps("first_name")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.first_name && formik.errors.first_name,
                      }
                    )}
                  />
                  {formik.touched.first_name && formik.errors.first_name && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.first_name}
                    </span>
                  )}
                </div>

                {/* Last Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    placeholder="Last Name"
                    type="text"
                    autoComplete="off"
                    {...formik.getFieldProps("last_name")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.last_name && formik.errors.last_name,
                      }
                    )}
                  />
                  {formik.touched.last_name && formik.errors.last_name && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.last_name}
                    </span>
                  )}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Email<span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    placeholder="Email"
                    type="email"
                    autoComplete="off"
                    {...formik.getFieldProps("email")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.email && formik.errors.email,
                      }
                    )}
                  />
                  {formik.touched.email && formik.errors.email && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.email}
                    </span>
                  )}
                </div>

                {/* Mobile */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Mobile<span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    {...formik.getFieldProps("mobile")}
                    // className="input"
                    type="text"
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.mobile && formik.errors.mobile,
                      }
                    )}
                    inputMode="tel"
                    onChange={(e) => {
                        // Allow numbers and hyphens, but not more than one hyphen in a row
                        let value = e.target.value.replace(/[^0-9-]/g, '');
                        value = value.replace(/--+/g, '-');
                        // Limit total length to 15 characters (including hyphens)
                        value = value.slice(0, 10);
                        formik.setFieldValue("mobile", value);
                        // Mark as touched to show errors
                        if (!formik.touched.mobile) {
                            formik.setFieldTouched("mobile", true);
                        }
                    }}
                    onKeyDown={(e) => {
                        // Prevent typing a hyphen at the start or after another hyphen
                        if (e.key === '-' &&
                            (formik.values.mobile.length === 0 ||
                                formik.values.mobile.endsWith('-'))) {
                            e.preventDefault();
                        }
                    }}
                    onInput={(e) => {
                      const input = e.target as HTMLInputElement;
                      if (input.value.length > 10) {
                        input.value = input.value.slice(0, 10);
                      }
                    }}
                  />
                  {formik.touched.mobile && formik.errors.mobile && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.mobile}
                    </span>
                  )}
                </div>

                {/* Role */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Role<span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    {...formik.getFieldProps("role")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.role && formik.errors.role,
                      }
                    )}
                  >
                    <option value="">--Select Role--</option>
                    {roles.map((role: Role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  {formik.touched.role && formik.errors.role && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.role}
                    </span>
                  )}
                </div>

                {/* Status (isActive) - Only show when editing */}
                {user?.id && (
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <select
                      name="isActive"
                      value={formik.values.isActive ? "true" : "false"}
                      onChange={(e) => {
                        formik.setFieldValue("isActive", e.target.value === "true");
                      }}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                )}

                {/* Password (only for new user) */}
                {!user?.id && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        Password<span style={{ color: "red" }}>*</span>
                      </label>
                      <input
                        placeholder="Password"
                        type="password"
                        autoComplete="off"
                        {...formik.getFieldProps("password")}
                        className={clsx(
                          "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                          {
                            "border-red-500 ": formik.touched.password && formik.errors.password,
                          }
                        )}
                      />
                      {formik.touched.password && formik.errors.password && (
                        <span role="alert" className="text-xs text-red-500">
                          {formik.errors.password}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        Confirm Password<span style={{ color: "red" }}>*</span>
                      </label>
                      <input
                        placeholder="Confirm Password"
                        type="password"
                        autoComplete="off"
                        {...formik.getFieldProps("confirmPassword")}
                        className={clsx(
                          "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                          {
                            "border-red-500 ": formik.touched.confirmPassword && formik.errors.confirmPassword,
                          }
                        )}
                      />
                      {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                        <span role="alert" className="text-xs text-red-500">
                          {formik.errors.confirmPassword}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Footer buttons */}
                <div className="flex justify-end col-span-full pt-4 gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-gray-100 text-gray-800 border hover:bg-gray-200 h-10 px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white btn-primary hover:bg-blue-500 h-10 px-4 py-2"
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

export { ModalUser };
