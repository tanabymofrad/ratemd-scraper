/* eslint indent: 0 */
const template = [
  '<md-toolbar>',
    '<div class="md-toolbar-tools">',
      '<toolbar-button icon="home" href="home"></toolbar-button>',
      '<h3>RateMDs Scraper</h3>',
      '<span flex></span>',
      '<toolbar-button icon="settings" href="config"></toolbar-button>',
    '</div>',
  '</md-toolbar>',
].join('');

const toolbar = { name: 'toolbar', template };

export default toolbar;
