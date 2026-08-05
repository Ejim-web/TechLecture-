// ===============================
// TechLecture - Complete App
// Firebase + Authentication + Firestore + Storage
// ===============================

// ===============================
// FIREBASE CONFIGURATION
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeqkWCk65mB7VGGV4lfgFpj5vCChl0kNI",
  authDomain: "nexuxai-a013d.firebaseapp.com",
  projectId: "nexuxai-a013d",
  storageBucket: "nexuxai-a013d.firebasestorage.app",
  messagingSenderId: "542723237160",
  appId: "1:542723237160:web:ed7a4fbffc6c46fccc1c1d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ===============================
// GLOBAL STATE
// ===============================

let currentUser = null;
let isAdmin = false;
let courses = [];
let currentCategory = "all";
let searchTerm = "";
let userProgress = {};
let isAuthModeLogin = true;

// ===============================
// HELPERS
// ===============================

const $ = (id) => document.getElementById(id);

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <i class="fa fa-info-circle"></i>
    ${message}
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function escapeHTML(text) {
  if (!text) return "";
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================
// AUTH SYSTEM
// ===============================

async function register(email, password) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", result.user.uid), {
      email,
      createdAt: serverTimestamp()
    });
    showToast("Account created successfully!");
    closeAuthModal();
  } catch (error) {
    showToast(error.message);
  }
}

async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Welcome back!");
    closeAuthModal();
  } catch (error) {
    showToast(error.message);
  }
}

async function loginGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    showToast("Google login successful!");
    closeAuthModal();
  } catch (error) {
    showToast(error.message);
  }
}

async function loginGithub() {
  try {
    const provider = new GithubAuthProvider();
    await signInWithPopup(auth, provider);
    showToast("GitHub login successful!");
    closeAuthModal();
  } catch (error) {
    showToast(error.message);
  }
}

async function logout() {
  await signOut(auth);
  showToast("Logged out");
}

async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent!");
  } catch (error) {
    showToast(error.message);
  }
}

// ===============================
// AUTH UI CONTROLS
// ===============================

function openAuthModal() {
  const modal = $("authModal");
  modal.classList.add("active");
  isAuthModeLogin = true;
  updateAuthUI();
}

function closeAuthModal() {
  const modal = $("authModal");
  modal.classList.remove("active");
}

function toggleAuthMode() {
  isAuthModeLogin = !isAuthModeLogin;
  updateAuthUI();
}

function updateAuthUI() {
  const title = $("authTitle");
  const signInBtn = $("signInBtn");
  const signUpBtn = $("signUpBtn");
  const toggleText = $("authToggleText");

  if (isAuthModeLogin) {
    title.textContent = "Sign In";
    signInBtn.style.display = "flex";
    signUpBtn.style.display = "none";
    toggleText.textContent = "Create an account";
  } else {
    title.textContent = "Create Account";
    signInBtn.style.display = "none";
    signUpBtn.style.display = "flex";
    toggleText.textContent = "Already have an account? Sign in";
  }
}

// ===============================
// ADMIN CHECK
// ===============================

async function checkAdmin(uid) {
  try {
    const adminDoc = await getDoc(doc(db, "admins", uid));
    return adminDoc.exists() && adminDoc.data().admin === true;
  } catch {
    return false;
  }
}

// ===============================
// AUTH STATE LISTENER
// ===============================

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const authBtn = $("authToggleBtn");
  const logoutBtn = $("logoutBtn");
  const userBadge = $("userBadge");
  const userEmail = $("userEmail");
  const adminTag = $("adminTag");
  const adminSection = $("adminSection");

  if (user) {
    isAdmin = await checkAdmin(user.uid);
    console.log("Logged in:", user.email);

    authBtn.style.display = "none";
    logoutBtn.style.display = "flex";
    userBadge.style.display = "flex";
    userEmail.textContent = user.email;

    if (isAdmin) {
      adminTag.style.display = "inline";
      adminSection.classList.remove("hidden");
      showToast("Admin access enabled");
    } else {
      adminTag.style.display = "none";
      adminSection.classList.add("hidden");
    }

    await loadProgress();
  } else {
    isAdmin = false;
    authBtn.style.display = "flex";
    logoutBtn.style.display = "none";
    userBadge.style.display = "none";
    adminSection.classList.add("hidden");
  }

  loadCourses();
});

// ===============================
// COURSES
// ===============================

