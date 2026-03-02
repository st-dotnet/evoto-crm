import clsx from 'clsx';
import { IMenuLabelProps } from './';

const MenuLabel = ({
  className,
  hasItemSub,
  tabIndex,
  handleToggle,
  handleClick,
  children
}: IMenuLabelProps) => {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (hasItemSub && handleToggle) {
        handleToggle(e as any);
      } else if (handleClick) {
        handleClick(e as any);
      }
    }
  };

  if (hasItemSub) {
    return (
      <div
        className={clsx('menu-label', className && className)}
        onClick={handleToggle}
        onKeyDown={onKeyDown}
        tabIndex={tabIndex ?? 0}
        role="button"
      >
        {children}
      </div>
    );
  } else {
    return (
      <div
        className={clsx('menu-label', className && className)}
        onClick={handleClick}
        onKeyDown={onKeyDown}
        tabIndex={tabIndex ?? 0}
        role="button"
      >
        {children}
      </div>
    );
  }
};

export { MenuLabel };
