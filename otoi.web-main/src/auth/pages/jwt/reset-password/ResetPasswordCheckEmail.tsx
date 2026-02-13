import { Link, useNavigate, useLocation } from 'react-router-dom';

import { toAbsoluteUrl } from '@/utils';
import { useLayout } from '@/providers';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/auth';
import { toast } from 'sonner';

const ResetPasswordCheckEmail = () => {
  const { currentLayout } = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { requestPasswordResetLink } = useAuthContext();
  const [email, setEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    if (!email || isResending) return;

    setIsResending(true);
    try {
      await requestPasswordResetLink(email);
      toast.success('Reset link has been resent to your email.');
    } catch (error) {
      toast.error('Failed to resend the email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    // Priority: 1. State (hidden) 2. URL params (fallback)
    const stateEmail = location.state?.email;
    const emailParam = new URLSearchParams(window.location.search).get('email');
    const targetEmail = stateEmail || emailParam;

    if (!targetEmail) {
      navigate(
        currentLayout?.name === 'auth-branded'
          ? '/auth/reset-password/enter-email'
          : '/auth/classic/reset-password/enter-email'
      );
    } else {
      setEmail(targetEmail);
    }
  }, [navigate, currentLayout, location]);

  return (
    <div className="card max-w-[440px] w-full">
      <div className="card-body p-10">
        <div className="flex justify-center py-10">
          <img
            src={toAbsoluteUrl('/media/illustrations/30.svg')}
            className="dark:hidden max-h-[130px]"
            alt=""
          />
          <img
            src={toAbsoluteUrl('/media/illustrations/30-dark.svg')}
            className="light:hidden max-h-[130px]"
            alt=""
          />
        </div>

        <h3 className="text-lg font-medium text-gray-900 text-center mb-3">Check your email</h3>
        <div className="text-2sm text-center text-gray-700 mb-7.5">
          Please click the link sent to your email{' '}
          <span className="font-bold">{email}</span>
          <br />
          to reset your password. Thank you
        </div>

        <div className="flex justify-center mb-5">
          <Link
            to={currentLayout?.name === 'auth-branded' ? '/auth/login' : '/auth/classic/login'}
            className="btn btn-primary flex justify-center"
          >
            Skip for now
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-gray-600">Didn’t receive an email?</span>
          <button
            onClick={handleResend}
            disabled={isResending}
            className="text-xs font-medium link disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? 'Resending...' : 'Resend'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { ResetPasswordCheckEmail };
