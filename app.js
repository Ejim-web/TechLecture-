// ===============================
// TechLecture - Complete App
// Firebase Modular SDK v10.7.1
// ===============================

import { initializeApp } from "firebase/app";
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
} from "firebase/auth";
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
  serverTimestamp
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

// ===============================
// FIREBASE CONFIGURATION
// ===============================

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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
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
  try {
    await signOut(auth);
    showToast("Logged out");
    const logoutBtn = document.querySelector(".logout-btn");
    if (logoutBtn) logoutBtn.remove();
  } catch (error) {
    showToast(error.message);
  }
}

// ===============================
// AUTH UI CONTROLS
// ===============================

function openAuthModal() {
  const modal = $("authModal");
  if (modal) modal.classList.remove("hidden");
  const emailInput = $("email");
  const passwordInput = $("password");
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
  updateAuthUI();
}

function closeAuthModal() {
  const modal = $("authModal");
  if (modal) modal.classList.add("hidden");
}

function toggleAuthMode() {
  isAuthModeLogin = !isAuthModeLogin;
  updateAuthUI();
}

function updateAuthUI() {
  const modalTitle = $("authModalTitle");
  const loginBtn = $("emailLogin");
  const toggleText = $("authToggle");
  
  if (modalTitle) {
    modalTitle.textContent = isAuthModeLogin ? "Login" : "Sign Up";
  }
  if (loginBtn) {
    loginBtn.textContent = isAuthModeLogin ? "Login" : "Sign Up";
  }
  if (toggleText) {
    toggleText.textContent = isAuthModeLogin ? "Create an account" : "Already have an account? Login";
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
  const loginBtn = $("loginBtn");
  const adminPanel = $("adminPanel");
  const dashboard = $("dashboard");
  const actions = document.querySelector(".actions");

  const existingLogout = document.querySelector(".logout-btn");
  if (existingLogout) existingLogout.remove();

  if (user) {
    isAdmin = await checkAdmin(user.uid);
    console.log("Logged in:", user.email);

    if (loginBtn) {
      loginBtn.innerHTML = `<i class="fa-solid fa-user"></i> ${user.email.split('@')[0]}`;
      loginBtn.style.display = "none";
    }

    if (actions) {
      const logoutBtnEl = document.createElement("button");
      logoutBtnEl.className = "logout-btn";
      logoutBtnEl.innerHTML = `<i class="fa-solid fa-sign-out-alt"></i> Logout`;
      logoutBtnEl.onclick = logout;
      actions.appendChild(logoutBtnEl);
    }

    if (isAdmin && adminPanel) {
      adminPanel.classList.remove("hidden");
      showToast("Admin access enabled");
    }

    if (dashboard) {
      dashboard.classList.remove("hidden");
      await loadProgress();
      updateDashboard();
    }

  } else {
    isAdmin = false;
    if (loginBtn) {
      loginBtn.innerHTML = `<i class="fa-solid fa-user"></i> Login`;
      loginBtn.style.display = "flex";
    }

    const logoutBtnEl = document.querySelector(".logout-btn");
    if (logoutBtnEl) logoutBtnEl.remove();

    if (adminPanel) adminPanel.classList.add("hidden");
    if (dashboard) dashboard.classList.add("hidden");
  }

  loadCourses();
});

// ===============================
// DASHBOARD
// ===============================

function updateDashboard() {
  const courseCount = $("courseCount");
  const progressCount = $("progressCount");
  const certificateCount = $("certificateCount");

  if (courseCount) courseCount.textContent = courses.length;
  if (progressCount) {
    const total = Object.keys(userProgress).length;
    const avg = courses.length > 0 ? Math.round((total / courses.length) * 100) : 0;
    progressCount.textContent = `${avg}%`;
  }
  if (certificateCount) {
    certificateCount.textContent = "0";
  }
}

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
    updateDashboard();
  } catch (error) {
    console.log(error);
    showToast("Error loading courses");
  }
}

