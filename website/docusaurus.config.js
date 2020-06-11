module.exports = {
  title: 'React-Native-Sensitive-Info',
  tagline: 'A secure storage for React-Native apps',
  url: 'https://mcodex.github.io', // Your website URL
  baseUrl: '/react-native-sensitive-info/', // Base URL for your project */
  favicon: 'img/favicon.ico',
  organizationName: 'mcodex', // Usually your GitHub org/user name.
  projectName: 'react-native-sensitive-info', // Usually your repo name.
  themeConfig: {
    googleAnalytics: {
      trackingID: 'UA-79205996-6',
    },
    navbar: {
      title: 'RNSInfo',
      logo: {
        alt: 'react-native-sensitive-info',
        src: 'img/logo.png',
      },
      links: [
        {
          to: 'docs/',
          activeBasePath: 'docs',
          label: 'Docs',
          position: 'left',
        },
        {
          href: 'https://github.com/mcodex/react-native-sensitive-info',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      // links: [
      // {
      //   title: 'Docs',
      //   items: [
      //     {
      //       label: 'Style Guide',
      //       to: 'docs/',
      //     },
      //     {
      //       label: 'Second Doc',
      //       to: 'docs/doc2/',
      //     },
      //   ],
      // },
      // {
      //   title: 'Community',
      //   items: [
      //     {
      //       label: 'Stack Overflow',
      //       href: 'https://stackoverflow.com/questions/tagged/docusaurus',
      //     },
      //     {
      //       label: 'Discord',
      //       href: 'https://discordapp.com/invite/docusaurus',
      //     },
      //     {
      //       label: 'Twitter',
      //       href: 'https://twitter.com/docusaurus',
      //     },
      //   ],
      // },
      // {
      //   title: 'More',
      //   items: [
      //     {
      //       label: 'Blog',
      //       to: 'blog',
      //     },
      //     {
      //       label: 'GitHub',
      //       href: 'https://github.com/facebook/docusaurus',
      //     },
      //   ],
      // },
      // ],
      copyright: `Copyright © ${new Date().getFullYear()} Made with ❤️ by mCodex and the Awesome Community`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          // It is recommended to set document id as docs home page (`docs/` path).
          homePageId: 'overview',
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/mCodex/react-native-sensitive-info/tree/master/website',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
