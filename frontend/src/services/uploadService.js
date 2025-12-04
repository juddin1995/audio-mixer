import { getToken } from "./authService";

const apiBase = "/api/audio";

async function postFormData(url, formData, needsAuth = false) {
  const headers = {};
  if (needsAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { method: "POST", body: formData, headers });
  if (res.ok) return res.json();
  const err = await res.json();
  throw new Error(err.message || "Upload failed");
}

export async function uploadOriginal(file) {
  const fd = new FormData();
  fd.append("file", file);
  return postFormData(`${apiBase}/upload-original`, fd, false);
}

export async function uploadMixed(file) {
  const fd = new FormData();
  fd.append("file", file);
  return postFormData(`${apiBase}/upload-mixed`, fd, true);
}