function renderCourses() {
  const container = $("courses");
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
        ${course.image ? `<img src="${course.image}" alt="${escapeHTML(course.title)}">` : "📘"}
      </div>
      <h3>${escapeHTML(course.title)}</h3>
      <p>${escapeHTML(course.description || "No description available")}</p>
      <div class="card-actions">
        <button class="primary btn-sm course-start-btn" data-id="${course.id}">
          <i class="fas fa-play"></i> Start Learning
        </button>
        <button class="btn btn-sm course-bookmark-btn" data-id="${course.id}">
          <i class="fas fa-bookmark"></i>
        </button>
        ${isAdmin ? `
          <button class="btn btn-danger btn-sm course-delete-btn" data-id="${course.id}">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  // Add event listeners to course buttons
  document.querySelectorAll('.course-start-btn').forEach(btn => {
    btn.addEventListener('click', () => openCourse(btn.dataset.id));
  });
  
  document.querySelectorAll('.course-bookmark-btn').forEach(btn => {
    btn.addEventListener('click', () => bookmarkCourse(btn.dataset.id));
  });
  
  document.querySelectorAll('.course-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCourse(btn.dataset.id));
  });
}

async function openCourse(courseId) {
  if (!currentUser) {
    showToast("Please login to start learning");
    openAuthModal();
    return;
  }

  const course = courses.find(c => c.id === courseId);
  if (!course) return;

  const modal = $("courseModal");
  const title = $("courseModalTitle");
  const description = $("courseModalDescription");
  const link = $("courseModalLink");

  if (title) title.textContent = course.title;
  if (description) description.textContent = course.description || "No description available";
  if (link) {
    link.href = course.url || "#";
    link.textContent = course.url ? "Open Course" : "Course URL not available";
  }

  if (modal) modal.classList.remove("hidden");
  await saveProgress(courseId, 10);
}

// ===============================
// COURSE ADMIN MANAGEMENT
// ===============================async function addCourse() {
  if (!currentUser || !isAdmin) {
    showToast("Admin access required");
    return;
  }

  const title = $("courseName").value.trim();
  const category = $("courseCategory").value.trim();
  const description = $("courseDescription").value.trim();
  const image = $("courseImage").value.trim();
  const url = $("courseLink").value.trim();

  if (!title) {
    showToast("Please enter a course title");
    return;
  }

  try {
    await addDoc(collection(db, "courses"), {
      title,
      category: category || "General",
      description: description || "",
      image: image || "",
      url: url || "",
      createdAt: serverTimestamp()
    });
    showToast("Course added successfully!");
    $("courseName").value = "";
    $("courseCategory").value = "";
    $("courseDescription").value = "";
    $("courseImage").value = "";
    $("courseLink").value = "";
    loadCourses();
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteCourse(id) {
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
// SEARCH SYSTEM
// ===============================

function searchCourses(value) {
  const searchTerm = value.toLowerCase();
  const filtered = courses.filter(course => {
    return (
      course.title?.toLowerCase().includes(searchTerm) ||
      course.category?.toLowerCase().includes(searchTerm) ||
      course.description?.toLowerCase().includes(searchTerm)
    );
  });

  const container = $("courses");
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
        ${course.image ? `<img src="${course.image}" alt="${escapeHTML(course.title)}">` : "📘"}
      </div>
      <h3>${escapeHTML(course.title)}</h3>
      <p>${escapeHTML(course.description || "No description available")}</p>
      <div class="card-actions">
        <button class="primary btn-sm course-start-btn" data-id="${course.id}">
          <i class="fas fa-play"></i> Start Learning
        </button>
      </div>
    `;
    container.appendChild(div);
  });

  document.querySelectorAll('.course-start-btn').forEach(btn => {
    btn.addEventListener('click', () => openCourse(btn.dataset.id));
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
    showToast(`Progress: ${percent}%`);
    updateDashboard();
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

async function verifyCertificate() {
  const id = $("certificateID").value.trim();
  const result = $("certificateResult");

  if (!id) {
    showToast("Please enter a certificate ID");
    return;
  }

  try {
    const docSnap = await getDoc(doc(db, "certificates", id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      result.innerHTML = `
        ✅ Valid Certificate<br>
        User: ${escapeHTML(data.userName)}<br>
        Course: ${escapeHTML(data.course)}<br>
        Issued: ${data.createdAt?.toDate?.()?.toLocaleDateString() || "Unknown"}
      `;
    } else {
      result.textContent = "❌ Invalid certificate ID";
    }
  } catch (error) {
    showToast(error.message);
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
  } else if (q.includes("cloud")) {
    answer = "Cloud computing provides on-demand access to computing resources. Major providers include AWS, Google Cloud, and Azure. Services include compute, storage, databases, and AI/ML tools.";
  }

  return answer;
}

// ===============================
// UI EVENTS
// ===============================

// Login button
const loginBtn = $("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener('click', openAuthModal);
}

// Start Learning button
const startLearningBtn = $("startLearningBtn");
if (startLearningBtn) {
  startLearningBtn.addEventListener('click', openAuthModal);
}

// Close modal button
const closeModalBtn = $("closeModal");
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', closeAuthModal);
}

// Close course modal
const closeCourseBtn = $("closeCourse");
if (closeCourseBtn) {
  closeCourseBtn.addEventListener('click', () => {
    const modal = $("courseModal");
    if (modal) modal.classList.add("hidden");
  });
}

// Auth toggle
const authToggle = $("authToggle");
if (authToggle) {
  authToggle.addEventListener('click', toggleAuthMode);
}

// Search Events
const searchBtn = $("searchBtn");
if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    const input = $("searchInput");
    if (input) searchCourses(input.value);
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

// Auth Events - Email Login
const emailLoginBtn = $("emailLogin");
if (emailLoginBtn) {
  emailLoginBtn.addEventListener('click', () => {
    const email = $("email").value;
    const password = $("password").value;
    if (!email || !password) {
      showToast("Please enter email and password");
      return;
    }
    if (isAuthModeLogin) {
      login(email, password);
    } else {
      if (password.length < 6) {
        showToast("Password must be at least 6 characters");
        return;
      }
      register(email, password);
    }
  });
}

// Google Login
const googleLoginBtn = $("googleLoginBtn");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', loginGoogle);
}

// GitHub Login
const githubLoginBtn = $("githubLoginBtn");
if (githubLoginBtn) {
  githubLoginBtn.addEventListener('click', loginGithub);
}

// Admin - Add Course
const addCourseBtn = $("addCourse");
if (addCourseBtn) {
  addCourseBtn.addEventListener('click', addCourse);
}

// Certificate Verification
const verifyBtn = $("verifyCertificate");
if (verifyBtn) {
  verifyBtn.addEventListener('click', verifyCertificate);
}

// Enter key for certificate
const certInput = $("certificateID");
if (certInput) {
  certInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      verifyCertificate();
    }
  });
}

// AI Chat Events
const sendAI = $("sendAI");
if (sendAI) {
  sendAI.addEventListener('click', async () => {
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
  });
}

// AI Enter key support
const aiInput = $("aiInput");
if (aiInput) {
  aiInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      sendAI?.click();
    }
  });
}

// Theme Switch
const themeBtn = $("themeBtn");
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );
    themeBtn.innerHTML = document.body.classList.contains("dark")
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  });
}

// Load saved theme
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
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
  const courseModal = $("courseModal");
  if (e.target === courseModal) {
    if (courseModal) courseModal.classList.add("hidden");
  }
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAuthModal();
    const courseModal = $("courseModal");
    if (courseModal) courseModal.classList.add("hidden");
  }
});

// ===============================
// START APP
// ===============================

console.log("🚀 TechLecture App Loaded Successfully!");
console.log("📚 Firebase Modular SDK connected. Ready to learn!");
