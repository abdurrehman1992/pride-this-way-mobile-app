import { API } from "./api";
export const loginUser = async (data: {
    email: string;
    password: string;
}) => {
    const response = await API.post("/auth/login", data);
    return response.data;
};
export const signupUser = async (data: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}) => {
  const response = await API.post("/auth/signup", data);
  return response.data;
};