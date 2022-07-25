/* eslint-disable no-console */
'use strict';

const Jimp = require('jimp');

async function cropperWorker(image, markerColor, cropWhitespace) {
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const tolerance = 0.1;
  const safeZone = 2;
  const referenceRgba = Jimp.intToRGBA(Jimp.cssColorToHex(markerColor));
  // Scan all pixels to find similiar ones first
  const matchedPixels = new Set();
  const isPixelMatch = (x, y) =>
    matchedPixels.has(image.getPixelIndex(x, y)) === true;
  image.scan(0, 0, width, height, (x, y, idx) => {
    const currentPixel = image.getPixelColor(x, y);
    const currentRgba = Jimp.intToRGBA(currentPixel);
    if (Jimp.colorDiff(referenceRgba, currentRgba) <= tolerance) {
      matchedPixels.add(idx);
    }
  });
  // Locate top marker line
  let lineWidth = 0;
  let topLeftX = 0;
  let topLeftY = 0;
  image.scan(0, 0, width, height, (x, y) => {
    if (isPixelMatch(x, y)) {
      // Check if it's a line
      let maybeLineWith = 0;
      for (let lineX = x; lineX < width; lineX++) {
        if (isPixelMatch(lineX, y)) {
          maybeLineWith++;
        } else {
          break;
        }
      }
      if (maybeLineWith > lineWidth) {
        lineWidth = maybeLineWith;
        topLeftX = x;
        topLeftY = y;
      }
    }
  });
  // Locate bottom marker line next
  let bottomRightX = topLeftX;
  let bottomRightY = topLeftY + safeZone;
  image.scan(0, bottomRightY, width, height - bottomRightY, (x, y) => {
    if (isPixelMatch(x, y)) {
      // Check if it's a line
      let maybeLineWidth = 0;
      for (let lineX = x; lineX >= 0; lineX--) {
        if (isPixelMatch(lineX, y)) {
          maybeLineWidth++;
        } else {
          break;
        }
      }
      // Set the value if it's the same length
      if (maybeLineWidth === lineWidth) {
        bottomRightX = x;
        bottomRightY = y;
      }
    }
  });
  // Do nothing if no anchors found
  if (topLeftX === bottomRightX || topLeftY === bottomRightY) {
    return image;
  }
  // Crop the image
  // console.debug('found next visual markers:');
  // console.debug('top left anchor %o', { x: topLeftX, y: topLeftY });
  // console.debug('bottom right anchor %o', {
  //   x: bottomRightX,
  //   y: bottomRightY,
  // });
  const cropWidth = bottomRightX - topLeftX;
  const cropHeight = bottomRightY - topLeftY;
  image.crop(
    topLeftX,
    topLeftY + safeZone,
    cropWidth,
    cropHeight - safeZone * 2
  );
  // Remove whitespace ared if needed
  if (cropWhitespace === 'true') {
    image.autocrop({
      cropOnlyFrames: false,
      tolerance: 0.0001,
    });
  }
  return image;
}

module.exports = cropperWorker;
