import { Feed } from 'feed'
import type { Bookmark } from '../api/types'

// Cache for RSS feed - stores bookmarks selected at scheduled time
interface RSSCache {
  bookmarks: Bookmark[]
  generatedAt: Date
}

let rssCache: RSSCache | null = null

// Update the RSS cache with new bookmarks (called by scheduler)
export function updateRSSCache(bookmarks: Bookmark[]): void {
  rssCache = {
    bookmarks,
    generatedAt: new Date()
  }
  console.log(`RSS cache updated with ${bookmarks.length} bookmarks at ${rssCache.generatedAt.toISOString()}`)
}

// Get cached bookmarks for RSS feed
export function getCachedBookmarks(): RSSCache | null {
  return rssCache
}

// Format bookmarks into RSS feed
export function formatBookmarksRSS(bookmarks: Bookmark[], generatedAt?: Date): string {
  const feed = new Feed({
    title: "Hoarder Random RSS",
    description: "Your random bookmarks from Hoarder",
    id: "hoarder-random-bookmarks",
    link: "http://localhost:8080/rss/feed",
    updated: new Date(),
    copyright: "",
    generator: "Hoarder Random Bookmark Sender",
    feedLinks: {
      rss2: "http://localhost:8080/rss/feed"
    },
    author: {
      name: "Hoarder Random Bookmark Sender"
    }
  })

  if (bookmarks.length === 0) {
    feed.addItem({
      title: "No Bookmarks Available",
      id: "no-bookmarks",
      link: "http://localhost:8080",
      description: "No bookmarks found. Please check your Hoarder API configuration.",
      date: new Date()
    })
  } else {
    bookmarks.forEach((bookmark) => {
      const title = bookmark.title || 'Untitled Bookmark'
      const url = bookmark.url || 'No URL'
      
      // Create description with tags if present
      let description = bookmark.description || ''
      if (bookmark.tags && bookmark.tags.length > 0) {
        description += `\n\nTags: ${bookmark.tags.join(', ')}`
      }

      feed.addItem({
        title: title,
        id: bookmark.id,
        link: url,
        description: description,
        date: generatedAt || new Date(bookmark.created_at)
      })
    })
  }

  return feed.rss2()
}

// Generate RSS feed with bookmarks
export async function generateBookmarksRSS(bookmarks: Bookmark[]): Promise<string> {
  try {
    console.log('Generating RSS feed...')
    const rssContent = formatBookmarksRSS(bookmarks)
    console.log('RSS feed generated successfully')
    return rssContent
  } catch (error) {
    console.error('Error generating RSS feed:', error)
    throw error
  }
}
