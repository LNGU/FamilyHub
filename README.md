# FamilyHub 🏠

A modern family calendar and AI assistant PWA built with Next.js. FamilyHub helps families coordinate schedules, find travel opportunities, and stay informed with weather and traffic updates.

## ✨ Features

### 📅 Smart Calendar Management
- **Family-wide calendar** with color-coded events per family member
- **Generic events** that apply to everyone (no member assignment required)
- **Custom event types** with personalized colors and icons
- **School calendar sync** via URL scraping (websites and PDF files)
- **Flight restriction tracking** to mark dates when family members can't travel
- **Time support** - events can have optional start/end times

### 🤖 AI Assistant
- **Bilingual support** (English & Korean) - responds in your language with formal Korean (존댓말)
- **Voice input/output** with speech recognition and synthesis
- **Natural language commands** for calendar management
- **Smart travel suggestions** - finds dates when everyone is available
- **Bulk import** flight restrictions via voice or text
- **Time-aware** - knows current time and timezone
- **User-aware** - identifies signed-in user for personalized responses

### 📱 Mobile-First PWA
- **Installable PWA** - add to home screen on iOS/Android
- **Touch-friendly** slide-up chat panel (bottom sheet)
- **Large floating action button** for easy chat access
- **Voice input** with tap-to-speak button
- **Auto voice response** when using speech input

### 🌅 Morning & Evening Briefings
- **Persistent buttons** in chat for quick access to briefings
- **Morning briefing** includes:
  - Weather for all family locations
  - Sunrise/sunset times
  - Traffic from home to work/school
  - Today's calendar events
- **Evening briefing** includes:
  - Real-time traffic from work to home
  - Traffic from other locations (e.g., church) to home
  - Tomorrow's schedule preview
- **Voice-enabled** - briefings are read aloud

### 📍 Location Management
- **Multiple saved locations** with custom emojis
- **Auto-geocoding** - automatically converts addresses to coordinates
- **Weather lookup** by city/address (auto-extracts city from full addresses)
- **Traffic routing** between any configured locations using real-time data
- **Smart shortcuts** - emoji buttons learn from your queries

### 🎯 Smart Query Shortcuts
- **Learns from usage** - most-used queries become emoji shortcuts
- **Dynamic generation** based on your actual questions
- **Persisted** - shortcuts survive app restarts
- **One-tap access** to weather, commute, time, and custom queries

### 💾 Cloud Storage
- **Redis-backed persistence** - data syncs across devices
- **LocalStorage backup** for offline access
- **Automatic sync** on every change

