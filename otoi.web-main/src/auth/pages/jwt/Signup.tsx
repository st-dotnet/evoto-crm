import clsx from 'clsx';
import { useFormik } from 'formik';
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { useAuthContext } from '../../useAuthContext';
import { Country, State } from 'country-state-city';
import { KeenIcon } from '@/components';
import { useLayout } from '@/providers';

const initialValues = {
  firstName: '',
  lastName: '',
  email: '',
  mobileNo: '',
  password: '',
  changepassword: '',
  acceptTerms: false,
  state: '',
  country: '',
};

const signupSchema = Yup.object().shape({
  firstName: Yup.string()
    .trim()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .required('First Name is required'),
  email: Yup.string()
    .email('Wrong email format')
    .min(3, 'Minimum 3 symbols')
    .max(50, 'Maximum 50 symbols')
    .required('Email is required')
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Invalid email format'),
  mobileNo: Yup.string()
    .min(10, 'Minimum 10 symbols')
    .max(10, 'Maximum 10 symbols')
    .required('Mobile Number is required'),
  password: Yup.string()
    .trim()
    .min(3, 'Minimum 3 symbols')
    .max(50, 'Maximum 50 symbols')
    .required('Password is required'),
  changepassword: Yup.string()
    .trim()
    .min(3, 'Minimum 3 symbols')
    .max(50, 'Maximum 50 symbols')
    .required('Password confirmation is required')
    .oneOf([Yup.ref('password')], "Password and Confirm Password didn't match"),
  acceptTerms: Yup.bool().required('You must accept the terms and conditions'),
  state: Yup.string().required('State is required'),
  country: Yup.string().required('Country is required'),
});

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const { register } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { currentLayout } = useLayout();
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formik = useFormik({
    initialValues,
    validationSchema: signupSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        if (!register) throw new Error('JWTProvider is required for this form.');
        const response = await register(
          values.firstName,
          values.lastName,
          values.email,
          values.mobileNo,
          values.password,
          values.changepassword,
          values.state,
          values.country
        );
        const userRole = (response as any)?.user?.role;
        if (userRole === 'User') {
          navigate('/account/home/user-profile', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'The sign up details are incorrect';
        setStatus(errorMessage);
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  // Calculate progress based on form completion
  const calculateProgress = () => {
    const values = formik.values;
    const errors = formik.errors;
    let progress = 0;

    // Step 1: Personal details (First Name only - last name is optional)
    // First name must have minimum 3 characters and no errors
    if (values.firstName && values.firstName.trim().length >= 3 && !errors.firstName) progress += 1;

    // Step 2: Contact details (Email, Mobile)
    // Email must be valid format and no errors
    if (values.email && !errors.email) progress += 0.5;
    // Mobile must be exactly 10 digits and no errors
    if (values.mobileNo && values.mobileNo.length === 10 && !errors.mobileNo) progress += 0.5;

    // Step 3: Location details (Country, State)
    // Country must be selected and no errors
    if (values.country && !errors.country) progress += 0.5;
    // State must be selected and no errors
    if (values.state && !errors.state) progress += 0.5;

    // Step 4: Security (Password, Confirm Password)
    // Password must have minimum 3 characters and no errors
    if (values.password && values.password.trim().length >= 3 && !errors.password) progress += 0.5;
    // Confirm password must match password and no errors
    if (values.changepassword && values.changepassword.trim().length >= 3 && !errors.changepassword) progress += 0.5;

    return progress;
  };

  useEffect(() => {
    const progress = calculateProgress();
    if (progress >= 3) {
      setCurrentStep(3); // Step 4 completed
    } else if (progress >= 2) {
      setCurrentStep(2); // Step 3 completed
    } else if (progress >= 1) {
      setCurrentStep(1); // Step 2 completed
    } else if (progress > 0) {
      setCurrentStep(0); // Step 1 in progress
    } else {
      setCurrentStep(0);
    }
  }, [formik.values]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');

        .su-root {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          padding: 2rem;
          overflow: hidden;
        }

        .su-wrapper {
          display: flex;
          width: 100%;
          max-width: 1000px;
          height: fit-content;
          max-height: calc(100vh - 4rem);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 2px 40px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
          opacity: 0;
          transform: translateY(30px) scale(0.95);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .su-wrapper.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── Left panel ── */
        .su-left {
          width: 320px;
          flex-shrink: 0;
          background: #111110;
          padding: 1.5rem 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .su-left::before {
          content: '';
          position: absolute;
          top: -80px; right: -80px;
          width: 300px; height: 300px;
          border-radius: 50%;
          background: rgba(255,255,255,0.03);
        }

        .su-left::after {
          content: '';
          position: absolute;
          bottom: -60px; left: -60px;
          width: 220px; height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.025);
        }

        .su-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 1;
        }

        .su-logo {
          height: 28px;
          width: auto;
          filter: brightness(0) invert(1);
          animation: fadeInUp 0.8s ease-out forwards;
          background: none;
        }

        .su-brand-name {
          font-size: 15px;
          font-weight: 500;
          color: #FFFFFF;
          letter-spacing: 0.01em;
        }

        .su-tagline { z-index: 1; }

        .su-tagline-heading {
          font-family: 'DM Serif Display', serif;
          font-size: 30px;
          line-height: 1.2;
          color: #E8E2D9;
          margin: 0 0 12px;
          font-weight: 400;
        }

        .su-tagline-heading em {
          font-style: italic;
          color: #A09880;
        }

        .su-tagline-sub {
          font-size: 14px;
          color: #FFFFFF;
          line-height: 1.6;
          margin: 0 0 2rem;
          font-weight: 400;
        }

        /* Step indicators */
        .su-steps {
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
          position: relative;
        }

        .su-step {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .su-step-num {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px;
          font-weight: 500;
          color: #FFFFFF;
          flex-shrink: 0;
          transition: all 0.3s ease;
          position: relative;
          z-index: 2;
        }

        .su-step-num.active {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.3);
          color: #FFFFFF;
          transform: scale(1.1);
          position: relative;
          overflow: visible;
        }

        .su-step-num.active::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.4);
          animation: su-ripple-1 2s infinite;
        }

        .su-step-num.active::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          animation: su-ripple-2 2s infinite 0.5s;
        }

        @keyframes su-ripple-1 {
          0% {
            width: 100%;
            height: 100%;
            opacity: 0.8;
          }
          100% {
            width: 200%;
            height: 200%;
            opacity: 0;
          }
        }

        @keyframes su-ripple-2 {
          0% {
            width: 100%;
            height: 100%;
            opacity: 0.6;
          }
          100% {
            width: 200%;
            height: 200%;
            opacity: 0;
          }
        }

        .su-step-num.completed {
          background: #FFFFFF;
          border-color: #FFFFFF;
          color: #111110;
          transform: scale(1.1);
        }

        .su-step-num.step-4-completed {
          background: #10B981;
          border-color: #10B981;
          color: #FFFFFF;
          transform: scale(1.1);
        }

        .su-step-text {
          font-size: 13px;
          color: #FFFFFF;
          font-weight: 400;
          transition: color 0.3s ease;
        }

        .su-step-text.active {
          color: #FFFFFF;
          font-weight: 500;
        }

        .su-step-text.completed {
          color: rgba(255,255,255,0.8);
        }

        /* Progress line */
        .su-progress-line {
          position: absolute;
          left: 11px;
          top: 22px;
          width: 2px;
          height: 28px;
          background: rgba(255,255,255,0.1);
          z-index: 1;
        }

        .su-progress-fill {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 0%;
          background: linear-gradient(to bottom, #FFFFFF, rgba(255,255,255,0.6));
          transition: height 0.5s ease;
        }

        .su-left-footer {
          font-size: 12px;
          color: #FFFFFF;
          z-index: 1;
          letter-spacing: 0.02em;
        }

        /* ── Right panel ── */
        .su-right {
          flex: 1;
          padding: 2rem 2.5rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          background: #fff;
        }

        /* Custom scrollbar for .su-right */
        .su-right::-webkit-scrollbar {
          width: 5px;
        }
        .su-right::-webkit-scrollbar-track {
          background: transparent;
        }
        .su-right::-webkit-scrollbar-thumb {
          background: #E5E3DE;
          border-radius: 10px;
        }
        .su-right::-webkit-scrollbar-thumb:hover {
          background: #D0CCC5;
        }

        .su-heading-area {
          margin-bottom: 2rem;
        }

        .su-eyebrow {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #A09880;
          margin: 0 0 8px;
        }

        .su-title {
          font-family: 'DM Serif Display', serif;
          font-size: 26px;
          font-weight: 400;
          color: #111110;
          margin: 0 0 5px;
          line-height: 1.2;
        }

        .su-subtitle {
          font-size: 13px;
          color: #888782;
          margin: 0;
          font-weight: 300;
        }

        .su-subtitle a {
          color: #111110;
          font-weight: 500;
          text-decoration: none;
          border-bottom: 1px solid #D0CCC5;
          transition: border-color 0.2s;
        }

        .su-subtitle a:hover { border-color: #111110; }

        /* Error */
        .su-error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: #DC2626;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .su-error::before {
          content: '';
          width: 6px; height: 6px;
          background: #DC2626;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Section label */
        .su-section {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #C5C2BC;
          margin: 0 0 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .su-section::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #EDEBE6;
        }

        /* Grid rows */
        .su-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .su-grid-full {
          grid-template-columns: 1fr;
        }

        /* Fields */
        .su-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .su-label {
          font-size: 11.5px;
          font-weight: 500;
          color: #444340;
          letter-spacing: 0.01em;
        }

        .su-req { color: #DC2626; margin-left: 2px; font-weight: 500; }

        .su-input-wrap { position: relative; }

        .su-input {
          width: 100%;
          height: 40px;
          padding: 0 13px;
          background: transparent;
          border: 1px solid #E5E3DE;
          border-radius: 9px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          color: #111110;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
          appearance: none;
        }

        .su-input::placeholder { color: #C5C2BD; }
        .su-input:focus { border-color: #111110; background: transparent; }
        .su-input.is-invalid { border-color: #FCA5A5; background: transparent; }
        .su-input.is-invalid:focus { border-color: #DC2626; }
        .su-input.has-icon { padding-right: 42px; }

        .su-floating-label {
          position: absolute;
          top: 50%;
          left: 13px;
          transform: translateY(-50%);
          font-size: 13.5px;
          color: #6B7280;
          transition: all 0.2s;
          pointer-events: none;
          background: transparent;
          padding: 0 4px;
          border: none;
          box-shadow: none;
        }

        .su-input.has-value + .su-floating-label,
        .su-input:focus + .su-floating-label {
          top: 0;
          transform: translateY(-12px);
          font-size: 11px;
          color: #111110;
          background: #fff;
        }

        /* Select arrow */
        .su-select-wrap { position: relative; }
        .su-select-wrap::after {
          content: '';
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          width: 0; height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 4px solid #A09880;
          pointer-events: none;
        }

        .su-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .su-eye-btn {
          position: absolute;
          right: 0; top: 0;
          height: 40px; width: 40px;
          display: flex; align-items: center; justify-content: center;
          background: none; border: none;
          cursor: pointer;
          color: #B0ADA8;
          transition: color 0.2s;
        }

        .su-eye-btn:hover { color: #111110; }

        .su-field-error {
          font-size: 11.5px;
          color: #DC2626;
          margin: 0;
        }

        /* Submit */
        .su-actions {
          margin-top: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .su-submit {
          flex: 1;
          height: 44px;
          background: #111110;
          color: #E8E2D9;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .su-submit:hover:not(:disabled) { background: #2A2925; }
        .su-submit:active:not(:disabled) { transform: scale(0.99); }
        .su-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        .su-spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(232,226,217,0.3);
          border-top-color: #E8E2D9;
          border-radius: 50%;
          animation: su-spin 0.7s linear infinite;
        }

        @keyframes su-spin { to { transform: rotate(360deg); } }

        .su-terms {
          font-size: 11.5px;
          color: #B0ADA8;
          text-align: center;
          margin-top: 1rem;
        }

        .su-terms a {
          color: #888782;
          text-decoration: none;
          border-bottom: 1px solid #E0DDD8;
        }

        /* Responsive */
        @media (max-width: 700px) {
          .su-left { display: none; }
          .su-right { padding: 2.5rem 1.75rem; }
          .su-wrapper { border-radius: 16px; }
          .su-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 860px) {
          .su-left { width: 260px; }
          .su-right { padding: 2.5rem 2rem; }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div className="su-root">
        <div className={clsx('su-wrapper', { mounted })}>

          {/* ── Left panel ── */}
          <div className="su-left">
            <div className="su-brand">
              <img src="/media/app/mini-logo.svg" alt="Evoto" className="su-logo" />
              <span className="su-brand-name">Technologies</span>
            </div>

            <div className="su-tagline">
              <h2 className="su-tagline-heading">
                Join us  <em>today.</em>
              </h2>
              <p className="su-tagline-sub">
                Create your account in under a minute and get started right away.
              </p>

              <div className="su-steps">
                <div className="su-progress-line">
                  <div
                    className="su-progress-fill"
                    style={{ height: `${(currentStep / 3) * 100}%` }}
                  />
                </div>
                {[
                  'Enter your personal details',
                  'Add your contact information',
                  'Select your location',
                  'Set a secure password',
                ].map((text, i) => (
                  <div className="su-step" key={i}>
                    <div
                      className={clsx('su-step-num', {
                        'active': i === currentStep,
                        'completed': i < currentStep && i !== 3,
                        'step-4-completed': i === 3 && currentStep === 3 && !formik.errors.password && !formik.errors.changepassword && formik.values.password && formik.values.changepassword
                      })}
                    >
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <span
                      className={clsx('su-step-text', {
                        'active': i === currentStep,
                        'completed': i < currentStep
                      })}
                    >
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="su-left-footer">© 2026 Evoto Technologies. <br /> All rights reserved.</p>
          </div>

          {/* ── Right panel ── */}
          <div className="su-right">
            <div className="su-heading-area">
              <h1 className="su-title">Create account</h1>
              <p className="su-subtitle">
                Already have an account?{' '}
                <Link
                  to={
                    currentLayout?.name === 'auth-branded'
                      ? '/auth/login'
                      : '/auth/classic/login'
                  }
                >
                  Sign in
                </Link>
              </p>
            </div>

            <form onSubmit={formik.handleSubmit} noValidate>
              {formik.status && (
                <div className="su-error">{formik.status}</div>
              )}

              {/* Personal info */}
              <p className="su-section">Personal</p>
              <div className="su-grid">
                <div className="su-field">
                  <div className="su-input-wrap">
                    <input
                      type="text"
                      placeholder=" "
                      autoComplete="off"
                      className={clsx('su-input', {
                        'is-invalid': formik.touched.firstName && formik.errors.firstName,
                        'has-value': formik.values.firstName,
                      })}
                      {...formik.getFieldProps('firstName')}
                    />
                    <label className="su-floating-label">First Name <span style={{ color: '#DC2626', fontWeight: '300' }}>*</span></label>
                  </div>
                  {formik.touched.firstName && formik.errors.firstName && (
                    <span role="alert" className="su-field-error">{formik.errors.firstName}</span>
                  )}
                </div>

                <div className="su-field">
                  <div className="su-input-wrap">
                    <input
                      type="text"
                      placeholder=" "
                      autoComplete="off"
                      className={clsx('su-input', {
                        'has-value': formik.values.lastName,
                      })}
                      {...formik.getFieldProps('lastName')}
                    />
                    <label className="su-floating-label">Last Name</label>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <p className="su-section">Contact</p>
              <div className="su-grid">
                <div className="su-field">
                  <div className="su-input-wrap">
                    <input
                      type="email"
                      placeholder=" "
                      autoComplete="off"
                      className={clsx('su-input', {
                        'is-invalid': formik.touched.email && formik.errors.email,
                        'has-value': formik.values.email,
                      })}
                      {...formik.getFieldProps('email')}
                    />
                    <label className="su-floating-label">Email <span style={{ color: '#DC2626', fontWeight: '300' }}>*</span></label>
                  </div>
                  {formik.touched.email && formik.errors.email && (
                    <span role="alert" className="su-field-error">{formik.errors.email}</span>
                  )}
                </div>

                <div className="su-field">
                  <div className="su-input-wrap">
                    <input
                      type="text"
                      placeholder=" "
                      autoComplete="off"
                      className={clsx('su-input', {
                        'is-invalid': formik.touched.mobileNo && formik.errors.mobileNo,
                        'has-value': formik.values.mobileNo,
                      })}
                      {...formik.getFieldProps('mobileNo')}
                      onInput={(e) => {
                        const input = e.target as HTMLInputElement;
                        if (input.value.length > 10) input.value = input.value.slice(0, 10);
                      }}
                      onChange={(e) => {
                        let value = e.target.value.replace(/[^0-9-]/g, '');
                        value = value.replace(/--+/g, '-');
                        e.target.value = value;
                        formik.setFieldValue('mobileNo', value);
                      }}
                    />
                    <label className="su-floating-label">Mobile No. <span style={{ color: '#DC2626', fontWeight: '300' }}>*</span></label>
                  </div>
                  {formik.touched.mobileNo && formik.errors.mobileNo && (
                    <span role="alert" className="su-field-error">{formik.errors.mobileNo}</span>
                  )}
                </div>
              </div>

              {/* Location */}
              <p className="su-section">Location</p>
              <div className="su-grid" style={{ marginBottom: '16px' }}>
                <div className="su-field">
                  <label className="su-label">Country <span style={{ color: '#DC2626', fontWeight: '300' }}>*</span></label>
                  <div className="su-input-wrap su-select-wrap">
                    <select
                      className={clsx('su-input', {
                        'is-invalid': formik.touched.country && formik.errors.country,
                      })}
                      {...formik.getFieldProps('country')}
                      onChange={(e) => {
                        formik.setFieldValue('country', e.target.value);
                        formik.setFieldValue('state', '');
                      }}
                    >
                      <option value="">Select country</option>
                      {Country.getAllCountries().map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {formik.touched.country && formik.errors.country && (
                    <span role="alert" className="su-field-error">{formik.errors.country}</span>
                  )}
                </div>

                <div className="su-field">
                  <label className="su-label">State <span style={{ color: '#DC2626', fontWeight: '300' }}>*</span></label>
                  <div className="su-input-wrap su-select-wrap">
                    <select
                      className={clsx('su-input', {
                        'is-invalid': formik.touched.state && formik.errors.state,
                      })}
                      disabled={!formik.values.country}
                      {...formik.getFieldProps('state')}
                    >
                      <option value="">Select state</option>
                      {formik.values.country &&
                        State.getStatesOfCountry(formik.values.country).map((s) => (
                          <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                        ))}
                    </select>
                  </div>
                  {formik.touched.state && formik.errors.state && (
                    <span role="alert" className="su-field-error">{formik.errors.state}</span>
                  )}
                </div>
              </div>

              {/* Security */}
              <p className="su-section">Security</p>
              <div className="su-grid">
                <div className="su-field">
                  <div className="su-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder=" "
                      autoComplete="off"
                      className={clsx('su-input has-icon', {
                        'is-invalid': formik.touched.password && formik.errors.password,
                        'has-value': formik.values.password,
                      })}
                      {...formik.getFieldProps('password')}
                    />
                    <label className="su-floating-label">Password <span style={{ color: '#DC2626', fontWeight: '300' }}>*</span></label>
                    <button
                      type="button"
                      className="su-eye-btn"
                      tabIndex={-1}
                      onClick={(e) => { e.preventDefault(); setShowPassword(!showPassword); }}
                    >
                      <KeenIcon icon={showPassword ? 'eye-slash' : 'eye'} />
                    </button>
                  </div>
                  {formik.touched.password && formik.errors.password && (
                    <span role="alert" className="su-field-error">{formik.errors.password}</span>
                  )}
                </div>

                <div className="su-field">
                  <div className="su-input-wrap">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder=" "
                      autoComplete="off"
                      className={clsx('su-input has-icon', {
                        'is-invalid': formik.touched.changepassword && formik.errors.changepassword,
                        'has-value': formik.values.changepassword,
                      })}
                      {...formik.getFieldProps('changepassword')}
                    />
                    <label className="su-floating-label">Confirm Password <span style={{ color: '#DC2626', fontWeight: '300' }}>*</span></label>
                    <button
                      type="button"
                      className="su-eye-btn"
                      tabIndex={-1}
                      onClick={(e) => { e.preventDefault(); setShowConfirmPassword(!showConfirmPassword); }}
                    >
                      <KeenIcon icon={showConfirmPassword ? 'eye-slash' : 'eye'} />
                    </button>
                  </div>
                  {formik.touched.changepassword && formik.errors.changepassword && (
                    <span role="alert" className="su-field-error">{formik.errors.changepassword}</span>
                  )}
                </div>
              </div>

              <div className="su-actions">
                <button
                  type="submit"
                  className="su-submit"
                  disabled={loading || formik.isSubmitting}
                >
                  {loading ? (
                    <><div className="su-spinner" /> Please wait…</>
                  ) : (
                    <>
                      Create Account
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              <p className="su-terms">
                By creating an account you agree to our{' '}
                <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export { Signup };
