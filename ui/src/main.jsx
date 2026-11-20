import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/presets.js";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")).render(<App />);
