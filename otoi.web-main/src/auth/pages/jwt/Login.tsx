import { type MouseEvent, type KeyboardEvent, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import * as Yup from "yup";
import { useFormik } from "formik";
import { KeenIcon } from "@/components";
import { useAuthContext } from "@/auth";
import { useLayout } from "@/providers";
import { ModalAccountDeactivated } from "@/partials/modals/account-deactivated";

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email("Wrong email format")
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Email is required")
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Invalid email format"),
  password: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Password is required"),
  remember: Yup.boolean(),
});

const initialValues = {
  email: "",
  password: "",
  remember: false,
};

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";
  const [showPassword, setShowPassword] = useState(false);
  const { currentLayout } = useLayout();
  const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const formik = useFormik({
    initialValues,
    validationSchema: loginSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        if (!login) throw new Error("JWTProvider is required for this form.");
        const response = await login(values.email, values.password);
        const userRole = (response as any)?.user?.role;

        if (values.remember) {
          localStorage.setItem("email", values.email);
        } else {
          localStorage.removeItem("email");
        }

        if (userRole === "User") {
          navigate("/account/home/user-profile", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      } catch (error: any) {
        if (
          error.response?.data?.error === "Account Deactivated"
        ) {
          setShowDeactivatedModal(true);
          setTimeout(() => setShowDeactivatedModal(false), 3000);
        } else {
          setStatus(`${error.response?.data?.error}`);
        }
        setSubmitting(false);
      }
      setLoading(false);
    },
  });

  // Calculate progress based on form completion
  const calculateProgress = () => {
    const values = formik.values;
    const errors = formik.errors;
    let progress = 0;

    // Step 1: Email address
    // Email must be valid format and no errors
    if (values.email && !errors.email) progress += 1;

    // Step 2: Password
    // Password must have minimum 3 characters and no errors
    if (values.password && values.password.trim().length >= 3 && !errors.password) progress += 1;

    return progress;
  };

  useEffect(() => {
    const progress = calculateProgress();
    if (progress >= 2) {
      setCurrentStep(2); // Step 2 completed
    } else if (progress >= 1) {
      setCurrentStep(1); // Step 1 completed, Step 2 in progress
    } else {
      setCurrentStep(0);
    }
  }, [formik.values]);

  const togglePassword = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setShowPassword(!showPassword);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      formik.handleSubmit();
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');

        html, body {
          overflow: hidden;
        }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          padding: 2rem;
          overflow: hidden;
        }

        .login-wrapper {
          display: flex;
          width: 100%;
          max-width: 900px;
          min-height: 560px;
          opacity: 0;
          transform: translateY(30px) scale(0.95);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .login-wrapper.mounted {
          opacity: 1;
          transform: translateY(0) scale(1);
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

        /* Left panel */
        .login-panel-left {
          width: 42%;
          background: #111110;
          padding: 3rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          border-radius: 24px 0 0 24px;
        }

        .login-panel-left::before {
          content: '';
          position: absolute;
          top: -80px;
          right: -80px;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: rgba(255,255,255,0.03);
        }

        .login-panel-left::after {
          content: '';
          position: absolute;
          bottom: -60px;
          left: -60px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.025);
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .login-logo {
          height: 28px;
          width: auto;
          filter: brightness(0) invert(1);
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .login-brand-name {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: #E8E2D9;
          letter-spacing: 0.01em;
        }

        .login-panel-tagline {
          z-index: 1;
        }

        .login-tagline-heading {
          font-family: 'DM Serif Display', serif;
          font-size: 36px;
          line-height: 1.2;
          color: #E8E2D9;
          margin: 0 0 12px;
          font-weight: 600;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          background: linear-gradient(135deg, #E8E2D9 0%, #F7F3E0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .login-tagline-heading em {
          font-style: italic;
          color: #A09880;
        }

        .login-tagline-sub {
          font-size: 13px;
          color: #999;
          line-height: 1.6;
          margin: 0;
          font-weight: 300;
        }

        .login-panel-footer {
          font-size: 11px;
          color: #999; /* Changed to a lighter shade for visibility on dark background */
          z-index: 1;
          letter-spacing: 0.02em;
        }

        /* Right panel */
        .login-panel-right {
          flex: 1;
          padding: 3rem 3.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: #fff;
          border-radius: 0 24px 24px 0;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }

        .login-heading-area {
          margin-bottom: 2.5rem;
        }

        .login-eyebrow {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #A09880;
          margin: 0 0 10px;
        }

        .login-title {
          font-family: 'DM Serif Display', serif;
          font-size: 28px;
          font-weight: 400;
          color: #111110;
          margin: 0 0 6px;
          line-height: 1.2;
        }

        .login-subtitle {
          font-size: 13px;
          color: #888782;
          margin: 0;
          font-weight: 300;
        }

        .login-subtitle a {
          color: #111110;
          font-weight: 500;
          text-decoration: none;
          border-bottom: 1px solid #D0CCC5;
          transition: border-color 0.2s;
        }

        .login-subtitle a:hover {
          border-color: #111110;
        }

        /* Error */
        .login-error {
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

        .login-error::before {
          content: '';
          width: 6px;
          height: 6px;
          background: #DC2626;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Fields */
        .login-fields {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .login-label {
          font-size: 12px;
          font-weight: 500;
          color: #444340;
          letter-spacing: 0.01em;
        }

        .login-forgot {
          font-size: 12px;
          color: #A09880;
          text-decoration: none;
          transition: color 0.2s, transform 0.2s;
        }

        .login-forgot:hover {
          color: #111110;
          transform: translateY(-1px);
        }

        .login-input-wrap {
          position: relative;
        }

        .login-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          background: #F7F6F3;
          border: 1px solid #E5E3DE;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #111110;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .login-input::placeholder {
          color: #C0BDB8;
        }

        .login-input:focus {
          border-color: #111110;
          background: #fff;
        }

        .login-input.has-icon {
          padding-right: 44px;
        }

        .login-floating-label {
          position: absolute;
          top: 50%;
          left: 14px;
          transform: translateY(-50%);
          font-size: 14px;
          color: #6B7280;
          transition: all 0.2s;
          pointer-events: none;
          background: transparent;
          padding: 0 4px;
        }

        .login-input.has-value + .login-floating-label,
        .login-input:focus + .login-floating-label {
          top: 0;
          transform: translateY(-12px);
          font-size: 11px;
          color: #111110;
          background: #fff;
        }

        .login-input.is-invalid {
          border-color: #FCA5A5;
          background: #FFF9F9;
        }

        .login-input.is-invalid:focus {
          border-color: #DC2626;
        }

        .login-eye-btn {
          position: absolute;
          right: 0;
          top: 0;
          height: 44px;
          width: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          color: #B0ADA8;
          transition: color 0.2s;
        }

        .login-eye-btn:hover {
          color: #111110;
        }

        .login-field-error {
          font-size: 11.5px;
          color: #DC2626;
          margin: 0;
        }

        /* Remember */
        .login-remember {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          margin-bottom: 1.5rem;
        }

        .login-checkbox {
          width: 16px;
          height: 16px;
          accent-color: #111110;
          cursor: pointer;
        }

        .login-remember-label {
          font-size: 13px;
          color: #888782;
        }

        /* Submit */
        .login-submit {
          width: 100%;
          height: 50px;
          background: linear-gradient(135deg, #111110 0%, #2a2a2a 100%);
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

        .login-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
          transform: translateY(-2px);
        }

        .login-submit:active:not(:disabled) {
          transform: scale(0.99);
        }

        .login-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .login-submit-arrow {
          width: 16px;
          height: 16px;
          opacity: 0.6;
        }

        /* Spinner */
        .login-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(232,226,217,0.3);
          border-top-color: #E8E2D9;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Progress Steps */
        .login-steps {
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
          position: relative;
          margin-top: 2rem;
        }

        .login-step {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .login-step-num {
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

        .login-step-num.active {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.3);
          color: #FFFFFF;
          transform: scale(1.1);
          position: relative;
          overflow: visible;
        }

        .login-step-num.active::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.4);
          animation: ripple-1 2s infinite;
        }

        .login-step-num.active::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          animation: ripple-2 2s infinite 0.5s;
        }

        @keyframes ripple-1 {
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

        @keyframes ripple-2 {
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

        .login-step-num.completed {
          background: #FFFFFF;
          border-color: #FFFFFF;
          color: #111110;
          transform: scale(1.1);
        }

        .login-step-num.step-2-completed {
          background: #10B981;
          border-color: #10B981;
          color: #FFFFFF;
          transform: scale(1.1);
        }

        .login-step-text {
          font-size: 13px;
          color: #FFFFFF;
          font-weight: 400;
          transition: color 0.3s ease;
        }

        .login-step-text.active {
          color: #FFFFFF;
          font-weight: 500;
        }

        .login-step-text.completed {
          color: rgba(255,255,255,0.8);
        }

        /* Progress line */
        .login-progress-line {
          position: absolute;
          left: 11px;
          top: 22px;
          width: 2px;
          height: 14px;
          background: rgba(255,255,255,0.1);
          z-index: 1;
        }

        .login-progress-fill {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 0%;
          background: linear-gradient(to bottom, #FFFFFF, rgba(255,255,255,0.6));
          transition: height 0.5s ease;
        }

        /* Responsive */
        @media (max-width: 680px) {
          .login-panel-left {
            display: none;
          }
          .login-panel-right {
            padding: 2.5rem 2rem;
          }
          .login-wrapper {
            border-radius: 16px;
          }
        }
      `}</style>

      <div className="login-root">
        <div className={clsx("login-wrapper", { mounted })}>

          {/* Left decorative panel */}
          <div className="login-panel-left">
            <div className="login-brand">
              <img src="/media/app/mini-logo.svg" alt="Evoto" className="login-logo" />
              <span className="login-brand-name">Technologies</span>
            </div>

            <div className="login-panel-tagline">
              <h2 className="login-tagline-heading">
                Welcome <em>back.</em>
              </h2>
              <p className="login-tagline-sub">
                Sign in to continue where you left off.
              </p>
              
              <div className="login-steps">
                <div className="login-progress-line">
                  <div 
                    className="login-progress-fill" 
                    style={{ height: `${(currentStep / 2) * 100}%` }}
                  />
                </div>
                {[
                  'Enter email',
                  'Enter password',
                ].map((text, i) => (
                  <div className="login-step" key={i}>
                    <div 
                      className={clsx('login-step-num', {
                        'active': i === currentStep,
                        'completed': i < currentStep,
                        'step-2-completed': i === 1 && currentStep === 2 && !formik.errors.email && !formik.errors.password && formik.values.email && formik.values.password
                      })}
                    >
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <span 
                      className={clsx('login-step-text', {
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

            <p className="login-panel-footer"> 2026 Evoto Technologies. <br /> All rights reserved.</p>
          </div>

          {/* Right form panel */}
          <div className="login-panel-right">
            <div className="login-heading-area">
              <p className="login-eyebrow">Secure Access</p>
              <h1 className="login-title">Sign in</h1>
              <p className="login-subtitle">
                Don't have an account?{" "}
                <Link
                  to={
                    currentLayout?.name === "auth-branded"
                      ? "/auth/signup"
                      : "/auth/classic/signup"
                  }
                >
                  Create one
                </Link>
              </p>
            </div>

            <form onSubmit={formik.handleSubmit} noValidate>
              {formik.status && (
                <div className="login-error">{formik.status}</div>
              )}

              <div className="login-fields">
                {/* Email */}
                <div className="login-field">
                  <div className="login-input-wrap">
                    <input
                      type="email"
                      className={clsx("login-input", {
                        "is-invalid": formik.touched.email && formik.errors.email,
                        "has-value": formik.values.email,
                      })}
                      placeholder=" "
                      autoComplete="off"
                      {...formik.getFieldProps("email")}
                      onKeyDown={handleKeyDown}
                    />
                    <label className="login-floating-label">Email address</label>
                  </div>
                  {formik.touched.email && formik.errors.email && (
                    <span role="alert" className="login-field-error">
                      {formik.errors.email}
                    </span>
                  )}
                </div>

                {/* Password */}
                <div className="login-field">
                  <div className="login-input-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      className={clsx("login-input has-icon", {
                        "is-invalid": formik.touched.password && formik.errors.password,
                        "has-value": formik.values.password,
                      })}
                      placeholder=" "
                      autoComplete="off"
                      {...formik.getFieldProps("password")}
                      onKeyDown={handleKeyDown}
                    />
                    <label className="login-floating-label">Password</label>
                    <button className="login-eye-btn" onClick={togglePassword} type="button" tabIndex={-1}>
                      <KeenIcon icon={showPassword ? "eye-slash" : "eye"} />
                    </button>
                  </div>
                  <div className="login-field-row">
                    <Link
                      to={
                        currentLayout?.name === "auth-branded"
                          ? "/auth/reset-password"
                          : "/auth/classic/reset-password"
                      }
                      className="login-forgot"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  {formik.touched.password && formik.errors.password && (
                    <span role="alert" className="login-field-error">
                      {formik.errors.password}
                    </span>
                  )}
                </div>
              </div>

              <label className="login-remember">
                <input
                  type="checkbox"
                  className="login-checkbox"
                  {...formik.getFieldProps("remember")}
                />
                <span className="login-remember-label">Keep me signed in</span>
              </label>

              <button
                type="submit"
                className="login-submit"
                disabled={loading || formik.isSubmitting}
              >
                {loading ? (
                  <><div className="login-spinner" /> Please wait…</>
                ) : (
                  <>
                    Sign In
                    <svg className="login-submit-arrow" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <ModalAccountDeactivated
        open={showDeactivatedModal}
        onOpenChange={() => setShowDeactivatedModal(false)}
      />
    </>
  );
};

export { Login };