import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { EditLockProvider } from "./context/EditLockContext.jsx";
import "./styles/global.css";
import "./styles/auth.css";
import "./styles/edit-lock.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EditLockProvider>
          <App />
        </EditLockProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
