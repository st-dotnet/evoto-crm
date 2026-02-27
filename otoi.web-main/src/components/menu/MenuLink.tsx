import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { IMenuLinkProps } from './';

const MenuLink = ({
  path,
  newTab,
  hasItemSub = false,
  externalLink,
  className,
  tabIndex,
  handleToggle,
  handleClick,
  children
}: IMenuLinkProps) => {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (hasItemSub && handleToggle) {
        handleToggle(e as any);
      } else if (handleClick) {
        handleClick(e as any);
      }
    }
  };
  if (!hasItemSub && path) {
    if (externalLink) {
      const target = newTab ? '_blank' : '_self';

      return (
        <a
          href={path}
          target={target}
          rel="noopener"
          onClick={handleClick}
          className={clsx('menu-link', className && className)}
        >
          {children}
        </a>
      );
    } else {
      return (
        <Link to={path} onClick={handleClick} className={clsx('menu-link', className && className)}>
          {children}
        </Link>
      );
    }
  } else {
    if (hasItemSub) {
      return (
        <div
          className={clsx('menu-link', className && className)}
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
          className={clsx('menu-link', className && className)}
          onClick={handleClick}
          onKeyDown={onKeyDown}
          tabIndex={tabIndex ?? 0}
          role="button"
        >
          {children}
        </div>
      );
    }
  }
};

export { MenuLink };
