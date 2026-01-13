/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"/etc/nginx/html/scripts/**/*.{js,ts}",
		"/etc/nginx/html/css/**/*.css",
		"/etc/nginx/html/pages/**/*.html",
		"/etc/nginx/html/index.html",
		"./pages/**/*.html",
        "./scripts/**/*.{js,ts}",
        "./css/**/*.css",
        "./index.html",
	],

	safelist: [
		'hidden'
	],

	theme: {
		extend: {
			colors: {
				'prim': '#22A8AA',
   	    		'sec': '#E196BB',
        		'accent': '#CDC5F6',
        		'light': '#BDD2CA',
        		'dark': '#0C0F38',
				'other': '#dd5b5b',
			},
			keyframes: {
				'flowting-sm': {
					'0%': { transform: 'translateY(0)' },
					'100%': { transform: 'translateY(10px)' }
				},
				'flowting-lg': {
					'0%': { transform: 'translateY(0)' },
					'100%': { transform: 'translateY(-10px)' }
				}
			},
			animation: {
				flowtingQuartz: 'flowting-lg 2s ease-in-out infinite alternate',
				flowtingStele: 'flowting-sm 3s ease-in-out infinite alternate'
			}
		},

		fontFamily: {
			'geo': ['"Geo"', 'sans-serif'],
			'sans': ['system-ui', 'sans-serif'],
		}
	},
	plugins: [],
}