import { Hono } from 'hono'
import { config } from './utils/config'
import { startScheduler, sendImmediate } from './services/scheduler'
import { initDiscordClient, sendBookmarksDiscord } from './services/discord'
import { sendBookmarksTelegram } from './services/telegram'
import { getRandomBookmarks } from './api/hoarder'
import { getCachedBookmarks, formatBookmarksRSS, updateRSSCache } from './services/rss'

const app = new Hono()

app.get('/', c => {
  return c.json({
    status: 'ok',
    notification_method: config.NOTIFICATION_METHOD,
    frequency: config.NOTIFICATION_FREQUENCY,
    count: config.BOOKMARKS_COUNT,
    timezone: config.TIMEZONE,
    time_to_send: config.TIME_TO_SEND,
    specific_list: config.SPECIFIC_LIST_ID ? true : false,
    rss_feed_url: config.NOTIFICATION_METHOD === 'rss' ? 'http://localhost:8080/rss/feed' : null
  })
})

// Add endpoint to trigger immediate send (useful for testing)
app.post('/send-now', async c => {
  try {
    await sendImmediate()
    return c.json({
      success: true,
      message: 'Notification sent successfully'
    })
  } catch (error) {
    console.error('Error sending immediate notification:', error)
    return c.json({ success: false, error: 'Failed to send notification' }, 500)
  }
})

// Add endpoint to test email functionality
app.get('/test-email', async c => {
  try {
    if (config.NOTIFICATION_METHOD !== 'email') {
      return c.json(
        {
          success: false,
          error: 'Email is not configured as the notification method'
        },
        400
      )
    }

    // Import email service
    const { sendBookmarksEmail } = await import('./services/email')

    // Create a test bookmark
    const testBookmark = {
      id: 'test-id',
      url: 'https://example.com',
      title: 'Test Email Bookmark',
      description: 'This is a test bookmark to verify email integration',
      tags: ['test', 'email'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Send test email
    await sendBookmarksEmail([testBookmark])

    return c.json({
      success: true,
      message: 'Test email sent successfully',
      recipient: config.EMAIL_RECIPIENT
    })
  } catch (error: any) {
    console.error('Error sending test email:', error)
    return c.json(
      {
        success: false,
        error: `Failed to send test email: ${error.message || 'Unknown error'}`
      },
      500
    )
  }
})

// RSS feed endpoint
app.get('/rss/feed', async c => {
  try {
    const cache = getCachedBookmarks()
    
    let bookmarks: Awaited<ReturnType<typeof getRandomBookmarks>>
    let generatedAt: Date
    
    if (cache) {
      // Serve from cache (populated by scheduler)
      bookmarks = cache.bookmarks
      generatedAt = cache.generatedAt
    } else {
      // No cache yet (first request before scheduler runs) - generate initial feed
      console.log('No RSS cache found, generating initial feed...')
      bookmarks = await getRandomBookmarks(
        config.BOOKMARKS_COUNT,
        config.SPECIFIC_LIST_ID
      )
      generatedAt = new Date()
      // Store in cache so subsequent requests get the same bookmarks
      updateRSSCache(bookmarks)
    }

    // Generate RSS feed from cached bookmarks
    const rssContent = formatBookmarksRSS(bookmarks, generatedAt)

    // Set content type to XML
    c.header('Content-Type', 'application/rss+xml')
    return c.body(rssContent)
  } catch (error: any) {
    console.error('Error generating RSS feed:', error)
    return c.json(
      {
        success: false,
        error: `Failed to generate RSS feed: ${error.message || 'Unknown error'}`
      },
      500
    )
  }
})

// Add endpoint to test Discord bot directly
app.get('/test-discord', async c => {
  try {
    if (config.NOTIFICATION_METHOD !== 'discord') {
      return c.json(
        {
          success: false,
          error: 'Discord is not configured as the notification method'
        },
        400
      )
    }

    // Create a test bookmark
    const testBookmark = {
      id: 'test-id',
      url: 'https://example.com',
      title: 'Test Bookmark',
      description: 'This is a test bookmark to verify Discord integration',
      tags: ['test', 'discord'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Send test message
    await sendBookmarksDiscord([testBookmark])

    return c.json({
      success: true,
      message: 'Test message sent to Discord',
      channel_id: config.DISCORD_CHANNEL_ID
    })
  } catch (error: any) {
    console.error('Error sending test Discord message:', error)
    return c.json(
      {
        success: false,
        error: `Failed to send test message: ${
          error.message || 'Unknown error'
        }`
      },
      500
    )
  }
})

// Add endpoint to test Telegram bot directly
app.get('/test-telegram', async c => {
  try {
    if (config.NOTIFICATION_METHOD !== 'telegram') {
      return c.json(
        {
          success: false,
          error: 'Telegram is not configured as the notification method'
        },
        400
      )
    }

    // Create a test bookmark
    const testBookmark = {
      id: 'test-id',
      url: 'https://example.com',
      title: 'Test Telegram Bookmark',
      description: 'This is a test bookmark to verify Telegram integration',
      tags: ['test', 'telegram'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Send test message
    await sendBookmarksTelegram([testBookmark])

    return c.json({
      success: true,
      message: 'Test message sent to Telegram',
      chat_id: config.TELEGRAM_CHAT_ID
    })
  } catch (error: any) {
    console.error('Error sending test Telegram message:', error)
    return c.json(
      {
        success: false,
        error: `Failed to send test message: ${
          error.message || 'Unknown error'
        }`
      },
      500
    )
  }
})

// Initialize application
async function initApp() {
  console.log('Starting Hoarder Bookmark Sender...')

  // Initialize Discord client if using Discord
  if (config.NOTIFICATION_METHOD === 'discord') {
    await initDiscordClient()
  } else if (config.NOTIFICATION_METHOD === 'rss') {
    console.log('RSS feed is ready!')
    console.log('Feed URL: http://localhost:8080/rss/feed')
  }

  // Start the scheduler
  startScheduler()

  const port = parseInt(process.env.PORT || '8080')
  console.log(`Server starting on port ${port}`)

  // Explicitly start the server
  Bun.serve({
    port: port,
    fetch: app.fetch
  })
}

// Run the app
initApp().catch(console.error)
