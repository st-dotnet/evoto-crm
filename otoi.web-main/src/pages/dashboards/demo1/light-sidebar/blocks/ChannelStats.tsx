import { Fragment } from 'react';

import { toAbsoluteUrl } from '@/utils/Assets';

interface IChannelStatsItem {
  logo: string;
  logoDark?: string;
  info: string;
  desc: string;
  path: string;
}
interface IChannelStatsItems extends Array<IChannelStatsItem> {}

const ChannelStats = () => {
  const items: IChannelStatsItems = [
    { logo: 'to-collect.svg', info: '9.3k', desc: 'To Collect', path: '' },
    { logo: 'to-pay.svg', info: '24k', desc: 'To Pay', path: '' },
    { logo: 'bank.svg', info: '34K', desc: 'Bank', path: '' },
    // {
    //   logo: 'tiktok.svg',
    //   logoDark: 'tiktok-dark.svg',
    //   info: '2.5k',
    //   desc: 'Stream audience',
    //   path: ''
    // }
  ];

  const renderItem = (item: IChannelStatsItem, index: number) => {
    return (
      <div
        key={index}
        className="card flex-col justify-between gap-6 h-full bg-cover rtl:bg-[left_top_-1.7rem] bg-[right_top_-1.7rem] bg-no-repeat channel-stats-bg"
      >
        {/* <img
            src={toAbsoluteUrl(`/media/brand-logos/${item.logo}`)}
            className="w-7 mt-4 ms-5"
            alt=""
        /> */}
        <i className="ki-filled ki-tag text-lg"></i>
        <div className="flex flex-col gap-1 pb-4 px-5">
          <span className="text-3xl font-semibold text-gray-900">{item.info}</span>
          <span className="text-2sm font-normal text-gray-700">{item.desc}</span>
        </div>
      </div>
    );
  };

  return (
    <Fragment>
      <style>
        {`
          .channel-stats-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/bg-3.png')}');
          }
          .dark .channel-stats-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/bg-3-dark.png')}');
          }
        `}
      </style>

      {items.map((item, index) => {
        return renderItem(item, index);
      })}
    </Fragment>
  );
};

export { ChannelStats, type IChannelStatsItem, type IChannelStatsItems };
