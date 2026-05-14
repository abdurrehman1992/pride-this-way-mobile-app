import axios from "axios";
export const API = axios.create({
  baseURL: "https://overspend-daylight-drank.ngrok-free.dev/api",
  headers: {
    "Content-Type": "application/json",
  },
});