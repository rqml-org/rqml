import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'RQML',
  tagline: 'Requrements Markup Language',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://rqml.org',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Stakkar analytics', // Usually your GitHub org/user name.
  projectName: 'RQML', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    function rqmlLoaderPlugin() {
      return {
        name: 'docusaurus-plugin-rqml-loader',
        configureWebpack() {
          return {
            module: {
              rules: [
                {
                  test: /\.rqml$/,
                  type: 'asset/source',
                },
              ],
            },
          };
        },
      };
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,           // hides the light/dark toggle
      respectPrefersColorScheme: false, // ignore OS/browser preference
    },
    navbar: {
      title: 'Home',
      logo: {
        alt: 'RQML logo',
        src: 'img/RQML_logo_transparent.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {to: '/why-rqml', label: 'Why RQML', position: 'left'},
        {
          href: "/AGENTS.md",
          label: "Get AGENTS.md",
          position: "right",
          className: "navbar__downloadButton",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        {
          href: "https://marketplace.visualstudio.com/items?itemName=rqml.rqml-vscode",
          label: "Get VSCode extension",
          position: "right",
          className: "navbar__downloadButton",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        {
          href: 'https://github.com/rqml-org/rqml',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Info',
          items: [
            { label: 'About', to: '/about' },
            { label: 'Changelog', to: '/changelog' },
          ],
        },
        {
          title: 'Links',
          items: [
            { label: 'RQML on GitHub', href: 'https://github.com/rqml-org/rqml' },
            { label: 'RQML VSCode extension on GitHub', href: 'https://github.com/rqml-org/rqml-vscode' },
            { label: 'RQML Agent Skill on GitHub', href: 'https://github.com/rqml-org/rqml-skill' },
            { label: 'rqml.org', href: 'https://rqml.org' },
            { label: 'rqml.dev', href: 'https://rqml.org' },
          ],
        },
        {
          title: 'Legal',
          items: [
            { label: 'License', href: 'https://github.com/rqml-org/rqml/blob/main/LICENSE' },
            { label: 'Trademark', href: 'https://github.com/rqml-org/rqml/blob/main/TRADEMARK.md' },
            { label: 'Notice', href: 'https://github.com/rqml-org/rqml/blob/main/NOTICE' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} The RQML Authors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
