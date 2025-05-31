export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end()
    return
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { message } = req.body

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" })
    }

    // Validate message length
    if (message.length > 500) {
      return res.status(400).json({ error: "Message too long" })
    }

    // Get API key from environment variables (server-side only)
    const API_KEY = process.env.GEMINI_API_KEY

    // Enhanced fallback responses with more variety
    const fallbackResponse = getEnhancedFallbackResponse(message)

    if (!API_KEY) {
      console.log("No API key found, using enhanced fallback response")
      return res.status(200).json({
        response: fallbackResponse,
        source: "fallback",
      })
    }

    // System prompt for HelpHood context
    const SYSTEM_PROMPT = `You are a helpful assistant for HelpHood, a community platform that helps neighbors connect and collaborate. 

HelpHood features include:
- Community Events: Plan local events like cleanups, festivals, and meetups
- Help Exchange: Offer or request help for tasks like tutoring, repairs, or childcare
- Safety Alerts: Get verified alerts about neighborhood safety issues
- Local Marketplace: Buy, sell, or trade items with verified neighbors
- Civic Feedback: Report issues to local authorities and track progress
- Interactive Map: View and report local incidents using emojis

Keep responses helpful, concise (under 150 words), and focused on community building. Always maintain a friendly, supportive tone that encourages neighborhood collaboration.`

    // Call Gemini API with timeout and retry logic
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const apiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${SYSTEM_PROMPT}\n\nUser question: ${message}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 200,
              topP: 0.8,
              topK: 40,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
            ],
          }),
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text()
        console.error(`Gemini API error: ${apiResponse.status} - ${errorText}`)
        throw new Error(`API request failed: ${apiResponse.status}`)
      }

      const data = await apiResponse.json()

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const response = data.candidates[0].content.parts[0].text
        return res.status(200).json({
          response,
          source: "ai",
        })
      } else {
        console.error("Invalid API response format:", data)
        throw new Error("Invalid API response format")
      }
    } catch (apiError) {
      clearTimeout(timeoutId)
      console.error("Gemini API error:", apiError.message)

      // Return enhanced fallback on API error
      return res.status(200).json({
        response: fallbackResponse,
        source: "fallback",
      })
    }
  } catch (error) {
    console.error("Error processing chat request:", error)

    // Return fallback response on any error
    const fallbackResponse = getEnhancedFallbackResponse(req.body?.message || "")
    return res.status(200).json({
      response: fallbackResponse,
      source: "fallback",
    })
  }
}