async function loadCourses() {
  try {
    const q = query(
      collection(db, "courses"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const snapshot = await getDocs(q);
    courses = [];
    snapshot.forEach(doc => {
      courses.push({
        id: doc.id,
        ...doc.data()
      });
    });
    renderCourses();
  } catch (error) {
    console.log(error);
    showToast("Loading sample courses");
  }
}

function renderCourses() {
  const container = $("featuredGrid");
  if (!container) return;
  container.innerHTML = "";

  if (courses.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;color:#8899b4;padding:40px 0;">
        <i class="fas fa-book-open" style="font-size:48px;margin-bottom:16px;display:block;"></i>
        <p>No courses available yet. Check back soon!</p>
      </div>
    `;
    return;
  }

  courses.forEach(course => {
    const card = document.createElement("div");
    card.className = "course-card";
    card.innerHTML = `
      <div class="card-thumb">
        ${course.thumb ? `<img src="${course.thumb}" alt="${escapeHTML(course.title)}">` : "📘"}
      </div>
      <h3>${escapeHTML(course.title)}</h3>
      <p>${escapeHTML(course.desc || "No description available")}</p>
      <div class="card-actions">
        <button class="btn btn-primary btn-sm" onclick="startCourse('${course.id}')">
          <i class="fas fa-play"></i> Start Learning
        </button>
        <button class="btn btn-secondary btn-sm" onclick="bookmarkCourse('${course.id}')">
          <i class="fas fa-bookmark"></i>
        </button>
        ${isAdmin ? `
          <button class="btn btn-danger btn-sm" onclick="removeCourse('${course.id}')">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

async function startCourse(courseId) {
  if (!currentUser) {
    showToast("Please sign in to start learning");
    openAuthModal();
    return;
  }
  showToast("Course started! Progress tracking enabled.");
  await saveProgress(courseId, 10);
}

// ===============================
// COURSE ADMIN MANAGEMENT
// ===============================

async function addCourse(courseData) {
  if (!currentUser || !isAdmin) {
    showToast("Admin access required");
    return;
  }

  try {
    await addDoc(collection(db, "courses"), {
      ...courseData,
      createdAt: serverTimestamp()
    });
    showToast("Course added successfully!");
    loadCourses();
    // Clear form
    $("courseTitle").value = "";
    $("courseDesc").value = "";
    $("courseCategory").value = "";
    $("courseUrl").value = "";
  } catch (error) {
    showToast(error.message);
  }
}

async function updateCourse(id, data) {
  if (!isAdmin) {
    showToast("Admin access required");
    return;
  }

  try {
    await updateDoc(doc(db, "courses", id), data);
    showToast("Course updated successfully!");
    loadCourses();
  } catch (error) {
    showToast(error.message);
  }
}

async function removeCourse(id) {
  if (!isAdmin) {
    showToast("Admin access required");
    return;
  }

  if (!confirm("Delete this course?")) return;

  try {
    await deleteDoc(doc(db, "courses", id));
    showToast("Course deleted successfully!");
    loadCourses();
  } catch (error) {
    showToast(error.message);
  }
}

// ===============================
// IMAGE UPLOAD
// ===============================

async function uploadImage(file) {
  if (!file) return null;

  try {
    const imageRef = ref(
      storage,
      "courses/" + Date.now() + "_" + file.name
    );
    await uploadBytes(imageRef, file);
    const url = await getDownloadURL(imageRef);
    return url;
  } catch (error) {
    showToast(error.message);
    return null;
  }
}

// ===============================
// SEARCH SYSTEM
// ===============================

function searchCourses(value) {
  searchTerm = value.toLowerCase();
  const filtered = courses.filter(course => {
    return (
      course.title.toLowerCase().includes(searchTerm) ||
      course.category?.toLowerCase().includes(searchTerm) ||
      course.desc?.toLowerCase().includes(searchTerm)
    );
  });

  const container = $("featuredGrid");
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;color:#8899b4;padding:40px 0;">
        <i class="fas fa-search" style="font-size:48px;margin-bottom:16px;display:block;"></i>
        <p>No courses found for "${escapeHTML(searchTerm)}"</p>
      </div>
    `;
    return;
  }

  filtered.forEach(course => {
    const div = document.createElement("div");
    div.className = "course-card";
    div.innerHTML = `
      <div class="card-thumb">
        ${course.thumb ? `<img src="${course.thumb}" alt="${escapeHTML(course.title)}">` : "📘"}
      </div>
      <h3>${escapeHTML(course.title)}</h3>
      <p>${escapeHTML(course.desc || "No description available")}</p>
      <div class="card-actions">
        <button class="btn btn-primary btn-sm" onclick="startCourse('${course.id}')">
          <i class="fas fa-play"></i> Start Learning
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

// ===============================
// USER PROGRESS
// ===============================

async function saveProgress(courseId, percent) {
  if (!currentUser) {
    showToast("Please login first");
    return;
  }

  try {
    await setDoc(
      doc(db, "users", currentUser.uid, "progress", courseId),
      {
        percent,
        updatedAt: serverTimestamp()
      }
    );
    userProgress[courseId] = percent;
    showToast(`Progress saved: ${percent}%`);
  } catch (error) {
    showToast(error.message);
  }
}

async function loadProgress() {
  if (!currentUser) return;

  try {
    const snapshot = await getDocs(
      collection(db, "users", currentUser.uid, "progress")
    );
    snapshot.forEach(doc => {
      userProgress[doc.id] = doc.data().percent;
    });
  } catch (error) {
    console.log("Error loading progress:", error);
  }
}

// ===============================
// BOOKMARKS
// ===============================

async function bookmarkCourse(id) {
  if (!currentUser) {
    showToast("Please login to bookmark");
    openAuthModal();
    return;
  }

  try {
    await setDoc(
      doc(db, "users", currentUser.uid, "favorites", id),
      {
        savedAt: serverTimestamp()
      }
    );
    showToast("Course bookmarked! ❤️");
  } catch (error) {
    showToast(error.message);
  }
}

// ===============================
// CERTIFICATES
// ===============================

async function createCertificate(courseName) {
  if (!currentUser) {
    showToast("Please login first");
    return;
  }

  const certificateId = "TL-" + Date.now();

  try {
    await setDoc(
      doc(db, "certificates", certificateId),
      {
        userId: currentUser.uid,
        userName: currentUser.email,
        course: courseName,
        createdAt: serverTimestamp()
      }
    );
    showToast(`Certificate created! ID: ${certificateId}`);
    return certificateId;
  } catch (error) {
    showToast(error.message);
    return null;
  }
}

async function verifyCertificate(id) {
  try {
    const result = await getDoc(doc(db, "certificates", id));
    if (result.exists()) {
      return result.data();
    }
    return null;
  } catch (error) {
    showToast(error.message);
    return null;
  }
}

// ===============================
// AI TUTOR
// ===============================

async function askAI(question) {
  let answer = "I can help you learn programming. Ask me about coding, AI, cybersecurity, or technology!";

  const q = question.toLowerCase();

  if (q.includes("javascript") || q.includes("js")) {
    answer = "JavaScript is a versatile programming language used for web development, servers (Node.js), mobile apps (React Native), and more. It's essential for modern web development!";
  } else if (q.includes("python")) {
    answer = "Python is a popular language for AI, machine learning, data science, automation, and backend development. It's known for its readability and extensive libraries like NumPy, Pandas, and TensorFlow.";
  } else if (q.includes("firebase")) {
    answer = "Firebase is a comprehensive app development platform by Google. It provides authentication, real-time database, cloud storage, hosting, and many other tools to build and scale apps quickly.";
  } else if (q.includes("react")) {
    answer = "React is a JavaScript library for building user interfaces. It uses a component-based architecture and virtual DOM for efficient updates. Great for single-page applications!";
  } else if (q.includes("ai") || q.includes("artificial")) {
    answer = "AI (Artificial Intelligence) involves creating systems that can learn and make decisions. It includes subfields like machine learning, deep learning, NLP, and computer vision.";
  } else if (q.includes("cyber") || q.includes("security")) {
    answer = "Cybersecurity is the practice of protecting systems, networks, and programs from digital attacks. Key areas include encryption, authentication, penetration testing, and security monitoring.";
  } else if (q.includes("html") || q.includes("css")) {
    answer = "HTML provides the structure of web pages, while CSS handles styling and layout. Together, they form the foundation of front-end web development.";
  } else if (q.includes("database")) {
    answer = "Databases store and manage data. Popular types include SQL (PostgreSQL, MySQL) and NoSQL (MongoDB, Firestore). Choose based on your app's data structure and scaling needs.";
  }

  return answer;
}

// ===============================
// UI EVENTS
// ===============================

// Search Events
const searchButton = $("searchBtn");
if (searchButton) {
  searchButton.addEventListener("click", () => {
    const input = $("searchInput");
    searchCourses(input.value);
  });
}

const searchInput = $("searchInput");
if (searchInput) {
  searchInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      searchCourses(e.target.value);
    }
  });
}

// Auth Events
const googleBtn = $("googleSignIn");
if (googleBtn) googleBtn.onclick = loginGoogle;

const githubBtn = $("githubSignIn");
if (githubBtn) githubBtn.onclick = loginGithub;

const logoutBtn = $("logoutBtn");
if (logoutBtn) logoutBtn.onclick = logout;

const loginBtn = $("signInBtn");
if (loginBtn) {
  loginBtn.onclick = () => {
    const email = $("authEmail").value;
    const password = $("authPassword").value;
    if (!email || !password) {
      showToast("Please enter email and password");
      return;
    }
    login(email, password);
  };
}

const signupBtn = $("signUpBtn");
if (signupBtn) {
  signupBtn.onclick = () => {
    const email = $("authEmail").value;
    const password = $("authPassword").value;
    if (!email || !password) {
      showToast("Please enter email and password");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters");
      return;
    }
    register(email, password);
  };
}

const resetBtn = $("resetPasswordBtn");
if (resetBtn) {
  resetBtn.onclick = () => {
    const email = $("authEmail").value;
    if (!email) {
      showToast("Please enter your email");
      return;
    }
    resetPassword(email);
  };
}

// AI Chat Events
const aiButton = $("aiSendBtn");
if (aiButton) {
  aiButton.onclick = async () => {
    const input = $("aiInput");
    const message = input.value.trim();
    if (!message) return;

    const reply = await askAI(message);
    const box = $("aiMessages");

    box.innerHTML += `
      <div class="chat-user">
        <b>You:</b> ${escapeHTML(message)}
      </div>
      <div class="chat-ai">
        <b>AI:</b> ${escapeHTML(reply)}
      </div>
    `;

    input.value = "";
    box.scrollTop = box.scrollHeight;
  };
}

// AI Enter key support
const aiInput = $("aiInput");
if (aiInput) {
  aiInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      aiButton?.click();
    }
  });
}

// Theme Switch
const themeBtn = $("themeToggle");
if (themeBtn) {
  themeBtn.onclick = () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );
    themeBtn.innerHTML = document.body.classList.contains("dark")
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  };
}

// Load saved theme
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
}

// Admin Form Save
const saveCourseBtn = $("saveCourseBtn");
if (saveCourseBtn) {
  saveCourseBtn.onclick = async () => {
    const title = $("courseTitle").value.trim();
    const desc = $("courseDesc").value.trim();
    const category = $("courseCategory").value.trim();
    const url = $("courseUrl").value.trim();

    if (!title) {
      showToast("Please enter a course title");
      return;
    }

    await addCourse({
      title,
      desc,
      category: category || "General",
      url: url || "",
      price: 0,
      featured: true
    });
  };
}

// ===============================
// MODAL CONTROLS
// ===============================

// Close modal on outside click
document.addEventListener("click", (e) => {
  const modal = $("authModal");
  if (e.target === modal) {
    closeAuthModal();
  }
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAuthModal();
  }
});

// ===============================
// PWA SERVICE WORKER
// ===============================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("Service Worker Ready");
      })
      .catch(error => {
        console.log(error);
      });
  });
}

// ===============================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ===============================

// Make functions available globally for onclick handlers
window.TechLecture = {
  loadCourses,
  addCourse,
  updateCourse,
  removeCourse,
  uploadImage,
  bookmarkCourse,
  saveProgress,
  createCertificate,
  verifyCertificate,
  askAI,
  startCourse,
  searchCourses,
  openAuthModal,
  closeAuthModal,
  toggleAuthMode,
  loginGoogle,
  loginGithub,
  logout
};

// Also expose individual functions
window.startCourse = startCourse;
window.bookmarkCourse = bookmarkCourse;
window.removeCourse = removeCourse;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.loginGoogle = loginGoogle;
window.loginGithub = loginGithub;
window.logout = logout;

console.log("🚀 TechLecture App Loaded Successfully!");
console.log("📚 Firebase connected. Ready to learn!");
