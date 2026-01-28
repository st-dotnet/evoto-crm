import { IToolbarActionsProps } from './types';

const ToolbarActions = ({ children }: IToolbarActionsProps) => {
  return <div className="flex items-center flex-wrap gap-2 lg:gap-2.5">{children}</div>;
};

export { ToolbarActions };