// Enhanced fallback responses with more variety and context
function getEnhancedFallbackResponse(message) {
  const lowerMessage = message.toLowerCase()

  // Greeting responses
  if (
    lowerMessage.includes("hello") ||
    lowerMessage.includes("hi") ||
    lowerMessage.includes("hey") ||
    lowerMessage.includes("good")
  ) {
    const greetings = [
      "Hello! I'm your HelpHood assistant. I can help you learn about our community features like events, safety alerts, marketplace, and more. What would you like to know?",
      "Hi there! Welcome to HelpHood! I'm here to help you discover how our platform can strengthen your neighborhood. What interests you most?",
      "Hey! Great to see you here. HelpHood has amazing tools for community building. Would you like to learn about events, safety features, or our marketplace?",
    ]
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  // Event-related responses
  if (
    lowerMessage.includes("event") ||
    lowerMessage.includes("calendar") ||
    lowerMessage.includes("party") ||
    lowerMessage.includes("meetup") ||
    lowerMessage.includes("organize")
  ) {
    const eventResponses = [
      "HelpHood's Community Events feature makes organizing neighborhood activities super easy! You can plan cleanups, festivals, block parties, and meetups. The platform handles RSVPs, reminders, and even helps you find volunteers. Want to know how to create your first event?",
      "Planning community events is one of HelpHood's most popular features! From small coffee meetups to large festivals, you can organize everything in one place. The system sends automatic reminders and tracks attendance. What kind of event are you thinking about?",
      "Community Events on HelpHood bring neighbors together! You can schedule anything from book clubs to neighborhood cleanups. The platform makes it easy to manage invitations, track RSVPs, and coordinate with volunteers. Ready to start planning?",
    ]
    return eventResponses[Math.floor(Math.random() * eventResponses.length)]
  }

  // Safety-related responses
  if (
    lowerMessage.includes("safety") ||
    lowerMessage.includes("alert") ||
    lowerMessage.includes("security") ||
    lowerMessage.includes("emergency") ||
    lowerMessage.includes("crime")
  ) {
    const safetyResponses = [
      "HelpHood's Safety Alerts keep your neighborhood informed and secure! You can receive instant notifications about emergencies, suspicious activity, or weather warnings. All alerts are verified to prevent false alarms. You can also create alerts to help keep your community safe.",
      "Safety is our top priority! Our alert system sends real-time notifications about neighborhood security issues, weather emergencies, and important updates. You can customize which alerts you receive and even report incidents yourself. Your community's safety network is stronger together!",
      "Our Safety Alert feature creates a protective network for your neighborhood. Get verified alerts about crime, emergencies, or suspicious activity. You can also contribute by reporting incidents you witness. It's like having a neighborhood watch that never sleeps!",
    ]
    return safetyResponses[Math.floor(Math.random() * safetyResponses.length)]
  }

  // Marketplace responses
  if (
    lowerMessage.includes("marketplace") ||
    lowerMessage.includes("sell") ||
    lowerMessage.includes("buy") ||
    lowerMessage.includes("trade") ||
    lowerMessage.includes("shop") ||
    lowerMessage.includes("local business")
  ) {
    const marketplaceResponses = [
      "The HelpHood Marketplace connects you with verified neighbors for safe local trading! Buy, sell, or donate items while supporting your local economy. All users are verified for security, and you can see ratings and reviews. It's like having a trusted neighborhood garage sale 24/7!",
      "Our Local Marketplace makes neighborhood commerce safe and easy! Whether you're selling furniture, buying fresh produce, or donating clothes, you're dealing with verified neighbors. The platform includes secure messaging, ratings, and even helps coordinate pickup times.",
      "Love supporting local? Our Marketplace feature lets you trade with verified neighbors safely. From handmade crafts to household items, you can buy, sell, or donate while building community connections. Plus, all transactions stay within your neighborhood!",
    ]
    return marketplaceResponses[Math.floor(Math.random() * marketplaceResponses.length)]
  }

  // Civic feedback responses
  if (
    lowerMessage.includes("feedback") ||
    lowerMessage.includes("report") ||
    lowerMessage.includes("civic") ||
    lowerMessage.includes("government") ||
    lowerMessage.includes("city") ||
    lowerMessage.includes("pothole") ||
    lowerMessage.includes("streetlight")
  ) {
    const civicResponses = [
      "HelpHood's Civic Feedback tool gives your neighborhood a direct line to local authorities! Report potholes, broken streetlights, garbage issues, or suggest improvements. You can track the progress of your reports and see what your neighbors are reporting too. Your voice matters in local government!",
      "Make your voice heard with our Civic Feedback feature! Report neighborhood issues directly to city officials, track progress on repairs, and vote on community priorities. It's democracy in action, making it easy to improve your local area one report at a time.",
      "Our Civic Feedback system empowers residents to drive real change! Whether it's reporting infrastructure problems or suggesting park improvements, you can communicate directly with local authorities. The platform tracks all reports and shows you the impact your community is making.",
    ]
    return civicResponses[Math.floor(Math.random() * civicResponses.length)]
  }

  // Help exchange responses
  if (
    lowerMessage.includes("help") ||
    lowerMessage.includes("exchange") ||
    lowerMessage.includes("volunteer") ||
    lowerMessage.includes("assist") ||
    lowerMessage.includes("neighbor") ||
    lowerMessage.includes("support")
  ) {
    const helpResponses = [
      "Help Exchange is where neighbors become heroes! Whether you need tutoring, home repairs, childcare, or pet sitting, you can connect with skilled neighbors. You can also offer your own talents to help others. It's a beautiful cycle of community support!",
      "Our Help Exchange feature builds the supportive community we all want to live in! Offer your skills in cooking, gardening, tech support, or anything else, and find neighbors who can help you too. All users are verified, and the rating system ensures quality connections.",
      "The Help Exchange creates a network of mutual support in your neighborhood! From emergency babysitting to moving help, neighbors helping neighbors makes everything easier. You can browse available help or post what you need. Community support has never been this organized!",
    ]
    return helpResponses[Math.floor(Math.random() * helpResponses.length)]
  }

  // Map responses
  if (
    lowerMessage.includes("map") ||
    lowerMessage.includes("location") ||
    lowerMessage.includes("navigate") ||
    lowerMessage.includes("emoji") ||
    lowerMessage.includes("incident")
  ) {
    const mapResponses = [
      "Our Interactive Neighborhood Map is like a real-time community bulletin board! Click anywhere to report incidents, see what's happening nearby, and stay informed about local events. The emoji-based reporting system makes it fun and easy to keep everyone updated.",
      "The HelpHood Map brings your neighborhood to life! See real-time reports from neighbors, find local events, and report incidents using our fun emoji system. It's your neighborhood's pulse, showing everything from lost pets to block parties.",
      "Navigate your community like never before with our Interactive Map! Report and view local incidents, find nearby events, and see what your neighbors are sharing. The visual, emoji-based system makes community awareness engaging and informative.",
    ]
    return mapResponses[Math.floor(Math.random() * mapResponses.length)]
  }

  // Getting started responses
  if (
    lowerMessage.includes("how") ||
    lowerMessage.includes("start") ||
    lowerMessage.includes("begin") ||
    lowerMessage.includes("sign up") ||
    lowerMessage.includes("join") ||
    lowerMessage.includes("create account")
  ) {
    const startResponses = [
      "Getting started with HelpHood is super easy! 1) Create your verified profile with basic info, 2) Explore features like events and marketplace, 3) Start connecting with neighbors and building your community. Which feature would you like to try first?",
      "Welcome to the HelpHood family! Starting is simple: sign up with verification, browse your neighborhood's current activities, and jump in wherever interests you most. Whether it's joining an event or offering help, every interaction strengthens your community!",
      "Ready to transform your neighborhood? Here's how: 1) Set up your verified profile, 2) Explore what neighbors are already doing, 3) Start participating in events, marketplace, or help exchange. Your community journey begins with a single connection!",
    ]
    return startResponses[Math.floor(Math.random() * startResponses.length)]
  }

  // Features overview responses
  if (
    lowerMessage.includes("feature") ||
    lowerMessage.includes("what can") ||
    lowerMessage.includes("what does") ||
    lowerMessage.includes("overview")
  ) {
    const featureResponses = [
      "HelpHood offers six main features to strengthen your community: 🗓️ Community Events for organizing gatherings, 🚨 Safety Alerts for neighborhood security, 🛒 Local Marketplace for trading with neighbors, 🏛️ Civic Feedback for reporting issues, 🤝 Help Exchange for mutual support, and 🗺️ Interactive Map for real-time updates!",
      "Our platform has everything your neighborhood needs! Plan events, stay safe with alerts, trade locally in our marketplace, report civic issues, exchange help with neighbors, and use our interactive map to stay connected. Which feature sounds most interesting to you?",
    ]
    return featureResponses[Math.floor(Math.random() * featureResponses.length)]
  }

  // Default responses with variety
  const defaultResponses = [
    "I'm here to help you navigate HelpHood's amazing community features! You can ask me about community events, safety alerts, our local marketplace, civic feedback, help exchange, or our interactive map. What would you like to explore first?",
    "HelpHood has so many ways to strengthen your neighborhood! I can tell you about organizing events, staying safe with alerts, trading in our marketplace, reporting civic issues, exchanging help with neighbors, or using our interactive map. What interests you most?",
    "Welcome to HelpHood! I'm excited to help you discover how our platform can transform your neighborhood. Whether you're interested in events, safety, commerce, civic engagement, or community support, I've got answers. What would you like to know?",
    "There's so much to explore on HelpHood! From planning community events to staying safe with alerts, from local trading to civic engagement, our platform has everything your neighborhood needs. What feature would you like to learn about?",
  ]

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)]
}
