module.exports = {
  title: "React-Native-Sensitive-Info",
  tagline: "A secure storage for React-Native apps",
  url: "https://mcodex.github.io", // Your website URL
  baseUrl: "/react-native-sensitive-info/", // Base URL for your project */
  favicon: "img/favicon.ico",
  organizationName: "mcodex", // Usually your GitHub org/user name.
  projectName: "react-native-sensitive-info", // Usually your repo name.
  themeConfig: {
    googleAnalytics: {
      trackingID: "UA-79205996-6",
    },
    algolia: {
      apiKey: "db98b41e2171bc1f197a03a254c46b7b",
      indexName: "react-native-sensitive-info",
    },
    navbar: {
      title: "RNSInfo",
      logo: {
        alt: "react-native-sensitive-info",
        src: "img/logo.png",
      },
      items: [
        {
          to: "docs/",
          activeBasePath: "docs",
          label: "Docs",
          position: "left",
        },
        {
          to: "docs/5.x",
          activeBasePath: "docs/5.x",
          label: "v5.x",
          position: "left",
        },
        {
          href: "https://github.com/mcodex/react-native-sensitive-info",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
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
      "@docusaurus/preset-classic",
      {
        docs: {
          homePageId: "overview",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl:
            "https://github.com/mCodex/react-native-sensitive-info/tree/website/website",
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      },
    ],
  ],
};
