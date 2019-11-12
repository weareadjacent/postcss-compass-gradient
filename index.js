'use strict';

const crypto = require('crypto');
const execSync = require('child_process').execSync;
const fs = require('fs');

const mkdirp = require('mkdirp');
const PNG = require('pngjs').PNG;
const postcss = require('postcss');

/**
 * We make a fake "project" folder in /tmp because that's how compass expects things.
 */
const PROJECT_PATH = '/tmp/postcss-compass-gradient';
/**
 * Default source SCSS path.
 */
const SASS_PATH = `${PROJECT_PATH}/sass`;
/**
 * Default output CSS path.
 */
const CSS_PATH = `${PROJECT_PATH}/stylesheets`;

const GRADIENT_REGEX = /^(linear|repeating-linear|radial|repeating-radial|conic)-gradient/;

/**
 * Do a SHA1 hash of a value in hex.
 * @param String value 
 */
function hash(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function compassGradient(options) {
  return function (root) {
    options = options || {};

    root.walkDecls('background-image', decl => {
      if (!GRADIENT_REGEX.test(decl.value)) {
        return;
      }

      let valueHash = hash(decl.value);
      let sassFilename = `${SASS_PATH}/${valueHash}.scss`;
      let cssFilename = `${CSS_PATH}/${valueHash}.css`;

      if (!fs.existsSync(cssFilename)) {
        if (!fs.existsSync(sassFilename)) {
          // Output minimal source files for Compass to compile.
          let contents = `@import 'compass';
            .x {
              @include background-image(${decl.value});
            }`
          ;

          mkdirp.sync(`${SASS_PATH}`);
          fs.writeFileSync(sassFilename, contents);
        }

        // Call Compass.
        let command = `cd ${PROJECT_PATH}; compass compile sass/${valueHash}.scss`;
        let commandResult = String(execSync(command));
      }

      // Read from Compass' output CSS.
      let rawCss = fs.readFileSync(cssFilename);
      let cssObj = postcss.parse(rawCss);
      cssObj.walkDecls('background-image', compassDecl => {
        if (compassDecl.value.startsWith('url')) {
          // We know a background-size accompanies this so let's just help it.
          decl.cloneBefore({
            prop: 'background-size',
            value: '100%'
          });

          // This is the actual svg gradient we're after.
          decl.cloneBefore({
            value: compassDecl.value
          });
        }
      });
    });
  }
}

module.exports = postcss.plugin('compass-gradient', compassGradient);