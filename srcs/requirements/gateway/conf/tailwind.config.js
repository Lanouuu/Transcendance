/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"/etc/nginx/html/pages/**/*.html",
		"/etc/nginx/html/scripts/**/*.{js,ts}",
		"/etc/nginx/html/css/**/*.css",
		"/etc/nginx/html/index.html"
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
			}
		},

		fontFamily: {
			'geo': ['"Geo"', 'sans-serif'],
			'sans': ['system-ui', 'sans-serif'],
		}
	},
	plugins: [],
}