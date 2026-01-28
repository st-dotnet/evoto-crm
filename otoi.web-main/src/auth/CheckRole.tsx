import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from './useAuthContext';

interface CheckRoleProps {
    allowedRoles: string[];
}

const CheckRole = ({ allowedRoles }: CheckRoleProps) => {
    const { currentUser } = useAuthContext();

    if (!currentUser || !currentUser.role) {
        return <Navigate to="/auth/login" replace />;
    }

    if (allowedRoles.includes(currentUser.role)) {
        return <Outlet />;
    }

    // Redirect to 404 if role not allowed
    return <Navigate to="/error/404" replace />;
};

export { CheckRole };
