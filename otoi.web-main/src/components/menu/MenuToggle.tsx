import clsx from 'clsx';

import { IMenuToggleProps } from './';

const MenuToggle = ({
  className,
  tabIndex,
  hasItemSub = false,
  handleToggle,
  children
}: IMenuToggleProps) => {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && handleToggle) {
      handleToggle(e as any);
    }
  };

  if (hasItemSub) {
    return (
      <div
        className={clsx('menu-toggle', className && className)}
        onClick={handleToggle}
        onKeyDown={onKeyDown}
        tabIndex={tabIndex ?? 0}
        role="button"
      >
        {children}
      </div>
    );
  } else {
    return <div className={clsx('menu-toggle', className && className)}>{children}</div>;
  }
};

export { MenuToggle };
