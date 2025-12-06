# IROLINKS - URL Shortener Service

![IROLINKS Banner](https://iili.io/fTvAubs.jpg)

A powerful, session-based URL shortener service built with Netlify Functions. Features user authentication, link management, and a mandatory 10-second countdown before redirects.

## 🚀 Quick Deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/IROTECHLAB/irolinks)

[![Fork on GitHub](https://img.shields.io/badge/Fork%20on-GitHub-black?style=for-the-badge&logo=github)](https://github.com/IROTECHLAB/irolinks/fork)

## ✨ Features

- **🔗 URL Shortening**: Convert long URLs to short, memorable links
- **🔐 Session-Based Auth**: Secure user authentication with token management
- **⏱️ 10-Second Countdown**: Mandatory wait before redirect (no skip option)
- **📊 Click Tracking**: Monitor link performance and analytics
- **👤 User Dashboard**: View and manage your shortened links
- **💾 JSON Database**: No external database required
- **🎨 Modern UI**: Clean, responsive design with gradient backgrounds
- **🔒 Security**: Password hashing, session validation, CSRF protection

## 🌐 Demo

Live Demo: [irolinks.netlify.app](https://irolinks.netlify.app)

## 📁 Project Structure

```
Irolinks/
├──index.html                    # Main html
├──netlify.toml                  # Netlify config
├──package.json               # Package dependencies
├──README.md               # This file
└──netlify/
└── functions/
└── link.js              # Backend
```

## 🛠️ Installation

### Option 1: Deploy to Netlify (Recommended)

1. Click the "Deploy to Netlify" button above
2. Connect your GitHub account
3. Netlify will automatically deploy your site

### Option 2: Manual Deployment

```bash
# Clone the repository
git clone https://github.com/IROTECHLAB/irolinks.git
cd irolinks

# Deploy to Netlify
netlify deploy
```

Option 3: Fork and Customize

1. Fork the repository on GitHub
2. Make your changes
3. Connect to Netlify for automatic deployment

🔧 Configuration

Environment Variables (Optional - for Firebase)

If you want to use Firebase instead of JSON storage, add these in Netlify:

```
FIREBASE_PROJECT_ID = your-project-id
FIREBASE_PRIVATE_KEY = your-private-key
FIREBASE_CLIENT_EMAIL = your-client-email
FIREBASE_API_KEY = your-api-key
FIREBASE_AUTH_DOMAIN = your-auth-domain
```

📝 How to Use

1. Sign Up: Create a new account
2. Login: Access your dashboard
3. Shorten URLs: Paste long URLs to create short links
4. Share: Copy and share your shortened links
5. Track: Monitor clicks and performance in your dashboard

🔄 Redirect Flow

1. User visits short link (e.g., irolinks.netlify.app/link?id=abc123)
2. 10-second countdown page appears
3. After countdown, user is redirected to destination URL
4. Click count is incremented

🛡️ Security Features

· SHA-256 password hashing
· Session token management
· Auto-cleanup of expired sessions
· CORS protection
· Input validation and sanitization

📱 Supported Browsers

· Chrome 60+
· Firefox 55+
· Safari 11+
· Edge 79+
· Via Browser
· Mobile browsers

🤝 Contributing

1. Fork the repository
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

📞 Contact & Support

· Demo: https://irolinks.netlify.app
· Contact: https://t.me/ironmanhindigaming
· Support: https://t.me/ironmanhindigming1
· Updates: https://t.me/irotechlab
· GitHub: https://github.com/IROTECHLAB/irolinks

👨‍💻 Created By

Deepseek & IRONMAN
Open Source URL Shortener Service

---

Made with ❤️ for the open source community
