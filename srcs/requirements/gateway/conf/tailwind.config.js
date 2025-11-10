/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./pages/**/*.html",
		"./scripts/**/*.{js,ts}",
		"./index.html"
	],
	theme: {
		extend: {
			colors: {
				'prim': '#22A8AA',
   	    		'sec': '#E196BB',
        		'accent': '#CDC5F6',
        		'light': '#BDD2CA',
        		'dark': '#0C0F38',
			}
		}
	},
	plugins: [],
}