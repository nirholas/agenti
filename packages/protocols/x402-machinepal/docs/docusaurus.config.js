// @ts-check
// Note: type annotations allow type checking and IDE autocompletion

const {themes} = require('prism-react-renderer');
// FIX: 'github' is a light theme. 'dracula' (which you had) is dark.
const lightCodeTheme = themes.github;
// FIX: 'dracula' is a popular dark theme. 'vsDark' is also fine, but
// you had two dark themes assigned.
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'MachinePal Docs',
    tagline: 'Privacy, fairness, and AI on the blockchain.',
    favicon: 'img/favicon.ico', // Assumes this path is correct: static/img/favicon.ico

    // GitHub Pages deployment config
    url: 'https://skalenetwork.github.io/', // Your GitHub Pages URL
    baseUrl: '/machinepal/',                   // Base URL path for your site
    organizationName: 'skalenetwork',      // GitHub org/user name
    projectName: 'machinepal',                 // Repo name
    trailingSlash: false,

    // BEST PRACTICE: Use 'throw' in production to fail the build on broken links.
    // This prevents deploying a site with errors.
    onBrokenLinks: 'warn',
    onBrokenMarkdownLinks: 'warn',

    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    // WARNING: 'path: .' tells Docusaurus to use your *entire project root*
                    // as the docs folder. This is unusual and can pick up unwanted .md files.
                    // The standard practice is to create a 'docs/' folder and set 'path: 'docs''.
                    // I am leaving this as-is since it may be intentional.
                    path: '.',
                    routeBasePath: '/', // Serve docs at site root
                    sidebarPath: require.resolve('./sidebars.js'),
                    editUrl: 'https://github.com/skalenetwork/machinepal/edit/main/',
                    include: ['**/*.md', '**/*.mdx', 'README.md'],
                    exclude: ['**/node_modules/**'],
                    showLastUpdateAuthor: true,
                    showLastUpdateTime: true,
                },
                blog: false, // Disable blog
                theme: {
                    customCss: require.resolve('./src/css/custom.css'),
                },
            }),
        ],
    ],

    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    themeConfig: {
        // Assumes this path is correct: static/img/og-image.png
        image: 'img/og-image.png',
        colorMode: {
            defaultMode: 'light',
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
        navbar: {
            title: 'MachinePal Docs',
            logo: {
                alt: 'MachinePal Logo',
                src: 'img/logo.svg', // Assumes this path is correct: static/img/logo.svg
            },
            items: [
                { to: '/', label: 'Docs', position: 'left' },
                {
                    href: 'https://github.com/skalenetwork/machinepal',
                    label: 'GitHub',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Docs',
                    items: [
                        { label: 'Introduction', to: '/' },
                    ],
                },
                {
                    title: 'Community',
                    items: [
                        { label: 'GitHub', href: 'https://github.com/skalenetwork/machinepal' },
                        { label: 'Twitter', href: 'https://twitter.com/skalenetwork'},
                    ],
                },
            ],
            copyright: `© ${new Date().getFullYear()} MachinePal. All rights reserved.`,
        },
        prism: {
            theme: lightCodeTheme,
            darkTheme: darkCodeTheme,
            additionalLanguages: ['bash', 'json', 'solidity', 'python', 'cpp'],
        },
    },
};

module.exports = config;