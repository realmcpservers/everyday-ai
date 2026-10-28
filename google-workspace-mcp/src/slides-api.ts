/**
 * Google Slides API Service
 * Wraps Google Slides REST API calls
 */

import { google } from "googleapis";
import type { slides_v1, script_v1 } from "googleapis";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { logger } from "./logger.js";
import type { GoogleAuth } from "./types.js";
import type { SlideEditOperation } from "./schemas.js";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function rgb(hex: string): slides_v1.Schema$RgbColor {
  return { red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 };
}

function makeTextStyle(style: NonNullable<Extract<SlideEditOperation, { type: "add_text_box" }>["style"]>): { style: slides_v1.Schema$TextStyle; fields: string } {
  const result: slides_v1.Schema$TextStyle = {};
  if (style.font_family !== undefined) result.fontFamily = style.font_family;
  if (style.font_size !== undefined) result.fontSize = { magnitude: style.font_size, unit: "PT" };
  if (style.color !== undefined) result.foregroundColor = { opaqueColor: { rgbColor: rgb(style.color) } };
  if (style.bold !== undefined) result.bold = style.bold;
  if (style.italic !== undefined) result.italic = style.italic;
  if (style.underline !== undefined) result.underline = style.underline;
  return { style: result, fields: Object.keys(result).join(",") };
}

function newObjectId(): string { return `obj_${randomUUID().replace(/-/g, "")}`; }

function appendTextStyle(requests: slides_v1.Schema$Request[], objectId: string, input: NonNullable<Extract<SlideEditOperation, { type: "add_text_box" }>["style"]>): void {
  const { style, fields } = makeTextStyle(input);
  if (fields) requests.push({ updateTextStyle: { objectId, textRange: { type: "ALL" }, style, fields } });
  if (input.align) requests.push({ updateParagraphStyle: { objectId, textRange: { type: "ALL" }, style: { alignment: input.align }, fields: "alignment" } });
}

function shapeStyle(objectId: string, fillColor?: string, outlineColor?: string): slides_v1.Schema$Request {
  const shapeProperties: slides_v1.Schema$ShapeProperties = {};
  const fields: string[] = [];
  if (fillColor !== undefined) {
    shapeProperties.shapeBackgroundFill = { solidFill: { color: { rgbColor: rgb(fillColor) }, alpha: 1 } };
    fields.push("shapeBackgroundFill.solidFill");
  }
  if (outlineColor !== undefined) {
    shapeProperties.outline = { outlineFill: { solidFill: { color: { rgbColor: rgb(outlineColor) } } } };
    fields.push("outline.outlineFill.solidFill.color");
  }
  return { updateShapeProperties: { objectId, shapeProperties, fields: fields.join(",") } };
}

/** Compile a validated, typed editing operation into Slides API requests. */
export function compileSlideEdits(operations: SlideEditOperation[]): { requests: slides_v1.Schema$Request[]; createdIds: Array<{ operation: number; objectId: string }> } {
  const requests: slides_v1.Schema$Request[] = [];
  const createdIds: Array<{ operation: number; objectId: string }> = [];
  operations.forEach((op, operation) => {
    switch (op.type) {
      case "add_slide": {
        const objectId = newObjectId();
        createdIds.push({ operation, objectId });
        requests.push({ createSlide: { objectId, insertionIndex: op.index, slideLayoutReference: { predefinedLayout: "BLANK" } } });
        break;
      }
      case "delete_slide": requests.push({ deleteObject: { objectId: op.slide_id } }); break;
      case "duplicate_slide": requests.push({ duplicateObject: { objectId: op.slide_id } }); break;
      case "move_slide": requests.push({ updateSlidesPosition: { slideObjectIds: [op.slide_id], insertionIndex: op.index } }); break;
      case "add_text_box":
      case "add_shape": {
        const objectId = newObjectId();
        createdIds.push({ operation, objectId });
        requests.push({ createShape: { objectId, shapeType: op.type === "add_text_box" ? "TEXT_BOX" : op.shape, elementProperties: { pageObjectId: op.slide_id, size: { width: { magnitude: op.width, unit: "PT" }, height: { magnitude: op.height, unit: "PT" } }, transform: { scaleX: 1, scaleY: 1, translateX: op.x, translateY: op.y, unit: "PT" } } } });
        if (op.type === "add_text_box") {
          requests.push({ insertText: { objectId, text: op.text, insertionIndex: 0 } });
          if (op.style) appendTextStyle(requests, objectId, op.style);
        } else if (op.fill_color !== undefined || op.outline_color !== undefined) {
          requests.push(shapeStyle(objectId, op.fill_color, op.outline_color));
        }
        break;
      }
      case "replace_text":
        requests.push({ deleteText: { objectId: op.element_id, textRange: { type: "ALL" } } });
        if (op.text) requests.push({ insertText: { objectId: op.element_id, text: op.text, insertionIndex: 0 } });
        break;
      case "style_text": {
        appendTextStyle(requests, op.element_id, op.style);
        break;
      }
      case "style_shape": requests.push(shapeStyle(op.element_id, op.fill_color, op.outline_color)); break;
      case "set_background": requests.push({ updatePageProperties: { objectId: op.slide_id, pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: rgb(op.color) }, alpha: 1 } } }, fields: "pageBackgroundFill.solidFill" } }); break;
      case "move_element": requests.push({ updatePageElementTransform: { objectId: op.element_id, applyMode: "RELATIVE", transform: { scaleX: 1, scaleY: 1, translateX: op.x, translateY: op.y, unit: "PT" } } }); break;
      case "transform_element": requests.push({ updatePageElementTransform: { objectId: op.element_id, applyMode: "ABSOLUTE", transform: { scaleX: op.scale_x, scaleY: op.scale_y, translateX: op.x, translateY: op.y, unit: "PT" } } }); break;
      case "delete_element": requests.push({ deleteObject: { objectId: op.element_id } }); break;
    }
  });
  return { requests, createdIds };
}

