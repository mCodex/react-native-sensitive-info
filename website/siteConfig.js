/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// See https://docusaurus.io/docs/site-config for all the possible
// site configuration options.

// List of projects/orgs using your project for the users page.
const users = [
  {
    caption: 'User1',
    // You will need to prepend the image path with your baseUrl
    // if it is not '/', like: '/test-site/img/image.jpg'.
    image: '/img/undraw_open_source.svg',
    infoLink: 'https://www.facebook.com',
    pinned: true,
  },
];

const siteConfig = {
  title: 'React-Native-Sensitive-Info', // Title for your website.
  tagline: 'A secure storage for your React-Native apps',
  url: 'https://mcodex.github.io', // Your website URL
  baseUrl: '/react-native-sensitive-info/', // Base URL for your project */
  projectName: 'react-native-sensitive-info',
  organizationName: 'mCodex',
  // For top-level user or org sites, the organization is still the same.

  // For no header links in the top nav bar -> headerLinks: [],
  headerLinks: [
    {doc: 'installation', label: 'Docs'},
    {
      href: 'https://github.com/mCodex/react-native-sensitive-info',
      label: 'GitHub',
    },
    {search: true},
  ],

  // If you have users set above, you add it here:
  users,

  /* path to images for header/footer */
  headerIcon: 'img/logo.png',
  // footerIcon: 'img/logo.png',
  favicon: 'img/favicon.ico',

  /* Colors for website */
  colors: {
    primaryColor: '#292930',
    secondaryColor: '#4C73E6',
  },

  /* Custom fonts for website */
  /*
  fonts: {
    myFont: [
      "Times New Roman",
      "Serif"
    ],
    myOtherFont: [
      "-apple-system",
      "system-ui"
    ]
  },
  */

  // This copyright info is used in /core/Footer.js and blog RSS/Atom feeds.
  copyright: `Made with ❤️ by mCodex and the awesome community`,

  highlight: {
    // Highlight.js theme to use for syntax highlighting in code blocks.
    theme: 'dark',
  },

  // Add custom scripts here that would be placed in <script> tags.
  scripts: ['https://buttons.github.io/buttons.js'],

  // On page navigation for the current documentation page.
  onPageNav: 'separate',
  // No .html extensions for paths.
  cleanUrl: true,

  // Open Graph and Twitter card images.
  ogImage: 'img/logo.png',
  twitterImage: 'img/logo.png',

  // For sites with a sizable amount of content, set collapsible to true.
  // Expand/collapse the links and subcategories under categories.
  // docsSideNavCollapsible: true,

  // Show documentation's last contributor's name.
  // enableUpdateBy: true,

  // Show documentation's last update time.
  enableUpdateTime: true,

  gaTrackingId: 'UA-79205996-6',

  // You may provide arbitrary config keys to be used as needed by your
  // template. For example, if you need your repo's URL...
  repoUrl: 'https://github.com/mCodex/react-native-sensitive-info',
};

module.exports = siteConfig;
