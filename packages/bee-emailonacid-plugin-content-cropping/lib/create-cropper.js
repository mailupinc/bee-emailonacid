'use strict';

const Jimp = require('jimp');
const cropperWorker = require('./cropper-worker');

function createCropper({
  cropWhitespace,
  markerColor,
  jpegMarkerColor,
  logger,
}) {
  return async (image) => {
    try {
      const color =
        image.getMIME() === Jimp.MIME_JPEG ? jpegMarkerColor : markerColor;
      return await cropperWorker(image, color, cropWhitespace);
    } catch (reason) {
      logger.error('failed to identify visual markers');
      logger.error('perhaps screenshot is corrupted?');
      logger.error(reason);
      return image;
    }
  };
}

module.exports = createCropper;
