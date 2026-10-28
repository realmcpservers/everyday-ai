/**
 * API executable for inserting an image without publishing it to Drive.
 * Called under the OAuth user's identity; no image or URL is logged or shared.
 */
function insertPrivateSlideImage(presentationId, slideId, base64, mimeType, x, y, width, height) {
  if (!['image/png', 'image/jpeg', 'image/gif'].includes(mimeType)) {
    throw new Error('Unsupported image type');
  }
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error('Invalid image bounds');
  }
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) {
    throw new Error('Image must be between 1 byte and 3 MiB');
  }
  const presentation = SlidesApp.openById(presentationId);
  const slide = presentation.getSlides().find((item) => item.getObjectId() === slideId);
  if (!slide) throw new Error('Slide not found in presentation');
  const image = slide.insertImage(Utilities.newBlob(bytes, mimeType), x, y, width, height);
  const objectId = image.getObjectId();
  presentation.saveAndClose();
  return { objectId };
}
