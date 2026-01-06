import React from "react";
import { useFormik } from "formik";

interface ICustomFieldsProps {
    formik: ReturnType<typeof useFormik>;
}

export default function CustomFields({ formik }: ICustomFieldsProps) {
    return (
<<<<<<< Updated upstream
        <div className="w-full border rounded-lg p-4">
            <div className="text-center py-8">
                <div className="mb-4">
                    {/* <img
                        src="https://via.placeholder.com/50"
                        alt="No custom fields"
                        className="mx-auto mb-2"
                    /> */}
                    <p className="text-sm text-gray-500">
                        You don't have any custom fields created yet.
=======
        <div className="border rounded-lg p-4 flex flex-col items-center justify-center">
            <div className="text-center py-8">
                <div className="mb-4">
                    <img
                        src="https://via.placeholder.com/50"
                        alt="No custom fields"
                        className="mx-auto mb-2"
                    />
                    <p className="text-sm text-gray-500">
                        You don't have any custom fields created yet
>>>>>>> Stashed changes
                    </p>
                </div>
                <button
                    type="button"
                    className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                >
                    + Create Custom fields
                </button>
            </div>
        </div>
    );
<<<<<<< Updated upstream
}
=======
}
>>>>>>> Stashed changes
