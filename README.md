# Comsierge - AI-Powered Communication Management

**Last Updated:** December 29, 2025 at 11:00 AM EST

Comsierge is a modern communication management platform that provides AI-powered phone number management, messaging, and call handling capabilities using Twilio integration.

## 🚀 Recent Updates (December 29, 2025)

### Real-Time SMS Integration
- ✅ **Twilio SMS Sending** - Send real SMS messages from the inbox
- ✅ **Twilio SMS Receiving** - Receive SMS via webhooks with ngrok tunnel
- ✅ **Auto-scroll** - Chat automatically scrolls to show new messages
- ✅ **No spam notifications** - Removed repetitive toast notifications for incoming messages
- ✅ **Message polling** - Frontend polls for new messages every 3 seconds

### Backend Enhancements
- ✅ **Webhook endpoints** - `/api/twilio/webhook/sms` and `/api/twilio/webhook/voice`
- ✅ **Configure webhooks** - `/api/twilio/configure-webhooks` to set up Twilio phone numbers
- ✅ **In-memory message store** - Temporary storage for incoming messages
- ✅ **URL-encoded body parsing** - For Twilio webhook payloads

### AI Integration
- ✅ **LangChain/LangGraph** - AI-powered message analysis
- ✅ **Auto-response suggestions** - AI generates response suggestions
- ✅ **Priority detection** - AI detects message priority

## Features

### User Features
- **Virtual Phone Numbers** - Get assigned a Twilio phone number for business communications
- **Inbox Management** - View and manage messages with AI-powered responses
- **Call Tracking** - Track incoming and outgoing calls
- **Contact Management** - Manage your contacts with easy navigation
- **Routing Rules** - Set up custom routing rules for calls and messages
- **Active Rules** - Create and manage AI automation rules

### Admin Features
- **Twilio Account Management** - Add and verify Twilio accounts with phone numbers
- **User Management** - Manage users and assign/unassign phone numbers
- **Real-time Status** - See which phone numbers are assigned or available

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Hook Form** with Zod validation
- **Sonner** for toast notifications
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Twilio SDK** for phone number verification

## Getting Started

### One-command local + LAN dev (Windows)

Runs backend + frontend in new PowerShell windows, verifies MongoDB via `/api/health`, and (optionally) starts ngrok.

- Run: `py -3.12 tools/dev_up.py`
- If you want the script to be the only startup method (recommended), use:
  - `py -3.12 tools/dev_up.py --restart`
- LAN URL prints at the end (example): `http://192.168.x.x:8080/`

Optional:
- To auto-verify Twilio creds, set environment variables before running:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER` (optional)

If a phone/laptop on the same Wi‑Fi can’t open the LAN URL, allow `node.exe` through Windows Firewall (Private networks).

### Prerequisites
- Node.js 18+ 
- npm or bun
- MongoDB Atlas account (or local MongoDB)
- Twilio account (for phone number management)

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
MONGODB_URI=mongodb+srv://your-connection-string
JWT_SECRET=your-jwt-secret-key
PORT=5000
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
OPENAI_API_KEY=your-openai-api-key
```

> ⚠️ **IMPORTANT:** Never commit `.env` files to git! They are already in `.gitignore`.

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/comsierge-aura.git
cd comsierge-aura
```

2. **Install frontend dependencies**
```bash
npm install
```

3. **Install backend dependencies**
```bash
cd server
npm install
```

4. **Start the backend server**
```bash
cd server
npm start
```

5. **Start the frontend development server** (in a new terminal)
```bash
npm run dev
```

The app will be available at `http://localhost:8080`

## Project Structure

```
comsierge-aura/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── dashboard/           # Dashboard components
│   │   │   ├── ActiveRulesTab.tsx
│   │   │   ├── adminStore.ts    # Admin state management
│   │   │   ├── CallsTab.tsx
│   │   │   ├── ContactsTab.tsx
│   │   │   ├── contactsStore.ts
│   │   │   ├── InboxView.tsx
│   │   │   ├── ProfileTab.tsx
│   │   │   ├── RoutingPanel.tsx
│   │   │   ├── rulesStore.ts
│   │   │   └── SupportTab.tsx
│   │   └── ui/                  # UI components (shadcn/ui)
│   ├── contexts/
│   │   └── AuthContext.tsx      # Authentication context with session caching
│   ├── pages/
│   │   ├── AdminDashboard.tsx   # Admin panel
│   │   ├── Auth.tsx             # Login/Signup page
│   │   ├── Dashboard.tsx        # User dashboard
│   │   ├── ForgotPassword.tsx
│   │   ├── Index.tsx            # Landing page
│   │   └── SelectNumber.tsx     # Phone number selection
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utilities
│   └── App.tsx                  # Main app component
├── server/                      # Backend source code
│   ├── index.js                 # Express server entry
│   ├── models/
│   │   └── User.js              # User mongoose model
│   └── routes/
│       ├── auth.js              # Authentication routes
│       └── twilio.js            # Twilio verification routes
├── public/                      # Static assets
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires token)
- `PUT /api/auth/profile` - Update user profile
- `GET /api/auth/users` - Get all users (admin)
- `DELETE /api/auth/users/:id` - Delete user (admin)
- `PUT /api/auth/users/:id/phone` - Assign/unassign phone number

### Twilio
- `POST /api/twilio/verify-credentials` - Verify Twilio credentials and phone number

## Authentication Flow

1. User signs up → Account created in MongoDB
2. User logs in → JWT token issued (7 day expiry)
3. Token stored in localStorage with session caching (5 min cache)
4. Protected routes check token validity
5. Admin users redirected to `/admin`, regular users to `/dashboard`

## Phone Number Assignment Flow

1. Admin adds Twilio account with phone numbers
2. Numbers stored in localStorage (admin_twilio_accounts)
3. New user signs up → Redirected to `/select-number`
4. User selects available number → Saved to MongoDB
5. Dashboard displays assigned number
6. Admin can unassign → User redirected back to select number

## Default Admin Account

To create an admin account, call:
```bash
curl -X POST http://localhost:5000/api/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@comsierge.com", "password": "admin123", "name": "Admin"}'
```

Or use PowerShell:
```powershell
$body = @{email="admin@comsierge.com"; password="admin123"; name="Admin"} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:5000/api/auth/create-admin" -Method POST -Body $body -ContentType "application/json"
```

## Development

### Running in Development Mode

Frontend (with hot reload):
```bash
npm run dev
```

Backend (with nodemon):
```bash
cd server
npm run dev
```

### Building for Production

```bash
npm run build
```

## Screenshots

### Landing Page
Modern, responsive landing page with feature highlights.

### User Dashboard
Clean interface for managing communications, viewing inbox, and handling calls.

### Admin Panel
Comprehensive admin panel for managing Twilio accounts and users.

## License

MIT License - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
