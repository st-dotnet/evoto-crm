import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { toAbsoluteUrl } from '@/utils/Assets';

import { CommonAvatars } from '@/partials/common';

interface IEntryCalloutProps {
  className: string;
}

const EntryCallout = ({ className }: IEntryCalloutProps) => {
  return (
    <Fragment>
      <style>
        {`
          .entry-callout-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/2.png')}');
          }
          .dark .entry-callout-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/2-dark.png')}');
          }
        `}
      </style>

      <div className={`card h-full ${className}`}>
        <div className="card-body p-5 lg:p-10 bg-[length:80%] rtl:[background-position:-70%_25%] [background-position:175%_25%] sm:[background-position:120%_25%] lg:[background-position:175%_25%] bg-no-repeat entry-callout-bg">
          <div className="flex flex-col justify-center gap-4">
            <CommonAvatars
              size="size-10"
              group={[
                { filename: '300-4.png' },
                { filename: '300-1.png' },
                { filename: '300-2.png' },
                {
                  fallback: 'S',
                  variant: 'text-success-inverse text-xs ring-success-light bg-success'
                }
              ]}
            />

            <h2 className="text-1.5xl font-semibold text-gray-900">
              Connect Today & Join the{' '}
              <a href="#" className="link">
                KeenThemes Network
              </a>
            </h2>

            <p className="text-sm font-normal text-gray-700 leading-5.5 max-w-[280px] sm:max-w-full">
              Enhance your projects with premium themes and templates. Join the KeenThemes community today for top-quality designs and resources.
            </p>
          </div>
        </div>

        <div className="card-footer justify-center">
          <Link to="/account/home/get-started" className="btn btn-link">
            Get Started
          </Link>
        </div>
      </div>
    </Fragment>
  );
};

export { EntryCallout, type IEntryCalloutProps };
