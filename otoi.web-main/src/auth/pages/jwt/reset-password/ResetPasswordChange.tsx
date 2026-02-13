import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Alert, KeenIcon } from '@/components';
import { useAuthContext } from '@/auth';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '@/providers';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/utils';

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
  const { changePassword, verifyResetToken } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [hasErrors, setHasErrors] = useState<boolean | undefined>(undefined);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirmation, setShowNewPasswordConfirmation] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const e = searchParams.get('e');
    const token = searchParams.get('token');

    const checkToken = async () => {
      if (!e || !token) {
        setIsVerifying(false);
        setIsTokenValid(false);
        return;
      }

      try {
        await verifyResetToken(token, e);
        setIsTokenValid(true);
      } catch (error) {
        setIsTokenValid(false);
      } finally {
        setIsVerifying(false);
      }
    };

    checkToken();
  }, [verifyResetToken]);

  const formik = useFormik({
    initialValues: {
      newPassword: '',
      confirmPassword: ''
    },
    validationSchema: passwordSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      setHasErrors(undefined);
      const searchParams = new URLSearchParams(window.location.search);
      const e = searchParams.get('e');
      const token = searchParams.get('token');

      if (!e || !token) {
        setHasErrors(true);
        setStatus('Token or Email identifier is missing');
        setLoading(false);
        setSubmitting(false);
        return;
      }
      try {
        await changePassword(e, token, values.newPassword, values.confirmPassword);
        setHasErrors(false);
        navigate(
          currentLayout?.name === 'auth-branded'
            ? '/auth/reset-password/changed'
            : '/auth/classic/reset-password/changed'
        );
      } catch (error) {
        if (error instanceof AxiosError && error.response) {
          const errorMessage = error.response.data.error || error.response.data.message || 'Password reset failed.';
          setStatus(errorMessage);
          toast.error(errorMessage);
        } else {
          const errorMessage = 'Password reset failed. Please try again.';
          setStatus(errorMessage);
          toast.error(errorMessage);
        }
        setHasErrors(true);
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    }
  });

  if (isVerifying) {
    return (
      <div className="card max-w-[370px] w-full min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <span className="text-gray-700 text-sm">Verifying reset link...</span>
        </div>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="card max-w-[370px] w-full p-10 flex flex-col items-center gap-5">
        <div className="flex justify-center p-5">
          <img
            src={toAbsoluteUrl('/media/illustrations/31.svg')}
            className="dark:hidden max-h-[150px]"
            alt=""
          />
          <img
            src={toAbsoluteUrl('/media/illustrations/31-dark.svg')}
            className="light:hidden max-h-[150px]"
            alt=""
          />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Expired or Invalid Link</h3>
          <p className="text-gray-700 text-sm mb-6">
            The password reset link you clicked is no longer valid. For security reasons, links expire after 10 minutes or after being used.
          </p>
          <Link
            to={currentLayout?.name === 'auth-branded' ? '/auth/reset-password' : '/auth/classic/reset-password'}
            className="btn btn-primary w-full flex justify-center"
          >
            Request New Link
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
          {loading ? 'Please wait...' : 'Submit'}
        </button>
        <Link
          to={currentLayout?.name === 'auth-branded' ? '/auth/login' : '/auth/classic/login'}
          className="flex items-center justify-center text-sm gap-2 text-gray-700 hover:text-primary"
        >
          <KeenIcon icon="black-left" />
          Back to Login
        </Link>
      </form>
    </div>
  );
};

export { ResetPasswordChange };
