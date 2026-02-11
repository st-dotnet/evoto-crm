import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/utils';
import { useLayout } from '@/providers';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/auth/useAuthContext';
import { AxiosError } from 'axios';

const ResetPasswordCheckEmail = () => {
  const { currentLayout } = useLayout();
  const { requestPasswordResetLink } = useAuthContext();
  const [email, setEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get('email'));
  }, []);

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    setResendMessage(null);
    try {
      await requestPasswordResetLink(email);
      setResendMessage('A new reset link has been sent to your email.');
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        setResendMessage(error.response.data.error || 'Failed to resend. Please try again.');
      } else {
        setResendMessage('Failed to resend. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

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
          We've sent a password reset link to{' '}
          <span className="text-2sm text-gray-800 font-medium">
            {email}
          </span>
          <br />
          The link will expire in <strong>10 minutes</strong>.
        </div>

        {resendMessage && (
          <div className="text-center text-sm text-gray-600 mb-4">
            {resendMessage}
          </div>
        )}

        <div className="flex justify-center mb-5">
          <Link
            to={currentLayout?.name === 'auth-branded' ? '/auth/login' : '/auth/classic/login'}
            className="btn btn-primary flex justify-center"
          >
            Back to Login
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-gray-600">Didn't receive an email?</span>
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-xs font-medium link bg-transparent border-none cursor-pointer"
          >
            {resending ? 'Sending...' : 'Resend'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { ResetPasswordCheckEmail };
