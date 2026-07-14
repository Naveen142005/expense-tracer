import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { EditLockProvider } from "./context/EditLockContext.jsx";
import { FeedbackProvider } from "./context/FeedbackContext.jsx";
import "./styles/global.css";
import "./styles/auth.css";
import "./styles/edit-lock.css";
import "./styles/balance-wallet.css";
import "./styles/feedback.css";
import "./styles/ai-chatbot.css";
import "./styles/expense-workflow.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <FeedbackProvider>
        <AuthProvider>
          <EditLockProvider>
            <App />
          </EditLockProvider>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  </React.StrictMode>
);
