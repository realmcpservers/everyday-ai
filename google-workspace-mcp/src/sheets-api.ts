/**
 * Google Sheets API Service
 * Wraps Google Sheets REST API calls
 */

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";

import { logger } from "./logger.js";
import type { GoogleAuth, SpreadsheetInfo, SheetInfo, CellData } from "./types.js";

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets;
  private drive: ReturnType<typeof google.drive>;

  constructor(auth: GoogleAuth) {
    this.sheets = google.sheets({
      version: "v4",
      auth: auth as Parameters<typeof google.sheets>[0]["auth"],
    });
    this.drive = google.drive({
      version: "v3",
      auth: auth as Parameters<typeof google.drive>[0]["auth"],
    });
  }

  /**
   * List recent spreadsheets from Google Drive
   */
  async listSpreadsheets(maxResults: number = 10): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    try {
      logger.debug(`Listing spreadsheets (max: ${maxResults})`);

      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
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
      throw new Error(`Failed to list spreadsheets: ${message}`);
    }
  }

  /**
   * Search spreadsheets by name
   */
  async searchSpreadsheets(
    query: string,
    maxResults: number = 10
  ): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    try {
      logger.debug(`Searching spreadsheets: ${query}`);

      const response = await this.drive.files.list({
        q: `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${query.replace(/'/g, "\\'")}'`,
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
      throw new Error(`Failed to search spreadsheets: ${message}`);
    }
  }

  /**
   * Get spreadsheet metadata and sheet list
   */
  async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetInfo> {
    try {
      logger.debug(`Getting spreadsheet: ${spreadsheetId}`);

      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: "spreadsheetId,properties.title,spreadsheetUrl,sheets.properties",
      });

      const data = response.data;
      const sheets: SheetInfo[] = (data.sheets || []).map((sheet) => ({
        sheetId: sheet.properties?.sheetId || 0,
        title: sheet.properties?.title || "Untitled",
        index: sheet.properties?.index || 0,
        rowCount: sheet.properties?.gridProperties?.rowCount || 0,
        columnCount: sheet.properties?.gridProperties?.columnCount || 0,
      }));

      return {
        spreadsheetId: data.spreadsheetId || spreadsheetId,
        title: data.properties?.title || "Untitled",
        sheets,
        spreadsheetUrl: data.spreadsheetUrl || getSpreadsheetUrl(spreadsheetId),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get spreadsheet: ${message}`);
    }
  }

  /**
   * Read cell values from a range
   */
  async getSheetData(spreadsheetId: string, range: string): Promise<CellData> {
    try {
      logger.debug(`Getting sheet data: ${spreadsheetId} range ${range}`);

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: "FORMATTED_VALUE",
      const values = (response.data.values || []).map((row) =>
        row.map((cell) => {
          if (cell === null || cell === undefined) return null;
          return String(cell);
        })
      );

      return {
        range: response.data.range || range,
        values,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get sheet data: ${message}`);
    }
  }

  /**
   * Update cell values in a range
   */
  async updateCells(spreadsheetId: string, range: string, values: string[][]): Promise<{ updatedCells: number; updatedRange: string }> {
    try {
      logger.debug(`Updating cells: ${spreadsheetId} range ${range}`);

      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values,
        },
      });

      logger.info(`Updated ${response.data.updatedCells} cells in ${spreadsheetId}`);
      return {
        updatedCells: response.data.updatedCells || 0,
        updatedRange: response.data.updatedRange || range,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update cells: ${message}`);
    }
  }

  /**
   * Append rows to a sheet
   */
  async appendRows(spreadsheetId: string, range: string, values: string[][]): Promise<{ updatedCells: number; updatedRange: string }> {
    try {
      logger.debug(`Appending rows: ${spreadsheetId} range ${range}`);

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values,
        },
      });

      logger.info(`Appended ${values.length} rows to ${spreadsheetId}`);
      return {
        updatedCells: response.data.updates?.updatedCells || 0,
        updatedRange: response.data.updates?.updatedRange || range,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to append rows: ${message}`);
    }
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(title: string): Promise<SpreadsheetInfo> {
    try {
      logger.debug(`Creating spreadsheet: ${title}`);

      const response = await this.sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title,
          },
        },
      });

      const data = response.data;
      const sheets: SheetInfo[] = (data.sheets || []).map((sheet) => ({
        sheetId: sheet.properties?.sheetId || 0,
        title: sheet.properties?.title || "Sheet1",
        index: sheet.properties?.index || 0,
        rowCount: sheet.properties?.gridProperties?.rowCount || 1000,
        columnCount: sheet.properties?.gridProperties?.columnCount || 26,
      }));

      logger.info(`Spreadsheet created: ${data.spreadsheetId}`);
      return {
        spreadsheetId: data.spreadsheetId || "",
        title: data.properties?.title || title,
        sheets,
        spreadsheetUrl: data.spreadsheetUrl || getSpreadsheetUrl(data.spreadsheetId || ""),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create spreadsheet: ${message}`);
    }
  }
}

/**
 * Get spreadsheet URL from ID
 */
export function getSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
