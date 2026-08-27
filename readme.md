# 📝 Otion — Real-Time Collaborative Workspace

**Otion** is a modern, lightweight, block-based workspace designed for fast documentation, note-taking, and seamless team collaboration. Inspired by modern productivity platforms, Otion provides a clean layout, real-time multi-user editing, live cursors, dynamic slash-command block editing, and granular sharing permissions.

---

## ✨ Key Features

* 🚀 **Real-Time Collaboration:** Synchronized document state powered by WebSockets. See live multi-user cursors and active collaborator presence as you work together.
* ✍️ **Block-Based WYSIWYG Editor:** Craft clean docs with heading blocks, task lists, code blocks, and rich text formatting.
* ⚡ **Slash Commands (`/`):** Trigger instant block transformations and elements by typing `/` anywhere on a new line.
* 🎨 **Document Customization:** Personalize pages with custom cover images and dynamic emoji icons.
* 🔒 **Granular Share Permissions:** Invite team members with specific roles (**Owner**, **Editor**, **Viewer**) or publish read-only public links.
* 📁 **Dynamic Workspace Navigation:** Organised page trees, sub-pages, breadcrumb navigation, and instant search.
* 🗑️ **Trash & Recovery:** Soft-delete pages with full restoration or permanent deletion capabilities.

---

## 🛠️ Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB & Mongoose ORM |
| **Real-Time Engine** | Socket.io |
| **Authentication** | JWT (JSON Web Tokens) & Bcrypt |

---

## 🚀 Getting Started

Follow these steps to run Otion on your local machine.

### Prerequisites

Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* [Git](https://git-scm.com/)
* [MongoDB](https://www.mongodb.com/) (Local server or a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) URI)

---

### Installation & Setup

#### 1. Clone the Repository
```bash
git clone [https://github.com/RamPanjwani/Otion.git](https://github.com/RamPanjwani/Otion.git)
cd otion

```

#### 2. Configure Environment Variables

Create a `.env` file inside the `server/` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/otion
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:5173

```

#### 3. Start the Backend Server

```bash
cd server
npm install
npm run dev

```

*Backend server will start running at `http://localhost:5000`.*

#### 4. Start the Frontend Application

Open a second terminal window or tab:

```bash
cd client
npm install
npm run dev

```

*Frontend application will start at `http://localhost:5173`.*

---

## 📂 Project Structure

```text
otion/
├── client/         # React frontend application
│   ├── src/
│   │   ├── components/  # Editor, Sidebar, Navbar, ShareModal, etc.
│   │   ├── context/     # Auth Context Provider
│   │   ├── pages/       # Dashboard, Login, Register, Editor, Trash
│   │   └── services/    # Axios HTTP & Socket.io configurations
└── server/         # Express backend server
    ├── controllers/ # Auth, Note, and Share logic
    ├── models/      # Mongoose Schemas (User, Note, SharePermission)
    ├── routes/      # Express REST API endpoints
    └── server.js    # Entry point & WebSocket server initialization

```

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request if you have suggestions for new features or improvements.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

Developed by **[Ram Panjwani](https://www.google.com/search?q=https://github.com/RamPanjwani)**.
"@ | Out-File -Encoding utf8 README.md

```

To update your remote GitHub repository with the newly generated `README.md` and all documentation files, run:

```powershell
git add .
git commit -m "docs: Add user README and system documentation files"
git push origin main

```