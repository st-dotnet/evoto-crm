import * as React from 'react';
import { UNSAFE_DataRouterContext } from 'react-router-dom';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React {
    function unstable_useBlocker(shouldBlock: boolean | (() => boolean)): {
      state: 'unblocked' | 'blocked' | 'proceeding';
      reset: () => void;
      proceed: () => void;
    };
  }
}

/**
 * Custom hook to handle navigation blocking with a more stable API.
 * Wraps the unstable_useBlocker from react-router-dom.
 * 
 * @param shouldBlock - Boolean or function that returns a boolean indicating whether to block navigation
 * @returns The blocker object from useBlocker
 */

/**
 * Custom hook to handle navigation blocking with a more stable API.
 * Wraps the unstable_useBlocker from react-router-dom.
 * 
 * @param shouldBlock - Boolean or function that returns a boolean indicating whether to block navigation
 * @returns The blocker object from useBlocker
 */
export function useNavigationBlocker(shouldBlock: boolean | (() => boolean)) {
  const dataRouterContext = React.useContext(UNSAFE_DataRouterContext);
  
  if (!dataRouterContext) {
    throw new Error('useNavigationBlocker must be used within a DataRouter');
  }
  
  return React.unstable_useBlocker(shouldBlock);
}
