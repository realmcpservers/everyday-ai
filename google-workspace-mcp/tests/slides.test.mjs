import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { GoogleSlidesService, compileSlideEdits } from '../dist/slides-api.js';
import { EditPresentationSchema, AddSlideImageSchema } from '../dist/schemas.js';
import { tools } from '../dist/tools/definitions.js';

test('validates editing operations and rejects malformed styles and image bounds', () => {
  assert.equal(EditPresentationSchema.safeParse({ presentation_id: 'p', operations: [{ type: 'style_text', element_id: 'e', style: {} }] }).success, false);
  assert.equal(EditPresentationSchema.safeParse({ presentation_id: 'p', operations: [{ type: 'set_background', slide_id: 's', color: 'red' }] }).success, false);
  assert.equal(EditPresentationSchema.safeParse({ presentation_id: 'p', operations: [{ type: 'delete_slide', slide_id: 's', unexpected: true }] }).success, false);
  assert.equal(AddSlideImageSchema.safeParse({ presentation_id: 'p', slide_id: 's', file_path: '/x', x: 0, y: 0, width: 0, height: 1 }).success, false);
  assert.equal(EditPresentationSchema.safeParse({ presentation_id: 'p', operations: [{ type: 'style_shape', element_id: 'e' }] }).success, false);
  assert.equal(EditPresentationSchema.safeParse({ presentation_id: 'p', operations: [{ type: 'style_shape', element_id: 'e', outline_color: 'gray' }] }).success, false);
});

test('styles shape outlines independently or alongside fills', () => {
  const { operations } = EditPresentationSchema.parse({ presentation_id: 'p', operations: [
    { type: 'style_shape', element_id: 'card', outline_color: '#D9D9D9' },
    { type: 'style_shape', element_id: 'card', fill_color: '#ffffff', outline_color: '#000000' },
    { type: 'add_shape', slide_id: 'slide', shape: 'RECTANGLE', x: 0, y: 0, width: 100, height: 40, outline_color: '#808080' },
  ] });
  const { requests, createdIds } = compileSlideEdits(operations);
  assert.equal(requests[0].updateShapeProperties.fields, 'outline.outlineFill.solidFill.color');
  assert.deepEqual(requests[0].updateShapeProperties.shapeProperties, { outline: { outlineFill: { solidFill: { color: { rgbColor: { red: 217 / 255, green: 217 / 255, blue: 217 / 255 } } } } } });
  assert.equal(requests[1].updateShapeProperties.fields, 'shapeBackgroundFill.solidFill,outline.outlineFill.solidFill.color');
  assert.deepEqual(requests[1].updateShapeProperties.shapeProperties.outline.outlineFill.solidFill.color.rgbColor, { red: 0, green: 0, blue: 0 });
  assert.equal(requests[3].updateShapeProperties.objectId, createdIds[0].objectId);
  assert.equal(requests[3].updateShapeProperties.fields, 'outline.outlineFill.solidFill.color');
});

test('compiles slide, text, style, reorder, duplicate, transform and deletion operations', () => {
  const operations = EditPresentationSchema.parse({ presentation_id: 'p', operations: [
    { type: 'add_slide', index: 0 },
    { type: 'add_text_box', slide_id: 's', text: 'Hello', x: 10, y: 20, width: 200, height: 40, style: { color: '#ff0000', font_size: 24, bold: false, align: 'CENTER' } },
    { type: 'style_shape', element_id: 'shape', fill_color: '#00ff00' },
    { type: 'replace_text', element_id: 'text', text: 'new' },
    { type: 'move_slide', slide_id: 's', index: 2 },
    { type: 'duplicate_slide', slide_id: 's' },
    { type: 'transform_element', element_id: 'text', x: 5, y: 6, scale_x: 2, scale_y: 3 },
    { type: 'delete_slide', slide_id: 's' },
  ] }).operations;
  const { requests, createdIds } = compileSlideEdits(operations);
  assert.equal(createdIds.length, 2);
  assert.equal(requests[0].createSlide.objectId, createdIds[0].objectId);
  assert.equal(requests[1].createShape.objectId, createdIds[1].objectId);
  assert.equal(requests[3].updateTextStyle.style.bold, false);
  assert.deepEqual(requests[3].updateTextStyle.style.foregroundColor.opaqueColor.rgbColor, { red: 1, green: 0, blue: 0 });
  assert.equal(requests[4].updateParagraphStyle.style.alignment, 'CENTER');
  assert.equal(requests.find(r => r.updateSlidesPosition).updateSlidesPosition.insertionIndex, 2);
  assert.equal(requests.find(r => r.duplicateObject).duplicateObject.objectId, 's');
  assert.equal(requests.find(r => r.updatePageElementTransform).updatePageElementTransform.applyMode, 'ABSOLUTE');
  assert.equal(requests.at(-1).deleteObject.objectId, 's');
});

