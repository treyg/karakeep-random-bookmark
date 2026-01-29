import cron from 'node-cron'
import { config } from '../utils/config'
import { getRandomBookmarks } from '../api/hoarder'
import { sendBookmarksEmail } from './email'
import { sendBookmarksDiscord } from './discord'
import { sendBookmarksMattermost } from './mattermost'
import { sendBookmarksTelegram } from './telegram'
import { updateRSSCache } from './rss'

// Function to convert time string (HH:MM) to cron time format (MM HH)
function timeToCron(timeString: string): { minute: string; hour: string } {
  // Default to 9:00 AM if format is invalid
  const defaultTime = { minute: '0', hour: '9' }

  // Validate time format (HH:MM in 24-hour format)
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/
  const match = timeString.match(timeRegex)

  if (!match) {
    console.warn(`Invalid time format: ${timeString}, using default 09:00`)
    return defaultTime
  }

  return {
    minute: match[2],
    hour: match[1].padStart(2, '0')
  }
}

// Get time components from config
const { minute, hour } = timeToCron(config.TIME_TO_SEND)

// Define cron expressions for different frequencies
const cronExpressions = {
  daily: `${minute} ${hour} * * *`, // Every day at configured time
  weekly: `${minute} ${hour} * * 1`, // Every Monday at configured time
  monthly: `${minute} ${hour} 1 * *` // First day of every month at configured time
}

// Send notifications with bookmarks
async function sendNotification() {
  try {
    console.log('=== STARTING BOOKMARK NOTIFICATION PROCESS ===')
    console.log('Preparing to send bookmarks notification...')
    console.log(`Using notification method: ${config.NOTIFICATION_METHOD}`)
    console.log(
      `Requesting ${config.BOOKMARKS_COUNT} random bookmarks${
        config.SPECIFIC_LIST_ID ? ` from list ${config.SPECIFIC_LIST_ID}` : ''
      }`
    )

    // Get random bookmarks based on configuration
    const bookmarks = await getRandomBookmarks(
      config.BOOKMARKS_COUNT,
      config.SPECIFIC_LIST_ID
    )

    console.log(`Retrieved ${bookmarks.length} bookmarks`)

    if (bookmarks.length === 0) {
      console.log('No bookmarks available to send')
      return
    }

    // Log bookmark details
    bookmarks.forEach((bookmark, index) => {
      console.log(`Bookmark ${index + 1}:`, {
        id: bookmark.id,
        title: bookmark.title || 'Untitled',
        url: bookmark.url || 'No URL',
        tags: bookmark.tags || [],
      })
    })

    // Send notifications based on configured method
    if (config.NOTIFICATION_METHOD === 'email') {
      console.log('Sending bookmarks via email...')
      await sendBookmarksEmail(bookmarks)
    } else if (config.NOTIFICATION_METHOD === 'discord') {
      console.log('Sending bookmarks via Discord...')
      await sendBookmarksDiscord(bookmarks)
    } else if (config.NOTIFICATION_METHOD === 'mattermost') {
      console.log('Sending bookmarks via Mattermost...')
      await sendBookmarksMattermost(bookmarks)
    } else if (config.NOTIFICATION_METHOD === 'telegram') {
      console.log('Sending bookmarks via Telegram...')
      await sendBookmarksTelegram(bookmarks)
    } else if (config.NOTIFICATION_METHOD === 'rss') {
      console.log('Updating RSS feed cache with new bookmarks...')
      updateRSSCache(bookmarks)
      console.log(
        'RSS feed cache updated successfully - available at http://localhost:8080/rss/feed'
      )
    }

    console.log(
      `Successfully sent ${bookmarks.length} bookmarks via ${config.NOTIFICATION_METHOD}`
    )
    console.log('=== BOOKMARK NOTIFICATION PROCESS COMPLETED ===')
  } catch (error) {
    console.error('=== ERROR IN BOOKMARK NOTIFICATION PROCESS ===')
    console.error('Error sending notification:', error)
    console.error(
      'Stack trace:',
      error instanceof Error ? error.stack : 'No stack trace available'
    )
    console.error('=== END OF ERROR REPORT ===')
  }
}

// Start the scheduler
export function startScheduler() {
  const cronExpression = cronExpressions[config.NOTIFICATION_FREQUENCY]

  if (!cronExpression) {
    throw new Error(
      `Invalid notification frequency: ${config.NOTIFICATION_FREQUENCY}`
    )
  }

  console.log(
    `Scheduler started with ${config.NOTIFICATION_FREQUENCY} frequency (${cronExpression})`
  )

  // Schedule the job using node-cron with timezone
  cron.schedule(cronExpression, sendNotification, {
    timezone: config.TIMEZONE
  })

  console.log(`Using timezone: ${config.TIMEZONE}`)
  console.log(`Scheduled to run at: ${config.TIME_TO_SEND} (${hour}:${minute})`)
}

// Trigger an immediate send (for testing)
export async function sendImmediate() {
  console.log('Triggering immediate notification send')
  await sendNotification()
}
