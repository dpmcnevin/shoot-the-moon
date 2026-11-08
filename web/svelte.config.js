import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages base path: must match the repository name so asset URLs
// resolve at https://<user>.github.io/<repo>/. Override with BASE_PATH
// (e.g. BASE_PATH= for a custom domain or a root deploy). Dev serves from /.
const dev = process.env.NODE_ENV === 'development';
const base = dev ? '' : (process.env.BASE_PATH ?? '/shoot-the-moon');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Force runes mode for the project, except for libraries.
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html', // SPA fallback; GitHub Pages serves 404.html for unknown paths
			precompressed: false,
			strict: true
		}),
		paths: { base },
		// The shared engine (rules, run logic, art, sound) lives beside the app.
		alias: { $engine: '../engine/src' }
	}
};

export default config;