### 🔐 Multi-User Support
- **Google OAuth** authentication
- **Email allowlist** to restrict access to family members
- **User identification** - AI knows who is asking and personalizes responses

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Redis instance (e.g., [Upstash](https://upstash.com/) - free tier available)
- API keys (see below)

### Installation

```bash
# Clone the repository
git clone https://github.com/LNGU/FamilyHub.git
cd FamilyHub

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Required API Keys

| Service | Purpose | Get it from |
|---------|---------|-------------|
| **Azure OpenAI** | AI chat assistant | [Azure Portal](https://portal.azure.com/) - Create OpenAI resource |
| **OpenWeather** | Weather data & forecasts | [OpenWeatherMap](https://openweathermap.org/api) - Free tier available |
| **Google Maps** | Traffic routing | [Google Cloud Console](https://console.cloud.google.com/) - Enable Routes API |
| **Google Geocoding** | Address to coordinates | [Google Cloud Console](https://console.cloud.google.com/) - Enable Geocoding API |
| **Redis** | Cloud data storage | [Upstash](https://upstash.com/) - Free tier available |
| **Google OAuth** | User authentication | [Google Cloud Console](https://console.cloud.google.com/) - OAuth credentials |

### Environment Variables

Create a `.env` file with the following:

```env
# AI Provider (Azure OpenAI)
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini  # or your deployment name

# Weather API
OPENWEATHER_API_KEY=your_openweather_api_key

# Google APIs
GOOGLE_MAPS_API_KEY=your_google_maps_api_key        # For traffic routing
GOOGLE_GEOCODING_API_KEY=your_geocoding_api_key    # For address lookup (can be same as Maps key)

# Storage (Redis)
REDIS_URL=rediss://default:password@your-redis.upstash.io:6379

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_random_secret_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com  # Comma-separated list of allowed emails
```

### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - **Routes API** (for traffic data)
   - **Geocoding API** (for address lookup)
4. Create API credentials:
   - Go to "APIs & Services" → "Credentials"
   - Create an API key for Maps/Geocoding
   - Create OAuth 2.0 credentials for authentication
5. Configure OAuth consent screen and add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)

### Running the App

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 How to Use

### Adding Family Members
1. Click the **⚙️ Settings** icon
2. Add family members with their name and color
3. Optionally add school calendar URLs for automatic sync

### Managing Events
1. Click any date on the calendar or use the **+ Add Event** button
2. Fill in the title, dates, and optionally assign a family member
3. Choose an event type or leave as "None"
4. Events without a member apply to everyone

### Using the AI Assistant
Type or speak commands like:
- "Show me available travel dates for spring break"
- "Add a flight restriction for John from March 1 to 5"
- "What's the weather like today?"
- "How's the traffic to work?"
- "일정 추가해줘" (Add an event - Korean)

### Morning & Evening Briefings
- Click the **🌅 Morning** or **🌙 Evening** buttons in the chat panel
- **Morning briefing**: Weather for all locations, traffic to work, today's events
- **Evening briefing**: Traffic from work/other locations to home, tomorrow's preview
- Briefings are read aloud automatically

### Managing Locations
1. Click the **Settings** icon → **Locations** tab
2. Add locations with name, address, and emoji
3. Click **"Lookup missing coordinates"** to auto-geocode addresses
4. Locations with coordinates enable accurate traffic routing

### Quick Action Shortcuts
- **Emoji buttons** appear based on your query history
- Most-used queries automatically become one-tap shortcuts
- Tap any location emoji for instant weather/commute info
- Shortcuts persist across sessions

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Next.js App (React 19)                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │    │
│  │  │   MainView   │  │  Modals      │  │   Context Provider │    │    │
│  │  │  - Calendar  │  │  - Settings  │  │   - AppState       │    │    │
│  │  │  - Chat      │  │  - Events    │  │   - Actions        │    │    │
│  │  │  - Actions   │  │  - Locations │  │   - Storage Sync   │    │    │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                  │                                       │
│                    ┌─────────────┴─────────────┐                        │
│                    ▼                           ▼                        │
│  ┌─────────────────────────┐    ┌─────────────────────────┐            │
│  │     Speech APIs         │    │     Hooks               │            │
│  │  - Recognition (STT)    │    │  - useSpeechRecognition │            │
│  │  - Synthesis (TTS)      │    │  - useSpeechSynthesis   │            │
│  └─────────────────────────┘    └─────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API ROUTES                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  /api/chat   │  │ /api/weather │  │ /api/traffic │  │/api/storage│  │
│  │  AI Chat     │  │  OpenWeather │  │   Google     │  │   Redis    │  │
│  │  Azure       │  │  API         │  │   Routes     │  │   CRUD     │  │
│  │  OpenAI      │  │              │  │    API       │  │            │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                 │                 │         │
│  ┌──────┴────────────────┴─────────────────┴─────────────────┴──────┐  │
│  │                      /api/morning                                 │  │
│  │              Morning Briefing Aggregator                          │  │
│  │         (Weather + Traffic + Calendar Summary)                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │    Azure     │  │ OpenWeather  │  │   Google     │  │   Redis    │  │
│  │   OpenAI     │  │     API      │  │  Routes API  │  │   Cloud    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                                     │
│  │   Google     │  │ Google OAuth │                                     │
│  │  Geocoding   │  │              │                                     │
│  └──────────────┘  └──────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                                 │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────────┐
        │   Click   │   │   Type    │   │    Voice      │
        │  Calendar │   │   Chat    │   │   Command     │
        └─────┬─────┘   └─────┬─────┘   └───────┬───────┘
              │               │                 │
              │               │    ┌────────────┴────────────┐
              │               │    ▼                         │
              │               │  ┌─────────────────────┐     │
              │               │  │ Speech Recognition  │     │
              │               │  │ (Web Speech API)    │     │
              │               │  └──────────┬──────────┘     │
              │               │             │                │
              │               ▼             ▼                │
              │        ┌──────────────────────────────┐      │
              │        │       Process Input          │      │
              │        │   (Text or Transcript)       │      │
              │        └─────────────┬────────────────┘      │
              │                      │                       │
              │      ┌───────────────┴───────────────┐       │
              │      ▼                               ▼       │
              │  ┌────────────┐              ┌────────────┐  │
              │  │ Direct UI  │              │  AI Chat   │  │
              │  │  Action    │              │   API      │  │
              │  └─────┬──────┘              └─────┬──────┘  │
              │        │                          │          │
              ▼        ▼                          ▼          │
       ┌────────────────────────────────────────────────┐   │
       │              AppContext (State Manager)         │   │
       │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────┐  │   │
       │  │ Events  │ │ Members │ │ Travels │ │ Locs │  │   │
       │  └────┬────┘ └────┬────┘ └────┬────┘ └──┬───┘  │   │
       └───────┼───────────┼───────────┼─────────┼──────┘   │
               │           │           │         │          │
               └───────────┴───────────┴─────────┘          │
                                │                           │
                   ┌────────────┴────────────┐              │
                   ▼                         ▼              │
           ┌─────────────┐           ┌─────────────┐        │
           │ LocalStorage│           │    Redis    │        │
           │   (Cache)   │           │   (Cloud)   │        │
           └─────────────┘           └─────────────┘        │
                                                            │
              ┌─────────────────────────────────────────────┘
              ▼
       ┌─────────────────────┐
       │  Speech Synthesis   │
       │  (TTS Response)     │
       └─────────────────────┘
```

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── chat/          # AI chat endpoint (Groq/Cerebras)
│   │   ├── weather/       # Weather data (OpenWeather)
│   │   ├── traffic/       # Traffic routing (Google Routes)
│   │   ├── morning/       # Morning briefing aggregator
│   │   ├── storage/       # Redis CRUD operations
│   │   └── auth/          # NextAuth configuration
│   ├── auth/              # Authentication pages
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Main application page
├── components/            # React components
│   ├── MainView.tsx       # Main calendar + chat view
│   ├── AddEventModal.tsx  # Event creation/editing
│   ├── FamilySettingsModal.tsx
│   ├── LocationsSettingsModal.tsx
│   ├── EventTypeManager.tsx
│   └── EmojiQuickActions.tsx
├── context/
│   └── AppContext.tsx     # Global state management
├── hooks/                 # Custom React hooks
│   ├── useSpeechRecognition.ts
│   └── useSpeechSynthesis.ts
├── lib/                   # Utilities
│   ├── storage.ts         # Storage operations
│   ├── calendar-scraper.ts # URL/PDF calendar parsing
│   ├── locations.ts       # Location definitions
│   └── date-utils.ts      # Date formatting helpers
└── types/
    └── index.ts           # TypeScript definitions
```

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| UI | React 19, Tailwind CSS |
| AI | Azure OpenAI (GPT-4o-mini) |
| Weather | OpenWeather API |
| Traffic | Google Routes API |
| Geocoding | Google Geocoding API |
| Storage | Redis (ioredis), LocalStorage |
| Auth | NextAuth.js (Google OAuth) |
| Voice | Web Speech API (STT/TTS) |
| Icons | Lucide React |
| Dates | date-fns |

---

## 🔒 Authentication

FamilyHub uses Google OAuth authentication to restrict access:

1. Configure Google Cloud OAuth credentials
2. Add authorized emails to `ALLOWED_EMAILS` env var (comma-separated)
3. Users not on the allowlist will see an access denied error
4. Each family member can be linked to their email in Settings for personalized AI responses

---

## 🚀 Deployment (Vercel)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com/) and import your repository
3. Add all environment variables from `.env` to Vercel project settings
4. Update `NEXTAUTH_URL` to your production URL
5. Add the production callback URL to Google OAuth:
   - `https://yourdomain.vercel.app/api/auth/callback/google`
6. Deploy!

---

## � Cost Estimates

Most APIs have free tiers sufficient for family use:

| Service | Free Tier | Notes |
|---------|-----------|-------|
| **Azure OpenAI** | Pay-as-you-go | ~$0.15/1M input tokens, ~$0.60/1M output tokens for GPT-4o-mini |
| **OpenWeather** | 1,000 calls/day | More than enough for a family |
| **Google Routes API** | $200/month credit | ~40,000 route calculations |
| **Google Geocoding** | $200/month credit | ~40,000 geocoding requests |
| **Upstash Redis** | 10,000 commands/day | Free tier sufficient |
| **Vercel** | Hobby tier free | Perfect for personal projects |

**Typical monthly cost for family use: $0-5**

---

## 🔧 Troubleshooting

### Traffic data shows "no traffic information"
- Ensure locations have coordinates (lat/lng), not just addresses
- Go to Settings → Locations → Click "Lookup missing coordinates"
- Check that `GOOGLE_MAPS_API_KEY` and `GOOGLE_GEOCODING_API_KEY` are set

### Weather not loading
- Verify `OPENWEATHER_API_KEY` is correct
- Check that locations have valid addresses
- OpenWeather works with city names or full addresses

### Authentication errors
- Ensure your email is in `ALLOWED_EMAILS`
- Verify OAuth redirect URI matches your domain
- Check `NEXTAUTH_SECRET` is set

### AI not responding
- Verify Azure OpenAI credentials and deployment name
- Check Azure OpenAI resource is deployed and accessible
- Review browser console for API errors

---

## �📄 License

MIT License - feel free to use and modify for your family's needs!

---

## 🙏 Acknowledgments

- [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service) for AI capabilities
- [OpenWeather](https://openweathermap.org/) for weather data
- [Google Maps Platform](https://developers.google.com/maps) for traffic routing and geocoding
- [Upstash](https://upstash.com/) for serverless Redis
- [Vercel](https://vercel.com/) for Next.js hosting
