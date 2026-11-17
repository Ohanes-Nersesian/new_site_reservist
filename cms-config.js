// Режим "auto": на хостингу з PHP (ukraine.com.ua) сайт автоматично працює через api.php + SQLite.
// На локальному статичному сервері без PHP працює у локальному демо-режимі браузера.
window.RESERVIST_SUPABASE_CONFIG = {
  backend: "auto",
  apiUrl: "api.php",
  url: "",
  anonKey: "",
};
