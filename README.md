# FamilyHub 🏠

A modern family calendar and AI assistant PWA built with Next.js. FamilyHub helps families coordinate schedules, find travel opportunities, and stay informed with weather and traffic updates.

**Live Demo:** [https://familyhub-pied.vercel.app](https://familyhub-pied.vercel.app)

## ✨ Features

### 📅 Smart Calendar Management
- **Family-wide calendar** with color-coded events per family member
- **Generic events** that apply to everyone (no member assignment required)
- **Custom event types** with personalized colors and icons
- **School calendar sync** via URL scraping (websites and PDF files)
- **Flight restriction tracking** to mark dates when family members can't travel

### 🤖 AI Assistant
- **Bilingual support** (English & Korean) - responds in your language
- **Voice input/output** with speech recognition and synthesis
- **Natural language commands** for calendar management
- **Smart travel suggestions** - finds dates when everyone is available
- **Bulk import** flight restrictions via voice or text
- **Time-aware** - knows current time and timezone

### 📱 Mobile-First PWA
- **Installable PWA** - add to home screen on iOS/Android
- **Touch-friendly** slide-up chat panel (bottom sheet)
- **Large floating action button** for easy chat access
- **Voice input** with tap-to-speak button
- **Auto voice response** when using speech input

### 🌤️ Smart Briefings
- **Weather updates** for all configured locations
- **Traffic/commute** estimates between locations
- **Today's events** summary
- **Voice-enabled** - tap 🌅 for a spoken briefing

### 📍 Location Management
- **Multiple saved locations** with custom emojis
- **Weather lookup** by city/address (auto-extracts city from full addresses)
- **Traffic routing** between any configured locations
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

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Redis instance (cloud or local)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/family-hub.git
cd family-hub

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Environment Variables

Create a `.env` file with the following:

```env
# AI Providers (at least one required)
GROQ_API_KEY=your_groq_api_key
CEREBRAS_API_KEY=your_cerebras_api_key

# External APIs
OPENWEATHER_API_KEY=your_openweather_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Storage
REDIS_URL=redis://your_redis_url

# Auth (optional - for Google Sign-in)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
ALLOWED_EMAILS=email1@gmail.com,email2@gmail.com
```

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

### Morning Briefing
- Tap the **🌅 emoji** or say "morning briefing" for weather, commute, and schedule
- Works through AI chat for consistent, smart responses
- Available in English and Korean

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
│  │  Groq/       │  │  API         │  │   Routes     │  │   CRUD     │  │
│  │  Cerebras    │  │              │  │    API       │  │            │  │
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
│  │    Groq      │  │ OpenWeather  │  │   Google     │  │   Redis    │  │
│  │   LLama 3.3  │  │     API      │  │  Routes API  │  │   Cloud    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                                     │
│  │  Cerebras    │  │ Google OAuth │                                     │
│  │  (Fallback)  │  │ (Optional)   │                                     │
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
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS |
| AI | Groq (LLama 3.3), Cerebras (fallback) |
| Weather | OpenWeather API |
| Traffic | Google Routes API |
| Storage | Redis (ioredis), LocalStorage |
| Auth | NextAuth.js (Google OAuth) |
| Voice | Web Speech API (STT/TTS) |
| Icons | Lucide React |
| Dates | date-fns |

---

## 🔒 Authentication

FamilyHub supports optional Google OAuth authentication:

1. Configure Google Cloud OAuth credentials
2. Add authorized emails to `ALLOWED_EMAILS` env var
3. Users not on the allowlist will see an error

To disable auth, remove the NextAuth configuration.

---

## 📄 License

MIT License - feel free to use and modify for your family's needs!

---

## 🙏 Acknowledgments

- [Groq](https://groq.com/) for fast AI inference
- [OpenWeather](https://openweathermap.org/) for weather data
- [Google Maps Platform](https://developers.google.com/maps) for traffic routing
- [Vercel](https://vercel.com/) for Next.js hosting
