import { IToolbarProps } from './types';

const Toolbar = ({ children }: IToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center lg:items-end justify-between gap-2.5 lg:gap-5 pb-5 lg:pb-7.5">
      {children}
    </div>
  );
};

export { Toolbar };
