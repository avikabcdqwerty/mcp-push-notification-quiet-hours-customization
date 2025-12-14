import axios, { AxiosResponse } from "axios";

/**
 * QuietHourPeriod represents a quiet hour period as returned by the backend.
 */
export interface QuietHourPeriod {
  id: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  createdAt: string;
  updatedAt: string;
}

/**
 * QuietHourInput represents the input required to create or update a quiet hour period.
 */
export interface QuietHourInput {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

// Base API URL for quiet hours endpoints
const API_BASE_URL = "/api/quiet-hours";

/**
 * Fetch all quiet hour periods for the authenticated user.
 * @returns Promise resolving to an array of QuietHourPeriod
 * @throws Error if the request fails
 */
export async function getQuietHours(): Promise<QuietHourPeriod[]> {
  try {
    const response: AxiosResponse<QuietHourPeriod[]> = await axios.get(API_BASE_URL, {
      withCredentials: true,
    });
    return response.data;
  } catch (error: any) {
    // Optionally log error here
    throw error;
  }
}

/**
 * Create a new quiet hour period for the authenticated user.
 * @param input QuietHourInput object containing startTime and endTime
 * @returns Promise resolving to the created QuietHourPeriod
 * @throws Error if the request fails or validation error occurs
 */
export async function createQuietHour(
  input: QuietHourInput
): Promise<QuietHourPeriod> {
  try {
    const response: AxiosResponse<QuietHourPeriod> = await axios.post(
      API_BASE_URL,
      input,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    // Optionally log error here
    throw error;
  }
}

/**
 * Update an existing quiet hour period.
 * @param id The ID of the quiet hour period to update
 * @param input QuietHourInput object containing updated startTime and endTime
 * @returns Promise resolving to the updated QuietHourPeriod
 * @throws Error if the request fails or validation error occurs
 */
export async function updateQuietHour(
  id: string,
  input: QuietHourInput
): Promise<QuietHourPeriod> {
  try {
    const response: AxiosResponse<QuietHourPeriod> = await axios.put(
      `${API_BASE_URL}/${encodeURIComponent(id)}`,
      input,
      { withCredentials: true }
    );
    return response.data;
  } catch (error: any) {
    // Optionally log error here
    throw error;
  }
}

/**
 * Delete a quiet hour period.
 * @param id The ID of the quiet hour period to delete
 * @returns Promise resolving to void
 * @throws Error if the request fails
 */
export async function deleteQuietHour(id: string): Promise<void> {
  try {
    await axios.delete(`${API_BASE_URL}/${encodeURIComponent(id)}`, {
      withCredentials: true,
    });
  } catch (error: any) {
    // Optionally log error here
    throw error;
  }
}