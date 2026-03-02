import React, { Fragment, useState } from "react";
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
import { toast } from "sonner";
import { useResponsive } from "@/hooks";

type Role = "Admin" | "Manager" | "User";
type Action = "View" | "Add" | "Edit" | "Delete";
type Module = "Leads" | "Customers" | "Vendors" | "Purchase Entries" | "Users";

interface PermissionState {
  [role: string]: {
    [module: string]: {
      [action in Action]?: boolean;
    };
  };
}

const PartiesRoles: React.FC = () => {
  const { currentLayout } = useLayout();
  const isMobile = useResponsive("down", "lg");
  const roles: Role[] = ["Admin", "Manager", "User"];
  const modules: Module[] = [
    "Leads",
    "Customers",
    "Vendors",
    "Purchase Entries",
    "Users",
  ];
  const actions: Action[] = ["View", "Add", "Edit", "Delete"];

  const [selectedRole, setSelectedRole] = useState<Role>("Admin");
  const [permissions, setPermissions] = useState<PermissionState>({
    Admin: {},
    Manager: {},
    User: {},
  });

  const handleToggle = (moduleName: Module, actionName: Action) => {
    setPermissions((prev) => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [moduleName]: {
          ...prev[selectedRole][moduleName],
          [actionName]: !prev[selectedRole][moduleName]?.[actionName],
        },
      },
    }));
  };

  const toggleRow = (moduleName: Module) => {
    const allSelected = actions.every(
      (a) => permissions[selectedRole][moduleName]?.[a]
    );
    const newState = { ...permissions[selectedRole][moduleName] };
    actions.forEach((a) => (newState[a] = !allSelected));

    setPermissions((prev) => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], [moduleName]: newState },
    }));
  };

  const toggleAll = () => {
    const allSelected = modules.every((m) =>
      actions.every((a) => permissions[selectedRole][m]?.[a])
    );
    const newModules: PermissionState[string] = {};
    modules.forEach((m) => {
      newModules[m] = {};
      actions.forEach((a) => {
        newModules[m][a] = !allSelected;
      });
    });

    setPermissions((prev) => ({
      ...prev,
      [selectedRole]: newModules,
    }));
  };

  const handleSave = () => {
    toast.success("Permissions saved successfully");
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
                  <span className="text-md text-gray-600">
                    Manage permissions for each role
                  </span>
                </div>
              </ToolbarDescription>
            </ToolbarHeading>
            <ToolbarActions>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSave}
              >
                <KeenIcon icon="check" /> Save Changes
              </button>
            </ToolbarActions>
          </Toolbar>
        </Container>
      )}

      <Container>
        <div className="grid gap-5 lg:gap-7.5">
          {/* Role Selector Tabs */}
          <div className="card">
            <div className="card-header border-b-0 px-5 py-4">
              <h3 className="card-title text-sm font-semibold text-gray-900">
                Select Role
              </h3>
            </div>
            <div className="card-body px-5 pb-5 pt-0">
              <div className="flex flex-wrap gap-2.5">
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`btn btn-sm flex-1 sm:flex-none justify-center ${selectedRole === role
                      ? "btn-primary"
                      : "btn-light"
                      }`}
                  >
                    <KeenIcon
                      icon={role === "Admin" ? "security-user" : "shield-tick"}
                      className="text-current"
                    />
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Permissions Table */}
          <div className="card">
            <div className="card-header flex-wrap gap-2 border-b px-5 py-4">
              <h3 className="card-title text-sm font-semibold text-gray-900">
                {selectedRole} Permissions
              </h3>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-xs btn-light"
                  onClick={toggleAll}
                >
                  Toggle All
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              {isMobile ? (
                <div className="grid gap-4 p-5">
                  {modules.map((module) => (
                    <div key={module} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-gray-900 text-sm">
                          {module}
                        </span>
                        <button
                          onClick={() => toggleRow(module)}
                          className="btn btn-xs btn-light"
                        >
                          Toggle Row
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {actions.map((action) => {
                          const isActive = permissions[selectedRole]?.[module]?.[action];
                          return (
                            <div key={action} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100">
                              <span className="text-xs font-medium text-gray-600">{action}</span>
                              <label className="switch switch-sm">
                                <input
                                  type="checkbox"
                                  checked={!!isActive}
                                  onChange={() => handleToggle(module, action)}
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table align-middle text-sm text-gray-500">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-5 py-3 text-start text-xs font-semibold uppercase text-gray-600 min-w-[180px]">
                          Module
                        </th>
                        {actions.map((action) => (
                          <th
                            key={action}
                            className="px-5 py-3 text-start text-xs font-semibold uppercase text-gray-600 min-w-[100px]"
                          >
                            {action}
                          </th>
                        ))}
                        <th className="px-5 py-3 text-center text-xs font-semibold uppercase text-gray-600 min-w-[120px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((module) => (
                        <tr
                          key={module}
                          className="border-b border-gray-200 last:border-b-0"
                        >
                          <td className="px-5 py-3.5">
                            <span className="font-medium text-gray-900 text-sm">
                              {module}
                            </span>
                          </td>
                          {actions.map((action) => {
                            const isActive =
                              permissions[selectedRole]?.[module]?.[action];
                            return (
                              <td key={action} className="px-5 py-3.5 text-center">
                                <label className="switch switch-sm">
                                  <input
                                    type="checkbox"
                                    checked={!!isActive}
                                    onChange={() =>
                                      handleToggle(module, action)
                                    }
                                    className="order-1"
                                  />
                                </label>
                              </td>
                            );
                          })}
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => toggleRow(module)}
                              className="btn btn-xs btn-light"
                            >
                              Toggle Row
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <KeenIcon icon="information-2" className="text-gray-400" />
            <span>
              Currently editing{" "}
              <strong className="text-gray-900">{selectedRole}</strong>{" "}
              access level.
            </span>
          </div>
        </div>
      </Container>
    </Fragment>
  );
};

export default PartiesRoles;