test('sends batch with revision, and rejects wrong object kind before deletion', async () => {
  const service = new GoogleSlidesService(null);
  let sent;
  service.slides = { presentations: {
    get: async () => ({ data: { revisionId: 'rev', slides: [{ objectId: 'slide', pageElements: [{ objectId: 'element' }] }] } }),
    batchUpdate: async (request) => { sent = request; return { data: { replies: [{}] } }; },
  } };
  await assert.rejects(service.editPresentation('p', [{ type: 'delete_element', element_id: 'slide' }]), /element ID/);
  assert.equal(sent, undefined);
  await service.editPresentation('p', [{ type: 'delete_element', element_id: 'element' }]);
  assert.deepEqual(sent.requestBody.writeControl, { requiredRevisionId: 'rev' });
  assert.equal(sent.requestBody.requests[0].deleteObject.objectId, 'element');
});

test('private image tool sends bytes only to the script API and handles errors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'slides-test-'));
  const path = join(dir, 'image.png');
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
  await writeFile(path, png);
  const previous = process.env.GOOGLE_SLIDES_IMAGE_SCRIPT_DEPLOYMENT_ID;
  process.env.GOOGLE_SLIDES_IMAGE_SCRIPT_DEPLOYMENT_ID = 'deployment';
  try {
    const service = new GoogleSlidesService(null);
    let sent;
    service.script = { scripts: { run: async (request) => { sent = request; return { data: { response: { result: { objectId: 'image-id' } } } }; } } };
    service.drive = { files: { create: () => { throw new Error('must not upload or share'); } } };
    const args = { presentation_id: 'p', slide_id: 's', file_path: path, x: 1, y: 2, width: 3, height: 4 };
    assert.deepEqual(await service.addSlideImage(args), { objectId: 'image-id' });
    assert.equal(sent.scriptId, 'deployment');
    assert.equal(sent.requestBody.parameters[2], png.toString('base64'));
    assert.equal(sent.requestBody.parameters[3], 'image/png');
    service.script.scripts.run = async () => ({ data: { error: { details: [{ errorMessage: 'Slide not found' }] } } });
    await assert.rejects(service.addSlideImage(args), /Slide not found/);
    service.script.scripts.run = async () => { throw new Error('secret image payload'); };
    await assert.rejects(service.addSlideImage(args), error => !error.message.includes('secret image payload'));
    await assert.rejects(service.addSlideImage({ ...args, file_path: 'relative.png' }), /absolute/);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_SLIDES_IMAGE_SCRIPT_DEPLOYMENT_ID;
    else process.env.GOOGLE_SLIDES_IMAGE_SCRIPT_DEPLOYMENT_ID = previous;
    await unlink(path);
    await rmdir(dir);
  }
});

test('registers the new Slides tools', () => {
  const names = new Set(tools.map(tool => tool.name));
  for (const name of ['create_presentation', 'inspect_presentation', 'edit_presentation', 'get_slide_preview', 'add_slide_image']) assert.ok(names.has(name));
});

test('Apps Script helper inserts image bytes without Drive access', async () => {
  const source = await readFile(new URL('../apps-script/PrivateSlideImages.gs', import.meta.url), 'utf8');
  let inserted;
  let saved = false;
  const slide = { getObjectId: () => 'slide', insertImage: (blob, ...bounds) => {
    inserted = { blob, bounds };
    return { getObjectId: () => 'image' };
  } };
  const sandbox = {
    Utilities: { base64Decode: value => [...Buffer.from(value, 'base64')], newBlob: (bytes, mimeType) => ({ bytes, mimeType }) },
    SlidesApp: { openById: id => {
      assert.equal(id, 'deck');
      return { getSlides: () => [slide], saveAndClose: () => { saved = true; } };
    } },
  };
  runInNewContext(source, sandbox);
  const result = sandbox.insertPrivateSlideImage('deck', 'slide', Buffer.from('image').toString('base64'), 'image/png', 1, 2, 30, 40);
  assert.equal(result.objectId, 'image');
  assert.deepEqual(inserted.bounds, [1, 2, 30, 40]);
  assert.equal(inserted.blob.mimeType, 'image/png');
  assert.equal(saved, true);
  assert.throws(() => sandbox.insertPrivateSlideImage('deck', 'missing', 'aW1hZ2U=', 'image/png', 1, 2, 30, 40), /Slide not found/);
});

test('slide preview returns image bytes rather than a shareable URL', async () => {
  const service = new GoogleSlidesService(null);
  service.slides = { presentations: { pages: { getThumbnail: async () => ({ data: { contentUrl: 'https://example.test/secret' } }) } } };
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(Buffer.from('preview'), { status: 200 });
  try {
    assert.deepEqual(await service.getSlidePreview('deck', 'slide'), { data: Buffer.from('preview').toString('base64'), mimeType: 'image/png' });
  } finally { globalThis.fetch = previous; }
});
