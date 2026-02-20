import clsx from 'clsx';
import { useFormik } from 'formik';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { useAuthContext } from '../../useAuthContext';
import { Country, State } from "country-state-city";
import { toAbsoluteUrl } from '@/utils';
import { Alert, KeenIcon } from '@/components';
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
  country: ''
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
    .matches(
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      "Invalid email format"
    ),
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
  country: Yup.string().required('Country is required')
});

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const { register } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const [showPassword, setShowPassword] = useState(false);
  const { currentLayout } = useLayout();

  const formik = useFormik({
    initialValues,
    validationSchema: signupSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        if (!register) {
          throw new Error('JWTProvider is required for this form.');
        }
        // Call the register function and handle navigation based on user role
        const response = await register(values.firstName, values.lastName, values.email, values.mobileNo, values.password, values.changepassword, values.state, values.country);
        const userRole = (response as any)?.user?.role;

        if (userRole === 'User') {
          navigate('/account/home/user-profile', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error(error);
        setStatus('The sign up details are incorrect');
        setSubmitting(false);
        setLoading(false);
      }
    }
  });

  return (
    <div className="card max-w-[700px] w-full">
      <form
        className="card-body flex flex-col gap-5 p-10"
        noValidate
        onSubmit={formik.handleSubmit}
      >
        <div className="text-center mb-2.5">
          <h3 className="text-lg font-semibold text-gray-900 leading-none mb-2.5">Sign up</h3>
          <div className="flex items-center justify-center font-medium">
            <span className="text-2sm text-gray-600 me-1.5">Already have an Account ?</span>
            <Link
              to={currentLayout?.name === 'auth-branded' ? '/auth/login' : '/auth/classic/login'}
              className="text-2sm link"
            >
              Sign in
            </Link>
          </div>
        </div>
        {/* <div className="grid grid-cols-2 gap-2.5">
          <a href="#" className="btn btn-light btn-sm justify-center">
            <img
              src={toAbsoluteUrl('/media/brand-logos/google.svg')}
              className="size-3.5 shrink-0"
            />
            Use Google
          </a>
          <a href="#" className="btn btn-light btn-sm justify-center">
            <img
              src={toAbsoluteUrl('/media/brand-logos/apple-black.svg')}
              className="size-3.5 shrink-0 dark:hidden"
            />
            <img
              src={toAbsoluteUrl('/media/brand-logos/apple-white.svg')}
              className="size-3.5 shrink-0 light:hidden"
            />
            Use Apple
          </a>
        </div> */}
        <div className="flex items-center gap-2">
          <span className="border-t border-gray-200 w-full"></span>
        </div>
        {formik.status && <Alert variant="danger">{formik.status}</Alert>}

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="form-label text-gray-900">
              First Name <span style={{ color: "red" }}>*</span>
            </label>
            <label className="input">
              <input
                placeholder="First Name"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps('firstName')}
                className={clsx(
                  'form-control bg-transparent',
                  { 'is-invalid': formik.touched.firstName && formik.errors.firstName },
                  { 'is-valid': formik.touched.firstName && !formik.errors.firstName }
                )}
              />
            </label>
            {formik.touched.firstName && formik.errors.firstName && (
              <span role="alert" className="text-danger text-xs mt-1">
                {formik.errors.firstName}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="form-label text-gray-900">Last Name</label>
            <label className="input">
              <input
                placeholder="Last Name"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps('lastName')}
                className={clsx(
                  'form-control bg-transparent',
                  { 'is-invalid': formik.touched.lastName && formik.errors.lastName },
                  { 'is-valid': formik.touched.lastName && !formik.errors.lastName }
                )}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="form-label text-gray-900">
              Email<span style={{ color: "red" }}>*</span>
            </label>
            <label className="input">
              <input
                placeholder="email@email.com"
                type="email"
                autoComplete="off"
                {...formik.getFieldProps('email')}
                className={clsx(
                  'form-control bg-transparent',
                  { 'is-invalid': formik.touched.email && formik.errors.email },
                  { 'is-valid': formik.touched.email && !formik.errors.email }
                )}
              />
            </label>
            {formik.touched.email && formik.errors.email && (
              <span role="alert" className="text-danger text-xs mt-1">
                {formik.errors.email}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="form-label text-gray-900">
              Mobile No.<span style={{ color: "red" }}>*</span>
            </label>
            <label className="input">
              <input
                placeholder="83******25"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps('mobileNo')}
                className={clsx(
                  'form-control bg-transparent',
                  { 'is-invalid': formik.touched.mobileNo && formik.errors.mobileNo },
                  { 'is-valid': formik.touched.mobileNo && !formik.errors.mobileNo }
                )}
                onInput={(e) => {
                  const input = e.target as HTMLInputElement;
                  if (input.value.length > 10) {
                    input.value = input.value.slice(0, 10);
                  }
                }}
                onChange={(e) => {
                  let value = e.target.value.replace(/[^0-9-]/g, '');
                  value = value.replace(/--+/g, '-');
                  e.target.value = value;
                  formik.setFieldValue('mobileNo', value);
                }}
              />
            </label>
            {formik.touched.mobileNo && formik.errors.mobileNo && (
              <span role="alert" className="text-danger text-xs mt-1">
                {formik.errors.mobileNo}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Country */}
          <div className="flex flex-col gap-1">
            <label className="form-label text-gray-900">
              Country<span style={{ color: "red" }}>*</span>
            </label>
            <label className="input">
            <select
              {...formik.getFieldProps("country")}
              onChange={(e) => {
                formik.setFieldValue("country", e.target.value);
                formik.setFieldValue("state", ""); // Reset state when country changes
              }}
              className={clsx(
                "form-control bg-transparent",
                {
                  "is-invalid": formik.touched.country && formik.errors.country,
                },
                {
                  "is-valid": formik.touched.country && !formik.errors.country,
                }
              )}
            >
              <option value="">--Select Country--</option>
              {Country.getAllCountries().map((country) => (
                <option key={country.isoCode} value={country.isoCode}>
                  {country.name}
                </option>
              ))}
            </select>
            </label>
            {formik.touched.country && formik.errors.country && (
              <span role="alert" className="text-danger text-xs mt-1">
                {formik.errors.country}
              </span>
            )}
          </div>

          {/* State */}
          <div className="flex flex-col gap-1">
            <label className="form-label text-gray-900">
              State<span style={{ color: "red" }}>*</span>
            </label>
            <label className="input">
            <select
              {...formik.getFieldProps("state")}
              disabled={!formik.values.country}
              className={clsx(
                "form-control bg-transparent",
                {
                  "is-invalid": formik.touched.state && formik.errors.state,
                },
                {
                  "is-valid": formik.touched.state && !formik.errors.state,
                },
                {
                  "bg-gray-100": !formik.values.country,
                }
              )}
            >
              <option value="">--Select State--</option>
              {formik.values.country &&
                State.getStatesOfCountry(formik.values.country).map((state) => (
                  <option key={state.isoCode} value={state.isoCode}>
                    {state.name}
                  </option>
                ))}
            </select>
            </label>
            {formik.touched.state && formik.errors.state && (
              <span role="alert" className="text-danger text-xs mt-1">
                {formik.errors.state}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="form-label text-gray-900">
              Password<span style={{ color: "red" }}>*</span>
            </label>
            <label className="input">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter Password"
                autoComplete="off"
                {...formik.getFieldProps('password')}
                className={clsx(
                  'form-control bg-transparent',
                  { 'is-invalid': formik.touched.password && formik.errors.password },
                  { 'is-valid': formik.touched.password && !formik.errors.password }
                )}
              />
              <button
                className="btn btn-icon"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPassword(!showPassword);
                }}
              >
                <KeenIcon icon="eye" className={clsx('text-gray-500', { hidden: showPassword })} />
                <KeenIcon icon="eye-slash" className={clsx('text-gray-500', { hidden: !showPassword })} />
              </button>
            </label>
            {formik.touched.password && formik.errors.password && (
              <span role="alert" className="text-danger text-xs mt-1">
                {formik.errors.password}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="form-label text-gray-900">
              Confirm Password<span style={{ color: "red" }}>*</span>
            </label>
            <label className="input">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter Password"
                autoComplete="off"
                {...formik.getFieldProps('changepassword')}
                className={clsx(
                  'form-control bg-transparent',
                  { 'is-invalid': formik.touched.changepassword && formik.errors.changepassword },
                  { 'is-valid': formik.touched.changepassword && !formik.errors.changepassword }
                )}
              />
              <button
                className="btn btn-icon"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPassword(!showPassword);
                }}
              >
                <KeenIcon icon="eye" className={clsx('text-gray-500', { hidden: showPassword })} />
                <KeenIcon icon="eye-slash" className={clsx('text-gray-500', { hidden: !showPassword })} />
              </button>
            </label>
            {formik.touched.changepassword && formik.errors.changepassword && (
              <span role="alert" className="text-danger text-xs mt-1">
                {formik.errors.changepassword}
              </span>
            )}
          </div>
        </div>

        {/* <label className="checkbox-group">
          <input
            className="checkbox checkbox-sm"
            type="checkbox"
            {...formik.getFieldProps('acceptTerms')}
          />
          <span className="checkbox-label">
            I accept{' '}
            <Link to="#" className="text-2sm link">
              Terms & Conditions
            </Link>
          </span>
        </label> */}
        {formik.touched.acceptTerms && formik.errors.acceptTerms && (
          <span role="alert" className="text-danger text-xs mt-1">
            {formik.errors.acceptTerms}
          </span>
        )}

        <button
          type="submit"
          className="btn btn-primary flex justify-center grow"
          disabled={loading || formik.isSubmitting}
        >
          {loading ? 'Please wait...' : 'Sign up'}
        </button>
      </form>
    </div>
  );
};

export { Signup };
