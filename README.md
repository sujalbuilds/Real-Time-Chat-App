# Real-Time Chat App 💬

A modern, real-time chat application built with Node.js, Express, and Socket.IO. Experience seamless communication with instant messaging, multiple chat rooms, and a responsive user interface.

## ✨ Features

- **Real-time messaging** - Messages appear instantly without page refresh
- **Multiple chat rooms** - Create and join different conversation channels
- **User authentication** - Secure login and registration system
- **Responsive design** - Works perfectly on desktop and mobile devices
- **Live user status** - See who's online and active in real-time
- **Message history** - Access previous conversations
- **Clean, modern UI** - Intuitive and user-friendly interface

## 🚀 Technologies Used

- **Backend:**
  - Node.js
  - Express.js
  - Socket.IO (for real-time communication)
  - MongoDB/Database (for data persistence)
  
- **Frontend:**
  - HTML5
  - CSS3
  - JavaScript (ES6+)
  - Socket.IO Client

- **Additional Tools:**
  - Middleware for authentication and validation
  - RESTful API architecture



## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/sujalbuilds/Real-Time-Chat-App.git
   cd Real-Time-Chat-App
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory and add:
   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🎯 How to Use

1. **Sign Up/Login** - Create a new account or login with existing credentials
2. **Join a Room** - Select an existing chat room or create a new one
3. **Start Chatting** - Send messages and see them appear in real-time
4. **Manage Rooms** - Switch between different chat rooms
5. **View Online Users** - See who's currently active in each room


## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
