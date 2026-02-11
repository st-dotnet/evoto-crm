import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Alert, KeenIcon } from '@/components';
import { useAuthContext } from '@/auth';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useNavigate, Link } from 'react-router-dom';
import { useLayout } from '@/providers';
import { AxiosError } from 'axios';

const passwordSchema = Yup.object().shape({
  newPassword: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password')
});

const ResetPasswordChange = () => {
  const { currentLayout } = useLayout();
  const { validateResetToken, changePassword } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [hasErrors, setHasErrors] = useState<boolean | undefined>(undefined);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirmation, setShowNewPasswordConfirmation] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token');

  // Validate token on mount
  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setTokenError('Invalid or missing reset link. Please request a new one.');
        setValidating(false);
        return;
      }
      try {
        await validateResetToken(token);
        setTokenValid(true);
      } catch (error) {
        if (error instanceof AxiosError && error.response) {
          setTokenError(error.response.data.error || 'This reset link is invalid or has expired.');
        } else {
          setTokenError('This reset link is invalid or has expired.');
        }
      } finally {
        setValidating(false);
      }
    };
    validate();
  }, []);

  const formik = useFormik({
    initialValues: {
      newPassword: '',
      confirmPassword: ''
    },
    validationSchema: passwordSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      if (!token) return;
      setLoading(true);
      setHasErrors(undefined);
      try {
        await changePassword(token, values.newPassword, values.confirmPassword);
        setHasErrors(false);
        navigate(
          currentLayout?.name === 'auth-branded'
            ? '/auth/reset-password/changed'
            : '/auth/classic/reset-password/changed'
        );
      } catch (error) {
        if (error instanceof AxiosError && error.response) {
          setStatus(error.response.data.error || 'Password reset failed.');
        } else {
          setStatus('Password reset failed. Please try again.');
        }
        setHasErrors(true);
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    }
  });

  // Show loading while validating token
  if (validating) {
    return (
      <div className="card max-w-[370px] w-full">
        <div className="card-body flex flex-col items-center gap-5 p-10">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">Validating Reset Link</h3>
            <span className="text-2sm text-gray-700 mt-2">Please wait...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error if token is invalid/expired
  if (!tokenValid) {
    return (
      <div className="card max-w-[370px] w-full">
        <div className="card-body flex flex-col items-center gap-5 p-10">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Link Expired</h3>
            <p className="text-2sm text-gray-700 mb-5">{tokenError}</p>
          </div>
          <Link
            to={currentLayout?.name === 'auth-branded' ? '/auth/reset-password' : '/auth/classic/reset-password'}
            className="btn btn-primary flex justify-center"
          >
            Request New Link
          </Link>
          <Link
            to={currentLayout?.name === 'auth-branded' ? '/auth/login' : '/auth/classic/login'}
            className="flex items-center justify-center text-sm gap-2 text-gray-700 hover:text-primary"
          >
            <KeenIcon icon="black-left" />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card max-w-[370px] w-full">
      <form
        className="card-body flex flex-col gap-5 p-10"
        onSubmit={formik.handleSubmit}
        noValidate
      >
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Reset Password</h3>
          <span className="text-2sm text-gray-700">Enter your new password</span>
        </div>

        {hasErrors && <Alert variant="danger">{formik.status}</Alert>}

        <div className="flex flex-col gap-1">
          <label className="form-label text-gray-900">New Password</label>
          <label className="input">
            <input
              type={showNewPassword ? 'text' : 'password'}
              placeholder="Enter a new password"
              autoComplete="off"
              {...formik.getFieldProps('newPassword')}
              className={clsx(
                'form-control bg-transparent',
                { 'is-invalid': formik.touched.newPassword && formik.errors.newPassword },
                { 'is-valid': formik.touched.newPassword && !formik.errors.newPassword }
              )}
            />
            <button
              className="btn btn-icon"
              onClick={(e) => {
                e.preventDefault();
                setShowNewPassword(!showNewPassword);
              }}
            >
              <KeenIcon icon="eye" className={clsx('text-gray-500', { hidden: showNewPassword })} />
              <KeenIcon
                icon="eye-slash"
                className={clsx('text-gray-500', { hidden: !showNewPassword })}
              />
            </button>
          </label>
          {formik.touched.newPassword && formik.errors.newPassword && (
            <span role="alert" className="text-danger text-xs mt-1">
              {formik.errors.newPassword}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="form-label font-normal text-gray-900">Confirm New Password</label>
          <label className="input">
            <input
              type={showNewPasswordConfirmation ? 'text' : 'password'}
              placeholder="Re-enter a new Password"
              autoComplete="off"
              {...formik.getFieldProps('confirmPassword')}
              className={clsx(
                'form-control bg-transparent',
                { 'is-invalid': formik.touched.confirmPassword && formik.errors.confirmPassword },
                { 'is-valid': formik.touched.confirmPassword && !formik.errors.confirmPassword }
              )}
            />
            <button
              className="btn btn-icon"
              onClick={(e) => {
                e.preventDefault();
                setShowNewPasswordConfirmation(!showNewPasswordConfirmation);
              }}
            >
              <KeenIcon
                icon="eye"
                className={clsx('text-gray-500', { hidden: showNewPasswordConfirmation })}
              />
              <KeenIcon
                icon="eye-slash"
                className={clsx('text-gray-500', { hidden: !showNewPasswordConfirmation })}
              />
            </button>
          </label>
          {formik.touched.confirmPassword && formik.errors.confirmPassword && (
            <span role="alert" className="text-danger text-xs mt-1">
              {formik.errors.confirmPassword}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary flex justify-center grow"
          disabled={loading}
        >
          {loading ? 'Please wait...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
};

export { ResetPasswordChange };
