import { config } from "../utils/config";
import { createHoarderClient } from "@hoarderapp/sdk";
import type { Bookmark, List, SdkBookmark, SdkList } from "./types";

const client = createHoarderClient({
  baseUrl: `${config.HOARDER_SERVER_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
    authorization: `Bearer ${config.HOARDER_API_KEY}`,
  },
});

// Helper function to transform SDK bookmark to our simplified Bookmark type
function transformBookmark(bookmark: SdkBookmark): Bookmark {
  const content = bookmark.content || {};

  let url = "";
  if (content && "url" in content) {
    url = content.url || "";
  }

  const title =
    (content && "title" in content ? content.title : null) ||
    bookmark.title ||
    "Untitled Bookmark";

  const description =
    (content && "description" in content ? content.description : null) ||
    bookmark.summary ||
    bookmark.note ||
    "";

  const tags = bookmark.tags
    ? bookmark.tags.map((tag: { name: string }) => tag.name)
    : [];

  return {
    id: bookmark.id,
    url,
    title,
    description,
    tags,
    created_at: bookmark.createdAt,
    updated_at: bookmark.modifiedAt || "",
  };
}

// Helper function to transform SDK list to a simplified List type
function transformList(list: SdkList): List {
  return {
    id: list.id,
    name: list.name,
    description: list.description || "",
    created_at: list.createdAt,
    updated_at: list.modifiedAt || "",
  };
}

export async function getAllBookmarks(): Promise<Bookmark[]> {
  try {
    const path = "/bookmarks" as any;
    let allBookmarks: SdkBookmark[] = [];
    let cursor: string | undefined = undefined;

    // Fetch all pages using cursor pagination
    do {
      const result: any = await client.GET(path, {
        params: {
          query: {
            cursor,
            limit: 100,
            ...(config.ONLY_UNARCHIVED ? { archived: false } : {}),
          },
        },
      });
      const { data, error }: { data: any; error: any } = result;
      if (error) throw error;

      let sdkBookmarks: SdkBookmark[] = [];
      if (Array.isArray(data)) {
        sdkBookmarks = data as SdkBookmark[];
        cursor = undefined;
      } else if (data && "bookmarks" in data && Array.isArray(data.bookmarks)) {
        sdkBookmarks = data.bookmarks as SdkBookmark[];
        cursor = data.nextCursor ?? undefined;
      } else if (data) {
        sdkBookmarks = [data as SdkBookmark];
        cursor = undefined;
      }

      allBookmarks = allBookmarks.concat(sdkBookmarks);
    } while (cursor);

    console.log(`Fetched ${allBookmarks.length} total bookmarks`);
    return allBookmarks.map(transformBookmark);
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    throw error;
  }
}

// Get all lists
export async function getAllLists(): Promise<List[]> {
  try {
    // Use type assertion to bypass TypeScript path checking
    const path = "/lists" as any;
    const result = await client.GET(path, { params: {} });
    const { data, error } = result;
    if (error) throw error;

    // The API returns lists directly or in a lists array
    let sdkLists: SdkList[] = [];
    if (Array.isArray(data)) {
      sdkLists = data as SdkList[];
    } else if (data && "lists" in data && Array.isArray(data.lists)) {
      sdkLists = data.lists as SdkList[];
    } else if (data) {
      sdkLists = [data as SdkList];
    }

    return sdkLists.map(transformList);
  } catch (error) {
    console.error("Error fetching lists:", error);
    throw error;
  }
}

// Get a single list by ID
export async function getList(listId: string): Promise<List> {
  try {
    // Use type assertion to bypass TypeScript path checking
    const path = `/lists/${listId}` as any;
    const result = await client.GET(path, { params: {} });
    const { data, error } = result;
    if (error) throw error;

    if (!data) throw new Error("List not found");
    return transformList(data as SdkList);
  } catch (error) {
    console.error("Error fetching list:", error);
    throw error;
  }
}

// Get bookmarks in a specific list
export async function getBookmarksInList(listId: string): Promise<Bookmark[]> {
  try {
    const path = `/lists/${listId}/bookmarks` as any;
    let allBookmarks: SdkBookmark[] = [];
    let cursor: string | undefined = undefined;

    // Fetch all pages using cursor pagination
    do {
      const result: any = await client.GET(path, {
        params: {
          query: {
            cursor,
            limit: 100,
          },
        },
      });
      const { data, error }: { data: any; error: any } = result;
      if (error) throw error;

      let sdkBookmarks: SdkBookmark[] = [];
      if (Array.isArray(data)) {
        sdkBookmarks = data as SdkBookmark[];
        cursor = undefined;
      } else if (data && "bookmarks" in data && Array.isArray(data.bookmarks)) {
        sdkBookmarks = data.bookmarks as SdkBookmark[];
        cursor = data.nextCursor ?? undefined;
      } else if (data) {
        sdkBookmarks = [data as SdkBookmark];
        cursor = undefined;
      }

      allBookmarks = allBookmarks.concat(sdkBookmarks);
    } while (cursor);

    // Filter out archived bookmarks if ONLY_UNARCHIVED is enabled
    if (config.ONLY_UNARCHIVED) {
      allBookmarks = allBookmarks.filter((bookmark) => !bookmark.archived);
    }

    console.log(`Fetched ${allBookmarks.length} bookmarks from list ${listId}`);
    return allBookmarks.map(transformBookmark);
  } catch (error) {
    console.error("Error fetching bookmarks in list:", error);
    throw error;
  }
}

// Get random bookmarks (either from all bookmarks or a specific list)
export async function getRandomBookmarks(
  count: number,
  listId?: string
): Promise<Bookmark[]> {
  try {
    const bookmarks = listId
      ? await getBookmarksInList(listId)
      : await getAllBookmarks();

    // Shuffle the array using Fisher-Yates algorithm
    for (let i = bookmarks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bookmarks[i], bookmarks[j]] = [bookmarks[j], bookmarks[i]];
    }

    // Return the requested number of bookmarks
    return bookmarks.slice(0, count);
  } catch (error) {
    console.error("Error getting random bookmarks:", error);
    throw error;
  }
}
