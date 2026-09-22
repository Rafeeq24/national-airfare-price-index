const util = require('node:util');
if (!util.styleText) {
  util.styleText = (style, text) => text;
}
