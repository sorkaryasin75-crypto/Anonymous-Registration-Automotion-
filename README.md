# 🚀 Telegram Mini App Automation (GitHub Actions)

An automated, lightweight, and headful/headless browser-based bot designed to interact with Telegram Mini Apps seamlessly. Powered by **Playwright** and executed via **GitHub Actions**, this project automates daily tasks, registrations, and claiming mechanisms without requiring expensive 24/7 cloud servers.

---

## ✨ Features

- ⚡ **100% Free Cloud Execution**: Runs entirely on GitHub Actions runners without needing Railway or paid VPS hosts.
- 🎭 **Playwright Integration**: Built with Playwright for fast, reliable, and headless Chromium browser automation.
- ⏰ **Scheduled Cron Job**: Runs automatically on a customized schedule (e.g., every 6 hours or daily) or manually via `workflow_dispatch`.
- 🔐 **Secure Environment Variables**: Protects sensitive tokens, secrets, and credentials using GitHub Repository Secrets.
- 🛡️ **Anti-Detection Mechanics**: Configured with custom user-agents, arguments, and viewport settings to prevent bot-detection.
- 📦 **Zero Server Maintenance**: No need to worry about RAM limits, container crashes, or system library missing errors.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v20)
- **Automation Framework**: [Playwright](https://playwright.dev/)
- **CI/CD Pipeline**: GitHub Actions

---

## 📂 Project Structure

```text
├── .github/
│   └── workflows/
│       └── automation.yml   # GitHub Actions workflow file
├── script.js                # Core automation logic
├── package.json             # Node.js dependencies & scripts
└── README.md                # Project documentation