// Types for slide media content
export interface SlideImage {
  contentUrl: string;
  sourceUrl?: string;
  description?: string;
  width?: number;
  height?: number;
  base64Data?: string;
  mimeType?: string;
}

export interface SlideVideo {
  videoUrl: string;
  source: "YOUTUBE" | "DRIVE" | "UNKNOWN";
  videoId?: string;
}

export interface SlideChart {
  chartId: string;
  spreadsheetId?: string;
  description: string;
}

export interface SlideContent {
  slideNumber: number;
  objectId: string;
  text: string;
  speakerNotes: string;
  images: SlideImage[];
  videos: SlideVideo[];
  charts: SlideChart[];
  shapes: string[];
}

export interface PresentationContent {
  id: string;
  title: string;
  slideCount: number;
  slides: SlideContent[];
}

export class GoogleSlidesService {
  private slides: slides_v1.Slides;
  private drive: ReturnType<typeof google.drive>;
  private script: ReturnType<typeof google.script>;

  constructor(auth: GoogleAuth) {
    this.slides = google.slides({
      version: "v1",
      auth: auth as Parameters<typeof google.slides>[0]["auth"],
    });
    this.drive = google.drive({
      version: "v3",
      auth: auth as Parameters<typeof google.drive>[0]["auth"],
    });
    this.script = google.script({ version: "v1", auth: auth as Parameters<typeof google.script>[0]["auth"] });
  }

  async createPresentation(title: string): Promise<{ id: string; title: string; url: string }> {
    const response = await this.slides.presentations.create({ requestBody: { title } });
    const id = response.data.presentationId;
    if (!id) throw new Error("Google did not return a presentation ID");
    return { id, title: response.data.title || title, url: getPresentationUrl(id) };
  }

  async inspectPresentation(presentationId: string): Promise<unknown> {
    const { data } = await this.slides.presentations.get({ presentationId });
    const describeElement = (element: slides_v1.Schema$PageElement): unknown => ({
      id: element.objectId, size: element.size, transform: element.transform,
      shape: element.shape && { type: element.shape.shapeType, text: element.shape.text, properties: element.shape.shapeProperties },
      image: element.image ? { properties: element.image.imageProperties } : undefined,
      table: element.table, group: element.elementGroup?.children?.map(describeElement),
      title: element.title, description: element.description,
    });
    return { id: data.presentationId, title: data.title, revisionId: data.revisionId, pageSize: data.pageSize,
      slides: (data.slides || []).map((slide, index) => ({ id: slide.objectId, index, properties: slide.pageProperties, elements: (slide.pageElements || []).map(describeElement) })) };
  }

