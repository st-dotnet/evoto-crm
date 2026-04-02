const TodaysChecklist = () => {
  return (
    <div className="card h-full">
      <div className="card-header">
        <h3 className="card-title">Today's Checklist</h3>
      </div>

      <div className="card-body flex flex-col items-center justify-center gap-4 py-10">
        {/* Coming soon illustration */}
        <div className="relative">
          <svg
            width="100"
            height="90"
            viewBox="0 0 100 90"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Traffic cone */}
            <path
              d="M50 10L35 70H65L50 10Z"
              fill="#FF9F43"
              stroke="#FF7B00"
              strokeWidth="1.5"
            />
            <path
              d="M38 45H62"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M40 58H60"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <ellipse cx="50" cy="72" rx="20" ry="4" fill="#FF7B00" opacity="0.3" />
            {/* Small cone */}
            <path
              d="M72 35L65 60H79L72 35Z"
              fill="#FFB976"
              stroke="#FF9F43"
              strokeWidth="1"
            />
            <path
              d="M67 50H77"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <ellipse cx="72" cy="61" rx="10" ry="2.5" fill="#FF9F43" opacity="0.2" />
          </svg>
        </div>

        <div className="text-center">
          <h4 className="text-base font-semibold text-gray-900 mb-1">Coming Soon...</h4>
          <p className="text-2sm text-gray-500 max-w-[220px]">
            Smarter daily checklist for overdue and follow ups
          </p>
        </div>
      </div>
    </div>
  );
};

export { TodaysChecklist };
