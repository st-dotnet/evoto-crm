import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, KeenIcon } from '@/components';
import { useLayout } from '@/providers';
import { useAuthContext } from '@/auth';
import { AxiosError } from 'axios';

const ResetPasswordEnterEmail = () => {
  const { currentLayout } = useLayout();
  const { requestPasswordResetLink } = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestPasswordResetLink(email, window.location.origin);
      navigate(
        currentLayout?.name === 'auth-branded'
          ? '/auth/reset-password/check-email'
          : '/auth/classic/reset-password/check-email'
      );
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        setError(err.response.data.error || 'Something went wrong. Please try again.');
      } else {
        setError('Failed to send reset link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-[370px] w-full">
      <form className="card-body flex flex-col gap-5 p-10" onSubmit={handleSubmit}>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Your Email</h3>
          <span className="text-2sm text-gray-700">Enter your email to reset password</span>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="flex flex-col gap-1">
          <label className="form-label font-normal text-gray-900">Email</label>
          <input
            className="input"
            type="email"
            placeholder="email@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary flex justify-center grow"
          disabled={loading}
        >
          {loading ? 'Please wait...' : 'Continue'}
          {!loading && <KeenIcon icon="black-right" />}
        </button>

        <div className="flex items-center justify-center">
          <Link
            to={currentLayout?.name === 'auth-branded' ? '/auth/login' : '/auth/classic/login'}
            className="flex items-center text-sm gap-2 text-gray-700 hover:text-primary"
          >
            <KeenIcon icon="black-left" />
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
};

export { ResetPasswordEnterEmail };