  async editPresentation(presentationId: string, operations: SlideEditOperation[], revisionId?: string): Promise<unknown> {
    // The API's deleteObject accepts either a page or an element. Check the
    // kind before sending a destructive request, so an incorrect ID cannot
    // delete an entire slide when the caller intended to delete an element.
    if (operations.some((op) => op.type === "delete_slide" || op.type === "delete_element")) {
      const { data: presentation } = await this.slides.presentations.get({ presentationId });
      const slideIds = new Set((presentation.slides || []).map((slide) => slide.objectId));
      const elementIds = new Set<string>();
      const collect = (elements: slides_v1.Schema$PageElement[]) => {
        for (const element of elements) {
          if (element.objectId) elementIds.add(element.objectId);
          collect(element.elementGroup?.children || []);
        }
      };
      for (const slide of presentation.slides || []) collect(slide.pageElements || []);
      for (const op of operations) {
        if (op.type === "delete_slide" && !slideIds.has(op.slide_id)) throw new Error("delete_slide requires a slide ID from this presentation");
        if (op.type === "delete_element" && !elementIds.has(op.element_id)) throw new Error("delete_element requires an element ID from this presentation");
      }
      revisionId ||= presentation.revisionId || undefined;
    }
    const { requests, createdIds } = compileSlideEdits(operations);
    const { data } = await this.slides.presentations.batchUpdate({ presentationId, requestBody: {
      requests, ...(revisionId ? { writeControl: { requiredRevisionId: revisionId } } : {}),
    } });
    return { createdIds, replies: data.replies, writeControl: data.writeControl };
  }

  async getSlidePreview(presentationId: string, slideId: string): Promise<{ data: string; mimeType: string }> {
    const { data } = await this.slides.presentations.pages.getThumbnail({ presentationId, pageObjectId: slideId, "thumbnailProperties.mimeType": "PNG", "thumbnailProperties.thumbnailSize": "LARGE" });
    if (!data.contentUrl) throw new Error("Google did not return a slide thumbnail");
    const response = await fetch(data.contentUrl);
    if (!response.ok) throw new Error(`Could not download slide thumbnail (${response.status})`);
    return { data: Buffer.from(await response.arrayBuffer()).toString("base64"), mimeType: "image/png" };
  }

  async addSlideImage(args: { presentation_id: string; slide_id: string; file_path: string; x: number; y: number; width: number; height: number }): Promise<{ objectId: string }> {
    const deploymentId = process.env.GOOGLE_SLIDES_IMAGE_SCRIPT_DEPLOYMENT_ID?.trim();
    if (!deploymentId) throw new Error("Private image helper is not configured. See the Google Slides section of google-workspace-mcp/README.md.");
    if (!isAbsolute(args.file_path)) throw new Error("Image path must be absolute and accessible to the MCP server");
    const info = await stat(args.file_path);
    if (!info.isFile() || info.size === 0 || info.size > MAX_IMAGE_BYTES) throw new Error("Image must be a non-empty regular file of at most 3 MiB");
    const bytes = await readFile(args.file_path);
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Image exceeds 3 MiB");
    const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
      : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "image/jpeg"
      : ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii")) ? "image/gif" : null;
    if (!mimeType) throw new Error("Image must be PNG, JPEG, or GIF");
    let data: script_v1.Schema$Operation;
    try {
      const response = await this.script.scripts.run({ scriptId: deploymentId, requestBody: { function: "insertPrivateSlideImage", parameters: [args.presentation_id, args.slide_id, bytes.toString("base64"), mimeType, args.x, args.y, args.width, args.height] } }, { timeout: 380000 });
      data = response.data;
    } catch (error) {
      // Never propagate the HTTP request or its base64 image payload to logs.
      const status = (error as { response?: { status?: number } })?.response?.status;
      throw new Error(`Private image helper request failed${status ? ` (HTTP ${status})` : ""}. Check deployment, OAuth consent, and Apps Script API setup.`);
    }
    if (data.error) {
      const detail = data.error.details?.[0] as { errorMessage?: string } | undefined;
      throw new Error(`Private image helper failed: ${detail?.errorMessage || data.error.message || "unknown script error"}`);
    }
    const result = data.response?.result as { objectId?: unknown } | undefined;
    if (typeof result?.objectId !== "string" || !result.objectId) throw new Error("Private image helper returned no image ID");
    return { objectId: result.objectId };
  }

