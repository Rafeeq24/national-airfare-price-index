import util from 'node:util';
if (!util.styleText) {
  util.styleText = (style, text) => text;
}