  /**
   * List recent presentations from Google Drive
   */
  async listPresentations(maxResults: number = 10): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    try {
      logger.debug(`Listing presentations (max: ${maxResults})`);

      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.presentation'",
        pageSize: maxResults,
        fields: "files(id, name, modifiedTime)",
        orderBy: "modifiedTime desc",
      });

      const files = response.data.files || [];
      return files.map((file) => ({
        id: file.id || "",
        name: file.name || "Untitled",
        modifiedTime: file.modifiedTime || "",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list presentations: ${message}`);
    }
  }

  /**
   * Search presentations by name
   */
  async searchPresentations(
    query: string,
    maxResults: number = 10
  ): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    try {
      logger.debug(`Searching presentations: ${query}`);

      const response = await this.drive.files.list({
        q: `mimeType='application/vnd.google-apps.presentation' and name contains '${query.replace(/'/g, "\\'")}'`,
        pageSize: maxResults,
        fields: "files(id, name, modifiedTime)",
        orderBy: "modifiedTime desc",
      });

      const files = response.data.files || [];
      return files.map((file) => ({
        id: file.id || "",
        name: file.name || "Untitled",
        modifiedTime: file.modifiedTime || "",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to search presentations: ${message}`);
    }
  }

  /**
   * Get a presentation by ID with full content including media
   * @param presentationId - The presentation ID
   * @param options.includeImageData - If true, downloads and includes base64-encoded image data
   */
  async getPresentation(
    presentationId: string,
    options: { includeImageData?: boolean } = {}
  ): Promise<PresentationContent> {
    try {
      logger.debug(`Getting presentation: ${presentationId}`);

      const response = await this.slides.presentations.get({
        presentationId,
      });

      const presentation = response.data;
      const slides = presentation.slides || [];

      const extractedSlides: SlideContent[] = [];

      for (let index = 0; index < slides.length; index++) {
        const slide = slides[index];
        const content = this.extractAllContent(slide);

        // Download image data if requested
        if (options.includeImageData && content.images.length > 0) {
          for (const image of content.images) {
            if (image.contentUrl) {
              const imageData = await this.downloadImage(image.contentUrl);
              if (imageData) {
                image.base64Data = imageData.base64;
                image.mimeType = imageData.mimeType;
              }
            }
          }
        }

        extractedSlides.push({
          slideNumber: index + 1,
          objectId: slide.objectId || "",
          text: content.text,
          speakerNotes: this.extractSpeakerNotes(slide),
          images: content.images,
          videos: content.videos,
          charts: content.charts,
          shapes: content.shapes,
        });
      }

      logger.info(`Retrieved presentation: ${presentationId} (${slides.length} slides)`);

      return {
        id: presentation.presentationId || presentationId,
        title: presentation.title || "Untitled",
        slideCount: slides.length,
        slides: extractedSlides,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get presentation: ${message}`);
    }
  }

  /**
   * Download an image from a Google URL and return base64 data
   */
  private async downloadImage(
    contentUrl: string
  ): Promise<{ base64: string; mimeType: string } | null> {
    try {
      // Get access token from the auth client
      const authClient = this.slides as unknown as { auth: { getAccessToken: () => Promise<{ token?: string | null }> } };
      const tokenResponse = await authClient.auth.getAccessToken();
      const accessToken = tokenResponse.token;

      if (!accessToken) {
        logger.debug("No access token available for image download");
        return null;
      }

      // Fetch the image with authentication
      const response = await fetch(contentUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        logger.debug(`Failed to download image: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return {
        base64,
        mimeType: contentType,
      };
    } catch (error) {
      logger.debug(`Error downloading image: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Helper: Extract all content from a slide (text, images, videos, charts, shapes)
   */
  private extractAllContent(slide: slides_v1.Schema$Page): {
    text: string;
    images: SlideImage[];
    videos: SlideVideo[];
    charts: SlideChart[];
    shapes: string[];
  } {
    const textParts: string[] = [];
    const images: SlideImage[] = [];
    const videos: SlideVideo[] = [];
    const charts: SlideChart[] = [];
    const shapes: string[] = [];

    if (!slide.pageElements) {
      return { text: "", images: [], videos: [], charts: [], shapes: [] };
    }

    for (const element of slide.pageElements) {
      // Extract text from shapes
      if (element.shape?.text?.textElements) {
        const shapeText = this.extractTextFromTextElements(element.shape.text.textElements);
        if (shapeText.trim()) {
          textParts.push(shapeText);
        }
      }

      // Extract non-text shapes (drawings, lines, etc.)
      if (element.shape?.shapeType && !element.shape?.text?.textElements?.length) {
        const shapeType = element.shape.shapeType;
        if (shapeType !== "TEXT_BOX" && shapeType !== "RECTANGLE") {
          shapes.push(shapeType);
        }
      }

      // Extract tables
      if (element.table?.tableRows) {
        const tableText = this.extractTableAsMarkdown(element.table);
        if (tableText.trim()) {
          textParts.push(tableText);
        }
      }

      // Extract images
      if (element.image) {
        const image = this.extractImage(element);
        if (image) {
          images.push(image);
        }
      }

      // Extract videos
      if (element.video) {
        const video = this.extractVideo(element);
        if (video) {
          videos.push(video);
        }
      }

      // Extract charts (embedded from Sheets)
      if (element.sheetsChart) {
        const chart = this.extractChart(element);
        if (chart) {
          charts.push(chart);
        }
      }

      // Extract content from groups (recursive)
      if (element.elementGroup?.children) {
        for (const child of element.elementGroup.children) {
          const childContent = this.extractAllContent({ pageElements: [child] } as slides_v1.Schema$Page);
          textParts.push(childContent.text);
          images.push(...childContent.images);
          videos.push(...childContent.videos);
          charts.push(...childContent.charts);
          shapes.push(...childContent.shapes);
        }
      }
    }

    return {
      text: textParts.filter(t => t.trim()).join("\n\n"),
      images,
      videos,
      charts,
      shapes: [...new Set(shapes)], // Deduplicate shapes
    };
  }

  /**
   * Helper: Extract image data from a page element
   */
  private extractImage(element: slides_v1.Schema$PageElement): SlideImage | null {
    if (!element.image) return null;

    const image = element.image;
    const size = element.size;

    return {
      contentUrl: image.contentUrl || "",
      sourceUrl: image.sourceUrl || undefined,
      description: element.description || undefined,
      width: size?.width?.magnitude ?? undefined,
      height: size?.height?.magnitude ?? undefined,
    };
  }

  /**
   * Helper: Extract video data from a page element
   */
  private extractVideo(element: slides_v1.Schema$PageElement): SlideVideo | null {
    if (!element.video) return null;

    const video = element.video;
    let source: "YOUTUBE" | "DRIVE" | "UNKNOWN" = "UNKNOWN";
    let videoUrl = "";

    if (video.source === "YOUTUBE") {
      source = "YOUTUBE";
      videoUrl = video.id ? `https://www.youtube.com/watch?v=${video.id}` : "";
    } else if (video.source === "DRIVE") {
      source = "DRIVE";
      videoUrl = video.id ? `https://drive.google.com/file/d/${video.id}/view` : "";
    }

    return {
      videoUrl,
      source,
      videoId: video.id || undefined,
    };
  }

  /**
   * Helper: Extract chart data from a page element
   */
  private extractChart(element: slides_v1.Schema$PageElement): SlideChart | null {
    if (!element.sheetsChart) return null;

    const chart = element.sheetsChart;

    return {
      chartId: chart.chartId?.toString() || "",
      spreadsheetId: chart.spreadsheetId || undefined,
      description: element.description || "Embedded chart from Google Sheets",
    };
  }

  /**
   * Helper: Extract speaker notes from a slide
   */
  private extractSpeakerNotes(slide: slides_v1.Schema$Page): string {
    if (!slide.slideProperties?.notesPage?.pageElements) return "";

    for (const element of slide.slideProperties.notesPage.pageElements) {
      if (element.shape?.shapeType === "TEXT_BOX" && element.shape.text?.textElements) {
        const notesText = this.extractTextFromTextElements(element.shape.text.textElements);
        if (notesText.trim()) {
          return notesText.trim();
        }
      }
    }

    return "";
  }

  /**
   * Helper: Extract text from text elements array
   */
  private extractTextFromTextElements(textElements: slides_v1.Schema$TextElement[]): string {
    let text = "";

    for (const element of textElements) {
      if (element.textRun?.content) {
        text += element.textRun.content;
      }
    }

    return text;
  }

  /**
   * Helper: Extract table content as markdown table
   */
  private extractTableAsMarkdown(table: slides_v1.Schema$Table): string {
    if (!table.tableRows || table.tableRows.length === 0) return "";

    const rows: string[][] = [];

    for (const tableRow of table.tableRows) {
      const rowCells: string[] = [];
      if (tableRow.tableCells) {
        for (const cell of tableRow.tableCells) {
          let cellText = "";
          if (cell.text?.textElements) {
            cellText = this.extractTextFromTextElements(cell.text.textElements);
          }
          // Clean up cell text: trim and replace newlines with spaces
          rowCells.push(cellText.trim().replace(/\n/g, " "));
        }
      }
      rows.push(rowCells);
    }

    if (rows.length === 0) return "";

    // Build markdown table
    let markdown = "\n";

    // First row as header
    const headerRow = rows[0];
    markdown += "| " + headerRow.join(" | ") + " |\n";

    // Header separator
    markdown += "| " + headerRow.map(() => "---").join(" | ") + " |\n";

    // Data rows (skip first row since it's the header)
    for (let i = 1; i < rows.length; i++) {
      markdown += "| " + rows[i].join(" | ") + " |\n";
    }

    markdown += "\n";
    return markdown;
  }
}

/**
 * Get presentation URL from ID
 */
export function getPresentationUrl(presentationId: string): string {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}
